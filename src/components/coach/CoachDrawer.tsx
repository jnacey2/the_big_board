"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Kid = { id: number; name: string; teamName: string; mascot: string; color: string; kind: string };
type Msg = { role: "user" | "assistant"; content: string };

export default function CoachDrawer() {
  const [open, setOpen] = useState(false);
  const [kidList, setKidList] = useState<Kid[]>([]);
  const [activeKid, setActiveKid] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/kids")
      .then((r) => r.json())
      .then((rows: Kid[]) => {
        const realKids = rows.filter((k) => k.kind === "kid");
        setKidList(realKids);
        if (realKids.length > 0) setActiveKid((prev) => prev ?? realKids[0].id);
      })
      .catch(() => {});
  }, []);

  const loadHistory = useCallback(async (kidId: number) => {
    const res = await fetch(`/api/coach/chat?kidId=${kidId}`);
    if (res.ok) {
      const rows = (await res.json()) as { role: "user" | "assistant"; content: string }[];
      setMessages(rows.map((r) => ({ role: r.role, content: r.content })));
    }
  }, []);

  useEffect(() => {
    if (open && activeKid) loadHistory(activeKid);
  }, [open, activeKid, loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || !activeKid || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidId: activeKid, message: text }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.ok ? data.reply : data.error ?? "Hmm, something went wrong. Try again!",
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I lost my connection! Try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (kidList.length === 0) return null;
  const kid = kidList.find((k) => k.id === activeKid);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask the Coach"
        className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full border-2 border-neon/50 bg-panel2 text-3xl shadow-[0_8px_30px_-6px_rgba(34,211,238,0.5)] transition-transform hover:scale-110 active:scale-95"
      >
        🧢
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-edge bg-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
                <span className="text-3xl">🧢</span>
                <div>
                  <div className="display text-lg font-extrabold">Coach</div>
                  <div className="text-xs text-ink-dim">Ask me anything about investing!</div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="ml-auto rounded-full px-3 py-1 text-ink-dim hover:bg-panel2 hover:text-ink"
                >
                  ✕
                </button>
              </div>

              {kidList.length > 1 && (
                <div className="flex gap-2 border-b border-edge px-4 py-2">
                  {kidList.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => setActiveKid(k.id)}
                      className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
                        k.id === activeKid ? "text-night" : "bg-panel2 text-ink-dim hover:text-ink"
                      }`}
                      style={k.id === activeKid ? { backgroundColor: k.color } : undefined}
                    >
                      {k.mascot} {k.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                  <div className="rounded-2xl rounded-tl-sm border border-edge bg-panel2 px-4 py-3 text-sm">
                    Hey {kid?.name ?? "champ"}! 🧢 I&apos;m your investing coach. Ask me why a
                    stock moved, what a word means, or how your team is doing!
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                      m.role === "user"
                        ? "ml-auto rounded-tr-sm bg-neon/15 text-ink"
                        : "rounded-tl-sm border border-edge bg-panel2"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {busy && (
                  <div className="flex w-16 items-center gap-1 rounded-2xl rounded-tl-sm border border-edge bg-panel2 px-4 py-3">
                    <Dot delay={0} />
                    <Dot delay={0.15} />
                    <Dot delay={0.3} />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-edge p-3">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Ask the Coach…"
                    className="flex-1 rounded-full border border-edge bg-night px-4 py-2.5 text-sm outline-none focus:border-neon/60"
                  />
                  <button
                    onClick={send}
                    disabled={busy || !input.trim()}
                    className="rounded-full bg-neon px-4 py-2 font-bold text-night disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-ink-dim"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ repeat: Infinity, duration: 1, delay }}
    />
  );
}
