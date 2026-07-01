import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { chatMessages, getDb, kids } from "@/db";
import { coachChat, fmtMoney, fmtPct, hasClaude } from "@/lib/claude";
import { getPortfolio, getStats } from "@/lib/portfolio";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const kidId = Number(req.nextUrl.searchParams.get("kidId"));
  if (!kidId) return NextResponse.json([]);
  const db = await getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.kidId, kidId))
    .orderBy(asc(chatMessages.id))
    .limit(200);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!hasClaude()) {
    return NextResponse.json(
      { error: "Coach is offline — add ANTHROPIC_API_KEY to wake him up." },
      { status: 503 }
    );
  }
  const { kidId, message } = await req.json();
  if (!kidId || !message) {
    return NextResponse.json({ error: "kidId and message required" }, { status: 400 });
  }
  const db = await getDb();
  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  if (!kid) return NextResponse.json({ error: "kid not found" }, { status: 404 });

  await db.insert(chatMessages).values({ kidId, role: "user", content: String(message).slice(0, 2000) });

  // Build portfolio context for grounding.
  let context = `Kid: ${kid.name}, team "${kid.teamName}" ${kid.mascot}.`;
  try {
    const p = await getPortfolio(kidId);
    const stats = await getStats(kidId);
    const lines = p.positions
      .map(
        (pos) =>
          `${pos.ticker} (${pos.name}): ${pos.shares.toFixed(3)} shares, value ${fmtMoney(pos.value)}, today ${fmtPct(pos.dayChangePct)}, overall ${fmtPct(pos.unrealizedPnlPct)}`
      )
      .join("\n");
    context += `\nPortfolio value: ${fmtMoney(p.totalValue)} (cash ${fmtMoney(p.cash)}). Today: ${fmtPct(p.dayChangePct)}. Since start: ${fmtPct(p.totalReturnPct)}.`;
    if (stats.sharpe != null) context += ` Sharpe ratio: ${stats.sharpe.toFixed(2)}. Risk: ${stats.riskLabel}.`;
    context += `\nHoldings:\n${lines || "(no holdings yet)"}`;
  } catch {
    context += "\n(no portfolio data yet)";
  }

  const history = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.kidId, kidId))
    .orderBy(asc(chatMessages.id))
    .limit(200);
  const msgs = history.slice(-20).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const reply = await coachChat(msgs, context);
  await db.insert(chatMessages).values({ kidId, role: "assistant", content: reply });
  return NextResponse.json({ reply });
}
