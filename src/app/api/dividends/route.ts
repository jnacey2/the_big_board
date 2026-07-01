import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, pendingDividends, transactions } from "@/db";
import { isAdmin } from "@/lib/adminAuth";
import { detectDividends } from "@/lib/dividends";
import { backfillSnapshots } from "@/lib/portfolio";

export const maxDuration = 120;

export async function GET() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(pendingDividends)
    .where(eq(pendingDividends.status, "pending"));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }
  const db = await getDb();
  const body = await req.json();

  if (body.action === "scan") {
    const queued = await detectDividends();
    return NextResponse.json({ ok: true, queued });
  }

  const { id, action } = body ?? {};
  if (!id || !["confirm", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "id and action (confirm|dismiss) required" }, { status: 400 });
  }
  const [row] = await db.select().from(pendingDividends).where(eq(pendingDividends.id, id));
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "confirm") {
    await db.insert(transactions).values({
      kidId: row.kidId,
      ticker: row.ticker,
      type: "dividend",
      shares: row.shares,
      price: row.amountPerShare,
      amount: row.total,
      tradeDate: row.payDate,
      note: "dividend",
    });
    await backfillSnapshots(row.kidId);
  }
  await db
    .update(pendingDividends)
    .set({ status: action === "confirm" ? "confirmed" : "dismissed" })
    .where(eq(pendingDividends.id, id));
  return NextResponse.json({ ok: true });
}
