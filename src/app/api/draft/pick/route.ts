import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { draftPicks, drafts, getDb, kids, stocks } from "@/db";
import { hasClaude } from "@/lib/claude";
import { draftPickCommentary } from "@/lib/coach";

export const maxDuration = 60;

/** Snake order: whose turn is overall pick n (0-based)? */
function turnFor(order: number[], n: number): { kidId: number; round: number } {
  const numKids = order.length;
  const round = Math.floor(n / numKids); // 0-based
  const idx = n % numKids;
  const kidId = round % 2 === 0 ? order[idx] : order[numKids - 1 - idx];
  return { kidId, round: round + 1 };
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  const { draftId, ticker } = await req.json();
  if (!draftId || !ticker) {
    return NextResponse.json({ error: "draftId and ticker required" }, { status: 400 });
  }

  const [draft] = await db.select().from(drafts).where(eq(drafts.id, Number(draftId)));
  if (!draft || draft.status !== "live") {
    return NextResponse.json({ error: "No live draft" }, { status: 400 });
  }

  const [stock] = await db.select().from(stocks).where(eq(stocks.ticker, ticker));
  if (!stock || stock.isBenchmark) {
    return NextResponse.json({ error: "Not a draftable stock" }, { status: 400 });
  }

  const picks = await db
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.draftId, draft.id))
    .orderBy(asc(draftPicks.pickNumber));
  if (picks.some((p) => p.ticker === ticker)) {
    return NextResponse.json({ error: `${ticker} is already drafted!` }, { status: 400 });
  }

  const order = draft.kidOrder as number[];
  const totalPicks = draft.rounds * order.length;
  const n = draft.currentPick;
  if (n >= totalPicks) {
    return NextResponse.json({ error: "Draft is complete" }, { status: 400 });
  }
  const { kidId, round } = turnFor(order, n);
  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));

  // Live commentary (best-effort).
  let commentary: string | null = null;
  if (hasClaude() && kid) {
    try {
      const roster = picks.filter((p) => p.kidId === kidId).map((p) => p.ticker);
      commentary = await draftPickCommentary({
        kidName: kid.name,
        teamName: kid.teamName,
        mascot: kid.mascot,
        ticker,
        round,
        pickNumber: n + 1,
        rosterSoFar: roster,
      });
    } catch (e) {
      console.error("draft commentary failed:", e);
    }
  }

  const [pick] = await db
    .insert(draftPicks)
    .values({
      draftId: draft.id,
      kidId,
      ticker,
      round,
      pickNumber: n + 1,
      commentary,
    })
    .returning();

  const nextPick = n + 1;
  const done = nextPick >= totalPicks;
  await db
    .update(drafts)
    .set({ currentPick: nextPick, status: done ? "done" : "live" })
    .where(eq(drafts.id, draft.id));

  return NextResponse.json({ pick, done });
}
