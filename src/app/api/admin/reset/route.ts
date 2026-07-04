import { NextRequest, NextResponse } from "next/server";
import { like, or } from "drizzle-orm";
import {
  badges,
  chatMessages,
  commentaryCache,
  draftPicks,
  drafts,
  getDb,
  kids,
  pendingDividends,
  snapshots,
  theses,
  transactions,
} from "@/db";
import { isAdmin } from "@/lib/adminAuth";

export const maxDuration = 60;

/**
 * Parent-only reset. Two scopes:
 *
 * - "game": wipe the competition (drafts, picks, transactions, snapshots,
 *   pending dividends, badges, theses) but keep the teams and coach chats —
 *   for redoing Draft Day with the same kids.
 * - "all": wipe everything including the kids/teams and chat history — the
 *   app returns to first-run Setup so the family can redo the teams too.
 *
 * Market data (stocks, quotes, price history, news, fundamentals) is never
 * touched; it re-syncs on its own anyway.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const scope = body?.scope;
  if (scope !== "game" && scope !== "all") {
    return NextResponse.json({ error: 'scope must be "game" or "all"' }, { status: 400 });
  }

  const db = await getDb();

  // Order matters: children of `drafts` and `kids` go first (FK constraints).
  await db.delete(draftPicks);
  await db.delete(drafts);
  await db.delete(transactions);
  await db.delete(snapshots);
  await db.delete(pendingDividends);
  await db.delete(badges);
  // The thesis feature was removed from the app, but the table (and any legacy
  // rows) still exists — clear it so deleting `kids` below can't hit its FK.
  await db.delete(theses);
  // Portfolio-derived Coach commentary is keyed per kid and day, so the same
  // kid would see stale pre-reset commentary until tomorrow — drop those.
  // Stock-scoped cache (scouting reports, kid descriptions, news detective)
  // doesn't depend on game state and is expensive to regenerate, so it stays.
  await db
    .delete(commentaryCache)
    .where(
      or(
        like(commentaryCache.cacheKey, "pday:%"),
        like(commentaryCache.cacheKey, "recap:%"),
        like(commentaryCache.cacheKey, "risk:%")
      )
    );

  if (scope === "all") {
    await db.delete(chatMessages);
    await db.delete(kids);
  }

  return NextResponse.json({ ok: true, scope });
}
