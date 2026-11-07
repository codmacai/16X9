"use client";

import { motion } from "framer-motion";
import { SERVICES_9X16 } from "./_shared/data";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services as cards, type
// only — no pictures. Each is a slab of the dark with a paper band across its
// head: "Service" and its number on the band, a small 9:16 frame at its end
// (the shape we make for); on the dark, the service's name set large in two
// lines, and what it covers small under it. Two to a row (one on a phone),
// each rising into place as it comes into view. Pointed at, a card lifts a
// little, its edge lights and a hairline draws out under its name.
// ===========================================================================

const RISE = { type: "spring", stiffness: 80, damping: 18, mass: 1 } as const;
const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Services916({ reduce }: { reduce: boolean }) {
  return (
    <section className={s.services} aria-labelledby="services-title">
      <SectionLabel no="02" id="services-title" reduce={reduce}>
        Our services
      </SectionLabel>
      <ul className={s.grid}>
        {SERVICES_9X16.map((sv, i) => (
          <motion.li
            key={sv.name.join(" ")}
            className={s.slot}
            initial={reduce ? false : { opacity: 0, y: 48 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...RISE, delay: (i % 2) * 0.1 }}
          >
            <article className={s.card}>
              <header className={s.tab}>
                <span>
                  Service <b>{pad2(i + 1)}</b>
                </span>
                <i className={s.glyph} aria-hidden="true" />
              </header>
              <div className={s.body}>
                <h3 className={s.name}>
                  {sv.name.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </h3>
                <i className={s.rule} aria-hidden="true" />
                <p className={s.tags}>{sv.tags.join("  ·  ")}</p>
              </div>
            </article>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
