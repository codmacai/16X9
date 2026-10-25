"use client";

import type { ReactNode } from "react";
import { WallSurface } from "./beyond-panel";
import styles from "./hero2.module.css";

// hero 9's 16x9: the tile in the middle a screen. The room is the Beyond tile's — the same near-black
// matte tiles, the same seams (WallSurface) — and the tile where Beyond's lights white is a screen
// here, exactly within its seams: 16x9's wall of brand films on it, three by three, each 16:9,
// each under its brand's mark (the FormatGrid passed in), edge to edge with only the wall's own fine
// seams between them, so the wall's grid runs on through it; the faintest sheen on its glass, its
// light faint on the wall round it. It comes on from a line across it, as the tile does.
export default function FramedScreen({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <div className={`${styles.wall} ${styles.tvRoom} ${on ? styles.tvOn : ""}`} aria-hidden="true">
      <WallSurface />
      <div className={styles.tv}>
        {children}
        <i className={styles.tvGlass} />
      </div>
    </div>
  );
}
