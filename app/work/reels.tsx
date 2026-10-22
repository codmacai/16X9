"use client";

import type { Reel } from "./_shared/data";
import ReelMedia from "./reel-media";
import { Views } from "./profile";
import styles from "./accounts.module.css";

// An account's reels inside its 9:16 frame while it's pointed at: a small
// grid, three across, like its Instagram page. Scroll the grid; click a reel
// to play it.
export default function Reels({
  reels,
  logo,
  label,
  on,
  onPick,
}: {
  reels: Reel[];
  logo: string;
  /** shown by the logo at the top: the account's @handle (a demo account's name) */
  label: string;
  on: boolean;
  onPick: (i: number) => void;
}) {
  return (
    <div className={`${styles.reels} ${on ? styles.reelsOn : ""}`} aria-hidden={!on}>
      <span className={styles.reelsHead}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" draggable={false} />
        {label}
      </span>
      <div className={styles.grid}>
        {reels.map((r, i) => (
          <button
            key={i}
            type="button"
            className={styles.cell}
            tabIndex={on ? 0 : -1}
            aria-label={`Play reel ${i + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(i);
            }}
          >
            {on && <ReelMedia reel={r} />}
            <Views n={r.views} small />
          </button>
        ))}
      </div>
    </div>
  );
}
