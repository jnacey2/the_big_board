"use client";

import { useEffect, useState } from "react";

type Analysis = {
  rationaleKid: string | null;
  rationaleGrownup: string | null;
  risks: string[] | null;
  generatedAt: string | null;
};

export default function DeepDive({ ticker, initial }: { ticker: string; initial: Analysis | null }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(initial);
  const [loading, setLoading] = useState(false);
  const [grownup, setGrownup] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (res.ok) setAnalysis(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initial?.rationaleKid) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-up/25 bg-up/5 p-5">
        <div className="flex items-center gap-2">
          <h3 className="display text-lg font-extrabold text-up">📈 Why investors like it</h3>
          <button
            onClick={generate}
            disabled={loading}
            title="Regenerate"
            className="ml-auto text-sm text-ink-dim hover:text-ink disabled:opacity-40"
          >
            ↻
          </button>
        </div>
        {loading && !analysis?.rationaleKid ? (
          <div className="mt-3 space-y-2">
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-5/6" />
            <div className="skeleton h-3.5 w-2/3" />
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed">{analysis?.rationaleKid ?? "—"}</p>
            {analysis?.rationaleGrownup && (
              <div className="mt-3">
                <button
                  onClick={() => setGrownup((g) => !g)}
                  className="text-xs font-bold text-ink-dim underline hover:text-ink"
                >
                  {grownup ? "Hide" : "Show"} the grown-up version
                </button>
                {grownup && (
                  <p className="mt-2 rounded-xl bg-night/50 p-3 text-xs leading-relaxed text-ink-dim">
                    {analysis.rationaleGrownup}
                  </p>
                )}
              </div>
            )}
          </>
        )}
        <p className="mt-3 text-[11px] italic text-ink-dim">
          This explains why some investors like the company — it is not advice to buy.
        </p>
      </div>

      <div className="rounded-2xl border border-down/25 bg-down/5 p-5">
        <h3 className="display text-lg font-extrabold text-down">⚠️ What could go wrong</h3>
        {loading && !analysis?.risks ? (
          <div className="mt-3 space-y-2">
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-3.5 w-3/4" />
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {(analysis?.risks ?? []).map((r, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span>•</span>
                <span>{r}</span>
              </li>
            ))}
            {(analysis?.risks ?? []).length === 0 && <li className="text-sm text-ink-dim">—</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
