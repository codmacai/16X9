"use client";

import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useSpring, type Transition, type Variants } from "framer-motion";
import { ACCOUNTS, stillFor, WORKS_9X16 } from "./_shared/data";
import s from "./intro.module.css";

// ===========================================================================
// WORK, 9x16 — the opening: what 9x16 is. The line on the left; on the
// right, the frame itself — a 9:16 screen held upright, reels playing in it
// one after another under a story's progress bars, the finder's corners round
// it. It tilts a touch toward the pointer, on a spring. The numbers under the
// line are the accounts' own (data.ts), the demo accounts left out.
// ===========================================================================

const RISE: Transition = { type: "spring", stiffness: 70, damping: 16, mass: 1 };
const TILT = { stiffness: 120, damping: 18, mass: 0.6 };
// the reels the screen plays, in turn (the first few selected works)
const REELS = WORKS_9X16.slice(0, 4);
const REEL_S = 4; // each holds this long

const lines: Variants = {
  hidden: { y: "108%" },
  shown: (i: number) => ({ y: 0, transition: { ...RISE, delay: 0.35 + i * 0.1 } }),
};
const fade: Variants = {
  hidden: { opacity: 0, y: 22 },
  shown: (d: number) => ({ opacity: 1, y: 0, transition: { ...RISE, delay: d } }),
};

const PILLARS = [
  ["Shot vertical", "Framed for 9:16 on set, never cropped down from wide."],
  ["The first second", "Hooks, pace and type made for a thumb that's already moving."],
  ["Run as a feed", "Accounts we plan, film and post for, week in, week out."],
];

// "23K" -> 23000, "8,508" -> 8508
const count = (v: string) => (/k$/i.test(v) ? parseFloat(v) * 1000 : Number(v.replace(/,/g, "")) || 0);

export default function Intro916({ reduce }: { reduce: boolean }) {
  const facts = useMemo(() => {
    const run = ACCOUNTS.filter((a) => !a.demo);
    const followers = run.reduce((n, a) => n + count(a.followers), 0);
    const posts = run.reduce((n, a) => n + a.posts, 0);
    return [
      [String(run.length).padStart(2, "0"), "Accounts we run"],
      [`${Math.floor(followers / 1000)}K+`, "Followers across them"],
      [posts.toLocaleString("en-US"), "Posts made"],
    ];
  }, []);

  // the reel in the screen, in turn
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setAt((i) => (i + 1) % REELS.length), REEL_S * 1000);
    return () => window.clearInterval(id);
  }, [reduce]);

  // the screen leans toward the pointer
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, TILT);
  const rotateY = useSpring(ry, TILT);
  const lean = (e: ReactPointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 9);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 7);
  };
  const rest = () => {
    rx.set(0);
    ry.set(0);
  };

  const start = reduce ? false : "hidden";
  return (
    <section className={s.intro} aria-labelledby="intro-title" onPointerMove={lean} onPointerLeave={rest}>
      <div className={s.copy}>
        <motion.p className={s.kicker} variants={fade} custom={0.25} initial={start} animate="shown">
          <span>9x16</span> The vertical frame
        </motion.p>
        <h1 id="intro-title" className={s.title}>
          {["The frame", "in every hand"].map((line, i) => (
            <span key={line} className={s.mask}>
              <motion.span variants={lines} custom={i} initial={start} animate="shown">
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p className={s.lede} variants={fade} custom={0.7} initial={start} animate="shown">
          9x16 is the screen people carry: upright, full bleed, a thumb away from the next thing. We make for it from the
          first frame — shot, cut and graded vertical, built to stop the scroll in the first second and hold it to the last.
        </motion.p>

        <ol className={s.pillars}>
          {PILLARS.map(([head, line], i) => (
            <motion.li key={head} variants={fade} custom={0.85 + i * 0.08} initial={start} animate="shown">
              <span className={s.pNo}>{String(i + 1).padStart(2, "0")}</span>
              <span className={s.pHead}>{head}</span>
              <span className={s.pLine}>{line}</span>
            </motion.li>
          ))}
        </ol>

        <dl className={s.facts}>
          {facts.map(([n, label], i) => (
            <motion.div key={label} variants={fade} custom={1.1 + i * 0.08} initial={start} animate="shown">
              <dt>{label}</dt>
              <dd>{n}</dd>
            </motion.div>
          ))}
        </dl>
      </div>

      {/* the frame itself */}
      <div className={s.stage}>
        <motion.div
          className={s.device}
          style={{ rotateX, rotateY, transformPerspective: 1400 }}
          initial={reduce ? false : { opacity: 0, y: 70, scale: 0.93 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...RISE, delay: 0.55 }}
        >
          <span className={s.screen}>
            {REELS.map((r, i) => (
              <span key={r.src} className={`${s.reel} ${i === at ? s.reelOn : ""}`} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillFor(r.src ?? "")} alt="" draggable={false} style={{ scale: String(r.zoom ?? 1) }} />
                {/* only the reel on screen runs */}
                {i === at && !reduce && (
                  <video src={r.src} muted autoPlay playsInline loop preload="auto" style={{ scale: String(r.zoom ?? 1) }} />
                )}
              </span>
            ))}
            {/* a story's progress bars */}
            <span className={s.segs} aria-hidden="true">
              {REELS.map((r, i) => (
                <i key={r.src} className={i < at ? s.segDone : undefined}>
                  {i === at && <b key={at} style={{ animationDuration: `${REEL_S}s` }} />}
                </i>
              ))}
            </span>
            <span className={s.caption} aria-hidden="true">
              <b>{REELS[at].title}</b>
              {REELS[at].kind}
            </span>
          </span>
          {/* the finder's corners */}
          <span className={`${s.corner} ${s.tl}`} aria-hidden="true" />
          <span className={`${s.corner} ${s.tr}`} aria-hidden="true" />
          <span className={`${s.corner} ${s.bl}`} aria-hidden="true" />
          <span className={`${s.corner} ${s.br}`} aria-hidden="true" />
          <span className={s.ratio} aria-hidden="true">
            9 : 16
          </span>
        </motion.div>
      </div>
    </section>
  );
}
