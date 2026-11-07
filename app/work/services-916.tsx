"use client";

import { useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { SERVICES_9X16 } from "./_shared/data";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts, in one of two looks:
//
// Tiles (the default): the services as small lit tiles, three across and two
// down (two across on a phone), each 9:16 — the shape we make for — and lit a warm white like Beyond's
// tile, in ink, as a museum's label is: "Service" and a small 9:16 frame at
// its head, and at its foot its name, large, a hairline and what it covers.
// No numbers. Each opens from a line across its middle as it comes into view.
// Pointed at, a tile lifts, the hairline draws across in ink and the frame's
// corners close round it.
//
// Grid (?services=grid): the services as one black-and-white grid, three by
// two, paper and ink in turn like a chessboard, edge to edge inside a hairline.
// In each, "Service" and a small 9:16 frame at its head, its name large in the
// middle, what it covers at its foot; no numbers. The paper and ink stay as
// they are; pointed at (on a phone, scrolled to the middle), the frame's
// corners close in round a cell's name and what it covers comes up clear.
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
  const grid = useSearchParams().get("services") === "grid";
  return (
    <section className={s.services} aria-labelledby="services-title">
      <SectionLabel no="02" id="services-title" reduce={reduce}>
        Our services
      </SectionLabel>
      {grid ? <Grid reduce={reduce} /> : <Tiles reduce={reduce} />}
    </section>
  );
}

/** the frame's corners, closing round what's pointed at */
function Corners({ className }: { className: string }) {
  return (
    <i className={className} aria-hidden="true">
      <b />
      <b />
      <b />
      <b />
    </i>
  );
}

// ---------------------------------------------------------------------------
// Tiles: lit 9:16 tiles, three across, two down
function Tiles({ reduce }: { reduce: boolean }) {
  return (
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
            <Corners className={s.corners} />
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
                <ul className={s.tags}>
                  {sv.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </motion.div>
            </motion.article>
          </motion.li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Grid: one black-and-white grid, three by two, paper and ink in turn
function Grid({ reduce }: { reduce: boolean }) {
  const [on, setOn] = useState<number | null>(null);
  const ref = useRef<HTMLUListElement>(null);

  // no pointer to point with: the cells in the middle of the screen turn over
  useEffect(() => {
    const list = ref.current;
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
    <motion.ul
      ref={ref}
      className={s.board}
      initial={reduce ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, amount: 0.2 }}
      onPointerLeave={() => setOn(null)}
    >
      {SERVICES_9X16.map((sv, i) => {
        const d = ((i % 3) + Math.floor(i / 3)) * 0.1;
        return (
          <motion.li
            key={sv.name.join(" ")}
            className={`${s.cell} ${on === i ? s.cellOn : ""}`}
            custom={d}
            variants={OPEN}
            onPointerEnter={(e) => e.pointerType === "mouse" && setOn(i)}
          >
            <motion.div className={s.face} custom={d} variants={INNER}>
              <header className={s.cellHead}>
                <span className={s.cellLabel}>Service</span>
                <i className={s.glyph} />
              </header>
              <h3 className={s.cellName}>
                {sv.name.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </h3>
              <p className={s.cellTags}>{sv.tags.join("  ·  ")}</p>
              <Corners className={s.cellCorners} />
            </motion.div>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
