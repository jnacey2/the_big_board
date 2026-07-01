import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, theses } from "@/db";
import { hasClaude } from "@/lib/claude";
import { scoreThesis } from "@/lib/coach";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const kidId = Number(req.nextUrl.searchParams.get("kidId"));
  if (!kidId) return NextResponse.json([]);
  const db = await getDb();
  const rows = await db.select().from(theses).where(eq(theses.kidId, kidId));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { kidId, ticker, body } = await req.json();
  if (!kidId || !ticker || !body?.trim()) {
    return NextResponse.json({ error: "kidId, ticker, body required" }, { status: 400 });
  }
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(theses)
    .where(and(eq(theses.kidId, Number(kidId)), eq(theses.ticker, ticker)));

  let id: number;
  if (existing) {
    await db
      .update(theses)
      .set({ body: String(body).slice(0, 1000), updatedAt: new Date(), score: null, feedback: null })
      .where(eq(theses.id, existing.id));
    id = existing.id;
  } else {
    const [row] = await db
      .insert(theses)
      .values({ kidId: Number(kidId), ticker, body: String(body).slice(0, 1000) })
      .returning();
    id = row.id;
  }

  if (hasClaude()) {
    try {
      await scoreThesis(id);
    } catch (e) {
      console.error("thesis scoring failed:", e);
    }
  }
  const [updated] = await db.select().from(theses).where(eq(theses.id, id));
  return NextResponse.json(updated);
}
