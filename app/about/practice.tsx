"use client";

import { useEffect, useRef, useState } from "react";
import {
  cubicBezier,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import Curve from "./curve";
import Files from "./files";
import s from "./practice.module.css";

// ===========================================================================
// PRACTICE — what we do, then how we work. Paper again, rising over the
// black of the manifesto by its arched edge (curve.tsx).
//   · The promise: one sentence, set large. It reads itself in as you
//     scroll, word by word out of the paper, and three phrases get a pass
//     of black marker — find the idea, bring it to life, the right
//     execution. Under the marker the letters turn to paper.
//   · How we work: two files, Making and Partnership (files.tsx).
// The scroll position drives all of it, so it scrubs both ways, smoothed
// by an over-damped spring: it glides and never wobbles.
// ===========================================================================

const SMOOTH = { stiffness: 120, damping: 34, mass: 1, restDelta: 0.0001 };
const CINE = cubicBezier(0.76, 0, 0.24, 1);

/** 0 → 1 between `from` and `from + span`, held at either end, eased */
const seg = (v: number, from: number, span: number, ease = CINE) => ease(Math.min(1, Math.max(0, (v - from) / span)));

// reduced motion is only known in the browser: the first render is always the
// moving one (as on the server), and the still one takes over after it
function useStill() {
  const reduce = !!useReducedMotion();
  const [still, setStill] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setStill(reduce), 0);
    return () => window.clearTimeout(id);
  }, [reduce]);
  return still;
}

export default function Practice() {
  const ref = useRef<HTMLElement>(null);
  const still = useStill();
  return (
    <section ref={ref} id="how-we-work" className={s.practice} aria-label="What we do and how we work">
      <Curve target={ref} color="#f7f2ee" />
      <TheLine still={still} />
      <Files />
    </section>
  );
}

// ===========================================================================
// THE PROMISE — the sentence, read in, with three passes of marker
// ===========================================================================

type Word = { text: string; tail?: string; at: number; mark?: { from: number; to: number } };

const SENTENCE: [string, boolean, string?][] = [
  ["We help clients", false],
  ["find the idea", true],
  ["and", false],
  ["bring it to life", true],
  ["with a clear creative direction and", false],
  ["the right execution", true, "."],
];

// every word gets its place in the reading (0 → 1, by letters); a marked
// phrase gets a stretch of it for the marker, word after word
const WORDS: Word[] = (() => {
  const total = SENTENCE.reduce((n, [t, , tail]) => n + t.length + 1 + (tail?.length ?? 0), 0);
  const out: Word[] = [];
  let c = 0;
  for (const [phrase, marked, tail] of SENTENCE) {
    const words = phrase.split(" ");
    const start = c;
    // the marker follows a little behind the reading, at the same pace
    const lag = 7;
    words.forEach((w, i) => {
      const last = i === words.length - 1;
      const word: Word = { text: w, tail: last ? tail : undefined, at: c / total };
      if (marked) {
        const a = c - start;
        word.mark = { from: (start + lag + a) / total, to: (start + lag + a + w.length + 1) / total };
      }
      out.push(word);
      c += w.length + 1;
    });
    if (tail) c += tail.length;
  }
  return out;
})();

function TheLine({ still }: { still: boolean }) {
  const lineRef = useRef<HTMLParagraphElement>(null);
  // the reading runs from the line coming up the screen to its last line
  // passing the middle
  const { scrollYProgress } = useScroll({ target: lineRef, offset: ["start 0.92", "end 0.62"] });
  const eased = useSpring(scrollYProgress, SMOOTH);
  const read = useMotionValue(0);
  useEffect(() => {
    if (still) {
      read.set(1.2);
      return;
    }
    read.set(eased.get());
    return eased.on("change", (v) => read.set(v));
  }, [eased, read, still]);

  return (
    <div className={s.promise}>
      <div className={s.lead}>
        <h2 className={s.kicker}>What we do</h2>
        <p ref={lineRef} className={s.line}>
          {WORDS.map((w, i) => (
            <PromiseWord key={i} word={w} read={read} />
          ))}
        </p>
      </div>
    </div>
  );
}

function PromiseWord({ word, read }: { word: Word; read: MotionValue<number> }) {
  // out of the paper as the reading reaches it
  const opacity = useTransform(read, [word.at - 0.02, word.at + 0.06], [0.14, 1], { clamp: true });
  // the marker: a block of ink wiping in from the left, paper letters in it
  const mark = word.mark;
  const wipe = useTransform(read, (v) =>
    mark ? `inset(0 ${(100 - 100 * seg(v, mark.from, mark.to - mark.from, (t) => t)).toFixed(2)}% 0 0)` : "none"
  );
  return (
    <>
      <motion.span className={s.word} style={{ opacity }}>
        <span className={s.wordText}>
          {word.text}
          {mark && (
            <motion.span className={s.ink} style={{ clipPath: wipe }} aria-hidden="true">
              {word.text}
            </motion.span>
          )}
        </span>
        {word.tail}
      </motion.span>{" "}
    </>
  );
}
