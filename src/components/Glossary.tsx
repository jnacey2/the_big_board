"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export const GLOSSARY: Record<string, string> = {
  "sharpe ratio":
    "A score for how much reward you got for the bumps you rode through. Two kids might both make 10%, but if one had a way wilder ride, the calmer one has the higher Sharpe ratio. Above 1 is really good!",
  volatility:
    "How bumpy the ride is. High volatility means big up AND down days — like a roller coaster. Low volatility is more like a train ride.",
  dividend:
    "A thank-you payment some companies send their owners, usually every 3 months. Own the stock, get the cash — just for holding it!",
  "market cap":
    "The price tag for the WHOLE company: the stock price times every share that exists. It's how you compare company sizes.",
  "enterprise value":
    "The real takeover price of a company: market cap plus its debts, minus the cash in its piggy bank. Like buying a house AND taking over the mortgage.",
  ebitda:
    "A company's profit engine before some accounting stuff: the money the business makes from actually doing business. Bigger is better.",
  "ebitda margin":
    "Out of every $1 the company collects, how many cents become EBITDA profit. A lemonade stand keeping 30¢ of every dollar has a 30% margin.",
  "ev/ebitda":
    "The 'how expensive is it?' score: the company's full price tag divided by its yearly profit engine. Around 10 is normal-ish; way higher means investors expect big growth.",
  revenue:
    "All the money a company collects from selling stuff, before paying any costs. Also called sales or 'the top line.'",
  diversification:
    "Not putting all your eggs in one basket. Owning different kinds of companies means one bad day for one stock doesn't wreck your whole team.",
  sector:
    "The neighborhood a company lives in: Technology, Healthcare, Consumer, and so on. Stocks in the same sector often move together.",
  "index fund":
    "A basket holding a tiny slice of hundreds of companies at once. You'll never beat the market with it — because you ARE the market. That's Indexo's whole strategy!",
  "cost basis": "What you actually paid for your shares. Your profit is measured from here.",
  "p&l": "Profit and Loss — how much you've made (or lost) on an investment, in dollars or percent.",
};

export default function Term({ word, children }: { word: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const def = GLOSSARY[word.toLowerCase()];
  if (!def) return <>{children ?? word}</>;
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="cursor-help border-b border-dotted border-neon/60 text-inherit"
      >
        {children ?? word}
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className="absolute bottom-full left-1/2 z-50 mb-2 block w-64 -translate-x-1/2 rounded-xl border border-edge bg-panel p-3 text-left text-xs font-normal normal-case leading-relaxed text-ink shadow-xl"
          >
            <span className="mb-1 block font-extrabold text-neon">🧢 Coach says:</span>
            {def}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
