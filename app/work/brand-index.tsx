"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type Transition, type Variants } from "framer-motion";
import { EASE } from "./_shared/chrome";
import type { Project } from "./_shared/data";
import BrandTitles from "./brand-titles";
import { brandsFrom, OPTICAL, pad2, reelOf, startMuted, type Brand } from "./brand-shared";
import FileView from "./file-view";
import type { Drawer } from "./file-view";
import f from "./file.module.css";
import s from "./brand.module.css";

// ===========================================================================
// BRAND FILMS — THE VIEWFINDER. The room is dark: the brands' logos hang in
// it, faint, in their own colours, one to each part of the wall. The pointer
// is a camera's 16:9 viewfinder — the corners of the 16x9 mark, REC and a
// running timecode — and wherever it's pointed, the wall comes alive inside
// the frame: the brand's own films playing there, its logo in full colour.
// It follows the hand on a spring; left alone (and on a touch screen, always)
// it drifts from brand to brand on its own. Click, and the frame opens to
// the whole screen on that brand's film — then its opening titles roll
// (brand-titles.tsx): every film made for it, one after another.
//
// The frame is two layers moved by the compositor: a window that follows the
// pointer, and inside it the lit wall moved the other way, so the wall holds
// still while the window travels over it. Nothing re-renders while it moves.
// ===========================================================================

const FRAME = { stiffness: 190, damping: 24, mass: 0.7 }; // the viewfinder after the hand
const RISE: Transition = { type: "spring", stiffness: 80, damping: 15, mass: 1 };
const OPEN: Transition = { type: "spring", stiffness: 60, damping: 17, mass: 1 }; // the frame to the whole screen
const LIVE_MS = 1000; // the films start once the wall has come in
const DRIFT_MS = 2900; // left alone, the frame moves to the next brand this often
const OPEN_MS = 760; // by then the frame is the screen: the titles roll
const LEAVE_MS = 420;
const CUT_MS = 3600; // a brand with several films cuts to the next this often...
const CUT_STEP_MS = 700; // ...each on its own beat
const FPS = 25;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const noop = () => () => {};
const useFine = () => useSyncExternalStore(noop, () => window.matchMedia("(hover: hover) and (pointer: fine)").matches, () => true);
// 00:00:00:00, at 25 frames a second
const timecode = (ms: number) => {
  const t = Math.floor((ms / 1000) * FPS);
  const ff = t % FPS;
  const ss = Math.floor(t / FPS);
  return [Math.floor(ss / 3600), Math.floor(ss / 60) % 60, ss % 60, ff].map(pad2).join(":");
};

const marks: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.9 },
  shown: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { ...RISE, delay: 0.25 + i * 0.08 } }),
  away: (i: number) => ({ opacity: 0, transition: { duration: 0.3, ease: EASE, delay: i * 0.025 } }),
};

type Geo = { w: number; h: number; cols: number; rows: number; fw: number; fh: number };

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
  const brands = useMemo(() => brandsFrom(drawer.films, pool), [drawer, pool]);
  const n = brands.length;
  const fine = useFine();

  // ---- where things are ----
  const [focus, setFocus] = useState(0); // the brand in the frame
  const [titles, setTitles] = useState<number | null>(null); // a brand's opening titles rolling
  const [opening, setOpening] = useState<{ k: number; rect: DOMRect } | null>(null);
  const [page, setPage] = useState<{ k: number; start: number } | null>(null); // a film's line, from the titles
  const [leaving, setLeaving] = useState(false);
  const up = titles === null && opening === null && !leaving;
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setStarted(true), reduce ? 0 : LIVE_MS);
    return () => window.clearTimeout(t);
  }, [reduce]);
  const playing = started && up && !reduce;
  const live = useRef({ busy: false, leaving: false, focus: 0, inside: false });
  useEffect(() => {
    live.current.busy = !up || page !== null;
    live.current.leaving = leaving;
    live.current.focus = focus;
  }, [up, page, leaving, focus]);

  // ---- the room's measure: the wall's grid, and the frame's size ----
  const stageRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo>({ w: 0, h: 0, cols: 3, rows: 2, fw: 0, fh: 0 });
  const geoRef = useRef(geo);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const cols = w < 760 || w / h < 0.9 ? 2 : 3;
      const rows = Math.ceil(n / cols);
      const cw = w / cols;
      const ch = h / rows;
      // a pointer: a 16:9 frame inside a part of the wall; a touch screen: the frame is the part
      let fw = clamp(cw * 0.84, 240, 560);
      let fh = (fw * 9) / 16;
      if (fh > ch * 0.86) [fh, fw] = [ch * 0.86, ((ch * 0.86) * 16) / 9];
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) [fw, fh] = [cw, ch];
      setGeo({ w, h, cols, rows, fw, fh });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);

  // ---- the frame: a centre that follows the hand on a spring ----
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const sx = useSpring(tx, FRAME);
  const sy = useSpring(ty, FRAME);
  const hw = useMotionValue(0);
  const hh = useMotionValue(0);
  const wx = useTransform([sx, hw], ([a, b]: number[]) => a - b);
  const wy = useTransform([sy, hh], ([a, b]: number[]) => a - b);
  const ix = useTransform(wx, (v) => -v);
  const iy = useTransform(wy, (v) => -v);
  const centreOf = (k: number, g: Geo) => [((k % g.cols) + 0.5) * (g.w / g.cols), (Math.floor(k / g.cols) + 0.5) * (g.h / g.rows)];
  const aim = useCallback(
    (x: number, y: number, jump = false) => {
      const g = geoRef.current;
      const cx = clamp(x, g.fw / 2, g.w - g.fw / 2);
      const cy = clamp(y, g.fh / 2, g.h - g.fh / 2);
      tx.set(cx);
      ty.set(cy);
      if (jump) {
        sx.jump(cx);
        sy.jump(cy);
      }
    },
    [sx, sy, tx, ty]
  );
  const aimAt = useCallback(
    (k: number, jump = false) => {
      const [x, y] = centreOf(k, geoRef.current);
      aim(x, y, jump);
    },
    [aim]
  );
  useEffect(() => {
    geoRef.current = geo;
    hw.set(geo.fw / 2);
    hh.set(geo.fh / 2);
    if (geo.w) aimAt(live.current.focus, true);
  }, [geo, hw, hh, aimAt]);

  // the part of the wall a point is in
  const cellAt = (x: number, y: number) => {
    const g = geoRef.current;
    const c = clamp(Math.floor(x / (g.w / g.cols)), 0, g.cols - 1);
    const r = clamp(Math.floor(y / (g.h / g.rows)), 0, g.rows - 1);
    return Math.min(n - 1, r * g.cols + c);
  };
  const follow = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !up) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    live.current.inside = true;
    aim(x, y);
    const k = cellAt(x, y);
    if (k !== live.current.focus) setFocus(k);
  };

  // ---- left alone (and on a touch screen), the frame drifts from brand to brand ----
  useEffect(() => {
    if (!up || reduce || n < 2) return;
    const id = window.setInterval(() => {
      if (live.current.inside && fine) return;
      const k = (live.current.focus + 1) % n;
      setFocus(k);
      aimAt(k);
    }, DRIFT_MS);
    return () => window.clearInterval(id);
  }, [up, reduce, n, fine, aimAt]);

  // ---- REC: the timecode runs while the room is up ----
  const tcRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!up) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      if (tcRef.current) tcRef.current.textContent = timecode(t - t0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [up]);

  // ---- out of the room, and into a brand ----
  const leave = useCallback(() => {
    if (live.current.leaving) return;
    live.current.leaving = true;
    setLeaving(true);
    onCursor(null);
    window.setTimeout(() => onClosed(start), reduce ? 0 : LEAVE_MS);
  }, [onClosed, onCursor, reduce, start, setLeaving]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || live.current.busy || document.body.style.overflow === "hidden") return;
      leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave]);

  const enter = (k: number, cell: HTMLElement) => {
    if (!up) return;
    onCursor(null);
    setFocus(k);
    if (reduce) return setTitles(k);
    // the frame opens from where it is (on a touch screen, or a brand chosen by key, from its part of the wall)
    const stage = stageRef.current!.getBoundingClientRect();
    const g = geoRef.current;
    const inFrame = fine && k === live.current.focus && live.current.inside;
    const rect = inFrame ? new DOMRect(stage.left + sx.get() - g.fw / 2, stage.top + sy.get() - g.fh / 2, g.fw, g.fh) : cell.getBoundingClientRect();
    setOpening({ k, rect });
    window.setTimeout(() => setTitles(k), OPEN_MS);
    window.setTimeout(() => setOpening(null), OPEN_MS + 650);
  };
  const closeTitles = useCallback(() => {
    setTitles(null);
    live.current.inside = false;
  }, []);

  const grid = { gridTemplateColumns: `repeat(${geo.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${geo.rows}, minmax(0, 1fr))` };
  const fb = brands[focus];
  return (
    <>
      <div className={`${f.view} ${s.view} ${leaving ? s.viewLeave : ""}`} role="dialog" aria-modal="true" aria-label={`${drawer.label}: the brands`}>
        {/* the drawer, and the way back */}
        <motion.div
          className={`${f.head} ${s.head}`}
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

        <div
          ref={stageRef}
          className={`${s.stage} ${geo.cols === 2 ? s.narrow : ""}`}
          onPointerMove={follow}
          onPointerLeave={() => (live.current.inside = false)}
        >
          {/* the wall in the dark: the logos, faint — and the way in */}
          <ul className={s.wall} style={grid}>
            {brands.map((b, k) => (
              <li key={b.name}>
                <button
                  type="button"
                  className={s.cell}
                  tabIndex={up ? 0 : -1}
                  onClick={(e) => enter(k, e.currentTarget)}
                  onFocus={(e) => {
                    if (!e.currentTarget.matches(":focus-visible")) return;
                    setFocus(k);
                    aimAt(k);
                  }}
                  aria-label={`${b.name}: ${b.films.length} ${b.films.length === 1 ? "film" : "films"}`}
                >
                  <motion.span
                    className={s.logoBox}
                    data-wide={b.logo.wide || undefined}
                    custom={k}
                    variants={marks}
                    initial={reduce ? false : "hidden"}
                    animate={up ? "shown" : "away"}
                    aria-hidden="true"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={`${s.logo} ${s.faint}`} src={b.logo.dark} alt="" draggable={false} style={{ scale: String(OPTICAL[b.logo.src] ?? 1) }} />
                  </motion.span>
                </button>
              </li>
            ))}
          </ul>

          {/* through the viewfinder: the wall alive — the films playing, the logos in full */}
          {geo.w > 0 && (
            <motion.div
              className={s.window}
              style={{ x: wx, y: wy, width: geo.fw, height: geo.fh }}
              initial={{ opacity: 0 }}
              animate={{ opacity: started && up ? 1 : 0 }}
              transition={{ duration: 0.8, ease: EASE }}
              aria-hidden="true"
            >
              <motion.div className={s.inner} style={{ x: ix, y: iy, width: geo.w, height: geo.h, ...grid }}>
                {brands.map((b, k) => (
                  <div key={b.name} className={s.liveCell}>
                    {/* every film runs under a pointer; on a touch screen only the one in the frame */}
                    <Reel brand={b} k={k} playing={playing && (fine || k === focus)} />
                    <span className={s.grade} />
                    <span className={s.logoBox} data-wide={b.logo.wide || undefined}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={s.logo} src={b.logo.dark} alt="" draggable={false} style={{ scale: String(OPTICAL[b.logo.src] ?? 1) }} />
                    </span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* the viewfinder itself */}
          {geo.w > 0 && (
            <motion.div
              className={s.finder}
              style={{ x: wx, y: wy, width: geo.fw, height: geo.fh }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={up ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.04 }}
              transition={up ? { ...RISE, delay: 0.7 } : { duration: 0.3, ease: EASE }}
              aria-hidden="true"
            >
              <i className={`${s.corner} ${s.tl}`} />
              <i className={`${s.corner} ${s.tr}`} />
              <i className={`${s.corner} ${s.bl}`} />
              <i className={`${s.corner} ${s.br}`} />
              <span className={s.rec}>
                <b /> REC
              </span>
              <span ref={tcRef} className={s.tc}>
                00:00:00:00
              </span>
              <span className={s.cross} />
              {fb && (
                <span className={s.label}>
                  <span>{fb.name}</span>
                  <span>
                    {pad2(fb.films.length)} {fb.films.length === 1 ? "film" : "films"} <i>→</i>
                  </span>
                </span>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* into the brand: the frame opens to the whole screen on its film */}
      <AnimatePresence>{opening && <Opening key="opening" brand={brands[opening.k]} rect={opening.rect} />}</AnimatePresence>

      {/* its opening titles */}
      <AnimatePresence>
        {titles !== null && (
          <BrandTitles
            key={brands[titles].name}
            brand={brands[titles]}
            reduce={reduce}
            paused={page !== null}
            onPlay={onPlay}
            onPage={(i) => setPage({ k: titles, start: i })}
            onClose={closeTitles}
          />
        )}
      </AnimatePresence>

      {/* a film's page, from the titles: the brand's films as the folders' line */}
      {page && (
        <FileView
          key={`${brands[page.k].name}-${page.start}`}
          drawer={{ no: pad2(page.k + 1), label: brands[page.k].name, short: brands[page.k].name, films: brands[page.k].films, cat: drawer.cat }}
          start={page.start}
          reduce={reduce}
          onPlay={onPlay}
          onCursor={onCursor}
          onClosed={() => setPage(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// a brand's films in its part of the wall: a brand with several cuts from one
// to the next on its own beat, the next already running out of sight
// ---------------------------------------------------------------------------
function Reel({ brand, k, playing }: { brand: Brand; k: number; playing: boolean }) {
  const reels = useMemo(() => brand.films.map(reelOf), [brand]);
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (!playing || reels.length < 2) return;
    let id = 0;
    const t = window.setTimeout(() => {
      setAt((i) => (i + 1) % reels.length);
      id = window.setInterval(() => setAt((i) => (i + 1) % reels.length), CUT_MS);
    }, CUT_MS + k * CUT_STEP_MS);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [playing, reels.length, k]);
  // keyed by file: the next becomes the one showing without reloading
  const shown = [at, (at + 1) % reels.length].filter((j, i, a) => a.indexOf(j) === i);
  return (
    <span className={s.media}>
      {reels[at].still && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={reels[at].still} className={s.pic} src={reels[at].still} alt="" draggable={false} decoding="async" />
      )}
      {playing &&
        shown.map((j, i) => (
          <video
            key={reels[j].clip}
            ref={startMuted}
            className={`${s.pic} ${s.film} ${i === 0 ? s.filmOn : ""}`}
            src={reels[j].clip}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
          />
        ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// the frame opens to the whole screen (a clip, so nothing stretches) on the
// brand's first film, its logo coming up in the middle
// ---------------------------------------------------------------------------
function Opening({ brand, rect }: { brand: Brand; rect: DOMRect }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 0;
  const reel = reelOf(brand.films[0]);
  return (
    <motion.div
      className={s.opening}
      initial={{ clipPath: `inset(${rect.top}px ${vw - rect.right}px ${vh - rect.bottom}px ${rect.left}px)` }}
      animate={{ clipPath: `inset(${band}px 0px 0px 0px)` }}
      exit={{ opacity: 0, transition: { duration: 0.4, ease: EASE } }}
      transition={OPEN}
      aria-hidden="true"
    >
      <span className={s.openingFilm}>
        {reel.still && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={s.pic} src={reel.still} alt="" draggable={false} />
        )}
        <video ref={startMuted} className={s.pic} src={reel.clip} autoPlay muted loop playsInline />
        <span className={s.grade} />
      </span>
      <motion.span
        className={s.openingLogo}
        style={{ top: band }}
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...OPEN, delay: 0.1 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logo.dark} alt="" draggable={false} style={{ scale: String(OPTICAL[brand.logo.src] ?? 1) }} />
      </motion.span>
    </motion.div>
  );
}
