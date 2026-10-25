"use client";

import type { ReactNode } from "react";
import { WallSurface } from "./beyond-panel";
import styles from "./hero2.module.css";

// hero 9's 16x9: one screen in the wall. The room is the Beyond tile's — the same near-black matte
// tiles, the same seams (WallSurface) — and the tile in the middle, where Beyond's lights white, is
// a screen here: set flush in the wall, a fine dark bezel, a breath of reflection across its glass,
// its light faint on the wall round it. On it, 16x9's wall of brand films, each under its brand's
// mark (the FormatGrid passed in, three by three). It comes on from a line across it, as the tile
// does.
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
