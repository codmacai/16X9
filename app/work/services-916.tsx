"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { SERVICES_9X16 } from "./_shared/data";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services as lit tiles on a
// rail, each one 9:16 — the shape we make for — and lit a warm white like
// Beyond's tile, in ink, as a museum's label is: "Service" and its number at
// its head; its number large in a hairline outline; at its foot its name, a
// hairline, and what it covers. Each opens from a line across its middle as it
// comes into view. The rail runs on past the page's edge: swipe or drag it,
// or step it on with the arrows under it, beside the count and a hairline
// that fills as it goes. Pointed at, a tile lifts, its number fills in ink and
// the frame's corners close round it.
// ===========================================================================

const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const EASE = [0.16, 1, 0.3, 1] as const;
const N = SERVICES_9X16.length;
const pad2 = (n: number) => String(n).padStart(2, "0");

const OPEN: Variants = {
  hidden: { clipPath: "inset(50% 0% 50% 0%)" },
  shown: (i: number) => ({ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 1.2, ease: EASE_CINE, delay: Math.min(i, 4) * 0.1 } }),
};
const INNER: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 1, ease: EASE, delay: 0.55 + Math.min(i, 4) * 0.1 } }),
};

export default function Services916({ reduce }: { reduce: boolean }) {
  const railRef = useRef<HTMLUListElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [at, setAt] = useState(0);

  // where the rail is: the tile at its start, and the hairline under it filled as far as it's gone
  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const first = rail.children[0] as HTMLElement | undefined;
    const step = first ? first.offsetWidth + parseFloat(getComputedStyle(rail).columnGap || "0") : 1;
    const max = rail.scrollWidth - rail.clientWidth;
    setAt(Math.min(N - 1, Math.round(rail.scrollLeft / step)));
    barRef.current?.style.setProperty("--p", String(max > 0 ? rail.scrollLeft / max : 1));
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const stepBy = (d: number) => {
    const rail = railRef.current;
    const first = rail?.children[0] as HTMLElement | undefined;
    if (!rail || !first) return;
    const step = first.offsetWidth + parseFloat(getComputedStyle(rail).columnGap || "0");
    rail.scrollBy({ left: d * step, behavior: reduce ? "auto" : "smooth" });
  };

  // dragged with the mouse, as it's swiped on a phone
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  return (
    <section className={s.services} aria-labelledby="services-title">
      <SectionLabel no="02" id="services-title" reduce={reduce}>
        Our services
      </SectionLabel>
      <ul
        ref={railRef}
        className={s.rail}
        onScroll={measure}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false };
          e.currentTarget.dataset.drag = "";
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 4) d.moved = true;
          e.currentTarget.scrollLeft = d.left - dx;
        }}
        onPointerUp={(e) => {
          drag.current = null;
          delete e.currentTarget.dataset.drag;
        }}
        onPointerLeave={(e) => {
          drag.current = null;
          delete e.currentTarget.dataset.drag;
        }}
      >
        {SERVICES_9X16.map((sv, i) => (
          // (watched from the slot: the tile itself, shut to a line, has nothing in view to be seen by)
          <motion.li
            key={sv.name.join(" ")}
            className={s.slot}
            initial={reduce ? false : "hidden"}
            whileInView="shown"
            viewport={{ once: true, amount: 0.3 }}
          >
            <i className={s.corners} aria-hidden="true">
              <b />
              <b />
              <b />
              <b />
            </i>
            <motion.article className={s.tile} custom={i} variants={OPEN}>
              <motion.header className={s.head} custom={i} variants={INNER}>
                <span>Service</span>
                <span className={s.count}>
                  {pad2(i + 1)} <i>/ {pad2(N)}</i>
                </span>
              </motion.header>
              <motion.span className={s.big} custom={i} variants={INNER} aria-hidden="true">
                {pad2(i + 1)}
              </motion.span>
              <motion.div className={s.foot} custom={i} variants={INNER}>
                <h3 className={s.name}>
                  {sv.name.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </h3>
                <ul className={s.tags}>
                  {sv.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </motion.div>
            </motion.article>
          </motion.li>
        ))}
      </ul>

      {/* under the rail: the count, a hairline filling as it goes, and the arrows */}
      <div className={s.bar}>
        <span className={s.at}>
          {pad2(at + 1)} <i>/ {pad2(N)}</i>
        </span>
        <i ref={barRef} className={s.track} aria-hidden="true" />
        <span className={s.arrows}>
          <button type="button" className={s.arrow} onClick={() => stepBy(-1)} aria-label="The last service">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
          <button type="button" className={s.arrow} onClick={() => stepBy(1)} aria-label="The next service">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
        </span>
      </div>
    </section>
  );
}
