"use client";

import { useEffect, useRef } from "react";
import { cubicBezier, motion, useMotionValue, useScroll, useSpring, useTransform, type Transition } from "framer-motion";
import { EASE } from "./_shared/chrome";
import s from "./intro.module.css";

// ===========================================================================
// WORK, 9x16 — the opening, on the paper: what 9x16 is, and the way in.
// Everything hangs on one axis from one thing: a black frame in the format's
// own shape, 9 by 16, in the middle of the page. The headline rides its edges — MADE FOR on its top edge, THE SCROLL.
// on its bottom edge — set in the paper's colour on a difference blend, so
// each line is cut clean along its middle: ink on the paper, white on the
// black. The kicker stands a measured step above, the line the same step
// below.
//
// Scroll, and the page holds while the frame opens: its edges push the two
// lines apart and out of the screen, then it widens until the screen is all
// frame — you've scrolled into the vertical frame, and its dark is the room
// the accounts are in, below. Every move is the scroll's, eased through a
// spring; transform and opacity only.
// ===========================================================================

const RISE: Transition = { type: "spring", stiffness: 60, damping: 16, mass: 1 };
const SMOOTH = { stiffness: 140, damping: 30, mass: 0.35 }; // the scroll, eased
const PULL = cubicBezier(0.5, 0, 0.75, 0.35); // the frame opens slowly, then draws you in

export default function Intro916({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, SMOOTH);

  // the frame's height, and how far it must grow to cover the screen from where it stands
  const fh = useMotionValue(300);
  const cover = useMotionValue(14);
  useEffect(() => {
    const measure = () => {
      const f = frameRef.current;
      const pin = f?.offsetParent as HTMLElement | null;
      if (!f || !pin) return;
      const cy = f.offsetTop + f.offsetHeight / 2;
      const up = Math.max(cy, pin.clientHeight - cy);
      fh.set(f.offsetHeight);
      cover.set(Math.max(pin.clientWidth / f.offsetWidth, (up * 2) / f.offsetHeight) * 1.15);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [fh, cover]);

  // the scroll's moves
  const open = useTransform(p, [0.04, 0.86], [0, 1], { ease: PULL });
  const grow = useTransform(() => 1 + open.get() * (cover.get() - 1));
  // the lines ride the frame's edges as it opens
  const edge = useTransform(() => ((grow.get() - 1) * fh.get()) / 2);
  const up = useTransform(edge, (v) => -v);
  const fall = useTransform(p, [0, 0.14], [1, 0]);
  const fallUp = useTransform(p, [0, 0.14], [0, -18]);
  const fallDown = useTransform(p, [0, 0.14], [0, 18]);

  const start = reduce ? false : undefined;
  const still = reduce ? undefined : null; // with reduced motion, nothing follows the scroll
  return (
    <section ref={ref} className={`${s.intro} ${reduce ? s.still : ""}`} aria-labelledby="intro-title">
      <div className={s.pin}>
        {/* the frame, 9 by 16, in the middle */}
        <motion.span
          ref={frameRef}
          className={s.frame}
          style={still ?? { scale: grow }}
          initial={start ?? { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.1, ease: [0.76, 0, 0.24, 1], delay: 0.1 }}
          aria-hidden="true"
        />
        {/* the words, in the paper's colour on a difference blend: ink on the paper, white on the black */}
        <div className={s.words}>
          <motion.p className={s.kicker} style={still ?? { opacity: fall, y: fallUp }}>
            <motion.span initial={start ?? { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RISE, delay: 0.6 }}>
              9x16 — The vertical frame
            </motion.span>
          </motion.p>

          <h1 id="intro-title" className={s.title}>
            {/* on the frame's top edge */}
            <motion.span className={`${s.line} ${s.top}`} style={still ?? { y: up }}>
              <span className={s.mask}>
                <motion.span initial={start ?? { y: "105%" }} animate={{ y: 0 }} transition={{ ...RISE, delay: 0.35 }}>
                  Made for
                </motion.span>
              </span>
            </motion.span>
            {/* on its bottom edge */}
            <motion.span className={`${s.line} ${s.bottom}`} style={still ?? { y: edge }}>
              <span className={s.mask}>
                <motion.span initial={start ?? { y: "105%" }} animate={{ y: 0 }} transition={{ ...RISE, delay: 0.45 }}>
                  the scroll.
                </motion.span>
              </span>
            </motion.span>
          </h1>

          <motion.p className={s.lede} style={still ?? { opacity: fall, y: fallDown }}>
            <motion.span initial={start ?? { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RISE, delay: 0.7 }}>
              Vertical films, reels and series for the screen in every hand.
            </motion.span>
          </motion.p>
        </div>

        {/* scroll on: into the frame */}
        <motion.a
          href="#accounts"
          className={s.cue}
          style={still ?? { opacity: fall }}
          aria-label="Scroll to the accounts"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("accounts")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
          }}
        >
          <motion.i initial={start ?? { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 1.2, ease: EASE }} />
        </motion.a>
      </div>
    </section>
  );
}
