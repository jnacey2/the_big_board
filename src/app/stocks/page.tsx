import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, stocks } from "@/db";
import { ensureProfiles, getQuotes } from "@/lib/fmp";
import { VALUATION_STYLE } from "@/lib/valuation";

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

  const categories = [...new Set(rows.map((r) => r.category))];

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="display text-3xl font-extrabold">The Stock Universe 🌌</h1>
        <p className="mt-1 text-ink-dim">
          {rows.length} companies kids actually know. Tap any card to go deep.
        </p>
      </div>

      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="display mb-3 text-xl font-extrabold">{cat}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows
              .filter((r) => r.category === cat)
              .map((s) => {
                const q = quotes.get(s.ticker);
                const vs = s.valuationLabel
                  ? VALUATION_STYLE[s.valuationLabel as keyof typeof VALUATION_STYLE]
                  : null;
                return (
                  <Link
                    key={s.ticker}
                    href={`/stock/${s.ticker}`}
                    className="panel panel-hover p-4"
                  >
                    <div className="flex items-center gap-2.5">
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt="" className="h-9 w-9 rounded-lg bg-white/90 object-contain p-0.5" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-panel2 text-xs font-bold">
                          {s.ticker.slice(0, 3)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold">{s.name}</div>
                        <div className="text-xs text-ink-dim">{s.ticker}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {q ? (
                        <>
                          <span className="font-bold tabular">${q.price.toFixed(2)}</span>
                          <span className={`text-xs font-bold tabular ${q.changePct >= 0 ? "text-up" : "text-down"}`}>
                            {q.changePct >= 0 ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-ink-dim">price loading…</span>
                      )}
                    </div>
                    {vs && (
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${vs.className}`}>
                        {vs.emoji} {vs.text}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
