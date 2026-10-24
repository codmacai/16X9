"use client";

import { useState } from "react";
import type { Reel } from "./_shared/data";
import ReelMedia from "./reel-media";
import { Views } from "./profile";
import styles from "./accounts.module.css";

// An account's reels in its 9:16 frame on the 9x16 page (accounts.tsx), only
// while it's pointed at: the reel grid and nothing else — three across, as the
// app's Reels tab has them, filling the frame (nine fill it exactly; fewer
// stand taller), each with its views. The reel pointed at plays; a click
// plays it whole. A click anywhere else opens the account's page.
const MAX = 9;

export default function AccountReels({ reels, on, onPick }: { reels: Reel[]; on: boolean; onPick: (i: number) => void }) {
  const list = reels.slice(0, MAX);
  const [play, setPlay] = useState<number | null>(null);
  // pointed at again: nothing playing yet
  const [was, setWas] = useState(on);
  if (on !== was) {
    setWas(on);
    if (on) setPlay(null);
  }

  return (
    <div
      className={`${styles.ig} ${on ? styles.igOn : ""}`}
      style={{ gridTemplateRows: `repeat(${Math.ceil(list.length / 3)}, minmax(0, 1fr))` }}
      aria-hidden={!on}
    >
      {list.map((r, i) => (
        <button
          key={i}
          type="button"
          className={styles.igCell}
          style={{ transitionDelay: on ? `${0.12 + (i % 3) * 0.05 + Math.floor(i / 3) * 0.07}s` : "0s" }}
          tabIndex={on ? 0 : -1}
          aria-label={`Play reel ${i + 1}`}
          onPointerEnter={() => setPlay(i)}
          onPointerLeave={() => setPlay((cur) => (cur === i ? null : cur))}
          onClick={(e) => {
            e.stopPropagation();
            onPick(i);
          }}
        >
          {on && <ReelMedia reel={r} live={play === i} play={play === i} />}
          <Views n={r.views} small />
        </button>
      ))}
    </div>
  );
}
