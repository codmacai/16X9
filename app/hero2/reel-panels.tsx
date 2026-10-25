"use client";

import { useEffect, useRef, useState } from "react";
import { ACCOUNTS } from "../work/_shared/data";
import { WallSurface } from "./beyond-panel";
import { screenAt } from "./framed-screen";
import styles from "./hero2.module.css";

// hero 9's 9x16: three screens on the wall. The room is 16x9's — the same clean matte wall, its
// tiles the size of 16x9's screen, so its seams only round the edges and the wall is the same going
// between them (WallSurface, screenAt) — and mounted on it, three tall 9:16 displays in black
// bezels, a breath apart, their shadow on the wall. On each, an account's reels, one at a time, the account's name and handle at its
// foot and its mark beside them. Every few seconds the three move on to the next reel, one after
// another from the left, each scrolling up as a feed does. Their screens come on from a line
// across each, the middle one first.

const HOLD_MS = 4000;
/** how long a scroll takes, the last of the three included (.dspReel) */
const MOVE_MS = 1700;
const WHO = ACCOUNTS.filter((a) => !a.handle.startsWith("demo-"));
const DISPLAYS = [-1, 0, 1];
const stillOf = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** one reel on a screen: its still under it until it plays; playing only while it's on screen */
function Reel({ src, on, live, who }: { src: string; on: boolean; live: boolean; who: (typeof WHO)[number] }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // iOS plays a film on its own only when it's muted as an attribute, not just the property
    v.muted = true;
    v.setAttribute("muted", "");
    if (live) v.play().catch(() => {});
    else v.pause();
  }, [live, on]);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stillOf(src)} alt="" draggable={false} />
      {on && (
        <video
          ref={ref}
          src={src}
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          onPlaying={(e) => (e.currentTarget.dataset.playing = "")}
        />
      )}
      <span className={styles.dspWho}>
        <span>
          <b>{who.name}</b>
          <i>@{who.handle}</i>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={who.logo} alt="" draggable={false} />
      </span>
    </>
  );
}

export default function ReelPanels({
  on,
  pool,
  turn,
  reduce,
  light = false,
}: {
  on: boolean;
  pool: string[];
  turn: number;
  reduce: boolean;
  /** hero 10: the wall white */
  light?: boolean;
}) {
  // every few seconds, the next reel; while they scroll, the one going up stays to be seen going
  const [step, setStep] = useState(0);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (!on || reduce) return;
    let t = 0;
    const id = window.setInterval(() => {
      setStep((s) => s + 1);
      setMoving(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setMoving(false), MOVE_MS);
    }, HOLD_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(t);
      setMoving(false);
    };
  }, [on, reduce]);

  // the reels in turn across the three, so no two show the same at once
  const nAt = (d: number, s: number) => s * DISPLAYS.length + d + 1;
  const reelAt = (n: number) => pool[mod(n * 7 + 2 + turn, pool.length)];

  return (
    <div className={`${styles.wall} ${styles.dspRoom} ${on ? styles.dspOn : ""}`} aria-hidden="true">
      <WallSurface at={screenAt} light={light} lit={false} />
      {DISPLAYS.map((d) => (
        <div
          key={d}
          className={styles.dsp}
          style={{ "--d": d, "--open": `${(Math.abs(d) * 0.12).toFixed(2)}s`, "--lag": `${((d + 1) * 0.16).toFixed(2)}s` } as React.CSSProperties}
        >
          <div className={styles.dspScreen}>
            {/* the one gone up (while it goes), the one on, and the next waiting under it */}
            {[-1, 0, 1].map((j) => {
              if (j === -1 && !moving) return null;
              const s = step + j;
              const n = nAt(d, s);
              return (
                <div key={s} className={styles.dspReel} style={{ "--j": j } as React.CSSProperties}>
                  <Reel src={reelAt(n)} on={on} live={on && j <= 0} who={WHO[mod(n, WHO.length)]} />
                </div>
              );
            })}
            <i className={styles.dspGlass} />
          </div>
        </div>
      ))}
    </div>
  );
}
