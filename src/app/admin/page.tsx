"use client";

import { useCallback, useEffect, useState } from "react";

type Kid = {
  id: number;
  kind: string;
  name: string;
  teamName: string;
  mascot: string;
  color: string;
  startingBudget: number;
};
type Tx = {
  id: number;
  kidId: number;
  ticker: string;
  type: string;
  shares: number;
  price: number;
  amount: number;
  tradeDate: string;
  note: string | null;
};
type Dividend = {
  id: number;
  kidId: number;
  ticker: string;
  payDate: string;
  amountPerShare: number;
  shares: number;
  total: number;
};
type Chat = { id: number; kidId: number; role: string; content: string; createdAt: string };
type StockRow = { ticker: string; name: string; isBenchmark: boolean };

const TABS = ["Transactions", "Kids", "Dividends", "Oversight", "Export", "Reset"] as const;

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Transactions");

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.admin)))
      .catch(() => setAuthed(false));
  }, []);

  const login = async () => {
    setPinError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) setAuthed(true);
    else setPinError("Wrong PIN — try again.");
  };

  if (authed === null) return <div className="skeleton mx-auto mt-20 h-40 max-w-sm" />;

  if (!authed) {
    return (
      <div className="mx-auto mt-16 max-w-sm">
        <div className="panel p-8 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="display mt-3 text-2xl font-extrabold">Parents Only</h1>
          <p className="mt-1 text-sm text-ink-dim">Enter the parent PIN to manage the competition.</p>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className="mt-5 w-full rounded-xl border border-edge bg-night px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-neon/60"
            placeholder="••••"
            autoFocus
          />
          {pinError && <p className="mt-2 text-sm text-down">{pinError}</p>}
          <button
            onClick={login}
            className="mt-4 w-full rounded-xl bg-neon py-3 font-bold text-night hover:brightness-110"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="display text-3xl font-extrabold">Parent HQ</h1>
      <p className="mt-1 text-ink-dim">Log real trades, manage the teams, and keep an eye on the Coach.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              tab === t ? "bg-neon text-night" : "bg-panel text-ink-dim hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Transactions" && <TransactionsTab />}
        {tab === "Kids" && <KidsTab />}
        {tab === "Dividends" && <DividendsTab />}
        {tab === "Oversight" && <OversightTab />}
        {tab === "Export" && <ExportTab />}
        {tab === "Reset" && <ResetTab />}
      </div>
    </div>
  );
}

// ── Transactions ────────────────────────────────────────────────

function TransactionsTab() {
  const [kids, setKids] = useState<Kid[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [form, setForm] = useState({
    kidId: "",
    ticker: "",
    type: "buy",
    shares: "",
    price: "",
    tradeDate: new Date().toISOString().slice(0, 10),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/kids").then((r) => r.json()).then(setKids);
    fetch("/api/stocks").then((r) => r.json()).then(setStocks);
    fetch("/api/transactions").then((r) => r.json()).then(setTxs);
  }, []);
  useEffect(load, [load]);

  const submit = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kidId: Number(form.kidId),
          ticker: form.ticker,
          type: form.type,
          shares: Number(form.shares),
          price: Number(form.price),
          tradeDate: form.tradeDate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: `Logged: ${form.type} ${form.shares} ${form.ticker}` });
        setForm((f) => ({ ...f, shares: "", price: "" }));
        load();
      } else {
        setMsg({ ok: false, text: data.error ?? "Failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this transaction (and its robot mirror)?")) return;
    await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
    load();
  };

  const kidName = (id: number) => kids.find((k) => k.id === id);
  const realKids = kids.filter((k) => k.kind === "kid");
  const amount = Number(form.shares) * Number(form.price);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="panel p-5 lg:col-span-2">
        <h2 className="display text-xl font-extrabold">Log a real trade</h2>
        <div className="mt-4 space-y-3">
          <Field label="Kid">
            <select
              value={form.kidId}
              onChange={(e) => setForm({ ...form, kidId: e.target.value })}
              className="input"
            >
              <option value="">Choose…</option>
              {realKids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.mascot} {k.name} — {k.teamName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stock">
            <select
              value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              className="input"
            >
              <option value="">Choose…</option>
              {stocks
                .filter((s) => !s.isBenchmark)
                .map((s) => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} — {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={form.tradeDate}
                onChange={(e) => setForm({ ...form, tradeDate: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shares (fractions OK)">
              <input
                type="number"
                step="any"
                min="0"
                value={form.shares}
                onChange={(e) => setForm({ ...form, shares: e.target.value })}
                className="input"
                placeholder="0.25"
              />
            </Field>
            <Field label="Price per share ($)">
              <input
                type="number"
                step="any"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input"
                placeholder="123.45"
              />
            </Field>
          </div>
          {amount > 0 && (
            <p className="text-sm text-ink-dim">
              Total: <span className="font-bold text-ink tabular">${amount.toFixed(2)}</span>{" "}
              — Indexo the Robot will mirror this into SPY.
            </p>
          )}
          {msg && (
            <p className={`text-sm font-bold ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</p>
          )}
          <button
            onClick={submit}
            disabled={busy || !form.kidId || !form.ticker || !form.shares || !form.price}
            className="w-full rounded-xl bg-neon py-3 font-bold text-night hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Logging…" : "Log trade"}
          </button>
        </div>
      </div>

      <div className="panel p-5 lg:col-span-3">
        <h2 className="display text-xl font-extrabold">All transactions</h2>
        <div className="mt-3 max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-panel text-left text-xs uppercase text-ink-dim">
              <tr>
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Who</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Ticker</th>
                <th className="py-2 pr-2 text-right">Shares</th>
                <th className="py-2 pr-2 text-right">Amount</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => {
                const k = kidName(t.kidId);
                return (
                  <tr key={t.id} className="border-t border-edge/60">
                    <td className="py-2 pr-2 tabular">{t.tradeDate}</td>
                    <td className="py-2 pr-2">
                      {k?.mascot} {k?.name}
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          t.type === "buy"
                            ? "bg-up/15 text-up"
                            : t.type === "sell"
                              ? "bg-down/15 text-down"
                              : "bg-panel2 text-ink-dim"
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2 pr-2 font-bold">{t.ticker}</td>
                    <td className="py-2 pr-2 text-right tabular">{t.shares ? t.shares.toFixed(4) : "—"}</td>
                    <td className="py-2 pr-2 text-right tabular">${t.amount.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      {k?.kind === "kid" && (
                        <button
                          onClick={() => remove(t.id)}
                          className="text-xs text-ink-dim hover:text-down"
                          title="Delete"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {txs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-dim">
                    No trades yet. After Draft Day, log the real buys here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Kids ────────────────────────────────────────────────────────

const MASCOTS = ["🐉", "🦄", "🦈", "🦅", "🐯", "🚀", "⚡", "🔥", "🐺", "🦖", "👑", "💎"];
const COLORS = ["#22d3ee", "#f472b6", "#a3e635", "#fbbf24", "#a78bfa", "#fb7185", "#34d399", "#60a5fa"];

function KidsTab() {
  const [kids, setKids] = useState<Kid[]>([]);
  const [form, setForm] = useState({ name: "", teamName: "", mascot: "🐉", color: "#22d3ee", startingBudget: "500" });

  const load = useCallback(() => {
    fetch("/api/kids").then((r) => r.json()).then(setKids);
  }, []);
  useEffect(load, [load]);

  const add = async () => {
    const res = await fetch("/api/kids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, startingBudget: Number(form.startingBudget) }),
    });
    if (res.ok) {
      setForm({ name: "", teamName: "", mascot: "🐉", color: "#22d3ee", startingBudget: "500" });
      load();
    }
  };

  const updateBudget = async (id: number, startingBudget: number) => {
    await fetch("/api/kids", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, startingBudget }),
    });
    load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="panel p-5">
        <h2 className="display text-xl font-extrabold">Add a competitor</h2>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Vaughn" />
            </Field>
            <Field label="Team / fund name">
              <input value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })} className="input" placeholder="Dragon Capital" />
            </Field>
          </div>
          <Field label="Mascot">
            <div className="flex flex-wrap gap-2">
              {MASCOTS.map((m) => (
                <button
                  key={m}
                  onClick={() => setForm({ ...form, mascot: m })}
                  className={`rounded-xl border p-2 text-2xl transition-transform hover:scale-110 ${form.mascot === m ? "border-neon bg-neon/10" : "border-edge"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Team color">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? "border-white" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>
          <Field label="Starting budget ($)">
            <input
              type="number"
              value={form.startingBudget}
              onChange={(e) => setForm({ ...form, startingBudget: e.target.value })}
              className="input"
            />
          </Field>
          <button
            onClick={add}
            disabled={!form.name || !form.teamName}
            className="w-full rounded-xl bg-neon py-3 font-bold text-night hover:brightness-110 disabled:opacity-40"
          >
            Add competitor
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {kids.map((k) => (
          <div key={k.id} className="panel flex items-center gap-4 p-4" style={{ "--glow": k.color } as React.CSSProperties}>
            <span className="text-3xl">{k.mascot}</span>
            <div className="flex-1">
              <div className="font-extrabold">{k.teamName}</div>
              <div className="text-sm text-ink-dim">
                {k.name}
                {k.kind === "robot" && " · robot rival (mirrors buys into SPY)"}
              </div>
            </div>
            {k.kind === "kid" && (
              <label className="flex items-center gap-2 text-sm text-ink-dim">
                Budget $
                <input
                  type="number"
                  defaultValue={k.startingBudget}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0 && v !== k.startingBudget) updateBudget(k.id, v);
                  }}
                  className="input w-28"
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dividends ───────────────────────────────────────────────────

function DividendsTab() {
  const [rows, setRows] = useState<Dividend[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(() => {
    fetch("/api/dividends").then((r) => r.json()).then(setRows);
    fetch("/api/kids").then((r) => r.json()).then(setKids);
  }, []);
  useEffect(load, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      await fetch("/api/dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      load();
    } finally {
      setScanning(false);
    }
  };

  const act = async (id: number, action: "confirm" | "dismiss") => {
    await fetch("/api/dividends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  };

  const kidName = (id: number) => kids.find((k) => k.id === id);

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="display text-xl font-extrabold">Dividends detected 💰</h2>
        <button
          onClick={scan}
          disabled={scanning}
          className="rounded-full bg-panel2 px-4 py-2 text-sm font-bold text-ink hover:bg-edge disabled:opacity-50"
        >
          {scanning ? "Scanning…" : "Scan now"}
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-dim">
        Confirm dividends that actually landed in the kids&apos; real accounts — confirmed dividends are added to their cash.
      </p>
      <div className="mt-4 space-y-2">
        {rows.map((d) => {
          const k = kidName(d.kidId);
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-panel2 px-4 py-3">
              <span className="text-xl">{k?.mascot}</span>
              <span className="font-bold">{k?.name}</span>
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">{d.ticker}</span>
              <span className="text-sm text-ink-dim">
                {d.payDate}: ${d.amountPerShare.toFixed(4)}/share × {d.shares.toFixed(4)} ={" "}
                <span className="font-bold text-ink tabular">${d.total.toFixed(2)}</span>
              </span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => act(d.id, "confirm")} className="rounded-full bg-up/15 px-3 py-1 text-sm font-bold text-up hover:bg-up/25">
                  Confirm
                </button>
                <button onClick={() => act(d.id, "dismiss")} className="rounded-full bg-panel px-3 py-1 text-sm text-ink-dim hover:text-ink">
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="py-8 text-center text-ink-dim">No pending dividends. Hit “Scan now” to check.</p>
        )}
      </div>
    </div>
  );
}

// ── Oversight ───────────────────────────────────────────────────

function OversightTab() {
  const [data, setData] = useState<{ kids: Kid[]; chats: Chat[] } | null>(null);

  useEffect(() => {
    fetch("/api/admin/oversight").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="skeleton h-64" />;
  const kidName = (id: number) => data.kids.find((k) => k.id === id);

  return (
    <div className="panel mx-auto max-w-3xl p-5">
      <h2 className="display text-xl font-extrabold">Coach chat transcripts</h2>
      <p className="mt-1 text-sm text-ink-dim">Everything the kids and the Coach have said to each other.</p>
      <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
        {data.chats.map((c) => (
          <div key={c.id} className="rounded-xl border border-edge bg-panel2 px-3 py-2 text-sm">
            <span className="font-bold">
              {c.role === "user" ? `${kidName(c.kidId)?.mascot ?? ""} ${kidName(c.kidId)?.name ?? "Kid"}` : "🧢 Coach"}:
            </span>{" "}
            <span className="whitespace-pre-wrap text-ink-dim">{c.content}</span>
          </div>
        ))}
        {data.chats.length === 0 && <p className="py-6 text-center text-ink-dim">No chats yet.</p>}
      </div>
    </div>
  );
}

// ── Export ──────────────────────────────────────────────────────

function ExportTab() {
  return (
    <div className="panel p-5">
      <h2 className="display text-xl font-extrabold">Backup &amp; export</h2>
      <p className="mt-1 text-sm text-ink-dim">Download the competition history as CSV files.</p>
      <div className="mt-4 flex gap-3">
        <a href="/api/export?what=transactions" className="rounded-xl bg-neon px-5 py-3 font-bold text-night hover:brightness-110">
          Transactions.csv
        </a>
        <a href="/api/export?what=snapshots" className="rounded-xl bg-panel2 px-5 py-3 font-bold text-ink hover:bg-edge">
          Snapshots.csv
        </a>
      </div>
    </div>
  );
}

// ── Reset ───────────────────────────────────────────────────────

const RESET_OPTIONS = [
  {
    scope: "game" as const,
    emoji: "🔁",
    title: "Restart the competition",
    blurb:
      "Redo Draft Day with the same teams. Wipes the draft, all trades and portfolios, the race history, badges, and pending dividends. Keeps the kids, their team names, and Coach chats.",
    confirmWord: "RESTART",
    button: "Restart the competition",
    doneText: "Competition reset! Head to Draft Day to run a fresh draft.",
    doneHref: "/draft",
    doneLink: "Go to Draft Day →",
  },
  {
    scope: "all" as const,
    emoji: "🧨",
    title: "Erase everything",
    blurb:
      "Start over from scratch — redo the teams too. Wipes everything above plus the kids, team names, budgets, and Coach chat history. You'll be taken back to Setup.",
    confirmWord: "ERASE",
    button: "Erase everything",
    doneText: "Everything erased. Taking you to Setup…",
    doneHref: "/setup",
    doneLink: "Go to Setup →",
  },
];

function ResetTab() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-ink-dim">
        ⚠️ <span className="font-bold text-ink">Danger zone.</span> These can&apos;t be undone. If you
        might want the history later, download the CSVs from the Export tab first.
      </div>
      {RESET_OPTIONS.map((o) => (
        <ResetCard key={o.scope} option={o} />
      ))}
    </div>
  );
}

function ResetCard({ option }: { option: (typeof RESET_OPTIONS)[number] }) {
  const [armed, setArmed] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: option.scope }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed — try again.");
        return;
      }
      setDone(true);
      if (option.scope === "all") {
        setTimeout(() => {
          window.location.href = option.doneHref;
        }, 1200);
      }
    } catch {
      setError("Reset failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="panel p-5">
        <p className="font-bold text-up">✅ {option.doneText}</p>
        <a href={option.doneHref} className="mt-2 inline-block text-sm font-bold text-neon underline">
          {option.doneLink}
        </a>
      </div>
    );
  }

  return (
    <div className="panel p-5">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{option.emoji}</span>
        <div className="flex-1">
          <h2 className="display text-xl font-extrabold">{option.title}</h2>
          <p className="mt-1 text-sm text-ink-dim">{option.blurb}</p>
        </div>
      </div>
      {!armed ? (
        <button
          onClick={() => setArmed(true)}
          className="mt-4 rounded-xl border border-down/50 px-5 py-2.5 font-bold text-down hover:bg-down/10"
        >
          {option.button}…
        </button>
      ) : (
        <div className="mt-4 space-y-3 rounded-xl border border-down/40 bg-down/5 p-4">
          <p className="text-sm text-ink-dim">
            Type <span className="font-extrabold tracking-widest text-down">{option.confirmWord}</span>{" "}
            to confirm:
          </p>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className="input"
            placeholder={option.confirmWord}
            autoFocus
          />
          {error && <p className="text-sm font-bold text-down">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={run}
              disabled={busy || word.trim().toUpperCase() !== option.confirmWord}
              className="rounded-xl bg-down px-5 py-2.5 font-bold text-night hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Resetting…" : `Yes, ${option.button.toLowerCase()}`}
            </button>
            <button
              onClick={() => {
                setArmed(false);
                setWord("");
                setError("");
              }}
              className="rounded-xl bg-panel2 px-5 py-2.5 font-bold text-ink-dim hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-dim">{label}</span>
      {children}
    </label>
  );
}
