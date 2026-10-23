"use client";

import { useState } from "react";
import type { Reel } from "./_shared/data";
import ReelMedia from "./reel-media";
import styles from "./accounts.module.css";

// An account's reels in its 9:16 frame on the 9x16 page (accounts.tsx) while
// it's pointed at: one at a time, the whole frame, as stories play — a fine
// bar for each at the head, the one playing filling, then the next. The
// account's picture (the frame's logo, which the CSS draws up to the head)
// with its name beside it. Clicks pass through to the frame, which opens the
// account.
const MAX = 5;

export default function AccountStory({ reels, label, on }: { reels: Reel[]; label: string; on: boolean }) {
  const list = reels.slice(0, MAX);
  const [k, setK] = useState(0);
  // pointed at again: from the first
  const [was, setWas] = useState(on);
  if (on !== was) {
    setWas(on);
    if (on) setK(0);
  }
  return (
    <span className={`${styles.story} ${on ? styles.storyOn : ""}`} aria-hidden="true">
      {on && <ReelMedia key={k} reel={list[k]} live play />}
      <span className={styles.storyBars}>
        {list.map((_, i) => (
          <i key={i} className={i < k ? styles.barDone : undefined}>
            {on && i === k && <b onAnimationEnd={() => setK((n) => (n + 1) % list.length)} />}
          </i>
        ))}
      </span>
      <span className={styles.storyName}>{label}</span>
    </span>
  );
}
