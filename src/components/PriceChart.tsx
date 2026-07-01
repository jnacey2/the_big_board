"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RANGES = [
  { key: "1M", days: 22 },
  { key: "3M", days: 66 },
  { key: "1Y", days: 252 },
  { key: "All", days: Infinity },
] as const;

export default function PriceChart({ data }: { data: { date: string; close: number }[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("1Y");
  const sliced = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    return r.days === Infinity ? data : data.slice(-r.days);
  }, [data, range]);

  const up = sliced.length > 1 && sliced[sliced.length - 1].close >= sliced[0].close;
  const stroke = up ? "#34d399" : "#fb7185";

  return (
    <div>
      <div className="flex justify-end gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              range === r.key ? "bg-neon text-night" : "bg-panel2 text-ink-dim hover:text-ink"
            }`}
          >
            {r.key}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={sliced} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e2a45" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#8fa1bf", fontSize: 11 }}
            tickFormatter={(d: string) =>
              new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
            axisLine={false}
            tickLine={false}
            minTickGap={50}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#8fa1bf", fontSize: 11 }}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{ background: "#0d1424", border: "1px solid #1e2a45", borderRadius: 12, fontSize: 13 }}
            labelStyle={{ color: "#8fa1bf" }}
            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Close"]}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={stroke}
            strokeWidth={2.5}
            fill="url(#priceGrad)"
            dot={false}
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
