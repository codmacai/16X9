"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useSpring, useTransform, type Transition } from "framer-motion";
import { EASE, EASE_CINE } from "./_shared/chrome";
import { stillFor, WORKS_9X16 } from "./_shared/data";
import { startMuted } from "./brand-shared";
import s from "./intro.module.css";

// ===========================================================================
// WORK, 9x16 — the opening, on the paper, and little else: the vertical
// frame alone in the middle of the page, a soft shadow under it, reels
// playing in it and swiping up one after another like a feed. It opens like
// a shutter and leans toward the pointer on a spring. One line at the foot on
// the left, what's playing on the right, and a cue on to the accounts.
// ===========================================================================

const RISE: Transition = { type: "spring", stiffness: 60, damping: 16, mass: 1 };
const SWIPE: Transition = { type: "spring", stiffness: 90, damping: 18, mass: 1 }; // one reel up
const TILT = { stiffness: 110, damping: 18, mass: 0.6 };
const REELS = WORKS_9X16.slice(0, 5); // the reels the frame plays
const HOLD_MS = 4000; // each holds this long before the next swipes up
// the reels, and the first again at the end, so the feed swipes on round without a seam
const FEED = [...REELS, REELS[0]];
const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Intro916({ reduce }: { reduce: boolean }) {
  // the feed: which reel is up (a float while it swipes), and the one showing
  const pos = useMotionValue(0);
  const [at, setAt] = useState(0);
  const feedY = useTransform(pos, (v) => `${-v * 100}%`);
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setAt(i % REELS.length);
      animate(pos, i, {
        ...SWIPE,
        onComplete: () => {
          // past the last, the first again: back to the top without a move
          if (i === REELS.length) {
            i = 0;
            pos.jump(0);
          }
        },
      });
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [pos, reduce]);

  // the frame leans toward the pointer
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, TILT);
  const sy = useSpring(py, TILT);
  const rotateY = useTransform(sx, (v) => v * 9);
  const rotateX = useTransform(sy, (v) => -v * 7);
  const lean = (e: ReactPointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const rest = () => {
    px.set(0);
    py.set(0);
  };

  const start = reduce ? false : undefined;
  const reel = REELS[at];
  const n = REELS.length;
  return (
    <section className={s.intro} aria-labelledby="intro-title" onPointerMove={lean} onPointerLeave={rest}>
      <h1 id="intro-title" className={s.sr}>
        9x16 — made for the scroll
      </h1>

      <div className={s.stage}>
        
        {/* the frame, standing in for the × — reels swiping up through it */}
        <motion.div className={s.device} style={{ rotateX, rotateY, transformPerspective: 1500 }}>
          <motion.span
            className={s.screen}
            initial={start ?? { clipPath: "inset(50% 0% 50% 0% round 16px)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0% round 16px)" }}
            transition={{ duration: 1.3, ease: EASE_CINE, delay: 0.15 }}
          >
            <motion.span className={s.feed} style={{ y: feedY }} aria-hidden="true">
              {FEED.map((r, i) => {
                const k = i % n;
                // only the reel up, the one swiping out above it and the next run
                const run = !reduce && (k === at || k === (at + 1) % n || k === (at + n - 1) % n);
                return (
                  <span key={i} className={s.reel} style={{ top: `${i * 100}%` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stillFor(r.src ?? "")} alt="" draggable={false} style={{ scale: String(r.zoom ?? 1) }} />
                    {run && (
                      <video ref={startMuted} src={r.src} muted autoPlay playsInline loop preload="auto" style={{ scale: String(r.zoom ?? 1) }} />
                    )}
                  </span>
                );
              })}
            </motion.span>
            {/* a feed's progress bars */}
            <span className={s.segs} aria-hidden="true">
              {REELS.map((r, i) => (
                <i key={r.src} className={i < at ? s.segDone : undefined}>
                  {i === at && !reduce && <b key={at} style={{ animationDuration: `${HOLD_MS}ms` }} />}
                </i>
              ))}
            </span>
          </motion.span>
          {/* the finder's corners, in ink on the paper */}
          <motion.span
            className={s.corners}
            initial={start ?? { opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...RISE, delay: 0.9 }}
            aria-hidden="true"
          >
            <i className={s.tl} />
            <i className={s.tr} />
            <i className={s.bl} />
            <i className={s.br} />
          </motion.span>
        </motion.div>

              </div>

      {/* the line, on the left */}
      <motion.div
        className={s.line}
        initial={start ?? { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...RISE, delay: 1.05 }}
      >
        <p className={s.lead}>Made for the scroll.</p>
        <p className={s.sub}>Vertical films, reels and series for the screen in every hand.</p>
      </motion.div>

      {/* what's playing, on the right */}
      <motion.div
        className={s.now}
        initial={start ?? { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...RISE, delay: 1.15 }}
        aria-live="polite"
      >
        <span className={s.nowCount}>
          {pad2(at + 1)} <i>/ {pad2(n)}</i>
        </span>
        <span className={s.nowMask}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={at}
              className={s.nowTitle}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {reel.title} <em>{reel.kind}</em>
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.div>

      {/* on to the accounts */}
      <motion.a
        href="#accounts"
        className={s.cue}
        initial={start ?? { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 1.4, ease: EASE }}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("accounts")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }}
      >
        Scroll
        <i aria-hidden="true" />
      </motion.a>
    </section>
  );
}
