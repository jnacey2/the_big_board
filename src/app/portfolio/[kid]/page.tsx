import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, kids } from "@/db";
import { getPortfolio, getStats, sectorBreakdown } from "@/lib/portfolio";
import { getBadges } from "@/lib/badges";
import CoachCommentary from "@/components/coach/CoachCommentary";
import HoldingsList, { type HoldingRow } from "@/components/HoldingsList";
import SectorDonut from "@/components/SectorDonut";
import NumberTicker from "@/components/NumberTicker";
import Term from "@/components/Glossary";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({ params }: { params: Promise<{ kid: string }> }) {
  const { kid: kidParam } = await params;
  const kidId = Number(kidParam);
  if (!kidId) notFound();

  const db = await getDb();
  const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
  if (!kid) notFound();

  const [portfolio, stats, badgeRows] = await Promise.all([
    getPortfolio(kidId),
    getStats(kidId),
    getBadges(kidId),
  ]);
  const sectors = sectorBreakdown(portfolio);
  const hasHoldings = portfolio.positions.length > 0;

  const holdings: HoldingRow[] = portfolio.positions.map((p) => ({
    ticker: p.ticker,
    name: p.name,
    sector: p.sector,
    logoUrl: p.logoUrl,
    shares: p.shares,
    avgCost: p.avgCost,
    price: p.price,
    value: p.value,
    dayChange: p.dayChange,
    dayChangePct: p.dayChangePct,
    unrealizedPnl: p.unrealizedPnl,
    unrealizedPnlPct: p.unrealizedPnlPct,
  }));

  return (
    <div className="animate-fade-up space-y-6" style={{ "--glow": kid.color } as React.CSSProperties}>
      <AutoRefresh />
      {/* Team header */}
      <div className="flex flex-wrap items-center gap-4">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-4xl"
          style={{ borderColor: kid.color, backgroundColor: `${kid.color}18` }}
        >
          {kid.mascot}
        </span>
        <div>
          <h1 className="display text-3xl font-extrabold" style={{ color: kid.color }}>
            {kid.teamName}
          </h1>
          <p className="text-sm text-ink-dim">
            {kid.kind === "robot"
              ? portfolio.contributions > 0
                ? `The market robot — started with the same $${Math.round(portfolio.contributions).toLocaleString("en-US")} and put it all in the S&P 500`
                : "The market robot — starts with the same money as each kid, all in the S&P 500"
              : `General manager: ${kid.name}`}
          </p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs uppercase tracking-wide text-ink-dim">Total value</div>
          <div className="display text-4xl font-extrabold">
            <NumberTicker value={portfolio.totalValue} prefix="$" />
          </div>
        </div>
      </div>

      {/* Why did my portfolio move today */}
      {hasHoldings && (
        <div className="panel p-5">
          <CoachCommentary module="portfolioDay" kidId={kidId} title="Why did my portfolio move today?" />
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Today" value={`${portfolio.dayChangePct >= 0 ? "+" : ""}${portfolio.dayChangePct.toFixed(2)}%`} tone={portfolio.dayChangePct >= 0 ? "up" : "down"} />
        <Stat
          label="Since start"
          value={stats.sinceStartReturnPct != null ? `${stats.sinceStartReturnPct >= 0 ? "+" : ""}${stats.sinceStartReturnPct.toFixed(2)}%` : "—"}
          tone={(stats.sinceStartReturnPct ?? 0) >= 0 ? "up" : "down"}
        />
        <Stat label="Cash to invest" value={`$${portfolio.cash.toFixed(2)}`} />
        <Stat
          label="Sharpe ratio"
          value={stats.sharpe != null ? stats.sharpe.toFixed(2) : "—"}
          term="sharpe ratio"
        />
        <Stat
          label="Volatility"
          value={stats.volatilityAnnualPct != null ? `${stats.volatilityAnnualPct.toFixed(0)}%` : "—"}
          term="volatility"
        />
        <Stat
          label="Risk level"
          value={stats.riskLabel ?? "—"}
          tone={stats.riskLabel === "Low" ? "up" : stats.riskLabel === "High" ? "down" : undefined}
        />
      </div>

      {/* Risk translation + sector donut */}
      {hasHoldings && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="display text-lg font-extrabold">
              🗺️ Where the money lives{" "}
              <span className="ml-1 text-xs font-normal text-ink-dim">
                (<Term word="sector">sectors</Term> &amp; <Term word="diversification">diversification</Term>)
              </span>
            </h2>
            <div className="mt-3">
              <SectorDonut data={sectors} />
            </div>
          </section>
          <section className="panel p-5">
            <CoachCommentary module="risk" kidId={kidId} title="Coach's risk report" />
            {badgeRows.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink-dim">
                  Trophy case
                </div>
                <div className="flex flex-wrap gap-2">
                  {badgeRows.map((b) => (
                    <span
                      key={b.id}
                      title={`${b.name}: ${b.description}`}
                      className="animate-pop rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-sm font-bold text-gold"
                    >
                      {b.emoji} {b.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Holdings */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-xl font-extrabold">📊 Holdings</h2>
          <span className="text-xs text-ink-dim">
            Tap 🕵️ Detective to see why a stock is moving
          </span>
        </div>
        <HoldingsList holdings={holdings} />
      </section>

      {/* Weekly recap */}
      {hasHoldings && (
        <section className="panel p-5">
          <CoachCommentary module="weeklyRecap" kidId={kidId} title="This week's recap" />
        </section>
      )}

      {!hasHoldings && (
        <div className="panel border-dashed p-8 text-center">
          <div className="text-4xl">🎯</div>
          <p className="mt-2 text-ink-dim">
            {kid.name} doesn&apos;t own any stocks yet. Draft a roster, then a parent logs the real buys.
          </p>
          <Link href="/draft" className="mt-4 inline-block rounded-xl bg-neon px-5 py-3 font-bold text-night hover:brightness-110">
            Go to Draft Day 🎤
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  term,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  term?: string;
}) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-ink-dim">
        {term ? <Term word={term}>{label}</Term> : label}
      </div>
      <div
        className={`display mt-0.5 text-xl font-extrabold tabular ${
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
