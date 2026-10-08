"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Band, EASE_CINE, Info, rootClass } from "./_shared/chrome";
import styles from "./work.module.css";

// ===========================================================================
// WORK — the three takes on the work page, side by side to pick from. Each is
// the same films and categories in the burger menu's language.
// ===========================================================================

const TAKES = [
  { href: "/work/v1", no: "01", name: "The cabinet", line: "Dividers and files; scroll and the stack builds up" },
  { href: "/work/v2", no: "02", name: "The index", line: "One folder, a tab per category; the film plays in the line" },
  { href: "/work/v3", no: "03", name: "The flip", line: "Files on end in the dark; flip forward through the drawer" },
];

export default function WorkTakes() {
  const reduce = !!useReducedMotion();
  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band crumb="Variations" />
      <section className={styles.sheet}>
        <Info left="16X9 — Work page" centre="Three variations" />
        <ol className={styles.list}>
          {TAKES.map((t, i) => (
            <motion.li
              key={t.href}
              initial={reduce ? false : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1, transition: { delay: 0.4 + i * 0.1, duration: 1, ease: EASE_CINE } }}
            >
              <Link href={t.href} className={styles.take}>
                <span className={styles.no}>{t.no}</span>
                <span className={styles.name}>{t.name}</span>
                <span className={styles.line}>{t.line}</span>
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
              </Link>
            </motion.li>
          ))}
        </ol>
      </section>
    </main>
  );
}
