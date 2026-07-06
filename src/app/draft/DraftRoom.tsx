"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import ScoutingCard, { type StockCard } from "./ScoutingCard";
import type { ExecutedTeam } from "@/app/api/draft/execute/route";

type Kid = { id: number; kind: string; name: string; teamName: string; mascot: string; color: string };
type Draft = {
  id: number;
  status: string;
  rounds: number;
  pickTimerSecs: number;
  kidOrder: number[];
  currentPick: number;
  executedAt: string | null;
};
type Pick = {
  id: number;
  kidId: number;
  ticker: string;
  round: number;
  pickNumber: number;
  commentary: string | null;
};
type Quote = { ticker: string; price: number; changePct: number };

function turnFor(order: number[], n: number): { kidId: number; round: number } {
  const numKids = order.length;
  const round = Math.floor(n / numKids);
  const idx = n % numKids;
  const kidId = round % 2 === 0 ? order[idx] : order[numKids - 1 - idx];
  return { kidId, round: round + 1 };
}

export default function DraftRoom() {
  const [kids, setKids] = useState<Kid[]>([]);
  const [stocks, setStocks] = useState<StockCard[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [kidsRes, stocksRes, draftRes] = await Promise.all([
      fetch("/api/kids").then((r) => r.json()),
      fetch("/api/stocks").then((r) => r.json()),
      fetch("/api/draft").then((r) => r.json()),
    ]);
    setKids(kidsRes.filter((k: Kid) => k.kind === "kid"));
    setStocks(stocksRes.filter((s: StockCard & { isBenchmark: boolean }) => !s.isBenchmark));
    setDraft(draftRes.draft);
    setPicks(draftRes.picks);
    setLoaded(true);
    fetch(`/api/quotes?tickers=${stocksRes.filter((s: { isBenchmark: boolean }) => !s.isBenchmark).map((s: { ticker: string }) => s.ticker).join(",")}`)
      .then((r) => r.json())
      .then((rows: Quote[]) => setQuotes(new Map(rows.map((q) => [q.ticker, q]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh quotes every 60s while the market is open (single bulk call).
  useEffect(() => {
    if (stocks.length === 0) return;
    const tickers = stocks.map((s) => s.ticker).join(",");
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const market = await fetch("/api/market").then((r) => r.json());
        if (!market.open) return;
        const rows: Quote[] = await fetch(`/api/quotes?tickers=${tickers}`).then((r) => r.json());
        setQuotes(new Map(rows.map((q) => [q.ticker, q])));
      } catch {
        /* offline is fine */
      }
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [stocks]);

  const live = draft?.status === "live";
  const order = useMemo(() => (draft?.kidOrder as number[]) ?? [], [draft]);
  const totalPicks = draft ? draft.rounds * order.length : 0;
  const turn = live && draft ? turnFor(order, draft.currentPick) : null;
  const onClockKid = turn ? kids.find((k) => k.id === turn.kidId) : null;
  const draftedTickers = useMemo(() => new Set(picks.map((p) => p.ticker)), [picks]);

  const makePick = async (ticker: string) => {
    if (!draft || picking) return;
    setPicking(true);
    setError("");
    try {
      const res = await fetch("/api/draft/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, ticker }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Pick failed");
        return;
      }
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.35 } });
      setPicks((p) => [...p, data.pick]);
      setDraft((d) => (d ? { ...d, currentPick: d.currentPick + 1, status: data.done ? "done" : "live" } : d));
      if (data.done) {
        setTimeout(() => {
          confetti({ particleCount: 220, spread: 120, origin: { y: 0.5 } });
        }, 400);
      }
    } finally {
      setPicking(false);
    }
  };

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-24" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-44" />
          ))}
        </div>
      </div>
    );
  }

  if (kids.length === 0) {
    return (
      <div className="panel mx-auto max-w-md p-8 text-center">
        <div className="text-4xl">🏟️</div>
        <p className="mt-3 text-ink-dim">Set up the teams before Draft Day.</p>
        <Link href="/setup" className="mt-4 inline-block rounded-xl bg-neon px-5 py-3 font-bold text-night">
          Go to Setup
        </Link>
      </div>
    );
  }

  if (!draft || (!live && draft.status === "done" && picks.length === 0)) {
    return <DraftSetup kids={kids} onCreated={load} />;
  }

  if (!live) {
    // Draft complete — show results.
    return (
      <div className="animate-fade-up space-y-6">
        <div className="text-center">
          <div className="text-5xl">🎉</div>
          <h1 className="display mt-2 text-3xl font-extrabold">Draft Complete!</h1>
          <p className="mt-1 text-ink-dim">
            One tap splits each team&apos;s budget equally across their picks — then the competition
            begins.
          </p>
        </div>
        <ExecutePortfolios draft={draft} onExecuted={load} />
        <Rosters kids={kids} picks={picks} stocks={stocks} />
        <CommentaryFeed picks={picks} kids={kids} stocks={stocks} />
        <div className="text-center">
          <DraftSetupButton onCreated={load} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-5">
      {/* On the clock banner */}
      {onClockKid && turn && (
        <OnTheClock
          key={draft.currentPick}
          kid={onClockKid}
          round={turn.round}
          pickNumber={draft.currentPick + 1}
          totalPicks={totalPicks}
          timerSecs={draft.pickTimerSecs}
        />
      )}

      {error && <p className="text-center text-sm font-bold text-down">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-4">
        {/* Board */}
        <div className="lg:col-span-3">
          <Board
            stocks={stocks}
            quotes={quotes}
            draftedTickers={draftedTickers}
            picking={picking}
            onPick={makePick}
          />
        </div>
        {/* Sidebar: rosters + commentary */}
        <div className="space-y-5">
          <Rosters kids={kids} picks={picks} stocks={stocks} compact />
          <CommentaryFeed picks={picks} kids={kids} stocks={stocks} />
          <button
            onClick={async () => {
              if (confirm("End this draft early?")) {
                await fetch("/api/draft", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "abandon" }),
                });
                load();
              }
            }}
            className="w-full rounded-xl bg-panel2 py-2 text-xs text-ink-dim hover:text-ink"
          >
            End draft early
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Buy the portfolios (equal-weight draft execution) ──────────

function ExecutePortfolios({ draft, onExecuted }: { draft: Draft; onExecuted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [teams, setTeams] = useState<ExecutedTeam[] | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setAdmin(Boolean(d.admin)))
      .catch(() => {});
  }, []);

  const undo = async () => {
    if (busy) return;
    if (!confirm("Undo the draft buys? All auto-bought positions (and the robot's mirrors) are removed and you can buy again at fresh prices.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/draft/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Undo failed — try again.");
        return;
      }
      setTeams(null);
      onExecuted();
    } catch {
      setError("Undo failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/draft/execute", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.failedTickers
            ? `Prices aren't available right now (${(data.failedTickers as string[]).join(", ")}), so nothing was bought. Check the FMP API key and try again.`
            : data.error ?? "Something went wrong — nothing was bought."
        );
        return;
      }
      setTeams(data.teams);
      confetti({ particleCount: 250, spread: 130, origin: { y: 0.4 } });
      onExecuted();
    } catch {
      setError("Something went wrong — nothing was bought. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (teams) {
    return (
      <div className="panel mx-auto max-w-2xl space-y-4 p-6">
        <h2 className="display text-center text-2xl font-extrabold">🏁 Portfolios are live!</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((t) => (
            <div key={t.kidId} className="rounded-xl border border-edge bg-panel2/70 p-4" style={{ "--glow": t.color } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{t.mascot}</span>
                <span className="display font-extrabold" style={{ color: t.color }}>
                  {t.teamName}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {t.positions.map((p) => (
                  <li key={p.ticker} className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">{p.ticker}</span>
                    <span className="text-ink-dim tabular">
                      {p.shares.toFixed(4)} sh @ ${p.price.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 border-t border-edge pt-2 text-xs text-ink-dim">
                ${t.cashSpent.toFixed(2)} invested
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link href="/" className="inline-block rounded-xl bg-neon px-6 py-3 font-extrabold text-night hover:brightness-110">
            Watch the race →
          </Link>
        </div>
      </div>
    );
  }

  if (draft.executedAt) {
    return (
      <div className="panel mx-auto max-w-md p-5 text-center">
        <button disabled className="w-full cursor-default rounded-xl bg-panel2 py-4 text-lg font-extrabold text-ink-dim">
          ✅ Portfolios are bought!
        </button>
        <Link href="/" className="mt-3 inline-block text-sm font-bold text-neon underline">
          Watch the race →
        </Link>
        {admin && (
          <div className="mt-3 border-t border-edge pt-3">
            <button
              onClick={undo}
              disabled={busy}
              className="text-xs font-bold text-ink-dim underline hover:text-down disabled:opacity-40"
            >
              {busy ? "Undoing…" : "↩︎ Undo draft buys (parent)"}
            </button>
            {error && <p className="mt-2 text-xs font-bold text-down">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <button
        onClick={run}
        disabled={busy}
        className="w-full rounded-xl bg-neon py-5 text-xl font-extrabold text-night hover:brightness-110 disabled:opacity-40"
      >
        {busy ? "Placing the orders…" : "🏁 Buy the portfolios!"}
      </button>
      <p className="mt-2 text-xs text-ink-dim">
        Each team&apos;s cash gets split equally across their picks at today&apos;s prices — and
        Indexo puts the same dollars into SPY.
      </p>
      {error && <p className="mt-2 text-sm font-bold text-down">{error}</p>}
    </div>
  );
}

// ── On the clock ────────────────────────────────────────────────

function OnTheClock({
  kid,
  round,
  pickNumber,
  totalPicks,
  timerSecs,
}: {
  kid: Kid;
  round: number;
  pickNumber: number;
  totalPicks: number;
  timerSecs: number;
}) {
  const [remaining, setRemaining] = useState(timerSecs);
  useEffect(() => {
    if (timerSecs <= 0) return;
    setRemaining(timerSecs);
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [timerSecs, pickNumber]);

  const pct = timerSecs > 0 ? remaining / timerSecs : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel animate-glow-pulse flex flex-wrap items-center gap-4 p-4 sm:p-5"
      style={{ "--glow": kid.color } as React.CSSProperties}
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-3xl"
        style={{ borderColor: kid.color, backgroundColor: `${kid.color}18` }}
      >
        {kid.mascot}
      </span>
      <div>
        <div className="text-xs font-extrabold uppercase tracking-widest text-gold">⏱ On the clock</div>
        <div className="display text-2xl font-extrabold" style={{ color: kid.color }}>
          {kid.teamName}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="text-right text-sm text-ink-dim">
          <div>
            Pick <span className="font-extrabold text-ink tabular">{pickNumber}</span> of {totalPicks}
          </div>
          <div>Round {round}</div>
        </div>
        {timerSecs > 0 && (
          <div className="relative h-14 w-14">
            <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#1e2a45" strokeWidth="4" />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke={remaining <= 10 ? "#fb7185" : kid.color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${pct * 100.5} 100.5`}
                className="transition-all duration-1000"
              />
            </svg>
            <span
              className={`absolute inset-0 flex items-center justify-center text-sm font-extrabold tabular ${
                remaining <= 10 ? "animate-pulse text-down" : ""
              }`}
            >
              {remaining}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Board ───────────────────────────────────────────────────────

function Board({
  stocks,
  quotes,
  draftedTickers,
  picking,
  onPick,
}: {
  stocks: StockCard[];
  quotes: Map<string, Quote>;
  draftedTickers: Set<string>;
  picking: boolean;
  onPick: (ticker: string) => void;
}) {
  const categories = [...new Set(stocks.map((s) => s.category))];
  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <section key={cat}>
          <h3 className="display mb-2 text-lg font-extrabold text-ink-dim">{cat}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {stocks
              .filter((s) => s.category === cat)
              .map((s) => (
                <ScoutingCard
                  key={s.ticker}
                  stock={s}
                  quote={quotes.get(s.ticker) ?? null}
                  drafted={draftedTickers.has(s.ticker)}
                  disabled={picking}
                  onPick={() => onPick(s.ticker)}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Rosters ─────────────────────────────────────────────────────

function Rosters({
  kids,
  picks,
  stocks,
  compact,
}: {
  kids: Kid[];
  picks: Pick[];
  stocks: StockCard[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "grid gap-4 sm:grid-cols-2"}>
      {kids.map((k) => {
        const roster = picks.filter((p) => p.kidId === k.id);
        return (
          <div key={k.id} className="panel p-4" style={{ "--glow": k.color } as React.CSSProperties}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{k.mascot}</span>
              <span className="display font-extrabold" style={{ color: k.color }}>
                {k.teamName}
              </span>
              <span className="ml-auto text-xs text-ink-dim">{roster.length} picks</span>
            </div>
            <ul className="mt-2 space-y-1">
              <AnimatePresence>
                {roster.map((p) => {
                  const s = stocks.find((x) => x.ticker === p.ticker);
                  return (
                    <motion.li
                      key={p.id}
                      initial={{ opacity: 0, x: 24, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 24 }}
                      className="flex items-center gap-2 rounded-lg bg-panel2/70 px-2.5 py-1.5 text-sm"
                    >
                      <span className="text-xs text-ink-dim tabular">R{p.round}</span>
                      <span className="font-bold">{p.ticker}</span>
                      <span className="truncate text-xs text-ink-dim">{s?.name}</span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {roster.length === 0 && <li className="text-xs text-ink-dim">No picks yet</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ── Commentary feed ─────────────────────────────────────────────

function CommentaryFeed({ picks, kids, stocks }: { picks: Pick[]; kids: Kid[]; stocks: StockCard[] }) {
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [picks.length]);

  const reversed = [...picks].reverse();
  return (
    <div className="panel p-4">
      <h3 className="display flex items-center gap-2 text-lg font-extrabold">
        🎤 Draft Central <span className="h-2 w-2 animate-pulse rounded-full bg-down" />
      </h3>
      <div ref={feedRef} className="mt-2 max-h-80 space-y-2.5 overflow-y-auto">
        {reversed.map((p) => {
          const k = kids.find((x) => x.id === p.kidId);
          const s = stocks.find((x) => x.ticker === p.ticker);
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-edge bg-panel2/70 p-2.5 text-sm"
            >
              <div className="font-bold">
                <span className="text-ink-dim tabular">#{p.pickNumber}</span> {k?.mascot}{" "}
                <span style={{ color: k?.color }}>{k?.teamName}</span> select {s?.name ?? p.ticker}
              </div>
              {p.commentary && <p className="mt-1 text-xs italic leading-relaxed text-ink-dim">🧢 {p.commentary}</p>}
            </motion.div>
          );
        })}
        {picks.length === 0 && (
          <p className="py-4 text-center text-xs text-ink-dim">Commentary appears here after each pick…</p>
        )}
      </div>
    </div>
  );
}

// ── Draft setup ─────────────────────────────────────────────────

function DraftSetupButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-xl bg-panel2 px-5 py-3 font-bold text-ink hover:bg-edge">
        Run another draft
      </button>
    );
  }
  return <DraftSetupInline onCreated={onCreated} />;
}

function DraftSetup({ kids, onCreated }: { kids: Kid[]; onCreated: () => void }) {
  return (
    <div className="mx-auto max-w-xl animate-fade-up">
      <div className="text-center">
        <div className="text-5xl">🎤</div>
        <h1 className="display mt-2 text-3xl font-extrabold sm:text-4xl">Welcome to Draft Day</h1>
        <p className="mx-auto mt-2 max-w-md text-ink-dim">
          {kids.map((k) => k.name).join(" and ")} take turns picking companies, snake-style. Flip the
          cards to scout before you pick!
        </p>
      </div>
      <div className="mt-6">
        <DraftSetupInline onCreated={onCreated} />
      </div>
    </div>
  );
}

function DraftSetupInline({ onCreated }: { onCreated: () => void }) {
  const [kids, setKids] = useState<Kid[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [rounds, setRounds] = useState(8);
  const [timer, setTimer] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/kids")
      .then((r) => r.json())
      .then((rows: Kid[]) => {
        const real = rows.filter((k) => k.kind === "kid");
        setKids(real);
        setOrder(real.map((k) => k.id));
      });
  }, []);

  const shuffle = () => {
    setOrder((o) => {
      const a = [...o];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
  };

  const start = async () => {
    setBusy(true);
    try {
      await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", rounds, pickTimerSecs: timer, kidOrder: order }),
      });
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel space-y-4 p-6 text-left">
      <div>
        <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-dim">
          First-pick order{" "}
          <button onClick={shuffle} className="ml-2 rounded-full bg-panel2 px-2 py-0.5 text-[10px] text-ink hover:bg-edge">
            🎲 shuffle
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.map((id, i) => {
            const k = kids.find((x) => x.id === id);
            return (
              <span key={id} className="flex items-center gap-1.5 rounded-full border border-edge bg-panel2 px-3 py-1.5 text-sm font-bold">
                <span className="text-ink-dim tabular">{i + 1}.</span> {k?.mascot} {k?.name}
              </span>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-ink-dim">Snake draft: the order reverses every round, so going second isn&apos;t unfair.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-ink-dim">Picks per kid</span>
          <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="input">
            {[3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n} rounds
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-ink-dim">Pick timer</span>
          <select value={timer} onChange={(e) => setTimer(Number(e.target.value))} className="input">
            <option value={0}>No timer</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
            <option value={90}>90 seconds</option>
            <option value={120}>2 minutes</option>
          </select>
        </label>
      </div>
      <button
        onClick={start}
        disabled={busy || kids.length === 0}
        className="w-full rounded-xl bg-neon py-4 text-lg font-extrabold text-night hover:brightness-110 disabled:opacity-40"
      >
        {busy ? "Setting the stage…" : "Start the draft! 🏟️"}
      </button>
    </div>
  );
}
