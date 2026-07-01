"use client";

import { useEffect, useState } from "react";

type Status = { open: boolean; label: string };

export default function MarketChip() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market");
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (alive) setStatus(data);
      } catch {
        /* offline is fine */
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!status) return null;

  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
        status.open
          ? "border-up/40 bg-up/10 text-up"
          : "border-edge bg-panel text-ink-dim"
      }`}
      title={status.label}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          status.open ? "animate-pulse bg-up" : "bg-ink-dim"
        }`}
      />
      <span className="hidden sm:inline">{status.label}</span>
      <span className="sm:hidden">{status.open ? "Open" : "Closed"}</span>
    </span>
  );
}
