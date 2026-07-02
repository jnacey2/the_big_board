import { asc, eq } from "drizzle-orm";
import { getDb, kids, stocks, transactions } from "@/db";
import { ensureProfiles, getQuotes } from "@/lib/fmp";
import { replayTransactions } from "@/lib/portfolio";
import type { ValuationLabel } from "@/lib/valuationStyle";
import StocksBrowser, { type StockItem } from "./StocksBrowser";

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(stocks)
    .where(eq(stocks.isBenchmark, false))
    .orderBy(asc(stocks.category), asc(stocks.name));

  await ensureProfiles(rows.map((r) => r.ticker)).catch(() => {});
  const quotes = await getQuotes(rows.map((r) => r.ticker)).catch(() => new Map());

  // Which kids currently hold each stock (for the "in a portfolio" badge).
  const heldBy = new Map<string, { name: string; mascot: string }[]>();
  try {
    const kidRows = await db.select().from(kids).where(eq(kids.kind, "kid"));
    const txs = await db.select().from(transactions);
    for (const kid of kidRows) {
      const { shares } = replayTransactions(
        txs.filter((t) => t.kidId === kid.id),
        kid.startingBudget
      );
      for (const [ticker, n] of shares) {
        if (n > 1e-9) {
          const list = heldBy.get(ticker) ?? [];
          list.push({ name: kid.name, mascot: kid.mascot });
          heldBy.set(ticker, list);
        }
      }
    }
  } catch {
    /* badge is optional — never block the page on it */
  }

  const items: StockItem[] = rows.map((s) => {
    const q = quotes.get(s.ticker);
    return {
      ticker: s.ticker,
      name: s.name,
      category: s.category,
      logoUrl: s.logoUrl,
      price: q?.price ?? null,
      changePct: q?.changePct ?? null,
      valuationLabel: (s.valuationLabel as ValuationLabel | null) ?? null,
      heldBy: heldBy.get(s.ticker) ?? [],
    };
  });

  const categories = [...new Set(rows.map((r) => r.category))];

  return (
    <div className="animate-fade-up space-y-4">
      <div>
        <h1 className="display text-3xl font-extrabold">The Stock Universe 🌌</h1>
        <p className="mt-1 text-ink-dim">
          {rows.length} companies kids actually know. Pick a category or search, then tap
          any company to go deep.
        </p>
      </div>
      <StocksBrowser items={items} categories={categories} />
    </div>
  );
}
