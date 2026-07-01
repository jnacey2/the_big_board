import { NextRequest, NextResponse } from "next/server";
import { hasClaude } from "@/lib/claude";
import {
  detectiveCommentary,
  kidDescription,
  portfolioDayCommentary,
  riskCommentary,
  scoutingReport,
  weeklyRecapCommentary,
} from "@/lib/coach";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!hasClaude()) {
    return NextResponse.json(
      { content: "The Coach is warming up — add an Anthropic API key to hear from him!", cached: true, offline: true }
    );
  }
  const { module, kidId, ticker, force } = await req.json();
  try {
    let result: { content: string; cached: boolean };
    switch (module) {
      case "portfolioDay":
        result = await portfolioDayCommentary(Number(kidId), Boolean(force));
        break;
      case "weeklyRecap":
        result = await weeklyRecapCommentary(Number(kidId), Boolean(force));
        break;
      case "risk":
        result = await riskCommentary(Number(kidId), Boolean(force));
        break;
      case "detective":
        result = await detectiveCommentary(String(ticker), Boolean(force));
        break;
      case "scout":
        result = await scoutingReport(String(ticker), Boolean(force));
        break;
      case "kidDescription":
        result = await kidDescription(String(ticker), Boolean(force));
        break;
      default:
        return NextResponse.json({ error: "unknown module" }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("coach module failed:", e);
    return NextResponse.json(
      { error: "The Coach fumbled that one. Try again!" },
      { status: 500 }
    );
  }
}
