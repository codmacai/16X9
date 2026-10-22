"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, motion, useMotionValue, useSpring, useTransform, type Transition } from "framer-motion";
import { EASE } from "./_shared/chrome";
import { stillFor, WORKS_9X16 } from "./_shared/data";
import { startMuted } from "./brand-shared";
import s from "./intro.module.css";

// ===========================================================================
// WORK, 9x16 — the opening, and only this: the vertical frame in the middle
// of the dark, reels playing in it and swiping up one after another like a
// feed, "Made for" on its left and "the scroll" on its right, one line under
// it. The words come in from the sides to meet the frame as it rises; the
// frame leans a touch toward the pointer, on a spring. A cue at the foot
// leads on to the accounts.
// ===========================================================================

const RISE: Transition = { type: "spring", stiffness: 70, damping: 16, mass: 1 };
const SWIPE: Transition = { type: "spring", stiffness: 90, damping: 18, mass: 1 }; // one reel up
const TILT = { stiffness: 120, damping: 18, mass: 0.6 };
const REELS = WORKS_9X16.slice(0, 5); // the reels the frame plays
const HOLD_MS = 3800; // each holds this long before the next swipes up
// the reels, and the first again at the end, so the feed swipes on round without a seam
const FEED = [...REELS, REELS[0]];

export default function Intro916({ reduce }: { reduce: boolean }) {
  // the feed: which reel is up (a float while it swipes), and the one showing
  const pos = useMotionValue(0);
  const [at, setAt] = useState(0);
  const y = useTransform(pos, (v) => `${-v * 100}%`);
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
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, TILT);
  const rotateY = useSpring(ry, TILT);
  const lean = (e: ReactPointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 6);
  };
  const rest = () => {
    rx.set(0);
    ry.set(0);
  };

  const start = reduce ? false : undefined;
  return (
    <section className={s.intro} aria-labelledby="intro-title" onPointerMove={lean} onPointerLeave={rest}>
      <h1 id="intro-title" className={s.sr}>
        9x16: made for the scroll
      </h1>

      <div className={s.stage}>
        {/* "Made for" comes in from the left to meet the frame */}
        <span className={s.mask}>
          <motion.span
            className={`${s.word} ${s.left}`}
            initial={start ?? { x: "-40%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ ...RISE, delay: 0.55 }}
            aria-hidden="true"
          >
            <span>Made</span> <span>for</span>
          </motion.span>
        </span>

        {/* the vertical frame, reels swiping up through it */}
        <motion.div
          className={s.device}
          style={{ rotateX, rotateY, transformPerspective: 1400 }}
          initial={start ?? { opacity: 0, y: 80, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...RISE, delay: 0.25 }}
        >
          <span className={s.screen}>
            <motion.span className={s.feed} style={{ y }} aria-hidden="true">
              {FEED.map((r, i) => {
                const k = i % REELS.length;
                // only the reel up, the one swiping out above it and the next run
                const n = REELS.length;
                const run = !reduce && (k === at || k === (at + 1) % n || k === (at + n - 1) % n);
                return (
                  <span key={i} className={s.reel} style={{ top: `${i * 100}%` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stillFor(r.src ?? "")} alt="" draggable={false} style={{ scale: String(r.zoom ?? 1) }} />
                    {run && <video ref={startMuted} src={r.src} muted autoPlay playsInline loop preload="auto" style={{ scale: String(r.zoom ?? 1) }} />}
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
            <span className={s.caption} aria-hidden="true">
              <b key={at}>{REELS[at].title}</b>
              <span>{REELS[at].kind}</span>
            </span>
          </span>
          {/* the finder's corners */}
          <i className={`${s.corner} ${s.tl}`} aria-hidden="true" />
          <i className={`${s.corner} ${s.tr}`} aria-hidden="true" />
          <i className={`${s.corner} ${s.bl}`} aria-hidden="true" />
          <i className={`${s.corner} ${s.br}`} aria-hidden="true" />
        </motion.div>

        {/* "the scroll" comes in from the right */}
        <span className={s.mask}>
          <motion.span
            className={`${s.word} ${s.right}`}
            initial={start ?? { x: "40%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ ...RISE, delay: 0.65 }}
            aria-hidden="true"
          >
            <span>the</span> <span>scroll</span>
          </motion.span>
        </span>
      </div>

      <motion.p
        className={s.line}
        initial={start ?? { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...RISE, delay: 1 }}
      >
        Vertical films, reels and series — for the screen in every hand.
      </motion.p>

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
