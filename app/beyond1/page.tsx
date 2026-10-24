"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "../work/_shared/chrome";
import { stillFor } from "../work/_shared/data";
import { Card, FullCard, catFeature, filmFeature, type Rect } from "../work/beyond-card";
import { BeyondShell, CATS, pad2, useSteps } from "../work/beyond-shell";
import s from "./beyond1.module.css";

// ===========================================================================
// BEYOND 1 — THE DARK ROOM, after the reference's viewing room: one screen
// in the dark. Down the left, the categories, each with its count in a
// small box; in the middle, inside four corners, the card on show; down the
// right, a strip of every card, the one on show ringed, its place beside it.
// It opens on the categories: the card shows each category as a feature (its
// first film, its name, its films and years, what the studio does in it),
// the strip holds the five, and pointing along the list brings each up.
// Enter (or a category clicked) goes in: the strip turns to that category's
// films and the card to each film, its ticket now Explore, which opens it
// to the whole screen. The wheel and the arrows move along; All categories
// (or Esc) comes back out.
// ===========================================================================

type Show = { at: number; turn: number; dir: number };

export default function BeyondOne() {
  const reduce = !!useReducedMotion();
  // the category gone into (null: the categories), and the card on show
  const [cat, setCat] = useState<number | null>(null);
  const [show, setShow] = useState<Show>({ at: 0, turn: 0, dir: 1 });
  const { at, turn, dir } = show;
  const films = cat === null ? null : CATS[cat].films;
  const n = films ? films.length : CATS.length;
  const feature = films ? filmFeature(films[at]) : catFeature(at);
  const [full, setFull] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLOListElement>(null);

  const go = useCallback((to: number) => setShow((v) => (to === v.at || to < 0 || to >= n ? v : { at: to, turn: v.turn + 1, dir: to > v.at ? 1 : -1 })), [n]);
  const enter = (i: number) => {
    setCat(i);
    setShow((v) => ({ at: 0, turn: v.turn + 1, dir: 1 }));
  };
  const leave = useCallback(() => {
    setShow((v) => ({ at: cat ?? 0, turn: v.turn + 1, dir: -1 }));
    setCat(null);
  }, [cat]);
  useSteps(!full, (d) => go(at + d));
  useEffect(() => {
    if (full || cat === null) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && leave();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [full, cat, leave]);

  // the strip keeps the card on show in its middle (the strip alone scrolls)
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.children[at] as HTMLElement | undefined;
    if (!strip || !el) return;
    const across = strip.scrollWidth > strip.clientWidth + 1;
    strip.scrollTo({
      top: across ? 0 : el.offsetTop - (strip.clientHeight - el.offsetHeight) / 2,
      left: across ? el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2 : 0,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [at, cat, reduce]);

  const explore = () => {
    const r = cardRef.current?.getBoundingClientRect();
    if (r) setFull({ top: r.top, left: r.left, width: r.width, height: r.height });
  };
  const thumbs = films ? films.map((f) => ({ key: f.clip, clip: f.clip, label: f.title })) : CATS.map((c) => ({ key: c.name, clip: c.films[0].clip, label: c.name }));

  return (
    <BeyondShell className={s.page} onBack={cat !== null ? leave : undefined}>
      <div className={s.room}>
        {/* down the left: the categories, each with its count */}
        <nav className={s.cats} aria-label="Categories">
          <div className={s.top}>
            <AnimatePresence mode="wait" initial={false}>
              {cat === null ? (
                <motion.p key="k" className={s.kicker} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span>03</span> Beyond
                </motion.p>
              ) : (
                <motion.button key="b" type="button" className={s.back} onClick={leave} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <i aria-hidden="true">←</i> All categories
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <ol>
            {CATS.map((c) => {
              const lit = cat === null ? at === c.i : cat === c.i;
              return (
                <motion.li key={c.name} initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.3 + c.i * 0.06 }}>
                  <button
                    type="button"
                    className={`${lit ? s.catOn : ""} ${cat !== null && !lit ? s.catBack : ""}`}
                    onPointerEnter={(e) => cat === null && e.pointerType === "mouse" && go(c.i)}
                    onClick={() => (cat === c.i ? undefined : enter(c.i))}
                    aria-current={cat === c.i || undefined}
                  >
                    {c.name}
                    <i>{c.films.length}</i>
                  </button>
                </motion.li>
              );
            })}
          </ol>
        </nav>

        {/* in the middle: the card on show, inside four corners */}
        <motion.div className={s.stage} initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}>
          <span className={s.corners} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div ref={cardRef} className={s.cardBox} style={{ visibility: full ? "hidden" : undefined }}>
            <Card feature={feature} turn={turn} dir={dir} reduce={reduce} act={cat === null ? "Enter" : "Explore"} onAct={cat === null ? () => enter(at) : explore} />
          </div>
        </motion.div>

        {/* down the right: its place, and the strip */}
        <div className={s.side}>
          <p className={s.count} aria-live="polite">
            <b>{pad2(at + 1)}</b>
            <i aria-hidden="true" />
            {pad2(n)}
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={cat ?? "cats"}
              ref={stripRef}
              className={s.strip}
              aria-label={cat === null ? "Categories" : "Films"}
              initial="out"
              animate="in"
              exit="out"
              variants={{ out: { opacity: 0, transition: { duration: 0.25 } }, in: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
            >
              {thumbs.map((t, i) => (
                <motion.li key={t.key} variants={{ out: { opacity: 0, x: 24 }, in: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}>
                  <button type="button" className={i === at ? s.thumbOn : undefined} onClick={() => (cat === null && i === at ? enter(i) : go(i))} aria-label={t.label}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stillFor(t.clip)} alt="" loading="lazy" draggable={false} />
                  </button>
                </motion.li>
              ))}
            </motion.ol>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {full && films && (
          <FullCard key="full" from={full} feature={feature} turn={turn} dir={dir} reduce={reduce} dark onClose={() => setFull(null)} onStep={(d) => go(at + d)} />
        )}
      </AnimatePresence>
    </BeyondShell>
  );
}
