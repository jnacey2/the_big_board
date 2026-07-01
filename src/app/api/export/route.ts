import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { getDb, kids, snapshots, transactions } from "@/db";
import { isAdmin } from "@/lib/adminAuth";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Parent PIN required" }, { status: 401 });
  }
  const what = req.nextUrl.searchParams.get("what") ?? "transactions";
  const db = await getDb();
  const kidRows = await db.select().from(kids);
  const kidName = new Map(kidRows.map((k) => [k.id, k.name]));

  let csv = "";
  if (what === "snapshots") {
    const rows = await db.select().from(snapshots).orderBy(asc(snapshots.snapDate));
    csv = toCsv(
      rows.map((r) => ({
        date: r.snapDate,
        kid: kidName.get(r.kidId) ?? r.kidId,
        totalValue: r.value.toFixed(2),
        holdingsValue: r.holdingsValue.toFixed(2),
        cash: r.cash.toFixed(2),
        invested: r.invested.toFixed(2),
      }))
    );
  } else {
    const rows = await db.select().from(transactions).orderBy(asc(transactions.tradeDate));
    csv = toCsv(
      rows.map((r) => ({
        date: r.tradeDate,
        kid: kidName.get(r.kidId) ?? r.kidId,
        type: r.type,
        ticker: r.ticker,
        shares: r.shares,
        price: r.price.toFixed(4),
        amount: r.amount.toFixed(2),
        note: r.note ?? "",
      }))
    );
  }
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${what}.csv"`,
    },
  });
}
