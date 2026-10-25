"use client";

import type { ReactNode } from "react";
import { WallSurface } from "./beyond-panel";
import styles from "./hero2.module.css";

// hero 9's 16x9: a screen in the wall. The room is the Beyond tile's — the same near-black matte
// tiles and fine seams (WallSurface) — but here its tiles are the screen's size, so the screen is
// one of them, exactly within its seams: 16:9 itself, our frame, large in the middle of the screen,
// the wall above it and below it the same. On it, 16x9's brand films three across and three down,
// each 16:9, under its brand's mark (the FormatGrid passed in) — edge to edge with only the wall's
// own fine seams between them, so the wall's grid runs on through it. A cinema's finish: its light
// soft on the wall round it, the faintest sheen and grain on it, its corners falling away a
// little. It comes on from a line across it, as the tile does.

/** where the screen stands — as the CSS sets it (.tv) */
export function screenAt(w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tall = vw <= vh;
  const pw = tall ? vw * 0.92 : Math.min(vw * 0.96, (vh * 0.76 * 16) / 9);
  const ph = tall ? (pw * 27) / 32 : (pw * 9) / 16;
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
