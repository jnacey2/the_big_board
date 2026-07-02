import { eq } from "drizzle-orm";
import { getDb, kids, transactions } from "@/db";
import { ensurePriceHistory, getPriceHistory, getQuotes } from "./fmp";
import { etDateStr, isMarketOpen } from "./market";
import { replayTransactions } from "./portfolio";

type TxRow = typeof transactions.$inferSelect;

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
 * Insert a buy transaction for a kid and mirror the same dollars into SPY for
 * the robot rival (a funding deposit plus a SPY buy on the same date).
 *
 * Does NOT check cash guardrails or refresh snapshots — callers own that.
 * Pass `spyPrice` when the caller already looked it up (e.g. batch draft
 * execution); otherwise it is resolved here, and the mirror is skipped
 * (best-effort) if SPY has no price.
 */
export async function executeBuy(
  kidId: number,
  ticker: string,
  shares: number,
  price: number,
  date: string,
  opts: { note?: string | null; spyPrice?: number | null } = {}
): Promise<TxRow> {
  const db = await getDb();
  const amount = shares * price;

  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  if (!kid) throw new Error(`Kid ${kidId} not found`);

  const [tx] = await db
    .insert(transactions)
    .values({
      kidId,
      ticker,
      type: "buy",
      shares,
      price,
      amount,
      tradeDate: date,
      note: opts.note ?? null,
    })
    .returning();

  // ── Robot rival mirror: same dollars into SPY on the same date ──
  const [robot] = await db.select().from(kids).where(eq(kids.kind, "robot"));
  if (robot) {
    const spyPrice =
      opts.spyPrice ??
      (await priceOn("SPY", date).catch((e) => {
        console.error("SPY price lookup failed (robot mirror skipped):", e);
        return null;
      }));
    if (spyPrice && spyPrice > 0) {
      // Fund the robot with the same dollars, then buy SPY.
      await db.insert(transactions).values({
        kidId: robot.id,
        ticker: "SPY",
        type: "deposit",
        shares: 0,
        price: 0,
        amount,
        tradeDate: date,
        note: `mirrors ${kid.teamName} ${ticker} buy`,
        mirrorsTransactionId: tx.id,
      });
      await db.insert(transactions).values({
        kidId: robot.id,
        ticker: "SPY",
        type: "buy",
        shares: amount / spyPrice,
        price: spyPrice,
        amount,
        tradeDate: date,
        note: `mirrors ${kid.teamName} ${ticker} buy`,
        mirrorsTransactionId: tx.id,
      });
    }
  }

  return tx;
}

/**
 * Insert a sell transaction for a kid and mirror it by selling the same dollar
 * amount of SPY from the robot rival (capped at what the robot holds).
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
  const amount = shares * price;

  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  if (!kid) throw new Error(`Kid ${kidId} not found`);

  const [tx] = await db
    .insert(transactions)
    .values({
      kidId,
      ticker,
      type: "sell",
      shares,
      price,
      amount,
      tradeDate: date,
      note: opts.note ?? null,
    })
    .returning();

  const [robot] = await db.select().from(kids).where(eq(kids.kind, "robot"));
  if (robot) {
    const spyPrice = await priceOn("SPY", date).catch((e) => {
      console.error("SPY price lookup failed (robot mirror skipped):", e);
      return null;
    });
    if (spyPrice && spyPrice > 0) {
      const robotTxs = await db
        .select()
        .from(transactions)
        .where(eq(transactions.kidId, robot.id));
      const robotState = replayTransactions(robotTxs, 0);
      const heldSpy = robotState.shares.get("SPY") ?? 0;
      const sellShares = Math.min(amount / spyPrice, heldSpy);
      if (sellShares > 1e-9) {
        await db.insert(transactions).values({
          kidId: robot.id,
          ticker: "SPY",
          type: "sell",
          shares: sellShares,
          price: spyPrice,
          amount: sellShares * spyPrice,
          tradeDate: date,
          note: `mirrors ${kid.teamName} ${ticker} sell`,
          mirrorsTransactionId: tx.id,
        });
      }
    }
  }

  return tx;
}
