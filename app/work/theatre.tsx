"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { EASE } from "./_shared/chrome";
import t from "./theatre.module.css";

// ===========================================================================
// THEATRE — the film itself, played in its own cover. The poster card grows
// out of its place into a wide screen across the hero while the lights go
// down around it (the cover's black and paper dim to dark); the poster fades
// into the film, which plays with its sound. Under the picture: play/pause,
// the time, a line to scrub along, sound, full screen, and the way back.
// Closing (×, Esc, or scrolling away) pauses it and the screen goes back
// down into the card.
// ===========================================================================

export type Rect = { left: number; top: number; width: number; height: number };

const OPEN = { duration: 0.95, ease: EASE };
const SHUT = { duration: 0.7, ease: [0.65, 0, 0.35, 1] as const };

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export default function Theatre({
  src,
  poster,
  title,
  from,
  to,
  closing,
  onClosed,
  onClose,
}: {
  src: string;
  poster: string;
  title: string;
  /** the card, where the screen grows from and goes back to (in the hero's coordinates) */
  from: Rect;
  /** the screen, open */
  to: Rect;
  closing: boolean;
  onClosed: () => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [shown, setShown] = useState(false); // the picture is up (the poster has faded)
  const progress = useMotionValue(0);

  // the screen: from the card's place and size to its own, and back
  const left = useMotionValue(from.left);
  const top = useMotionValue(from.top);
  const width = useMotionValue(from.width);
  const height = useMotionValue(from.height);
  const radius = useMotionValue(14);
  useEffect(() => {
    const target = closing ? from : to;
    const how = closing ? SHUT : OPEN;
    const runs = [
      animate(left, target.left, how),
      animate(top, target.top, how),
      animate(width, target.width, how),
      animate(height, target.height, how),
      animate(radius, closing ? 14 : 8, how),
    ];
    let done = 0;
    if (closing) {
      video.current?.pause();
      // back in the card: hand it back once the screen has landed
      done = window.setTimeout(onClosed, SHUT.duration * 1000 + 30);
    } else {
      // once it's open, the film starts (with sound: the click that opened it allows it)
      runs[0].then(() => {
        const v = video.current;
        if (!v) return;
        v.play().catch(() => {
          // the browser wants it muted to start on its own
          v.muted = true;
          setMuted(true);
          v.play().catch(() => {});
        });
      });
    }
    return () => {
      window.clearTimeout(done);
      runs.forEach((r) => r.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  // Esc closes the film (before it would close the page)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === " " && document.activeElement === document.body) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = video.current;
    if (!v || !v.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * v.duration;
  };
  const full = () => {
    const el = shell.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else (video.current?.requestFullscreen ?? el.requestFullscreen).call(video.current ?? el).catch(() => {});
  };

  return (
    <>
      {/* the lights going down */}
      <motion.div
        className={t.dark}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: closing ? 0.6 : 0.9, ease: EASE }}
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        ref={shell}
        className={t.screen}
        style={{ left, top, width, height, borderRadius: radius }}
        role="dialog"
        aria-label={`${title}: the film`}
      >
        <video
          ref={video}
          className={t.video}
          src={src}
          poster={poster}
          playsInline
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onPlaying={() => setShown(true)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setTime(v.currentTime);
            progress.set(v.duration ? v.currentTime / v.duration : 0);
          }}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onEnded={onClose}
          onClick={toggle}
        />
        {/* the poster, over the film until it's playing */}
        <motion.img
          className={t.poster}
          src={poster}
          alt=""
          initial={{ opacity: 1 }}
          animate={{ opacity: shown && !closing ? 0 : 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </motion.div>

      {/* the controls, under the screen */}
      <motion.div
        className={t.bar}
        style={{ left: to.left, top: to.top + to.height + 14, width: to.width }}
        initial={{ opacity: 0, y: -6 }}
        animate={closing ? { opacity: 0, y: -6, transition: { duration: 0.2 } } : { opacity: 1, y: 0, transition: { delay: 0.7, duration: 0.6, ease: EASE } }}
      >
        <button type="button" className={t.btn} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
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
        <span className={t.time}>{fmt(time)}</span>
        <div className={t.track} onPointerDown={seek} role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(time)}>
          <motion.span className={t.fill} style={{ scaleX: progress }} />
        </div>
        <span className={t.time}>{fmt(dur)}</span>
        <button
          type="button"
          className={t.word}
          onClick={() => {
            const v = video.current;
            if (!v) return;
            v.muted = !v.muted;
            setMuted(v.muted);
          }}
        >
          {muted ? "Sound on" : "Sound off"}
        </button>
        <button type="button" className={t.word} onClick={full}>
          Full screen
        </button>
        <button type="button" className={t.close} onClick={onClose} aria-label="Close the film">
          <span />
          <span />
        </button>
      </motion.div>
    </>
  );
}
