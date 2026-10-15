"use client";

import { stillFor } from "./_shared/data";
import styles from "./accounts.module.css";

// An account's reels inside its 9:16 frame while it's pointed at: a small
// grid, three across, like its Instagram page. Scroll the grid; click a reel
// to play it.
export default function Reels({
  reels,
  logo,
  handle,
  on,
  onPick,
}: {
  reels: string[];
  logo: string;
  handle: string;
  on: boolean;
  onPick: (i: number) => void;
}) {
  return (
    <div className={`${styles.reels} ${on ? styles.reelsOn : ""}`} aria-hidden={!on}>
      <span className={styles.reelsHead}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" draggable={false} />@{handle}
      </span>
      <div className={styles.grid}>
        {reels.map((src, i) => (
          <button
            key={src + i}
            type="button"
            className={styles.cell}
            tabIndex={on ? 0 : -1}
            aria-label={`Play reel ${i + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(i);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stillFor(src)} alt="" draggable={false} loading="lazy" />
            <i aria-hidden="true">▶</i>
          </button>
        ))}
      </div>
    </div>
  );
}
