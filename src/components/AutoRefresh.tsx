"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the page's server-rendered data fresh:
 *
 * 1. While the US market is open, re-renders on an interval (market status is
 *    re-checked every tick via /api/market, which makes no FMP calls).
 * 2. Whenever the page becomes visible again — tab switch, iPad Safari
 *    restoring the page from the back/forward cache, waking from sleep — it
 *    refreshes once immediately, regardless of market status. Without this, a
 *    bfcache-restored page outside market hours would keep showing whatever
 *    was last rendered, potentially hours or days old.
 *
 * router.refresh() merges the new server payload without losing client
 * component state (expanded panels, scroll position, etc.).
 */
export default function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    let lastRefreshAt = 0;

    const refresh = () => {
      if (!alive) return;
      lastRefreshAt = Date.now();
      router.refresh();
    };

    // A single refresh on becoming visible is cheap and guarantees the user
    // never stares at stale numbers. Debounced so pageshow + visibilitychange
    // firing together (as they do on bfcache restore) refresh only once.
    const refreshIfStale = () => {
      if (Date.now() - lastRefreshAt > 5_000) refresh();
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refreshIfStale();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };

    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/market");
        if (!res.ok) return;
        const { open } = (await res.json()) as { open: boolean };
        if (open) refresh();
      } catch {
        /* offline is fine */
      }
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, intervalMs]);

  return null;
}
