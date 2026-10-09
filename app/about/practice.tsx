"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import s from "./practice.module.css";

// ===========================================================================
// PRACTICE — what we do, then how we work. Paper again, rising over the
// black of the manifesto by its arched edge (curve.tsx).
//   · The promise: one sentence, set large. It reads itself in as you
//     scroll, word by word out of the paper, and three phrases get a pass
//     of black marker — find the idea, bring it to life, the right
//     execution. Under the marker the letters turn to paper.
//   · How we work: the screen holds while the two pillars take their turn.
//     The pillar's name stands giant across it, every letter in its own
//     slot; at the changeover the letters roll over like a departures
//     board, left to right, MAKING to PARTNERSHIP, and the longer word pans
//     across so it reads to the end. Beside it the pillar's three points
//     light one after another, and its file — black card stock with a tab,
//     a portrait inside — goes down into the drawer as the next comes up.
// The scroll position drives all of it, so it scrubs both ways, smoothed
// by an over-damped spring: it glides and never wobbles.
// ===========================================================================

const SMOOTH = { stiffness: 120, damping: 34, mass: 1, restDelta: 0.0001 };
const CINE = cubicBezier(0.76, 0, 0.24, 1);
const SETTLE = cubicBezier(0.16, 1, 0.3, 1);

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
      {still ? <HowStill /> : <How />}
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
  const { scrollYProgress } = useScroll({ target: lineRef, offset: ["start 0.9", "end 0.5"] });
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

// ===========================================================================
// HOW WE WORK — the held screen
// ===========================================================================

const PILLARS = [
  {
    no: "01",
    name: "Making",
    points: ["Production planning", "Content production", "Execution and delivery"],
    line: "We build the team and approach around the project.",
    poster: "/work/posters/poster-3.webp",
    pos: "50% 18%",
  },
  {
    no: "02",
    name: "Partnership",
    points: ["Creative team extension", "Ongoing collaboration", "Long-term relationships"],
    line: "We develop a shared understanding that grows over time.",
    poster: "/work/posters/poster-2.webp",
    pos: "50% 30%",
  },
] as const;

// the held screen's timeline, 0 → 1 over the hold
const LIGHT = [
  [0.03, 0.11, 0.19], // Making's points light, one after another
  [0.6, 0.68, 0.76], // then Partnership's
];
const LIGHT_SPAN = 0.07;
const SUM_IN = [0.2, 0.8]; // each pillar's line comes in after its points
const SWAP = 0.4; // the changeover begins
const ROLL_STEP = 0.012; // between one letter's roll and the next
const ROLL_SPAN = 0.075; // how long one letter takes to roll over
const PAN = [0.5, 0.42]; // the long word pans across (from, span)

function How() {
  const wrapRef = useRef<HTMLDivElement>(null);
  // `enter`: the screen coming up to the top; `p`: the hold
  const { scrollYProgress: rawEnter } = useScroll({ target: wrapRef, offset: ["start end", "start start"] });
  const { scrollYProgress: rawHold } = useScroll({ target: wrapRef, offset: ["start start", "end end"] });
  const enter = useSpring(rawEnter, SMOOTH);
  const p = useSpring(rawHold, SMOOTH);

  // the counter: 01 rolls to 02 with the changeover
  const count = useTransform(p, (v) => `${(-50 * seg(v, SWAP + 0.05, 0.08)).toFixed(3)}%`);

  return (
    <div ref={wrapRef} className={s.how}>
      <div className={s.stage}>
        <div className={s.head}>
          <h2 className={s.headLabel}>How we work</h2>
          <span className={s.count} aria-hidden="true">
            0
            <span className={s.countSlot}>
              <motion.span className={s.countReel} style={{ y: count }}>
                <span>1</span>
                <span>2</span>
              </motion.span>
            </span>
            <i>/</i>02
          </span>
        </div>

        <Giant enter={enter} p={p} />

        <div className={s.body}>
          <div className={s.files} aria-hidden="true">
            {PILLARS.map((pillar, k) => (
              <MovingFolder key={pillar.name} k={k} enter={enter} p={p} />
            ))}
          </div>
          <div className={s.pillars}>
            {PILLARS.map((pillar, k) => (
              <Pillar key={pillar.name} k={k} enter={enter} p={p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GIANT — the pillar's name, each letter in its own slot
// ---------------------------------------------------------------------------
const FROM = PILLARS[0].name.toUpperCase();
const TO = PILLARS[1].name.toUpperCase();

function Giant({ enter, p }: { enter: MotionValue<number>; p: MotionValue<number> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLSpanElement>(null);
  // how far the long word runs past the edge: it pans that far to read to its end
  const over = useMotionValue(0);
  useEffect(() => {
    const box = boxRef.current;
    const to = toRef.current;
    if (!box || !to) return;
    const ro = new ResizeObserver(() => over.set(Math.max(0, to.offsetWidth - box.clientWidth)));
    ro.observe(box);
    ro.observe(to);
    return () => ro.disconnect();
  }, [over]);
  const x = useTransform([p, over], ([v, o]: number[]) => -o * seg(v, PAN[0], PAN[1], cubicBezier(0.45, 0, 0.55, 1)));

  return (
    <div ref={boxRef} className={s.giant} aria-hidden="true">
      <motion.div className={s.giantTrack} style={{ x }}>
        <span className={s.name}>
          {[...FROM].map((ch, i) => (
            <Letter key={i} ch={ch} i={i} side="from" enter={enter} p={p} />
          ))}
        </span>
        <span ref={toRef} className={s.name}>
          {[...TO].map((ch, i) => (
            <Letter key={i} ch={ch} i={i} side="to" enter={enter} p={p} />
          ))}
        </span>
      </motion.div>
    </div>
  );
}

function Letter({
  ch,
  i,
  side,
  enter,
  p,
}: {
  ch: string;
  i: number;
  side: "from" | "to";
  enter: MotionValue<number>;
  p: MotionValue<number>;
}) {
  // the first word rolls up into its slots as the screen arrives, and out of
  // them at the changeover; the second follows it up from below, slot by slot
  const y = useTransform([enter, p], ([e, v]: number[]) => {
    const over = seg(v, SWAP + i * ROLL_STEP, ROLL_SPAN);
    if (side === "to") return `${(112 * (1 - over)).toFixed(3)}%`;
    const up = seg(e, 0.4 + i * 0.05, 0.34);
    return `${(112 * (1 - up) - 112 * over).toFixed(3)}%`;
  });
  return (
    <span className={s.slot}>
      <motion.span className={s.glyph} style={{ y }}>
        {ch}
      </motion.span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// FILE — black card stock, the tab cut into it, a portrait inside
// ---------------------------------------------------------------------------
function Folder({
  k,
  style,
  imgStyle,
  dim,
}: {
  k: number;
  style?: CSSProperties | Record<string, MotionValue<number> | MotionValue<string> | number | string>;
  imgStyle?: Record<string, MotionValue<string> | string>;
  dim?: MotionValue<number>;
}) {
  const pillar = PILLARS[k];
  return (
    <motion.div className={s.folder} style={{ ["--tab" as string]: k, zIndex: k + 1, ...style }}>
      <span className={s.stock} />
      <span className={s.tab}>
        <span className={s.tabNo}>{pillar.no}</span>
        <span>{pillar.name}</span>
      </span>
      <span className={s.window}>
        <motion.span className={s.pic} style={imgStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pillar.poster} alt="" draggable={false} decoding="async" style={{ objectPosition: pillar.pos }} />
        </motion.span>
        {dim && <motion.span className={s.dim} style={{ opacity: dim }} />}
      </span>
    </motion.div>
  );
}

function MovingFolder({ k, enter, p }: { k: number; enter: MotionValue<number>; p: MotionValue<number> }) {
  // the first rises with the screen and goes down into the drawer at the
  // changeover, settling back a little; the second comes up in front of it
  const y = useTransform([enter, p], ([e, v]: number[]) => {
    if (k === 1) return `${(118 * (1 - seg(v, SWAP + 0.02, 0.16))).toFixed(3)}%`;
    return `${(60 * (1 - seg(e, 0.2, 0.8, SETTLE)) + 118 * seg(v, SWAP, 0.22)).toFixed(3)}%`;
  });
  const scale = useTransform(p, (v) => (k === 0 ? 1 - 0.06 * seg(v, SWAP, 0.2) : 1));
  // the one going away darkens as it sinks
  const dim = useTransform(p, (v) => (k === 0 ? 0.55 * seg(v, SWAP, 0.16) : 0));
  // inside, the picture drifts against the hold, as if behind glass
  const imgY = useTransform(p, (v) => `${(-5 + 10 * v).toFixed(3)}%`);
  return <Folder k={k} style={{ y, scale }} imgStyle={{ y: imgY }} dim={dim} />;
}

// ---------------------------------------------------------------------------
// PILLAR — three points that light one after another, and its line
// ---------------------------------------------------------------------------
function Pillar({ k, enter, p }: { k: number; enter: MotionValue<number>; p: MotionValue<number> }) {
  const pillar = PILLARS[k];
  const sumY = useTransform(p, (v) => {
    const inn = seg(v, SUM_IN[k], 0.08, SETTLE);
    const out = k === 0 ? seg(v, SWAP - 0.01, 0.06) : 0;
    return `${(105 * (1 - inn) - 105 * out).toFixed(3)}%`;
  });
  return (
    <div className={s.pillar}>
      <h3 className={s.sr}>{pillar.name}</h3>
      <ul className={s.points}>
        {pillar.points.map((point, j) => (
          <Point key={point} text={point} j={j} k={k} enter={enter} p={p} />
        ))}
      </ul>
      <p className={s.sumMask}>
        <motion.span className={s.sum} style={{ y: sumY }}>
          {pillar.line}
        </motion.span>
      </p>
    </div>
  );
}

function Point({ text, j, k, enter, p }: { text: string; j: number; k: number; enter: MotionValue<number>; p: MotionValue<number> }) {
  // up from its mask (Making's with the screen arriving, Partnership's at the
  // changeover), dim, then lit in its turn; Making's leave upward at the swap
  const y = useTransform([enter, p], ([e, v]: number[]) => {
    if (k === 1) return `${(110 * (1 - seg(v, SWAP + 0.08 + j * 0.03, 0.09, SETTLE))).toFixed(3)}%`;
    const inn = seg(e, 0.62 + j * 0.08, 0.3, SETTLE);
    const out = seg(v, SWAP + j * 0.025, 0.07);
    return `${(110 * (1 - inn) - 110 * out).toFixed(3)}%`;
  });
  const opacity = useTransform(p, (v) => 0.25 + 0.75 * seg(v, LIGHT[k][j], LIGHT_SPAN));
  return (
    <li className={s.point}>
      <motion.span className={s.pointIn} style={{ y, opacity }}>
        <span className={s.pointNo} aria-hidden="true">
          0{j + 1}
        </span>
        <span className={s.pointText}>{text}</span>
      </motion.span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// STILL — reduced motion: both pillars, one after the other, all in view
// ---------------------------------------------------------------------------
function HowStill() {
  return (
    <div className={s.howStill}>
      <div className={s.head}>
        <h2 className={s.headLabel}>How we work</h2>
        <span className={s.count} aria-hidden="true">
          01<i>/</i>02
        </span>
      </div>
      {PILLARS.map((pillar, k) => (
        <div key={pillar.name} className={s.stillPillar}>
          <p className={s.stillName} aria-hidden="true">
            {pillar.name}
          </p>
          <div className={s.body}>
            <div className={s.files} aria-hidden="true">
              <Folder k={k} style={{ ["--tab" as string]: 0 }} />
            </div>
            <div className={s.pillars}>
              <div className={s.pillar}>
                <h3 className={s.sr}>{pillar.name}</h3>
                <ul className={s.points}>
                  {pillar.points.map((point, j) => (
                    <li key={point} className={s.point}>
                      <span className={s.pointIn}>
                        <span className={s.pointNo} aria-hidden="true">
                          0{j + 1}
                        </span>
                        <span className={s.pointText}>{point}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className={s.sumMask}>
                  <span className={s.sum}>{pillar.line}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
