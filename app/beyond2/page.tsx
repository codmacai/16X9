"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "../work/_shared/chrome";
import { stillFor } from "../work/_shared/data";
import { Card, catFeature, filmFeature } from "../work/beyond-card";
import { BeyondShell, CATS, pad2, useSteps } from "../work/beyond-shell";
import s from "./beyond2.module.css";

// ===========================================================================
// BEYOND 2 — THE FEATURE, after the reference's cinematic card, at the size
// of the screen. Each category is a feature, one after another: its first
// film the whole card, its name large over a table of its films and years,
// what the studio does in it down the side, the paper ticket strip from the
// top edge, a Scroll ring by the name — the wheel, the arrows or a swipe
// bring up the next, wiping up over the last; numbers at the card's head
// keep your place. The ticket (Enter) goes in: the same card now runs
// through that category's films, with a strip of them at its foot; their
// ticket (Explore) clears the words away to leave the film alone (Close puts
// them back). ← Categories (or Esc) comes back out.
// ===========================================================================

type Show = { at: number; turn: number; dir: number };

export default function BeyondTwo() {
  const reduce = !!useReducedMotion();
  const [cat, setCat] = useState<number | null>(null);
  const [show, setShow] = useState<Show>({ at: 0, turn: 0, dir: 1 });
  const [bare, setBare] = useState(false);
  const { at, turn, dir } = show;
  const films = cat === null ? null : CATS[cat].films;
  const n = films ? films.length : CATS.length;
  const feature = films ? filmFeature(films[at]) : catFeature(at);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback((to: number) => setShow((v) => (to === v.at || to < 0 || to >= n ? v : { at: to, turn: v.turn + 1, dir: to > v.at ? 1 : -1 })), [n]);
  const enter = (i: number) => {
    setCat(i);
    setShow((v) => ({ at: 0, turn: v.turn + 1, dir: 1 }));
  };
  const leave = useCallback(() => {
    setBare(false);
    setShow((v) => ({ at: cat ?? 0, turn: v.turn + 1, dir: -1 }));
    setCat(null);
  }, [cat]);
  useSteps(!bare, (d) => go(at + d));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (bare) setBare(false);
      else if (cat !== null) leave();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [bare, cat, leave]);

  return (
    <BeyondShell className={s.page} onBack={bare ? () => setBare(false) : cat !== null ? leave : undefined}>
      <motion.div
        className={s.frame}
        initial={reduce ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
        onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s0 = swipe.current;
          swipe.current = null;
          if (!s0 || bare) return;
          const dx = e.clientX - s0.x;
          const dy = e.clientY - s0.y;
          const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
          if (Math.abs(d) > 50) go(at + (d < 0 ? 1 : -1));
        }}
      >
        <Card
          feature={feature}
          turn={turn}
          dir={dir}
          reduce={reduce}
          bare={bare}
          scroll={!bare}
          act={cat === null ? "Enter" : "Explore"}
          onAct={cat === null ? () => enter(at) : () => setBare(true)}
          onClose={() => setBare(false)}
        />

        {/* at the card's head: where you are */}
        <AnimatePresence mode="wait">
          {!bare && (
            <motion.div key={cat ?? "cats"} className={s.rail} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              {cat === null ? (
                CATS.map((c) => (
                  <button key={c.name} type="button" className={c.i === at ? s.railOn : undefined} onClick={() => go(c.i)} aria-label={c.name}>
                    {pad2(c.i + 1)}
                  </button>
                ))
              ) : (
                <>
                  <button type="button" className={s.railBack} onClick={leave}>
                    <i aria-hidden="true">←</i> Categories
                  </button>
                  <span className={s.railName}>{CATS[cat].name}</span>
                  <span className={s.railCount}>
                    {pad2(at + 1)} / {pad2(n)}
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* in a category: its films, a strip at the foot */}
        <AnimatePresence>
          {films && !bare && (
            <motion.ol
              key={cat}
              className={s.thumbs}
              aria-label="Films"
              initial="out"
              animate="in"
              exit="out"
              variants={{ out: { opacity: 0, transition: { duration: 0.2 } }, in: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.3 } } }}
            >
              {films.map((f, k) => (
                <motion.li key={f.clip} variants={{ out: { opacity: 0, y: 12 }, in: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}>
                  <button type="button" className={k === at ? s.thumbOn : undefined} onClick={() => go(k)} aria-label={f.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stillFor(f.clip)} alt="" draggable={false} />
                  </button>
                </motion.li>
              ))}
            </motion.ol>
          )}
        </AnimatePresence>
      </motion.div>
    </BeyondShell>
  );
}
