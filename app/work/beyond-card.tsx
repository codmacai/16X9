"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { EASE, EASE_CINE } from "./_shared/chrome";
import { BEYOND_CATEGORIES, stillFor, type BeyondFilm } from "./_shared/data";
import { startMuted } from "./brand-shared";
import s from "./beyond.module.css";

// Beyond's film card (the work page, beyond.tsx, and its variants /beyond1–3): the film the whole
// card, and on it its year and kind, its tags, its name over a table of what it was, and what the
// studio did; and the same card opened to the whole screen. Inside, everything is sized to the card
// itself, so it can stand at any size in a box that gives it one.

const pad2 = (n: number) => String(n).padStart(2, "0");

// the next film comes up over the last from below (back: from above)
const CUT = { duration: 0.95, ease: EASE_CINE };
const WIPE: Variants = {
  from: (d: number) => ({ clipPath: d > 0 ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 100% 0%)" }),
  on: { clipPath: "inset(0% 0% 0% 0%)", transition: CUT },
  gone: { opacity: 1, transition: { duration: CUT.duration } },
};
const WORDS: Variants = {
  from: { opacity: 0, y: 14 },
  on: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay: 0.25 } },
  gone: { opacity: 0, y: -10, transition: { duration: 0.3, ease: EASE } },
};

export type Rect = { top: number; left: number; width: number; height: number };

/** A film as a card: the film the whole card, and on it its year and kind, its tags, its name over
 *  a table of what it was, and what the studio did. The same card, larger, opens to the screen. */
export function Card({
  film,
  turn,
  dir,
  reduce,
  full = false,
  still = false,
  onExplore,
  onClose,
}: {
  film: BeyondFilm;
  turn: number;
  dir: number;
  reduce: boolean;
  full?: boolean;
  /** its still only, no film running (a card waiting in a row) */
  still?: boolean;
  onExplore?: () => void;
  onClose?: () => void;
}) {
  const cat = BEYOND_CATEGORIES[film.cat];
  return (
    <article className={`${s.card} ${full ? s.cardFull : ""}`} aria-label={`${film.title} — ${cat.name}, ${film.year}`}>
      {/* the film, the next coming up over the last */}
      <div className={s.film} aria-hidden="true">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div key={turn} className={s.shot} style={{ zIndex: turn }} custom={dir} variants={WIPE} initial="from" animate="on" exit="gone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stillFor(film.clip)} alt="" draggable={false} />
            {!reduce && !still && <video ref={startMuted} src={film.clip} muted autoPlay playsInline loop preload="auto" />}
          </motion.div>
        </AnimatePresence>
      </div>
      <i className={s.grade} aria-hidden="true" />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={turn} className={s.words} variants={WORDS} initial="from" animate="on" exit="gone">
          {/* at its head: the year and the kind; across from them, its tags */}
          <p className={s.year}>
            <b>{film.year}</b>
            {cat.name}
          </p>
          <p className={s.tags}>
            <span>{cat.short}</span>
            <span>{film.year}</span>
            <span>2.39 : 1</span>
          </p>

          {/* down its side: what the studio did */}
          <ol className={s.did}>
            {cat.did.map((d, i) => (
              <li key={d}>
                <i>{pad2(i + 1)} — What we did</i>
                <b>{d}</b>
              </li>
            ))}
          </ol>

          {/* at its foot: its name, over a table of what it was */}
          <div className={s.foot}>
            {film.demo && <span className={s.demo}>Demo film</span>}
            <h2 className={s.title}>{film.title}</h2>
            <dl className={s.table}>
              <div>
                <dt>Category</dt>
                <dd>{cat.name}</dd>
              </div>
              <div>
                <dt>Year</dt>
                <dd>{film.year}</dd>
              </div>
              <div>
                <dt>Frame</dt>
                <dd>2.39 : 1</dd>
              </div>
            </dl>
            {full && <p className={s.line}>{film.line}</p>}
          </div>
        </motion.div>
      </AnimatePresence>

      {full ? (
        <button type="button" className={s.act} onClick={onClose}>
          Close <i aria-hidden="true">×</i>
        </button>
      ) : onExplore ? (
        <button type="button" className={s.act} onClick={onExplore}>
          Explore <i aria-hidden="true">→</i>
        </button>
      ) : null}
    </article>
  );
}

/** The card opened to the whole screen, from where it stood; Esc or Close puts it back. */
export function FullCard({
  from,
  film,
  turn,
  dir,
  reduce,
  dark = false,
  onClose,
  onStep,
}: {
  from: Rect;
  film: BeyondFilm;
  turn: number;
  dir: number;
  reduce: boolean;
  /** over a black page: the screen round it goes dark, not paper */
  dark?: boolean;
  onClose: () => void;
  onStep: (d: number) => void;
}) {
  const [to] = useState(() => {
    const m = window.innerWidth < 760 ? 8 : 14;
    return { top: m, left: m, width: window.innerWidth - m * 2, height: window.innerHeight - m * 2 };
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") onStep(1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, onStep]);
  const move = reduce ? { duration: 0 } : { duration: 0.85, ease: EASE_CINE };
  return (
    <motion.div className={`${s.full} ${dark ? s.fullDark : ""}`} role="dialog" aria-modal="true" aria-label={film.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.3 } }}>
      <motion.div className={s.fullBox} initial={from} animate={to} exit={{ ...from, transition: move }} transition={move}>
        <Card film={film} turn={turn} dir={dir} reduce={reduce} full onClose={onClose} />
      </motion.div>
    </motion.div>
  );
}
