import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { draftPicks, drafts, getDb, kids, snapshots, transactions } from "@/db";
import { isAdmin } from "@/lib/adminAuth";
import { getQuotes } from "@/lib/fmp";
import { etDateStr } from "@/lib/market";
import { backfillSnapshots, replayTransactions } from "@/lib/portfolio";
import {
  executeBuy,
  fundRobotBenchmark,
  priceOn,
  robotBenchmarkAmount,
  ROBOT_BENCHMARK_NOTE,
} from "@/lib/trades";

export const maxDuration = 60;

/** Note written on every draft-execution buy — undo targets exactly these rows. */
const DRAFT_BUY_NOTE = "Draft Day: equal-weight auto-buy";

export type ExecutedPosition = {
  ticker: string;
  shares: number;
  price: number;
  amount: number;
};

export type ExecutedTeam = {
  kidId: number;
  name: string;
  teamName: string;
  mascot: string;
  color: string;
  cashSpent: number;
  positions: ExecutedPosition[];
};

/**
 * Turn a completed draft into real portfolios: each kid's remaining cash is
 * split equally across their drafted tickers, priced with the same quotes the
 * portfolio pages value positions with — so each team is worth exactly its
 * starting budget the moment the buys land.
 *
 * Intentionally NOT behind the parent PIN: the draft itself is the family
 * activity and this only creates the paper positions inside the game — the
 * parent still handles any real-world money separately.
 *
 * The robot benchmark (Indexo) is funded here too: a single deposit equal to
 * one kid's budget, all of it into SPY at the same quote price — and that's
 * his last trade ever. He does NOT mirror kid trades afterwards.
 *
 * POST with {action:"undo"} (parent PIN required) reverses an execution:
 * deletes the auto-buys and the robot's benchmark rows, rebuilds snapshots,
 * and clears executedAt so the draft can be bought again.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body?.action === "undo") return undoExecution();

  const db = await getDb();

  const [draft] = await db.select().from(drafts).orderBy(desc(drafts.id)).limit(1);
  if (!draft || draft.status !== "done") {
    return NextResponse.json({ error: "No completed draft to execute" }, { status: 400 });
  }
  if (draft.executedAt) {
    return NextResponse.json(
      { error: "This draft's portfolios were already bought" },
      { status: 409 }
    );
  }

  const picks = await db
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.draftId, draft.id))
    .orderBy(asc(draftPicks.pickNumber));
  if (picks.length === 0) {
    return NextResponse.json({ error: "This draft has no picks" }, { status: 400 });
  }

  const kidRows = await db.select().from(kids).where(eq(kids.kind, "kid"));
  const rosterByKid = new Map<number, string[]>();
  for (const p of picks) {
    rosterByKid.set(p.kidId, [...(rosterByKid.get(p.kidId) ?? []), p.ticker]);
  }

  const date = etDateStr();

  // Look up every price first — all-or-nothing, so a failed lookup can't
  // leave a kid with half a portfolio. SPY is required for the robot benchmark.
  //
  // Buy at the SAME price source the app values portfolios with (getQuotes):
  // if we bought at yesterday's close but valued at today's quote, kids would
  // show instant phantom gains/losses. priceOn is only a fallback for tickers
  // with no quote at all.
  const tickers = [...new Set([...picks.map((p) => p.ticker), "SPY"])];
  const quoteMap = await getQuotes(tickers).catch((e) => {
    console.error("quote lookup failed:", e);
    return new Map<string, { price: number }>();
  });
  const prices = new Map<string, number>();
  const failedTickers: string[] = [];
  for (const t of tickers) {
    const quotePrice = quoteMap.get(t)?.price;
    const price =
      quotePrice && quotePrice > 0
        ? quotePrice
        : await priceOn(t, date).catch((e) => {
            console.error(`price lookup failed for ${t}:`, e);
            return null;
          });
    if (price && price > 0) prices.set(t, price);
    else failedTickers.push(t);
  }
  if (failedTickers.length > 0) {
    return NextResponse.json(
      {
        error: `Couldn't get prices for ${failedTickers.join(", ")} — no trades were made. Check the FMP API key and try again.`,
        failedTickers,
      },
      { status: 502 }
    );
  }

  // Atomically claim the draft so double-clicks / two tabs can't buy twice.
  const claimed = await db
    .update(drafts)
    .set({ executedAt: new Date() })
    .where(and(eq(drafts.id, draft.id), isNull(drafts.executedAt)))
    .returning();
  if (claimed.length === 0) {
    return NextResponse.json(
      { error: "This draft's portfolios were already bought" },
      { status: 409 }
    );
  }

  const spyPrice = prices.get("SPY")!;
  const teams: ExecutedTeam[] = [];
  for (const kid of kidRows) {
    const roster = rosterByKid.get(kid.id);
    if (!roster || roster.length === 0) continue;

    const existing = await db.select().from(transactions).where(eq(transactions.kidId, kid.id));
    const { cash } = replayTransactions(existing, kid.startingBudget);
    const perStock = cash / roster.length;
    if (perStock <= 0.01) continue; // no cash left to invest

    const positions: ExecutedPosition[] = [];
    for (const ticker of roster) {
      const price = prices.get(ticker)!;
      const shares = perStock / price;
      await executeBuy(kid.id, ticker, shares, price, date, { note: DRAFT_BUY_NOTE });
      positions.push({ ticker, shares, price, amount: perStock });
    }
    teams.push({
      kidId: kid.id,
      name: kid.name,
      teamName: kid.teamName,
      mascot: kid.mascot,
      color: kid.color,
      cashSpent: perStock * roster.length,
      positions,
    });
  }

  // Fund the robot benchmark: one deposit + one all-in SPY buy at the same
  // quote price the kids bought at. Skipped if he already has his benchmark
  // rows (e.g. this draft was undone and re-executed the same day but a
  // parent manually rebuilt him in between).
  await fundRobotBenchmark(await robotBenchmarkAmount(), spyPrice, date);

  // Refresh snapshots so the race chart updates immediately (best-effort).
  for (const t of teams) {
    await backfillSnapshots(t.kidId).catch((e) => console.error("snapshot backfill failed:", e));
  }
  const [robot] = await db.select().from(kids).where(eq(kids.kind, "robot"));
  if (robot) {
    await backfillSnapshots(robot.id).catch((e) => console.error("robot backfill failed:", e));
  }

  return NextResponse.json({ ok: true, date, teams });
}

/**
 * Reverse the most recent draft execution (parent PIN required): delete the
 * auto-buy transactions it created and the robot's benchmark deposit + SPY
 * buy (found by their tagged note; legacy per-trade mirrors linked via
 * mirrorsTransactionId are cleaned up too), rebuild affected snapshots from
 * what's left, and clear executedAt so "Buy the portfolios!" is available
 * again.
 */
async function undoExecution() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }
  const db = await getDb();

  const [draft] = await db.select().from(drafts).orderBy(desc(drafts.id)).limit(1);
  if (!draft?.executedAt) {
    return NextResponse.json({ error: "No executed draft to undo" }, { status: 400 });
  }

  // The buys were dated with etDateStr() at execution time — scope by that
  // date too so an older draft's auto-buys (if any) are left alone.
  const execDate = etDateStr(draft.executedAt);
  const draftBuys = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.note, DRAFT_BUY_NOTE), eq(transactions.tradeDate, execDate)));
  const buyIds = draftBuys.map((t) => t.id);

  // Robot rows to remove: the tagged benchmark deposit + SPY buy (matched by
  // note alone — the pair exists at most once, and an admin rebuild may have
  // re-dated it), plus any legacy per-trade mirrors from the old model.
  const robotRows = [
    ...(await db
      .select()
      .from(transactions)
      .where(eq(transactions.note, ROBOT_BENCHMARK_NOTE))),
    ...(buyIds.length
      ? await db
          .select()
          .from(transactions)
          .where(inArray(transactions.mirrorsTransactionId, buyIds))
      : []),
  ];

  const affectedKidIds = [...new Set([...draftBuys, ...robotRows].map((t) => t.kidId))];

  if (robotRows.length > 0) {
    await db.delete(transactions).where(inArray(transactions.id, robotRows.map((t) => t.id)));
  }
  if (buyIds.length > 0) {
    await db.delete(transactions).where(inArray(transactions.id, buyIds));
  }

  // Snapshots were built from those buys — wipe and rebuild from what remains.
  if (affectedKidIds.length > 0) {
    await db.delete(snapshots).where(inArray(snapshots.kidId, affectedKidIds));
    for (const kidId of affectedKidIds) {
      await backfillSnapshots(kidId).catch((e) => console.error("snapshot rebuild failed:", e));
    }
  }

  await db.update(drafts).set({ executedAt: null }).where(eq(drafts.id, draft.id));

  return NextResponse.json({
    ok: true,
    undone: { transactions: buyIds.length + robotRows.length, kids: affectedKidIds.length },
  });
}
