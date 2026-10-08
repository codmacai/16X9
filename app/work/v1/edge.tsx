"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import d from "./detail.module.css";

// ===========================================================================
// EDGE — the top edge of a section that rises over the one before it. It's
// not a straight line moving up all at once: it's dragged. The middle leads
// and the sides trail, bulging up with the speed of the scroll (`drag`, a
// spring, so it overshoots and settles back flat when you stop) — like a
// sheet being pulled up the page by its centre.
// ===========================================================================

export default function Edge({ drag, color }: { drag: MotionValue<number>; color: string }) {
  // a quadratic from corner to corner, its control point lifted by the drag
  // (0 = flat; 50 = the middle half the edge's height up)
  const path = useTransform(drag, (b) => `M0 100 Q50 ${(100 - 2 * b).toFixed(2)} 100 100 Z`);
  return (
    <svg className={d.edge} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <motion.path d={path} fill={color} />
    </svg>
  );
}
