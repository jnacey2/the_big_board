"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const KEY = "kst_tour_seen_v1";

export default function CoachTour({ kidNames }: { kidNames: string[] }) {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setStep(0);
  }, []);

  const names = kidNames.join(" and ") || "champs";
  const steps = [
    {
      emoji: "🧢",
      title: `Welcome, ${names}!`,
      body: "I'm the Coach. Welcome to The Big Board — your very own stock market competition with real money, real companies, and three ways to win.",
    },
    {
      emoji: "🎤",
      title: "Draft Day",
      body: "First you take turns drafting companies onto your team — like fantasy sports, but with real businesses like Disney and Nintendo. Flip the cards to scout them!",
    },
    {
      emoji: "🏆",
      title: "Three Championship Belts",
      body: "Total Return Champion goes to the biggest gains. Best Risk-Adjusted Investor rewards being smart AND careful. Thesis Champion goes to whoever explains their picks best — the robot can't win that one!",
    },
    {
      emoji: "🤖",
      title: "Beat Indexo",
      body: "Indexo the Robot copies every dollar you invest, but just buys the whole market. Beating a robot that doesn't even think is harder than it sounds…",
    },
    {
      emoji: "🕵️",
      title: "Be a detective",
      body: "Tap any stock to see why it might be moving, read real news, and ask me anything with the 🧢 button. Good luck — make me proud!",
    },
  ];

  const close = () => {
    localStorage.setItem(KEY, "1");
    setStep(null);
  };

  return (
    <AnimatePresence>
      {step !== null && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            key={step}
            initial={{ scale: 0.9, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="panel w-full max-w-md p-8 text-center"
          >
            <div className="text-5xl">{steps[step].emoji}</div>
            <h2 className="display mt-3 text-2xl font-extrabold">{steps[step].title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-dim">{steps[step].body}</p>
            <div className="mt-5 flex items-center justify-center gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-neon" : "w-1.5 bg-edge"}`}
                />
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={close} className="flex-1 rounded-xl bg-panel2 py-3 text-sm font-bold text-ink-dim hover:text-ink">
                Skip
              </button>
              <button
                onClick={() => (step < steps.length - 1 ? setStep(step + 1) : close())}
                className="flex-1 rounded-xl bg-neon py-3 text-sm font-bold text-night hover:brightness-110"
              >
                {step < steps.length - 1 ? "Next" : "Let's go! 🚀"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
