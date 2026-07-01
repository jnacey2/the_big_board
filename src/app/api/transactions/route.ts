import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, kids, transactions } from "@/db";
import { isAdmin } from "@/lib/adminAuth";
import { ensurePriceHistory, getPriceHistory, getQuotes } from "@/lib/fmp";
import { backfillSnapshots, replayTransactions } from "@/lib/portfolio";
import { etDateStr, isMarketOpen } from "@/lib/market";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const db = await getDb();
  const kidId = req.nextUrl.searchParams.get("kidId");
  const rows = kidId
    ? await db
        .select()
        .from(transactions)
        .where(eq(transactions.kidId, Number(kidId)))
        .orderBy(desc(transactions.tradeDate), desc(transactions.id))
    : await db
        .select()
        .from(transactions)
        .orderBy(desc(transactions.tradeDate), desc(transactions.id));
  return NextResponse.json(rows);
}

/** Close price of `ticker` on `date` (or the last close before it); live quote for today. */
async function priceOn(ticker: string, date: string): Promise<number | null> {
  if (date === etDateStr() && isMarketOpen()) {
    const q = (await getQuotes([ticker])).get(ticker);
    if (q) return q.price;
  }
  await ensurePriceHistory(ticker, date);
  const hist = await getPriceHistory(ticker, "1970-01-01");
  const onOrBefore = hist.filter((h) => h.date <= date);
  if (onOrBefore.length > 0) return onOrBefore[onOrBefore.length - 1].close;
  // date precedes history (e.g. today, market not yet in daily data): use quote
  const q = (await getQuotes([ticker])).get(ticker);
  return q?.price ?? null;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }
  const db = await getDb();
  const body = await req.json();
  const { kidId, ticker, type, shares, price, tradeDate, note } = body ?? {};

  if (!kidId || !ticker || !["buy", "sell"].includes(type)) {
    return NextResponse.json({ error: "kidId, ticker, and type (buy|sell) required" }, { status: 400 });
  }
  const nShares = Number(shares);
  const nPrice = Number(price);
  if (!(nShares > 0) || !(nPrice > 0)) {
    return NextResponse.json({ error: "shares and price must be positive" }, { status: 400 });
  }
  const date = tradeDate || etDateStr();
  const amount = nShares * nPrice;

  const [kid] = await db.select().from(kids).where(eq(kids.id, Number(kidId)));
  if (!kid || kid.kind !== "kid") {
    return NextResponse.json({ error: "kid not found" }, { status: 404 });
  }

  // Guardrails: enough cash to buy / enough shares to sell.
  const existing = await db.select().from(transactions).where(eq(transactions.kidId, kid.id));
  const state = replayTransactions(existing, kid.startingBudget);
  if (type === "buy" && amount > state.cash + 0.01) {
    return NextResponse.json(
      { error: `Not enough cash: ${kid.name} has $${state.cash.toFixed(2)} left` },
      { status: 400 }
    );
  }
  if (type === "sell" && nShares > (state.shares.get(ticker) ?? 0) + 1e-9) {
    return NextResponse.json(
      { error: `${kid.name} only holds ${(state.shares.get(ticker) ?? 0).toFixed(4)} shares of ${ticker}` },
      { status: 400 }
    );
  }

  const [tx] = await db
    .insert(transactions)
    .values({
      kidId: kid.id,
      ticker,
      type,
      shares: nShares,
      price: nPrice,
      amount,
      tradeDate: date,
      note: note || null,
    })
    .returning();

  // ── Robot rival mirror: same dollars into/out of SPY on the same date ──
  const [robot] = await db.select().from(kids).where(eq(kids.kind, "robot"));
  if (robot) {
    const spyPrice = await priceOn("SPY", date).catch((e) => {
      console.error("SPY price lookup failed (robot mirror skipped):", e);
      return null;
    });
    if (spyPrice && spyPrice > 0) {
      if (type === "buy") {
        // Fund the robot with the same dollars, then buy SPY.
        await db.insert(transactions).values({
          kidId: robot.id,
          ticker: "SPY",
          type: "deposit",
          shares: 0,
          price: 0,
          amount,
          tradeDate: date,
          note: `mirrors ${kid.teamName} ${ticker} buy`,
          mirrorsTransactionId: tx.id,
        });
        await db.insert(transactions).values({
          kidId: robot.id,
          ticker: "SPY",
          type: "buy",
          shares: amount / spyPrice,
          price: spyPrice,
          amount,
          tradeDate: date,
          note: `mirrors ${kid.teamName} ${ticker} buy`,
          mirrorsTransactionId: tx.id,
        });
      } else {
        // Sell the same dollar amount of SPY (capped at what the robot holds).
        const robotTxs = await db
          .select()
          .from(transactions)
          .where(eq(transactions.kidId, robot.id));
        const robotState = replayTransactions(robotTxs, 0);
        const heldSpy = robotState.shares.get("SPY") ?? 0;
        const sellShares = Math.min(amount / spyPrice, heldSpy);
        if (sellShares > 1e-9) {
          await db.insert(transactions).values({
            kidId: robot.id,
            ticker: "SPY",
            type: "sell",
            shares: sellShares,
            price: spyPrice,
            amount: sellShares * spyPrice,
            tradeDate: date,
            note: `mirrors ${kid.teamName} ${ticker} sell`,
            mirrorsTransactionId: tx.id,
          });
        }
      }
    }
  }

  // Refresh snapshot history so charts update immediately (best-effort — it
  // needs FMP history; the cron will backfill anything missed).
  await backfillSnapshots(kid.id).catch((e) => console.error("snapshot backfill failed:", e));
  if (robot) {
    await backfillSnapshots(robot.id).catch((e) => console.error("robot backfill failed:", e));
  }

  return NextResponse.json(tx);
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }
  const db = await getDb();
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Remove robot mirrors too.
  await db.delete(transactions).where(eq(transactions.mirrorsTransactionId, id));
  await db.delete(transactions).where(eq(transactions.id, id));

  await backfillSnapshots(tx.kidId);
  const [robot] = await db.select().from(kids).where(eq(kids.kind, "robot"));
  if (robot) await backfillSnapshots(robot.id);
  return NextResponse.json({ ok: true });
}
