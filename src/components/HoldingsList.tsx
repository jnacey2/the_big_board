"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import CoachCommentary from "./coach/CoachCommentary";

export type HoldingRow = {
  ticker: string;
  name: string;
  sector: string;
  logoUrl: string | null;
  shares: number;
  avgCost: number;
  price: number;
  value: number;
  dayChangePct: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
};

type NewsItem = { title: string; url: string; site: string | null; publishedAt: string };
type Thesis = { ticker: string; body: string; score: number | null; feedback: string | null };

export default function HoldingsList({ holdings, kidId }: { holdings: HoldingRow[]; kidId: number }) {
  const [openTicker, setOpenTicker] = useState<string | null>(null);
  const [theses, setTheses] = useState<Map<string, Thesis>>(new Map());

  useEffect(() => {
    fetch(`/api/thesis?kidId=${kidId}`)
      .then((r) => r.json())
      .then((rows: Thesis[]) => setTheses(new Map(rows.map((t) => [t.ticker, t]))))
      .catch(() => {});
  }, [kidId]);

  return (
    <div className="space-y-2">
      {holdings.map((h) => (
        <div key={h.ticker} className="overflow-hidden rounded-2xl border border-edge bg-panel2/50">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            {h.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.logoUrl} alt="" className="h-10 w-10 rounded-xl bg-white/90 object-contain p-1" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel text-xs font-bold">
                {h.ticker.slice(0, 3)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/stock/${h.ticker}`} className="font-extrabold hover:underline">
                {h.name}
              </Link>
              <div className="text-xs text-ink-dim">
                {h.shares.toFixed(4)} shares · avg ${h.avgCost.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-extrabold tabular">${h.value.toFixed(2)}</div>
              <div className={`text-xs font-bold tabular ${h.dayChangePct >= 0 ? "text-up" : "text-down"}`}>
                {h.dayChangePct >= 0 ? "▲" : "▼"} {Math.abs(h.dayChangePct).toFixed(2)}% today
              </div>
            </div>
            <div className="text-right">
              <div className={`font-bold tabular ${h.unrealizedPnl >= 0 ? "text-up" : "text-down"}`}>
                {h.unrealizedPnl >= 0 ? "+" : "−"}${Math.abs(h.unrealizedPnl).toFixed(2)}
              </div>
              <div className={`text-xs tabular ${h.unrealizedPnlPct >= 0 ? "text-up" : "text-down"}`}>
                {h.unrealizedPnlPct >= 0 ? "+" : ""}
                {h.unrealizedPnlPct.toFixed(1)}% overall
              </div>
            </div>
            <button
              onClick={() => setOpenTicker(openTicker === h.ticker ? null : h.ticker)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                openTicker === h.ticker ? "bg-neon text-night" : "bg-panel text-ink-dim hover:text-ink"
              }`}
            >
              🕵️ Detective
            </button>
          </div>

          <AnimatePresence>
            {openTicker === h.ticker && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <DetectivePanel holding={h} kidId={kidId} thesis={theses.get(h.ticker)} onThesis={(t) => setTheses((m) => new Map(m).set(h.ticker, t))} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      {holdings.length === 0 && (
        <p className="py-10 text-center text-ink-dim">No holdings yet — time to draft and buy!</p>
      )}
    </div>
  );
}

function DetectivePanel({
  holding,
  kidId,
  thesis,
  onThesis,
}: {
  holding: HoldingRow;
  kidId: number;
  thesis?: Thesis;
  onThesis: (t: Thesis) => void;
}) {
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    fetch(`/api/news?ticker=${holding.ticker}`)
      .then((r) => r.json())
      .then(setNews)
      .catch(() => setNews([]));
  }, [holding.ticker]);

  return (
    <div className="space-y-4 border-t border-edge/60 px-4 py-4">
      <div>
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-neon">
            {holding.ticker}: Today&apos;s move
          </span>
          <span className={`font-extrabold tabular ${holding.dayChangePct >= 0 ? "text-up" : "text-down"}`}>
            {holding.dayChangePct >= 0 ? "+" : ""}
            {holding.dayChangePct.toFixed(2)}%
          </span>
        </div>
        <CoachCommentary module="detective" ticker={holding.ticker} compact />
      </div>

      <div>
        <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-dim">
          Biggest related stories
        </div>
        {news === null && <div className="skeleton h-16" />}
        {news && news.length === 0 && <p className="text-sm text-ink-dim">No fresh stories found.</p>}
        <ul className="space-y-1.5">
          {news?.map((n, i) => (
            <li key={i}>
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-2 text-sm"
              >
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
        </ul>
      </div>

      <ThesisBox kidId={kidId} ticker={holding.ticker} thesis={thesis} onThesis={onThesis} />
    </div>
  );
}

export function ThesisBox({
  kidId,
  ticker,
  thesis,
  onThesis,
}: {
  kidId: number;
  ticker: string;
  thesis?: Thesis;
  onThesis: (t: Thesis) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(thesis?.body ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => setBody(thesis?.body ?? ""), [thesis?.body]);

  const save = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidId, ticker, body }),
      });
      if (res.ok) {
        onThesis(await res.json());
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gold/25 bg-gold/5 p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-extrabold uppercase tracking-wider text-gold">
          🧠 Why I own it
        </span>
        {thesis?.score != null && (
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">
            {thesis.score.toFixed(1)}/10
          </span>
        )}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="ml-auto text-xs font-bold text-ink-dim hover:text-ink"
          >
            {thesis ? "Edit & re-score" : "Write it → earn Thesis points"}
          </button>
        )}
      </div>
      {!editing && thesis && <p className="mt-1.5 text-sm">{thesis.body}</p>}
      {!editing && thesis?.feedback && (
        <p className="mt-1.5 text-xs italic text-ink-dim">🧢 {thesis.feedback}</p>
      )}
      {editing && (
        <div className="mt-2 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="input resize-none"
            placeholder="How does this company make money? Why do you like it? What could go wrong?"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={busy || !body.trim()}
              className="rounded-full bg-gold px-4 py-1.5 text-xs font-extrabold text-night disabled:opacity-40"
            >
              {busy ? "Coach is grading…" : "Save & get scored"}
            </button>
            <button onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-xs text-ink-dim hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
