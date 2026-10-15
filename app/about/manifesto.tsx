"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "framer-motion";
import Curve from "./curve";
import s from "./manifesto.module.css";

// ===========================================================================
// MANIFESTO — "Story always comes first", and everything orbits it.
//   · The black rises over the opening by its arched edge (curve.tsx). On it
//     our films are scattered far and wide: small, dim, a long way off.
//   · The section holds the screen while you scroll, and the films swirl in
//     to a ring round the middle — a lens: the frames at its waist larger,
//     the ones at its top and foot smaller, as if seen through glass — and
//     the ring keeps turning as you go.
//   · In the empty middle the rule rises, word by word, out of the dark:
//     STORY / ALWAYS / COMES / FIRST.
//   · Then the ring opens out past the edges of the screen and the films
//     fade, as if we'd passed through it, and only the line is left.
// One scroll position drives all of it, smoothed by an over-damped spring,
// so it glides and never wobbles. Only transforms and opacity move.
// ===========================================================================

const SMOOTH = { stiffness: 120, damping: 34, mass: 1, restDelta: 0.0001 };
const LOOK = { stiffness: 50, damping: 26, mass: 1 }; // how the pointer's parallax follows
const SPIN = 0.3; // how far the ring turns over the whole section (in turns)
const HOLD = 0.72; // where reduced motion rests: the ring formed, the line set
const WORDS = ["Story", "always", "comes", "first."] as const;

// the films: the four posters lead, and three come back cropped wide, as strips
type Film = { src: string; shape: "tall" | "wide"; pos?: string; video?: string };
const poster = (n: number, shape: Film["shape"] = "tall", pos?: string): Film => ({
  src: `/work/posters/poster-${n}.webp`,
  shape,
  pos,
});
const clip = (n: number, video = false): Film => {
  const id = String(n).padStart(2, "0");
  return { src: `/clips/stills/clip-${id}.webp`, shape: "wide", video: video ? `/clips/clip-${id}.mp4` : undefined };
};
const FILMS: Film[] = [
  poster(1),
  clip(10),
  clip(2),
  poster(4, "wide", "50% 22%"),
  clip(5),
  poster(2),
  clip(7, true),
  clip(12),
  poster(1, "wide", "50% 26%"),
  clip(3),
  poster(3),
  clip(13),
  clip(15),
  clip(8),
  clip(11),
  poster(4),
  clip(6, true),
  clip(9),
  poster(2, "wide", "50% 34%"),
  clip(14),
  clip(4),
];

// ---------------------------------------------------------------------------
// the same "random" numbers on the server and in the browser: an integer hash
// ---------------------------------------------------------------------------
function rand(i: number, k: number) {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca77);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// on a phone the ring is smaller: these films make it, the others sit out
const PHONE = new Set([0, 1, 3, 5, 6, 8, 10, 12, 13, 15, 16, 18, 20]);

// each film's place round the ring (0–1), a poster taking more room than a strip
function slots(keep: (i: number) => boolean) {
  const weight: number[] = FILMS.map((f, i) => (keep(i) ? (f.shape === "tall" ? 1.6 : 1) : 0));
  const total = weight.reduce((a, b) => a + b, 0);
  let run = 0;
  const at = weight.map((wt) => {
    const u = wt ? (run + wt / 2) / total : NaN;
    run += wt;
    return u;
  });
  return { at, total };
}
const SLOTS = { all: slots(() => true), few: slots((i) => PHONE.has(i)) };

// each film's own character: its size, where it starts, when it arrives and leaves
const SEED = FILMS.map((f, i) => ({
  size: f.shape === "tall" ? 1 + 0.08 * rand(i, 0) : 0.9 + 0.14 * rand(i, 0),
  drift: (rand(i, 1) - 0.5) * 0.05, // off the ring a touch: a constellation, not a clock
  far: 0.6 + 1.45 * ((i * 0.618034 + 0.27) % 1), // how far out it starts (in ring radii)
  twist: 0.1 + 0.09 * rand(i, 2), // how far round it swirls on the way in (in turns)
  tilt: (rand(i, 3) - 0.5) * 22, // its tilt while it's out there
  dim: 0.26 + 0.16 * rand(i, 4),
  arrive: 0.02 + 0.12 * rand(i, 5),
  leave: 0.78 + 0.05 * rand(i, 6),
}));

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const round = (v: number, d: number) => Math.round(v * d) / d;

// ---------------------------------------------------------------------------
// THE LENS — an ellipse round the middle of the screen below the band. The
// films sit on it in slots, but a slot is wider where the lens magnifies (so
// the big frames at its waist don't crowd) and narrower where it shrinks
// them; `table` turns a slot position (0–1 round) into an angle. The films
// are sized so that, all the way round, they just fit.
// ---------------------------------------------------------------------------
type Geo = {
  w: number;
  h: number;
  cy: number;
  rx: number;
  ry: number;
  tall: boolean; // an upright screen: the lens stands up
  few: boolean; // a small screen: fewer films
  unit: number;
  table: Float64Array;
};

const FOOT = { w: 1.34, h: 0.56 }; // a film strip's width and height, in units: one slot's worth
const GAP = 0.08; // the dark between neighbours, in units
const CROWD = 1.3; // a touch more film than fits: neighbours just overlap, the bigger in front
const MAG = { wide: [0.42, 1.25], tall: [0.62, 1.12] }; // the lens: smallest at its ends, biggest at its waist
function magnify(tall: boolean, th: number) {
  // the waist: left and right on a wide screen, top and foot on a phone
  const c = tall ? Math.abs(Math.sin(th)) : Math.abs(Math.cos(th));
  const [lo, hi] = tall ? MAG.tall : MAG.wide;
  return lo + (hi - lo) * Math.pow(c, 1.6);
}

let cached: Geo | null = null;
function lens(w: number, h: number): Geo {
  if (cached && cached.w === w && cached.h === h) return cached;
  const band = Math.min(78, Math.max(58, 0.085 * h));
  const tall = w < h * 0.95;
  const few = w < 720;
  const seen = h - band;
  const rx = tall ? 0.43 * w : Math.min(0.39 * w, 0.86 * h);
  const ry = tall ? 0.35 * seen : 0.385 * seen;

  // walk round the ellipse adding up length ÷ the room a film needs there
  const K = 1440;
  const sum = new Float64Array(K + 1);
  for (let k = 0; k < K; k++) {
    const th = ((k + 0.5) / K) * Math.PI * 2;
    const tx = -rx * Math.sin(th);
    const ty = ry * Math.cos(th);
    const ds = Math.hypot(tx, ty);
    const room = magnify(tall, th) * ((Math.abs(tx) / ds) * FOOT.w + (Math.abs(ty) / ds) * FOOT.h) + GAP;
    sum[k + 1] = sum[k] + (ds / room) * ((Math.PI * 2) / K);
  }
  // sum[K] is how many units of film fit round; share them out between the slots
  const unit = Math.min(tall ? 0.26 * w : 0.2 * h, (sum[K] / SLOTS[few ? "few" : "all"].total) * CROWD);
  const M = 1024;
  const table = new Float64Array(M + 1);
  for (let j = 0, k = 0; j <= M; j++) {
    const at = (j / M) * sum[K];
    while (k < K - 1 && sum[k + 1] < at) k++;
    const f = clamp01((at - sum[k]) / (sum[k + 1] - sum[k] || 1));
    table[j] = ((k + f) / K) * Math.PI * 2;
  }
  cached = { w, h, cy: band / 2, rx, ry, tall, few, unit: round(unit, 10), table };
  return cached;
}

function angle(g: Geo, u: number) {
  const t = (((u % 1) + 1) % 1) * (g.table.length - 1);
  const j = Math.floor(t);
  const a = g.table[j];
  const b = g.table[Math.min(j + 1, g.table.length - 1)];
  return a + (b - a) * (t - j);
}

// where film i is, how big, how lit, at progress p — worked out once a frame
type Pose = { x: number; y: number; scale: number; rotate: number; opacity: number; z: number; zoom: number; colour: number };
const memo: { p: number; w: number; h: number; pose: Pose }[] = [];
const SITTING_OUT: Pose = { x: 0, y: 0, scale: 0.3, rotate: 0, opacity: 0, z: 0, zoom: 1, colour: 0 };
function place(i: number, p: number, w: number, h: number): Pose {
  const m = memo[i];
  if (m && m.p === p && m.w === w && m.h === h) return m.pose;
  const g = lens(w, h);
  const slot = SLOTS[g.few ? "few" : "all"].at[i];
  if (Number.isNaN(slot)) return SITTING_OUT;
  const sd = SEED[i];
  const inn = smooth((p - sd.arrive) / 0.34); // 0 far away → 1 on the ring
  const out = clamp01((p - sd.leave) / 0.15) ** 2; // 0 on the ring → 1 gone past the edges
  const u = slot + SPIN * p - sd.twist * (1 - inn) + 0.05 * out;
  const th = angle(g, u);
  const r = (sd.far + (1 + sd.drift - sd.far) * inn) * (1 + 1.6 * out);
  const mag = magnify(g.tall, th);
  const scale = sd.size * (0.38 + (mag - 0.38) * inn) * (1 + 0.9 * out);
  const [lo, hi] = g.tall ? MAG.tall : MAG.wide;
  const lit = 0.42 + 0.58 * ((mag - lo) / (hi - lo));
  const pose: Pose = {
    x: round(g.rx * r * Math.cos(th), 10),
    y: round(g.cy + g.ry * r * Math.sin(th), 10),
    scale: round(scale, 10000),
    rotate: round(sd.tilt + (-4 * Math.sin(2 * th) * (g.tall ? -1 : 1) - sd.tilt) * inn, 100),
    opacity: round((sd.dim + (lit - sd.dim) * inn) * (1 - out), 1000),
    z: Math.round(scale * 20),
    zoom: round(1.26 - 0.24 * inn, 10000),
    // in colour only as it passes the lens's waist; black and white elsewhere
    colour: round(inn * smooth((mag - lo) / (hi - lo) / 0.6 - 0.62), 1000),
  };
  memo[i] = { p, w, h, pose };
  return pose;
}

// ===========================================================================

export default function Manifesto() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // the scroll through the section, from its edge coming up to its foot leaving
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const eased = useSpring(scrollYProgress, SMOOTH);
  // reduced motion: rest at the held frame (set after mount, so the first render matches the server)
  const held = useMotionValue(0);
  useEffect(() => held.set(reduce ? 1 : 0), [reduce, held]);
  const p = useTransform([eased, held], ([v, still]: number[]) => (still ? HOLD : v));

  // the stage's size, for the lens (the server assumes a laptop; the browser measures)
  const w = useMotionValue(1440);
  const h = useMotionValue(900);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      w.set(el.clientWidth);
      h.set(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  // the two films that play, play only while the section is on screen
  const inView = useInView(ref, { margin: "10% 0px" });
  const playing = inView && !reduce;

  // a pointer moves the ring and the line apart a touch, for depth (over-damped: no wobble)
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  useEffect(() => {
    if (!playing || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [playing, px, py]);
  const sx = useSpring(px, LOOK);
  const sy = useSpring(py, LOOK);
  const ringX = useTransform(sx, (v) => v * -34);
  const ringY = useTransform(sy, (v) => v * -22);
  const lineX = useTransform(sx, (v) => v * 12);
  const lineY = useTransform(sy, (v) => v * 8);

  // the films' size unit, from the lens (the css works in it)
  const unit = useTransform([w, h], ([W, H]: number[]) => `${lens(W, H).unit}px`);

  // the line: the label first, then each word up out of its mask
  const labelOpacity = useTransform(p, [0.38, 0.46], [0, 0.6]);
  const labelY = useTransform(p, [0.38, 0.46], [14, 0]);
  const lineScale = useTransform(p, [0.4, 0.66, 0.8, 1], [0.94, 1, 1, 1.05]);

  return (
    <section ref={ref} id="story" className={s.section} aria-labelledby="story-line">
      <Curve target={ref} color="#000" />
      <div ref={stageRef} className={s.stage}>
        <motion.div className={s.ring} style={{ "--u": unit, x: ringX, y: ringY } as MotionStyle} aria-hidden="true">
          {FILMS.map((film, i) => (
            <Frame key={i} i={i} film={film} p={p} w={w} h={h} playing={playing} />
          ))}
        </motion.div>

        <motion.div className={s.statement} style={{ scale: lineScale, x: lineX, y: lineY }}>
          <motion.p className={s.label} style={{ opacity: labelOpacity, y: labelY }}>
            Our first rule
          </motion.p>
          <h2 id="story-line" className={s.line}>
            {WORDS.map((word, k) => (
              <Word key={word} word={word} k={k} p={p} />
            ))}
          </h2>
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// WORD — rises out of its mask, each a beat after the last
// ---------------------------------------------------------------------------
function Word({ word, k, p }: { word: string; k: number; p: MotionValue<number> }) {
  const from = 0.4 + 0.048 * k;
  const y = useTransform(p, (v) => `${round((1 - smooth((v - from) / 0.1)) * 112, 100)}%`);
  return (
    <>
      <span className={s.mask}>
        <motion.span className={s.word} style={{ y }}>
          {word}
        </motion.span>
      </span>{" "}
    </>
  );
}

// ---------------------------------------------------------------------------
// FRAME — one film in the constellation: black and white, with its colour
// laid over it (only the colour layer's opacity changes, so nothing repaints)
// ---------------------------------------------------------------------------
function Frame({
  i,
  film,
  p,
  w,
  h,
  playing,
}: {
  i: number;
  film: Film;
  p: MotionValue<number>;
  w: MotionValue<number>;
  h: MotionValue<number>;
  playing: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing]);
  const at = [p, w, h];
  const x = useTransform(at, ([v, W, H]: number[]) => place(i, v, W, H).x);
  const y = useTransform(at, ([v, W, H]: number[]) => place(i, v, W, H).y);
  const scale = useTransform(at, ([v, W, H]: number[]) => place(i, v, W, H).scale);
  const rotate = useTransform(at, ([v, W, H]: number[]) => place(i, v, W, H).rotate);
  const opacity = useTransform(at, ([v, W, H]: number[]) => place(i, v, W, H).opacity);
  const zIndex = useTransform(at, ([v, W, H]: number[]) => place(i, v, W, H).z);
  const zoom = useTransform(at, ([v, W, H]: number[]) => place(i, v, W, H).zoom);
  const colour = useTransform(at, ([v, W, H]: number[]) => place(i, v, W, H).colour);
  const fit = { objectPosition: film.pos };
  return (
    <motion.div
      className={`${s.frame} ${film.shape === "tall" ? s.tall : s.wide} ${PHONE.has(i) ? "" : s.spare}`}
      style={{ x, y, scale, rotate, opacity, zIndex }}
    >
      <motion.div className={s.picture} style={{ scale: zoom }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={s.grey}
          style={fit}
          src={film.src}
          alt=""
          draggable={false}
          decoding="async"
          fetchPriority="low"
        />
        {film.video ? (
          <motion.video
            ref={video}
            className={s.colour}
            style={{ opacity: colour }}
            src={film.video}
            poster={film.src}
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <motion.img
            className={s.colour}
            style={{ ...fit, opacity: colour }}
            src={film.src}
            alt=""
            draggable={false}
            decoding="async"
            fetchPriority="low"
          />
        )}
      </motion.div>
    </motion.div>
  );
}
