"use client";

import { useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { SERVICES_9X16 } from "./_shared/data";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services as an index, in
// the line of words' own language. Each is a row across the page — its number,
// its name large in a hairline outline, what it covers at its end — between
// hairlines that draw across as they come into view, the name rising after.
// Pointed at (on a phone, scrolled to the middle of the screen), a row takes
// the light as a chosen word does: its name fills in paper, the frame's corners
// close round it, and the rest step back.
// ===========================================================================

const EASE = [0.16, 1, 0.3, 1] as const;
const pad2 = (n: number) => String(n).padStart(2, "0");

const ROW: Variants = { hidden: {}, shown: {} };
const RULE: Variants = { hidden: { scaleX: 0 }, shown: { scaleX: 1, transition: { duration: 1.2, ease: EASE } } };
const RISE: Variants = { hidden: { y: "105%" }, shown: { y: "0%", transition: { duration: 1.1, ease: EASE, delay: 0.15 } } };
const FADE: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.9, ease: "easeOut", delay: 0.45 } } };

export default function Services916({ reduce }: { reduce: boolean }) {
  const [on, setOn] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // no pointer to point with: the row in the middle of the screen takes the light
  useEffect(() => {
    const list = listRef.current;
    if (!list || !window.matchMedia("(hover: none)").matches) return;
    const items = [...list.children];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = items.indexOf(e.target);
          setOn((cur) => (e.isIntersecting ? i : cur === i ? null : cur));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className={s.services} aria-labelledby="services-title">
      <SectionLabel no="02" id="services-title" reduce={reduce}>
        Our services
      </SectionLabel>
      <ol ref={listRef} className={`${s.list} ${on !== null ? s.listOn : ""}`} onPointerLeave={() => setOn(null)}>
        {SERVICES_9X16.map((sv, i) => (
          <motion.li
            key={sv.name.join(" ")}
            className={`${s.row} ${on === i ? s.on : ""}`}
            variants={ROW}
            initial={reduce ? false : "hidden"}
            whileInView="shown"
            viewport={{ once: true, amount: 0.4 }}
            onPointerEnter={(e) => e.pointerType === "mouse" && setOn(i)}
          >
            <motion.i className={s.rule} variants={RULE} aria-hidden="true" />
            <motion.span className={s.num} variants={FADE}>
              {pad2(i + 1)}
            </motion.span>
            <h3 className={s.name}>
              <span className={s.mask}>
                <motion.span className={s.word} variants={RISE}>
                  {sv.name.join(" ")}
                  {/* the frame's corners, closing round the name as it takes the light */}
                  <i className={s.corners} aria-hidden="true">
                    <b />
                    <b />
                    <b />
                    <b />
                  </i>
                </motion.span>
              </span>
            </h3>
            <motion.span className={s.tags} variants={FADE}>
              {sv.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </motion.span>
          </motion.li>
        ))}
        <motion.li className={s.end} variants={ROW} initial={reduce ? false : "hidden"} whileInView="shown" viewport={{ once: true }} aria-hidden="true">
          <motion.i className={s.rule} variants={RULE} />
        </motion.li>
      </ol>
    </section>
  );
}
