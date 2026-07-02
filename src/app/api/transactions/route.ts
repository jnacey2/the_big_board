import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, kids, transactions } from "@/db";
import { isAdmin } from "@/lib/adminAuth";
import { backfillSnapshots, replayTransactions } from "@/lib/portfolio";
import { executeBuy, executeSell } from "@/lib/trades";
import { etDateStr } from "@/lib/market";

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

  // Insert the trade + the robot rival's mirrored SPY trade.
  const tx =
    type === "buy"
      ? await executeBuy(kid.id, ticker, nShares, nPrice, date, { note: note || null })
      : await executeSell(kid.id, ticker, nShares, nPrice, date, { note: note || null });

  // Refresh snapshot history so charts update immediately (best-effort — it
  // needs FMP history; the cron will backfill anything missed).
  await backfillSnapshots(kid.id).catch((e) => console.error("snapshot backfill failed:", e));
  const [robot] = await db.select().from(kids).where(eq(kids.kind, "robot"));
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
