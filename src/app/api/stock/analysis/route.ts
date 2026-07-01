import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, stockAnalysis } from "@/db";
import { hasClaude } from "@/lib/claude";
import { generateStockAnalysis } from "@/lib/coach";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!hasClaude()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }
  const { ticker } = await req.json();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  const db = await getDb();
  const analysis = await generateStockAnalysis(ticker);
  await db
    .insert(stockAnalysis)
    .values({ ticker, ...analysis, generatedAt: new Date() })
    .onConflictDoUpdate({
      target: stockAnalysis.ticker,
      set: { ...analysis, generatedAt: new Date() },
    });
  const [row] = await db.select().from(stockAnalysis).where(eq(stockAnalysis.ticker, ticker));
  return NextResponse.json(row);
}
