"use client";

import { motion, type Variants } from "framer-motion";
import { SERVICES_9X16 } from "./_shared/data";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services as small lit
// cards, three across and two down, their row as wide as the accounts' above;
// each lit a warm white like Beyond's tile, in ink, as a museum's label is:
// "Service" and a small 9:16 frame — the shape we make for — at its head, and
// at its foot its name, a hairline and what it covers, on one line. No
// numbers. Each opens from a line across its middle as it comes into view.
// Pointed at, a card lifts, the hairline draws across in ink and the frame's
// corners close round it.
// ===========================================================================

const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const EASE = [0.16, 1, 0.3, 1] as const;

const OPEN: Variants = {
  hidden: { clipPath: "inset(50% 0% 50% 0%)" },
  shown: (d: number) => ({ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 1.2, ease: EASE_CINE, delay: d } }),
};
const INNER: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: (d: number) => ({ opacity: 1, y: 0, transition: { duration: 1, ease: EASE, delay: 0.55 + d } }),
};

export default function Services916({ reduce }: { reduce: boolean }) {
  return (
    <section className={s.services} aria-labelledby="services-title">
      <SectionLabel no="02" id="services-title" reduce={reduce}>
        Our services
      </SectionLabel>
      <ul className={s.tiles}>
        {SERVICES_9X16.map((sv, i) => {
          const d = (i % 3) * 0.1 + Math.floor(i / 3) * 0.08;
          return (
            // (watched from the slot: the tile itself, shut to a line, has nothing in view to be seen by)
            <motion.li
              key={sv.name.join(" ")}
              className={s.slot}
              initial={reduce ? false : "hidden"}
              whileInView="shown"
              viewport={{ once: true, amount: 0.3 }}
            >
              {/* the frame's corners, closing round the tile as it's pointed at */}
              <i className={s.corners} aria-hidden="true">
                <b />
                <b />
                <b />
                <b />
              </i>
              <motion.article className={s.tile} custom={d} variants={OPEN}>
                <motion.header className={s.head} custom={d} variants={INNER}>
                  <span>Service</span>
                  <i className={s.glyph} aria-hidden="true" />
                </motion.header>
                <motion.div className={s.foot} custom={d} variants={INNER}>
                  <h3 className={s.name}>
                    {sv.name.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h3>
                  {/* a hairline over what it covers, drawing across in ink when it's pointed at */}
                  <i className={s.rule} aria-hidden="true" />
                  <p className={s.tags}>
                    {sv.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </p>
                </motion.div>
              </motion.article>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
