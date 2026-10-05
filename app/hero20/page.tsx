"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "../hero7/project-view";
import { posterFor } from "../hero7/wall-playback";
import Drawer from "../hero11/drawer";
import styles from "./hero20.module.css";

// ===========================================================================
// HERO 20 — "Cut on the grid".
//
// The screen is the name: a hairline grid of exactly 16 columns by 9 rows
// (9 by 16 when the screen stands upright) over full-bleed film. One word is
// set across the grid in heavy lowercase, a letter per run of cells, and the
// cell edges crop the letters as if the word were cut into the film.
//
// Every few seconds the house cuts to the next film: the new footage opens
// cell by cell in a wave, the letters roll out of their cells and the next
// word rolls into a new composition. The cursor lights the cell it is over
// (and leaves a short trail of light behind it); a click opens the film in
// the player. Scroll, swipe, the arrow keys or Prev/Next step through cuts.
//
// Type is Archivo (the site font, from the layout). No serif, no italic.
// ===========================================================================

// ---------------------------------------------------------------- copy ----
/** One word per film, in order; it repeats if there are more films than words. */
const WORDS = ["beyond", "motion", "story", "frames", "light", "craft"];
const STATEMENT = ["Bringing brands to life", "Film & video production, Dubai"];
const NAV = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];
// replace with the studio's own handles
const SOCIAL = [
  { label: "Instagram", href: "https://www.instagram.com/" },
  { label: "YouTube", href: "https://www.youtube.com/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/" },
];
const LOGO_SRC = "/logo.png";

// -------------------------------------------------------------- timing ----
const SHOT_MS = 6500; // how long each film holds before the next cut
const CUT_LOCK_MS = 950; // no new cut while one is still landing
const WAVE = { spread: 0.55, cell: 0.5 }; // s: how far the wave lags across the grid, how long a cell takes to open
const INTRO = { films: 450, word: 1050, ui: 1500, ready: 2200 }; // ms after load
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

// ---------------------------------------------------------------- grid ----
type Grid = { vw: number; vh: number; cols: number; rows: number; portrait: boolean };
type Cell = { c: number; r: number };

const gridFor = (vw: number, vh: number): Grid => {
  const portrait = vw < vh * 0.95;
  return { vw, vh, cols: portrait ? 9 : 16, rows: portrait ? 16 : 9, portrait };
};
// lines and boxes snap to whole pixels from the same rounding, so a crop always
// lands exactly on a grid line
const gx = (g: Grid, c: number) => Math.round((c * g.vw) / g.cols);
const gy = (g: Grid, r: number) => Math.round((r * g.vh) / g.rows);
const box = (g: Grid, c: number, r: number, w = 1, h = 1) => ({
  left: gx(g, c),
  top: gy(g, r),
  width: gx(g, c + w) - gx(g, c),
  height: gy(g, r + h) - gy(g, r),
});

// ------------------------------------------------------- the composition ----
// Advance widths of Archivo Bold lowercase, in em. Each letter gets a whole
// number of columns from its width, so the word is set to the grid.
const ADV: Record<string, number> = {
  a: 0.58, b: 0.6, c: 0.58, d: 0.61, e: 0.59, f: 0.33, g: 0.6, h: 0.6, i: 0.27, j: 0.26, k: 0.57, l: 0.27,
  m: 0.88, n: 0.6, o: 0.62, p: 0.6, q: 0.61, r: 0.37, s: 0.56, t: 0.35, u: 0.6, v: 0.55, w: 0.8, x: 0.57,
  y: 0.55, z: 0.52,
};
// Ink heights of the same face, in em: x-height, ascender, descender.
const XH = 0.54;
const ASC_H = 0.73;
const DESC_H = 0.19;
const ASC = "bdfhiklt"; // their tops are what makes them read: never crop them away
const DESC = "gjpqy"; // likewise their tails
const BASELINE = 0.86; // the baseline sits this far down a letter's cells
const SHIFT = [0.04, 0.22, -0.2, 0.12, -0.08, 0.2, -0.14]; // per-letter nudge, so the cells crop each letter differently
const DRIFT = [-1, 0.6, -0.4, 1, -0.8, 0.5, -0.6]; // per-letter response to the cursor

type Slot = { ch: string; c: number; r: number; w: number; h: number };
type Layout = { F: number; slots: Slot[]; credit: { c: number; r: number; w: number } };

function compose(word: string, comp: number, g: Grid): Layout {
  const colW = g.vw / g.cols;
  const rowH = g.vh / g.rows;
  const chars = [...word];
  const n = chars.length;
  const h = g.portrait ? 3 : 2; // a letter is this many rows tall
  const maxW = g.portrait ? 4 : 3;
  let F = Math.min(((g.portrait ? 3 : 2) * colW) / 0.66, rowH * h * 1.36); // an "o" fills 2 (or 3) columns; an ascender fits its cells
  const widths = () => chars.map((ch) => Math.min(maxW, Math.max(1, Math.ceil(((ADV[ch] ?? 0.6) * F) / colW - 0.12))));
  let ws = widths();
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

  if (!g.portrait) {
    while (sum(ws) > 12) {
      F *= 0.94;
      ws = widths();
    }
    const T = sum(ws);
    const c0 = Math.max(2, Math.floor((16 - T) / 2));
    const k = (i: number) => (n > 1 ? Math.round((i * 5) / (n - 1)) : 0);
    let c = c0;
    const slots = chars.map((ch, i) => {
      // 0: a stair down, like a word falling into frame; 1: a stair up; 2: a step (a row apart, so it still reads)
      const r = comp === 0 ? 1 + k(i) : comp === 1 ? 6 - k(i) : i % 2 ? 4 : 3;
      const s = { ch, c, r, w: ws[i], h };
      c += ws[i];
      return s;
    });
    const end = c0 + T;
    const credit = comp === 0 ? { c: end - 3, r: 1, w: 3 } : comp === 1 ? { c: c0, r: 1, w: 3 } : { c: c0, r: 7, w: 4 };
    return { F, slots, credit };
  }

  // upright: two letters to a band, three bands, a free row between bands
  const slots: Slot[] = [];
  const bands = Math.ceil(n / 2);
  for (let p = 0; p < bands; p++) {
    const a = 2 * p;
    const bw = ws[a] + (ws[a + 1] ?? 0);
    const left = 0;
    const right = 9 - bw;
    const mid = Math.floor((9 - bw) / 2);
    const order = comp === 0 ? [left, mid, right] : comp === 1 ? [right, mid, left] : [mid, right, left];
    const off = order[p % 3];
    const r = 3 + 4 * p;
    slots.push({ ch: chars[a], c: off, r, w: ws[a], h });
    if (a + 1 < n) slots.push({ ch: chars[a + 1], c: off + ws[a], r, w: ws[a + 1], h });
  }
  const credit = comp === 0 ? { c: 4, r: 6, w: 5 } : comp === 1 ? { c: 0, r: 6, w: 5 } : { c: 0, r: 10, w: 5 };
  return { F, slots, credit };
}

/** Where a letter's baseline sits in its cells: x-height letters are cropped
 *  freely, but an ascender or a tail always stays in view so the word reads. */
function baselineOf(ch: string, i: number, h: number, F: number) {
  let y = h * (BASELINE + SHIFT[i % SHIFT.length]);
  if (ASC.includes(ch)) y = Math.min(Math.max(y, ASC_H * F - 0.03 * h), h * 1.08);
  if (DESC.includes(ch)) y = Math.max(Math.min(y, h * 1.04 - DESC_H * F), XH * F - 0.06 * h);
  return y;
}

// ------------------------------------------------------- the film cut ----
/** The incoming film's clip: every cell opens from its centre, in a wave from `o`. */
function wavePath(g: Grid, t: number, o: Cell) {
  const maxD = Math.hypot(Math.max(o.c, g.cols - 1 - o.c), Math.max(o.r, g.rows - 1 - o.r)) || 1;
  let d = "";
  let done = true;
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const delay = (Math.hypot(c - o.c, r - o.r) / maxD) * WAVE.spread;
      const p = Math.min(1, Math.max(0, (t - delay) / WAVE.cell));
      if (p < 1) done = false;
      if (p <= 0) continue;
      const e = 1 - Math.pow(1 - p, 3);
      const x0 = gx(g, c);
      const y0 = gy(g, r);
      const cw = gx(g, c + 1) - x0;
      const ch = gy(g, r + 1) - y0;
      const w = cw * e + (p >= 1 ? 1 : 0); // a hair of overlap once open, so no seams
      const h = ch * e + (p >= 1 ? 1 : 0);
      d += `M${(x0 + (cw - w) / 2).toFixed(1)} ${(y0 + (ch - h) / 2).toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h${(-w).toFixed(1)}z`;
    }
  }
  return { d: d || "M0 0", done };
}

// ---------------------------------------------------------------- menu ----
// The hero 11 drawer, wiped down over the grid like a sheet (as in hero 13).
function Menu({ open, reduce, onClose }: { open: boolean; reduce: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="menu"
          className={styles.menuSheet}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)" }}
          animate={
            reduce
              ? { opacity: 1, transition: { duration: 0 } }
              : { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, ease: EASE_CINE } }
          }
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0 } }
              : { clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.75, ease: EASE_CINE } }
          }
        >
          <Drawer onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- hero ----
// The variant depends on the URL and today's date, so it's read on the client only.
const noopSubscribe = () => () => {};
export default function Hero20({ variantId }: { variantId?: string }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const variant = useMemo<HeroVariant | null>(
    () =>
      isClient
        ? resolveVariant(new Date(), variantId ?? new URLSearchParams(window.location.search).get("hero"))
        : null,
    [isClient, variantId]
  );
  if (!variant) return <section className={styles.root} aria-hidden="true" />;
  return <GridHero key={variant.id} variant={variant} />;
}

type WordLayer = { id: number; index: number; comp: number; dir: number; out: boolean; intro: boolean };

function GridHero({ variant }: { variant: HeroVariant }) {
  const clips = variant.clips;
  const total = clips.length;
  const reduce = !!useReducedMotion();

  const [grid, setGrid] = useState<Grid>(() => gridFor(window.innerWidth, window.innerHeight));
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [layers, setLayers] = useState<WordLayer[]>([]);
  const [uiOn, setUiOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [project, setProject] = useState<OpenProject | null>(null);

  const rootRef = useRef<HTMLElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null]);
  const progressRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const flashRefs = useRef<(HTMLDivElement | null)[]>([]);
  const clockRef = useRef<HTMLSpanElement>(null);

  const gridRef = useRef(grid);
  const readyRef = useRef(false);
  const pausedRef = useRef(false);
  const reduceRef = useRef(reduce);
  const indexRef = useRef(0);
  const compRef = useRef(0);
  const idRef = useRef(0);
  const frontRef = useRef(-1); // which film layer is showing (-1 before the intro)
  const busyUntilRef = useRef(0);
  const elapsedRef = useRef(0);
  const cornerRef = useRef(0);
  const waveRef = useRef<{ back: number; t0: number; o: Cell } | null>(null);
  const hoverCellRef = useRef<Cell | null>(null);
  const flashNextRef = useRef(0);
  const ptrRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);
  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);
  useEffect(() => {
    pausedRef.current = menuOpen || !!project;
  }, [menuOpen, project]);

  // ---- films: load, cut, preload ----
  const load = useCallback((v: HTMLVideoElement | null, src: string) => {
    if (!v || v.dataset.src === src) return;
    v.dataset.src = src;
    v.poster = posterFor(src);
    v.src = src;
  }, []);

  const finishWave = useCallback(
    (back: number) => {
      const front = frontRef.current;
      if (front >= 0 && front !== back) videoRefs.current[front]?.pause();
      frontRef.current = back;
      // the hidden layer quietly loads the film after this one
      const other = back === 0 ? 1 : 0;
      window.setTimeout(() => {
        if (frontRef.current === back) load(videoRefs.current[other], clips[(indexRef.current + 1) % total].src);
      }, 400);
    },
    [clips, load, total]
  );

  const startWave = useCallback(
    (filmIndex: number, o: Cell) => {
      const front = frontRef.current;
      const back = front === 0 ? 1 : 0;
      const layer = layerRefs.current[back];
      const v = videoRefs.current[back];
      if (!layer || !v) return;
      load(v, clips[filmIndex].src);
      try {
        if (v.readyState > 0) v.currentTime = 0;
      } catch {}
      v.play().catch(() => {});
      layer.style.zIndex = "2";
      if (front >= 0) layerRefs.current[front]!.style.zIndex = "1";
      if (waveRef.current) {
        // a cut landing on a cut: settle the last one at once
        layerRefs.current[waveRef.current.back]!.style.clipPath = "none";
        waveRef.current = null;
      }
      if (reduceRef.current) {
        layer.style.clipPath = "none";
        finishWave(back);
        return;
      }
      layer.style.clipPath = "path('M0 0')";
      waveRef.current = { back, t0: performance.now(), o };
    },
    [clips, finishWave, load]
  );

  const corner = useCallback((): Cell => {
    const g = gridRef.current;
    const k = cornerRef.current++ % 4;
    return [
      { c: 0, r: 0 },
      { c: g.cols - 1, r: g.rows - 1 },
      { c: g.cols - 1, r: 0 },
      { c: 0, r: g.rows - 1 },
    ][k];
  }, []);

  const go = useCallback(
    (d: 1 | -1, origin?: Cell) => {
      if (!readyRef.current || pausedRef.current) return;
      const now = performance.now();
      if (now < busyUntilRef.current) return;
      busyUntilRef.current = now + CUT_LOCK_MS;
      const next = (indexRef.current + d + total) % total;
      const comp = (compRef.current + 1) % 3;
      const id = ++idRef.current;
      indexRef.current = next;
      compRef.current = comp;
      elapsedRef.current = 0;
      setIndex(next);
      setDir(d);
      setLayers((ls) => [
        ...ls.filter((l) => !l.out).map((l) => ({ ...l, out: true, dir: d })),
        { id, index: next, comp, dir: d, out: false, intro: false },
      ]);
      window.setTimeout(() => setLayers((ls) => ls.filter((l) => !(l.out && l.id < id))), 1000);
      startWave(next, origin ?? corner());
    },
    [corner, startWave, total]
  );
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  }, [go]);

  // ---- intro: the grid draws, the first film opens from the centre, the word rises ----
  useEffect(() => {
    const vids = videoRefs.current;
    vids.forEach((v) => {
      if (!v) return;
      v.muted = true;
      v.defaultMuted = true;
    });
    load(vids[0], clips[0].src);
    const g = gridRef.current;
    const t = [
      window.setTimeout(
        () => startWave(0, { c: Math.floor(g.cols / 2), r: Math.floor(g.rows / 2) }),
        reduce ? 0 : INTRO.films
      ),
      window.setTimeout(
        () => setLayers([{ id: 0, index: 0, comp: 0, dir: 1, out: false, intro: true }]),
        reduce ? 0 : INTRO.word
      ),
      window.setTimeout(() => setUiOn(true), reduce ? 0 : INTRO.ui),
      window.setTimeout(
        () => {
          readyRef.current = true;
          setReady(true);
        },
        reduce ? 0 : INTRO.ready
      ),
    ];
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The letters lean against the cursor, each by its own amount, so every crop
  // breathes. Written straight to each letter: no style variable, no React.
  const applyDrift = useCallback(() => {
    const g = gridRef.current;
    const amp = (g.vh / g.rows) * 0.14;
    const y = ptrRef.current.y;
    wordRef.current?.querySelectorAll<HTMLElement>("[data-k]").forEach((el) => {
      el.style.transform = `translate3d(0, ${(y * Number(el.dataset.k) * amp).toFixed(2)}px, 0)`;
    });
  }, []);
  // new letters take the current lean as they mount
  useLayoutEffect(() => applyDrift(), [layers, grid, applyDrift]);

  // ---- one loop: the film wave, the shot clock, the cursor drift ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastScale = -1;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const w = waveRef.current;
      if (w) {
        const { d, done } = wavePath(gridRef.current, (now - w.t0) / 1000, w.o);
        const layer = layerRefs.current[w.back];
        if (layer) layer.style.clipPath = done ? "none" : `path('${d}')`;
        if (done) {
          waveRef.current = null;
          finishWave(w.back);
        }
      }

      if (readyRef.current && !pausedRef.current && !reduceRef.current) {
        elapsedRef.current += dt * 1000;
        if (elapsedRef.current >= SHOT_MS) goRef.current(1);
      }
      const s = readyRef.current && !reduceRef.current ? Math.min(1, elapsedRef.current / SHOT_MS) : 0;
      if (Math.abs(s - lastScale) > 0.0005 && progressRef.current) {
        progressRef.current.style.transform = `scaleX(${s.toFixed(4)})`;
        lastScale = s;
      }

      const p = ptrRef.current;
      const k = Math.min(1, dt * 3.2);
      const nx = p.x + (p.tx - p.x) * k;
      const ny = p.y + (p.ty - p.y) * k;
      if (Math.abs(nx - p.x) > 0.0002 || Math.abs(ny - p.y) > 0.0002) {
        p.x = nx;
        p.y = ny;
        const film = `translate3d(${(-p.x * 1.4).toFixed(3)}%, ${(-p.y * 1.4).toFixed(3)}%, 0) scale(1.06)`;
        videoRefs.current.forEach((v) => v && (v.style.transform = film));
        applyDrift();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [applyDrift, finishWave]);

  // ---- the films rest under the menu and the player ----
  useEffect(() => {
    const v = frontRef.current >= 0 ? videoRefs.current[frontRef.current] : null;
    if (!v) return;
    if (menuOpen || project) v.pause();
    else v.play().catch(() => {});
  }, [menuOpen, project]);

  // ---- resize, clock, wheel, keys ----
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setGrid(gridFor(window.innerWidth, window.innerHeight));
        hoverCellRef.current = null;
        hoverRef.current?.classList.remove(styles.hoverOn);
      });
    };
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dubai",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tickClock = () => {
      if (clockRef.current) clockRef.current.textContent = fmt.format(new Date());
    };
    tickClock();
    const clock = window.setInterval(tickClock, 1000);

    // a trackpad keeps sending wheel events after a flick; hold the lock until they stop
    let acc = 0;
    let accTimer = 0;
    let lockUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (pausedRef.current) return;
      const now = performance.now();
      if (now < lockUntil) {
        lockUntil = Math.max(lockUntil, now + 160);
        return;
      }
      acc += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      window.clearTimeout(accTimer);
      accTimer = window.setTimeout(() => (acc = 0), 220);
      if (Math.abs(acc) > 50) {
        const d = acc > 0 ? 1 : -1;
        acc = 0;
        lockUntil = now + 1000;
        goRef.current(d, hoverCellRef.current ?? undefined);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") goRef.current(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") goRef.current(-1);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(clock);
      window.clearTimeout(accTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // ---- the cursor: a lit cell that snaps across the grid, with a trail of light ----
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return;
    const hide = () => {
      hoverCellRef.current = null;
      hoverRef.current?.classList.remove(styles.hoverOn);
      dotRef.current?.classList.remove(styles.dotOn);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const g = gridRef.current;
      ptrRef.current.tx = (e.clientX / g.vw - 0.5) * 2;
      ptrRef.current.ty = (e.clientY / g.vh - 0.5) * 2;
      const dot = dotRef.current;
      if (dot) dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      const overUi = (e.target as Element | null)?.closest?.("a, button, [data-ui]");
      if (!readyRef.current || pausedRef.current || overUi) {
        hide();
        return;
      }
      dot?.classList.add(styles.dotOn);
      const c = Math.min(g.cols - 1, Math.max(0, Math.floor((e.clientX / g.vw) * g.cols)));
      const r = Math.min(g.rows - 1, Math.max(0, Math.floor((e.clientY / g.vh) * g.rows)));
      const prev = hoverCellRef.current;
      if (prev && prev.c === c && prev.r === r) return;
      hoverCellRef.current = { c, r };
      const hov = hoverRef.current;
      if (hov) {
        hov.style.transform = `translate3d(${gx(g, c)}px, ${gy(g, r)}px, 0)`;
        const w = `${gx(g, c + 1) - gx(g, c)}px`;
        const h = `${gy(g, r + 1) - gy(g, r)}px`;
        if (hov.style.width !== w) hov.style.width = w;
        if (hov.style.height !== h) hov.style.height = h;
        hov.classList.add(styles.hoverOn);
      }
      if (prev && !reduceRef.current) {
        const f = flashRefs.current[flashNextRef.current++ % flashRefs.current.length];
        if (f) {
          f.style.transform = `translate3d(${gx(g, prev.c)}px, ${gy(g, prev.r)}px, 0)`;
          const fw = `${gx(g, prev.c + 1) - gx(g, prev.c)}px`;
          const fh = `${gy(g, prev.r + 1) - gy(g, prev.r)}px`;
          if (f.style.width !== fw) f.style.width = fw;
          if (f.style.height !== fh) f.style.height = fh;
          f.animate([{ opacity: 0.2 }, { opacity: 0 }], { duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
        }
      }
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) hide();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
    };
  }, []);

  useEffect(() => {
    if (menuOpen || project) {
      hoverCellRef.current = null;
      hoverRef.current?.classList.remove(styles.hoverOn);
      dotRef.current?.classList.remove(styles.dotOn);
    }
  }, [menuOpen, project]);

  // ---- opening a film ----
  const openFilm = useCallback(
    (cell?: Cell) => {
      if (!readyRef.current || pausedRef.current) return;
      const g = gridRef.current;
      const at = cell ?? { c: Math.floor(g.cols / 2), r: Math.floor(g.rows / 2) };
      const v = frontRef.current >= 0 ? videoRefs.current[frontRef.current] : null;
      setProject({ index: indexRef.current, rect: box(g, at.c, at.r), time: v?.currentTime ?? 0 });
    },
    []
  );
  const closeProject = useCallback(() => setProject(null), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // tap or click opens the film under it; a swipe or drag cuts
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const onStageDown = (e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY };
  };
  const onStageUp = (e: React.PointerEvent) => {
    const d = downRef.current;
    downRef.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 40) {
      const main = Math.abs(dy) > Math.abs(dx) ? dy : dx;
      goRef.current(main < 0 ? 1 : -1);
    } else if (dist < 10) {
      const g = gridRef.current;
      openFilm({
        c: Math.min(g.cols - 1, Math.floor((e.clientX / g.vw) * g.cols)),
        r: Math.min(g.rows - 1, Math.floor((e.clientY / g.vh) * g.rows)),
      });
    }
  };

  // ---- render ----
  const g = grid;
  const clip = clips[index];
  const word = (i: number) => WORDS[i % WORDS.length];
  const current = layers.find((l) => !l.out);
  const credit = current ? compose(word(current.index), current.comp, g).credit : null;
  const at = (c: number, r: number, w = 1, h = 1): CSSProperties => box(g, c, r, w, h);
  const foot = g.portrait ? 14 : 8;
  const rowH = g.vh / g.rows;

  return (
    <section
      ref={rootRef}
      className={`${styles.root} ${uiOn ? styles.uiOn : ""} ${ready ? styles.ready : ""}`}
      aria-roledescription="carousel"
      aria-label="Selected films"
    >
      <h1 className={styles.sr}>
        16x9, a film and video production house in Dubai, UAE. {STATEMENT[0]}.
      </h1>

      {/* ================= the films ================= */}
      <div className={styles.films} aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} ref={(el) => void (layerRefs.current[i] = el)} className={styles.layer}>
            <video
              ref={(el) => void (videoRefs.current[i] = el)}
              className={styles.video}
              muted
              loop
              playsInline
              preload="auto"
            />
          </div>
        ))}
      </div>
      <div className={styles.grade} aria-hidden="true" />

      {/* ================= the grid ================= */}
      <div className={styles.lines} aria-hidden="true">
        {Array.from({ length: g.cols - 1 }, (_, i) => (
          <i
            key={`v${i}`}
            className={styles.v}
            style={{ left: gx(g, i + 1), "--d": `${0.08 + i * 0.035}s` } as CSSProperties}
          />
        ))}
        {Array.from({ length: g.rows - 1 }, (_, i) => (
          <i
            key={`h${i}`}
            className={styles.h}
            style={{ top: gy(g, i + 1), "--d": `${i * 0.05}s` } as CSSProperties}
          />
        ))}
        <div ref={progressRef} className={styles.progress} style={{ top: gy(g, foot) }} />
      </div>

      {/* the trail of light, and the lit cell */}
      <div className={styles.cursorLayer} aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} ref={(el) => void (flashRefs.current[i] = el)} className={styles.flash} />
        ))}
        <div ref={hoverRef} className={styles.hover}>
          <span className={styles.hoverLabel}>Play</span>
        </div>
      </div>

      {/* ================= the word ================= */}
      <div ref={wordRef} className={styles.word} aria-hidden="true">
        {layers.map((l) => {
          const lay = compose(word(l.index), l.comp, g);
          return lay.slots.map((s, i) => {
            const b = box(g, s.c, s.r, s.w, s.h);
            const base = baselineOf(s.ch, i + l.comp, b.height, lay.F);
            const vars: CSSProperties = b;
            const glyphVars = {
              "--d": l.out ? `${i * 0.025}s` : `${(l.intro ? 0 : 0.34) + i * 0.05}s`,
              "--from": l.dir > 0 ? "104%" : "-104%",
              "--to": l.dir > 0 ? "-104%" : "104%",
            } as CSSProperties;
            return (
              <div key={`${l.id}-${i}`} className={styles.slot} style={vars}>
                <div className={styles.drift} data-k={DRIFT[(i + l.comp) % DRIFT.length]}>
                  <svg
                    className={`${styles.glyph} ${l.out ? styles.out : styles.in}`}
                    style={glyphVars}
                    width={b.width}
                    height={b.height}
                    viewBox={`0 0 ${b.width} ${b.height}`}
                  >
                    <text x={b.width / 2} y={base} fontSize={lay.F} textAnchor="middle">
                      {s.ch}
                    </text>
                  </svg>
                </div>
              </div>
            );
          });
        })}
      </div>

      {/* ================= the stage: tap to play, swipe to cut ================= */}
      <div
        className={styles.stage}
        onPointerDown={onStageDown}
        onPointerUp={onStageUp}
        onPointerCancel={() => (downRef.current = null)}
        aria-hidden="true"
      />

      {/* ================= the cells' text ================= */}
      <div className={styles.ui}>
        <div className={`${styles.cell} ${styles.mid}`} style={at(0, 0, g.portrait ? 3 : 2)}>
          <Link href="/" className={styles.logo} aria-label="16x9 home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="16x9" style={{ height: Math.min(rowH * 0.56, 46) }} />
          </Link>
        </div>

        {!g.portrait && (
          <nav aria-label="Main">
            {NAV.map((n, i) => (
              <div key={n.href} className={`${styles.cell} ${styles.mid}`} style={at(3 + i * 2, 0, 2)}>
                <a href={n.href} className={styles.link}>
                  {n.label}
                </a>
              </div>
            ))}
          </nav>
        )}

        {!g.portrait && (
          <div className={`${styles.cell} ${styles.mid}`} style={at(12, 0, 3)} data-ui>
            <p className={styles.small}>
              Dubai <span ref={clockRef} className={styles.clock} />
            </p>
          </div>
        )}

        <div className={`${styles.cell} ${styles.mid} ${styles.end}`} style={at(g.cols - 1, 0)}>
          <button
            type="button"
            className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            disabled={!ready}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
            <span />
          </button>
        </div>

        {/* what the house does: in the footer row (upright: under the logo) */}
        <div
          className={`${styles.cell} ${g.portrait ? styles.top : styles.mid}`}
          style={g.portrait ? at(0, 1, 9) : at(3, foot, 6)}
          data-ui
        >
          <p className={styles.statement}>
            <span>{STATEMENT[0]}</span>
            <span className={styles.dim}>{STATEMENT[1]}</span>
          </p>
        </div>

        {/* the film's credit, set in a free cell beside the word; it opens the film */}
        <AnimatePresence initial={false}>
          {credit && current && (
            <motion.div
              key={current.id}
              className={styles.cell}
              style={at(credit.c, credit.r, credit.w)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay: current.intro ? 0.5 : 0.45 } }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              <button type="button" className={styles.credit} onClick={() => openFilm({ c: credit.c, r: credit.r })}>
                <span>{clips[current.index].title}</span>
                <span className={styles.dim}>
                  Watch the film, {clips[current.index].duration}
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* the counter */}
        <div
          className={`${styles.cell} ${styles.bottom}`}
          style={g.portrait ? at(0, foot, 3, 2) : at(0, foot, 2)}
          data-ui
          aria-live="polite"
        >
          <p className={styles.count}>
            <span className={styles.countNow} style={{ fontSize: Math.round(Math.min(rowH * (g.portrait ? 1.1 : 0.62), 72)) }}>
              <AnimatePresence initial={false} custom={dir}>
                <motion.span
                  key={index}
                  custom={dir}
                  variants={{
                    from: (d: number) => ({ y: d > 0 ? "100%" : "-100%" }),
                    at: { y: "0%", transition: { duration: 0.8, ease: EASE, delay: 0.2 } },
                    away: (d: number) => ({ y: d > 0 ? "-100%" : "100%", transition: { duration: 0.45, ease: EASE_CINE } }),
                  }}
                  initial="from"
                  animate="at"
                  exit="away"
                >
                  {pad2(index + 1)}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className={styles.countAll}>/{pad2(total)}</span>
            <span className={styles.sr}>
              Film {index + 1} of {total}: {clip.title}
            </span>
          </p>
        </div>

        {/* prev / next */}
        <div
          className={`${styles.cell} ${g.portrait ? styles.top : styles.mid} ${styles.end}`}
          style={g.portrait ? at(4, foot, 5) : at(11, foot, 3)}
        >
          <div className={styles.steps}>
            <button type="button" className={styles.link} onClick={() => go(-1)} aria-label="Previous film">
              Prev
            </button>
            <span className={styles.dim} aria-hidden="true">
              /
            </span>
            <button type="button" className={styles.link} onClick={() => go(1)} aria-label="Next film">
              Next
            </button>
          </div>
        </div>

        {/* follow */}
        <div
          className={`${styles.cell} ${g.portrait ? `${styles.bottom} ${styles.end}` : styles.mid}`}
          style={g.portrait ? at(3, foot + 1, 6) : at(14, foot, 2)}
        >
          <div className={`${styles.social} ${g.portrait ? "" : styles.stack}`}>
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} className={styles.link} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div ref={dotRef} className={styles.dot} aria-hidden="true" />

      <Menu open={menuOpen} reduce={reduce} onClose={closeMenu} />
      <AnimatePresence>
        {project && <ProjectView key="project" clips={clips} open={project} onClose={closeProject} />}
      </AnimatePresence>
    </section>
  );
}
