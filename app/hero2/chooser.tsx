"use client";

import { Fragment, memo, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { AnimatePresence, animate as fmAnimate, motion } from "framer-motion";
import { FORMATS, Ratio, type FormatKey } from "../hero13/formats";
import type { Preview, WallFilm } from "../work/_shared/data";
import styles from "./hero2.module.css";

export const EASE = [0.16, 1, 0.3, 1] as const;
export const EASE_CINE = [0.76, 0, 0.24, 1] as const;
// The entrance, in seconds: the outline frame traces round, the mark rises
// into it, lifts out as the frame un-traces; the names rise.
export const INTRO = { draw: 0.2, letters: 0.95, leave: 2.5, names: 3.1 };
// The Open Frame intro (hero 5) never leaves: once drawn it glides to the top-left corner and
// stays as the page's mark, and the words rise while it's still moving — one continuous move.
export const LOGO_T = { dock: 2.25, glide: 1.25, names: 2.55 };

// ===========================================================================
// INTRO — the mark, on the white, in outline. A hairline frame traces itself
// round (top, right, bottom, left); 1, 6, X, 9 rise into it in ink and
// & BEYOND follows; then the letters lift out and the frame un-traces.
// ===========================================================================
const MARK_CHARS = ["1", "6", "X", "9"];
const EDGES = ["top", "right", "bottom", "left"] as const;

// The Open Frame logo (brand bible): the frame draws itself from where the name
// crosses it, round and up, stopping short; 16X9 rises across its open corner,
// & BEYOND settles in under it. It holds, then the frame unwinds and the name lifts away.
const LOGO = { w: 1244, h: 600, frame: "M 735 492 H 8 V 8 H 1040 V 292", len: 727 + 484 + 1032 + 284 };

function IntroLogo() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);
  const [dock, setDock] = useState({ x: 0, y: 0, scale: 1 });
  useEffect(() => {
    const t = window.setTimeout(() => setDocked(true), LOGO_T.dock * 1000);
    return () => window.clearTimeout(t);
  }, []);
  // where it comes to rest: the top-left corner, at the size of a page's logo
  useEffect(() => {
    const measure = () => {
      const el = boxRef.current;
      const stage = el?.parentElement?.getBoundingClientRect();
      if (!el || !stage) return;
      const w = el.offsetWidth;
      const vw = stage.width;
      const d = Math.min(132, Math.max(92, vw * 0.08));
      const pad = Math.min(48, Math.max(20, vw * 0.034));
      const dh = (d * LOGO.h) / LOGO.w;
      setDock({ x: pad + d / 2 - vw / 2, y: pad + dh / 2 - stage.height / 2, scale: d / w });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return (
    <motion.div
      ref={boxRef}
      className={styles.introLogo}
      aria-hidden="true"
      initial={false}
      animate={docked ? dock : { x: 0, y: 0, scale: 1 }}
      transition={{ duration: LOGO_T.glide, ease: [0.65, 0, 0.2, 1] }}
    >
      <svg viewBox={`0 0 ${LOGO.w} ${LOGO.h}`} overflow="visible">
        <defs>
          <clipPath id="introNameClip">
            <rect x="700" y="300" width="600" height="212" />
          </clipPath>
          <clipPath id="introSubClip">
            <rect x="740" y="512" width="520" height="80" />
          </clipPath>
        </defs>
        <motion.path
          d={LOGO.frame}
          fill="none"
          stroke="currentColor"
          strokeWidth="16"
          strokeDasharray={LOGO.len}
          initial={{ strokeDashoffset: LOGO.len }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ delay: INTRO.draw, duration: 1.3, ease: [0.45, 0, 0.2, 1] }}
        />
        <g clipPath="url(#introNameClip)">
          <motion.text
            x="732"
            y="500"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="700"
            fontSize="232"
            textLength="503"
            lengthAdjust="spacingAndGlyphs"
            fill="currentColor"
            initial={{ y: 220 }}
            animate={{ y: 0 }}
            transition={{ delay: INTRO.letters - 0.1, duration: 0.95, ease: EASE }}
          >
            16X9
          </motion.text>
        </g>
        <g clipPath="url(#introSubClip)">
          <motion.text
            x="758"
            y="572"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="700"
            fontSize="70"
            textLength="472"
            lengthAdjust="spacing"
            fill="currentColor"
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            transition={{ delay: INTRO.letters + 0.2, duration: 0.9, ease: EASE }}
          >
            &amp; BEYOND
          </motion.text>
        </g>
      </svg>
    </motion.div>
  );
}

function IntroMark() {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOut(true), INTRO.leave * 1000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className={styles.intro} aria-hidden="true">
      {EDGES.map((side, i) => {
        const across = side === "top" || side === "bottom";
        return (
          <motion.span
            key={side}
            className={`${styles.introEdge} ${styles[`introEdge_${side}`]}`}
            initial={across ? { scaleX: 0 } : { scaleY: 0 }}
            animate={across ? { scaleX: out ? 0 : 1 } : { scaleY: out ? 0 : 1 }}
            transition={
              out
                ? { delay: 0.25 + (3 - i) * 0.08, duration: 0.45, ease: EASE_CINE }
                : { delay: INTRO.draw + i * 0.2, duration: 0.4, ease: EASE_CINE }
            }
          />
        );
      })}
      <span className={styles.introMark}>
        {MARK_CHARS.map((c, i) => (
          <span key={i} className={styles.introMask}>
            <motion.span
              className={styles.introChar}
              initial={{ y: "112%" }}
              animate={{ y: out ? "-112%" : "0%" }}
              transition={
                out
                  ? { delay: i * 0.04, duration: 0.5, ease: EASE_CINE }
                  : { delay: INTRO.letters + i * 0.07, duration: 0.8, ease: EASE }
              }
            >
              {c}
            </motion.span>
          </span>
        ))}
        <span className={`${styles.introMask} ${styles.introSub}`}>
          <motion.span
            className={styles.introChar}
            initial={{ y: "112%" }}
            animate={{ y: out ? "-112%" : "0%" }}
            transition={
              out ? { delay: 0.16, duration: 0.5, ease: EASE_CINE } : { delay: INTRO.letters + 0.4, duration: 0.8, ease: EASE }
            }
          >
            &amp; BEYOND
          </motion.span>
        </span>
      </span>
    </div>
  );
}

// ===========================================================================
// THE INDEX — the white page, with 16x9 / 9x16 / BEYOND set as one quiet
// line at its centre.
//
// Pointing at a word opens it like a window: the film in that word's format
// grows out of the word itself, from the word's own box to its full frame
// (16:9, 9:16, or for Beyond the whole screen), and the word turns to paper
// where the film lies under it. Moving to another word, the first film folds
// back into its word as the next one opens out of its own. A small caption
// under the line names the format.
//
// Clicking a word opens its film the rest of the way, to the edges of the
// screen, and the page fades into that format's room.
//
// Each film is a full-page layer clipped (clip-path: inset) to the window
// showing; its paper-coloured copy of the line rides inside the same clip,
// so the two always match. Only the clip and opacity move.
// ===========================================================================
type IndexFilm = { key: FormatKey; desk: string; small: string; poster: string; smallPoster: string };
const INDEX_FILMS: IndexFilm[] = [
  { key: "16x9", desk: "/hero14/films/wide-1080.mp4", small: "/hero14/films/wide-540.mp4", poster: "/hero14/films/wide.webp", smallPoster: "/hero14/films/wide-540.webp" },
  { key: "9x16", desk: "/hero14/films/vertical-m.mp4", small: "/hero14/films/vertical-m.mp4", poster: "/hero14/films/vertical-m.webp", smallPoster: "/hero14/films/vertical-m.webp" },
  { key: "beyond", desk: "/hero14/films/beyond-1080.mp4", small: "/hero14/films/beyond-m.mp4", poster: "/hero14/films/beyond.webp", smallPoster: "/hero14/films/beyond-m.webp" },
];
// how a window moves: opening out of its word, folding back into it, opening to the edges
const MOVE = {
  open: "clip-path 0.95s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s linear",
  close: "clip-path 0.6s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.3s linear 0.3s",
  launch: "clip-path 1s cubic-bezier(0.76, 0, 0.24, 1), opacity 0.18s linear",
};
const PAD = 8; // px round a word: the window it opens from
type WindowState = "off" | "frame" | "full";

const subscribePortrait = (cb: () => void) => {
  const mq = window.matchMedia("(max-aspect-ratio: 1/1)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** The line of words. `ink` is the real, interactive one; the others are its paper copies inside the films. */
function Names({
  ink,
  show,
  base,
  reduce,
  ready,
  active,
  wordRefs,
  onHover,
  onOpen,
  idle,
  springy = false,
}: {
  ink: boolean;
  show: boolean;
  base: number;
  reduce: boolean;
  ready: boolean;
  active: FormatKey | null;
  wordRefs?: RefObject<Partial<Record<FormatKey, HTMLElement | null>>>;
  onHover?: (k: FormatKey) => void;
  onOpen?: (k: FormatKey) => void;
  /** under the line while nothing is pointed at: what to do here */
  idle?: string;
  /** hero 6: the words, their corners and the caption move on springs */
  springy?: boolean;
}) {
  // hero 6 moves on springs: the corners snap in with a little give, the words settle
  const SPRING = { type: "spring", visualDuration: 0.5, bounce: 0.28 } as const;
  const SOFT = { type: "spring", visualDuration: 0.45, bounce: 0 } as const;
  const rise = (delay: number) =>
    show ? { y: "0%", transition: springy ? { type: "spring" as const, visualDuration: 0.9, bounce: 0.18, delay } : { duration: 0.9, ease: EASE, delay } } : undefined;
  const f = active ? FORMATS.find((x) => x.key === active) : null;
  return (
    <div className={`${styles.names} ${ink ? "" : styles.namesPaper}`} aria-hidden={ink ? undefined : true}>
      {FORMATS.map((fm, i) => {
        const on = active === fm.key;
        const fade = { opacity: !show ? 0 : active && !on ? 0.22 : 1 };
        const word = (
          <span className={styles.nameMask}>
            <motion.span
              className={styles.nameWord}
              initial={ink && !reduce ? { y: "112%" } : false}
              animate={ink ? rise(base + i * 0.08) : undefined}
            >
              <Ratio text={fm.label} className={styles.fmtX} />
            </motion.span>
          </span>
        );
        const corners = (["tl", "tr", "bl", "br"] as const).map((c) => (
          <motion.span
            key={c}
            className={`${styles.finder} ${styles[`finder_${c}`]}`}
            aria-hidden="true"
            initial={false}
            animate={{ opacity: on ? 1 : 0, x: on ? 0 : c.includes("l") ? -6 : 6, y: on ? 0 : c.includes("t") ? -6 : 6 }}
            transition={springy ? SPRING : { duration: 0.45, ease: EASE }}
          />
        ));
        return (
          <Fragment key={fm.key}>
            {i > 0 && (
              <span className={styles.slashMask} aria-hidden="true">
                <motion.span
                  className={styles.slash}
                  initial={ink && !reduce ? { y: "112%" } : false}
                  animate={{ ...(ink && show ? { y: "0%" } : {}), opacity: !show ? 0 : active ? 0.22 : 1 }}
                  transition={{ y: { duration: 0.9, ease: EASE, delay: base + 0.2 + i * 0.06 }, opacity: { duration: 0.45 } }}
                >
                  /
                </motion.span>
              </span>
            )}
            {ink ? (
              <motion.button
                ref={(el: HTMLButtonElement | null) => {
                  if (wordRefs) wordRefs.current[fm.key] = el;
                }}
                type="button"
                className={styles.name}
                aria-label={`${fm.label}: ${fm.line}`}
                disabled={!ready || !show}
                style={{ pointerEvents: show ? "auto" : "none" }}
                initial={false}
                animate={fade}
                transition={springy ? SOFT : { duration: 0.45, ease: EASE }}
                onPointerEnter={(e) => e.pointerType === "mouse" && onHover?.(fm.key)}
                onFocus={(e) => e.currentTarget.matches(":focus-visible") && onHover?.(fm.key)}
                onClick={() => onOpen?.(fm.key)}
              >
                {word}
                {corners}
              </motion.button>
            ) : (
              <motion.span className={styles.name} initial={false} animate={fade} transition={springy ? SOFT : { duration: 0.45, ease: EASE }}>
                {word}
                {corners}
              </motion.span>
            )}
          </Fragment>
        );
      })}

      {/* the caption: the format pointed at, in a line */}
      <span className={styles.cap} aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          {f && show && (
            <motion.span
              key={f.key}
              className={styles.capIn}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: springy ? { ...SPRING, delay: 0.08 } : { duration: 0.5, ease: EASE, delay: 0.12 } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
            >
              <i>{f.no}</i>
              <span className={styles.capRule} />
              {f.line}
            </motion.span>
          )}
          {!f && idle && show && ready && (
            <motion.span
              key="idle"
              className={`${styles.capIn} ${styles.capIdle}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay: 0.15 } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
            >
              {idle}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BEYOND: the long-term work. Pointing at it dims its film and counts up what
// those partnerships add up to. Change the numbers here.
// ---------------------------------------------------------------------------
export const BEYOND_STATS = [
  { n: 4, suffix: "", label: "Years" },
  { n: 120, suffix: "+", label: "Films" },
  { n: 3, suffix: "", label: "Partners" },
];

function CountUp({ to, run, delay }: { to: number; run: boolean; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!run) {
      el.textContent = "0";
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay * 1000;
    const dur = 1400;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = String(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run, delay]);
  return <span ref={ref}>0</span>;
}

// Beyond's mosaic: the window fills with small tiles of different projects, lighting up one
// after another like time passing. Stills everywhere; a few tiles play their film.
const MOSAIC = { cols: 7, rows: 4, live: [2, 9, 11, 17, 24] };
const stillOf = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");

// Hero 5: each window fills with a grid of films in its own frame — 16:9 tiles in 16x9's
// window, 9:16 in 9x16's — and Beyond's screen with a mix of every shape. Stills everywhere,
// only a few tiles play (decoding is what costs), and they light up in a sweep from the left.
// Each time a window opens it deals a different set of films.
const GRID = {
  "16x9": { cols: 5, rows: 6, live: [12, 7, 17] },
  "9x16": { cols: 9, rows: 4, live: [13, 4, 22] },
} as const;

// How many of a grid's tiles may have their film running: none while the window is still
// opening or the pointer is only passing over the word (switching fast stays light), then they
// come on one by one so no frame has to spin up several decoders at once.
const LIVE = { after: 520, every: 45 };

// What this device can carry: how many films a window may play at once, and whether 16x9's cuts
// can keep a second film running under each tile. Phones and low-end machines get fewer films (the
// rest of the tiles stay as stills); reduced motion or data saving, none.
type Device = { budget: number; rich: boolean };
const DESKTOP: Device = { budget: 40, rich: true };
function readDevice(): Device {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || nav.connection?.saveData) return { budget: 0, rich: false };
  const small = window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)").matches;
  const lowEnd = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  if (small) return { budget: lowEnd ? 4 : 8, rich: false };
  return lowEnd ? { budget: 12, rich: false } : DESKTOP;
}
const noopSub = () => () => {};
let deviceCache: Device | null = null;
function useDevice(): Device {
  return useSyncExternalStore(noopSub, () => (deviceCache ??= readDevice()), () => DESKTOP);
}

/** A grid's film: muted and inline as iOS needs to autoplay it (the attribute, not just the
 *  property), started as soon as it's in the page. */
function Clip({ src, className }: { src: string; className?: string }) {
  return (
    <video
      ref={(v) => {
        if (!v) return;
        v.muted = true;
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        v.play().catch(() => {});
      }}
      className={className}
      src={src}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      disablePictureInPicture
    />
  );
}

function useLiveCount(on: boolean, wanted: number) {
  const { budget } = useDevice();
  const total = Math.min(wanted, budget);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on || total === 0) return;
    let k = 0;
    let id = 0;
    const t = window.setTimeout(() => {
      id = window.setInterval(() => {
        k += 1;
        setN(k);
        if (k >= total) window.clearInterval(id);
      }, LIVE.every);
    }, LIVE.after);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
      setN(0);
    };
  }, [on, total]);
  return on ? n : 0;
}

// every still the grids can show, fetched once up front so a window never opens on an empty tile
function usePreloadStills(pool: string[] | undefined) {
  useEffect(() => {
    if (!pool?.length) return;
    const t = window.setTimeout(() => pool.forEach((src) => (new Image().src = stillOf(src))), 1200);
    return () => window.clearTimeout(t);
  }, [pool]);
}

// hero 6's 16x9: once the wall is up, its tiles cut — every beat a few of them switch, instantly,
// to another film and another brand, like a gallery of monitors being cut live. Each tile keeps
// its own rhythm (a cycle of 4 to 7 beats, offset), so the cuts fall across the wall, never all at once.
const CUT = { beat: 800, cycles: [4, 6, 5, 7, 4, 6, 5, 7, 6, 4, 7, 5] };
function useBeat(on: boolean) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setBeat((b) => b + 1), CUT.beat);
    return () => window.clearInterval(id);
  }, [on]);
  return beat;
}

// the viewport, kept current, so a grid can count the rows it needs to cover the screen
const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
let viewCache = { w: 1440, h: 900 };
function useViewport() {
  return useSyncExternalStore(
    subscribeResize,
    () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w !== viewCache.w || h !== viewCache.h) viewCache = { w, h };
      return viewCache;
    },
    () => viewCache
  );
}
/** 16x9's wall: three across (two on a portrait screen), and as many rows of exact 16:9 tiles as
 *  it takes to cover the screen's height. */
function coverGrid({ w, h }: { w: number; h: number }) {
  const cols = w / h < 1 ? 2 : 3;
  const rows = Math.max(2, Math.ceil(h / ((w / cols) * (9 / 16))));
  return { cols, rows };
}

// the wall's films are the brands' own once there are enough of them cut (else stand-ins, with logos dealt round)
const WALL_MIN = 6;

const FormatGrid = memo(function FormatGrid({
  kind,
  on,
  pool,
  turn,
  big = false,
  wall,
}: {
  kind: "16x9" | "9x16";
  on: boolean;
  pool: string[];
  turn: number;
  big?: boolean;
  /** hero 6's 16x9: the real films, each with its own brand */
  wall?: WallFilm[];
}) {
  // hero 6: larger tiles — 16x9 three across, 9x16 five across — enough rows to cover the screen
  const view = useViewport();
  const g = big ? (kind === "9x16" ? { cols: 5, rows: 2 } : coverGrid(view)) : GRID[kind];
  const n = g.cols * g.rows;
  const live = useLiveCount(on && big, n);
  const { budget, rich } = useDevice();
  const cuts = big && kind === "16x9" && budget > 0;
  // the beat only runs once the films are on (not while the window is opening)
  const beat = useBeat(on && cuts && live > 0 && live >= Math.min(n, budget));
  const marks = kind === "9x16" ? ACCOUNT_MARKS : BRAND_MARKS;
  const films = big && kind === "16x9" && wall && wall.length >= WALL_MIN ? wall : null;
  return (
    <div className={`${styles.fgrid} ${on ? styles.fgridOn : ""} ${big ? styles.cine : ""}`} style={{ gridTemplateColumns: `repeat(${g.cols}, 1fr)` }}
      data-kind={kind} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const cycle = CUT.cycles[i % CUT.cycles.length];
        const v = cuts ? Math.floor((beat + (i * 2) % cycle) / cycle) : 0; // how many times this tile has cut
        const pick = (k: number) => (i * 5 + turn * 3 + k * 7) % (films ? films.length : pool.length);
        const film = films ? films[pick(v)] : null;
        const src = film ? film.clip : pool[pick(v)];
        const nextSrc = films ? films[pick(v + 1)].clip : pool[pick(v + 1)];
        const still = film ? film.shot : stillOf(src);
        const mark: Mark | null = film
          ? { name: film.brand || film.title, src: film.logo }
          : big
            ? marks[(i * 5 + turn + v * 5) % marks.length]
            : null;
        const col = i % g.cols;
        const row = Math.floor(i / g.cols);
        return (
          <span key={i} className={styles.fcell} style={{ transitionDelay: on ? `${0.15 + col * 0.07 + row * 0.04}s` : "0s" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {still && <img src={still} alt="" draggable={false} />}
            {cuts && rich ? (
              // two films per tile: the one showing, and the next already loaded and running out of
              // sight, so a cut is instant and lands on a playing film (keyed by file, the next one
              // becomes the shown one without reloading)
              i < live &&
              (nextSrc === src ? [src] : [src, nextSrc]).map((f, j) => (
                <Clip key={f} className={j === 0 ? styles.cutOn : styles.cutNext} src={f} />
              ))
            ) : (
              (big ? i < live : on) && <Clip src={src} />
            )}
            {mark && <TileLogo mark={mark} />}
          </span>
        );
      })}
    </div>
  );
});

// hero 6: a brand at the centre of every tile — the brands' logos (a mask, drawn in paper) or
// their names; 9x16's tiles carry the accounts the studio runs
type Mark = { name: string; src?: string; round?: boolean };
const BRAND_MARKS: Mark[] = [
  { name: "Toyota", src: "/brands/toyota.svg" },
  { name: "Nike", src: "/brands/nike.svg" },
  { name: "Cleveland Clinic" },
  { name: "Etihad", src: "/brands/etihad-airways.svg" },
  { name: "Museum of the Future" },
  { name: "BMW", src: "/brands/bmw.svg" },
  { name: "Etisalat" },
  { name: "what3words", src: "/brands/what3words.svg" },
  { name: "MBC" },
  { name: "Masdar" },
  { name: "Rotana" },
  { name: "Special Olympics" },
];
const ACCOUNT_MARKS: Mark[] = [
  { name: "DED Cafe", src: "/work/accounts/ded_cafe.webp", round: true },
  { name: "Amer Lounge", src: "/work/accounts/amerlounge.webp", round: true },
  { name: "Business Lounge", src: "/work/accounts/businesslounge.webp", round: true },
  { name: "Business Avenue", src: "/work/accounts/businessavenue.webp", round: true },
];

// hero 6's 9x16: made for the scroll, so it scrolls — columns of whole 9:16 reels, each column a
// feed being swiped: a reel holds, then the next one swipes up into its place, the columns out of
// step with each other. Each column is one CSS animation (transform only); each card carries its
// account at the top, as in the app. The films come on one by one once the window has opened.
const REEL_ACCOUNTS = [
  { handle: "ded_cafe", logo: "/work/accounts/ded_cafe.webp" },
  { handle: "amerlounge", logo: "/work/accounts/amerlounge.webp" },
  { handle: "businesslounge.ae", logo: "/work/accounts/businesslounge.webp" },
  { handle: "businessavenue.ae", logo: "/work/accounts/businessavenue.webp" },
];
const FEEDS = 5; // columns
// each column's place in its swipe cycle, so the columns swipe out of step
const feedDelay = (c: number) => -c * 1.7 - (c % 2) * 0.9;
const PER_FEED = 4; // reels in a column (shown twice, so the swipe loops without a seam)

const ReelStrip = memo(function ReelStrip({ on, pool, turn }: { on: boolean; pool: string[]; turn: number }) {
  const live = useLiveCount(on, FEEDS * PER_FEED * 2);
  let n = 0;
  return (
    <div className={`${styles.reelStrip} ${styles.cine} ${on ? styles.reelOn : ""}`} aria-hidden="true">
      {Array.from({ length: FEEDS }, (_, c) => (
        <div key={c} className={styles.feed}>
          <div className={styles.feedTrack} style={{ animationDelay: `${feedDelay(c)}s` }}>
            {[0, 1].map((copy) =>
              Array.from({ length: PER_FEED }, (_, i) => {
                const k = c * PER_FEED + i;
                const src = pool[(k * 7 + 2 + turn) % pool.length];
                const a = REEL_ACCOUNTS[(c + i) % REEL_ACCOUNTS.length];
                const idx = n++;
                return (
                  <span key={`${copy}-${i}`} className={styles.reelCard}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stillOf(src)} alt="" draggable={false} />
                    {idx < live && <Clip src={src} />}
                    <span className={styles.reelHead}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.logo} alt="" draggable={false} />
                      {a.handle}
                    </span>
                    {/* the reel's time, as in the app: a hairline that fills while it holds */}
                    <span className={styles.reelBar} style={{ animationDelay: `${feedDelay(c)}s` }} />
                  </span>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

function TileLogo({ mark }: { mark: Mark }) {
  if (mark.round && mark.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.tlRound} src={mark.src} alt="" draggable={false} />;
  if (mark.src) return <span className={styles.tlMask} style={{ maskImage: `url(${mark.src})`, WebkitMaskImage: `url(${mark.src})` }} />;
  return <span className={styles.tlWord}>{mark.name}</span>;
}

// Beyond: a moving board — columns of cards drifting up and down past each other: films in
// every shape, the brands we've worked with, the numbers, and what Beyond covers. Each column
// is one CSS animation on its own layer (nothing re-lays out), and the cards repeat once so the
// loop never shows a seam.
type Card =
  | { t: "film"; shape: "w" | "t" | "s" }
  | { t: "logo"; src: string; name: string; round?: boolean }
  | { t: "word"; name: string }
  | { t: "stat"; n: string; label: string }
  | { t: "line"; text: string; no?: string };
const BRANDS: Card[] = [
  { t: "logo", src: "/brands/toyota.svg", name: "Toyota" },
  { t: "logo", src: "/brands/etihad-airways.svg", name: "Etihad" },
  { t: "logo", src: "/brands/bmw.svg", name: "BMW" },
  { t: "logo", src: "/brands/what3words.svg", name: "what3words" },
  { t: "logo", src: "/brands/nike.svg", name: "Nike" },
  { t: "word", name: "Cleveland Clinic" },
  { t: "word", name: "Museum of the Future" },
  { t: "word", name: "Etisalat" },
  { t: "word", name: "MBC" },
  { t: "logo", src: "/work/accounts/ded_cafe.webp", name: "DED Cafe", round: true },
  { t: "logo", src: "/work/accounts/businessavenue.webp", name: "Business Avenue", round: true },
];
const LINES = ["Projection mapping", "Brand activations", "AR & VR", "Immersive rooms", "Experiential"];
const COLUMNS: Card[][] = [
  [{ t: "film", shape: "t" }, BRANDS[0], { t: "line", text: LINES[0] }, { t: "film", shape: "s" }],
  [{ t: "stat", n: "120+", label: "Films" }, { t: "film", shape: "w" }, BRANDS[4], { t: "film", shape: "t" }],
  [{ t: "film", shape: "s" }, BRANDS[8], { t: "film", shape: "w" }, { t: "line", text: LINES[1] }],
  [BRANDS[1], { t: "film", shape: "t" }, { t: "stat", n: "4", label: "Years" }, BRANDS[5]],
  [{ t: "line", text: LINES[2] }, { t: "film", shape: "w" }, BRANDS[2], { t: "film", shape: "s" }],
  [{ t: "film", shape: "t" }, BRANDS[6], { t: "line", text: LINES[3] }, BRANDS[9]],
  [BRANDS[3], { t: "film", shape: "s" }, { t: "stat", n: "3", label: "Partners" }, { t: "film", shape: "w" }],
];

// hero 6's refined board: mostly films; the brands as their logos only, in paper on black; the
// numbers and what Beyond covers in plain type — one palette (black, paper, the films' own colour)
const logoCard = (name: string, src: string): Card => ({ t: "logo", src, name });
const REFINED_COLUMNS: Card[][] = [
  [{ t: "film", shape: "t" }, logoCard("Toyota", "/brands/toyota.svg"), { t: "film", shape: "s" }, { t: "line", no: "01", text: "Projection mapping" }],
  [{ t: "line", no: "02", text: "Brand activations" }, { t: "film", shape: "w" }, { t: "stat", n: "120+", label: "Films" }, { t: "film", shape: "t" }],
  [{ t: "film", shape: "s" }, logoCard("Etihad", "/brands/etihad-airways.svg"), { t: "film", shape: "t" }, logoCard("Nike", "/brands/nike.svg")],
  [{ t: "line", no: "03", text: "Immersive experiences" }, { t: "film", shape: "w" }, { t: "film", shape: "s" }, { t: "stat", n: "4", label: "Years" }],
  [logoCard("BMW", "/brands/bmw.svg"), { t: "film", shape: "t" }, { t: "film", shape: "w" }, { t: "line", no: "04", text: "AR & VR" }],
  [{ t: "film", shape: "w" }, { t: "line", no: "05", text: "Experiential events" }, logoCard("what3words", "/brands/what3words.svg"), { t: "film", shape: "t" }],
  [{ t: "film", shape: "s" }, { t: "stat", n: "3", label: "Partners" }, { t: "film", shape: "t" }, logoCard("Toyota", "/brands/toyota.svg")],
];

const BeyondBento = memo(function BeyondBento({ on, pool, turn, refined = false }: { on: boolean; pool: string[]; turn: number; refined?: boolean }) {
  let f = turn * 3;
  let film = 0; // the films counted in order, so they can come on one by one
  const live = useLiveCount(on && refined, 40);
  return (
    <div className={`${styles.bento} ${on ? styles.bentoOn : ""} ${refined ? `${styles.bentoRefined} ${styles.cine}` : ""}`} aria-hidden="true">
      {(refined ? REFINED_COLUMNS : COLUMNS).map((col, c) => (
        <div key={c} className={styles.bCol} style={{ transitionDelay: on ? `${0.05 + c * 0.07}s` : "0s" }}>
          <div className={`${styles.bTrack} ${c % 2 ? styles.bDown : ""}`} style={{ animationDuration: `${38 + (c % 3) * 9}s` }}>
            {[0, 1].map((copy) =>
              col.map((card, i) => {
                const key = `${copy}-${i}`;
                if (card.t === "film") {
                  const src = pool[f++ % pool.length];
                  return (
                    <span key={key} className={`${styles.bCard} ${styles.bFilm} ${styles[`bShape_${card.shape}`]}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={stillOf(src)} alt="" draggable={false} />
                      {(refined ? film++ < live : on) && <Clip src={src} />}
                    </span>
                  );
                }
                if (card.t === "logo")
                  return (
                    <span key={key} className={`${styles.bCard} ${styles.bLogoCard}`}>
                      {card.round ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={styles.bRound} src={card.src} alt={card.name} draggable={false} />
                      ) : (
                        <span className={styles.bMask} style={{ maskImage: `url(${card.src})`, WebkitMaskImage: `url(${card.src})` }} />
                      )}
                      <i>{card.name}</i>
                    </span>
                  );
                if (card.t === "word")
                  return (
                    <span key={key} className={`${styles.bCard} ${styles.bWord}`}>
                      <b>{card.name}</b>
                      <i>Client</i>
                    </span>
                  );
                if (card.t === "stat")
                  return (
                    <span key={key} className={`${styles.bCard} ${styles.bStat}`}>
                      <b>{card.n}</b>
                      <i>{card.label}</i>
                    </span>
                  );
                return (
                  <span key={key} className={`${styles.bCard} ${styles.bLine}`}>
                    {refined && <i>{card.no ?? String(LINES.indexOf(card.text) + 1).padStart(2, "0")} — Beyond</i>}
                    <b>{card.text}</b>
                  </span>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
});


const BeyondMosaic = memo(function BeyondMosaic({ on, pool }: { on: boolean; pool: string[] }) {
  const n = MOSAIC.cols * MOSAIC.rows;
  const live = useLiveCount(on, MOSAIC.live.length);
  return (
    <div className={`${styles.mosaic} ${on ? styles.mosaicOn : ""}`} style={{ gridTemplateColumns: `repeat(${MOSAIC.cols}, 1fr)` }} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const src = pool[(i * 7) % pool.length];
        // the light sweeps from the left: column by column, a little shuffle within each
        const col = i % MOSAIC.cols;
        const row = Math.floor(i / MOSAIC.cols);
        const d = col * 0.12 + ((row * 3 + col) % 3) * 0.04;
        return (
          <span key={i} className={styles.tileM} style={{ transitionDelay: on ? `${d}s` : "0s" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stillOf(src)} alt="" draggable={false} />
            {MOSAIC.live.includes(i) && MOSAIC.live.indexOf(i) < live && <Clip src={src} />}
          </span>
        );
      })}
    </div>
  );
});

function BeyondStats({ on }: { on: boolean }) {
  return (
    <div className={`${styles.stats} ${on ? styles.statsOn : ""}`} aria-hidden="true">
      {BEYOND_STATS.map((s, i) => (
        <div key={s.label} className={styles.stat} style={{ transitionDelay: on ? `${0.35 + i * 0.1}s` : "0s" }}>
          <b>
            <CountUp to={s.n} run={on} delay={0.35 + i * 0.1} />
            {s.suffix}
          </b>
          <i>{s.label}</i>
        </div>
      ))}
    </div>
  );
}

// seconds into a real film its preview starts: past the opening slate and black
const PREVIEW_START_S = 8;

// the brand on a real film's window: its logo (or its name), and the film's title
function BrandTag({ film }: { film: Preview }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={film.src}
        className={styles.brandTag}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.45, duration: 0.6, ease: EASE } }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      >
        {film.logo ? (
          <span className={styles.brandLogo} style={{ maskImage: `url(${film.logo})`, WebkitMaskImage: `url(${film.logo})` }} role="img" aria-label={film.brand} />
        ) : film.brand ? (
          <span className={styles.brandWord}>{film.brand}</span>
        ) : null}
        <span className={styles.brandTitle}>{film.title}</span>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Chooser({
  open,
  launch,
  show,
  first,
  reduce,
  ready,
  active,
  onHover,
  onOpen,
  pool,
  logo = false,
  idle,
  previews,
  grid = false,
  refined = false,
  wall,
  band = false,
}: {
  /** a room is open: the index has opened its film to the edges and stepped aside */
  open: boolean;
  /** the room that's open (or was last): its film is the one that opens to the edges */
  launch: FormatKey | null;
  /** the words are up (not under the menu, not on the open room) */
  show: boolean;
  /** the first time, the words wait for the mark to leave */
  first: boolean;
  reduce: boolean;
  ready: boolean;
  /** the format pointed at (or, on touch, the one taking its turn) */
  active: FormatKey | null;
  onHover: (k: FormatKey | null) => void;
  onOpen: (k: FormatKey) => void;
  /** films to draw from: each time a word opens, its window shows the next one (hero 5) */
  pool?: string[];
  /** the intro draws the Open Frame logo (brand bible) in place of the outline mark */
  logo?: boolean;
  /** under the line while nothing is pointed at */
  idle?: string;
  /** real films for a format's window, each with its brand: a different one each time it opens */
  previews?: Partial<Record<FormatKey, Preview[]>>;
  /** hero 5: each window opens on a grid of films in its frame (Beyond: a mix of every shape) */
  grid?: boolean;
  /** hero 6: 9x16's cards larger, and Beyond's board in its refined, tilted cut */
  refined?: boolean;
  /** hero 6: the real 16x9 films for the 16x9 wall, each with its brand */
  wall?: WallFilm[];
  /** hero 7: the middle of the screen stays paper — a band holding the words — and the preview
   *  opens above and below it, the paper parting like a curtain drawn up and down */
  band?: boolean;
}) {
  const portrait = useSyncExternalStore(subscribePortrait, () => window.matchMedia("(max-aspect-ratio: 1/1)").matches, () => false);
  const base = reduce ? 0 : first ? (logo ? LOGO_T.names : INTRO.names) : 0.1;
  const stageRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Partial<Record<FormatKey, HTMLElement | null>>>({});
  const filmRefs = useRef<Partial<Record<FormatKey, HTMLDivElement | null>>>({});
  const boxRefs = useRef<Partial<Record<FormatKey, HTMLDivElement | null>>>({});
  const videoRefs = useRef<Partial<Record<FormatKey, HTMLVideoElement | null>>>({});
  const poolAt = useRef(-1);
  const prevUp = useRef<FormatKey | null>(null);
  usePreloadStills(grid ? pool : undefined);
  // the real film each window is showing, and where each format is in its list
  const [shownFilm, setShownFilm] = useState<Partial<Record<FormatKey, Preview>>>({});
  const previewAt = useRef<Partial<Record<FormatKey, number>>>({});

  // the mark leaves the page once its entrance has played
  const [intro, setIntro] = useState(!reduce);
  useEffect(() => {
    if (reduce || logo) return;
    const t = window.setTimeout(() => setIntro(false), (INTRO.names + 0.3) * 1000);
    return () => window.clearTimeout(t);
  }, [reduce, logo]);

  // the film that's up: the launched one while a room is open, else the word pointed at
  const up: FormatKey | null = open ? launch : active;
  // how many times a window has opened: each grid deals a different set of films
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new deal each time a word opens
    if (up && grid && !refined) setTurn((t) => t + 1);
  }, [up, grid, refined]);

  // its film plays; the others stop once they've folded away
  useEffect(() => {
    const v = up ? videoRefs.current[up] : null;
    // a format with real films: the next one, from a few seconds in (past the slate), with its brand
    const list = up ? previews?.[up] : undefined;
    if (v && up && list?.length && !open) {
      const n = previewAt.current[up] ?? Math.floor(Math.random() * list.length) - 1;
      const at = (n + 1) % list.length;
      previewAt.current[up] = at;
      const film = list[at];
      v.src = `${film.src}#t=${PREVIEW_START_S}`;
      v.poster = "";
      setShownFilm((m) => ({ ...m, [up]: film }));
    }
    // a fresh film every time a word opens: the window that just closed loads its next clip
    // while it's out of sight (see below), so opening only ever plays a clip that's ready
    const prev = prevUp.current;
    prevUp.current = up;
    if (prev && prev !== up && pool?.length && !grid) {
      const pv = videoRefs.current[prev];
      window.setTimeout(() => {
        if (!pv || prevUp.current === prev) return;
        poolAt.current = (poolAt.current + 1 + Math.floor(Math.random() * Math.max(1, pool.length - 2))) % pool.length;
        pv.preload = "auto";
        pv.poster = "";
        pv.src = pool[poolAt.current];
        pv.load();
      }, 750);
    }
    if (v) {
      v.muted = true;
      v.setAttribute("muted", "");
      v.play().catch(() => {});
    }
    const t = window.setTimeout(() => {
      INDEX_FILMS.forEach(({ key }) => {
        if (key !== up) videoRefs.current[key]?.pause();
      });
    }, 1000);
    return () => window.clearTimeout(t);
  }, [up]); // eslint-disable-line react-hooks/exhaustive-deps -- a new film only when the word changes

  // the windows: each film opens out of its word to its frame (or to the edges), and folds back
  useEffect(() => {
    const place = (animate: boolean) => {
      const stage = stageRef.current?.getBoundingClientRect();
      if (!stage) return;
      const inset = (r: { top: number; right: number; bottom: number; left: number }, pad = 0) =>
        `inset(${(r.top - stage.top - pad).toFixed(1)}px ${(stage.right - r.right - pad).toFixed(1)}px ${(stage.bottom - r.bottom - pad).toFixed(1)}px ${(r.left - stage.left - pad).toFixed(1)}px)`;
      for (const { key } of INDEX_FILMS) {
        const el = filmRefs.current[key];
        const word = wordRefs.current[key];
        const box = boxRefs.current[key];
        if (!el || !word || !box) continue;
        const to: WindowState = up === key ? (open ? "full" : "frame") : "off";
        const from = (el.dataset.state as WindowState | undefined) ?? "off";
        const clipFor = (s: WindowState) =>
          s === "full" ? "inset(0px 0px 0px 0px)" : s === "frame" ? inset(box.getBoundingClientRect()) : inset(word.getBoundingClientRect(), PAD);
        el.style.zIndex = to === "off" ? "2" : "3";
        // Grid mode (hero 6): every window is the whole screen, so it doesn't clip open out of its
        // word — it crossfades in with a slight settle, on opacity and transform only, which the
        // compositor runs without repainting a single tile. Sweeping fast across the words is then
        // just layers fading over each other.
        if (grid) {
          const on = to !== "off";
          el.style.clipPath = "none";
          el.style.willChange = "opacity, transform";
          // (a closed window stays painted, only transparent: opening it again never has to
          // repaint its tiles.) Driven by framer-motion on opacity and transform only — both run
          // on the compositor; the settle is a spring.
          el.style.transition = "none";
          el.style.visibility = "visible";
          if (!animate) {
            el.style.opacity = on ? "1" : "0";
            el.style.transform = on ? "none" : "scale(1.04)";
          } else if (reduce) {
            fmAnimate(el, { opacity: on ? 1 : 0, transform: "none" }, { duration: 0.3, ease: "linear" });
          } else if (on) {
            fmAnimate(
              el,
              { opacity: 1, transform: "scale(1)" },
              { opacity: { duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }, transform: { type: "spring", visualDuration: 0.85, bounce: 0.12 } }
            );
          } else if (up) {
            // another window is coming in over it: it stays as it is under that one and goes once
            // it's covered, so only one layer is ever fading
            fmAnimate(el, { opacity: 0, transform: "scale(1.04)" }, { duration: 0, delay: 0.42 });
          } else {
            fmAnimate(
              el,
              { opacity: 0, transform: "scale(1.04)" },
              { opacity: { duration: 0.45, ease: "easeOut", delay: 0.05 }, transform: { type: "spring", visualDuration: 0.6, bounce: 0 } }
            );
          }
          el.dataset.state = to;
          continue;
        }
        if (!animate || reduce) {
          el.style.transition = reduce ? "opacity 0.3s linear" : "none";
          el.style.clipPath = clipFor(to);
          el.style.opacity = to === "off" ? "0" : "1";
          el.dataset.state = to;
          continue;
        }
        if (to === from) continue;
        if (from === "off") {
          // it opens from its word: start there, unseen
          el.style.transition = "none";
          el.style.clipPath = clipFor("off");
          el.style.opacity = "0";
          void el.offsetWidth;
        }
        el.style.transition = to === "off" ? MOVE.close : to === "full" ? MOVE.launch : MOVE.open;
        el.style.clipPath = clipFor(to);
        el.style.opacity = to === "off" ? "0" : "1";
        el.dataset.state = to;
      }
    };
    place(true);
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [up, open, reduce, grid]);

  // the pointer leaving the line (not just a word) lets the film go
  const leave = useRef(0);
  const point = (k: FormatKey | null) => {
    window.clearTimeout(leave.current);
    if (k) onHover(k);
    else leave.current = window.setTimeout(() => onHover(null), 160);
  };
  useEffect(() => () => window.clearTimeout(leave.current), []);

  const shown = open ? null : active;
  return (
    <motion.div
      ref={stageRef}
      className={`${styles.stage} ${band ? styles.stageBand : ""} ${band && up ? styles.stageBandOpen : ""}`}
      initial={false}
      animate={{ opacity: open ? 0 : 1 }}
      transition={reduce ? { duration: 0 } : open ? { delay: 0.95, duration: 0.6, ease: EASE } : { duration: 0.5, ease: EASE }}
      style={{ pointerEvents: open ? "none" : "auto" }}
    >
      {/* the line, in ink on the paper */}
      <div className={styles.namesWrap} onPointerLeave={() => point(null)}>
        <Names
          ink
          show={show}
          base={base}
          reduce={reduce}
          ready={ready}
          active={shown}
          wordRefs={wordRefs}
          onHover={(k) => point(k)}
          onOpen={onOpen}
          idle={idle}
          springy={refined}
        />
      </div>

      {/* the films: a window each, with the line in paper inside it */}
      {INDEX_FILMS.map((f) => (
        <div
          key={f.key}
          ref={(el) => {
            filmRefs.current[f.key] = el;
          }}
          className={`${styles.film} ${styles[`film_${f.key.replace("x", "by")}`]} ${grid ? styles.filmGrid : ""}`}
          aria-hidden="true"
        >
          <div
            ref={(el) => {
              boxRefs.current[f.key] = el;
            }}
            className={styles.filmBox}
          >
            {grid && pool?.length && f.key !== "beyond" ? (
              refined && f.key === "9x16" ? (
                <ReelStrip on={up === f.key && !open} pool={pool} turn={turn} />
              ) : (
                <FormatGrid kind={f.key as "16x9" | "9x16"} on={up === f.key && !open} pool={pool} turn={turn} big={refined} wall={wall} />
              )
            ) : (
            <video
              ref={(el) => {
                videoRefs.current[f.key] = el;
              }}
              src={portrait ? f.small : f.desk}
              poster={portrait ? f.smallPoster : f.poster}
              muted
              loop
              playsInline
              preload={ready ? "auto" : "metadata"}
              disablePictureInPicture
            />
            )}
            {shownFilm[f.key] && <BrandTag film={shownFilm[f.key]!} />}
          </div>
          {f.key === "beyond" && pool?.length ? (
            grid ? (
              <BeyondBento on={up === "beyond" && !open} pool={pool} turn={turn} refined={refined} />
            ) : (
              <BeyondMosaic on={up === "beyond" && !open} pool={pool} />
            )
          ) : null}
          {f.key === "beyond" && !grid && <BeyondStats on={up === "beyond" && !open} />}
          <div className={styles.namesWrap}>
            <Names ink={false} show={show} base={base} reduce={reduce} ready={ready} active={shown} springy={refined} />
          </div>
        </div>
      ))}

      {/* hero 7: the paper parts above and below a band that keeps the words; on a click the band
          parts too and the film is the whole screen */}
      {band && (
        <div className={`${styles.band7} ${up ? styles.band7Open : ""} ${open ? styles.band7Launch : ""}`} aria-hidden="true">
          <div className={styles.band7Top} />
          <div className={styles.band7Mid}>
            <span className={styles.band7Meta}>
              <i>{up ? String(FORMATS.findIndex((x) => x.key === up) + 1).padStart(2, "0") : "00"}</i> / {String(FORMATS.length).padStart(2, "0")}
            </span>
            <span className={`${styles.band7Meta} ${styles.band7MetaR}`}>Stories beyond the frame</span>
          </div>
          <div className={styles.band7Bot} />
        </div>
      )}

      {logo && !reduce ? <IntroLogo /> : intro && <IntroMark />}
    </motion.div>
  );
}
