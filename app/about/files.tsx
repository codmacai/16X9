"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE, EASE_CINE } from "../work/_shared/chrome";
import s from "./files.module.css";

// ===========================================================================
// HOW WE WORK — two files, in the menu's language: black card stock cut with
// a numbered tab, the pillar's name across it in light wide capitals, its
// three points and the line that sums them up. They rise out of the drawer
// side by side as they come into view; point at one and it's pulled up a
// little, the way the menu's folders are.
// ===========================================================================

const PILLARS = [
  {
    no: "01",
    name: "Making",
    points: ["Production planning", "Content production", "Execution and delivery"],
    line: "We build the team and approach around the project.",
  },
  {
    no: "02",
    name: "Partnership",
    points: ["Creative team extension", "Ongoing collaboration", "Long-term relationships"],
    line: "We develop a shared understanding that grows over time.",
  },
] as const;

export default function Files() {
  const reduce = !!useReducedMotion();
  const t = (delay: number, duration = 1.1, ease: readonly number[] = EASE) =>
    reduce ? { duration: 0 } : { delay, duration, ease: ease as [number, number, number, number] };

  return (
    <div className={s.how}>
      <h2 className={s.label}>How we work</h2>
      <div className={s.files}>
        {PILLARS.map((p, k) => (
          <motion.article
            key={p.name}
            className={s.file}
            style={{ ["--tab" as string]: k ? 0.62 : 0.06 }}
            // the file sets everything in it going at once, as it comes into view
            initial="hidden"
            whileInView="shown"
            viewport={{ once: true, amount: 0.3 }}
            variants={{
              hidden: { y: 120, opacity: 0 },
              shown: { y: 0, opacity: 1, transition: t(0.1 + k * 0.14, 1.2, EASE_CINE) },
            }}
          >
            <span className={s.stock} aria-hidden="true" />
            <span className={s.tab}>
              <span className={s.tabNo}>{p.no}</span>
              <span>{p.name}</span>
            </span>

            <div className={s.body}>
              <h3 className={s.name}>
                <span className={s.mask}>
                  <motion.span
                    className={s.nameIn}
                    variants={{ hidden: { y: "105%" }, shown: { y: 0, transition: t(0.45 + k * 0.14) } }}
                  >
                    {p.name}
                  </motion.span>
                </span>
              </h3>
              <ul className={s.points}>
                {p.points.map((point, i) => (
                  <motion.li
                    key={point}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      shown: { opacity: 1, y: 0, transition: t(0.7 + k * 0.14 + i * 0.08, 0.9) },
                    }}
                  >
                    <i>{String(i + 1).padStart(2, "0")}</i>
                    {point}
                  </motion.li>
                ))}
              </ul>
              <motion.p
                className={s.line}
                variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: t(1 + k * 0.14, 1) } }}
              >
                {p.line}
              </motion.p>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
