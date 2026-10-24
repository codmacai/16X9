"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE, EASE_CINE } from "../work/_shared/chrome";
import { stillFor } from "../work/_shared/data";
import { Card, FullCard, type Rect } from "../work/beyond-card";
import { BeyondShell, CATS, pad2, useSteps } from "../work/beyond-shell";
import { startMuted } from "../work/brand-shared";
import s from "./beyond1.module.css";

// ===========================================================================
// BEYOND 1 — THE PANELS, on black. The screen is five tall panels side by
// side, a category each: its film running grey behind it, its number and
// count at the head, its name set upright up its side. Point at one and it
// opens wide and comes into colour as the others give it room. Click it and
// it takes the screen; its films slide in over it as a row of cards (the
// card as Beyond's work page has it), the one in the middle playing — the
// wheel, the arrows or a swipe move along the row, a side card clicked comes
// to the middle, Explore opens it to the whole screen. Back (or Esc) closes
// the row and the panels come back.
// ===========================================================================

export default function BeyondOne() {
  const reduce = !!useReducedMotion();
  const [on, setOn] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <BeyondShell className={s.page} onBack={open !== null ? () => setOpen(null) : undefined}>
      <div className={`${s.panels} ${open !== null ? s.panelsOpen : ""}`} onPointerLeave={() => setOn(null)}>
        {CATS.map((c) => {
          const live = open === c.i || (open === null && on === c.i);
          return (
            <motion.button
              key={c.name}
              type="button"
              className={`${s.panel} ${live ? s.panelOn : ""} ${open === c.i ? s.panelOpen : ""} ${open !== null && open !== c.i ? s.panelGone : ""}`}
              initial={reduce ? false : { clipPath: "inset(100% 0% 0% 0%)" }}
              animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
              transition={{ duration: 1.1, ease: EASE_CINE, delay: 0.1 + c.i * 0.08 }}
              onPointerEnter={(e) => e.pointerType === "mouse" && setOn(c.i)}
              onFocus={() => setOn(c.i)}
              onClick={() => open === null && setOpen(c.i)}
              tabIndex={open === null ? 0 : -1}
              aria-label={`${c.name}: ${c.films.length} films`}
            >
              <span className={s.media} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillFor(c.films[0].clip)} alt="" draggable={false} />
                {live && !reduce && <video ref={startMuted} src={c.films[0].clip} muted autoPlay playsInline loop preload="auto" />}
              </span>
              <span className={s.head} aria-hidden="true">
                <b>{pad2(c.i + 1)}</b>
                <span>{pad2(c.films.length)} films</span>
              </span>
              <span className={s.name}>{c.name}</span>
              <span className={s.enter} aria-hidden="true">
                Enter <i>→</i>
              </span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>{open !== null && <Films key={open} cat={open} reduce={reduce} onBack={() => setOpen(null)} />}</AnimatePresence>
    </BeyondShell>
  );
}

/** A category's films, a row of cards over its panel. */
function Films({ cat, reduce, onBack }: { cat: number; reduce: boolean; onBack: () => void }) {
  const c = CATS[cat];
  const n = c.films.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const [at, setAt] = useState(0);
  const [full, setFull] = useState<Rect | null>(null);

  // a card to the middle of the row
  const goTo = (k: number) => {
    const track = trackRef.current;
    const el = slots.current[k];
    if (!track || !el) return;
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  };
  useSteps(!full, (d) => goTo(Math.max(0, Math.min(n - 1, at + d))));
  useEffect(() => {
    if (full) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [full, onBack]);

  // the card nearest the middle is the one on show
  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    slots.current.forEach((el, k) => {
      const b = slots.current[best];
      if (el && b && Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid) < Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid)) best = k;
    });
    if (best !== at) setAt(best);
  };

  return (
    <motion.section
      className={s.films}
      aria-label={`${c.name}: the films`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6, delay: 0.45 } }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <header className={s.filmsHead}>
        <button type="button" className={s.back} onClick={onBack}>
          <i aria-hidden="true">←</i> All categories
        </button>
        <div className={s.title}>
          <p className={s.kicker}>
            <span>{pad2(cat + 1)}</span> Beyond
          </p>
          <h1>{c.name}</h1>
        </div>
        <p className={s.count} aria-live="polite">
          <b>{pad2(at + 1)}</b>
          <i aria-hidden="true" />
          {pad2(n)}
        </p>
      </header>

      <div ref={trackRef} className={s.track} onScroll={onScroll}>
        {c.films.map((f, k) => (
          <motion.div
            key={f.clip}
            ref={(el) => {
              slots.current[k] = el;
            }}
            className={s.slot}
            initial={reduce ? false : { opacity: 0, x: 140 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 1.1, ease: EASE, delay: 0.55 + k * 0.1 } }}
          >
            <div className={`${s.slotIn} ${k === at ? s.slotOn : ""}`} onClick={() => k !== at && goTo(k)}>
              <Card
                film={f}
                turn={k}
                dir={1}
                reduce={reduce}
                still={k !== at}
                onExplore={
                  k === at
                    ? () => {
                        const r = slots.current[k]?.getBoundingClientRect();
                        if (r) setFull({ top: r.top, left: r.left, width: r.width, height: r.height });
                      }
                    : undefined
                }
              />
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {full && (
          <FullCard
            key="full"
            from={full}
            film={c.films[at]}
            turn={at}
            dir={1}
            reduce={reduce}
            dark
            onClose={() => setFull(null)}
            onStep={(d) => goTo(Math.max(0, Math.min(n - 1, at + d)))}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
