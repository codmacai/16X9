"use client";

import { Fragment, useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "framer-motion";
import { EASE, EASE_CINE, Info } from "../work/_shared/chrome";
import s from "./opening.module.css";

// ===========================================================================
// OPENING — who we are. The frames open:
//   · on arrival WHO WE ARE rises letter by letter out of its mask, so big it
//     nearly fills the screen, and one 16:9 frame set into the line between
//     WE and ARE opens like a shutter on a film;
//   · the screen holds while you scroll: the letters part from the middle,
//     round the frame, which grows into the room they leave, its picture
//     settling inside it; then the line lifts away;
//   · underneath, the studio's own words come up and are read in, word by
//     word, and three small films open inside the line as it names them;
//   · as the next section rises over it, the whole screen sinks back.
// Held still (reduced motion), it is simply the first screen and the line,
// one after the other, everything open and read.
// ===========================================================================

const SMOOTH = { stiffness: 120, damping: 34, mass: 1, restDelta: 0.0005 }; // over-damped: follows the scroll, never overshoots
const HOVER = { stiffness: 60, damping: 22, mass: 1 }; // how the windows answer the pointer
const STILL_QUERY = "(prefers-reduced-motion: reduce)";

const HEAD = ["WHO", "WE", "ARE"];
const LINE =
  "16x9 & Beyond brings concept development, creative strategy and production together. We create TVCs, brand films, cinematic documentaries, social and branded content, alongside immersive and interactive experiences.";

// the small films set into the line, after the word that names them
const CHIPS: Record<string, { still: string; film?: string }> = {
  "TVCs,": { still: "/clips/stills/clip-12.webp" },
  "films,": { still: "/clips/stills/clip-09.webp" },
  "documentaries,": { still: "/clips/stills/clip-03.webp", film: "/clips/clip-03.mp4" },
};

// the scroll story, as shares of the pinned scroll
const T = {
  cue: [0, 0.05],
  part: [0, 0.28], // the letters part
  lift: [0.02, 0.28], // the line lifts away, under the hairline
  fade: [0.2, 0.28],
  rise: [0.15, 0.34], // the studio's words come up
  read: [0.34, 0.93], // and are read in
} as const;

/** Reduced motion, read the same way on the server and in the first client
    render (never reduced), then for real: no hydration mismatch. */
function useStill() {
  return useSyncExternalStore(
    (on) => {
      const m = window.matchMedia(STILL_QUERY);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => window.matchMedia(STILL_QUERY).matches,
    () => false
  );
}

const share = (v: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (v - a) / (b - a)));

export default function Opening() {
  const reduce = !!useReducedMotion(); // timing only (transitions never reach the markup)
  const still = useStill(); // layout and scroll: same first render on server and client
  const ref = useRef<HTMLElement>(null);

  // ---------------------------------------------------------------------------
  // the scroll: one pinned screen, smoothed by an over-damped spring
  // ---------------------------------------------------------------------------
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const eased = useSpring(scrollYProgress, SMOOTH);
  // held still, the first screen rests on its first frame and the line is all read
  const p = useTransform(() => (still ? 0 : eased.get()));
  const rise = useTransform(() => (still ? 1 : share(eased.get(), T.rise)));
  const read = useTransform(() => (still ? 1 : share(eased.get(), T.read)));

  // on arrival the letters gather in as they rise; with the scroll they part
  // again from the middle, slowly then all at once
  const gather = useMotionValue(0.42);
  useEffect(() => {
    const run = animate(gather, 0, reduce ? { duration: 0 } : { delay: 0.45, duration: 2.1, ease: EASE });
    return () => run.stop();
  }, [gather, reduce]);
  const spread = useTransform(() => gather.get() + Math.pow(share(p.get(), T.part), 1.7) * 3.2);
  const headY = useTransform(p, (v) => `${-80 * Math.pow(share(v, T.lift), 1.25)}vh`);
  const headScale = useTransform(p, [T.part[0], T.part[1]], [1, 1.1]);
  const headFade = useTransform(p, [T.fade[0], T.fade[1]], [1, 0]);
  const cueFade = useTransform(p, [T.cue[0], T.cue[1]], [1, 0]); // the cue and the captions

  // the studio's words come up as the line lifts away: line by line out of
  // their masks (--rise), the whole block settling a little as they do
  const sayY = useTransform(rise, (v) => `${10 * Math.pow(1 - v, 2)}vh`);

  // as the next section rises over it, the screen sinks back
  const { scrollYProgress: leave } = useScroll({ target: ref, offset: ["end end", "end start"] });
  const out = useTransform(() => (still ? 0 : leave.get()));
  const sinkY = useTransform(out, [0, 1], ["0vh", "42vh"]);
  const sinkScale = useTransform(out, [0, 1], [1, 0.92]);
  const sinkFade = useTransform(out, [0, 1], [1, 0.3]);

  // the pointer: the windows lean towards it, the nearer ones more
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const lean = { x: useSpring(px, HOVER), y: useSpring(py, HOVER) };
  useEffect(() => {
    if (still || !window.matchMedia("(hover: hover)").matches) return;
    const move = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [still, px, py]);

  // how far each letter stands from the middle of the screen (-1 … 1), measured
  // where it is laid out (so it holds for the stacked phone line too)
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const h = headRef.current;
    if (!h) return;
    const place = () => {
      const half = h.offsetWidth / 2;
      h.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
        el.style.setProperty("--d", ((el.offsetLeft + el.offsetWidth / 2 - half) / half).toFixed(3));
      });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(h);
    return () => ro.disconnect();
  }, []);

  // which line of the statement each word fell on, so the lines rise in turn
  const lineRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const place = () => {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 1;
      const masks = [...el.querySelectorAll<HTMLElement>("[data-w]")];
      const first = Math.min(...masks.map((m) => m.offsetTop));
      let last = 0;
      masks.forEach((m) => {
        const n = Math.max(0, Math.round((m.offsetTop - first) / lh));
        last = Math.max(last, n);
        m.style.setProperty("--line", String(n));
      });
      el.style.setProperty("--lines", String(last + 1));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the words, numbered so each knows when it is read
  const words = LINE.split(" ");
  const N = words.length;
  const R = 2.6 / N; // how long one word takes to come up, as a share of the reading
  const at = (i: number) => (i * (1 - R)) / (N - 1);

  return (
    <section id="about-top" ref={ref} className={`${s.opening} ${still ? s.still : ""}`} aria-labelledby="about-title">
      <div className={s.stage}>
        <motion.div className={s.frame} style={{ y: sinkY, scale: sinkScale, opacity: sinkFade }}>
          <div className={s.info}>
            <Info left="16X9 & Beyond — Who we are" centre="Dubai, United Arab Emirates" />
          </div>

          {/* ================= the first screen ================= */}
          <div className={s.hero}>
            <motion.h1
              ref={headRef}
              id="about-title"
              className={s.head}
              style={{ y: headY, scale: headScale, opacity: headFade, "--spread": spread } as MotionStyle}
            >
              <span className={s.sr}>Who we are</span>
              <span className={s.headLine} aria-hidden="true">
                {HEAD.map((word, w) => (
                  <Fragment key={word}>
                  {w === 2 && <Reel p={p} lean={lean} reduce={reduce} held={still} />}
                  <span className={s.headWord}>
                    {word.split("").map((ch, i) => {
                      const flat = HEAD.slice(0, w).join(" ").length + (w ? 1 : 0) + i; // place in "WHO WE ARE"
                      const all = HEAD.join(" ").length - 1;
                      const d = (flat - all / 2) / (all / 2); // until it is measured: its place in the line
                      return (
                        <span key={i} className={s.slot} data-slot="" style={{ "--d": d.toFixed(3) } as CSSProperties}>
                          <motion.span
                            className={s.glyph}
                            initial={{ y: "112%" }}
                            animate={{
                              y: 0,
                              transition: reduce ? { duration: 0 } : { delay: 0.45 + flat * 0.055, duration: 1.3, ease: EASE },
                            }}
                          >
                            {ch}
                          </motion.span>
                        </span>
                      );
                    })}
                  </span>
                  </Fragment>
                ))}
              </span>
            </motion.h1>

            {/* the cue, at the foot of the first screen */}
            <motion.div className={s.cue} style={{ opacity: cueFade }}>
              <motion.span
                className={s.cueIn}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { delay: 1.7, duration: 1.1, ease: EASE } }}
              >
                <span>
                  Scroll <i className={s.cueArrow} aria-hidden="true">↓</i>
                </span>
                <span>Stories beyond the frame</span>
              </motion.span>
            </motion.div>

            {/* ================= the studio, in its own words ================= */}
            <motion.div className={s.say} style={{ y: sayY }}>
              <motion.p ref={lineRef} className={s.line} style={{ "--rise": rise } as MotionStyle}>
                <span className={`${s.mask} ${s.lead}`} data-w="" aria-hidden="true">
                  <span className={s.rise}>(01) The studio</span>
                </span>
                {words.map((w, i) => {
                  const chip = CHIPS[w];
                  const from = at(i);
                  return (
                    <span key={i}>
                      {chip ? (
                        // the word, its film and its comma never part across a line
                        <span className={s.keep}>
                          <Word read={read} from={from} to={from + R}>
                            {w.slice(0, -1)}
                          </Word>
                          <Chip read={read} at={from + R * 0.6} still={chip.still} film={chip.film} pause={still} />
                          <Word read={read} from={from} to={from + R}>
                            ,
                          </Word>
                        </span>
                      ) : (
                        <Word read={read} from={from} to={from + R}>
                          {w}
                        </Word>
                      )}{" "}
                    </span>
                  );
                })}
              </motion.p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// REEL — one 16:9 frame set into the line, between WE and ARE, the height of
// the capitals, a film playing in it. It opens like a shutter as the letters
// rise; with the scroll the letters part round it and it grows into the room
// they leave, the picture settling inside; it leans a little to the pointer.
// ---------------------------------------------------------------------------
function Reel({
  p,
  lean,
  reduce,
  held,
}: {
  p: MotionValue<number>;
  lean: { x: MotionValue<number>; y: MotionValue<number> };
  reduce: boolean;
  /** reduced motion: everything rests */
  held: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const grow = (v: number) => Math.pow(share(v, T.part), 1.7);
  const scale = useTransform(p, (v) => 1 + 1.15 * grow(v));
  const picY = useTransform(p, (v) => `${7 * grow(v)}%`);
  const captionFade = useTransform(p, [T.cue[0], T.cue[1] + 0.03], [1, 0]);
  const leanX = useTransform(lean.x, (v) => v * 14);
  const leanY = useTransform(lean.y, (v) => v * 8);

  // the film rests once the line has gone (or held still), and plays when it's back
  const sync = (v: number) => {
    const el = video.current;
    if (!el) return;
    const rest = held || v > T.fade[1] + 0.04;
    if (rest && !el.paused) el.pause();
    else if (!rest && el.paused) el.play().catch(() => {});
  };
  useMotionValueEvent(p, "change", sync);
  useEffect(() => sync(p.get()));

  return (
    <motion.span className={s.reel} style={{ scale }} aria-hidden="true">
      <motion.span className={s.reelLean} style={{ x: leanX, y: leanY }}>
        <motion.span
          className={s.reelShutter}
          initial={{ clipPath: "inset(50% 0% 50% 0%)" }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: reduce ? { duration: 0 } : { delay: 0.6, duration: 1.45, ease: EASE_CINE } }}
        >
          <motion.span
            className={s.reelPic}
            initial={{ scale: 1.32 }}
            animate={{ scale: 1, transition: reduce ? { duration: 0 } : { delay: 0.6, duration: 2.2, ease: EASE } }}
          >
            <motion.span className={s.reelIn} style={{ y: picY }}>
              <video ref={video} src="/clips/clip-06.mp4" poster="/clips/stills/clip-06.webp" muted loop playsInline autoPlay preload="metadata" />
            </motion.span>
          </motion.span>
        </motion.span>
        <motion.span className={s.reelCaption} style={{ opacity: captionFade }}>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6, transition: reduce ? { duration: 0 } : { delay: 1.7, duration: 1, ease: EASE } }}
          >
            16 × 9
          </motion.span>
        </motion.span>
      </motion.span>
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// WORD — faint until the scroll reaches it, then read in
// ---------------------------------------------------------------------------
function Word({ read, from, to, children }: { read: MotionValue<number>; from: number; to: number; children: ReactNode }) {
  const opacity = useTransform(read, [from, to], [0.13, 1]);
  return (
    <motion.span className={s.mask} data-w="" style={{ opacity }}>
      <span className={s.rise}>{children}</span>
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// CHIP — a small film set into the line: a faint slot that the picture
// opens into, left to right, as the line reaches it
// ---------------------------------------------------------------------------
function Chip({ read, at, still, film, pause }: { read: MotionValue<number>; at: number; still: string; film?: string; pause: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const open = useTransform(read, [at, at + 0.07], [0, 1]);
  const clip = useTransform(open, (v) => `inset(0% ${(100 * (1 - v)).toFixed(2)}% 0% 0% round 999px)`);
  const zoom = useTransform(open, [0, 1], [1.45, 1.08]);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (pause) el.pause();
    else if (el.paused) el.play().catch(() => {});
  }, [pause]);
  return (
    <span className={s.mask} data-w="" aria-hidden="true">
      <span className={s.rise}>
        <span className={s.chip}>
          <motion.span className={s.chipPic} style={{ clipPath: clip }}>
            <motion.span className={s.chipIn} style={{ scale: zoom }}>
              {film ? (
                <video ref={video} src={film} poster={still} muted loop playsInline autoPlay preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={still} alt="" draggable={false} decoding="async" />
              )}
            </motion.span>
          </motion.span>
        </span>
      </span>
    </span>
  );
}
