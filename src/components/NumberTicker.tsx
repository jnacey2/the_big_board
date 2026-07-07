"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

type Props = {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
};

/**
 * Odometer-style rolling number.
 *
 * IMPORTANT: the motion value must initialize to the REAL value, because that
 * is what gets server-rendered into the HTML. If JS never runs (hydration
 * failure, restored tab with purged chunks, JS disabled), the static number is
 * all the user sees — it must be correct, not the animation's starting point.
 * The roll-up-from-85% intro only kicks in client-side after mount.
 */
export default function NumberTicker({ value, prefix = "", suffix = "", decimals = 2, className }: Props) {
  const mv = useMotionValue(value);
  const started = useRef(false);
  const text = useTransform(mv, (v) =>
    `${prefix}${v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`
  );

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      mv.set(Math.max(0, value * 0.85));
    }
    const controls = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
  }, [value, mv]);

  return <motion.span className={`tabular ${className ?? ""}`}>{text}</motion.span>;
}
