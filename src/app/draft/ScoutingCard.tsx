"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { VALUATION_STYLE } from "@/lib/valuationStyle";

export type StockCard = {
  ticker: string;
  name: string;
  sector: string;
  category: string;
  logoUrl: string | null;
  productsBlurb: string;
  howMoneyBlurb: string;
  bullBlurb: string;
  bearBlurb: string;
  teachingConcept: string;
  valuationLabel: string | null;
};

type Quote = { ticker: string; price: number; changePct: number };

const SECTOR_FOILS: Record<string, [string, string]> = {
  Technology: ["#22d3ee", "#a78bfa"],
  "Communication Services": ["#a78bfa", "#f472b6"],
  "Consumer Cyclical": ["#fbbf24", "#fb7185"],
  "Consumer Defensive": ["#a3e635", "#34d399"],
  Healthcare: ["#34d399", "#22d3ee"],
  "Financial Services": ["#fbbf24", "#a3e635"],
  Industrials: ["#60a5fa", "#94a3b8"],
};

export default function ScoutingCard({
  stock,
  quote,
  drafted,
  disabled,
  onPick,
}: {
  stock: StockCard;
  quote: Quote | null;
  drafted: boolean;
  disabled: boolean;
  onPick?: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [scout, setScout] = useState<string | null>(null);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [foilA, foilB] = SECTOR_FOILS[stock.sector] ?? ["#22d3ee", "#a78bfa"];
  const vs = stock.valuationLabel
    ? VALUATION_STYLE[stock.valuationLabel as keyof typeof VALUATION_STYLE]
    : null;

  const loadScout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scout || scoutLoading) return;
    setScoutLoading(true);
    try {
      const res = await fetch("/api/coach/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "scout", ticker: stock.ticker }),
      });
      const data = await res.json();
      if (res.ok) setScout(data.content);
    } finally {
      setScoutLoading(false);
    }
  };

  return (
    <div
      className={`flip-scene relative min-h-[236px] cursor-pointer select-none ${flipped ? "flipped" : ""} ${
        drafted ? "pointer-events-none opacity-30 saturate-0" : ""
      }`}
      onClick={() => setFlipped((f) => !f)}
      style={{ "--foil-a": foilA, "--foil-b": foilB } as React.CSSProperties}
    >
      <div className="flip-inner h-full min-h-[236px]">
        {/* FRONT */}
        <div className="flip-face foil absolute inset-0 flex flex-col rounded-2xl p-3.5">
          <div className="flex items-start gap-2">
            {stock.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stock.logoUrl} alt="" className="h-10 w-10 rounded-lg bg-white/90 object-contain p-0.5" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel2 text-xs font-bold">
                {stock.ticker.slice(0, 3)}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold leading-tight">{stock.name}</div>
              <div className="text-[11px] text-ink-dim">{stock.ticker}</div>
            </div>
            {vs && (
              <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold ${vs.className}`}>
                {vs.emoji} {vs.text}
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-3 text-xs leading-snug text-ink-dim">{stock.productsBlurb}</p>
          <div className="mt-auto">
            {quote && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold tabular">${quote.price.toFixed(2)}</span>
                <span className={`text-xs font-bold tabular ${quote.changePct >= 0 ? "text-up" : "text-down"}`}>
                  {quote.changePct >= 0 ? "▲" : "▼"} {Math.abs(quote.changePct).toFixed(2)}%
                </span>
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between">
              <span className="rounded-full bg-panel2 px-2 py-0.5 text-[9px] font-bold text-ink-dim">
                💡 {stock.teachingConcept}
              </span>
              <span className="text-[10px] text-neon">flip to scout ↻</span>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="flip-face flip-back foil flex flex-col rounded-2xl p-3.5 text-[11px] leading-snug">
          <div className="space-y-1.5 overflow-y-auto">
            <div>
              <span className="font-extrabold text-neon">💵 Makes money:</span>{" "}
              <span className="text-ink-dim">{stock.howMoneyBlurb}</span>
            </div>
            <div>
              <span className="font-extrabold text-up">📈 Investors like:</span>{" "}
              <span className="text-ink-dim">{stock.bullBlurb}</span>
            </div>
            <div>
              <span className="font-extrabold text-down">⚠️ Could go wrong:</span>{" "}
              <span className="text-ink-dim">{stock.bearBlurb}</span>
            </div>
            <AnimatePresence>
              {scout && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-lg bg-night/60 p-2 italic text-ink"
                >
                  🧢 {scout}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-auto flex gap-1.5 pt-2">
            <button
              onClick={loadScout}
              disabled={scoutLoading}
              className="flex-1 rounded-lg bg-panel2 py-1.5 text-[10px] font-extrabold text-ink hover:bg-edge disabled:opacity-50"
            >
              {scoutLoading ? "Scouting…" : scout ? "Scouted ✓" : "🔍 Scout report"}
            </button>
            {onPick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPick();
                }}
                disabled={disabled}
                className="flex-1 rounded-lg bg-neon py-1.5 text-[10px] font-extrabold text-night hover:brightness-110 disabled:opacity-50"
              >
                🎯 DRAFT
              </button>
            )}
          </div>
        </div>
      </div>

      {drafted && (
        <span className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="rotate-[-12deg] rounded-lg border-2 border-down px-3 py-1 text-sm font-extrabold uppercase text-down">
            Drafted
          </span>
        </span>
      )}
    </div>
  );
}
