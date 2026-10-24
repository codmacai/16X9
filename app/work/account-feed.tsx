"use client";

import { useEffect, useRef, useState } from "react";
import type { Reel } from "./_shared/data";
import ReelMedia from "./reel-media";
import { Views } from "./profile";
import styles from "./accounts.module.css";

// An account's feed in its 9:16 frame on the 9x16 page (accounts.tsx), only
// while it's pointed at — as the app has it: one reel the whole frame, the
// next a scroll down (each turn of the wheel over the frame moves the feed one
// reel, and at its first or last reel the wheel goes back to the page). The
// reel in view plays and the ones either side are ready; a fine mark for each
// down the side keeps your place; the account's picture (the frame's logo,
// which the CSS draws up to the head) and name sit at the top, each reel's
// views at its foot. A click anywhere opens the account.
const MAX = 6;

export default function AccountFeed({ reels, label, on }: { reels: Reel[]; label: string; on: boolean }) {
  const list = reels.slice(0, MAX);
  const feedRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  // pointed at again: from the top of the feed
  const [was, setWas] = useState(on);
  if (on !== was) {
    setWas(on);
    if (on) setAt(0);
  }
  useEffect(() => {
    if (on && feedRef.current) feedRef.current.scrollTop = 0;
  }, [on]);

  // a turn of the wheel, one reel: a notch is too small a move for the feed's snap (it would settle
  // back where it was), so the feed takes the wheel and goes a whole reel — once per gesture, so a
  // trackpad's long glide doesn't run through them all; past either end, the page has the wheel
  useEffect(() => {
    const el = feedRef.current;
    if (!el || !on) return;
    let last = 0;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const cur = Math.round(el.scrollTop / el.clientHeight);
      const next = cur + (e.deltaY > 0 ? 1 : -1);
      if (next < 0 || next >= el.children.length) return;
      e.preventDefault();
      const now = performance.now();
      const quiet = now - last > 220;
      last = now;
      if (quiet) el.scrollTo({ top: next * el.clientHeight, behavior: "smooth" });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [on]);

  return (
    <span className={`${styles.story} ${on ? styles.storyOn : ""}`} aria-hidden="true">
      <div
        ref={feedRef}
        className={styles.feed}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.round(el.scrollTop / el.clientHeight));
        }}
      >
        {list.map((r, i) => (
          <div key={i} className={styles.feedReel}>
            {on && Math.abs(i - at) <= 1 && <ReelMedia reel={r} live play={i === at} />}
            <Views n={r.views} small />
          </div>
        ))}
      </div>
      <span className={styles.storyName}>{label}</span>
      <span className={styles.feedMarks}>
        {list.map((_, i) => (
          <i key={i} className={i === at ? styles.markOn : undefined} />
        ))}
      </span>
    </span>
  );
}
