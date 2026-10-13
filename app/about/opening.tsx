"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import {
  AnimatePresence,
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
// OPENING — who we are, in two lines:
//   · on arrival WE ARE rises letter by letter out of its mask, and under it,
//     big and heavy, what we are: STORYTELLERS, FILMMAKERS, STRATEGISTS,
//     PRODUCERS, 16X9 & BEYOND — one word at a time, each leaving upward
//     letter by letter as the next rises in. Each word has a film running
//     inside its letters (cut with the word), and under it, small, what it
//     stands for;
//   · the screen holds while you scroll: the letters part from the middle,
//     slowly then all at once, and the lines lift away (the words stop);
//   · underneath, the studio's own words come up and are read in, word by
//     word, and three small films open inside the line as it names them;
//   · as the next section rises over it, the whole screen sinks back.
// Held still (reduced motion), it is simply the first screen and the line,
// one after the other, everything open and read, on the first word.
// ===========================================================================

const SMOOTH = { stiffness: 120, damping: 34, mass: 1, restDelta: 0.0005 }; // over-damped: follows the scroll, never overshoots
const STILL_QUERY = "(prefers-reduced-motion: reduce)";

const HEAD = ["WE", "ARE"];
// what we are, in turn: each with the film that runs in its letters, and what it stands for
const WORDS = [
  { word: "STORYTELLERS", note: "Concept development", film: "/clips/clip-03.mp4", still: "/clips/stills/clip-03.webp" },
  { word: "FILMMAKERS", note: "TVCs, brand films, documentaries", film: "/clips/clip-12.mp4", still: "/clips/stills/clip-12.webp" },
  { word: "STRATEGISTS", note: "Creative strategy", film: "/clips/clip-06.mp4", still: "/clips/stills/clip-06.webp" },
  { word: "PRODUCERS", note: "Production, start to finish", film: "/clips/clip-10.mp4", still: "/clips/stills/clip-10.webp" },
  { word: "16X9 & BEYOND", note: "Immersive and interactive", film: "/clips/clip-15.mp4", still: "/clips/stills/clip-15.webp" },
] as const;
const HOLD = 2.9; // seconds each word holds (the first waits for the arrival too)
const LAST = 4.4; // ...and the last, the name, a little longer
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

  // what we are: one word at a time, while the line is on screen
  const [shown, setShown] = useState(0); // which word
  const [live, setLive] = useState(true);
  const [turned, setTurned] = useState(false); // has it moved on from the first word yet
  useMotionValueEvent(p, "change", (v) => setLive(v < T.fade[1] + 0.02));
  useEffect(() => {
    if (still || !live) return;
    const wait = (shown === WORDS.length - 1 ? LAST : HOLD) + (turned ? 0 : 1.1);
    const id = window.setTimeout(() => {
      setTurned(true);
      setShown((a) => (a + 1) % WORDS.length);
    }, wait * 1000);
    return () => window.clearTimeout(id);
  }, [shown, turned, live, still]);
  const noteFade = useTransform(p, [T.cue[0], T.cue[1] + 0.03], [1, 0]);

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
            {/* the two lines, moving as one */}
            <motion.div
              className={s.title}
              style={{ y: headY, scale: headScale, opacity: headFade, "--spread": spread } as MotionStyle}
            >
              <h1 id="about-title" className={s.head}>
                <span className={s.sr}>We are {WORDS.map((w) => w.word.toLowerCase()).join(", ")}</span>
                <span className={s.weAre} aria-hidden="true">
                  {HEAD.map((word, w) => (
                    <span key={word} className={s.headWord}>
                      <Letters
                        text={word}
                        start={HEAD.slice(0, w).join(" ").length + (w ? 1 : 0)}
                        of={HEAD.join(" ").length}
                        from={0.45}
                        reduce={reduce}
                      />
                    </span>
                  ))}
                </span>
                <span className={s.wordLine} aria-hidden="true">
                  <AnimatePresence>
                    <span key={shown} className={s.word} style={{ "--n": WORDS[shown].word.length } as CSSProperties}>
                      <span className={s.wordIn}>
                        <Letters text={WORDS[shown].word} from={turned ? 0.2 : 0.85} reduce={reduce} leave />
                      </span>
                    </span>
                  </AnimatePresence>
                  <Films at={shown} play={live && !still} />
                </span>
              </h1>
              <motion.span className={s.note} style={{ opacity: noteFade }} aria-hidden="true">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={shown}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 0.6, y: 0, transition: { delay: reduce ? 0 : 0.35, duration: 0.6, ease: EASE } }}
                    exit={{ opacity: 0, y: -6, transition: { duration: reduce ? 0 : 0.3, ease: EASE } }}
                  >
                    ({String(shown + 1).padStart(2, "0")}) {WORDS[shown].note}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
            </motion.div>

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
// LETTERS — a word's letters, each rising out of its mask in turn (and, if it
// leaves, going up out of it again), each parting from the middle of its
// line by --spread (set on the title by the scroll), by how far it stands
// from it (its place, from `start`, in a line `of` letters long)
// ---------------------------------------------------------------------------
function Letters({
  text,
  start = 0,
  of = text.length,
  from,
  reduce,
  leave = false,
}: {
  text: string;
  start?: number;
  of?: number;
  from: number;
  reduce: boolean;
  leave?: boolean;
}) {
  const half = (of - 1) / 2;
  return (
    <>
      {[...text].map((ch, i) => {
        const d = half > 0 ? (start + i - half) / half : 0;
        return (
          <span key={i} className={s.slot} style={{ "--d": d.toFixed(3) } as CSSProperties}>
            <motion.span
              className={s.glyph}
              initial={{ y: "112%" }}
              animate={{ y: 0, transition: reduce ? { duration: 0 } : { delay: from + (start + i) * 0.045, duration: 1.1, ease: EASE } }}
              exit={leave ? { y: "-112%", transition: reduce ? { duration: 0 } : { delay: i * 0.022, duration: 0.7, ease: EASE_CINE } } : undefined}
            >
              {ch === " " ? "\u00a0" : ch}
            </motion.span>
          </span>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// FILMS — the films that run inside the words' letters, one for each word,
// cut with it: only the one showing plays (all are loaded, so the cut is clean)
// ---------------------------------------------------------------------------
function Films({ at, play }: { at: number; play: boolean }) {
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  useEffect(() => {
    refs.current.forEach((v, k) => {
      if (!v) return;
      if (k === at && play) v.play().catch(() => {});
      else v.pause();
    });
  }, [at, play]);
  return (
    <span className={s.film}>
      {WORDS.map((w, k) => (
        <video
          key={w.word}
          ref={(el) => {
            refs.current[k] = el;
          }}
          className={k === at ? s.filmOn : undefined}
          src={w.film}
          poster={w.still}
          muted
          loop
          playsInline
          preload="auto"
        />
      ))}
    </span>
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
