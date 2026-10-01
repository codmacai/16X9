"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import styles from "./depthhero.module.css";

// ===========================================================================
// PROJECT VIEW — a tile on the wall opens into a centred film card.
//
// The card is laid out at its final size and position, then animated in from
// the tile with a FLIP: a uniform scale + translate (so the film is never
// squashed) and a clip-path that crops it to the tile's shape. Both run on the
// compositor, so the open is smooth even with the wall playing behind.
//
// Per-frame values (time, progress) are written straight to the DOM / motion
// values, never through React state.
// ===========================================================================

export type TileRect = { top: number; left: number; width: number; height: number };
export type OpenProject = { index: number; rect: TileRect; time: number };

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const OPEN_S = 0.9;
const RADIUS = 28; // card corner radius, px
const TILE_RADIUS = 10; // matches .tile in the wall
const IDLE_MS = 2200; // controls fade away after this long without movement

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (s: number) => (Number.isFinite(s) && s > 0 ? `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}` : "00:00");

/** The card's final box: 16:9, centred, never taller than 78% of the screen. */
function cardBox(vw: number, vh: number) {
  const width = Math.min(vw * (vw < 760 ? 0.92 : 0.78), ((vh * 0.78) * 16) / 9);
  const height = (width * 9) / 16;
  return { width, height, left: (vw - width) / 2, top: (vh - height) / 2 };
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
  const [box, setBox] = useState(() => cardBox(window.innerWidth, window.innerHeight));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const durRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrubbing = useRef(false);
  const idleTimer = useRef(0);
  const progress = useMotionValue(0);
  const dotLeft = useTransform(progress, (p) => `${p * 100}%`);

  const clip = clips[index];
  const total = clips.length;

  // ---- FLIP: where the card starts (the tile) and where it lands ----
  const from = useMemo(() => {
    const r = open.rect;
    const s = Math.max(r.width / box.width, r.height / box.height); // cover the tile, uniformly
    const visW = r.width / s;
    const visH = r.height / s;
    const ix = (box.width - visW) / 2;
    const iy = (box.height - visH) / 2;
    return {
      x: r.left + r.width / 2 - (box.left + box.width / 2),
      y: r.top + r.height / 2 - (box.top + box.height / 2),
      scale: s,
      clipPath: `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${TILE_RADIUS / s}px)`,
    };
  }, [open.rect, box]);
  const landed = { x: 0, y: 0, scale: 1, clipPath: `inset(0px 0px 0px 0px round ${RADIUS}px)` };

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
    const onResize = () => setBox(cardBox(window.innerWidth, window.innerHeight));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const focus = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), OPEN_S * 1000);
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

  return (
    <div className={styles.pv} role="dialog" aria-modal="true" aria-label={clip.title} onPointerMove={wake}>
      <motion.div
        className={styles.pvBackdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.6, ease: EASE } }}
        exit={{ opacity: 0, transition: { duration: 0.5, delay: 0.2 } }}
        onClick={onClose}
      />

      {/* ============ The card: flies out of the tile, lands centred ============ */}
      <motion.div
        className={`${styles.pvCard} ${showUi ? "" : styles.pvIdle}`}
        style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        initial={reduce ? { opacity: 0 } : from}
        animate={{ ...landed, opacity: 1 }}
        exit={reduce ? { opacity: 0, transition: { duration: 0.2 } } : { ...from, transition: { ...frame, duration: 0.7 } }}
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

        {/* ---- top: count left, close right ---- */}
        <motion.div
          className={styles.pvTop}
          initial={{ opacity: 0 }}
          animate={{ opacity: showUi ? 1 : 0, transition: { duration: 0.5, delay: showUi ? 0 : 0.1 } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <span className={styles.pvCount}>
            {pad(index + 1)} <i>/</i> {pad(total)}
          </span>
          <motion.button
            ref={closeRef}
            type="button"
            className={styles.pvClose}
            onClick={onClose}
            aria-label="Close project"
            initial={reduce ? false : { scale: 0.6, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0, transition: { delay: OPEN_S * 0.7, duration: 0.7, ease: EASE } }}
            whileHover={{ rotate: 90, transition: { duration: 0.5, ease: EASE } }}
            whileTap={{ scale: 0.92 }}
          >
            <span />
            <span />
          </motion.button>
        </motion.div>

        {/* ---- bottom: the project name, then the transport ---- */}
        <div className={styles.pvBottom}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={clip.src}
              className={styles.pvTitle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              <span className={styles.pvTitleMask}>
                <motion.span
                  className={styles.pvTitleLine}
                  initial={reduce ? false : { y: "110%" }}
                  animate={{ y: 0, transition: { duration: 0.9, ease: EASE, delay: navigated ? 0.15 : OPEN_S * 0.75 } }}
                >
                  {clip.title}
                </motion.span>
              </span>
            </motion.h2>
          </AnimatePresence>

          <motion.div
            className={styles.pvBar}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{
              opacity: showUi ? 1 : 0,
              y: showUi ? 0 : 8,
              transition: { duration: 0.6, ease: EASE, delay: showUi ? (navigated ? 0 : OPEN_S * 0.85) : 0 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <button type="button" className={styles.pvPlay} onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              <AnimatePresence mode="wait" initial={false}>
                {playing ? (
                  <motion.svg key="pause" viewBox="0 0 24 24" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.18 }}>
                    <rect x="6" y="4.5" width="3" height="15" />
                    <rect x="15" y="4.5" width="3" height="15" />
                  </motion.svg>
                ) : (
                  <motion.svg key="play" viewBox="0 0 24 24" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.18 }}>
                    <path d="M7 4.5v15l12.5-7.5z" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </button>

            <span ref={nowRef} className={styles.pvTime}>
              00:00
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
              <motion.span className={styles.pvTrackDot} style={{ left: dotLeft }} />
            </div>

            <span ref={durRef} className={styles.pvTime}>
              {clip.duration.padStart(5, "0")}
            </span>

            <button type="button" className={styles.pvSound} onClick={() => setMuted((m) => !m)} aria-pressed={!muted}>
              {muted ? "Sound off" : "Sound on"}
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* ============ Under the card: previous / next ============ */}
      <motion.nav
        className={styles.pvNav}
        style={{ top: box.top + box.height, left: box.left, width: box.width }}
        aria-label="Projects"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0 : OPEN_S * 0.8, duration: 0.6, ease: EASE } }}
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
