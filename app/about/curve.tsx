"use client";

import { motion, useScroll, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { type RefObject } from "react";
import s from "./curve.module.css";

// ===========================================================================
// CURVE — the top edge of a section that rises over the one before it. While
// the section comes up the screen its edge is a soft arch, the middle leading;
// it flattens as the section reaches the top. Tied to where the section is
// (not to how fast you scroll) and smoothed by an over-damped spring, so it
// never overshoots or wobbles.
// ===========================================================================

export default function Curve({ target, color, depth = 9 }: { target: RefObject<HTMLElement | null>; color: string; depth?: number }) {
  const reduce = !!useReducedMotion();
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "start start"] });
  const eased = useSpring(scrollYProgress, { stiffness: 120, damping: 34, mass: 1, restDelta: 0.0005 });
  // depth: how high the arch stands at its tallest, in vh
  const lift = useTransform(eased, [0, 0.85], [depth, 0], { clamp: true });
  const path = useTransform(lift, (h) => `M0 100 Q50 ${(100 - 200 * (h / depth)).toFixed(2)} 100 100 Z`);
  if (reduce) return null;
  return (
    <svg className={s.curve} style={{ height: `${depth}vh` }} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <motion.path d={path} fill={color} />
    </svg>
  );
}
