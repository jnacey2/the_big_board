import { NextRequest, NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { draftPicks, drafts, getDb, kids } from "@/db";

export async function GET() {
  const db = await getDb();
  const [draft] = await db.select().from(drafts).orderBy(desc(drafts.id)).limit(1);
  if (!draft) return NextResponse.json({ draft: null, picks: [] });
  const picks = await db
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.draftId, draft.id))
    .orderBy(asc(draftPicks.pickNumber));
  return NextResponse.json({ draft, picks });
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  const body = await req.json();

  if (body.action === "create") {
    const kidRows = await db.select().from(kids).where(eq(kids.kind, "kid")).orderBy(asc(kids.id));
    if (kidRows.length === 0) {
      return NextResponse.json({ error: "Create the kids first in Setup" }, { status: 400 });
    }
    let order: number[] = Array.isArray(body.kidOrder) ? body.kidOrder.map(Number) : [];
    const validIds = new Set(kidRows.map((k) => k.id));
    order = order.filter((id) => validIds.has(id));
    if (order.length !== kidRows.length) order = kidRows.map((k) => k.id);

    const rounds = Math.min(Math.max(Number(body.rounds) || 8, 1), 20);
    const pickTimerSecs = [0, 30, 60, 90, 120].includes(Number(body.pickTimerSecs))
      ? Number(body.pickTimerSecs)
      : 0;

    const [draft] = await db
      .insert(drafts)
      .values({ status: "live", rounds, pickTimerSecs, kidOrder: order, currentPick: 0 })
      .returning();
    return NextResponse.json({ draft, picks: [] });
  }

  if (body.action === "abandon") {
    const [draft] = await db.select().from(drafts).orderBy(desc(drafts.id)).limit(1);
    if (draft && draft.status === "live") {
      await db.update(drafts).set({ status: "done" }).where(eq(drafts.id, draft.id));
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
