"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const MASCOTS = ["🐉", "🦄", "🦈", "🦅", "🐯", "🚀", "⚡", "🔥", "🐺", "🦖", "👑", "💎"];
const COLORS = ["#22d3ee", "#f472b6", "#a3e635", "#fbbf24", "#a78bfa", "#fb7185", "#34d399", "#60a5fa"];

type Draft = { name: string; teamName: string; mascot: string; color: string; startingBudget: string };

const empty = (i: number): Draft => ({
  name: "",
  teamName: "",
  mascot: MASCOTS[i % MASCOTS.length],
  color: COLORS[i % COLORS.length],
  startingBudget: "500",
});

export default function SetupPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([empty(0), empty(1)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/kids")
      .then((r) => r.json())
      .then((rows: { kind: string }[]) => {
        if (rows.filter((k) => k.kind === "kid").length > 0) router.replace("/");
      })
      .catch(() => {});
  }, [router]);

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = async () => {
    setError("");
    const valid = drafts.filter((d) => d.name.trim() && d.teamName.trim());
    if (valid.length === 0) {
      setError("Add at least one competitor with a name and team name.");
      return;
    }
    setBusy(true);
    try {
      for (const d of valid) {
        const res = await fetch("/api/kids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...d, startingBudget: Number(d.startingBudget) || 500 }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to create competitor");
        }
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <div className="text-center">
        <div className="text-5xl">🏟️</div>
        <h1 className="display mt-2 text-3xl font-extrabold sm:text-4xl">Build Your Teams</h1>
        <p className="mx-auto mt-2 max-w-lg text-ink-dim">
          Every investor needs a fund name and a mascot. Indexo the Robot 🤖 will join automatically to
          defend the honor of the S&amp;P 500.
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {drafts.map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="panel p-5"
            style={{ "--glow": d.color } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 text-2xl"
                style={{ borderColor: d.color, backgroundColor: `${d.color}18` }}
              >
                {d.mascot}
              </span>
              <span className="display text-lg font-extrabold">{d.teamName || `Competitor ${i + 1}`}</span>
              {drafts.length > 1 && (
                <button
                  onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))}
                  className="ml-auto text-ink-dim hover:text-down"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={d.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Kid's name"
                className="input"
              />
              <input
                value={d.teamName}
                onChange={(e) => update(i, { teamName: e.target.value })}
                placeholder='Fund name (like "Dragon Capital")'
                className="input"
              />
              <div className="flex flex-wrap gap-1.5">
                {MASCOTS.map((m) => (
                  <button
                    key={m}
                    onClick={() => update(i, { mascot: m })}
                    className={`rounded-lg border p-1.5 text-xl transition-transform hover:scale-110 ${
                      d.mascot === m ? "border-neon bg-neon/10" : "border-edge"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => update(i, { color: c })}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      d.color === c ? "border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-dim">
                Starting budget $
                <input
                  type="number"
                  value={d.startingBudget}
                  onChange={(e) => update(i, { startingBudget: e.target.value })}
                  className="input w-28"
                />
              </label>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 flex flex-col items-center gap-3">
        <button
          onClick={() => setDrafts((d) => [...d, empty(d.length)])}
          className="rounded-full bg-panel2 px-4 py-2 text-sm font-bold text-ink-dim hover:text-ink"
        >
          + Add another competitor
        </button>
        {error && <p className="text-sm font-bold text-down">{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full max-w-sm rounded-xl bg-neon py-4 text-lg font-extrabold text-night hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Creating teams…" : "Start the competition! 🎉"}
        </button>
      </div>
    </div>
  );
}
