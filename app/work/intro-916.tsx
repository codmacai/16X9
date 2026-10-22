"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, cubicBezier, motion, useMotionValue, useScroll, useSpring, useTransform, type MotionStyle, type Variants } from "framer-motion";
import { EASE_CINE } from "./_shared/chrome";
import { stillFor, WORKS_9X16 } from "./_shared/data";
import { startMuted } from "./brand-shared";
import s from "./intro.module.css";

// ===========================================================================
// WORK, 9x16 — the opening, in the dark: one vertical frame in the middle of
// a black room, a reel playing in it, and the reel's own light thrown on the
// room around it, the way a phone lights a dark room. The headline runs
// through the frame — "Made for" one side of it, "the scroll." the other
// (above and below it on a phone) — the words sliding out from behind it as
// it opens. The reels follow one another the way stories do: a fine bar for
// each at the frame's head, and each swipes up into the next. Point at the
// frame and the reel holds; click it to play it whole. Scroll, and the frame
// opens until the room is all frame, pushing the words out before its
// edges, and goes dark: the room the accounts are in, below.
// The opening is CSS; the scroll is framer-motion, through a spring.
// ===========================================================================

const REELS = WORKS_9X16.slice(0, 5);
const N = REELS.length;
const HOLD = 5.5; // seconds a reel holds the frame
const SMOOTH = { stiffness: 120, damping: 28, mass: 0.4 }; // the scroll, eased
const PULL = cubicBezier(0.5, 0, 0.75, 0.35); // the frame opens slowly, then draws you in
const OPEN: [number, number] = [0.04, 0.8]; // the part of the scroll that opens the frame
const pad2 = (n: number) => String(n).padStart(2, "0");

// a reel swipes up into the frame; the one before it goes up and away into the dark
const CUT = { duration: 1.1, ease: EASE_CINE };
const SWIPE: Variants = { below: { y: "100%" }, in: { y: "0%", transition: CUT }, gone: { y: "-30%", transition: CUT } };
const SHADE: Variants = { below: { opacity: 0 }, in: { opacity: 0 }, gone: { opacity: 0.75, transition: CUT } };

export default function Intro916({ reduce, onOpen }: { reduce: boolean; onOpen: (index: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLButtonElement>(null);
  const screenRef = useRef<HTMLSpanElement>(null);
  const feedRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);

  // the feed: seq counts the swipes, the reel in the frame is seq mod N
  const [seq, setSeq] = useState(0);
  const at = seq % N;
  const seqRef = useRef(0);
  useEffect(() => {
    seqRef.current = seq;
  }, [seq]);
  const [ready, setReady] = useState(false); // the frame open: the feed runs
  const [hover, setHover] = useState(false); // pointed at: the reel holds
  const [held, setHeld] = useState(false); // scrolled into: the reel holds
  useEffect(() => {
    let live = true;
    const go = () => live && setReady(true);
    const a = screenRef.current?.getAnimations?.()[0];
    (a ? a.finished : Promise.resolve()).then(go, go);
    return () => {
      live = false;
    };
  }, []);

  // the scroll: the frame opens to cover the screen, the words pushed out before its edges
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, SMOOTH);
  useEffect(() => p.on("change", (v) => setHeld(v > 0.02)), [p]);
  const cover = useMotionValue(10);
  useEffect(() => {
    const measure = () => {
      const f = frameRef.current;
      const pin = f?.offsetParent as HTMLElement | null;
      if (!f || !pin) return;
      const cy = f.offsetTop + f.offsetHeight / 2;
      cover.set(Math.max(pin.clientWidth / f.offsetWidth, (Math.max(cy, pin.clientHeight - cy) * 2) / f.offsetHeight) * 1.1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [cover]);
  const open = useTransform(p, OPEN, [0, 1], { ease: PULL });
  const grow = useTransform(() => 1 + open.get() * (cover.get() - 1));
  const g = useTransform(grow, (v) => v - 1); // how far the frame's edges have moved, in halves of the frame
  const words = useTransform(p, [0.1, 0.42], [1, 0]);
  const meta = useTransform(p, [0.01, 0.1], [1, 0]);
  const light = useTransform(p, [0.12, 0.5], [1, 0]);
  const dim = useTransform(p, [0.66, 0.97], [0, 1]);

  // the light: the reel in the frame drawn small, ten times a second, and let into the
  // last a little at a time so it changes like light does; the CSS blurs it over the room
  useEffect(() => {
    const c = glowRef.current;
    const ctx = c?.getContext("2d");
    const feed = feedRef.current;
    if (!c || !ctx || !feed) return;
    let raf = 0;
    let last = 0;
    let primed = false;
    let seen = true;
    const io = new IntersectionObserver(([e]) => (seen = e.isIntersecting));
    io.observe(c);
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!seen || t - last < 100) return;
      last = t;
      const reel = feed.querySelector<HTMLElement>(`[data-seq="${seqRef.current}"]`);
      const v = reel?.querySelector("video");
      const img = reel?.querySelector("img");
      const src = v && v.readyState >= 2 ? v : img?.complete && img.naturalWidth ? img : null;
      if (!src) return;
      const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth;
      const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight;
      const k = Math.max(c.width / sw, c.height / sh) * (REELS[seqRef.current % N].zoom ?? 1);
      ctx.globalAlpha = primed ? 0.2 : 1;
      ctx.drawImage(src, (c.width - sw * k) / 2, (c.height - sh * k) / 2, sw * k, sh * k);
      primed = true;
      if (reduce) cancelAnimationFrame(raf); // held still: drawn once
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [reduce]);

  const reel = REELS[at];
  return (
    <section ref={ref} className={`${s.intro} ${reduce ? s.still : ""}`} aria-labelledby="intro-title">
      <motion.div className={s.pin} style={reduce ? undefined : ({ "--g": g } as MotionStyle)}>
        {/* the reel's light, on the room */}
        <motion.div className={s.glow} style={reduce ? undefined : { opacity: light }} aria-hidden="true">
          <canvas ref={glowRef} width={24} height={42} />
        </motion.div>

        <motion.p className={s.kicker} style={reduce ? undefined : { opacity: meta }}>
          <span>
            <b>9x16</b> The vertical frame
          </span>
        </motion.p>

        {/* the headline, through the frame */}
        <motion.h1 id="intro-title" className={s.title} style={reduce ? undefined : { opacity: words }}>
          <span className={`${s.side} ${s.sideA}`}>
            <span className={s.mask}>
              <span className={s.word}>Made for</span>
            </span>
          </span>{" "}
          <span className={`${s.side} ${s.sideB}`}>
            <span className={s.mask}>
              <span className={s.word}>the scroll.</span>
            </span>
          </span>
        </motion.h1>

        <motion.p className={s.lede} style={reduce ? undefined : { opacity: meta }}>
          <span>Vertical films, reels and series for the screen in every hand.</span>
        </motion.p>

        {/* the frame */}
        <motion.button
          ref={frameRef}
          type="button"
          className={s.frame}
          style={reduce ? undefined : { scale: grow }}
          onClick={() => onOpen(at)}
          onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
          onPointerLeave={() => setHover(false)}
          aria-label={`Play ${reel.title}, ${reel.kind}`}
        >
          <span ref={screenRef} className={s.screen}>
            <span ref={feedRef} className={s.feed} aria-hidden="true">
              <AnimatePresence initial={false}>
                <motion.span key={seq} data-seq={seq} className={s.reel} style={{ zIndex: seq }} variants={SWIPE} initial="below" animate="in" exit="gone">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stillFor(reel.src ?? "")} alt="" draggable={false} style={{ scale: String(reel.zoom ?? 1) }} />
                  {!reduce && <video ref={startMuted} src={reel.src} muted autoPlay playsInline loop preload="auto" style={{ scale: String(reel.zoom ?? 1) }} />}
                  <motion.i className={s.shade} variants={SHADE} />
                </motion.span>
              </AnimatePresence>
            </span>

            {/* a fine bar for each reel, as stories have; the one playing fills, and on its end the next swipes in */}
            {!reduce && (
              <motion.span className={s.bars} style={{ opacity: meta }} aria-hidden="true">
                {REELS.map((r, k) => (
                  <i key={r.src} className={k < at ? s.barDone : undefined}>
                    {ready && k === at && (
                      <b
                        key={seq}
                        style={{ animationDuration: `${HOLD}s`, animationPlayState: hover || held ? "paused" : "running" }}
                        onAnimationEnd={() => setSeq((n) => n + 1)}
                      />
                    )}
                  </i>
                ))}
              </motion.span>
            )}

            <motion.span className={s.playBox} style={reduce ? undefined : { opacity: meta }} aria-hidden="true">
              <span className={s.play}>
                <i /> Play
              </span>
            </motion.span>

            {/* opened to the whole screen, it goes dark */}
            <motion.i className={s.dim} style={reduce ? undefined : { opacity: dim }} aria-hidden="true" />
          </span>
        </motion.button>

        {/* under the frame: which reel it is */}
        <motion.div className={s.caption} style={reduce ? undefined : { opacity: meta }} aria-hidden="true">
          <span>
            <span className={s.count}>
              {pad2(at + 1)} <i>/ {pad2(N)}</i>
            </span>
            <span className={s.capMask}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={seq} className={s.capTitle} initial={{ y: "110%" }} animate={{ y: 0 }} exit={{ y: "-110%" }} transition={CUT}>
                  {reel.title}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}
