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

export default function HoldingsList({ holdings }: { holdings: HoldingRow[] }) {
  const [openTicker, setOpenTicker] = useState<string | null>(null);

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
                <DetectivePanel holding={h} />
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

function DetectivePanel({ holding }: { holding: HoldingRow }) {
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
    </div>
  );
}
