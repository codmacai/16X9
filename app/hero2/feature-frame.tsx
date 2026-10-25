"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./hero2.module.css";

// hero 9: the frame in the middle, for 16x9 and 9x16 as for Beyond — one frame, its shape the
// format's. Behind it the format's own wall (the brand films' grid; the columns of reels) falls
// back out of focus; in it, one of them, sharp, in full colour, as on a museum wall: its label
// small at its head (the brand and the film; the account) with its number, five hairlines' worth
// of progress at its foot. Every few seconds the next comes into focus as the one before
// dissolves. It opens from a line across it, as the Beyond tile does, and going in it grows to
// the whole screen.
export type FrameItem = { src: string; still?: string; label: string; sub?: string };

const FOCUS = [0.16, 1, 0.3, 1] as const;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** iOS plays a film on its own only when it's muted as an attribute, not just the property */
const startMuted = (v: HTMLVideoElement | null) => {
  if (!v) return;
  v.muted = true;
  v.setAttribute("muted", "");
  v.play().catch(() => {});
};

export default function FeatureFrame({
  kind,
  on,
  go,
  items,
  hold,
  reduce,
}: {
  kind: "16x9" | "9x16";
  on: boolean;
  go: boolean;
  items: FrameItem[];
  /** how long each holds, ms */
  hold: number;
  reduce: boolean;
}) {
  const n = items.length;
  const [i, setI] = useState(0);
  // one after another while it's on; going in, the one showing stays; from the first again each
  // time it comes on
  const live = on || go;
  const [was, setWas] = useState(live);
  if (live !== was) {
    setWas(live);
    if (!live) setI(0);
  }
  useEffect(() => {
    if (!on || reduce || n < 2) return;
    const id = window.setInterval(() => setI((k) => (k + 1) % n), hold);
    return () => window.clearInterval(id);
  }, [on, reduce, n, hold]);

  if (!n) return null;
  const it = items[i % n];
  return (
    <div
      className={`${styles.frame} ${kind === "9x16" ? styles.frameTall : ""} ${live ? styles.frameOn : ""} ${go ? styles.frameGo : ""}`}
      aria-hidden="true"
    >
      {/* the film, coming into focus over the one before as it dissolves */}
      <AnimatePresence initial={false}>
        {live && (
          <motion.span
            key={it.src}
            className={styles.frameFilm}
            initial={reduce ? false : { opacity: 0, scale: 1.08, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.9, ease: "easeInOut" } }}
            transition={reduce ? { duration: 0 } : { duration: 1.4, ease: FOCUS }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {it.still && <img src={it.still} alt="" draggable={false} />}
            <video ref={startMuted} src={it.src} muted autoPlay loop playsInline preload="auto" disablePictureInPicture />
          </motion.span>
        )}
      </AnimatePresence>
      <i className={styles.frameShade} />

      {/* at its head, as on a label: what it is, and its number */}
      <span className={styles.frameHead}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={it.label + (it.sub ?? "")}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: FOCUS, delay: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            {it.label}
            {it.sub && (
              <>
                <i aria-hidden="true" />
                {it.sub}
              </>
            )}
          </motion.span>
        </AnimatePresence>
        <span>
          {pad2((i % n) + 1)} / {pad2(n)}
        </span>
      </span>

      {/* at its foot, the hairlines: those shown, and the one showing drawing across as it holds */}
      <span className={styles.frameTicks} style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, "--hold": `${hold}ms` } as React.CSSProperties}>
        {items.map((x, k) => (
          <i key={k === i ? `${k}-on` : k} data-state={k < i ? "past" : k === i ? "on" : undefined} />
        ))}
      </span>
    </div>
  );
}
