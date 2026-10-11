"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { Archivo } from "next/font/google";
import Link from "next/link";
import { VARIANTS, type Clip } from "@/components/Hero-config";
import styles from "./hero20.module.css";

// ===========================================================================
// HERO 20 — the index. A white page and three words: 16x9, 9x16, Beyond.
//
// 1. INDEX: the words rise out of their hairlines. Pointing at one rolls its
//    letters, steps the others back, and a stack of films in that format
//    follows the pointer (it leans into the way you move it, and flips
//    through the films). A hairline frame behind the words morphs to the
//    format's shape.
// 2. SCREENING ROOM: clicking a word wipes the dark room up over the page,
//    and the films fall into a grid in that format. The tabs re-cut the grid
//    into another format: every tile springs to its new shape and place.
//    A tile under the pointer turns toward it, its still drifts the other
//    way, a glare follows, and the film starts playing; the rest step back.
// 3. PLAYER: clicking a tile lifts its film out of the grid into the player
//    (a shared-element flight), with its own transport. Esc steps back out.
//
// Every per-frame value is a motion value (transform, opacity): pointing and
// following never re-render React.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

type FormatKey = "16x9" | "9x16" | "beyond";
type Format = {
  key: FormatKey;
  no: string;
  label: string;
  line: string;
  detail: string;
  /** width / height of every tile in this format */
  ratio: number;
  /** grid columns on a wide screen and on a phone */
  cols: number;
  colsSmall: number;
};

const FORMATS: Format[] = [
  { key: "16x9", no: "01", label: "16x9", line: "Films for the big screen", detail: "TVCs · Brand films · Documentaries", ratio: 16 / 9, cols: 3, colsSmall: 1 },
  { key: "9x16", no: "02", label: "9x16", line: "Stories made for the scroll", detail: "Social · Branded content · Creators", ratio: 9 / 16, cols: 5, colsSmall: 2 },
  { key: "beyond", no: "03", label: "Beyond", line: "Stories you step into", detail: "Immersive · Interactive · Experiential", ratio: 2.39, cols: 2, colsSmall: 1 },
];

const CLIPS: Clip[] = (VARIANTS.find((v) => v.id === "default") ?? VARIANTS[0]).clips;
/** the sharp 1280px still: /clips/clip-01.mp4 -> /clips/stills/clip-01.webp */
const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");
// These films are scope pictures with black bars baked into a 16:9 file
// (about 13% top and bottom). They're zoomed past the bars wherever the
// frame would otherwise show them.
const SCOPE = new Set(["clip-02", "clip-03", "clip-05", "clip-07", "clip-09", "clip-11", "clip-13", "clip-15"]);
const zoomFor = (src: string) => (SCOPE.has(src.replace(/^.*\/([^/]+)\.mp4$/i, "$1")) ? 1.37 : 1);
const pad2 = (n: number) => String(n).padStart(2, "0");

const LOGO_SRC = "/logo.png";
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const RISE = { type: "spring", stiffness: 90, damping: 17, mass: 1 } as const;
const RESHAPE = { type: "spring", stiffness: 170, damping: 26, mass: 1 } as const; // tiles re-cut into a new format
const SNAP = { type: "spring", stiffness: 260, damping: 24 } as const;
const FLY = { type: "spring", stiffness: 200, damping: 28, mass: 0.9 } as const; // a film lifting into the player

/** The x between the numbers, lowercase and lighter; every letter rolls on hover. */
function Roll({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`${styles.roll} ${className ?? ""}`} aria-label={text}>
      {[...text].map((c, i) => (
        <span key={i} className={`${styles.ch} ${c === "x" ? styles.x : ""}`} style={{ "--i": i } as CSSProperties} aria-hidden="true">
          <span>{c}</span>
          <span>{c}</span>
        </span>
      ))}
    </span>
  );
}

/** A small outline of the format's frame; Beyond is only its corners: the frame has opened. */
function Glyph({ k }: { k: FormatKey }) {
  if (k === "beyond")
    return (
      <svg className={styles.glyph} viewBox="0 0 26 12" aria-hidden="true">
        <path d="M0.5 3.5V0.5H4.5M21.5 0.5H25.5V3.5M25.5 8.5V11.5H21.5M4.5 11.5H0.5V8.5" fill="none" stroke="currentColor" />
      </svg>
    );
  const w = k === "16x9";
  return (
    <svg className={styles.glyph} viewBox={w ? "0 0 22 13" : "0 0 9 15"} aria-hidden="true">
      <rect x="0.5" y="0.5" width={w ? 21 : 8} height={w ? 12 : 14} fill="none" stroke="currentColor" />
    </svg>
  );
}

/** A box of the given ratio with the same area as a 16:9 box `base` px wide. */
const sized = (ratio: number, base: number) => {
  const area = base * ((base * 9) / 16);
  const w = Math.sqrt(area * ratio);
  return { width: w, height: w / ratio };
};

// ===========================================================================
// CURSOR — a dot that inverts whatever it's over. Over anything with
// data-cursor it opens into a disc with a word in it.
// ===========================================================================
function Cursor() {
  const [label, setLabel] = useState<string | null>(null);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 700, damping: 45, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 700, damping: 45, mass: 0.4 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set(e.clientX);
      y.set(e.clientY);
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-cursor]");
      setLabel(el?.dataset.cursor ?? null);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);
  const on = label !== null;
  return (
    <motion.div className={styles.cursor} style={{ x: sx, y: sy }} aria-hidden="true">
      <motion.div className={styles.cursorDot} animate={{ scale: on ? 1 : 0.14 }} transition={SNAP}>
        <AnimatePresence mode="wait">
          {on && (
            <motion.span
              key={label}
              className={styles.cursorText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ===========================================================================
// REVEAL — the films that follow the pointer over the index: three cards in
// the format's shape, fanned, flipping through the films. They lag behind on
// a spring and lean into the direction you move them.
// ===========================================================================
function Reveal({ fmt }: { fmt: Format | null }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 150, damping: 20, mass: 0.7 });
  const sy = useSpring(y, { stiffness: 150, damping: 20, mass: 0.7 });
  const vx = useVelocity(sx);
  const lean = useSpring(useTransform(vx, [-2400, 2400], [-16, 16], { clamp: true }), { stiffness: 220, damping: 22 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);

  // flip through the films while a word is pointed at
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!fmt) return;
    const id = window.setInterval(() => setN((v) => v + 1), 950);
    return () => window.clearInterval(id);
  }, [fmt]);

  const box = sized(fmt?.ratio ?? 16 / 9, 300);
  return (
    <motion.div className={styles.reveal} style={{ x: sx, y: sy, rotate: lean }} aria-hidden="true">
      <AnimatePresence>
        {fmt && (
          <motion.div
            key="stack"
            className={styles.stack}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1, transition: SNAP }}
            exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.3, ease: EASE } }}
          >
            {[2, 1, 0].map((layer) => (
              <motion.div
                key={layer}
                className={`${styles.card} ${fmt.key === "beyond" ? styles.cardOpen : ""}`}
                initial={false}
                animate={{
                  width: box.width,
                  height: box.height,
                  x: -box.width / 2 + (layer === 0 ? 0 : layer === 1 ? -box.width * 0.22 : box.width * 0.24),
                  y: -box.height / 2 + (layer === 0 ? 0 : layer === 1 ? box.height * 0.06 : -box.height * 0.05),
                  rotate: layer === 0 ? 0 : layer === 1 ? -9 : 8,
                  scale: layer === 0 ? 1 : 0.86,
                }}
                transition={{ ...RESHAPE, delay: layer * 0.04 }}
                style={{ zIndex: 3 - layer }}
              >
                <AnimatePresence initial={false}>
                  { }
                  <motion.img
                    key={(n + layer * 4) % CLIPS.length}
                    className={styles.cardImg}
                    src={stillFor(CLIPS[(n + layer * 4) % CLIPS.length].src)}
                    alt=""
                    initial={{ opacity: 0, scale: zoomFor(CLIPS[(n + layer * 4) % CLIPS.length].src) * 1.2 }}
                    animate={{
                      opacity: 1,
                      scale: zoomFor(CLIPS[(n + layer * 4) % CLIPS.length].src),
                      transition: { duration: 0.7, ease: EASE },
                    }}
                    exit={{ opacity: 0, transition: { duration: 0.5 } }}
                  />
                </AnimatePresence>
                {layer === 0 && (
                  <span className={styles.cardTag}>
                    {CLIPS[n % CLIPS.length].title}
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ===========================================================================
// INDEX — the white page and the three words
// ===========================================================================
function Index({ onOpen, away }: { onOpen: (i: number) => void; away: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const fmt = hover === null ? null : FORMATS[hover];
  const leave = useRef(0);
  const enter = (i: number) => {
    window.clearTimeout(leave.current);
    setHover(i);
  };
  const out = () => {
    window.clearTimeout(leave.current);
    leave.current = window.setTimeout(() => setHover(null), 140);
  };
  useEffect(() => () => window.clearTimeout(leave.current), []);

  // the hairline frame behind the words takes the format's shape
  const frame = fmt ? sized(fmt.ratio, 760) : sized(16 / 9, 760);

  return (
    <motion.section
      className={styles.index}
      animate={away ? { scale: 0.96, opacity: 0.6 } : { scale: 1, opacity: 1 }}
      transition={{ duration: 1, ease: EASE_CINE }}
    >
      <motion.div
        className={styles.frame}
        aria-hidden="true"
        initial={false}
        animate={{ width: frame.width, height: frame.height, opacity: fmt ? 1 : 0, borderRadius: fmt?.key === "beyond" ? 0 : 2 }}
        transition={{ ...RESHAPE, opacity: { duration: 0.6, ease: EASE } }}
      >
        <span className={styles.frameTag}>
          {fmt ? (fmt.key === "beyond" ? "2.39 : 1" : fmt.label.replace("x", " : ")) : ""}
        </span>
      </motion.div>

      <Reveal fmt={fmt} />

      {/* the words invert whatever passes under them */}
      <div className={styles.words}>
        <motion.p
          className={styles.eyebrow}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.2, duration: 1.2, ease: EASE } }}
        >
          Stories beyond the frame
        </motion.p>
        <div className={styles.cols}>
          {FORMATS.map((f, i) => {
            const on = hover === i;
            return (
              <motion.button
                key={f.key}
                type="button"
                className={`${styles.col} ${on ? styles.colOn : ""}`}
                data-cursor="Enter"
                aria-label={`${f.label}: ${f.line}`}
                animate={{ opacity: hover !== null && !on ? 0.16 : 1 }}
                transition={{ duration: 0.5, ease: EASE }}
                onPointerEnter={(e) => e.pointerType === "mouse" && enter(i)}
                onPointerLeave={(e) => e.pointerType === "mouse" && out()}
                onFocus={(e) => e.currentTarget.matches(":focus-visible") && enter(i)}
                onBlur={out}
                onClick={() => onOpen(i)}
              >
                <motion.span
                  className={styles.colTop}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.9 + i * 0.08, duration: 1 } }}
                >
                  <span>{f.no}</span>
                  <Glyph k={f.key} />
                </motion.span>
                <span className={styles.rule}>
                  <motion.span
                    className={styles.ruleBase}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1, transition: { delay: 0.3 + i * 0.1, duration: 1.3, ease: EASE_CINE } }}
                  />
                  <motion.span className={styles.ruleOn} initial={false} animate={{ scaleX: on ? 1 : 0 }} transition={SNAP} />
                </span>
                <span className={styles.mask}>
                  <motion.span
                    className={styles.word}
                    initial={{ y: "115%" }}
                    animate={{ y: 0, transition: { ...RISE, delay: 0.55 + i * 0.1 } }}
                  >
                    <Roll text={f.label} />
                  </motion.span>
                </span>
                <span className={styles.colFoot}>
                  <motion.span animate={{ opacity: on ? 1 : 0, y: on ? 0 : 8 }} transition={{ duration: 0.5, ease: EASE }}>
                    {f.line}
                  </motion.span>
                  <motion.span
                    className={styles.colGo}
                    animate={{ opacity: on ? 1 : 0, x: on ? 0 : -10 }}
                    transition={{ duration: 0.5, ease: EASE }}
                  >
                    Enter →
                  </motion.span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <motion.footer
        className={styles.foot}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 1.4, duration: 1 } }}
      >
        <span>A film studio</span>
        <span className={styles.footHint}>Point at a format · click to enter</span>
        <span>© 16x9 &amp; Beyond</span>
      </motion.footer>
    </motion.section>
  );
}

// ===========================================================================
// TILE — one film in the screening room
// ===========================================================================
const Tile = memo(function Tile({
  clip,
  i,
  fmt,
  lifted,
  onPlay,
}: {
  clip: Clip;
  i: number;
  fmt: Format;
  lifted: boolean;
  onPlay: (i: number) => void;
}) {
  const [on, setOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const rx = useSpring(0, { stiffness: 220, damping: 20 });
  const ry = useSpring(0, { stiffness: 220, damping: 20 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  // the still drifts the other way from the turn, so it reads as depth
  const z = zoomFor(clip.src);
  const ix = useTransform(ry, (v) => `${-v * 0.5}%`);
  const iy = useTransform(rx, (v) => `${v * 0.5}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.26), rgb(255 255 255 / 0.05) 28%, transparent 52%)`;

  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    rx.set((0.5 - ny) * 12);
    ry.set((nx - 0.5) * 14);
    gx.set(nx * 100);
    gy.set(ny * 100);
  };
  const leave = () => {
    rx.set(0);
    ry.set(0);
    setOn(false);
    setPlaying(false);
  };

  return (
    <motion.li
      layout
      className={`${styles.tile} ${on ? styles.tileOn : ""} ${fmt.key === "beyond" ? styles.tileOpen : ""}`}
      style={{ aspectRatio: String(fmt.ratio) }}
      initial={{ opacity: 0, y: 90, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { ...RISE, delay: 0.45 + (i % 10) * 0.05 } }}
      transition={{ layout: RESHAPE }}
    >
      <motion.button
        type="button"
        className={styles.tileBtn}
        data-cursor="Play"
        aria-label={`Play ${clip.title}`}
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setOn(true)}
        onPointerMove={move}
        onPointerLeave={leave}
        onClick={() => {
          rx.jump(0);
          ry.jump(0);
          onPlay(i);
        }}
      >
        {!lifted && (
          <motion.div layoutId={`film-${i}`} className={styles.media} transition={FLY}>
            { }
            <motion.img className={styles.still} src={stillFor(clip.src)} alt="" draggable={false} style={{ x: ix, y: iy, scale: z }} />
            {on && (
              <motion.video
                className={styles.tileVideo}
                src={clip.src}
                muted
                loop
                playsInline
                autoPlay
                disablePictureInPicture
                style={{ x: ix, y: iy, scale: z }}
                initial={{ opacity: 0 }}
                animate={{ opacity: playing ? 1 : 0 }}
                transition={{ duration: 0.5 }}
                onPlaying={() => setPlaying(true)}
              />
            )}
          </motion.div>
        )}
        <motion.span className={styles.glare} style={{ background: glare }} />
        <span className={styles.tileShade} />
        <span className={styles.tileTop}>
          <span>{pad2(i + 1)}</span>
          <span>{clip.duration}</span>
        </span>
        <span className={styles.tileTitle}>
          <span className={styles.tileMask}>
            <span>{clip.title}</span>
          </span>
          <span className={styles.tilePlay}>
            <svg viewBox="0 0 12 14" aria-hidden="true">
              <path d="M0 0L12 7L0 14Z" />
            </svg>
          </span>
        </span>
      </motion.button>
    </motion.li>
  );
});

// ===========================================================================
// SCREENING ROOM — the films in a grid, in one format
// ===========================================================================
function Room({
  start,
  lifted,
  onClose,
  onPlay,
  onFormat,
}: {
  start: number;
  lifted: number | null;
  onClose: () => void;
  onPlay: (i: number) => void;
  onFormat: (i: number) => void;
}) {
  const [fi, setFi] = useState(start);
  const f = FORMATS[fi];
  const pick = (i: number) => {
    setFi(i);
    onFormat(i);
  };
  return (
    <motion.section
      className={styles.room}
      layoutScroll
      role="dialog"
      aria-modal="true"
      aria-label={`${f.label} — ${f.line}`}
      initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
      animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 1, ease: EASE_CINE } }}
      exit={{ clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.85, ease: EASE_CINE, delay: 0.1 } }}
    >
      <motion.header
        className={styles.roomBar}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.6, duration: 0.9, ease: EASE } }}
      >
        <button type="button" className={styles.back} onClick={onClose} data-cursor="Index">
          <span aria-hidden="true">←</span> Index
        </button>
        <nav className={styles.tabs} aria-label="Formats">
          {FORMATS.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tab} ${i === fi ? styles.tabOn : ""}`}
              aria-pressed={i === fi}
              data-cursor="Re-cut"
              onClick={() => pick(i)}
            >
              <Glyph k={t.key} />
              <span>{t.label}</span>
              {i === fi && <motion.span layoutId="tab-line" className={styles.tabLine} transition={SNAP} />}
            </button>
          ))}
        </nav>
        <span className={styles.count}>{pad2(CLIPS.length)} films</span>
      </motion.header>

      <div className={styles.roomHead}>
        <h2 className={styles.roomTitle}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={f.key}
              className={styles.roomWord}
              initial={{ y: "105%" }}
              animate={{ y: 0, transition: { ...RISE, delay: 0.25 } }}
              exit={{ y: "-105%", transition: { duration: 0.45, ease: EASE_CINE } }}
            >
              <Roll text={f.label} />
            </motion.span>
          </AnimatePresence>
        </h2>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={f.key}
            className={styles.roomLines}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.8, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <p>{f.line}</p>
            <p className={styles.roomDetail}>{f.detail}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <ul className={styles.grid} style={{ "--cols": f.cols, "--cols-s": f.colsSmall } as CSSProperties}>
        {CLIPS.map((c, i) => (
          <Tile key={c.src} clip={c} i={i} fmt={f} lifted={lifted === i} onPlay={onPlay} />
        ))}
      </ul>
    </motion.section>
  );
}

// ===========================================================================
// PLAYER — the film lifted out of its tile
// ===========================================================================
function Player({ i, fmt, onClose }: { i: number; fmt: Format; onClose: () => void }) {
  const [cur, setCur] = useState(i);
  const clip = CLIPS[cur];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const progress = useMotionValue(0);
  const [view, setView] = useState(() => ({ vw: window.innerWidth, vh: window.innerHeight }));
  useEffect(() => {
    const r = () => setView({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  // the film as big as the room allows, in its format
  const maxW = view.vw * (view.vw < 760 ? 0.92 : 0.8);
  const maxH = view.vh * 0.66;
  const w = Math.min(maxW, maxH * fmt.ratio);
  const h = w / fmt.ratio;

  const step = useCallback((d: number) => setCur((v) => (v + d + CLIPS.length) % CLIPS.length), []);
  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, toggle]);

  const seek = (e: ReactPointerEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * v.duration;
  };

  return (
    <motion.div className={styles.player} role="dialog" aria-modal="true" aria-label={clip.title}>
      <motion.div
        className={styles.playerBack}
        onClick={onClose}
        data-cursor="Close"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.5 } }}
        exit={{ opacity: 0, transition: { duration: 0.45, delay: 0.1 } }}
      />
      <div className={styles.playerStage}>
        <motion.div layoutId={`film-${i}`} className={styles.playerFilm} style={{ width: w, height: h }} transition={FLY}>
          <AnimatePresence initial={false}>
            <motion.video
              key={clip.src}
              ref={videoRef}
              className={styles.playerVideo}
              // a portrait frame would show a scope film's bars: zoom past them
              style={{ scale: fmt.ratio < 1 ? zoomFor(clip.src) : 1 }}
              src={clip.src}
              poster={stillFor(clip.src)}
              autoPlay
              playsInline
              loop
              muted={muted}
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) progress.set(v.currentTime / v.duration);
              }}
              onClick={toggle}
              data-cursor={paused ? "Play" : "Pause"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.5 } }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
            />
          </AnimatePresence>
        </motion.div>

        <motion.div
          className={styles.playerInfo}
          style={{ width: Math.max(w, Math.min(view.vw * 0.92, 520)) }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.8, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          <div className={styles.track} onPointerDown={seek} data-cursor="Seek">
            <motion.span className={styles.trackFill} style={{ scaleX: progress }} />
          </div>
          <div className={styles.playerRow}>
            <div className={styles.playerName}>
              <span className={styles.playerNo}>
                {pad2(cur + 1)} / {pad2(CLIPS.length)}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h3
                  key={clip.title}
                  className={styles.playerTitle}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } }}
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                >
                  {clip.title}
                </motion.h3>
              </AnimatePresence>
            </div>
            <div className={styles.controls}>
              <button type="button" onClick={() => step(-1)} data-cursor="Prev">
                ←
              </button>
              <button
                type="button"
                onClick={toggle}
              >
                {paused ? "Play" : "Pause"}
              </button>
              <button type="button" onClick={() => setMuted((m) => !m)}>
                {muted ? "Sound on" : "Sound off"}
              </button>
              <button type="button" onClick={() => step(1)} data-cursor="Next">
                →
              </button>
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close" data-cursor="Close">
                <span />
                <span />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ===========================================================================
// THE PAGE
// ===========================================================================
export default function Hero20() {
  const [room, setRoom] = useState<number | null>(null); // the format the screening room opened in
  const [fmtNow, setFmtNow] = useState(0); // the format it's in now
  const [film, setFilm] = useState<number | null>(null);

  const open = useCallback((i: number) => {
    setFmtNow(i);
    setRoom(i);
  }, []);
  const closeRoom = useCallback(() => setRoom(null), []);
  const closeFilm = useCallback(() => setFilm(null), []);

  // Esc steps back out: the film, then the room
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (film !== null) setFilm(null);
      else if (room !== null) setRoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [film, room]);

  return (
    <MotionConfig reducedMotion="user">
      <main className={`${styles.page} ${wide.variable}`}>
        <motion.header
          className={styles.bar}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1, duration: 1, ease: EASE } }}
        >
          <Link href="/" className={styles.logo} aria-label="16x9 home" data-cursor="Home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="16x9" />
          </Link>
          <nav className={`${styles.barNav} ${room !== null ? styles.barNavAway : ""}`}>
            <Link href="/work" data-cursor="Work">
              Work
            </Link>
            <a href="#contact" data-cursor="Say hi">
              Contact
            </a>
          </nav>
        </motion.header>

        <Index onOpen={open} away={room !== null} />

        <AnimatePresence>
          {room !== null && (
            <Room key="room" start={room} lifted={film} onClose={closeRoom} onPlay={setFilm} onFormat={setFmtNow} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {film !== null && <Player key="player" i={film} fmt={FORMATS[fmtNow]} onClose={closeFilm} />}
        </AnimatePresence>

        <Cursor />
      </main>
    </MotionConfig>
  );
}
