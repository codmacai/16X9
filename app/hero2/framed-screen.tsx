"use client";

import type { ReactNode } from "react";
import { WallSurface } from "./beyond-panel";
import styles from "./hero2.module.css";

// hero 9's 16x9 and 9x16: a cinema's screen in the wall. The room is the Beyond tile's — the same near-black
// matte tiles and fine seams (WallSurface) — but here its tiles are the screen's size, so the screen
// is one of them, exactly within its seams: cinema-wide (64:27, near enough 2.39:1), in the middle of
// the screen, the wall above it and below it the same. On it, the format's wall: 16x9's brand films
// four by three, each 16:9, under its brand's mark; or 9x16's reels eight by two, each 9:16, under
// its account's (the FormatGrid passed in) — edge to edge with only
// the wall's own fine seams between them, so the wall's grid runs on through it. A cinema's finish:
// its light soft on the wall round it, the faintest sheen and grain on it, its corners falling
// away a little. It comes on from a line across it, as the tile does.

/** where the screen stands — as the CSS sets it (.tv) */
export function screenAt(w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tall = vw <= vh;
  const pw = tall ? vw * 0.92 : Math.min(vw * 0.9, ((vh * 0.8) * 64) / 27);
  const ph = (pw * 27) / (tall ? 32 : 64);
  return { cx: w / 2, cy: h / 2, pw, ph };
}

export default function FramedScreen({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <div className={`${styles.wall} ${styles.tvRoom} ${on ? styles.tvOn : ""}`} aria-hidden="true">
      <WallSurface at={screenAt} />
      <div className={styles.tv}>
        {children}
        <i className={styles.tvGlass} />
      </div>
    </div>
  );
}
