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

/** Odometer-style rolling number. */
export default function NumberTicker({ value, prefix = "", suffix = "", decimals = 2, className }: Props) {
  const mv = useMotionValue(value * 0.85);
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
