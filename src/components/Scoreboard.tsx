"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export type ScoreRow = {
  id: number;
  kind: string;
  name: string;
  teamName: string;
  mascot: string;
  color: string;
  weekReturnPct: number | null;
  sinceStartReturnPct: number | null;
  riskLabel: string | null;
  sharpe: number | null;
  totalValue: number;
};

const BELTS = [
  { key: "return", label: "🏆 Total Return Champion", sub: "Highest return since the start" },
  { key: "sharpe", label: "🛡️ Best Risk-Adjusted Investor", sub: "Best Sharpe ratio — careful beats lucky" },
] as const;

export default function Scoreboard({ rows }: { rows: ScoreRow[] }) {
  const [belt, setBelt] = useState<(typeof BELTS)[number]["key"]>("return");

  const ranked = [...rows].sort((a, b) => {
    if (belt === "return") return (b.sinceStartReturnPct ?? -1e9) - (a.sinceStartReturnPct ?? -1e9);
    return (b.sharpe ?? -1e9) - (a.sharpe ?? -1e9);
  });

  const active = BELTS.find((b) => b.key === belt)!;

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-edge p-2">
        {BELTS.map((b) => (
          <button
            key={b.key}
            onClick={() => setBelt(b.key)}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
              belt === b.key ? "bg-gold/15 text-gold" : "text-ink-dim hover:bg-panel2 hover:text-ink"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <p className="px-4 pt-3 text-xs text-ink-dim">{active.sub}</p>

      <div className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-dim">
              <th className="px-2 py-2">Rank</th>
              <th className="px-2 py-2">Portfolio</th>
              <th className="px-2 py-2 text-right">This Week</th>
              <th className="px-2 py-2 text-right">Since Start</th>
              <th className="px-2 py-2 text-center">Risk</th>
              <th className="px-2 py-2 text-right">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <motion.tr
                key={`${belt}-${r.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="border-t border-edge/60"
                style={{ "--glow": r.color } as React.CSSProperties}
              >
                <td className="px-2 py-3">
                  <span className={`display text-lg font-extrabold ${i === 0 ? "text-gold" : "text-ink-dim"}`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                  </span>
                </td>
                <td className="px-2 py-3">
                  {r.kind === "robot" ? (
                    <span className="flex items-center gap-2 font-bold text-ink-dim">
                      <span className="text-xl">{r.mascot}</span> {r.teamName}
                    </span>
                  ) : (
                    <Link href={`/portfolio/${r.id}`} className="flex items-center gap-2 font-bold hover:underline">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-lg"
                        style={{ borderColor: r.color, backgroundColor: `${r.color}18` }}
                      >
                        {r.mascot}
                      </span>
                      <span>
                        {r.teamName}
                        <span className="block text-xs font-normal text-ink-dim">{r.name}</span>
                      </span>
                    </Link>
                  )}
                </td>
                <td className={`px-2 py-3 text-right font-bold tabular ${pctColor(r.weekReturnPct)}`}>
                  {fmtPctCell(r.weekReturnPct)}
                </td>
                <td className={`px-2 py-3 text-right font-bold tabular ${pctColor(r.sinceStartReturnPct)}`}>
                  {fmtPctCell(r.sinceStartReturnPct)}
                </td>
                <td className="px-2 py-3 text-center">
                  {r.riskLabel ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        r.riskLabel === "Low"
                          ? "bg-up/15 text-up"
                          : r.riskLabel === "Medium"
                            ? "bg-gold/15 text-gold"
                            : "bg-down/15 text-down"
                      }`}
                    >
                      {r.riskLabel}
                    </span>
                  ) : (
                    <span className="text-ink-dim">—</span>
                  )}
                </td>
                <td className="px-2 py-3 text-right tabular">
                  {r.sharpe != null ? r.sharpe.toFixed(2) : "—"}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pctColor(v: number | null): string {
  if (v == null) return "text-ink-dim";
  return v >= 0 ? "text-up" : "text-down";
}
function fmtPctCell(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
