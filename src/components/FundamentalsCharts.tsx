"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Term from "./Glossary";

export type FundRow = {
  fiscalYear: number;
  revenue: number | null;
  ebitda: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
};

function fmtBig(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

const tooltipStyle = {
  background: "#0d1424",
  border: "1px solid #1e2a45",
  borderRadius: 12,
  fontSize: 13,
} as const;

export default function FundamentalsCharts({ rows }: { rows: FundRow[] }) {
  const data = rows
    .filter((r) => r.fiscalYear > 0)
    .map((r) => ({
      year: String(r.fiscalYear),
      revenue: r.revenue,
      ebitda: r.ebitda,
      margin: r.revenue && r.ebitda && r.revenue > 0 ? +((r.ebitda / r.revenue) * 100).toFixed(1) : null,
      marketCap: r.marketCap,
      ev: r.enterpriseValue,
      evEbitda:
        r.enterpriseValue && r.ebitda && r.ebitda > 0
          ? +(r.enterpriseValue / r.ebitda).toFixed(1)
          : null,
    }));

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-dim">No fundamentals available yet.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title={<>Revenue &amp; <Term word="ebitda">EBITDA</Term> by year</>}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#1e2a45" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: "#8fa1bf", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8fa1bf", fontSize: 11 }} tickFormatter={fmtBig} axisLine={false} tickLine={false} width={54} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtBig(Number(v)), n === "revenue" ? "Revenue" : "EBITDA"]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" name="Revenue" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ebitda" name="EBITDA" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={<><Term word="ebitda margin">EBITDA margin</Term> %</>}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#1e2a45" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: "#8fa1bf", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8fa1bf", fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "EBITDA margin"]} />
            <Line type="monotone" dataKey="margin" stroke="#a3e635" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={<><Term word="market cap">Market cap</Term> &amp; <Term word="enterprise value">enterprise value</Term></>}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#1e2a45" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: "#8fa1bf", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8fa1bf", fontSize: 11 }} tickFormatter={fmtBig} axisLine={false} tickLine={false} width={54} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtBig(Number(v)), n === "marketCap" ? "Market cap" : "Enterprise value"]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="marketCap" name="Market cap" stroke="#22d3ee" strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="ev" name="Enterprise value" stroke="#fbbf24" strokeWidth={2.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={<><Term word="ev/ebitda">EV / EBITDA</Term> (the &quot;how expensive?&quot; score)</>}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#1e2a45" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: "#8fa1bf", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8fa1bf", fontSize: 11 }} tickFormatter={(v: number) => `${v}x`} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}x`, "EV/EBITDA"]} />
            <Line type="monotone" dataKey="evEbitda" stroke="#f472b6" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-edge bg-panel2/50 p-4">
      <h3 className="mb-2 text-sm font-extrabold">{title}</h3>
      {children}
    </div>
  );
}
