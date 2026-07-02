"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { VALUATION_STYLE, type ValuationLabel } from "@/lib/valuationStyle";

export type StockItem = {
  ticker: string;
  name: string;
  category: string;
  logoUrl: string | null;
  price: number | null;
  changePct: number | null;
  valuationLabel: ValuationLabel | null;
  /** Mascots of kids currently holding this stock. */
  heldBy: { name: string; mascot: string }[];
};

const CATEGORY_EMOJI: Record<string, string> = {
  "Games & Toys": "🎮",
  "Food & Treats": "🍩",
  "Tech They Use": "📱",
  "Rides & Travel": "✈️",
  "Sports & Style": "👟",
  Entertainment: "🎬",
  Stores: "🛒",
  "Animals & Health": "🐾",
  "Grown-Up Picks": "💼",
};

export default function StocksBrowser({
  items,
  categories,
}: {
  items: StockItem[];
  categories: string[];
}) {
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return items.filter(
        (s) => s.name.toLowerCase().includes(q) || s.ticker.toLowerCase().includes(q)
      );
    }
    if (category === "All") return items;
    return items.filter((s) => s.category === category);
  }, [items, category, query]);

  const searching = query.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Sticky search + category bar (offset clears the sticky site header) */}
      <div className="sticky top-[102px] z-30 -mx-4 space-y-2.5 bg-night/95 px-4 py-3 backdrop-blur-md sm:top-[57px] sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
              🔍
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a company or ticker…"
              className="input pl-9"
              aria-label="Search companies"
            />
          </div>
          <span className="shrink-0 text-xs font-bold text-ink-dim tabular">
            {filtered.length} {filtered.length === 1 ? "company" : "companies"}
          </span>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CategoryChip
            label="All"
            emoji="🌌"
            active={!searching && category === "All"}
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              emoji={CATEGORY_EMOJI[cat] ?? "⭐"}
              active={!searching && category === cat}
              onClick={() => {
                setQuery("");
                setCategory(cat);
              }}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel px-6 py-12 text-center">
          <div className="text-3xl">🕵️</div>
          <p className="mt-2 font-bold">No companies match “{query.trim()}”</p>
          <p className="mt-1 text-sm text-ink-dim">Try a different name or ticker.</p>
        </div>
      ) : (
        <motion.div
          key={searching ? `q:${query.trim().toLowerCase()}` : `c:${category}`}
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.02 } } }}
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((s) => (
            <StockRow key={s.ticker} stock={s} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  emoji,
  active,
  onClick,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "border-neon/60 bg-neon/15 text-neon"
          : "border-edge bg-panel text-ink-dim hover:bg-panel2 hover:text-ink"
      }`}
    >
      {emoji} {label}
    </button>
  );
}

function StockRow({ stock: s }: { stock: StockItem }) {
  const vs = s.valuationLabel ? VALUATION_STYLE[s.valuationLabel] : null;
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
      }}
    >
      <Link
        href={`/stock/${s.ticker}`}
        className="panel panel-hover flex items-center gap-3 px-3.5 py-2.5"
      >
        {s.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg bg-white/90 object-contain p-0.5"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel2 text-xs font-bold">
            {s.ticker.slice(0, 3)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-extrabold">{s.name}</span>
            {s.heldBy.length > 0 && (
              <span
                className="shrink-0 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] leading-none"
                title={`In a portfolio: ${s.heldBy.map((k) => k.name).join(", ")}`}
              >
                {s.heldBy.map((k) => k.mascot).join("")}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-dim">
            <span className="font-bold">{s.ticker}</span>
            {vs && (
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-bold ${vs.className}`}
              >
                {vs.emoji} {vs.text}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {s.price != null ? (
            <>
              <div className="text-sm font-bold tabular">${s.price.toFixed(2)}</div>
              {s.changePct != null && (
                <div
                  className={`text-xs font-bold tabular ${
                    s.changePct >= 0 ? "text-up" : "text-down"
                  }`}
                >
                  {s.changePct >= 0 ? "▲" : "▼"} {Math.abs(s.changePct).toFixed(2)}%
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-ink-dim">price soon</div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
