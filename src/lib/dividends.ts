import { eq } from "drizzle-orm";
import { getDb, kids, pendingDividends, transactions } from "@/db";
import { getDividendHistory } from "./fmp";
import { replayTransactions } from "./portfolio";

/**
 * Scan each kid's holdings against FMP's dividend history and queue any
 * dividends (paid since their first purchase of that stock) that haven't been
 * recorded or queued yet. Parent confirms them in /admin.
 */
export async function detectDividends(): Promise<number> {
  const db = await getDb();
  const allKids = await db.select().from(kids).where(eq(kids.kind, "kid"));
  let queued = 0;

  for (const kid of allKids) {
    const txs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.kidId, kid.id));
    const tickers = [...new Set(txs.filter((t) => t.type !== "dividend").map((t) => t.ticker))];

    for (const ticker of tickers) {
      let history;
      try {
        history = await getDividendHistory(ticker);
      } catch {
        continue; // no dividend data for this ticker
      }
      const tickerTxs = txs.filter((t) => t.ticker === ticker);
      const firstBuy = tickerTxs
        .filter((t) => t.type === "buy")
        .map((t) => t.tradeDate)
        .sort()[0];
      if (!firstBuy) continue;

      const today = new Date().toISOString().slice(0, 10);
      for (const div of history) {
        const payDate = div.paymentDate || div.date;
        if (!payDate || payDate < firstBuy || payDate > today) continue;

        // Shares held as of the ex-date determine the payout.
        const txsBefore = txs.filter(
          (t) => t.ticker === ticker && t.tradeDate <= div.date
        );
        const { shares } = replayTransactions(txsBefore, 0);
        const held = shares.get(ticker) ?? 0;
        if (held <= 1e-9) continue;

        // Skip if already recorded as a transaction.
        const already = txs.some(
          (t) => t.type === "dividend" && t.ticker === ticker && t.tradeDate === payDate
        );
        if (already) continue;

        const total = held * div.dividend;
        await db
          .insert(pendingDividends)
          .values({
            kidId: kid.id,
            ticker,
            payDate,
            amountPerShare: div.dividend,
            shares: held,
            total,
          })
          .onConflictDoNothing();
        queued++;
      }
    }
  }
  return queued;
}
