"use client";

import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "./_shared/chrome";
import b from "./screen-bar.module.css";

// ===========================================================================
// SCREEN BAR — under the curved screen while the behind-the-scenes film plays
// in it: play/pause, the time, a line to scrub along, sound, and close (the
// screen goes back to its still). Ink on the paper, one quiet line.
// ===========================================================================

// the film is the page's (it lives in the screen's glass): these act on it
const seekTo = (v: HTMLVideoElement, share: number) => {
  v.currentTime = share * v.duration;
};
const flipSound = (v: HTMLVideoElement) => {
  v.muted = !v.muted;
};

const fmt = (s: number) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

export default function ScreenBar({ video, open, onClose }: { video: RefObject<HTMLVideoElement | null>; open: boolean; onClose: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  // follow the film (it mounts with the bar, so look for it once it's there)
  useEffect(() => {
    if (!open) return;
    let v: HTMLVideoElement | null = null;
    let raf = 0;
    const sync = () => {
      if (!v) return;
      setPlaying(!v.paused);
      setMuted(v.muted);
      setT(v.currentTime);
      setDur(v.duration || 0);
    };
    const attach = () => {
      v = video.current;
      if (!v) {
        raf = requestAnimationFrame(attach);
        return;
      }
      for (const e of ["play", "pause", "timeupdate", "loadedmetadata", "volumechange"]) v.addEventListener(e, sync);
      sync();
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      if (v) for (const e of ["play", "pause", "timeupdate", "loadedmetadata", "volumechange"]) v.removeEventListener(e, sync);
    };
  }, [open, video]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = video.current;
    if (!v || !v.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    seekTo(v, Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={b.bar}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.6, ease: EASE } }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.25 } }}
        >
          <button type="button" className={b.play} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? (
              <svg viewBox="0 0 12 14" aria-hidden="true">
                <path d="M1 0h3.4v14H1zM7.6 0H11v14H7.6z" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 14" aria-hidden="true">
                <path d="M1 0l11 7-11 7z" />
              </svg>
            )}
          </button>
          <span className={b.time}>{fmt(t)}</span>
          <div className={b.track} onPointerDown={seek} role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)}>
            <span className={b.fill} style={{ transform: `scaleX(${dur ? t / dur : 0})` }} />
          </div>
          <span className={b.time}>{fmt(dur)}</span>
          <button
            type="button"
            className={b.word}
            onClick={() => {
              const v = video.current;
              if (v) flipSound(v);
            }}
          >
            {muted ? "Sound on" : "Sound off"}
          </button>
          <button type="button" className={b.close} onClick={onClose} aria-label="Close the film">
            <span />
            <span />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
