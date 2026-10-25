"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WallFilm } from "../work/_shared/data";
import { WallSurface } from "./beyond-panel";
import styles from "./hero2.module.css";

// hero 9's 16x9: a framed screen on the wall. The room is the Beyond tile's — the same near-black
// matte tiles, the same seams (WallSurface) — with daylight from a window falling across it in soft
// diagonal bands, and on it, hung above the line of words as a gallery hangs a work over its
// caption, a frame: brushed silver round a warm paper mat. In the mat, on the right, a screen
// playing the brand films one after another, each with its brand's mark on it; on the left, set
// as a print would be, the line it runs under, the brand large, the film, what 16x9 makes, and at
// its foot the studio and the film's number. It comes in from a line across it, as the tiles do.
const HOLD_MS = 4200;
const FOCUS = [0.16, 1, 0.3, 1] as const;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** iOS plays a film on its own only when it's muted as an attribute, not just the property */
const startMuted = (v: HTMLVideoElement | null) => {
  if (!v) return;
  v.muted = true;
  v.setAttribute("muted", "");
  v.play().catch(() => {});
};

export default function FramedScreen({ on, films, reduce }: { on: boolean; films: WallFilm[]; reduce: boolean }) {
  const list = films.slice(0, 8);
  const n = list.length;
  const [i, setI] = useState(0);
  // the films, one after another, while it's on; from the first again each time it comes on
  const [was, setWas] = useState(on);
  if (on !== was) {
    setWas(on);
    if (!on) setI(0);
  }
  useEffect(() => {
    if (!on || reduce || n < 2) return;
    const id = window.setInterval(() => setI((k) => (k + 1) % n), HOLD_MS);
    return () => window.clearInterval(id);
  }, [on, reduce, n]);

  if (!n) return null;
  const f = list[i % n];
  return (
    <div className={`${styles.wall} ${styles.fsRoom} ${on ? styles.fsOn : ""}`} aria-hidden="true">
      <WallSurface />

      <div className={styles.fsFrame}>
        <div className={styles.fsMat}>
          {/* the print's side */}
          <div className={styles.fsText}>
            <span className={styles.fsTag}>*Stories beyond the frame</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={f.clip}
                className={styles.fsLead}
                initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: FOCUS, delay: 0.15 } }}
                exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.3 } }}
              >
                <span className={styles.fsBrand}>{f.brand}</span>
                <span className={styles.fsTitle}>{f.title}</span>
              </motion.span>
            </AnimatePresence>
            <span className={styles.fsWhat}>Film campaigns, commercials &amp; documentaries</span>
            <span className={styles.fsFoot}>
              <span>16x9 &amp; Beyond</span>
              <span>
                {pad2((i % n) + 1)} / {pad2(n)}
              </span>
            </span>
          </div>

          {/* the screen: the film, its brand's mark on it, the next coming into focus as it goes */}
          <div className={styles.fsScreen}>
            <AnimatePresence initial={false}>
              {on && (
                <motion.span
                  key={f.clip}
                  className={styles.fsFilm}
                  initial={reduce ? false : { opacity: 0, scale: 1.06, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
                  transition={reduce ? { duration: 0 } : { duration: 1.3, ease: FOCUS }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f.shot && <img src={f.shot} alt="" draggable={false} />}
                  <video ref={startMuted} src={f.clip} muted autoPlay loop playsInline preload="auto" disablePictureInPicture />
                  <span
                    className={styles.fsMark}
                    data-wide={f.wide || undefined}
                    style={{ maskImage: `url(${f.logo})`, WebkitMaskImage: `url(${f.logo})` }}
                  />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* daylight from a window, falling across the wall and the frame */}
      <i className={styles.daylight} />
      <i className={styles.dayshade} />
    </div>
  );
}
