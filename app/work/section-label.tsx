"use client";

import { motion, type Variants } from "framer-motion";
import { EASE } from "./_shared/chrome";
import s from "./label.module.css";

// A section's number and name on the 9x16 page — "01 —— The accounts we run" —
// coming in as it scrolls into view: the number, the line drawn out from it,
// then the name.

const IN: Variants = { out: {}, in: { transition: { staggerChildren: 0.12 } } };
const RISE: Variants = { out: { opacity: 0, y: 12 }, in: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } } };
const DRAW: Variants = { out: { scaleX: 0 }, in: { scaleX: 1, transition: { duration: 0.9, ease: EASE } } };

export default function SectionLabel({ no, id, reduce, children }: { no: string; id?: string; reduce: boolean; children: string }) {
  return (
    <motion.h2 id={id} className={s.label} variants={IN} initial={reduce ? false : "out"} whileInView="in" viewport={{ once: true, amount: 0.8 }}>
      <motion.span className={s.no} variants={RISE}>
        {no}
      </motion.span>
      <motion.i className={s.line} variants={DRAW} aria-hidden="true" />
      <motion.span variants={RISE}>{children}</motion.span>
    </motion.h2>
  );
}
