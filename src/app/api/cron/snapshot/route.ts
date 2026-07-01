import { NextRequest, NextResponse } from "next/server";
import { backfillAllSnapshots } from "@/lib/portfolio";
import { detectDividends } from "@/lib/dividends";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await backfillAllSnapshots();
  const dividends = await detectDividends();
  return NextResponse.json({ ok: true, dividendsQueued: dividends });
}
