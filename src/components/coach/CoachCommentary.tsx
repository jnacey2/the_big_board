"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  module: "portfolioDay" | "weeklyRecap" | "risk" | "detective" | "scout" | "kidDescription";
  kidId?: number;
  ticker?: string;
  title?: string;
  compact?: boolean;
  /** If false, waits until expanded/triggered externally. */
  auto?: boolean;
};

export default function CoachCommentary({ module, kidId, ticker, title, compact, auto = true }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch("/api/coach/module", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module, kidId, ticker, force }),
        });
        const data = await res.json();
        if (res.ok) setContent(data.content);
        else setError(true);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [module, kidId, ticker]
  );

  useEffect(() => {
    if (auto) load();
  }, [auto, load]);

  return (
    <div className={`flex gap-3 ${compact ? "" : "rounded-2xl border border-edge bg-panel2/70 p-4"}`}>
      <span className={compact ? "text-xl" : "text-2xl"}>🧢</span>
      <div className="min-w-0 flex-1">
        {title && (
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-neon">{title}</span>
            {content && !loading && (
              <button
                onClick={() => load(true)}
                title="Ask the Coach again"
                className="text-xs text-ink-dim transition-colors hover:text-ink"
              >
                ↻
              </button>
            )}
          </div>
        )}
        {loading && !content && (
          <div className="space-y-1.5">
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-3.5 w-2/3" />
          </div>
        )}
        {content && (
          <p className={`whitespace-pre-wrap text-sm leading-relaxed ${loading ? "opacity-50" : ""}`}>
            {content}
          </p>
        )}
        {error && !content && (
          <button onClick={() => load()} className="text-sm text-ink-dim underline hover:text-ink">
            The Coach missed that play — tap to retry
          </button>
        )}
      </div>
    </div>
  );
}
