"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import { posterFor } from "../hero7/wall-playback";
import styles from "./hero19.module.css";

// ===========================================================================
// SCREENING — the film, opened.
//
// The page stays paper-white and the frame itself carries you in: the logo's
// rectangle lifts out of the row and grows into a large screening frame
// (still with its 16 | 9 at the corner), the row and the type give way, and
// the film plays on from where it was. Beneath the frame: a hairline you can
// scrub, the title and its lines, and three quiet controls. At the foot, the
// films either side. Closing shrinks the frame back into the row.
//
// Keys: Esc closes, ← / → step films, Space plays or pauses, M toggles sound.
// ===========================================================================

export type Box = { left: number; top: number; width: number; height: number };
export type ScreeningOpen = { index: number; from: Box; time: number };

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const pad2 = (n: number) => String(n).padStart(2, "0");
const clock = (s: number) => (Number.isFinite(s) && s > 0 ? `${pad2(Math.floor(s / 60))}:${pad2(Math.floor(s % 60))}` : "00:00");

/** A line that rolls up to its next value. */
export function Swap({ k, children }: { k: number; children: ReactNode }) {
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={k}
          className={styles.swapIn}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1, transition: { duration: 0.7, ease: EASE, delay: 0.1 } }}
          exit={{ y: "-100%", opacity: 0, transition: { duration: 0.35, ease: EASE_CINE } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The screening frame's box (outer edge, margin included), sized to leave room for the lines under it. */
function layout(vw: number, vh: number) {
  const small = vw < 760 || vw < vh * 0.8;
  const pad = small ? 16 : Math.min(32, Math.max(16, vw * 0.018));
  const nav = small ? 58 : Math.min(88, Math.max(60, vw * 0.054));
  const m = small ? 9 : 12;
  const under = small ? 210 : 150; // the hairline, the title and the controls
  const foot = small ? 64 : 70;
  const availH = vh - nav - under - foot - 2 * m - (small ? 24 : 36);
  const w = Math.max(200, Math.min(vw - 2 * pad - 2 * m - (small ? 24 : 0), (availH * 16) / 9, 1500)); // phones keep room for the 9
  const h = (w * 9) / 16;
  const top = nav + (small ? 24 : 36) + Math.max(0, (availH - h) / 2);
  return { small, m, frame: { left: (vw - w) / 2 - m, top, width: w + 2 * m, height: h + 2 * m } };
}

export default function Screening({
  clips,
  open,
  category,
  services,
  onClose,
}: {
  clips: Clip[];
  open: ScreeningOpen;
  category: (i: number) => string;
  services: (i: number) => string;
  onClose: (index: number) => void;
}) {
  const reduce = !!useReducedMotion();
  const N = clips.length;
  const [index, setIndex] = useState(open.index);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [geo, setGeo] = useState(() => layout(window.innerWidth, window.innerHeight));

  const videoRef = useRef<HTMLVideoElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const durRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef(true);
  const scrubRef = useRef(false);

  const clip = clips[index];
  const f = geo.frame;
  const step = useCallback((d: number) => setIndex((i) => (i + d + N) % N), [N]);
  const close = useCallback(() => onClose(index), [index, onClose]);

  // ---- the film: carry on from the row on open, from the top after that ----
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.src = clip.src;
    v.poster = posterFor(clip.src);
    const startAt = firstRef.current ? open.time : 0;
    firstRef.current = false;
    const onMeta = () => {
      if (startAt > 0 && startAt < v.duration) v.currentTime = startAt;
    };
    v.addEventListener("loadedmetadata", onMeta, { once: true });
    v.muted = muted;
    // the visitor clicked, so sound is usually allowed; if not, play silently
    v.play()
      .then(() => setPlaying(true))
      .catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      });
    return () => v.removeEventListener("loadedmetadata", onMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // ---- the hairline and the timecode, written straight to the page ----
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const p = v.duration ? v.currentTime / v.duration : 0;
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
        if (nowRef.current) nowRef.current.textContent = clock(v.currentTime);
        if (durRef.current) durRef.current.textContent = clock(v.duration);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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
  const toggleSound = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  // ---- keys, resize, focus ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m") toggleSound();
    };
    const onResize = () => setGeo(layout(window.innerWidth, window.innerHeight));
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
    };
  }, [close, step, togglePlay, toggleSound]);

  // ---- scrubbing the hairline ----
  const seek = (x: number) => {
    const v = videoRef.current;
    const t = trackRef.current;
    if (!v || !t || !v.duration) return;
    const r = t.getBoundingClientRect();
    v.currentTime = Math.min(1, Math.max(0, (x - r.left) / r.width)) * v.duration;
  };

  // the frame lifts from the row's frame and grows into place (and back on close)
  const from = { left: open.from.left, top: open.from.top, width: open.from.width, height: open.from.height };
  const to = { left: f.left, top: f.top, width: f.width, height: f.height };
  const t = reduce ? { duration: 0 } : { duration: 0.85, ease: EASE_CINE };
  const ui = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay: 0.55 + d * 0.06 } },
          exit: { opacity: 0, transition: { duration: 0.2 } },
        };

  return (
    <motion.div
      className={styles.screen}
      role="dialog"
      aria-modal="true"
      aria-label={`${clip.title}, film ${index + 1} of ${N}`}
      initial="shut"
      animate="open"
      exit="shut"
    >
      <motion.div
        className={styles.screenPaper}
        variants={{
          shut: { opacity: 0, transition: { duration: reduce ? 0 : 0.45, ease: "easeOut", delay: reduce ? 0 : 0.3 } },
          open: { opacity: 1, transition: { duration: reduce ? 0 : 0.4, ease: "easeOut" } },
        }}
      />

      {/* ---- the top: the logo, where you are, and the way out ---- */}
      <div className={styles.screenTop}>
        <motion.p className={styles.screenNow} {...ui(0)}>
          Now showing
          <span className={styles.mute}>
            {" "}
            {pad2(index + 1)}/{pad2(N)}
          </span>
        </motion.p>
        <motion.button ref={closeRef} type="button" className={styles.screenClose} onClick={close} {...ui(1)}>
          Close
          <i aria-hidden="true" />
        </motion.button>
      </div>

      {/* ---- the frame, grown from the row ---- */}
      <motion.div
        className={styles.screenFrame}
        style={{ "--m": `${geo.m}px` } as React.CSSProperties}
        variants={{ shut: { ...from, transition: t }, open: { ...to, transition: t } }}
      >
        <video
          ref={videoRef}
          className={styles.screenVideo}
          playsInline
          loop
          preload="auto"
          onClick={togglePlay}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
        <i className={styles.screenTick} aria-hidden="true" />
        <span className={styles.screenTag} aria-hidden="true">
          <span>16</span>
          <span>9</span>
        </span>
      </motion.div>

      {/* ---- under the frame: the hairline, the film, the controls ---- */}
      <div
        className={styles.screenUnder}
        style={{ left: f.left, width: f.width, top: f.top + f.height + (geo.small ? 34 : 40) }}
      >
        <motion.div
          ref={trackRef}
          className={styles.screenTrack}
          onPointerDown={(e) => {
            scrubRef.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            seek(e.clientX);
          }}
          onPointerMove={(e) => scrubRef.current && seek(e.clientX)}
          onPointerUp={() => (scrubRef.current = false)}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          onKeyDown={(e) => {
            const v = videoRef.current;
            if (!v) return;
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.stopPropagation();
              v.currentTime = Math.max(0, v.currentTime + (e.key === "ArrowRight" ? 5 : -5));
            }
          }}
          {...ui(2)}
        >
          <span ref={fillRef} className={styles.screenFill} />
        </motion.div>

        <div className={styles.screenRow}>
          <motion.div {...ui(3)}>
            <p className={styles.screenTitle}>
              <Swap k={index}>{clip.title}</Swap>
            </p>
            <p className={styles.screenMeta}>
              <Swap k={index}>
                {category(index)}
                <span className={styles.dot} aria-hidden="true" />
                {services(index)}
              </Swap>
            </p>
          </motion.div>

          <motion.div className={styles.screenControls} {...ui(4)}>
            <button type="button" className={styles.link} onClick={togglePlay}>
              {playing ? "Pause" : "Play"}
            </button>
            <button type="button" className={styles.link} onClick={toggleSound} aria-pressed={!muted}>
              {muted ? "Sound off" : "Sound on"}
            </button>
            <span className={styles.screenTime}>
              <span ref={nowRef}>00:00</span>
              <span className={styles.mute}>
                {" "}
                / <span ref={durRef}>{clip.duration}</span>
              </span>
            </span>
          </motion.div>
        </div>
      </div>

      {/* ---- the foot: the films either side ---- */}
      <div className={styles.screenFoot}>
        <motion.button type="button" className={styles.screenStep} onClick={() => step(-1)} {...ui(5)}>
          <span className={styles.link}>&larr; Prev</span>
          <span className={styles.mute}>{clips[(index - 1 + N) % N].title}</span>
        </motion.button>
        <motion.p className={`${styles.screenEsc} ${styles.mute}`} {...ui(5)}>
          Esc to close
        </motion.p>
        <motion.button type="button" className={`${styles.screenStep} ${styles.screenNext}`} onClick={() => step(1)} {...ui(5)}>
          <span className={styles.mute}>{clips[(index + 1) % N].title}</span>
          <span className={styles.link}>Next &rarr;</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
