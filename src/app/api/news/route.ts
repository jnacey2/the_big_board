import { NextRequest, NextResponse } from "next/server";
import { getNews } from "@/lib/fmp";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  const rows = await getNews(ticker, 5);
  return NextResponse.json(
    rows.map((n) => ({
      title: n.title,
      url: n.url,
      site: n.site,
      publishedAt: n.publishedAt,
    }))
  );
}
