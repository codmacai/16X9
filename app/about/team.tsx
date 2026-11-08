"use client";

import { motion, useReducedMotion, type Transition, type Variants } from "framer-motion";
import s from "./team.module.css";

// ===========================================================================
// THE TEAM — the people behind the frame, and nothing else. On the black, a
// head row: "The team", a hairline drawing across, and the count. Under it
// the wall: everyone once, five across and three down, each portrait the same
// size, in black and white, its corners just rounded, a fine gap between
// them. As it comes into view the portraits come up into place on a spring,
// from the middle out. Point at one and it comes forward into the light while
// the rest step back into the dark.
// ===========================================================================

// the team, in black and white, each once (stand-ins cut from the old site's
// About page: replace each with the full-size original)
const PEOPLE = Array.from({ length: 15 }, (_, i) => `/about/team/team-${String(i + 1).padStart(2, "0")}.webp`);
const COLS = 5;
const ROWS = Math.ceil(PEOPLE.length / COLS);

const SPRING: Transition = { type: "spring", stiffness: 80, damping: 15, mass: 1 };
// each portrait a beat after the ones nearer the middle
const TILE: Variants = {
  out: { opacity: 0, y: 48, scale: 0.94 },
  in: (d: number) => ({ opacity: 1, y: 0, scale: 1, transition: { ...SPRING, delay: 0.15 + d * 0.07 } }),
};
const RULE: Variants = {
  out: { scaleX: 0 },
  in: { scaleX: 1, transition: { duration: 1.3, ease: [0.76, 0, 0.24, 1] } },
};
const FADE: Variants = {
  out: { opacity: 0 },
  in: { opacity: 1, transition: { duration: 0.9, ease: "easeOut", delay: 0.3 } },
};

export default function Team() {
  const reduce = !!useReducedMotion();
  return (
    <motion.section
      id="team"
      className={s.section}
      aria-labelledby="team-title"
      initial={reduce ? false : "out"}
      whileInView="in"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className={s.head}>
        <motion.h2 id="team-title" className={s.label} variants={FADE}>
          The team
        </motion.h2>
        <motion.i className={s.rule} variants={RULE} aria-hidden="true" />
        <motion.span className={s.label} variants={FADE}>
          {String(PEOPLE.length).padStart(2, "0")} people
        </motion.span>
      </div>

      <ul className={s.wall}>
        {PEOPLE.map((src, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          // how far it stands from the middle of the wall
          const d = Math.hypot(c - (COLS - 1) / 2, r - (ROWS - 1) / 2);
          return (
            <motion.li key={src} className={s.tile} variants={TILE} custom={d}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" draggable={false} decoding="async" loading="lazy" />
            </motion.li>
          );
        })}
      </ul>
    </motion.section>
  );
}
