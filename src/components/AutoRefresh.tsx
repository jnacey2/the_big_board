"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the current page's server components on an interval, but only
 * while the US market is open (checked via /api/market, which makes no FMP
 * calls). router.refresh() merges the new server payload without losing
 * client component state (expanded panels, scroll position, etc.).
 */
export default function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/market");
        if (!res.ok) return;
        const { open } = (await res.json()) as { open: boolean };
        if (alive && open) router.refresh();
      } catch {
        /* offline is fine */
      }
    };
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [router, intervalMs]);

  return null;
}
