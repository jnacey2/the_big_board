"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RaceSeries } from "@/lib/scoreboard";

export default function RaceChart({ series }: { series: RaceSeries[] }) {
  if (series.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-dim">
        The race starts after the first trades are logged. 🏁
      </div>
    );
  }

  // Merge all series into one array keyed by date.
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const data = dates.map((date) => {
    const row: Record<string, number | string> = { date };
    for (const s of series) {
      const pt = s.points.find((p) => p.date === date);
      if (pt) row[`k${s.id}`] = Number((pt.index - 100).toFixed(2));
    }
    return row;
  });

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 42, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.id} id={`grad${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="#1e2a45" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#8fa1bf", fontSize: 11 }}
            tickFormatter={(d: string) => {
              const dt = new Date(`${d}T12:00:00Z`);
              return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "#8fa1bf", fontSize: 11 }}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <ReferenceLine y={0} stroke="#8fa1bf" strokeOpacity={0.4} />
          <Tooltip
            contentStyle={{
              background: "#0d1424",
              border: "1px solid #1e2a45",
              borderRadius: 12,
              fontSize: 13,
            }}
            labelStyle={{ color: "#8fa1bf" }}
            formatter={(value, name) => {
              const s = series.find((x) => `k${x.id}` === name);
              const v = Number(value);
              return [`${v > 0 ? "+" : ""}${v.toFixed(2)}%`, `${s?.mascot ?? ""} ${s?.teamName ?? name}`];
            }}
          />
          {series.map((s) => (
            <Area
              key={s.id}
              type="monotone"
              dataKey={`k${s.id}`}
              stroke={s.color}
              strokeWidth={s.kind === "robot" ? 2 : 3}
              strokeDasharray={s.kind === "robot" ? "6 4" : undefined}
              fill={`url(#grad${s.id})`}
              dot={false}
              isAnimationActive
              animationDuration={1400}
              connectNulls
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {/* Mascots riding the end of each line */}
      <div className="pointer-events-none absolute inset-y-[10px] right-1 flex w-9 flex-col">
        <MascotRiders series={series} />
      </div>
    </div>
  );
}

function MascotRiders({ series }: { series: RaceSeries[] }) {
  const finals = series
    .map((s) => ({ s, v: s.points[s.points.length - 1]?.index ?? 100 }))
    .filter((x) => x.s.points.length > 0);
  if (finals.length === 0) return null;
  const values = finals.map((f) => f.v - 100);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = Math.max(max - min, 0.0001);
  return (
    <div className="relative h-full">
      {finals.map(({ s, v }) => {
        const pct = 1 - (v - 100 - min) / span;
        return (
          <span
            key={s.id}
            className="absolute -translate-y-1/2 text-xl drop-shadow"
            style={{ top: `${8 + pct * 78}%` }}
            title={s.teamName}
          >
            {s.mascot}
          </span>
        );
      })}
    </div>
  );
}
