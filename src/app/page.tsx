import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { badges, getDb, kids as kidsTable } from "@/db";
import { getCompetitors, getRaceData } from "@/lib/scoreboard";
import { checkBadges } from "@/lib/badges";
import RaceChart from "@/components/RaceChart";
import Scoreboard, { type ScoreRow } from "@/components/Scoreboard";
import CoachCommentary from "@/components/coach/CoachCommentary";
import NumberTicker from "@/components/NumberTicker";
import CoachTour from "@/components/CoachTour";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

/** Robot benchmark story, with his real funding amount once the draft ran. */
function robotCaption(contributions: number): string {
  return contributions > 0
    ? `Started with the same $${Math.round(contributions).toLocaleString("en-US")} and put it all in the S&P 500`
    : "Starts with the same money as each kid and puts it all in the S&P 500";
}

export default async function Dashboard() {
  const db = await getDb();
  const kidRows = await db.select().from(kidsTable);
  if (kidRows.filter((k) => k.kind === "kid").length === 0) {
    redirect("/setup");
  }

  const competitors = await getCompetitors();
  const realKids = competitors.filter((c) => c.kind === "kid");
  const robot = competitors.find((c) => c.kind === "robot");

  // Badge sweep (cheap: data is cached), then read recent badges.
  for (const c of realKids) {
    try {
      await checkBadges(c.id, c.portfolio);
    } catch {
      /* non-fatal */
    }
  }
  const recentBadges = await db
    .select()
    .from(badges)
    .orderBy(desc(badges.awardedAt))
    .limit(6);

  const race = await getRaceData(competitors);

  const scoreRows: ScoreRow[] = competitors
    .filter((c) => c.kind === "kid" || c.portfolio.invested > 0)
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      teamName: c.teamName,
      mascot: c.mascot,
      color: c.color,
      dayChangePct: c.portfolio.positions.length > 0 ? c.portfolio.dayChangePct : null,
      weekReturnPct: c.stats.weekReturnPct,
      sinceStartReturnPct: c.stats.sinceStartReturnPct,
      riskLabel: c.stats.riskLabel,
      sharpe: c.stats.sharpe,
      totalValue: c.portfolio.totalValue,
    }));

  // Today's movers across all kid holdings (unique tickers).
  const seen = new Set<string>();
  const movers = realKids
    .flatMap((c) => c.portfolio.positions)
    .filter((p) => {
      if (seen.has(p.ticker)) return false;
      seen.add(p.ticker);
      return true;
    })
    .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))
    .slice(0, 6);

  const anyTrades = realKids.some((c) => c.portfolio.invested > 0);
  const kidNames = kidRows.filter((k) => k.kind === "kid").map((k) => k.name);

  return (
    <div className="animate-fade-up space-y-6">
      <AutoRefresh />
      <CoachTour kidNames={kidNames} />

      {/* Hero cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {realKids.map((c) => (
          <Link
            key={c.id}
            href={`/portfolio/${c.id}`}
            className="panel panel-hover animate-glow-pulse p-5"
            style={{ "--glow": c.color } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 text-2xl"
                style={{ borderColor: c.color, backgroundColor: `${c.color}18` }}
              >
                {c.mascot}
              </span>
              <div>
                <div className="display text-lg font-extrabold leading-tight">{c.teamName}</div>
                <div className="text-xs text-ink-dim">{c.name}</div>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-dim">Portfolio value</div>
                <div className="display text-3xl font-extrabold">
                  <NumberTicker value={c.portfolio.totalValue} prefix="$" />
                </div>
              </div>
              <div className={`text-right ${c.portfolio.dayChangePct >= 0 ? "text-up" : "text-down"}`}>
                <div className="text-xs uppercase tracking-wide opacity-70">Today</div>
                <div className="text-lg font-extrabold tabular">
                  {c.portfolio.dayChangePct >= 0 ? "+" : ""}
                  {c.portfolio.dayChangePct.toFixed(2)}%
                </div>
              </div>
            </div>
          </Link>
        ))}

        {robot && (
          <Link
            href={`/portfolio/${robot.id}`}
            className="panel panel-hover border-dashed p-5 sm:col-span-2 lg:col-span-1"
            style={{ "--glow": robot.color, borderColor: `${robot.color}55` } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed text-2xl"
                style={{ borderColor: robot.color, backgroundColor: `${robot.color}18` }}
              >
                {robot.mascot}
              </span>
              <div>
                <div className="display text-lg font-extrabold leading-tight" style={{ color: robot.color }}>
                  {robot.teamName}
                </div>
                <div className="text-xs font-bold uppercase tracking-wide" style={{ color: `${robot.color}bb` }}>
                  The machine to beat
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-dim">Portfolio value</div>
                <div className="display text-3xl font-extrabold">
                  <NumberTicker value={robot.portfolio.totalValue} prefix="$" />
                </div>
              </div>
              {robot.portfolio.positions.length > 0 && (
                <div className={`text-right ${robot.portfolio.dayChangePct >= 0 ? "text-up" : "text-down"}`}>
                  <div className="text-xs uppercase tracking-wide opacity-70">Today</div>
                  <div className="text-lg font-extrabold tabular">
                    {robot.portfolio.dayChangePct >= 0 ? "+" : ""}
                    {robot.portfolio.dayChangePct.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
            <p className="mt-3 border-t border-dashed pt-2 text-xs text-ink-dim" style={{ borderColor: `${robot.color}33` }}>
              🤖 {robotCaption(robot.portfolio.contributions)}
            </p>
          </Link>
        )}
      </div>

      {/* Race chart */}
      <section className="panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="display text-xl font-extrabold">🏁 The Race</h2>
          <span className="text-xs text-ink-dim">Growth of every dollar, % since start</span>
        </div>
        <div className="mt-2">
          <RaceChart series={race} />
        </div>
      </section>

      {/* Scoreboard */}
      <section>
        <h2 className="display mb-3 text-xl font-extrabold">🏆 Championship Belts</h2>
        <Scoreboard rows={scoreRows} />
      </section>

      {!anyTrades && (
        <div className="panel border-dashed p-8 text-center">
          <div className="text-4xl">🎪</div>
          <h3 className="display mt-2 text-xl font-extrabold">The competition hasn&apos;t started yet!</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-dim">
            First, run the draft to pick your rosters. Then a parent logs the real buys in Parent HQ, and the
            race is on.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/draft" className="rounded-xl bg-neon px-5 py-3 font-bold text-night hover:brightness-110">
              Start Draft Day 🎤
            </Link>
            <Link href="/admin" className="rounded-xl bg-panel2 px-5 py-3 font-bold text-ink hover:bg-edge">
              Parent HQ
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's movers */}
        <section className="panel p-5">
          <h2 className="display text-xl font-extrabold">⚡ Today&apos;s Movers</h2>
          <div className="mt-3 space-y-2">
            {movers.map((m) => (
              <Link
                key={m.ticker}
                href={`/stock/${m.ticker}`}
                className="flex items-center gap-3 rounded-xl border border-edge bg-panel2/60 px-3 py-2.5 transition-colors hover:border-neon/40"
              >
                {m.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.logoUrl} alt="" className="h-8 w-8 rounded-lg bg-white/90 object-contain p-0.5" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel text-xs font-bold">
                    {m.ticker.slice(0, 2)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{m.name}</div>
                  <div className="text-xs text-ink-dim">{m.ticker}</div>
                </div>
                <div className={`text-right font-extrabold tabular ${m.dayChangePct >= 0 ? "text-up" : "text-down"}`}>
                  {m.dayChangePct >= 0 ? "▲" : "▼"} {Math.abs(m.dayChangePct).toFixed(2)}%
                </div>
              </Link>
            ))}
            {movers.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-dim">No holdings yet — movers show up once stocks are owned.</p>
            )}
          </div>
        </section>

        {/* Recent badges */}
        <section className="panel p-5">
          <h2 className="display text-xl font-extrabold">🎖️ Trophy Case</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {recentBadges.map((b) => {
              const owner = competitors.find((c) => c.id === b.kidId);
              return (
                <div key={b.id} className="animate-pop rounded-xl border border-gold/25 bg-gold/5 px-3 py-2.5">
                  <div className="text-2xl">{b.emoji}</div>
                  <div className="mt-1 text-sm font-extrabold">{b.name}</div>
                  <div className="text-xs text-ink-dim">
                    {owner?.mascot} {owner?.name} — {b.description}
                  </div>
                </div>
              );
            })}
            {recentBadges.length === 0 && (
              <p className="col-span-2 py-6 text-center text-sm text-ink-dim">
                No badges yet. First trade earns the Opening Bell! 🔔
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Weekly recaps */}
      {anyTrades && (
        <section className="grid gap-4 lg:grid-cols-2">
          {realKids.map((c) => (
            <div key={c.id} className="panel p-5" style={{ "--glow": c.color } as React.CSSProperties}>
              <CoachCommentary module="weeklyRecap" kidId={c.id} title={`${c.mascot} ${c.teamName} — This Week`} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
