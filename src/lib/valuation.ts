import { eq } from "drizzle-orm";
import { getDb, stocks, fundamentals } from "@/db";
import { ensureFundamentals } from "./fmp";
import type { ValuationLabel } from "./valuationStyle";

export { VALUATION_STYLE, type ValuationLabel } from "./valuationStyle";

/**
 * Label a stock cheap/fair/expensive/tricky from its EV/EBITDA versus its own
 * ~10-year history. "Tricky" = unprofitable or not enough data to judge.
 */
export async function computeValuationLabel(ticker: string): Promise<ValuationLabel> {
  const db = await getDb();
  try {
    await ensureFundamentals(ticker);
  } catch {
    /* fall through to whatever data exists */
  }
  const rows = await db
    .select()
    .from(fundamentals)
    .where(eq(fundamentals.ticker, ticker))
    .orderBy(fundamentals.fiscalYear);

  const multiples = rows
    .filter((r) => r.fiscalYear > 0 && r.enterpriseValue && r.ebitda && r.ebitda > 0)
    .map((r) => r.enterpriseValue! / r.ebitda!);

  const latest = rows.filter((r) => r.fiscalYear > 0).slice(-1)[0];
  const latestOk = latest?.ebitda != null && latest.ebitda > 0 && latest.enterpriseValue != null;

  let label: ValuationLabel;
  if (!latestOk || multiples.length < 4) {
    label = "tricky";
  } else {
    const current = latest.enterpriseValue! / latest.ebitda!;
    const sorted = [...multiples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (current > 40) label = "tricky"; // hyper-growth pricing: history won't help
    else if (current < median * 0.85) label = "cheap";
    else if (current > median * 1.25) label = "expensive";
    else label = "fair";
  }

  await db.update(stocks).set({ valuationLabel: label }).where(eq(stocks.ticker, ticker));
  return label;
}
