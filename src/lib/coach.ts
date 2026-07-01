import { eq } from "drizzle-orm";
import { getDb, kids, stocks, theses } from "@/db";
import { cachedCoach, coachComplete, fmtMoney, fmtPct } from "./claude";
import { getNews, getQuotes, getFundamentals } from "./fmp";
import {
  dayAttribution,
  getPortfolio,
  getStats,
  sectorBreakdown,
} from "./portfolio";
import { etDateStr } from "./market";

async function marketContext(): Promise<string> {
  const spy = (await getQuotes(["SPY"])).get("SPY");
  if (!spy) return "Overall market move today: unknown.";
  return `Overall market (S&P 500 via SPY) today: ${fmtPct(spy.changePct)}.`;
}

/** "Why did my portfolio move today?" — top of the portfolio page. */
export async function portfolioDayCommentary(kidId: number, force = false) {
  const db = await getDb();
  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  if (!kid) throw new Error("kid not found");
  const key = `pday:${kidId}:${etDateStr()}`;
  return cachedCoach(
    key,
    async () => {
      const p = await getPortfolio(kidId);
      const attr = dayAttribution(p);
      const mkt = await marketContext();
      const lines = attr
        .map(
          (a) =>
            `${a.ticker} (${a.name}): own move ${fmtPct(a.ownMovePct)}, contributed ${fmtPct(a.contributionPct)} to the portfolio's day`
        )
        .join("\n");
      return `Write a short "why did my portfolio move today" summary (3-4 sentences max) for ${kid.name}, whose team is "${kid.teamName}" ${kid.mascot}.

Facts:
- Portfolio today: ${fmtPct(p.dayChangePct)} (${fmtMoney(p.dayChange)}), total value now ${fmtMoney(p.totalValue)}.
- ${mkt}
- Per-holding contributions:
${lines || "(no holdings)"}

Explain which holdings helped and hurt most, and whether today looks more like their specific stocks moving or the whole market moving (compare with the SPY number). Speak directly to ${kid.name}. Remember your honesty rules.`;
    },
    { maxTokens: 350, force }
  );
}

/** Weekly recap for dashboard + portfolio pages. */
export async function weeklyRecapCommentary(kidId: number, force = false) {
  const db = await getDb();
  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  if (!kid) throw new Error("kid not found");
  // Key by ISO week so it regenerates each Monday.
  const now = new Date();
  const week = `${now.getFullYear()}-w${Math.ceil(((now.getTime() - Date.UTC(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7)}`;
  const key = `recap:${kidId}:${week}:${etDateStr()}`;
  return cachedCoach(
    key,
    async () => {
      const p = await getPortfolio(kidId);
      const stats = await getStats(kidId);
      const sectors = sectorBreakdown(p);
      const holdings = p.positions
        .map((pos) => `${pos.ticker}: value ${fmtMoney(pos.value)}, overall P&L ${fmtPct(pos.unrealizedPnlPct)}`)
        .join("\n");
      return `Write a fun weekly recap (4-5 sentences) for ${kid.name} ("${kid.teamName}" ${kid.mascot}).

Facts:
- This week's return: ${stats.weekReturnPct != null ? fmtPct(stats.weekReturnPct) : "n/a"}. Since start: ${stats.sinceStartReturnPct != null ? fmtPct(stats.sinceStartReturnPct) : "n/a"}.
- Portfolio value ${fmtMoney(p.totalValue)}, cash ${fmtMoney(p.cash)}.
- Risk: ${stats.riskLabel ?? "n/a"} (volatility ${stats.volatilityAnnualPct?.toFixed(0) ?? "n/a"}% annualized), Sharpe ${stats.sharpe?.toFixed(2) ?? "n/a"}.
- Sector mix: ${sectors.map((s) => `${s.sector} ${s.pct.toFixed(0)}%`).join(", ")}.
- Holdings:
${holdings || "(none)"}

Mention what drove the week, one observation about their sector mix (concentration = can score big AND give up goals), and end with encouragement. Honesty rules apply.`;
    },
    { maxTokens: 400, force }
  );
}

/** Kid-friendly risk translation with an analogy. */
export async function riskCommentary(kidId: number, force = false) {
  const db = await getDb();
  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  if (!kid) throw new Error("kid not found");
  const key = `risk:${kidId}:${etDateStr()}`;
  return cachedCoach(
    key,
    async () => {
      const p = await getPortfolio(kidId);
      const stats = await getStats(kidId);
      const sectors = sectorBreakdown(p);
      return `Translate this portfolio's risk for ${kid.name} in 2-3 sentences using ONE vivid sports or game analogy (like "a soccer team with too many forwards").

Facts:
- Risk level: ${stats.riskLabel ?? "unknown"} (volatility ${stats.volatilityAnnualPct?.toFixed(0) ?? "n/a"}% annualized), Sharpe ratio ${stats.sharpe?.toFixed(2) ?? "n/a"}.
- Sector mix: ${sectors.map((s) => `${s.sector} ${s.pct.toFixed(0)}%`).join(", ")}.
- ${p.positions.length} holdings; biggest is ${p.positions[0] ? `${p.positions[0].ticker} at ${((p.positions[0].value / Math.max(p.totalValue, 1)) * 100).toFixed(0)}% of the portfolio` : "n/a"}.

Explain what their mix means for scoring big vs. getting hurt. No advice, just understanding.`;
    },
    { maxTokens: 250, force }
  );
}

/** News detective: why did this stock move (today), grounded in headlines + market move. */
export async function detectiveCommentary(ticker: string, force = false) {
  const key = `detective:${ticker}:${etDateStr()}`;
  return cachedCoach(
    key,
    async () => {
      const db = await getDb();
      const [stock] = await db.select().from(stocks).where(eq(stocks.ticker, ticker));
      const q = (await getQuotes([ticker])).get(ticker);
      const news = await getNews(ticker, 6);
      const mkt = await marketContext();
      const headlines = news
        .slice(0, 5)
        .map((n) => `- "${n.title}" (${n.site}, ${new Date(n.publishedAt).toLocaleDateString()})`)
        .join("\n");
      return `Play news detective for ${stock?.name ?? ticker} (${ticker}) in 2-3 sentences.

Facts:
- ${ticker} today: ${q ? fmtPct(q.changePct) : "unknown"} (price ${q ? fmtMoney(q.price) : "?"}).
- ${mkt}
- Recent headlines:
${headlines || "(no recent headlines found)"}

Offer the LIKELY reasons for today's move based on the headlines, then note whether the whole market moved similarly (compare the SPY number — if it did, today may just be the tide). Remember: one article never proves causation.`;
    },
    { maxTokens: 300, force }
  );
}

/** Sports-style scouting report for the draft. */
export async function scoutingReport(ticker: string, force = false) {
  const key = `scout:${ticker}`;
  return cachedCoach(
    key,
    async () => {
      const db = await getDb();
      const [stock] = await db.select().from(stocks).where(eq(stocks.ticker, ticker));
      if (!stock) throw new Error("stock not found");
      const funds = await getFundamentals(ticker).catch(() => []);
      const latest = funds.filter((f) => f.fiscalYear > 0).slice(-1)[0];
      return `You are an ESPN-style draft scout. Write a punchy 2-3 sentence scouting report on ${stock.name} (${ticker}) for a kid about to draft it in a stock-picking fantasy draft.

What we know:
- What kids know them for: ${stock.productsBlurb}
- How they make money: ${stock.howMoneyBlurb}
- Bull case: ${stock.bullBlurb}
- Bear case: ${stock.bearBlurb}
- Teaching concept: ${stock.teachingConcept}
${latest?.revenue ? `- Latest annual revenue: ${fmtMoney(latest.revenue)}${latest.ebitda ? `, EBITDA ${fmtMoney(latest.ebitda)}` : ""}` : ""}

Use a sports metaphor (famous players, star rookie, steady veteran, etc.). End with one thing to watch out for. Do NOT tell them whether to pick it.`;
    },
    { maxTokens: 250, force }
  );
}

/** Live draft-pick commentary. */
export async function draftPickCommentary(params: {
  kidName: string;
  teamName: string;
  mascot: string;
  ticker: string;
  round: number;
  pickNumber: number;
  rosterSoFar: string[];
}): Promise<string> {
  const db = await getDb();
  const [stock] = await db.select().from(stocks).where(eq(stocks.ticker, params.ticker));
  const rosterStocks =
    params.rosterSoFar.length > 0 ? params.rosterSoFar.join(", ") : "(first pick!)";
  return coachComplete(
    `You are a live draft commentator like on ESPN draft night. In 1-2 punchy sentences, react to this pick. Be fun and use the team name.

Pick ${params.pickNumber} (round ${params.round}): ${params.teamName} ${params.mascot} (${params.kidName}) selects ${stock?.name ?? params.ticker} (${params.ticker})!
- The company: ${stock?.howMoneyBlurb ?? ""}
- Why fans like it: ${stock?.bullBlurb ?? ""}
- Their roster so far: ${rosterStocks}

If the pick doubles down on a theme (e.g. lots of games or food stocks), call that out playfully. No advice.`,
    { maxTokens: 150 }
  );
}

/** Score a kid's "why I own it" thesis 1-10 with encouraging feedback. */
export async function scoreThesis(thesisId: number): Promise<void> {
  const db = await getDb();
  const [row] = await db.select().from(theses).where(eq(theses.id, thesisId));
  if (!row) return;
  const [stock] = await db.select().from(stocks).where(eq(stocks.ticker, row.ticker));
  const raw = await coachComplete(
    `Score this kid's investment thesis for ${stock?.name ?? row.ticker} (${row.ticker}) on a 1-10 scale.

Thesis: "${row.body}"

Rubric (kid-friendly):
- Does it say how the company makes money? (up to 3 points)
- Does it mention at least one risk or thing that could go wrong? (up to 3 points)
- Is it their own reasoning about the business, not just "the stock went up" or "I like it"? (up to 4 points)

Reply in EXACTLY this format:
SCORE: <number 1-10, can use .5>
FEEDBACK: <2 sentences: one thing they did well, one specific way to raise their score. Encouraging, kid-friendly.>`,
    { maxTokens: 200 }
  );
  const scoreMatch = raw.match(/SCORE:\s*([\d.]+)/i);
  const fbMatch = raw.match(/FEEDBACK:\s*([\s\S]+)/i);
  const score = scoreMatch ? Math.min(10, Math.max(1, parseFloat(scoreMatch[1]))) : null;
  await db
    .update(theses)
    .set({
      score,
      feedback: fbMatch ? fbMatch[1].trim() : raw.trim(),
      scoredAt: new Date(),
    })
    .where(eq(theses.id, thesisId));
}

/** Claude-written kid-friendly company description ("what do they actually do?"). */
export async function kidDescription(ticker: string, force = false) {
  const key = `kiddesc:${ticker}`;
  return cachedCoach(
    key,
    async () => {
      const db = await getDb();
      const [stock] = await db.select().from(stocks).where(eq(stocks.ticker, ticker));
      if (!stock) throw new Error("stock not found");
      return `Rewrite this company description for a 10-year-old in 2-3 sentences. Make it vivid and concrete about what the company actually does.

Company: ${stock.name} (${ticker})
Official description: ${stock.description?.slice(0, 1200) ?? stock.howMoneyBlurb}`;
    },
    { maxTokens: 200, force }
  );
}

/** Investment rationale + key risks for the deep dive, grounded in fundamentals. */
export async function generateStockAnalysis(ticker: string): Promise<{
  rationaleKid: string;
  rationaleGrownup: string;
  risks: string[];
}> {
  const db = await getDb();
  const [stock] = await db.select().from(stocks).where(eq(stocks.ticker, ticker));
  if (!stock) throw new Error("stock not found");
  const funds = await getFundamentals(ticker);
  const news = await getNews(ticker, 4);
  const fundLines = funds
    .filter((f) => f.fiscalYear > 0)
    .map((f) => {
      const margin =
        f.revenue && f.ebitda && f.revenue > 0 ? ((f.ebitda / f.revenue) * 100).toFixed(0) : "n/a";
      const evEbitda =
        f.enterpriseValue && f.ebitda && f.ebitda > 0
          ? (f.enterpriseValue / f.ebitda).toFixed(1)
          : "n/a";
      return `${f.fiscalYear}: revenue ${f.revenue ? fmtMoney(f.revenue) : "n/a"}, EBITDA ${f.ebitda ? fmtMoney(f.ebitda) : "n/a"} (margin ${margin}%), EV/EBITDA ${evEbitda}`;
    })
    .join("\n");
  const headlines = news.map((n) => `- ${n.title}`).join("\n");

  const raw = await coachComplete(
    `Write an investment rationale and key risks for ${stock.name} (${ticker}), grounded ONLY in the data below.

Fundamentals by fiscal year:
${fundLines || "(no fundamentals available)"}

Recent headlines:
${headlines || "(none)"}

Company: ${stock.howMoneyBlurb} ${stock.bullBlurb} ${stock.bearBlurb}

Reply in EXACTLY this format:
KID: <3-4 sentence bull case a 10-year-old can follow, referencing real trends in the numbers (growing revenue, fat/thin margins, expensive/cheap valuation)>
GROWNUP: <4-5 sentence version for a parent, with actual figures>
RISKS:
- <risk 1, one kid-friendly sentence>
- <risk 2>
- <risk 3>
- <risk 4 (optional)>

Never tell anyone to buy. This is "why investors like it", not advice.`,
    { maxTokens: 700 }
  );

  const kid = raw.match(/KID:\s*([\s\S]*?)(?=GROWNUP:)/i)?.[1]?.trim() ?? "";
  const grownup = raw.match(/GROWNUP:\s*([\s\S]*?)(?=RISKS:)/i)?.[1]?.trim() ?? "";
  const risksBlock = raw.match(/RISKS:\s*([\s\S]*)/i)?.[1] ?? "";
  const risks = risksBlock
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter((l) => l.length > 4);
  return { rationaleKid: kid, rationaleGrownup: grownup, risks };
}
