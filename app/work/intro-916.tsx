"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, AnimatePresence, motion, useMotionValue, type Transition } from "framer-motion";
import { EASE } from "./_shared/chrome";
import { stillFor, WORKS_9X16 } from "./_shared/data";
import { startMuted } from "./brand-shared";
import s from "./intro.module.css";

// ===========================================================================
// WORK, 9x16 — the opening, on the paper: the ribbon. The selected reels run
// the width of the page as a row of vertical frames. The one in the middle
// stands in the viewfinder — the 16x9 mark's corners, holding still while
// the feed glides through them — large, sharp and playing; the others step
// back either side, smaller, washed into the paper, holding a still. Every
// few seconds the ribbon glides one along on a spring, round and round.
// Drag it (or swipe sideways) and it follows the hand, then settles on the
// nearest reel with the speed it was thrown with; point at a side reel and it
// comes forward a touch, click it and it glides to the middle; click the one
// in the middle and it plays whole. One line at the foot on the left, where
// you are on the right.
//
// The ribbon is one number, `pos` (which reel is in the middle, as a float),
// and every frame is placed from it on every frame, straight on the DOM:
// transform and opacity only — nothing re-renders while it moves.
// ===========================================================================

const GLIDE: Transition = { type: "spring", stiffness: 60, damping: 18, mass: 1 }; // one reel along
const RISE: Transition = { type: "spring", stiffness: 70, damping: 16, mass: 1 };
const HOLD_MS = 4200; // each reel holds the middle this long
const SIDE = 0.7; // a reel off the middle, at this scale
const REELS = WORKS_9X16;
const N = REELS.length;
const pad2 = (n: number) => String(n).padStart(2, "0");
const mod = (a: number, n: number) => ((a % n) + n) % n;

export default function Intro916({ reduce, onOpen }: { reduce: boolean; onOpen: (index: number) => void }) {
  const pos = useMotionValue(0);
  const [at, setAt] = useState(0); // the reel in the middle
  const [hover, setHover] = useState(false);
  const frames = useRef<(HTMLButtonElement | null)[]>([]);
  const veils = useRef<(HTMLSpanElement | null)[]>([]);
  const ribbonRef = useRef<HTMLDivElement>(null);
  const live = useRef({ w: 300, touched: 0, at: 0 });

  // ---- every frame: each reel placed from the ribbon's position ----
  const place = useCallback((v: number) => {
    const w = live.current.w;
    for (let k = 0; k < N; k++) {
      const el = frames.current[k];
      if (!el) continue;
      let d = mod(k - v, N);
      if (d > N / 2) d -= N; // the short way round
      const ad = Math.abs(d);
      const front = Math.max(0, 1 - ad); // 1 in the middle, 0 a reel away
      const sc = SIDE + (1 - SIDE) * front;
      // the middle reel keeps its own width clear; the ones beyond sit closer together
      const x = Math.sign(d) * (Math.min(ad, 1) * w * (0.5 + SIDE / 2 + 0.09) + Math.max(ad - 1, 0) * w * (SIDE + 0.07));
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) scale(${sc.toFixed(4)})`;
      el.style.zIndex = String(100 - Math.round(ad * 10));
      el.style.visibility = ad > N / 2 - 1 ? "hidden" : "visible"; // the one going round the back
      const veil = veils.current[k];
      if (veil) veil.style.opacity = Math.min(0.66, ad * 0.42).toFixed(3); // off the middle, washed into the paper, the further the more
    }
  }, []);

  useEffect(() => {
    const measure = () => {
      live.current.w = frames.current[0]?.offsetWidth ?? 300;
      place(pos.get());
    };
    measure();
    window.addEventListener("resize", measure);
    const off = pos.on("change", (v) => {
      place(v);
      const k = mod(Math.round(v), N);
      if (k !== live.current.at) {
        live.current.at = k;
        setAt(k);
      }
    });
    return () => {
      window.removeEventListener("resize", measure);
      off();
    };
  }, [place, pos]);

  const go = useCallback(
    (to: number, velocity = 0) => {
      live.current.touched = performance.now();
      animate(pos, Math.round(to), reduce ? { duration: 0 } : { ...GLIDE, velocity });
    },
    [pos, reduce]
  );
  const step = useCallback((dir: number) => go(Math.round(pos.get()) + dir), [go, pos]);

  // ---- it glides on by itself, unless it's being pointed at or was just moved ----
  useEffect(() => {
    if (reduce || hover) return;
    const id = window.setInterval(() => {
      if (document.hidden || performance.now() - live.current.touched < HOLD_MS) return;
      animate(pos, Math.round(pos.get()) + 1, GLIDE);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [hover, pos, reduce]);

  // ---- a sideways swipe on a trackpad moves it one along; up and down still scroll the page ----
  useEffect(() => {
    const el = ribbonRef.current;
    if (!el) return;
    let lockUntil = 0;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (e.timeStamp < lockUntil) return;
      acc += e.deltaX;
      if (Math.abs(acc) > 30) {
        step(Math.sign(acc));
        acc = 0;
        lockUntil = e.timeStamp + 650;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step]);

  // ---- drag: the ribbon follows the hand, then settles with the speed it was thrown with ----
  const dragged = useRef(false);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    pos.stop();
    const p0 = pos.get();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const per = live.current.w * (SIDE + 0.12); // px of drag per reel
    let last = { x: x0, t: e.timeStamp };
    let vx = 0;
    let moving = false;
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (!moving) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(ev.clientY - y0)) return;
        moving = true;
        dragged.current = true;
      }
      pos.set(p0 - dx / per);
      const dt = Math.max(8, ev.timeStamp - last.t);
      vx = (ev.clientX - last.x) / dt;
      last = { x: ev.clientX, t: ev.timeStamp };
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (moving) {
        go(pos.get() - (vx * 180) / per, (-vx * 1000) / per);
        // the click that ends a drag isn't a click; the next one is
        window.setTimeout(() => (dragged.current = false), 0);
      }
      else if (Math.abs(pos.get() - Math.round(pos.get())) > 0.001) go(pos.get()); // caught mid-glide: finish it
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // a reel clicked: to the middle — or, in the middle, played whole
  const choose = (k: number) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    const cur = Math.round(pos.get());
    if (k === mod(cur, N)) return onOpen(k);
    let d = mod(k - cur, N);
    if (d > N / 2) d -= N;
    go(cur + d);
  };

  const start = reduce ? false : undefined;
  const reel = REELS[at];
  return (
    <section className={s.intro} aria-labelledby="intro-title">
      <h1 id="intro-title" className={s.sr}>
        9x16 — made for the scroll
      </h1>

      {/* the ribbon */}
      <motion.div
        ref={ribbonRef}
        className={s.ribbon}
        onPointerDown={onPointerDown}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
        initial={start ?? { opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...RISE, delay: 0.2 }}
      >
        {REELS.map((r, k) => {
          const d = Math.abs(((k - at + N + N / 2) % N) - N / 2);
          // the reel in the middle plays, and the ones either side are ready
          const run = !reduce && d <= 1;
          return (
            <button
              key={r.src}
              ref={(el) => {
                frames.current[k] = el;
              }}
              type="button"
              className={`${s.frame} ${k === at ? s.frameOn : ""}`}
              onClick={() => choose(k)}
              aria-label={k === at ? `Play ${r.title}, ${r.kind}` : `Show ${r.title}`}
            >
              <span className={s.pic}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillFor(r.src ?? "")} alt="" draggable={false} style={{ scale: String(r.zoom ?? 1) }} />
                {run && (
                  <video
                    ref={startMuted}
                    className={k === at ? s.on : s.off}
                    src={r.src}
                    muted
                    autoPlay
                    playsInline
                    loop
                    preload="auto"
                    style={{ scale: String(r.zoom ?? 1) }}
                  />
                )}
                <span
                  ref={(el) => {
                    veils.current[k] = el;
                  }}
                  className={s.veil}
                />
              </span>
            </button>
          );
        })}

        {/* the viewfinder: it holds still, the feed glides through it */}
        <motion.span
          className={s.finder}
          initial={start ?? { opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...RISE, delay: 0.75 }}
          aria-hidden="true"
        >
          <i className={s.tl} />
          <i className={s.tr} />
          <i className={s.bl} />
          <i className={s.br} />
          {/* "Play" when the one in the middle is pointed at */}
          <span className={s.play}>
            <i /> Play
          </span>
        </motion.span>
      </motion.div>

      {/* what's in the middle */}
      <motion.div
        className={s.caption}
        initial={start ?? { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 1, ease: EASE }}
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={at}
            className={s.capIn}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <b>{reel.title}</b> <em>{reel.kind}</em>
          </motion.span>
        </AnimatePresence>
      </motion.div>

      {/* the line, on the left */}
      <motion.div
        className={s.line}
        initial={start ?? { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...RISE, delay: 1.05 }}
      >
        <p className={s.lead}>Made for the scroll.</p>
        <p className={s.sub}>Vertical films, reels and series for the screen in every hand.</p>
      </motion.div>

      {/* where you are, on the right */}
      <motion.div
        className={s.nav}
        initial={start ?? { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...RISE, delay: 1.15 }}
      >
        <span className={s.count}>
          {pad2(at + 1)} <i>/ {pad2(N)}</i>
        </span>
        <button type="button" className={s.arrow} onClick={() => step(-1)} aria-label="Previous reel">
          ←
        </button>
        <button type="button" className={s.arrow} onClick={() => step(1)} aria-label="Next reel">
          →
        </button>
      </motion.div>
    </section>
  );
}
