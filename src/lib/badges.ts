import { asc, eq } from "drizzle-orm";
import { badges, getDb, snapshots, transactions } from "@/db";
import { getPortfolio, getStats, sectorBreakdown, type Portfolio } from "./portfolio";

type BadgeDef = { code: string; name: string; description: string; emoji: string };

const DEFS: Record<string, BadgeDef> = {
  first_trade: {
    code: "first_trade",
    name: "Opening Bell",
    description: "Made your very first investment!",
    emoji: "🔔",
  },
  first_dividend: {
    code: "first_dividend",
    name: "First Dividend",
    description: "A company paid YOU just for owning it.",
    emoji: "💰",
  },
  diversified: {
    code: "diversified",
    name: "Diversified",
    description: "Holdings across 5+ different sectors.",
    emoji: "🌈",
  },
  green_week: {
    code: "green_week",
    name: "Green Week",
    description: "Finished a whole week in the green.",
    emoji: "🟢",
  },
  all_time_high: {
    code: "all_time_high",
    name: "New Record",
    description: "Portfolio hit an all-time high!",
    emoji: "🚀",
  },
  big_winner: {
    code: "big_winner",
    name: "Big Winner",
    description: "One of your stocks is up more than 25%.",
    emoji: "🏅",
  },
  full_roster: {
    code: "full_roster",
    name: "Full Roster",
    description: "Own 5 or more stocks at once.",
    emoji: "🃏",
  },
  diamond_hands: {
    code: "diamond_hands",
    name: "Diamond Hands",
    description: "Held a stock through a 10% dip without selling.",
    emoji: "💎",
  },
};

async function award(kidId: number, code: keyof typeof DEFS): Promise<void> {
  const db = await getDb();
  const def = DEFS[code];
  await db
    .insert(badges)
    .values({ kidId, ...def })
    .onConflictDoNothing();
}

/** Evaluate all badge conditions for a kid; idempotent. */
export async function checkBadges(kidId: number, portfolio?: Portfolio): Promise<void> {
  const db = await getDb();
  const txs = await db.select().from(transactions).where(eq(transactions.kidId, kidId));
  if (txs.some((t) => t.type === "buy")) await award(kidId, "first_trade");
  if (txs.some((t) => t.type === "dividend")) await award(kidId, "first_dividend");

  const p = portfolio ?? (await getPortfolio(kidId));
  const sectors = sectorBreakdown(p).filter((s) => s.sector !== "Cash");
  if (sectors.length >= 5) await award(kidId, "diversified");
  if (p.positions.length >= 5) await award(kidId, "full_roster");
  if (p.positions.some((pos) => pos.unrealizedPnlPct >= 25)) await award(kidId, "big_winner");

  const stats = await getStats(kidId);
  if (stats.weekReturnPct != null && stats.weekReturnPct > 0) await award(kidId, "green_week");

  const snaps = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.kidId, kidId))
    .orderBy(asc(snapshots.snapDate));
  if (snaps.length >= 5) {
    const last = snaps[snaps.length - 1];
    const maxBefore = Math.max(...snaps.slice(0, -1).map((s) => s.value));
    if (last.value > maxBefore) await award(kidId, "all_time_high");
  }

  // Diamond hands: a currently-held position whose price dipped >=10% below
  // the kid's average cost at some point but they never sold.
  for (const pos of p.positions) {
    const soldAny = txs.some((t) => t.type === "sell" && t.ticker === pos.ticker);
    if (soldAny || pos.avgCost <= 0) continue;
    const { getPriceHistory } = await import("./fmp");
    const firstBuy = txs
      .filter((t) => t.type === "buy" && t.ticker === pos.ticker)
      .map((t) => t.tradeDate)
      .sort()[0];
    if (!firstBuy) continue;
    const hist = await getPriceHistory(pos.ticker, firstBuy);
    const minClose = Math.min(...hist.map((h) => h.close));
    if (hist.length > 0 && minClose <= pos.avgCost * 0.9 && pos.price > minClose) {
      await award(kidId, "diamond_hands");
      break;
    }
  }
}

export async function getBadges(kidId: number) {
  const db = await getDb();
  return db.select().from(badges).where(eq(badges.kidId, kidId));
}
