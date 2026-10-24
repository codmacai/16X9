"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { EASE_CINE } from "../work/_shared/chrome";
import { stillFor } from "../work/_shared/data";
import { Card, FullCard, type Rect } from "../work/beyond-card";
import { BeyondShell, CATS, pad2, useSteps } from "../work/beyond-shell";
import { startMuted } from "../work/brand-shared";
import s from "./beyond3.module.css";

// ===========================================================================
// BEYOND 3 — THE RING, on black. The categories stand round a ring in the
// dark, a tall card each, turning slowly; the one at the front plays its
// film in colour and the rest turn away into the dark. Drag it, scroll it or
// use the arrows to turn it (a card a turn); click a side card to bring it
// round, the front one (or Enter) to go in. Under the ring, the front
// category's name and what the studio does in it. Gone in, its films stand
// in a curve — the one in the middle facing you as a card (the card as
// Beyond's work page has it), playing, the others turned back either side;
// the wheel, the arrows, a swipe or a side card move along, Explore opens
// the one in the middle to the whole screen. Back (or Esc) returns to the
// ring.
// ===========================================================================

const N = CATS.length;
// the ring holds each category twice, opposite itself, so the cards either side of the front turn
// only a little away and it reads as a ring
const SLOTS = N * 2;
const STEP = 360 / SLOTS;
const mod = (v: number, m: number) => ((v % m) + m) % m;

export default function BeyondThree() {
  const reduce = !!useReducedMotion();
  const [open, setOpen] = useState<number | null>(null);
  // where the ring was left, so it comes back to the same category
  const [turn, setTurn] = useState(0);
  return (
    <BeyondShell className={s.page} onBack={open !== null ? () => setOpen(null) : undefined}>
      <AnimatePresence mode="wait">
        {open === null ? (
          <Ring key="ring" reduce={reduce} turn={turn} setTurn={setTurn} onEnter={setOpen} />
        ) : (
          <Flow key={`flow-${open}`} cat={open} reduce={reduce} onBack={() => setOpen(null)} />
        )}
      </AnimatePresence>
    </BeyondShell>
  );
}

/** The categories round a ring. `turn` counts whole steps; the card at the front is slot turn mod
 *  SLOTS, its category that mod N. */
function Ring({ reduce, turn, setTurn, onEnter }: { reduce: boolean; turn: number; setTurn: (f: (t: number) => number) => void; onEnter: (i: number) => void }) {
  const slot = mod(turn, SLOTS);
  const front = slot % N;
  const target = useMotionValue(-turn * STEP);
  const rot = useSpring(target, { stiffness: 55, damping: 17, mass: 1 });
  const drag = useRef<{ x: number; a: number; moved: boolean } | null>(null);
  const [hold, setHold] = useState(false);

  // a new step: the ring turns to it (unless a hand is on it)
  useEffect(() => {
    if (!drag.current) target.set(-turn * STEP);
  }, [turn, target]);
  // left alone, it turns on by itself
  useEffect(() => {
    if (reduce || hold) return;
    const id = window.setInterval(() => setTurn((t) => t + 1), 3800);
    return () => window.clearInterval(id);
  }, [reduce, hold, setTurn]);
  useSteps(true, (d) => setTurn((t) => t + d));
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Enter" && onEnter(front);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [front, onEnter]);

  const pick = (j: number) => {
    if (drag.current?.moved) return;
    if (j === slot) return onEnter(front);
    let d = mod(j - slot, SLOTS);
    if (d > SLOTS / 2) d -= SLOTS;
    setTurn((t) => t + d);
  };
  const c = CATS[front];

  return (
    <motion.section
      className={s.ringRoom}
      aria-label="Beyond — the categories"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.8 } }}
      exit={{ opacity: 0, scale: 1.06, transition: { duration: 0.5, ease: EASE_CINE } }}
    >
      <div
        className={s.scene}
        onPointerEnter={() => setHold(true)}
        onPointerLeave={() => setHold(false)}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, a: target.get(), moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 5) d.moved = true;
          if (d.moved) target.set(d.a + dx * 0.28);
        }}
        onPointerUp={() => {
          const d = drag.current;
          if (!d) return;
          if (d.moved) {
            const t = Math.round(-target.get() / STEP);
            setTurn(() => t);
            target.set(-t * STEP);
          }
          // the click that may follow still sees whether this was a drag
          window.setTimeout(() => (drag.current = null), 0);
        }}
      >
        <div className={s.tilt}>
          <motion.div className={s.ring} style={{ rotateY: rot }}>
            {Array.from({ length: SLOTS }, (_, j) => (
              <RingCard key={j} j={j} rot={rot} on={j === slot} reduce={reduce} onPick={() => pick(j)} />
            ))}
          </motion.div>
        </div>
      </div>

      {/* under the ring: the front category */}
      <div className={s.caption}>
        <p className={s.kicker}>
          <span>{pad2(front + 1)}</span> {pad2(N)} — Beyond
        </p>
        <div className={s.capMask}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h1
              key={front}
              className={s.capName}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ duration: 0.7, ease: EASE_CINE }}
            >
              {c.name}
            </motion.h1>
          </AnimatePresence>
        </div>
        <p className={s.capDid}>
          {pad2(c.films.length)} films · {c.did.join(" · ")}
        </p>
        <button type="button" className={s.enter} onClick={() => onEnter(front)}>
          Enter <i aria-hidden="true">→</i>
        </button>
        <p className={s.hint}>Drag or scroll to turn</p>
      </div>
    </motion.section>
  );
}

/** A category on the ring (slot j): turned away into the dark the further it is from the front. */
function RingCard({ j, rot, on, reduce, onPick }: { j: number; rot: MotionValue<number>; on: boolean; reduce: boolean; onPick: () => void }) {
  const i = j % N;
  const c = CATS[i];
  const veil = useTransform(rot, (v) => {
    const a = ((j * STEP + v) * Math.PI) / 180;
    return 0.85 * (1 - Math.max(0, Math.cos(a)) ** 1.6);
  });
  return (
    <button
      type="button"
      className={`${s.rcard} ${on ? s.rcardOn : ""}`}
      style={{ "--j": j } as React.CSSProperties}
      onClick={onPick}
      tabIndex={j < N ? 0 : -1}
      aria-label={on ? `Enter ${c.name}` : `Turn to ${c.name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stillFor(c.films[0].clip)} alt="" draggable={false} />
      {on && !reduce && <video ref={startMuted} src={c.films[0].clip} muted autoPlay playsInline loop preload="auto" />}
      <span className={s.rhead}>
        <b>{pad2(i + 1)}</b>
        <span>{pad2(c.films.length)}</span>
      </span>
      <span className={s.rname}>{c.name}</span>
      <motion.i className={s.veil} style={{ opacity: veil }} aria-hidden="true" />
    </button>
  );
}

/** A category's films in a curve, the one in the middle facing you. */
function Flow({ cat, reduce, onBack }: { cat: number; reduce: boolean; onBack: () => void }) {
  const c = CATS[cat];
  const n = c.films.length;
  const [at, setAt] = useState(0);
  const [full, setFull] = useState<Rect | null>(null);
  const centre = useRef<HTMLDivElement>(null);
  const swipe = useRef<number | null>(null);
  const go = (d: number) => setAt((a) => Math.max(0, Math.min(n - 1, a + d)));
  useSteps(!full, go);
  useEffect(() => {
    if (full) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [full, onBack]);

  return (
    <motion.section
      className={s.flowRoom}
      aria-label={`${c.name}: the films`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6 } }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <header className={s.flowHead}>
        <button type="button" className={s.back} onClick={onBack}>
          <i aria-hidden="true">←</i> Categories
        </button>
        <div className={s.flowTitle}>
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

      <div
        className={s.flow}
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current === null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {c.films.map((f, k) => {
          const off = k - at;
          const side = Math.sign(off);
          return (
            <motion.div
              key={f.clip}
              className={s.fitem}
              style={{ zIndex: 10 - Math.abs(off) }}
              initial={reduce ? false : { opacity: 0, x: `${off * 64}%`, z: -900, rotateY: -side * 40 }}
              animate={{
                x: `${off * 64}%`,
                z: off === 0 ? 0 : -300 - (Math.abs(off) - 1) * 160,
                rotateY: -side * 40,
                opacity: Math.abs(off) > 2 ? 0 : 1,
              }}
              transition={{ type: "spring", stiffness: 70, damping: 18, mass: 1 }}
              onClick={() => off !== 0 && setAt(k)}
            >
              <div ref={off === 0 ? centre : undefined} className={`${s.fin} ${off === 0 ? s.finOn : ""}`}>
                <Card
                  film={f}
                  turn={k}
                  dir={1}
                  reduce={reduce}
                  still={off !== 0}
                  onExplore={
                    off === 0
                      ? () => {
                          const r = centre.current?.getBoundingClientRect();
                          if (r) setFull({ top: r.top, left: r.left, width: r.width, height: r.height });
                        }
                      : undefined
                  }
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* under the curve: the films by name */}
      <ol className={s.names}>
        {c.films.map((f, k) => (
          <li key={f.clip}>
            <button type="button" className={k === at ? s.nameOn : undefined} onClick={() => setAt(k)}>
              <span>{pad2(k + 1)}</span> {f.title}
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence>
        {full && (
          <FullCard key="full" from={full} film={c.films[at]} turn={at} dir={1} reduce={reduce} dark onClose={() => setFull(null)} onStep={go} />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
