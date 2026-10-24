"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { EASE, EASE_CINE } from "./_shared/chrome";
import { BEYOND_CATEGORIES, BEYOND_FILMS, stillFor, type BeyondFilm } from "./_shared/data";
import { startMuted } from "./brand-shared";
import s from "./beyond-card.module.css";

// ===========================================================================
// BEYOND's card — a film (or a category) set as a feature, after the
// reference's cinematic card. The film the whole card, in a dark gate with a
// little grain. At its head, the year with the kind stacked under it and the
// studio's name; hanging from its top edge, a paper ticket strip (kind | year
// | frame) with its stub torn off. Down its side, what the studio did, each a
// line in the acclaim style. At its foot, the name, large and heavy, over a
// ruled table of what it was; across from it, a ticket for a button
// (Explore | →). It can carry a Scroll ring by its name where the page
// scrolls through cards. Everything inside is sized to the card itself
// (cqw), so it stands at any size; small cards keep only the name.
// Used by the work page's Beyond (beyond.tsx) and /beyond1–3.
// ===========================================================================

const pad2 = (n: number) => String(n).padStart(2, "0");

/** What a card shows: a film's, or a category's. */
export type Feature = {
  key: string;
  clip: string;
  title: string;
  year: string;
  kind: string;
  tags: string[];
  table: [string, string][];
  did: string[];
  line?: string;
  note?: string;
};

export function filmFeature(f: BeyondFilm): Feature {
  const c = BEYOND_CATEGORIES[f.cat];
  return {
    key: f.clip,
    clip: f.clip,
    title: f.title,
    year: f.year,
    kind: c.name,
    tags: [c.short, f.year, "2.39 : 1"],
    table: [
      ["Category", c.name],
      ["Year", f.year],
      ["Frame", "2.39 : 1"],
    ],
    did: c.did,
    line: f.line,
    note: f.demo ? "Demo film" : undefined,
  };
}

export function catFeature(i: number): Feature {
  const c = BEYOND_CATEGORIES[i];
  const films = BEYOND_FILMS.filter((f) => f.cat === i);
  const years = [...new Set(films.map((f) => f.year))].sort();
  const span = years.length > 1 ? `${years[0]}—${years[years.length - 1].slice(2)}` : years[0];
  return {
    key: c.name,
    clip: films[0].clip,
    title: c.name,
    year: span,
    kind: `Beyond — ${pad2(i + 1)}`,
    tags: [c.short, `${pad2(films.length)} films`, span],
    table: [
      ["Films", pad2(films.length)],
      ["Years", span],
      ["Frame", "2.39 : 1"],
    ],
    did: c.did,
  };
}

// the next comes up over the last from below (back: from above)
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

export function Card({
  feature: f,
  turn,
  dir,
  reduce,
  full = false,
  still = false,
  bare = false,
  scroll = false,
  act = "Explore",
  onAct,
  onClose,
}: {
  feature: Feature;
  /** every change counted: each is a new layer over the last */
  turn: number;
  dir: number;
  reduce: boolean;
  /** opened to the whole screen: with its line, and Close */
  full?: boolean;
  /** its still only, no film running (a card waiting) */
  still?: boolean;
  /** the film alone, the words gone */
  bare?: boolean;
  /** a Scroll ring by its name, where the page scrolls through cards */
  scroll?: boolean;
  /** the ticket's word */
  act?: string;
  onAct?: () => void;
  onClose?: () => void;
}) {
  return (
    <article className={`${s.card} ${full ? s.cardFull : ""}`} aria-label={`${f.title} — ${f.kind}, ${f.year}`}>
      {/* the film, the next coming up over the last */}
      <div className={s.film} aria-hidden="true">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div key={turn} className={s.shot} style={{ zIndex: turn }} custom={dir} variants={WIPE} initial="from" animate="on" exit="gone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stillFor(f.clip)} alt="" draggable={false} />
            {!reduce && !still && <video ref={startMuted} src={f.clip} muted autoPlay playsInline loop preload="auto" />}
          </motion.div>
        </AnimatePresence>
      </div>
      <i className={`${s.grade} ${bare ? s.gradeBare : ""}`} aria-hidden="true" />

      <AnimatePresence mode="wait" initial={false}>
        {!bare && (
          <motion.div key={turn} className={s.words} variants={WORDS} initial="from" animate="on" exit="gone">
            {/* at its head: the year, the kind stacked under it, the studio */}
            <div className={s.head}>
              <b className={s.year}>{f.year}</b>
              <span className={s.kind}>{f.kind}</span>
              <span className={s.mark}>16x9 &amp; Beyond</span>
            </div>

            {/* from its top edge: the ticket strip, its stub torn off */}
            <p className={s.ticket}>
              {f.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
              <i aria-hidden="true" />
            </p>

            {/* down its side: what the studio did, in the acclaim style */}
            <ol className={s.did}>
              {f.did.map((d, i) => (
                <li key={d}>
                  <i aria-hidden="true" />
                  <span>{pad2(i + 1)} — What we did</span>
                  <b>{d}</b>
                </li>
              ))}
            </ol>

            {/* at its foot: the name, over a ruled table */}
            <div className={s.foot}>
              {scroll && (
                <span className={s.scroll} aria-hidden="true">
                  Scroll
                </span>
              )}
              {f.note && <span className={s.note}>{f.note}</span>}
              <h2 className={s.title}>{f.title}</h2>
              <dl className={s.table}>
                {f.table.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              {full && f.line && <p className={s.line}>{f.line}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the ticket for a button */}
      {(full || bare ? onClose : onAct) && (
        <button type="button" className={s.act} onClick={full || bare ? onClose : onAct}>
          <svg viewBox="0 0 130 42" preserveAspectRatio="none" aria-hidden="true">
            <path d="M4 .5H90A4 4 0 0 0 98 .5H126Q129.5 .5 129.5 4V38Q129.5 41.5 126 41.5H98A4 4 0 0 0 90 41.5H4Q.5 41.5 .5 38V4Q.5 .5 4 .5Z" />
            <path d="M94 7V35" strokeDasharray="2 3" />
          </svg>
          <span>{full || bare ? "Close" : act}</span>
          <i aria-hidden="true">{full || bare ? "×" : "→"}</i>
        </button>
      )}
    </article>
  );
}

/** The card opened to the whole screen, from where it stood; Esc or Close puts it back. */
export function FullCard({
  from,
  feature,
  turn,
  dir,
  reduce,
  dark = false,
  onClose,
  onStep,
}: {
  from: Rect;
  feature: Feature;
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
    <motion.div
      className={`${s.full} ${dark ? s.fullDark : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={feature.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.3 } }}
    >
      <motion.div className={s.fullBox} initial={from} animate={to} exit={{ ...from, transition: move }} transition={move}>
        <Card feature={feature} turn={turn} dir={dir} reduce={reduce} full onClose={onClose} />
      </motion.div>
    </motion.div>
  );
}
