"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { EASE } from "../work/_shared/chrome";
import { stillFor } from "../work/_shared/data";
import { Card, FullCard, catFeature, filmFeature, type Rect } from "../work/beyond-card";
import { BeyondShell, CATS, pad2, useSteps } from "../work/beyond-shell";
import s from "./beyond3.module.css";

// ===========================================================================
// BEYOND 3 — THE LIGHT TABLE, on black. The categories laid out as five
// small cards in the reference's cinematic style, three over two, each its
// first film under its name and its count; pointed at, one plays and lifts
// as the rest fall back. Click one and that card grows into the screen — the
// card itself, moving from its place to the middle — while the others clear
// away: the viewing room, after the reference's — the categories across the
// head as tabs with their counts, the card on show inside four corners, the
// category's films as a strip at the foot with your place beside it. The
// wheel, the arrows or the strip move along; Explore opens a film to the
// whole screen; a tab goes to another category; All (or Esc) puts the card
// back in its place on the table.
// ===========================================================================

type Show = { at: number; turn: number; dir: number };

export default function BeyondThree() {
  const reduce = !!useReducedMotion();
  const [cat, setCat] = useState<number | null>(null);
  const leave = useCallback(() => setCat(null), []);
  return (
    <BeyondShell className={s.page} onBack={cat !== null ? leave : undefined}>
      <LayoutGroup>
        <AnimatePresence>{cat === null && <Table key="table" reduce={reduce} onOpen={setCat} />}</AnimatePresence>
        <AnimatePresence>{cat !== null && <Room key="room" cat={cat} reduce={reduce} onCat={setCat} onLeave={leave} />}</AnimatePresence>
      </LayoutGroup>
    </BeyondShell>
  );
}

/** The categories as five small cards, laid out on the table. */
function Table({ reduce, onOpen }: { reduce: boolean; onOpen: (i: number) => void }) {
  const [on, setOn] = useState<number | null>(null);
  return (
    <motion.section className={s.table} aria-label="Beyond — the categories" exit={{ transition: { duration: 0.8 } }}>
      <motion.header className={s.tableHead} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: EASE }}>
        <p className={s.kicker}>
          <span>03</span> Beyond
        </p>
        <p className={s.lede}>Five ways in. Choose one.</p>
      </motion.header>
      <ul className={s.cards} onPointerLeave={() => setOn(null)}>
        {CATS.map((c) => (
          <li key={c.name} className={s.slot}>
            <motion.div
              layoutId={`box-${c.i}`}
              className={`${s.poster} ${on === c.i ? s.posterOn : ""} ${on !== null && on !== c.i ? s.posterBack : ""}`}
              initial={reduce ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.35 } }}
              transition={{ duration: 0.9, ease: EASE, delay: c.i * 0.07, layout: { duration: 0.85, ease: EASE } }}
              onPointerEnter={(e) => e.pointerType === "mouse" && setOn(c.i)}
              onClick={() => onOpen(c.i)}
              role="button"
              tabIndex={0}
              aria-label={`${c.name}: ${c.films.length} films`}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(c.i))}
            >
              <Card feature={catFeature(c.i)} turn={0} dir={1} reduce={reduce} still={on !== c.i} />
            </motion.div>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}

/** The viewing room: a category's films, the card it was opened from grown into the middle. */
function Room({ cat, reduce, onCat, onLeave }: { cat: number; reduce: boolean; onCat: (i: number) => void; onLeave: () => void }) {
  const films = CATS[cat].films;
  const n = films.length;
  const [show, setShow] = useState<Show>({ at: 0, turn: 0, dir: 1 });
  const { at, turn, dir } = show;
  const [full, setFull] = useState<Rect | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // another category: from its first film
  const [was, setWas] = useState(cat);
  if (was !== cat) {
    setWas(cat);
    setShow((v) => ({ at: 0, turn: v.turn + 1, dir: 1 }));
  }
  const go = useCallback((to: number) => setShow((v) => (to === v.at || to < 0 || to >= n ? v : { at: to, turn: v.turn + 1, dir: to > v.at ? 1 : -1 })), [n]);
  useSteps(!full, (d) => go(at + d));
  useEffect(() => {
    if (full) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onLeave();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [full, onLeave]);
  const feature = filmFeature(films[at]);

  return (
    <motion.section className={s.room} aria-label={`${CATS[cat].name}: the films`}>
      {/* across the head: All, and the categories as tabs with their counts */}
      <motion.nav
        className={s.tabs}
        aria-label="Categories"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay: 0.45 } }}
        exit={{ opacity: 0, transition: { duration: 0.25 } }}
      >
        <button type="button" className={s.all} onClick={onLeave}>
          <i aria-hidden="true">←</i> All
        </button>
        <ol>
          {CATS.map((c) => (
            <li key={c.name}>
              <button type="button" className={c.i === cat ? s.tabOn : undefined} onClick={() => onCat(c.i)} aria-current={c.i === cat || undefined}>
                {c.name}
                <i>{c.films.length}</i>
              </button>
            </li>
          ))}
        </ol>
      </motion.nav>

      {/* in the middle: the card, grown from the table, inside four corners */}
      <div className={s.stage}>
        <motion.span className={s.corners} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.6 } }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          <i />
          <i />
          <i />
          <i />
        </motion.span>
        <motion.div
          key={cat}
          ref={boxRef}
          layoutId={`box-${cat}`}
          className={s.screen}
          style={{ visibility: full ? "hidden" : undefined }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ layout: { duration: 0.85, ease: EASE } }}
        >
          <Card
            feature={feature}
            turn={turn}
            dir={dir}
            reduce={reduce}
            onAct={() => {
              const r = boxRef.current?.getBoundingClientRect();
              if (r) setFull({ top: r.top, left: r.left, width: r.width, height: r.height });
            }}
          />
        </motion.div>
      </div>

      {/* at the foot: the films as a strip, and your place */}
      <motion.div
        className={s.foot}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay: 0.55 } }}
        exit={{ opacity: 0, transition: { duration: 0.25 } }}
      >
        <p className={s.count} aria-live="polite">
          <b>{pad2(at + 1)}</b>
          <i aria-hidden="true" />
          {pad2(n)}
        </p>
        <ol className={s.strip} aria-label="Films">
          {films.map((f, k) => (
            <li key={f.clip}>
              <button type="button" className={k === at ? s.thumbOn : undefined} onClick={() => go(k)} aria-label={f.title}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillFor(f.clip)} alt="" draggable={false} />
                <span>{f.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </motion.div>

      <AnimatePresence>
        {full && <FullCard key="full" from={full} feature={feature} turn={turn} dir={dir} reduce={reduce} dark onClose={() => setFull(null)} onStep={(d) => go(at + d)} />}
      </AnimatePresence>
    </motion.section>
  );
}
