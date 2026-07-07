import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb, kids, snapshots, stocks, transactions } from "@/db";
import { ensurePriceHistory, getPriceHistory, getQuotes } from "./fmp";
import { isMarketDay, lastCompletedMarketDay, startOfWeekEt } from "./market";

export const RISK_FREE_RATE = 0.045;

export type Position = {
  ticker: string;
  name: string;
  sector: string;
  logoUrl: string | null;
  shares: number;
  costBasis: number; // total dollars paid for current shares (avg-cost method)
  avgCost: number;
  realizedPnl: number;
  price: number;
  prevClose: number | null;
  value: number;
  dayChange: number; // dollars today
  dayChangePct: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
};

export type Portfolio = {
  kidId: number;
  positions: Position[];
  cash: number;
  holdingsValue: number;
  totalValue: number;
  invested: number; // net dollars deployed (buys - sells - dividends received)
  startingBudget: number;
  contributions: number; // outside money in: starting budget + deposits
  dayChange: number;
  dayChangePct: number;
  totalReturnPct: number; // vs net contributions
  realizedPnl: number;
  dividendsReceived: number;
};

type TxRow = typeof transactions.$inferSelect;

/** Replay transactions to get share counts, avg-cost basis, cash, realized P&L. */
export function replayTransactions(
  txs: TxRow[],
  startingBudget: number
): {
  shares: Map<string, number>;
  costBasis: Map<string, number>;
  realized: Map<string, number>;
  cash: number;
  dividends: number;
} {
  const shares = new Map<string, number>();
  const costBasis = new Map<string, number>();
  const realized = new Map<string, number>();
  let cash = startingBudget;
  let dividends = 0;

  const sorted = [...txs].sort(
    (a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.id - b.id
  );
  for (const tx of sorted) {
    const s = shares.get(tx.ticker) ?? 0;
    const cb = costBasis.get(tx.ticker) ?? 0;
    if (tx.type === "buy") {
      shares.set(tx.ticker, s + tx.shares);
      costBasis.set(tx.ticker, cb + tx.amount);
      cash -= tx.amount;
    } else if (tx.type === "sell") {
      const sellShares = Math.min(tx.shares, s);
      const avg = s > 0 ? cb / s : 0;
      const basisOut = avg * sellShares;
      shares.set(tx.ticker, s - sellShares);
      costBasis.set(tx.ticker, cb - basisOut);
      realized.set(tx.ticker, (realized.get(tx.ticker) ?? 0) + (tx.amount - basisOut));
      cash += tx.amount;
    } else if (tx.type === "dividend") {
      cash += tx.amount;
      dividends += tx.amount;
    } else if (tx.type === "deposit") {
      // External money in (used by the robot rival's mirrored funding).
      cash += tx.amount;
    }
  }
  return { shares, costBasis, realized, cash, dividends };
}

export async function getPortfolio(kidId: number): Promise<Portfolio> {
  const db = await getDb();
  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  if (!kid) throw new Error(`Kid ${kidId} not found`);

  const txs = await db.select().from(transactions).where(eq(transactions.kidId, kidId));
  const { shares, costBasis, realized, cash, dividends } = replayTransactions(
    txs,
    kid.startingBudget
  );

  const held = [...shares.entries()].filter(([, n]) => n > 1e-9);
  const tickers = held.map(([t]) => t);
  const [quoteMap, stockRows] = await Promise.all([
    getQuotes(tickers),
    tickers.length
      ? db.select().from(stocks).where(inArray(stocks.ticker, tickers))
      : Promise.resolve([]),
  ]);
  const stockByTicker = new Map(stockRows.map((s) => [s.ticker, s]));

  // Day-change baseline rule: shares bought AFTER the last completed market
  // session haven't lived through a close yet, so their "today" move is
  // measured from what was actually paid — not from the quote's prevClose.
  // This covers buys made today, over a weekend, or on a holiday: until the
  // market trades again, the quote still equals the purchase price, so day
  // change reads exactly 0; once the next session opens, it shows movement
  // since purchase. After the position has lived through a full session,
  // prevClose behaves normally. Positions mixing fresh and older shares are
  // approximated per-bucket: fresh shares at their aggregate buy price,
  // older shares at prevClose.
  const lastSession = lastCompletedMarketDay();
  const freshBuyShares = new Map<string, number>();
  const freshBuyCost = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type === "buy" && tx.tradeDate > lastSession) {
      freshBuyShares.set(tx.ticker, (freshBuyShares.get(tx.ticker) ?? 0) + tx.shares);
      freshBuyCost.set(tx.ticker, (freshBuyCost.get(tx.ticker) ?? 0) + tx.amount);
    }
  }

  const positions: Position[] = held.map(([ticker, n]) => {
    const q = quoteMap.get(ticker);
    const st = stockByTicker.get(ticker);
    const cbForFallback = costBasis.get(ticker) ?? 0;
    // No live quote (offline / API hiccup): value at average cost rather than $0.
    // Loud warning because this silently misvalues the position (cost != market).
    if (!q) {
      console.warn(
        `getPortfolio(kid ${kidId}): no quote for ${ticker}; valuing ${n} shares at avg cost`
      );
    }
    const price = q?.price ?? (n > 0 ? cbForFallback / n : 0);
    const prevClose = q?.prevClose ?? null;
    const cb = costBasis.get(ticker) ?? 0;
    const value = n * price;
    // Split today's move: shares that have lived through a market close move
    // from prevClose; freshly bought shares move from what was paid for them.
    const fresh = Math.min(freshBuyShares.get(ticker) ?? 0, n);
    const seasoned = n - fresh;
    const buyCost =
      fresh > 0
        ? (freshBuyCost.get(ticker) ?? 0) * (fresh / (freshBuyShares.get(ticker) ?? 1))
        : 0;
    const dayChange =
      (prevClose != null ? (price - prevClose) * seasoned : 0) +
      (price * fresh - buyCost);
    const dayBase = (prevClose ?? 0) * seasoned + buyCost;
    return {
      ticker,
      name: st?.name ?? ticker,
      sector: st?.sector ?? "Unknown",
      logoUrl: st?.logoUrl ?? null,
      shares: n,
      costBasis: cb,
      avgCost: n > 0 ? cb / n : 0,
      realizedPnl: realized.get(ticker) ?? 0,
      price,
      prevClose,
      value,
      dayChange,
      dayChangePct: dayBase > 0 ? (dayChange / dayBase) * 100 : 0,
      unrealizedPnl: value - cb,
      unrealizedPnlPct: cb > 0 ? ((value - cb) / cb) * 100 : 0,
    };
  });

  positions.sort((a, b) => b.value - a.value);
  const holdingsValue = positions.reduce((s, p) => s + p.value, 0);
  const totalValue = holdingsValue + cash;
  const dayChange = positions.reduce((s, p) => s + p.dayChange, 0);
  const prevTotal = totalValue - dayChange;
  const invested = txs
    .filter((t) => t.type === "buy")
    .reduce((s, t) => s + t.amount, 0);
  const totalRealized = [...realized.values()].reduce((s, v) => s + v, 0);

  // Money the outside world put in: starting budget plus any deposits
  // (the robot rival is funded entirely by mirrored deposits).
  const contributions =
    kid.startingBudget +
    txs.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);

  return {
    kidId,
    positions,
    cash,
    holdingsValue,
    totalValue,
    invested,
    startingBudget: kid.startingBudget,
    contributions,
    dayChange,
    dayChangePct: prevTotal > 0 ? (dayChange / prevTotal) * 100 : 0,
    totalReturnPct:
      contributions > 0 ? ((totalValue - contributions) / contributions) * 100 : 0,
    realizedPnl: totalRealized,
    dividendsReceived: dividends,
  };
}

// ── Snapshots ─────────────────────────────────────────────────────

/**
 * Rebuild end-of-day snapshots for a kid from their first transaction through the
 * last completed market day, using cached daily closes. Idempotent.
 */
export async function backfillSnapshots(kidId: number): Promise<number> {
  const db = await getDb();
  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  if (!kid) return 0;
  const txs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.kidId, kidId))
    .orderBy(asc(transactions.tradeDate));
  if (txs.length === 0) return 0;

  const firstDate = txs[0].tradeDate;
  const endDate = lastCompletedMarketDay();
  if (firstDate > endDate) return 0;

  const tickers = [...new Set(txs.filter((t) => t.type !== "dividend").map((t) => t.ticker))];
  await Promise.all(tickers.map((t) => ensurePriceHistory(t, firstDate)));
  const histories = new Map<string, Map<string, number>>();
  for (const t of tickers) {
    const rows = await getPriceHistory(t, firstDate);
    histories.set(t, new Map(rows.map((r) => [r.date, r.close])));
  }

  // Walk each market day, replaying transactions up to that day.
  let count = 0;
  const cursor = new Date(`${firstDate}T12:00:00Z`);
  const lastKnownClose = new Map<string, number>();
  while (cursor.toISOString().slice(0, 10) <= endDate) {
    const ds = cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isMarketDay(ds)) continue;

    const upTo = txs.filter((t) => t.tradeDate <= ds);
    const { shares, cash } = replayTransactions(upTo, kid.startingBudget);
    let holdingsValue = 0;
    for (const [ticker, n] of shares) {
      if (n <= 1e-9) continue;
      const close = histories.get(ticker)?.get(ds) ?? lastKnownClose.get(ticker) ?? 0;
      if (histories.get(ticker)?.get(ds) != null) {
        lastKnownClose.set(ticker, histories.get(ticker)!.get(ds)!);
      }
      holdingsValue += n * close;
    }
    const invested = upTo.filter((t) => t.type === "buy").reduce((s, t) => s + t.amount, 0);
    await db
      .insert(snapshots)
      .values({
        kidId,
        snapDate: ds,
        value: holdingsValue + cash,
        holdingsValue,
        cash,
        invested,
      })
      .onConflictDoUpdate({
        target: [snapshots.kidId, snapshots.snapDate],
        set: { value: holdingsValue + cash, holdingsValue, cash, invested },
      });
    count++;
  }
  return count;
}

export async function backfillAllSnapshots(): Promise<void> {
  const db = await getDb();
  const allKids = await db.select().from(kids);
  for (const k of allKids) await backfillSnapshots(k.id);
}

// ── Stats: returns, volatility, Sharpe ────────────────────────────

export type PortfolioStats = {
  volatilityAnnualPct: number | null;
  sharpe: number | null;
  riskLabel: "Low" | "Medium" | "High" | null;
  weekReturnPct: number | null;
  sinceStartReturnPct: number | null;
};

/**
 * Time-weighted daily returns per market day, adjusted for external deposits
 * (the robot rival is funded by mirrored deposits mid-competition; kids get all
 * cash on day one). r_t = (V_t - deposits_t) / V_{t-1} - 1.
 */
async function getDailyReturns(
  kidId: number
): Promise<{ dates: string[]; returns: number[] }> {
  const db = await getDb();
  const snaps = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.kidId, kidId))
    .orderBy(asc(snapshots.snapDate));
  if (snaps.length < 2) return { dates: [], returns: [] };

  const txs = await db.select().from(transactions).where(eq(transactions.kidId, kidId));
  const depositsByDay = new Map<string, number>();
  for (const t of txs) {
    if (t.type === "deposit") {
      depositsByDay.set(t.tradeDate, (depositsByDay.get(t.tradeDate) ?? 0) + t.amount);
    }
  }

  const dates: string[] = [];
  const returns: number[] = [];
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1].value;
    const dep = depositsByDay.get(snaps[i].snapDate) ?? 0;
    if (prev > 0) {
      dates.push(snaps[i].snapDate);
      returns.push((snaps[i].value - dep) / prev - 1);
    }
  }
  return { dates, returns };
}

/** Growth-of-$100 index series (time-weighted), for the race chart. */
export async function getReturnSeries(
  kidId: number
): Promise<{ date: string; index: number }[]> {
  const db = await getDb();
  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  const snaps = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.kidId, kidId))
    .orderBy(asc(snapshots.snapDate));
  if (!kid || snaps.length === 0) return [];
  const { dates, returns } = await getDailyReturns(kidId);

  // Anchor the race at a synthetic 0% "start" point the day before the first
  // snapshot, and value the first snapshot against the money put in by then
  // (starting budget + deposits). Day one then draws a real line segment —
  // not a single floating dot — and the whole series lines up with the
  // "since start" numbers on the scoreboard.
  const txs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.kidId, kidId));
  const baseContrib =
    kid.startingBudget +
    txs
      .filter((t) => t.type === "deposit" && t.tradeDate <= snaps[0].snapDate)
      .reduce((s, t) => s + t.amount, 0);

  const originDate = new Date(`${snaps[0].snapDate}T12:00:00Z`);
  originDate.setUTCDate(originDate.getUTCDate() - 1);

  const series = [{ date: originDate.toISOString().slice(0, 10), index: 100 }];
  let idx = baseContrib > 0 ? (snaps[0].value / baseContrib) * 100 : 100;
  series.push({ date: snaps[0].snapDate, index: idx });
  for (let i = 0; i < dates.length; i++) {
    idx *= 1 + returns[i];
    series.push({ date: dates[i], index: idx });
  }
  return series;
}

/**
 * This-week return, computed live so it shows from day one.
 *
 * Rule: current total value vs. the last end-of-day snapshot BEFORE this
 * week (Monday ET). Deposits made this week are subtracted from current
 * value so outside money doesn't count as return. In week one there is no
 * pre-week snapshot, so the baseline falls back to net contributions
 * (starting budget + deposits) — i.e. This Week equals Since Start until
 * the first full week of snapshots exists.
 */
async function getWeekReturnPct(kidId: number, p: Portfolio): Promise<number | null> {
  const db = await getDb();
  const weekStart = startOfWeekEt();
  const [baseline] = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.kidId, kidId), lt(snapshots.snapDate, weekStart)))
    .orderBy(desc(snapshots.snapDate))
    .limit(1);

  if (baseline) {
    if (baseline.value <= 0) return null;
    const txs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.kidId, kidId));
    const depositsThisWeek = txs
      .filter((t) => t.type === "deposit" && t.tradeDate >= weekStart)
      .reduce((s, t) => s + t.amount, 0);
    return ((p.totalValue - depositsThisWeek) / baseline.value - 1) * 100;
  }
  // Week one: This Week == Since Start.
  return p.contributions > 0 ? p.totalReturnPct : null;
}

export async function getStats(kidId: number, portfolio?: Portfolio): Promise<PortfolioStats> {
  const p = portfolio ?? (await getPortfolio(kidId));

  // Since Start never needs snapshot history: it's live value vs. what was
  // put in (starting budget + deposits), available from the first buy.
  const hasStarted = p.invested > 0 || p.positions.length > 0;
  const sinceStartReturnPct = hasStarted ? p.totalReturnPct : null;
  const weekReturnPct = hasStarted ? await getWeekReturnPct(kidId, p) : null;

  // Risk and Sharpe genuinely need a series of day-over-day returns between
  // snapshots, so they stay null (the UI shows a "warming up" hint) until
  // there are at least two daily return observations (~3 market days).
  const { returns: rets } = await getDailyReturns(kidId);
  if (rets.length < 2) {
    return {
      volatilityAnnualPct: null,
      sharpe: null,
      riskLabel: null,
      weekReturnPct,
      sinceStartReturnPct,
    };
  }

  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance =
    rets.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(rets.length - 1, 1);
  const dailyVol = Math.sqrt(variance);
  const annualVol = dailyVol * Math.sqrt(252);
  const annualRet = mean * 252;
  const sharpe = annualVol > 0 ? (annualRet - RISK_FREE_RATE) / annualVol : null;

  const riskLabel: PortfolioStats["riskLabel"] =
    annualVol < 0.15 ? "Low" : annualVol < 0.28 ? "Medium" : "High";

  return {
    volatilityAnnualPct: annualVol * 100,
    sharpe,
    riskLabel,
    weekReturnPct,
    sinceStartReturnPct,
  };
}

// ── Attribution (who moved my portfolio today / this week) ───────

export type Attribution = { ticker: string; name: string; contributionPct: number; ownMovePct: number };

/** Per-position contribution to today's portfolio move, in % of yesterday's total. */
export function dayAttribution(p: Portfolio): Attribution[] {
  const prevTotal = p.totalValue - p.dayChange;
  if (prevTotal <= 0) return [];
  return p.positions
    .map((pos) => ({
      ticker: pos.ticker,
      name: pos.name,
      contributionPct: (pos.dayChange / prevTotal) * 100,
      ownMovePct: pos.dayChangePct,
    }))
    .sort((a, b) => b.contributionPct - a.contributionPct);
}

// ── Sector concentration ──────────────────────────────────────────

export function sectorBreakdown(p: Portfolio): { sector: string; value: number; pct: number }[] {
  const bySector = new Map<string, number>();
  for (const pos of p.positions) {
    bySector.set(pos.sector, (bySector.get(pos.sector) ?? 0) + pos.value);
  }
  if (p.cash > 0.01) bySector.set("Cash", p.cash);
  const total = p.totalValue;
  return [...bySector.entries()]
    .map(([sector, value]) => ({ sector, value, pct: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}
