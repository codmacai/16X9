"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import styles from "./depthhero.module.css";

// ===========================================================================
// PROJECT VIEW — a tile on the wall opens out into a full-screen film.
// The frame grows from the tile's exact spot, the film carries on from the
// same moment, then the title and controls settle in on top.
// ===========================================================================

export type TileRect = { top: number; left: number; width: number; height: number };
export type OpenProject = { index: number; rect: TileRect; time: number };

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const OPEN_S = 0.95; // frame grow time
const UI_DELAY = OPEN_S * 0.62; // controls arrive as the frame lands

const pad = (n: number) => String(n).padStart(2, "0");

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
  const [navigated, setNavigated] = useState(false); // false until the visitor steps to another film
  const [muted, setMuted] = useState(true);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progress = useMotionValue(0);
  const firstFilm = useRef(true);

  const clip = clips[index];
  const go = (step: number) => {
    setNavigated(true);
    setIndex((i) => (i + step + clips.length) % clips.length);
  };

  // Keyboard: Esc closes, arrows step through the work. Lock the page behind.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const focus = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), UI_DELAY * 1000);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(focus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress line follows the playing film.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && v.duration) progress.set(v.currentTime / v.duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  const { rect } = open;
  const fromTile = { top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderRadius: 10 };
  const fullScreen = { top: 0, left: 0, width: viewport.w, height: viewport.h, borderRadius: 0 };
  const frameTransition = reduce ? { duration: 0.25 } : { duration: OPEN_S, ease: EASE_CINE };

  return (
    <div className={styles.pv} role="dialog" aria-modal="true" aria-label={clip.title}>
      {/* The wall dims and softens behind the film */}
      <motion.div
        className={styles.pvBackdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.5 } }}
        exit={{ opacity: 0, transition: { duration: 0.6, delay: 0.15 } }}
        onClick={onClose}
      />

      {/* The frame grows from the tile to the full screen, and shrinks back on close */}
      <motion.div
        className={styles.pvFrame}
        style={{ ["--accent" as string]: clip.accent }}
        initial={reduce ? { ...fullScreen, opacity: 0 } : fromTile}
        animate={{ ...fullScreen, opacity: 1 }}
        exit={
          reduce
            ? { opacity: 0, transition: { duration: 0.2 } }
            : { ...fromTile, opacity: 0, transition: { ...frameTransition, duration: 0.75, opacity: { delay: 0.5, duration: 0.25 } } }
        }
        transition={frameTransition}
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
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.9, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            onLoadedMetadata={(e) => {
              // Carry on from where the tile was, so the cut feels continuous.
              if (firstFilm.current) {
                firstFilm.current = false;
                if (open.time > 0) e.currentTarget.currentTime = open.time;
              }
            }}
          />
        </AnimatePresence>

        <div className={styles.pvGrade} aria-hidden="true" />

        {/* Controls and title arrive once the frame has landed */}
        <motion.div
          className={styles.pvUi}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: reduce ? 0 : UI_DELAY, duration: 0.5 } }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
        >
          <div className={styles.pvTop}>
            <p className={styles.pvCount}>
              <span className={styles.pvDot} />
              <span>Project</span>
              <span className={styles.pvCountNum}>
                {pad(index + 1)} / {pad(clips.length)}
              </span>
            </p>

            <div className={styles.pvActions}>
              <button
                type="button"
                className={styles.pvPill}
                onClick={() => setMuted((m) => !m)}
                aria-pressed={!muted}
              >
                <span className={`${styles.pvBars} ${muted ? "" : styles.pvBarsOn}`} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {muted ? "Sound off" : "Sound on"}
              </button>
              <button ref={closeRef} type="button" className={styles.pvClose} onClick={onClose} aria-label="Close project">
                <span />
                <span />
              </button>
            </div>
          </div>

          <div className={styles.pvBottom}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={clip.src} className={styles.pvTitleWrap}>
                <h2 className={styles.pvTitle}>
                  {clip.title.split(" ").map((word, i) => (
                    <span key={`${word}-${i}`} className={styles.pvWordMask}>
                      <motion.span
                        className={styles.pvWord}
                        initial={reduce ? false : { y: "105%" }}
                        animate={{
                          y: 0,
                          transition: { duration: 1, ease: EASE, delay: (navigated ? 0.1 : UI_DELAY) + i * 0.06 },
                        }}
                        exit={{ y: "-105%", transition: { duration: 0.45, ease: EASE_CINE, delay: i * 0.03 } }}
                      >
                        {word}
                      </motion.span>
                    </span>
                  ))}
                </h2>
                <motion.p
                  className={styles.pvMeta}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE, delay: 0.35 } }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                >
                  <span>Film</span>
                  <span className={styles.pvSep} />
                  <span>{clip.duration}</span>
                </motion.p>
              </motion.div>
            </AnimatePresence>

            <div className={styles.pvNav}>
              <button type="button" className={styles.pvArrow} onClick={() => go(-1)} aria-label="Previous project">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <button type="button" className={styles.pvArrow} onClick={() => go(1)} aria-label="Next project">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.pvProgress} aria-hidden="true">
            <motion.span style={{ scaleX: progress }} />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
