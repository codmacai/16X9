"use client";

import type { ReactNode } from "react";
import { WallSurface } from "./beyond-panel";
import styles from "./hero2.module.css";

// hero 9's 16x9: one wide white panel on the wall. The room is the Beyond tile's — the same
// near-black matte tiles, the same seams (WallSurface) — and on it, wider and larger than the tile,
// a panel of the same warm white, lit: 16x9's wall of brand films set into it as windows, each 16:9,
// each under its brand's mark (the FormatGrid passed in) — a row above the line of words and a row
// below, the line in ink on the white band between them — the white round them and between them its
// frame. It comes on from a line across it, as the tile does.
export default function FramedScreen({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <div className={`${styles.wall} ${styles.tvRoom} ${on ? styles.tvOn : ""}`} aria-hidden="true">
      <WallSurface />
      <div className={styles.tv}>
        {children}
      </div>
    </div>
  );
}
