import { eq } from "drizzle-orm";
import { getDb, kids, transactions } from "@/db";
import { ensurePriceHistory, getPriceHistory, getQuotes } from "./fmp";
import { etDateStr, isMarketOpen } from "./market";

type TxRow = typeof transactions.$inferSelect;

/**
 * Note written on the robot benchmark's one-time funding + SPY buy, so undo
 * and the admin rebuild can find exactly these rows.
 */
export const ROBOT_BENCHMARK_NOTE = "Indexo benchmark: one-time all-in SPY";

/** Close price of `ticker` on `date` (or the last close before it); live quote for today. */
export async function priceOn(ticker: string, date: string): Promise<number | null> {
  if (date === etDateStr() && isMarketOpen()) {
    const q = (await getQuotes([ticker])).get(ticker);
    if (q) return q.price;
  }
  await ensurePriceHistory(ticker, date);
  const hist = await getPriceHistory(ticker, "1970-01-01");
  const onOrBefore = hist.filter((h) => h.date <= date);
  if (onOrBefore.length > 0) return onOrBefore[onOrBefore.length - 1].close;
  // date precedes history (e.g. today, market not yet in daily data): use quote
  const q = (await getQuotes([ticker])).get(ticker);
  return q?.price ?? null;
}

/**
 * How much the robot benchmark starts with. The point of Indexo is to be
 * directly comparable to one kid, so this equals a single kid's starting
 * budget — if the kids have different budgets, their average (there's no
 * single "right" number then, and the average keeps him mid-pack fair).
 * A startingBudget set on the robot's own row overrides everything.
 */
export async function robotBenchmarkAmount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select().from(kids);
  const robot = rows.find((k) => k.kind === "robot");
  if (robot && robot.startingBudget > 0) return robot.startingBudget;
  const budgets = rows.filter((k) => k.kind === "kid").map((k) => k.startingBudget);
  if (budgets.length === 0) return 5000;
  return budgets.reduce((s, b) => s + b, 0) / budgets.length;
}

/**
 * Fund the robot benchmark: a single deposit of `amount` plus an all-in SPY
 * buy on `date`. This is Indexo's ONLY activity — he does not mirror
 * individual kid trades (kids trading within their budget is rebalancing;
 * the benchmark just stays fully invested from day one).
 *
 * No-ops if the robot already holds his benchmark rows (idempotent) or if
 * there is no robot. Caller owns snapshot refresh.
 */
export async function fundRobotBenchmark(
  amount: number,
  spyPrice: number,
  date: string
): Promise<boolean> {
  const db = await getDb();
  const [robot] = await db.select().from(kids).where(eq(kids.kind, "robot"));
  if (!robot || !(amount > 0) || !(spyPrice > 0)) return false;

  const existing = await db
    .select()
    .from(transactions)
    .where(eq(transactions.kidId, robot.id));
  if (existing.some((t) => t.note === ROBOT_BENCHMARK_NOTE)) return false;

  await db.insert(transactions).values({
    kidId: robot.id,
    ticker: "SPY",
    type: "deposit",
    shares: 0,
    price: 0,
    amount,
    tradeDate: date,
    note: ROBOT_BENCHMARK_NOTE,
  });
  await db.insert(transactions).values({
    kidId: robot.id,
    ticker: "SPY",
    type: "buy",
    shares: amount / spyPrice,
    price: spyPrice,
    amount,
    tradeDate: date,
    note: ROBOT_BENCHMARK_NOTE,
  });
  return true;
}

/**
 * Insert a buy transaction for a kid.
 * Does NOT check cash guardrails or refresh snapshots — callers own that.
 */
export async function executeBuy(
  kidId: number,
  ticker: string,
  shares: number,
  price: number,
  date: string,
  opts: { note?: string | null } = {}
): Promise<TxRow> {
  const db = await getDb();
  const [tx] = await db
    .insert(transactions)
    .values({
      kidId,
      ticker,
      type: "buy",
      shares,
      price,
      amount: shares * price,
      tradeDate: date,
      note: opts.note ?? null,
    })
    .returning();
  return tx;
}

/**
 * Insert a sell transaction for a kid.
 * Does NOT check share guardrails or refresh snapshots — callers own that.
 */
export async function executeSell(
  kidId: number,
  ticker: string,
  shares: number,
  price: number,
  date: string,
  opts: { note?: string | null } = {}
): Promise<TxRow> {
  const db = await getDb();
  const [tx] = await db
    .insert(transactions)
    .values({
      kidId,
      ticker,
      type: "sell",
      shares,
      price,
      amount: shares * price,
      tradeDate: date,
      note: opts.note ?? null,
    })
    .returning();
  return tx;
}
