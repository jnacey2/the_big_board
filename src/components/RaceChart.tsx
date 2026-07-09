"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
} from "recharts";
import type { RaceSeries } from "@/lib/scoreboard";

/** Chart widths below this get abbreviated rider labels ("Team Rocket" → "Rocket"). */
const COMPACT_WIDTH = 520;
const LABEL_FONT_SIZE = 11;
/** Rough advance width of bold 11px text, for reserving right margin. */
const LABEL_CHAR_WIDTH = 6.5;
/** Horizontal gap between the line endpoint (mascot center) and the label text. */
const LABEL_GAP = 15;

function riderLabel(teamName: string, compact: boolean): string {
  if (!compact) return teamName;
  const words = teamName.replace(/^the\s+/i, "").split(/\s+/);
  return words[0] || teamName;
}

type Rider = {
  id: number;
  mascot: string;
  color: string;
  label: string;
  date: string;
  value: number;
};

export default function RaceChart({ series }: { series: RaceSeries[] }) {
  const [chartWidth, setChartWidth] = useState(0);

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

  // Each rider anchors to the LAST point of its own series (series can end on
  // different dates), using the same rounded value the Area plots so the
  // mascot sits exactly on the line end.
  const compact = chartWidth > 0 && chartWidth < COMPACT_WIDTH;
  const riders: Rider[] = series
    .filter((s) => s.points.length > 0)
    .map((s) => {
      const last = s.points[s.points.length - 1];
      return {
        id: s.id,
        mascot: s.mascot,
        color: s.color,
        label: riderLabel(s.teamName, compact),
        date: last.date,
        value: Number((last.index - 100).toFixed(2)),
      };
    });

  // Reserve right margin for the widest "🦈 Name" label so nothing clips.
  const maxLabelChars = Math.max(...riders.map((r) => r.label.length), 0);
  const rightMargin = Math.ceil(LABEL_GAP + maxLabelChars * LABEL_CHAR_WIDTH + 8);

  return (
    <ResponsiveContainer width="100%" height={300} onResize={(w) => setChartWidth(w)}>
      <AreaChart data={data} margin={{ top: 10, right: rightMargin, bottom: 0, left: 0 }}>
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
        <FinishRiders riders={riders} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Mascot + team-name labels pinned to each line's endpoint.
 *
 * Rendered inside the chart SVG so recharts' axis scales convert each series'
 * final (date, value) into the exact pixel where its line ends — the mascot
 * always "rides" the line, at any container size. Labels get a collision pass:
 * when lines finish close together, only the TEXT dodges vertically (the
 * mascot never leaves its point) and a short leader line keeps the shifted
 * name visually attached to its line end.
 */
function FinishRiders({ riders }: { riders: Rider[] }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plotArea = usePlotArea();
  if (!xScale || !yScale || !plotArea || riders.length === 0) return null;

  const anchored = riders
    .map((r) => {
      const x = xScale(r.date);
      const y = yScale(r.value);
      return x == null || y == null ? null : { ...r, x, y };
    })
    .filter((r): r is Rider & { x: number; y: number } => r !== null);
  if (anchored.length === 0) return null;

  // Dodge label rows apart so names never overlap: sort by endpoint y, push
  // down to enforce a minimum gap, then push back up from the bottom edge so
  // nothing leaves the plot area.
  const minGap = LABEL_FONT_SIZE + 4;
  const top = plotArea.y + minGap / 2;
  const bottom = plotArea.y + plotArea.height - minGap / 2;
  const sorted = [...anchored].sort((a, b) => a.y - b.y);
  const labelY = sorted.map((r) => r.y);
  for (let i = 0; i < labelY.length; i++) {
    const floor = i === 0 ? top : labelY[i - 1] + minGap;
    labelY[i] = Math.max(labelY[i], floor);
  }
  for (let i = labelY.length - 1; i >= 0; i--) {
    const ceil = i === labelY.length - 1 ? bottom : labelY[i + 1] - minGap;
    labelY[i] = Math.min(labelY[i], ceil);
  }

  return (
    <g className="race-riders" style={{ animation: "fade-up 0.5s ease-out 0.9s both" }}>
      {sorted.map((r, i) => {
        const ly = labelY[i];
        const textX = r.x + LABEL_GAP;
        return (
          <g key={r.id}>
            {Math.abs(ly - r.y) > 3 && (
              <line
                x1={r.x + 9}
                y1={r.y}
                x2={textX - 2}
                y2={ly}
                stroke={r.color}
                strokeWidth={1}
                strokeOpacity={0.55}
              />
            )}
            <text
              x={r.x}
              y={r.y}
              dy="0.35em"
              textAnchor="middle"
              fontSize={17}
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}
            >
              {r.mascot}
            </text>
            <text
              x={textX}
              y={ly}
              dy="0.35em"
              textAnchor="start"
              fontSize={LABEL_FONT_SIZE}
              fontWeight={700}
              fill={r.color}
              stroke="#0d1424"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {r.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
