import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { commentaryCache, getDb } from "@/db";

export const COACH_MODEL = "claude-sonnet-4-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic();
  }
  return client;
}

export function hasClaude(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  // Treat the .env.example placeholder as "not configured".
  return Boolean(k) && !/your_|_here/i.test(k!);
}

export const COACH_SYSTEM = `You are "Coach", the friendly investing coach inside a family stock-market competition app used by kids around 10 years old and their parent.

Voice and style:
- Warm, fun, encouraging — like a great youth sports coach who knows finance.
- Write for a smart 10-year-old: short sentences, vivid analogies, zero jargon unless you immediately explain it.
- Keep responses tight. A few sentences unless asked for more.

Non-negotiable rules:
1. EPISTEMIC HONESTY: never claim to know exactly why a price moved. Use "likely", "may", "one possible reason". Markets move for many reasons at once; news suggests, it does not prove. When explaining a move, always mention at least one alternative explanation (like the whole market moving).
2. NO FINANCIAL ADVICE: describe what is happening; never tell anyone to buy or sell. Say "here's what's happening", not "you should".
3. BALANCE: when you say something good about a company, name one thing that could go the other way (and vice versa).
4. KID-SAFE: age-appropriate language always. If asked about something inappropriate or way off topic, gently steer back to investing and the competition.
5. Never invent numbers. Only use figures provided to you in the prompt.`;

export async function coachComplete(
  prompt: string,
  opts: { maxTokens?: number; system?: string } = {}
): Promise<string> {
  const msg = await anthropic().messages.create({
    model: COACH_MODEL,
    max_tokens: opts.maxTokens ?? 600,
    system: opts.system ?? COACH_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function coachChat(
  messages: { role: "user" | "assistant"; content: string }[],
  context: string
): Promise<string> {
  const msg = await anthropic().messages.create({
    model: COACH_MODEL,
    max_tokens: 700,
    system: `${COACH_SYSTEM}\n\nCurrent context about this kid's portfolio and the competition:\n${context}`,
    messages,
  });
  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/**
 * Cached generation: returns the cached content for `cacheKey` if present,
 * otherwise generates with Claude and stores it. Set `force` to regenerate.
 */
export async function cachedCoach(
  cacheKey: string,
  promptFn: () => Promise<string> | string,
  opts: { maxTokens?: number; force?: boolean } = {}
): Promise<{ content: string; cached: boolean }> {
  const db = await getDb();
  if (!opts.force) {
    const [hit] = await db
      .select()
      .from(commentaryCache)
      .where(eq(commentaryCache.cacheKey, cacheKey));
    if (hit) return { content: hit.content, cached: true };
  }
  const prompt = await promptFn();
  const content = await coachComplete(prompt, { maxTokens: opts.maxTokens });
  await db
    .insert(commentaryCache)
    .values({ cacheKey, content, generatedAt: new Date() })
    .onConflictDoUpdate({
      target: commentaryCache.cacheKey,
      set: { content, generatedAt: new Date() },
    });
  return { content, cached: false };
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
export function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
