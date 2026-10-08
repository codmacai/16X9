"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, AnimatePresence, motion, useMotionValue, type Transition } from "framer-motion";
import { EASE } from "../_shared/chrome";
import { type Project } from "../_shared/data";
import Card from "./card";
import Detail from "./detail";
import s from "./file.module.css";

// ===========================================================================
// THE OPEN FILE — the films in a folder, out of the drawer. The folder itself
// has slid up behind this (page.tsx) and gone to black; the films rise out
// of it into one horizontal line.
//
// The line is one number, `pos` (which film is in front, as a float), and
// every card is placed from it on every frame, straight on the DOM: side by
// side along the line; the film in front a touch larger, sharp and in colour,
// the ones either side out of focus and in shadow (see card.tsx: moving is a
// focus pull, the film arriving sharpens as the one leaving goes soft); each
// picture drifting inside its frame against the move; and the line drawing in
// slightly with its speed, like it's moving through air. Nothing re-renders
// while it moves.
//
// Every gesture moves exactly one film:
//   · wheel / trackpad: one step per gesture. A step locks until the gesture
//     ends (a pause), or a fresh swipe starts on top of the last one's glide,
//     or a mouse wheel keeps turning — never on a trackpad's glide tailing off.
//   · drag / swipe: the line follows the finger, then goes one along (or
//     back) on release, carrying the speed it was thrown with.
//   · arrow keys, and a click on a film to one side.
// Click the film in front and its page slides up (detail.tsx).
// ===========================================================================

export type Drawer = { no: string; label: string; short: string; films: Project[] };

type Geo = {
  vw: number;
  vh: number;
  band: number;
  /** the card: its picture (w × mh), and the facts under it, in all h */
  w: number;
  mh: number;
  h: number;
  step: number;
  left: number;
  top: number;
  small: boolean;
};

const RATIO = 1.17; // the picture, height / width
const SNAP: Transition = { type: "spring", stiffness: 150, damping: 25, mass: 1 }; // one film along
const RISE: Transition = { type: "spring", stiffness: 64, damping: 14, mass: 1 }; // out of the folder
const SINK: Transition = { duration: 0.42, ease: [0.6, 0, 0.8, 0.2] }; // back into it
const ENTER_S = 0.34; // the cards start to rise this far into the folder's own rise
const LEAVE_MS = 480; // they sink, then the folder goes back down
const WHEEL = { threshold: 22, pause: 180, settle: 260, fresh: 1.6, refire: 420 };
const DRAG = { distance: 0.16, flick: 0.35 }; // of a step; px per ms

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rubber = (x: number) => (x * 0.32) / (1 + x * 0.6); // past either end, the line gives a little, then stops
const pad2 = (n: number) => String(n).padStart(2, "0");

function geometry(): Geo {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 70;
  const small = vw < 760;
  const facts = small ? 66 : 78; // the facts under the picture
  const above = small ? 64 : 56; // room under the band for Close
  const below = small ? 56 : 64; // and over the foot for the counter
  const room = vh - band - above - below - facts;
  let mh = Math.min(room, small ? 520 : 680);
  let w = mh / RATIO;
  const maxW = small ? vw * 0.72 : vw * 0.31;
  if (w > maxW) {
    w = maxW;
    mh = w * RATIO;
  }
  const h = mh + facts;
  const gap = small ? 16 : vw * 0.03;
  return {
    vw,
    vh,
    band,
    w,
    mh,
    h,
    step: w + gap,
    left: (vw - w) / 2,
    top: band + above + (vh - band - above - below - h) / 2,
    small,
  };
}

// the counter rolls up going forward, down going back
const roll = {
  enter: (dir: number) => ({ y: dir >= 0 ? "100%" : "-100%" }),
  center: { y: "0%" },
  exit: (dir: number) => ({ y: dir >= 0 ? "-100%" : "100%" }),
};

export default function FileView({
  drawer,
  start,
  reduce,
  playing,
  onPlay,
  onCursor,
  onClosed,
}: {
  drawer: Drawer;
  /** the film the folder was showing */
  start: number;
  reduce: boolean;
  /** the player is open over everything */
  playing: boolean;
  onPlay: (film: Project, el: HTMLElement) => void;
  onCursor: (label: string | null) => void;
  /** the films are back in the folder; this film was in front */
  onClosed: (index: number) => void;
}) {
  const films = drawer.films;
  const n = films.length;
  const [nav, setNav] = useState({ index: start, dir: 0 });
  const [rest, setRest] = useState(start); // where the line came to rest: that film plays
  const [leaving, setLeaving] = useState(false);
  const [detail, setDetail] = useState(false);
  const [booted, setBooted] = useState(false); // the films have risen in
  const [geo, setGeo] = useState(geometry);
  const index = nav.index;

  const pos = useMotionValue(start);
  const live = useRef({ index: start, detail: false, leaving: false, geo });
  useEffect(() => {
    live.current.detail = detail;
    live.current.leaving = leaving;
    live.current.geo = geo;
  }, [detail, leaving, geo]);

  // ---- every frame: place the cards from the line ----
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const focuses = useRef<(HTMLDivElement | null)[]>([]);
  const arts = useRef<(HTMLDivElement | null)[]>([]);
  // the film in front comes into focus once it has risen in
  const focusIn = useMotionValue(reduce ? 1 : 0);
  const place = useCallback(
    (v: number) => {
      const g = live.current.geo;
      const vel = reduce ? 0 : pos.getVelocity(); // films per second
      const squeeze = 1 - Math.min(Math.abs(vel), 6) * 0.007; // the line draws in a touch with its speed
      const sharp = focusIn.get();
      for (let k = 0; k < n; k++) {
        const el = cards.current[k];
        if (!el) continue;
        const d = k - v;
        const ad = Math.abs(d);
        const front = Math.max(0, 1 - ad); // 1 for the film in front, 0 a step away
        const sc = (0.93 + 0.07 * front) * squeeze;
        el.style.transform = `translate3d(${(d * g.step).toFixed(2)}px,0,0) scale(${sc.toFixed(4)})`;
        const focus = focuses.current[k];
        if (focus) focus.style.opacity = String((clamp(1 - ad * 1.25, 0, 1) * sharp).toFixed(3)); // the focus pull
        const art = arts.current[k];
        if (art) art.style.transform = `translate3d(${clamp(-d * 7, -11, 11).toFixed(2)}%,0,0)`; // the picture drifts against the move
      }
    },
    [focusIn, n, pos, reduce]
  );
  useEffect(() => {
    place(pos.get());
    const offPos = pos.on("change", place);
    const offFocus = focusIn.on("change", () => place(pos.get()));
    return () => {
      offPos();
      offFocus();
    };
  }, [focusIn, place, pos]);
  useEffect(() => {
    place(pos.get());
  }, [geo, place, pos]);
  useEffect(() => {
    const onResize = () => setGeo(geometry());
    window.addEventListener("resize", onResize);
    const t = window.setTimeout(() => setBooted(true), reduce ? 0 : 1300);
    const run = reduce ? null : animate(focusIn, 1, { duration: 1.1, ease: EASE, delay: ENTER_S + 0.55 });
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
      run?.stop();
    };
  }, [focusIn, reduce]);

  // ---- moving ----
  const go = useCallback(
    (to: number, velocity = 0) => {
      const t = clamp(Math.round(to), 0, n - 1);
      setNav((p) => (p.index === t ? p : { index: t, dir: Math.sign(t - p.index) }));
      live.current.index = t;
      animate(pos, t, reduce ? { duration: 0 } : { ...SNAP, velocity }).then(() => {
        if (live.current.index === t) setRest(t);
      });
    },
    [n, pos, reduce]
  );

  const leave = useCallback(() => {
    if (live.current.leaving) return;
    live.current.leaving = true;
    onCursor(null);
    setDetail(false);
    setLeaving(true);
    window.setTimeout(() => onClosed(live.current.index), reduce ? 0 : LEAVE_MS);
  }, [onClosed, onCursor, reduce]);

  // ---- wheel and keys: one film per gesture ----
  useEffect(() => {
    // the menu and the player lock the body; while either is up, it has the input
    const blocked = () => document.body.style.overflow === "hidden" || live.current.leaving;
    // After a step the gesture is locked. What unlocks it:
    //   · a pause, then deltas that aren't still fading: a new gesture. (A
    //     glide that carries on fading after a stall — a busy main thread can
    //     hold events back — is still the same gesture, and nothing unlocks in
    //     the first moment after a step.)
    //   · a fresh swipe on top of the last one's glide: the deltas had fallen
    //     well below their peak and now climb again;
    //   · a mouse wheel still turning: its deltas hold at their peak, where a
    //     trackpad's glide only ever fades.
    let locked = false;
    let lastT = -1e9;
    let lastAbs = 0;
    let stepT = 0;
    let peak = 0; // the biggest delta since the step...
    let trough = 0; // ...and the smallest after it
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      if (live.current.detail || blocked()) return; // a film's page scrolls itself
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
      const a = Math.abs(d);
      const now = e.timeStamp;
      if (now - lastT > WHEEL.pause && now - stepT > WHEEL.settle && (a >= lastAbs || lastAbs < 4)) {
        locked = false;
        acc = 0;
      } else if (locked) {
        if (a > peak) {
          peak = a;
          trough = a;
        } else trough = Math.min(trough, a);
        const fresh = trough < peak * 0.7 && a > trough * WHEEL.fresh && a > 10 && now - stepT > 120;
        const turning = now - stepT > WHEEL.refire && a >= peak * 0.85 && a > 30;
        if (fresh || turning) {
          locked = false;
          acc = 0;
        }
      }
      lastT = now;
      lastAbs = a;
      if (locked) return;
      acc += d;
      if (Math.abs(acc) >= WHEEL.threshold) {
        go(live.current.index + Math.sign(acc));
        locked = true;
        stepT = now;
        peak = a;
        trough = a;
        acc = 0;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (blocked()) return;
      if (e.key === "Escape") {
        if (live.current.detail) setDetail(false);
        else leave();
      } else if (live.current.detail) return;
      else if (e.key === "ArrowRight") go(live.current.index + 1);
      else if (e.key === "ArrowLeft") go(live.current.index - 1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [go, leave]);

  // ---- drag / swipe: the line follows the finger, then goes one along ----
  const dragged = useRef(false);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (live.current.leaving || live.current.detail || e.button !== 0) return;
    pos.stop();
    const from = live.current.index;
    const p0 = pos.get();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    const samples = [{ x: x0, t: e.timeStamp }];
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (!moved) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(ev.clientY - y0)) return;
        moved = true;
        dragged.current = true;
        onCursor(null);
      }
      let p = p0 - dx / live.current.geo.step;
      if (p < 0) p = -rubber(-p);
      else if (p > n - 1) p = n - 1 + rubber(p - (n - 1));
      pos.set(p);
      samples.push({ x: ev.clientX, t: ev.timeStamp });
      if (samples.length > 8) samples.shift();
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!moved) {
        if (Math.abs(pos.get() - from) > 0.001) go(from); // caught mid-glide: finish it
        return;
      }
      const recent = samples.filter((p) => p.t > ev.timeStamp - 100);
      const a = recent[0] ?? samples[0];
      const vx = (ev.clientX - a.x) / Math.max(16, ev.timeStamp - a.t); // px per ms, over the last moment only
      const dx = ev.clientX - x0;
      const step = live.current.geo.step;
      let to = from;
      if (dx < -step * DRAG.distance || vx < -DRAG.flick) to = from + 1;
      else if (dx > step * DRAG.distance || vx > DRAG.flick) to = from - 1;
      go(to, (-vx * 1000) / step); // keeps the speed it was thrown with
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const select = (k: number) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (k !== live.current.index) return go(k);
    onCursor(null);
    setDetail(true);
  };

  const maxD = Math.max(index, n - 1 - index);

  return (
    <div
      className={s.view}
      style={{ ["--cw" as string]: `${geo.w}px`, ["--mh" as string]: `${geo.mh}px` }}
      role="dialog"
      aria-modal="true"
      aria-label={`${drawer.label}, ${n} films`}
    >
      <motion.div
        className={s.scene}
        animate={detail ? { scale: 0.94, opacity: 0, y: -24 } : { scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.9, ease: EASE }}
      >
        {/* the drawer, and the way back */}
        <motion.div
          className={s.head}
          style={{ top: geo.band }}
          initial={{ opacity: 0, y: -8 }}
          animate={leaving ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
          transition={{ duration: leaving ? 0.25 : 0.9, delay: leaving ? 0 : 0.7, ease: EASE }}
        >
          <span className={s.drawer}>
            <i>{drawer.no}</i> {drawer.label}
          </span>
          <button type="button" className={s.close} onClick={leave}>
            <span className={s.closeRoll}>
              <span>Close</span>
              <span aria-hidden="true">Close</span>
            </span>
            <span className={s.closeX} aria-hidden="true" />
          </button>
        </motion.div>

        {/* the line */}
        <div className={s.stage} onPointerDown={onPointerDown}>
          {films.map((f, k) => (
            <motion.div
              key={f.no}
              className={s.slot}
              style={{ left: geo.left, top: geo.top, width: geo.w, height: geo.h }}
              initial={reduce ? { opacity: 0 } : { y: geo.vh * 0.72, opacity: 0 }}
              animate={leaving ? { y: reduce ? 0 : geo.vh * 0.62, opacity: 0 } : { y: 0, opacity: 1 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : leaving
                    ? { ...SINK, delay: (maxD - Math.abs(k - index)) * 0.035 }
                    : { ...RISE, delay: ENTER_S + Math.abs(k - start) * 0.09 }
              }
            >
              <Card
                film={f}
                label={drawer.label}
                active={k === index}
                play={k === index && k === rest && !detail && !playing && !leaving && !reduce}
                reduce={reduce}
                delay={booted ? 0 : ENTER_S + 0.5}
                cardRef={(el) => {
                  cards.current[k] = el;
                }}
                focusRef={(el) => {
                  focuses.current[k] = el;
                }}
                artRef={(el) => {
                  arts.current[k] = el;
                }}
                onOpen={() => select(k)}
                onHover={(on) => k === live.current.index && onCursor(on ? "Open" : null)}
              />
            </motion.div>
          ))}
        </div>

        {/* where you are */}
        <motion.div
          className={s.count}
          initial={{ opacity: 0 }}
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={{ duration: leaving ? 0.25 : 0.9, delay: leaving ? 0 : 0.85, ease: EASE }}
          aria-live="polite"
        >
          <span className={s.countNow}>
            <AnimatePresence initial={false} custom={nav.dir} mode="popLayout">
              <motion.span
                key={index}
                custom={nav.dir}
                variants={roll}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
              >
                {pad2(index + 1)}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className={s.countOf}>{pad2(n)}</span>
        </motion.div>
      </motion.div>

      {/* the film's own page */}
      <AnimatePresence>
        {detail && (
          <Detail
            key="detail"
            films={films}
            k={index}
            label={drawer.label}
            band={geo.band}
            reduce={reduce}
            playing={playing}
            onClose={() => setDetail(false)}
            onGo={(k) => go(k)}
            onPlay={onPlay}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
