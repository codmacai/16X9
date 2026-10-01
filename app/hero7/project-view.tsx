"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import styles from "./depthhero.module.css";

// ===========================================================================
// PROJECT VIEW — a tile on the wall opens into the film, dressed like the
// landing section: the same top bar (logo left, burger-turned-X right), a
// sharp-cornered frame like the 16X9 card, letterbox bars that part as it
// lands, the title and two small lines underneath like the mark's lines, and
// a hairline strip at the foot like the client strip.
//
// The frame is laid out at its final size and animated in from the tile with
// a FLIP: a uniform scale + translate (the film is never squashed) and a
// clip-path that crops it to the tile's shape. Per-frame values (time,
// progress) go straight to the DOM / motion values, never through React state.
// ===========================================================================

export type TileRect = { top: number; left: number; width: number; height: number };
export type OpenProject = { index: number; rect: TileRect; time: number };

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const OPEN_S = 0.9;
const TILE_RADIUS = 10; // matches .tile in the wall
const IDLE_MS = 2200; // controls fade after this long without movement
const LETTERBOX = 0.2; // each bar starts covering this much of the frame, then parts
// Closing: the letterbox shuts over the film like a shutter, then everything fades
// back to the home screen. The film does not fly back into its tile.
const CLOSE = { shutter: 0.45, fade: 0.35 };
const LOGO_SRC = "/logo.png"; // same logo as the landing top bar

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (s: number) => (Number.isFinite(s) && s > 0 ? `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}` : "00:00");

/** The frame's final box: 16:9, leaving room for the top bar, the lines under it and the strip. */
function frameBox(vw: number, vh: number) {
  const small = vw < 760;
  const width = Math.min(vw * (small ? 0.88 : 0.72), ((vh * (small ? 0.5 : 0.6)) * 16) / 9);
  const height = (width * 9) / 16;
  const under = small ? 96 : Math.max(70, width * 0.085); // space for the lines below
  const top = Math.max(small ? 96 : 110, (vh - height - under) / 2);
  return { width, height, left: (vw - width) / 2, top };
}

export default function ProjectView({
  clips,
  open,
  onClose,
}: {
  clips: Clip[];
  open: OpenProject;
  onClose: () => void;
}) {
  const reduce = !!useReducedMotion();
  const [index, setIndex] = useState(open.index);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [idle, setIdle] = useState(false);
  const [navigated, setNavigated] = useState(false); // false until the visitor steps to another film
  const [box, setBox] = useState(() => frameBox(window.innerWidth, window.innerHeight));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const durRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const idleTimer = useRef(0);
  const progress = useMotionValue(0);

  const clip = clips[index];
  const total = clips.length;
  const titleSize = Math.max(20, box.width * 0.04);

  // ---- FLIP on open only: where the frame starts (the tile) and where it lands ----
  const from = useMemo(() => {
    const r = open.rect;
    const s = Math.max(r.width / box.width, r.height / box.height); // cover the tile, uniformly
    const ix = (box.width - r.width / s) / 2;
    const iy = (box.height - r.height / s) / 2;
    return {
      x: r.left + r.width / 2 - (box.left + box.width / 2),
      y: r.top + r.height / 2 - (box.top + box.height / 2),
      scale: s,
      clipPath: `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${TILE_RADIUS / s}px)`,
    };
  }, [open.rect, box]);
  const landed = { x: 0, y: 0, scale: 1, clipPath: "inset(0px 0px 0px 0px round 0px)" };

  // ---- controls ----
  const step = useCallback(
    (dir: number) => {
      setNavigated(true);
      progress.set(0);
      setPlaying(true);
      setIndex((i) => (i + dir + total) % total);
    },
    [progress, total]
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  // Keyboard, resize, scroll lock, focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      wake();
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m") setMuted((m) => !m);
    };
    const onResize = () => setBox(frameBox(window.innerWidth, window.innerHeight));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    // Focus the dialog itself (not a button) so keyboard users land inside it
    // without a focus ring appearing on the close button after a mouse click.
    const focus = window.setTimeout(() => dialogRef.current?.focus({ preventScroll: true }), OPEN_S * 1000);
    // Give the controls a proper look before they first auto-hide.
    idleTimer.current = window.setTimeout(() => setIdle(true), OPEN_S * 1000 + IDLE_MS * 1.8);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(focus);
      window.clearTimeout(idleTimer.current);
    };
  }, [onClose, step, togglePlay, wake]);

  // Time readout and progress: one rAF loop, no React renders.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && v.duration && !scrubbing.current) {
        progress.set(v.currentTime / v.duration);
        if (nowRef.current) nowRef.current.textContent = clock(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  // ---- scrubbing ----
  const seekTo = (clientX: number) => {
    const v = videoRef.current;
    const t = trackRef.current;
    if (!v || !t || !v.duration) return;
    const r = t.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    progress.set(p);
    v.currentTime = p * v.duration;
    if (nowRef.current) nowRef.current.textContent = clock(v.currentTime);
  };
  const onScrubDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    scrubbing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
  };
  const onScrubMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrubbing.current) seekTo(e.clientX);
  };
  const onScrubUp = () => {
    scrubbing.current = false;
  };

  const showUi = !idle || !playing;
  const frame = reduce ? { duration: 0.25 } : { duration: OPEN_S, ease: EASE_CINE };
  const settle = navigated ? 0.1 : OPEN_S * 0.7; // when the type arrives
  const reveal = (i: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { y: "110%" },
          animate: { y: 0, transition: { duration: 1.1, ease: EASE, delay: settle + i * 0.08 } },
          exit: { y: "-110%", transition: { duration: 0.35, ease: EASE_CINE } },
        };

  return (
    <div
      ref={dialogRef}
      className={styles.pv}
      role="dialog"
      aria-modal="true"
      aria-label={clip.title}
      tabIndex={-1}
      onPointerMove={wake}
    >
      <motion.div
        className={styles.pvBackdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.6, ease: EASE } }}
        exit={{ opacity: 0, transition: { duration: 0.5, delay: reduce ? 0 : CLOSE.shutter * 0.8 } }}
        onClick={onClose}
      />

      {/* ============ Top bar: the landing's own, logo left, burger turned X right ============ */}
      <motion.header
        className={styles.pvTopbar}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE, delay: reduce ? 0 : OPEN_S * 0.5 } }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt="" className={styles.logoImg} />
        <button type="button" className={styles.pvClose} onClick={onClose} aria-label="Close project">
          <span />
          <span />
        </button>
      </motion.header>

      {/* ============ The frame: flies out of the tile, lands sharp-cornered ============ */}
      <motion.div
        className={`${styles.pvFrame} ${showUi ? "" : styles.pvIdle}`}
        style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        initial={reduce ? { opacity: 0 } : from}
        animate={{ ...landed, opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: CLOSE.fade, delay: reduce ? 0 : CLOSE.shutter } }}
        transition={frame}
      >
        <AnimatePresence initial={false}>
          <motion.video
            key={clip.src}
            ref={(el) => {
              if (el) videoRef.current = el;
            }}
            className={styles.pvVideo}
            src={clip.src}
            autoPlay
            loop
            playsInline
            muted={muted}
            onClick={togglePlay}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.8, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.45 } }}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              // The first film carries on from where the tile was.
              if (!navigated && open.time > 0) v.currentTime = open.time;
              if (durRef.current) durRef.current.textContent = clock(v.duration);
            }}
          />
        </AnimatePresence>

        <div className={styles.pvShade} aria-hidden="true" />

        {/* letterbox bars part as the frame lands, like the landing's opening */}
        {!reduce && (
          <>
            <motion.span
              className={`${styles.pvBar} ${styles.pvBarTop}`}
              aria-hidden="true"
              initial={{ scaleY: LETTERBOX / 0.5 }}
              animate={{ scaleY: 0, transition: { delay: OPEN_S * 0.55, duration: 1.1, ease: EASE_CINE } }}
              exit={{ scaleY: 1, transition: { duration: CLOSE.shutter, ease: EASE_CINE } }}
            />
            <motion.span
              className={`${styles.pvBar} ${styles.pvBarBottom}`}
              aria-hidden="true"
              initial={{ scaleY: LETTERBOX / 0.5 }}
              animate={{ scaleY: 0, transition: { delay: OPEN_S * 0.55, duration: 1.1, ease: EASE_CINE } }}
              exit={{ scaleY: 1, transition: { duration: CLOSE.shutter, ease: EASE_CINE } }}
            />
          </>
        )}

        {/* ---- the transport: one hairline strip of bold type along the foot of the film ---- */}
        <motion.div
          className={styles.pvTransport}
          initial={reduce ? false : { opacity: 0 }}
          animate={{
            opacity: showUi ? 1 : 0,
            transition: { duration: 0.5, ease: EASE, delay: showUi ? (navigated ? 0 : OPEN_S * 1.05) : 0 },
          }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <button type="button" className={styles.pvText} onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
            {playing ? "Pause" : "Play"}
          </button>
          <span className={styles.pvTime}>
            <span ref={nowRef}>00:00</span>
            <i>/</i>
            <span ref={durRef}>{clip.duration.padStart(5, "0")}</span>
          </span>
          <div
            ref={trackRef}
            className={styles.pvTrack}
            aria-hidden="true"
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerCancel={onScrubUp}
          >
            <span className={styles.pvTrackLine} />
            <motion.span className={styles.pvTrackFill} style={{ scaleX: progress }} />
          </div>
          <button type="button" className={styles.pvText} onClick={() => setMuted((m) => !m)} aria-pressed={!muted}>
            {muted ? "Sound off" : "Sound on"}
          </button>
        </motion.div>
      </motion.div>

      {/* ============ Under the frame: the title left, two small lines right ============ */}
      <div
        className={styles.pvUnder}
        style={{ top: box.top + box.height, left: box.left, width: box.width }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={clip.src} className={styles.pvUnderRow}>
            <h2 className={styles.pvTitle} style={{ fontSize: titleSize }}>
              <span className={styles.pvMask}>
                <motion.span className={styles.pvLine} {...reveal(0)}>
                  {clip.title}
                </motion.span>
              </span>
            </h2>
            <p className={styles.pvMeta}>
              <span className={styles.pvMask}>
                <motion.span className={styles.pvLine} {...reveal(1)}>
                  Project {pad(index + 1)} / {pad(total)}
                </motion.span>
              </span>
              <span className={styles.pvMask}>
                <motion.span className={styles.pvLine} {...reveal(2)}>
                  Runtime {clip.duration}
                </motion.span>
              </span>
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ============ Foot strip: like the client strip ============ */}
      <motion.nav
        className={styles.pvStrip}
        aria-label="Projects"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: reduce ? 0 : OPEN_S * 0.9, duration: 0.8 } }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
      >
        <button type="button" onClick={() => step(-1)}>
          <span aria-hidden="true">←</span> Prev
        </button>
        <span className={styles.pvHint}>Esc to close</span>
        <button type="button" onClick={() => step(1)}>
          Next <span aria-hidden="true">→</span>
        </button>
      </motion.nav>
    </div>
  );
}
