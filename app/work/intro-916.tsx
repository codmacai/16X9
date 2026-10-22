"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform, type Transition } from "framer-motion";
import { EASE } from "./_shared/chrome";
import s from "./intro.module.css";

// ===========================================================================
// WORK, 9x16 — the opening, on the paper: what 9x16 is, and the way in.
// The words, and behind them a small black frame in the format's own shape,
// 9 by 16, the finder's corners round it. Scroll, and the page holds still
// while the frame grows until it fills the screen — you scroll into the
// vertical frame — and its dark is the room the accounts are in, below. The
// words are set in the paper's colour with a difference blend, so where the
// black passes behind them they turn white, and back to ink where it hasn't;
// as it grows, the two lines of the headline draw apart, the line under them
// and the cue fall away, and last of all the headline lets go into the dark.
// Every move is the scroll's, eased through a spring; transform and opacity.
// ===========================================================================

const RISE: Transition = { type: "spring", stiffness: 60, damping: 16, mass: 1 };
const SMOOTH = { stiffness: 140, damping: 30, mass: 0.35 }; // the scroll, eased

export default function Intro916({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, SMOOTH);

  // how far the frame must grow to cover the screen
  const [cover, setCover] = useState(14);
  useEffect(() => {
    const measure = () => {
      const f = frameRef.current;
      if (!f) return;
      setCover(Math.max(window.innerWidth / f.offsetWidth, window.innerHeight / f.offsetHeight) * 1.12);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // the scroll's moves
  const grow = useTransform(p, [0.04, 0.78], [1, cover], { clamp: true });
  const corners = useTransform(p, [0, 0.12], [1, 0]);
  const apart = useTransform(p, [0, 0.8], [0, 1]);
  const lineUp = useTransform(apart, (v) => `${-v * 34}%`);
  const lineDown = useTransform(apart, (v) => `${v * 34}%`);
  const head = useTransform(p, [0, 0.8], [1, 0.9]);
  const letGo = useTransform(p, [0.78, 0.96], [1, 0]);
  const fall = useTransform(p, [0, 0.16], [1, 0]);
  const fallY = useTransform(p, [0, 0.16], [0, -24]);

  const start = reduce ? false : undefined;
  return (
    <section ref={ref} className={`${s.intro} ${reduce ? s.still : ""}`} aria-labelledby="intro-title">
      <div className={s.pin}>
        {/* the frame, 9 by 16, in the middle behind the words */}
        <motion.span
          ref={frameRef}
          className={s.frame}
          style={reduce ? undefined : { scale: grow }}
          initial={start ?? { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.1, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
          aria-hidden="true"
        />
        <motion.span
          className={s.corners}
          style={reduce ? undefined : { opacity: corners }}
          aria-hidden="true"
        >
          <motion.span
            className={s.cornersIn}
            initial={start ?? { opacity: 0, scale: 1.12 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...RISE, delay: 0.85 }}
          >
            <i className={s.tl} />
            <i className={s.tr} />
            <i className={s.bl} />
            <i className={s.br} />
          </motion.span>
        </motion.span>

        {/* the words, in the paper's colour on a difference blend: ink on the paper, white on the black */}
        <div className={s.words}>
          <motion.p className={s.kicker} style={reduce ? undefined : { opacity: fall, y: fallY }}>
            <motion.span initial={start ?? { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.5, ease: EASE }}>
              9x16 — The vertical frame
            </motion.span>
          </motion.p>

          <motion.h1 id="intro-title" className={s.title} style={reduce ? undefined : { scale: head, opacity: letGo }}>
            <motion.span className={s.mask} style={reduce ? undefined : { y: lineUp }}>
              <motion.span initial={start ?? { y: "105%" }} animate={{ y: 0 }} transition={{ ...RISE, delay: 0.35 }}>
                Made for
              </motion.span>
            </motion.span>
            <motion.span className={s.mask} style={reduce ? undefined : { y: lineDown }}>
              <motion.span initial={start ?? { y: "105%" }} animate={{ y: 0 }} transition={{ ...RISE, delay: 0.47 }}>
                the scroll.
              </motion.span>
            </motion.span>
          </motion.h1>

          <motion.p className={s.lede} style={reduce ? undefined : { opacity: fall, y: fallY }}>
            <motion.span initial={start ?? { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RISE, delay: 0.75 }}>
              Vertical films, reels and series — shot, cut and run for the screen in every hand.
            </motion.span>
          </motion.p>
        </div>

        {/* scroll on: into the frame */}
        <motion.a
          href="#accounts"
          className={s.cue}
          style={reduce ? undefined : { opacity: fall }}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("accounts")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
          }}
        >
          <motion.span initial={start ?? { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 1.2, ease: EASE }}>
            Scroll
            <i aria-hidden="true" />
          </motion.span>
        </motion.a>
      </div>
    </section>
  );
}
