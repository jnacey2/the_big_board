import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/fmp";

export async function GET(req: NextRequest) {
  const tickers = (req.nextUrl.searchParams.get("tickers") ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 60);
  if (tickers.length === 0) return NextResponse.json([]);
  const map = await getQuotes(tickers);
  return NextResponse.json(
    [...map.values()].map((q) => ({ ticker: q.ticker, price: q.price, changePct: q.changePct }))
  );
}
