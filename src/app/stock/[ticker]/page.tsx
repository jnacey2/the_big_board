import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, stocks, stockAnalysis } from "@/db";
import {
  ensureFundamentals,
  ensurePriceHistory,
  ensureProfiles,
  getFundamentals,
  getNews,
  getPriceHistory,
  getQuotes,
} from "@/lib/fmp";
import { computeValuationLabel, VALUATION_STYLE } from "@/lib/valuation";
import PriceChart from "@/components/PriceChart";
import FundamentalsCharts, { type FundRow } from "@/components/FundamentalsCharts";
import DeepDive from "@/components/DeepDive";
import CoachCommentary from "@/components/coach/CoachCommentary";
import Term from "@/components/Glossary";

export const dynamic = "force-dynamic";

function fmtBig(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toUpperCase();
  const db = await getDb();
  const [stock] = await db.select().from(stocks).where(eq(stocks.ticker, ticker));
  if (!stock) notFound();

  await ensureProfiles([ticker]).catch(() => {});
  const yearAgo = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  await ensurePriceHistory(ticker, yearAgo).catch(() => {});
  await ensureFundamentals(ticker).catch(() => {});
  const label = stock.valuationLabel ?? (await computeValuationLabel(ticker).catch(() => null));

  const [quoteMap, history, fundRows, news, analysisRows, refreshed] = await Promise.all([
    getQuotes([ticker]),
    getPriceHistory(ticker, yearAgo),
    getFundamentals(ticker),
    getNews(ticker, 5).catch(() => []),
    db.select().from(stockAnalysis).where(eq(stockAnalysis.ticker, ticker)),
    db.select().from(stocks).where(eq(stocks.ticker, ticker)),
  ]);
  const fresh = refreshed[0] ?? stock;
  const q = quoteMap.get(ticker);
  const analysis = analysisRows[0] ?? null;

  const latest = fundRows.filter((f) => f.fiscalYear > 0).slice(-1)[0];
  const margin =
    latest?.revenue && latest?.ebitda && latest.revenue > 0
      ? (latest.ebitda / latest.revenue) * 100
      : null;
  const evEbitda =
    latest?.enterpriseValue && latest?.ebitda && latest.ebitda > 0
      ? latest.enterpriseValue / latest.ebitda
      : null;

  const vs = label ? VALUATION_STYLE[label as keyof typeof VALUATION_STYLE] : null;

  return (
    <div className="animate-fade-up space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        {fresh.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fresh.logoUrl} alt="" className="h-16 w-16 rounded-2xl bg-white/90 object-contain p-1.5" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-panel2 text-lg font-extrabold">
            {ticker.slice(0, 3)}
          </span>
        )}
        <div>
          <h1 className="display text-3xl font-extrabold">{fresh.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-dim">
            <span className="font-bold text-ink">{ticker}</span>
            <span>· {fresh.sector}</span>
            {vs && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${vs.className}`}>
                {vs.emoji} {vs.text}
              </span>
            )}
            <span className="rounded-full bg-panel2 px-2.5 py-0.5 text-xs font-bold text-ink-dim">
              💡 {fresh.teachingConcept}
            </span>
          </div>
        </div>
        {q && (
          <div className="ml-auto text-right">
            <div className="display text-4xl font-extrabold tabular">${q.price.toFixed(2)}</div>
            <div className={`font-bold tabular ${q.changePct >= 0 ? "text-up" : "text-down"}`}>
              {q.changePct >= 0 ? "▲" : "▼"} {Math.abs(q.change).toFixed(2)} ({Math.abs(q.changePct).toFixed(2)}%) today
            </div>
          </div>
        )}
      </div>

      {/* What do they actually do + detective */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <CoachCommentary module="kidDescription" ticker={ticker} title="What do they actually do?" />
          <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
            <InfoRow emoji="🛍️" label="Stuff you know them for" text={fresh.productsBlurb} />
            <InfoRow emoji="💵" label="How they make money" text={fresh.howMoneyBlurb} />
          </div>
        </section>
        <section className="panel p-5">
          <CoachCommentary module="detective" ticker={ticker} title="🕵️ Why is it moving?" />
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-dim">
              Biggest related stories
            </div>
            <ul className="space-y-1.5">
              {news.map((n, i) => (
                <li key={i}>
                  <a href={n.url} target="_blank" rel="noreferrer" className="group flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-xs">📰</span>
                    <span className="text-ink group-hover:text-neon group-hover:underline">
                      {n.title}
                      <span className="ml-1 text-xs text-ink-dim">
                        {n.site} · {new Date(n.publishedAt).toLocaleDateString()}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
              {news.length === 0 && <li className="text-sm text-ink-dim">No fresh stories found.</li>}
            </ul>
          </div>
        </section>
      </div>

      {/* Price chart */}
      <section className="panel p-5">
        <h2 className="display text-xl font-extrabold">📉 Price history</h2>
        <div className="mt-2">
          <PriceChart data={history} />
        </div>
      </section>

      {/* Company deep dive */}
      <section className="panel p-5">
        <h2 className="display text-xl font-extrabold">🔬 Company Deep Dive</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label={<Term word="market cap">Market cap</Term>} value={fmtBig(latest?.marketCap)} />
          <Fact label={<Term word="enterprise value">Enterprise value</Term>} value={fmtBig(latest?.enterpriseValue)} />
          <Fact label={<Term word="revenue">Revenue</Term>} value={fmtBig(latest?.revenue)} sub={latest ? `FY${latest.fiscalYear}` : undefined} />
          <Fact label={<Term word="ebitda">EBITDA</Term>} value={fmtBig(latest?.ebitda)} sub={latest ? `FY${latest.fiscalYear}` : undefined} />
          <Fact label={<Term word="ebitda margin">EBITDA margin</Term>} value={margin != null ? `${margin.toFixed(1)}%` : "—"} />
          <Fact label={<Term word="ev/ebitda">EV/EBITDA</Term>} value={evEbitda != null ? `${evEbitda.toFixed(1)}x` : "—"} />
        </div>
        <div className="mt-6">
          <FundamentalsCharts rows={fundRows as FundRow[]} />
        </div>
      </section>

      {/* Rationale + risks */}
      <DeepDive
        ticker={ticker}
        initial={
          analysis
            ? {
                rationaleKid: analysis.rationaleKid,
                rationaleGrownup: analysis.rationaleGrownup,
                risks: analysis.risks,
                generatedAt: analysis.generatedAt?.toISOString() ?? null,
              }
            : null
        }
      />
    </div>
  );
}

function InfoRow({ emoji, label, text }: { emoji: string; label: string; text: string }) {
  return (
    <div className="rounded-xl bg-panel2/60 px-3 py-2.5">
      <div className="text-xs font-extrabold uppercase tracking-wider text-ink-dim">
        {emoji} {label}
      </div>
      <p className="mt-0.5">{text}</p>
    </div>
  );
}

function Fact({ label, value, sub }: { label: React.ReactNode; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2/50 px-3 py-2.5">
      <div className="text-xs uppercase tracking-wide text-ink-dim">{label}</div>
      <div className="display mt-0.5 text-lg font-extrabold tabular">{value}</div>
      {sub && <div className="text-[10px] text-ink-dim">{sub}</div>}
    </div>
  );
}
