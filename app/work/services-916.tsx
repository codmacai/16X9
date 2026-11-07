"use client";

import { useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { SERVICES_9X16 } from "./_shared/data";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services as cards, each a
// frame in the dark. A card opens from a line across its middle as it comes
// into view, as every frame on the site does; at its head its number and
// "Service" on a hairline, a small 9:16 frame at its end; at its foot the
// service's name large in a hairline outline, and what it covers. A soft
// light lies across its top, a fine grain over it. Pointed at (on a phone,
// scrolled to the middle of the screen), a card takes the light as a chosen
// word does: a light follows the pointer across it and along its edge, the
// name fills in paper, the frame's corners close round the card, a hairline
// draws along its foot, and the rest step back.
// ===========================================================================

const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const EASE = [0.16, 1, 0.3, 1] as const;
const pad2 = (n: number) => String(n).padStart(2, "0");

const OPEN: Variants = {
  hidden: { clipPath: "inset(50% 0% 50% 0%)" },
  shown: (i: number) => ({ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 1.2, ease: EASE_CINE, delay: (i % 3) * 0.12 } }),
};
const INNER: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 1, ease: EASE, delay: 0.55 + (i % 3) * 0.12 } }),
};

export default function Services916({ reduce }: { reduce: boolean }) {
  const [on, setOn] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // no pointer to point with: the card in the middle of the screen takes the light
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
      <ul ref={listRef} className={`${s.grid} ${on !== null ? s.gridOn : ""}`} onPointerLeave={() => setOn(null)}>
        {SERVICES_9X16.map((sv, i) => (
          // (watched from the slot: the card itself, shut to a line, has nothing in view to be seen by)
          <motion.li
            key={sv.name.join(" ")}
            className={`${s.slot} ${on === i ? s.on : ""}`}
            initial={reduce ? false : "hidden"}
            whileInView="shown"
            viewport={{ once: true, amount: 0.35 }}
          >
            {/* the frame's corners, closing round the card as it takes the light */}
            <i className={s.corners} aria-hidden="true">
              <b />
              <b />
              <b />
              <b />
            </i>
            <motion.article
              className={s.card}
              custom={i}
              variants={OPEN}
              onPointerEnter={(e) => e.pointerType === "mouse" && setOn(i)}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}
            >
              <motion.header className={s.head} custom={i} variants={INNER}>
                <span className={s.label}>
                  <span className={s.num}>{pad2(i + 1)}</span>
                  <i className={s.leader} aria-hidden="true" />
                  Service
                </span>
                <i className={s.glyph} aria-hidden="true" />
              </motion.header>
              <motion.div className={s.foot} custom={i} variants={INNER}>
                <h3 className={s.name}>
                  {sv.name.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </h3>
                <p className={s.tags}>
                  {sv.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </p>
              </motion.div>
              {/* a hairline drawing along its foot */}
              <i className={s.line} aria-hidden="true" />
            </motion.article>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
