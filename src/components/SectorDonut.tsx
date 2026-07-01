"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PALETTE = ["#22d3ee", "#a78bfa", "#f472b6", "#a3e635", "#fbbf24", "#60a5fa", "#34d399", "#fb7185", "#94a3b8"];

export default function SectorDonut({
  data,
}: {
  data: { sector: string; value: number; pct: number }[];
}) {
  if (data.length === 0) {
    return <div className="flex h-56 items-center justify-center text-sm text-ink-dim">No holdings yet</div>;
  }
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <ResponsiveContainer width="100%" height={220} className="max-w-[240px]">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="sector"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
            strokeWidth={0}
            animationDuration={900}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#0d1424",
              border: "1px solid #1e2a45",
              borderRadius: 12,
              fontSize: 13,
            }}
            formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.sector} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1">{d.sector}</span>
            <span className="font-bold tabular">{d.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
