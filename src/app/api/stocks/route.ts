import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { getDb, stocks } from "@/db";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(stocks).orderBy(asc(stocks.ticker));
  return NextResponse.json(rows);
}
