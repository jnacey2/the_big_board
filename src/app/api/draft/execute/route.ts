import { NextResponse } from "next/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { draftPicks, drafts, getDb, kids, transactions } from "@/db";
import { etDateStr } from "@/lib/market";
import { backfillSnapshots, replayTransactions } from "@/lib/portfolio";
import { executeBuy, priceOn } from "@/lib/trades";

export const maxDuration = 60;

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
 * split equally across their drafted tickers at the last available price.
 *
 * Intentionally NOT behind the parent PIN: the draft itself is the family
 * activity and this only creates the paper positions inside the game — the
 * parent still handles any real-world money separately.
 */
export async function POST() {
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
  // leave a kid with half a portfolio. SPY is required for the robot mirror.
  const tickers = [...new Set([...picks.map((p) => p.ticker), "SPY"])];
  const prices = new Map<string, number>();
  const failedTickers: string[] = [];
  for (const t of tickers) {
    const price = await priceOn(t, date).catch((e) => {
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
      await executeBuy(kid.id, ticker, shares, price, date, {
        note: `Draft Day: equal-weight auto-buy`,
        spyPrice,
      });
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
