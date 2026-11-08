"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring, type Variants } from "framer-motion";
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
// each at the frame's head, and each swipes up into the next; arrows at the
// frame's sides go on to the next reel or back to the last (back swipes it
// down). Point at the frame and the reel holds; click it to play it whole.
// At the room's foot, small: "Scroll to view the accounts we run", a hairline
// drawing down under it. The room itself never moves: scroll, and the
// accounts rise over it as a sheet (accounts.tsx) — the next reel coming up
// over the last.
// The opening is CSS; the scroll is framer-motion, through a spring.
// ===========================================================================

const REELS = WORKS_9X16.slice(0, 5);
const N = REELS.length;
const HOLD = 5.5; // seconds a reel holds the frame
const SMOOTH = { stiffness: 120, damping: 28, mass: 0.4 }; // the scroll, eased
const pad2 = (n: number) => String(n).padStart(2, "0");

// a reel swipes up into the frame, the one before it going up and away into the dark; going back,
// it all runs the other way (`custom` is the way: 1 on, -1 back)
const CUT = { duration: 1.1, ease: EASE_CINE };
const SWIPE: Variants = {
  below: (d: number) => ({ y: d > 0 ? "100%" : "-100%" }),
  in: { y: "0%", transition: CUT },
  gone: (d: number) => ({ y: d > 0 ? "-30%" : "30%", transition: CUT }),
};
const SHADE: Variants = { below: { opacity: 0 }, in: { opacity: 0 }, gone: { opacity: 0.75, transition: CUT } };
const ROLL: Variants = {
  below: (d: number) => ({ y: d > 0 ? "110%" : "-110%" }),
  in: { y: "0%", transition: CUT },
  gone: (d: number) => ({ y: d > 0 ? "-110%" : "110%", transition: CUT }),
};

export default function Intro916({ reduce, onOpen }: { reduce: boolean; onOpen: (index: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLSpanElement>(null);
  const feedRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);

  // the feed: the reel in the frame, every swipe counted (each swipe a new layer over the last),
  // and which way the last one went
  const [feed, setFeed] = useState({ at: 0, turn: 0, dir: 1 });
  const { at, turn, dir } = feed;
  const go = useCallback((d: 1 | -1) => setFeed((f) => ({ at: (f.at + d + N) % N, turn: f.turn + 1, dir: d })), []);
  const seqRef = useRef({ turn: 0, at: 0 });
  useEffect(() => {
    seqRef.current = { turn, at };
  }, [turn, at]);
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

  // the scroll, while the accounts rise over the room (it holds still; the reel holds once it's
  // scrolled into)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, SMOOTH);
  useEffect(() => {
    let was = false;
    return p.on("change", (v) => {
      const now = v > 0.02;
      if (now !== was) setHeld((was = now));
    });
  }, [p]);

  // the light: the reel in the frame drawn tiny, ten times a second, and let into the last a
  // little at a time so it changes like light does; then drawn up into the canvas shown, softened
  // (the average of nine copies a little apart) and faded out to its edges there — so nothing on
  // the page carries a filter or a mask, and the room changes on the scroll at no cost
  useEffect(() => {
    const c = glowRef.current;
    const ctx = c?.getContext("2d");
    const feed = feedRef.current;
    const tiny = document.createElement("canvas");
    tiny.width = 6;
    tiny.height = 10;
    const tctx = tiny.getContext("2d");
    if (!c || !ctx || !tctx || !feed) return;
    const edge = ctx.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, c.width / 2);
    edge.addColorStop(0, "#000");
    edge.addColorStop(0.3, "#000");
    edge.addColorStop(0.62, "rgb(0 0 0 / 0.5)");
    edge.addColorStop(1, "rgb(0 0 0 / 0)");
    const spread = c.width * 0.09;
    const draw = () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      let n = 0;
      for (const dy of [-spread, 0, spread])
        for (const dx of [-spread, 0, spread]) {
          ctx.globalAlpha = 1 / ++n; // each copy weighed so they come out even
          ctx.drawImage(tiny, dx - spread, dy - spread, c.width + spread * 2, c.height + spread * 2);
        }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, c.width, c.height);
    };
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
      const reel = feed.querySelector<HTMLElement>(`[data-seq="${seqRef.current.turn}"]`);
      const v = reel?.querySelector("video");
      const img = reel?.querySelector("img");
      const src = v && v.readyState >= 2 ? v : img?.complete && img.naturalWidth ? img : null;
      if (!src) return;
      const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth;
      const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight;
      const k = Math.max(tiny.width / sw, tiny.height / sh) * (REELS[seqRef.current.at].zoom ?? 1);
      tctx.globalAlpha = primed ? 0.2 : 1;
      tctx.drawImage(src, (tiny.width - sw * k) / 2, (tiny.height - sh * k) / 2, sw * k, sh * k);
      primed = true;
      draw();
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
      <div className={s.pin}>
        {/* the reel's light, on the room */}
        <div className={s.glow} aria-hidden="true">
          <canvas ref={glowRef} width={56} height={56} />
        </div>

        {/* the headline, through the frame */}
        <h1 id="intro-title" className={s.title}>
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
        </h1>

        <p className={s.lede}>
          <span>Vertical films, reels and series for the screen in every hand.</span>
        </p>

        {/* the frame */}
        <div className={s.frame} onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)} onPointerLeave={() => setHover(false)}>
          <span ref={screenRef} className={s.screen}>
            <span ref={feedRef} className={s.feed} aria-hidden="true">
              <AnimatePresence initial={false} custom={dir}>
                <motion.span
                  key={turn}
                  data-seq={turn}
                  className={s.reel}
                  style={{ zIndex: turn }}
                  custom={dir}
                  variants={SWIPE}
                  initial="below"
                  animate="in"
                  exit="gone"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stillFor(reel.src ?? "")} alt="" draggable={false} style={{ scale: String(reel.zoom ?? 1) }} />
                  {!reduce && <video ref={startMuted} src={reel.src} muted autoPlay playsInline loop preload="auto" style={{ scale: String(reel.zoom ?? 1) }} />}
                  <motion.i className={s.shade} variants={SHADE} />
                </motion.span>
              </AnimatePresence>
            </span>

            {/* a fine bar for each reel, as stories have; the one playing fills, and on its end the next swipes in */}
            {!reduce && (
              <span className={s.bars} aria-hidden="true">
                {REELS.map((r, k) => (
                  <i key={r.src} className={k < at ? s.barDone : undefined}>
                    {ready && k === at && (
                      <b
                        key={turn}
                        style={{ animationDuration: `${HOLD}s`, animationPlayState: hover || held ? "paused" : "running" }}
                        onAnimationEnd={() => go(1)}
                      />
                    )}
                  </i>
                ))}
              </span>
            )}

            <span className={s.playBox} aria-hidden="true">
              <span className={s.play}>
                <i /> Play
              </span>
            </span>
          </span>
          {/* the frame plays its reel whole; at its sides, back to the last reel and on to the next */}
          <button type="button" className={s.open} onClick={() => onOpen(at)} aria-label={`Play ${reel.title}, ${reel.kind}`} />
          <span className={s.steps}>
            <button type="button" className={s.step} onClick={() => go(-1)} aria-label="The last reel">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3 5 8l5 5" />
              </svg>
            </button>
            <button type="button" className={s.step} onClick={() => go(1)} aria-label="The next reel">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m6 3 5 5-5 5" />
              </svg>
            </button>
          </span>
        </div>

        {/* under the frame: which reel it is */}
        <div className={s.caption} aria-hidden="true">
          <span>
            <span className={s.count}>
              {pad2(at + 1)} <i>/ {pad2(N)}</i>
            </span>
            <span className={s.capMask}>
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.span key={turn} className={s.capTitle} custom={dir} variants={ROLL} initial="below" animate="in" exit="gone">
                  {reel.title}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
        </div>

        {/* at the room's foot, small: the way on */}
        <p className={s.next}>
          <span>Scroll to view the accounts we run</span>
          <i aria-hidden="true" />
        </p>
      </div>
    </section>
  );
}
