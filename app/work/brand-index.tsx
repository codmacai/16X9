"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, AnimatePresence, motion, useMotionValue, type Transition } from "framer-motion";
import { EASE, EASE_CINE } from "./_shared/chrome";
import { brandOf, logoOf, type Project } from "./_shared/data";
import FileView from "./file-view";
import type { Drawer } from "./file-view";
import f from "./file.module.css";
import s from "./brand.module.css";

// ===========================================================================
// BRAND FILMS — THE SHOWROOM. The brands' logos alone, in ink on the paper,
// standing on a slow ring seen from a little above: the one in front large
// and sharp, the others turning away behind it, smaller and paler, each with
// its shadow on the floor; behind them all, the front brand's mark again,
// vast and faint, filling the room. The ring turns on its own until it's
// touched; drag it, scroll it, use the arrows, or click a logo to bring it
// round. Click the logo in front and ink floods out from it over the page,
// the logo carried to the middle in paper — and every film the studio made
// for that brand rises out of the dark (file-view.tsx).
//
// The ring is one number, `pos` (which brand is in front, as a float, round
// and round), and every logo is placed from it on every frame, straight on
// the DOM: transform and opacity only, nothing re-renders while it turns.
// Brands without a logo file yet stay off the ring; "All brand films" holds
// every one.
// ===========================================================================

type Brand = { name: string; films: Project[]; logo: { src: string; wide: boolean } };
type Opened = { label: string; no: string; films: Project[] };

const TURN: Transition = { type: "spring", stiffness: 70, damping: 17, mass: 1 }; // round to the next brand
const AUTO_MS = 3800; // the ring turns on its own...
const IDLE_MS = 5200; // ...once it's been left alone this long
const FLOOD_MS = 760; // the ink has filled the screen: the films rise
const LEAVE_MS = 420;
const pad2 = (n: number) => String(n).padStart(2, "0");
const mod = (a: number, n: number) => ((a % n) + n) % n;
const maskOf = (src: string) => ({ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` });
// each logo's optical size, so they stand at one weight on the ring: a wordmark in a square file
// reads small, a solid square heavy
const OPTICAL: Record<string, number> = {
  "/brands/etihad-airways.svg": 1.4,
  "/brands/what3words.svg": 0.74,
  "/brands/bmw.svg": 0.92,
  "/brands/masdar.png": 0.94,
};

export default function BrandIndex({
  drawer,
  pool,
  start,
  reduce,
  onPlay,
  onCursor,
  onClosed,
}: {
  /** the Brand Films drawer */
  drawer: Drawer;
  /** every film in this format: a brand's other work (its TVCs) comes from here */
  pool: Project[];
  start: number;
  reduce: boolean;
  onPlay: (film: Project, el: HTMLElement) => void;
  onCursor: (label: string | null) => void;
  onClosed: (index: number) => void;
}) {
  // the brands with a logo, most films first; each with all its work in this format, brand films leading
  const brands = useMemo<Brand[]>(() => {
    const names = [...new Set(pool.map(brandOf).filter(Boolean))];
    return names
      .map((name) => {
        const all = pool.filter((p) => brandOf(p) === name);
        const films = [...all.filter((p) => drawer.films.includes(p)), ...all.filter((p) => !drawer.films.includes(p))];
        return { name, films, logo: films.map(logoOf).find(Boolean)! };
      })
      .filter((b) => b.logo)
      .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
  }, [drawer, pool]);
  const n = brands.length;

  const [front, setFront] = useState(0);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [flood, setFlood] = useState<{ brand: Brand; x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [lift, setLift] = useState(false); // the front logo pointed at
  const up = opened === null && flood === null && !leaving;

  const pos = useMotionValue(reduce ? 0 : -1.6); // the ring turns into place
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const ghosts = useRef<(HTMLSpanElement | null)[]>([]);
  const live = useRef({ busy: false, leaving: false, touched: 0, front: 0, geo: { rx: 400, ry: 40 } });
  useEffect(() => {
    live.current.busy = !up;
    live.current.leaving = leaving;
    live.current.front = front;
  }, [up, leaving, front]);

  // ---- every frame: the logos placed round the ring ----
  const place = useCallback(
    (v: number) => {
      const { rx, ry } = live.current.geo;
      for (let k = 0; k < n; k++) {
        let d = mod(k - v, n);
        if (d > n / 2) d -= n; // the short way round
        const th = (d * 2 * Math.PI) / n;
        const z = Math.cos(th);
        const depth = (z + 1) / 2; // 1 in front, 0 at the back
        const sc = 0.3 + 0.7 * depth ** 1.4;
        // seen from a little above: the far side of the ring rises and draws in
        const x = Math.sin(th) * rx * (0.72 + 0.28 * depth);
        const y = -(1 - z) * ry;
        const el = items.current[k];
        if (el) {
          el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${sc.toFixed(4)})`;
          el.style.opacity = (0.06 + 0.94 * depth ** 2.6).toFixed(3);
          el.style.zIndex = String(Math.round(depth * 100));
        }
        const g = ghosts.current[k];
        if (g) g.style.opacity = (Math.max(0, 1 - Math.abs(d) * 1.6) * 0.03).toFixed(4); // the vast faint mark behind
      }
    },
    [n]
  );
  useEffect(() => {
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      live.current.geo = vw < 760 ? { rx: vw * 0.38, ry: vh * 0.1 } : { rx: Math.min(vw * 0.34, 560), ry: Math.min(vh * 0.12, 120) };
      place(pos.get());
    };
    measure();
    window.addEventListener("resize", measure);
    const off = pos.on("change", (v) => {
      place(v);
      const k = mod(Math.round(v), n);
      if (k !== live.current.front) setFront(k);
    });
    // the ring turns into place
    const run = reduce ? null : animate(pos, 0, { ...TURN, stiffness: 40, damping: 14, delay: 0.25 });
    return () => {
      window.removeEventListener("resize", measure);
      off();
      run?.stop();
    };
  }, [n, place, pos, reduce]);

  const go = useCallback(
    (to: number, velocity = 0) => {
      live.current.touched = performance.now();
      animate(pos, Math.round(to), reduce ? { duration: 0 } : { ...TURN, velocity });
    },
    [pos, reduce]
  );
  const step = useCallback((dir: number) => go(Math.round(pos.get()) + dir), [go, pos]);

  // ---- leaving ----
  const leave = useCallback(() => {
    if (live.current.leaving) return;
    live.current.leaving = true;
    setLeaving(true);
    onCursor(null);
    window.setTimeout(() => onClosed(start), reduce ? 0 : LEAVE_MS);
  }, [onClosed, onCursor, reduce, start, setLeaving]);

  // ---- the ring turns on its own while it's left alone ----
  useEffect(() => {
    if (reduce || !up) return;
    const id = window.setInterval(() => {
      if (performance.now() - live.current.touched > IDLE_MS && !document.hidden) animate(pos, Math.round(pos.get()) + 1, TURN);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [pos, reduce, up]);

  // ---- keys and the wheel: one brand a gesture ----
  useEffect(() => {
    let lockUntil = 0;
    let acc = 0;
    const onKey = (e: KeyboardEvent) => {
      if (live.current.busy || document.body.style.overflow === "hidden") return;
      if (e.key === "Escape") leave();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    const onWheel = (e: WheelEvent) => {
      if (live.current.busy) return;
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.timeStamp < lockUntil) return;
      acc += d;
      if (Math.abs(acc) > 36) {
        step(Math.sign(acc));
        acc = 0;
        lockUntil = e.timeStamp + 520;
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [leave, step]);

  // ---- drag: the ring follows the hand, then settles on the nearest brand, carrying its speed ----
  const dragged = useRef(false);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!up || e.button !== 0) return;
    pos.stop();
    const p0 = pos.get();
    const x0 = e.clientX;
    const per = live.current.geo.rx * Math.sin((2 * Math.PI) / n) || 200; // px of drag per brand
    let last = { x: x0, t: e.timeStamp };
    let vx = 0;
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (!dragged.current && Math.abs(dx) < 6) return;
      dragged.current = true;
      pos.set(p0 - dx / per);
      const dt = Math.max(8, ev.timeStamp - last.t);
      vx = (ev.clientX - last.x) / dt;
      last = { x: ev.clientX, t: ev.timeStamp };
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (dragged.current) go(pos.get() - (vx * 220) / per, (-vx * 1000) / per);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  // ---- a logo clicked: round to the front, or (in front) into the brand ----
  const choose = (k: number, el: HTMLElement) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (!up) return;
    const cur = Math.round(pos.get());
    if (k !== mod(cur, n)) {
      let d = mod(k - cur, n);
      if (d > n / 2) d -= n;
      return go(cur + d);
    }
    enter(brands[k], el);
  };
  const enter = (b: Brand, el: HTMLElement | null) => {
    const r = el?.getBoundingClientRect();
    const open = () => setOpened({ label: b.name, no: pad2(brands.indexOf(b) + 1), films: b.films });
    setLift(false);
    onCursor(null);
    if (reduce || !r) return open();
    setFlood({ brand: b, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    window.setTimeout(() => {
      open();
      setFlood(null);
    }, FLOOD_MS);
  };
  const all = () => {
    if (!up) return;
    onCursor(null);
    setOpened({ label: drawer.label, no: drawer.no, films: drawer.films });
  };

  const fb = brands[front];
  return (
    <>
      <div className={`${f.view} ${s.view}`} role="dialog" aria-modal="true" aria-label={`${drawer.label}: the brands`}>
        {/* the front brand's mark again, vast and faint, filling the room */}
        <div className={s.ghosts} aria-hidden="true">
          {brands.map((b, k) => (
            <span
              key={b.name}
              ref={(el) => {
                ghosts.current[k] = el;
              }}
              className={s.ghost}
              data-wide={b.logo.wide || undefined}
              style={maskOf(b.logo.src)}
            />
          ))}
        </div>

        {/* the drawer, and the way back */}
        <motion.div
          className={f.head}
          style={{ top: "var(--band)" }}
          initial={{ opacity: 0, y: -8 }}
          animate={up ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.5 : 0, ease: EASE }}
        >
          <span className={f.drawer}>
            <i>{drawer.no}</i> {drawer.label}
          </span>
          <button type="button" className={f.close} onClick={leave} tabIndex={up ? 0 : -1}>
            <span className={f.closeRoll}>
              <span>Close</span>
              <span aria-hidden="true">Close</span>
            </span>
            <span className={f.closeX} aria-hidden="true" />
          </button>
        </motion.div>

        {/* the ring */}
        <motion.div
          className={s.ring}
          onPointerDown={onPointerDown}
          initial={{ opacity: 0 }}
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={{ duration: leaving ? 0.3 : 0.9, ease: EASE }}
        >
          {brands.map((b, k) => (
            <button
              key={b.name}
              ref={(el) => {
                items.current[k] = el;
              }}
              type="button"
              className={`${s.item} ${k === front && lift && up ? s.itemLift : ""}`}
              data-wide={b.logo.wide || undefined}
              tabIndex={up ? 0 : -1}
              aria-label={k === front ? `${b.name}: ${b.films.length} ${b.films.length === 1 ? "film" : "films"}, open` : `Turn to ${b.name}`}
              onClick={(e) => choose(k, e.currentTarget)}
              onPointerEnter={(e) => e.pointerType === "mouse" && k === front && setLift(true)}
              onPointerLeave={() => setLift(false)}
            >
              <span className={s.mark} style={{ ...maskOf(b.logo.src), scale: String(OPTICAL[b.logo.src] ?? 1) }} />
              <span className={s.floor} aria-hidden="true" />
            </button>
          ))}
        </motion.div>

        {/* where you are on the ring, and the way through */}
        <motion.div
          className={s.foot}
          initial={{ opacity: 0, y: 10 }}
          animate={up ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.7 : 0, ease: EASE }}
        >
          <button type="button" className={s.arrow} onClick={() => step(-1)} aria-label="Previous brand" tabIndex={up ? 0 : -1}>
            ←
          </button>
          <span className={s.count} aria-live="polite">
            <span className={s.countNow}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={front}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.55, ease: EASE }}
                >
                  {pad2(front + 1)}
                </motion.span>
              </AnimatePresence>
            </span>
            <i>/ {pad2(n)}</i>
            <b>
              {fb ? `${pad2(fb.films.length)} ${fb.films.length === 1 ? "film" : "films"}` : ""}
            </b>
          </span>
          <button type="button" className={s.arrow} onClick={() => step(1)} aria-label="Next brand" tabIndex={up ? 0 : -1}>
            →
          </button>
        </motion.div>

        <motion.button
          type="button"
          className={s.all}
          onClick={all}
          tabIndex={up ? 0 : -1}
          initial={{ opacity: 0 }}
          animate={{ opacity: up ? 1 : 0 }}
          transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.9 : 0, ease: EASE }}
        >
          All brand films <span>{pad2(drawer.films.length)}</span> <i aria-hidden="true">→</i>
        </motion.button>
      </div>

      {/* into the brand: ink floods out from its logo, the logo carried to the middle in paper */}
      <AnimatePresence>{flood && <Flood key="flood" brand={flood.brand} x={flood.x} y={flood.y} />}</AnimatePresence>

      {/* the brand's films (or all of Brand Films), as the folders' line */}
      {opened && (
        <FileView
          key={opened.label}
          drawer={{ no: opened.no, label: opened.label, short: opened.label, films: opened.films, cat: drawer.cat }}
          start={0}
          reduce={reduce}
          onPlay={onPlay}
          onCursor={onCursor}
          onClosed={() => setOpened(null)}
        />
      )}
    </>
  );
}

function Flood({ brand, x, y }: { brand: Brand; x: number; y: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 0;
  const r = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
  const midY = band + (vh - band) / 2;
  return (
    <motion.div
      className={s.flood}
      initial={{ clipPath: `circle(0px at ${x}px ${y}px)` }}
      animate={{ clipPath: `circle(${r}px at ${x}px ${y}px)` }}
      exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.2, ease: EASE } }}
      transition={{ duration: 0.85, ease: EASE_CINE }}
      aria-hidden="true"
    >
      <motion.span
        className={s.floodMark}
        data-wide={brand.logo.wide || undefined}
        style={{ ...maskOf(brand.logo.src), top: midY }}
        initial={{ x: x - vw / 2, y: y - midY, scale: 0.7 }}
        animate={{ x: 0, y: 0, scale: 1.25 }}
        transition={{ type: "spring", stiffness: 55, damping: 16 }}
      />
    </motion.div>
  );
}
