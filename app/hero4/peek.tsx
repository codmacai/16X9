"use client";

import { useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import s from "./peek.module.css";

// ===========================================================================
// PEEK — the film you rest on, lifted off the wall. The wall leans back, so a
// tile on it is always seen at an angle; pointing at one for a moment lifts
// a flat card off it, upright and facing you, grown out of the tile's own
// place on the screen: the film playing in colour in its format's frame, the
// brand, the title, the runtime and a plain "Play film". Move onto it and
// click; move along the wall and the next one lifts; move away and it goes
// back down into its tile. It sits over the wall, so the wall itself never
// changes under it, and it's the only film playing.
// ===========================================================================

export type PeekAt = { id: string; index: number; rect: { left: number; top: number; width: number; height: number } };
export type PeekBrand = { name: string; style: "a" | "b" | "c" | "d" };

const EASE = [0.16, 1, 0.3, 1] as const;
const INFO = 104; // the strip under the picture (px)
const MARGIN = 16;
const TOP = 96; // clear of the top bar
const FOOT = 116; // clear of "Explore full work" at the foot

/** the picture's size for each frame */
function pictureFor(fmt: "16x9" | "9x16", vw: number, vh: number) {
  if (fmt === "9x16") {
    const h = Math.min(Math.max(320, vh * 0.52), 520, vh - TOP - FOOT - INFO);
    return { w: Math.round(h * (9 / 16)), h: Math.round(h) };
  }
  const w = Math.min(Math.max(320, vw * 0.3), 480, vw - MARGIN * 2);
  return { w: Math.round(w), h: Math.round(w * (9 / 16)) };
}

export default function Peek({
  at,
  clip,
  brand,
  fmt,
  poster,
  onOpen,
}: {
  at: PeekAt;
  clip: Clip;
  brand: PeekBrand;
  fmt: "16x9" | "9x16";
  poster: string;
  onOpen: (index: number, el: HTMLElement, time: number) => void;
}) {
  const picRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);

  // where it stands: centred on its tile, kept on the screen
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const pic = pictureFor(fmt, vw, vh);
  const W = pic.w;
  const H = pic.h + INFO;
  const cx = at.rect.left + at.rect.width / 2;
  const cy = at.rect.top + at.rect.height / 2;
  const left = Math.min(Math.max(MARGIN, cx - W / 2), vw - W - MARGIN);
  const top = Math.min(Math.max(TOP, cy - H / 2), vh - H - FOOT);
  // ...and where it grows from: the tile, as it sits on the screen
  const from = {
    x: cx - (left + W / 2),
    y: cy - (top + H / 2),
    scale: Math.max(0.2, Math.min(1, at.rect.width / W)),
  };

  const open = () => {
    const el = picRef.current;
    if (el) onOpen(at.index, el, videoRef.current?.currentTime ?? 0);
  };

  return (
    <motion.div
      className={s.card}
      data-peek=""
      style={{ left, top, width: W, height: H } as CSSProperties}
      initial={{ ...from, opacity: 0 }}
      animate={{ x: 0, y: 0, scale: 1, opacity: 1, transition: { duration: 0.55, ease: EASE } }}
      exit={{ ...from, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
      onClick={open}
      role="button"
      aria-label={`Play ${clip.title}`}
    >
      <div ref={picRef} className={s.pic} style={{ height: pic.h }}>
                <motion.img
          className={s.media}
          src={poster}
          alt=""
          draggable={false}
          initial={{ scale: 1.12 }}
          animate={{ scale: 1, transition: { duration: 1.4, ease: EASE } }}
        />
        <video
          ref={videoRef}
          className={`${s.media} ${s.video} ${playing ? s.videoOn : ""}`}
          src={clip.src}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          onPlaying={() => setPlaying(true)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (barRef.current && v.duration) barRef.current.style.transform = `scaleX(${(v.currentTime / v.duration).toFixed(4)})`;
          }}
        />
        <span className={s.shade} />
        <span className={s.labels}>
          <span>
            <i className={s.live} /> {playing ? "Playing" : "Preview"}
          </span>
          <span>{fmt === "9x16" ? "9x16" : "16x9"}</span>
        </span>
        <span className={s.track}>
          <span ref={barRef} className={s.bar} />
        </span>
      </div>

      <div className={s.info}>
        <span className={s.brand} data-style={brand.style}>
          {brand.name}
        </span>
        <span className={s.title}>{clip.title}</span>
        <span className={s.row}>
          <span className={s.meta}>Film · {clip.duration}</span>
          <span className={s.play}>
            <i>
              <svg viewBox="0 0 12 14" aria-hidden="true">
                <path d="M1 0l11 7-11 7z" />
              </svg>
            </i>
            Play film
          </span>
        </span>
      </div>
    </motion.div>
  );
}
