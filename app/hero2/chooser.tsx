"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FORMATS, Ratio, type FormatKey } from "../hero13/formats";
import type { Preview } from "../work/_shared/data";
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
}) {
  const rise = (delay: number) => (show ? { y: "0%", transition: { duration: 0.9, ease: EASE, delay } } : undefined);
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
            transition={{ duration: 0.45, ease: EASE }}
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
                transition={{ duration: 0.45, ease: EASE }}
                onPointerEnter={(e) => e.pointerType === "mouse" && onHover?.(fm.key)}
                onFocus={(e) => e.currentTarget.matches(":focus-visible") && onHover?.(fm.key)}
                onClick={() => onOpen?.(fm.key)}
              >
                {word}
                {corners}
              </motion.button>
            ) : (
              <motion.span className={styles.name} initial={false} animate={fade} transition={{ duration: 0.45, ease: EASE }}>
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
              animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 0.12 } }}
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

function BeyondMosaic({ on, pool }: { on: boolean; pool: string[] }) {
  const n = MOSAIC.cols * MOSAIC.rows;
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
            {on && MOSAIC.live.includes(i) && <video src={src} muted loop playsInline autoPlay preload="auto" />}
          </span>
        );
      })}
    </div>
  );
}

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
}) {
  const portrait = useSyncExternalStore(subscribePortrait, () => window.matchMedia("(max-aspect-ratio: 1/1)").matches, () => false);
  const base = reduce ? 0 : first ? (logo ? LOGO_T.names : INTRO.names) : 0.1;
  const stageRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Partial<Record<FormatKey, HTMLElement | null>>>({});
  const filmRefs = useRef<Partial<Record<FormatKey, HTMLDivElement | null>>>({});
  const boxRefs = useRef<Partial<Record<FormatKey, HTMLDivElement | null>>>({});
  const videoRefs = useRef<Partial<Record<FormatKey, HTMLVideoElement | null>>>({});
  const poolAt = useRef(-1);
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
    // a fresh film every time a word opens, never the one just seen
    else if (v && pool?.length && !open) {
      poolAt.current = (poolAt.current + 1 + Math.floor(Math.random() * Math.max(1, pool.length - 2))) % pool.length;
      v.src = pool[poolAt.current];
      v.poster = "";
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
  }, [up, open, reduce]);

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
      className={styles.stage}
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
        />
      </div>

      {/* the films: a window each, with the line in paper inside it */}
      {INDEX_FILMS.map((f) => (
        <div
          key={f.key}
          ref={(el) => {
            filmRefs.current[f.key] = el;
          }}
          className={`${styles.film} ${styles[`film_${f.key.replace("x", "by")}`]}`}
          aria-hidden="true"
        >
          <div
            ref={(el) => {
              boxRefs.current[f.key] = el;
            }}
            className={styles.filmBox}
          >
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
            {shownFilm[f.key] && <BrandTag film={shownFilm[f.key]!} />}
          </div>
          {f.key === "beyond" && pool?.length ? <BeyondMosaic on={up === "beyond" && !open} pool={pool} /> : null}
          {f.key === "beyond" && <BeyondStats on={up === "beyond" && !open} />}
          <div className={styles.namesWrap}>
            <Names ink={false} show={show} base={base} reduce={reduce} ready={ready} active={shown} />
          </div>
        </div>
      ))}

      {logo && !reduce ? <IntroLogo /> : intro && <IntroMark />}
    </motion.div>
  );
}
