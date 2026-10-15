"use client";

import { useEffect, useRef, useState } from "react";
import { stillFor } from "./_shared/data";
import styles from "./accounts.module.css";

// An account's reels inside its 9:16 frame: a vertical feed that snaps one reel
// at a time, like the app. Only the reel in view plays; the rest wait. Shown
// while the frame is pointed at (or tapped on a touch screen).
export default function Reels({ reels, logo, handle, on }: { reels: string[]; logo: string; handle: string; on: boolean }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [at, setAt] = useState(0);

  // the reel in view plays; leaving the frame pauses it and goes back to the first
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (on && i === at) {
        v.muted = true;
        v.play().catch(() => {});
      } else v.pause();
    });
  }, [on, at]);
  useEffect(() => {
    if (on) return;
    const t = window.setTimeout(() => {
      feedRef.current?.scrollTo({ top: 0 });
      setAt(0);
    }, 500);
    return () => window.clearTimeout(t);
  }, [on]);

  return (
    <div className={`${styles.reels} ${on ? styles.reelsOn : ""}`} aria-hidden={!on}>
      <div
        ref={feedRef}
        className={styles.feed}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.round(el.scrollTop / el.clientHeight));
        }}
      >
        {reels.map((src, i) => (
          <div key={src + i} className={styles.reel}>
            <video
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              src={on || i === 0 ? src : undefined}
              poster={stillFor(src)}
              muted
              loop
              playsInline
              preload={i === 0 ? "metadata" : "none"}
              disablePictureInPicture
            />
          </div>
        ))}
      </div>
      {/* like the app: who's posting at the top, and where you are in the feed down the side */}
      <span className={styles.reelsHead}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" draggable={false} />@{handle}
      </span>
      <span className={styles.reelsDots}>
        {reels.map((_, i) => (
          <i key={i} className={i === at ? styles.dotOn : ""} />
        ))}
      </span>
      <span className={styles.reelsHint}>Click to view all reels</span>
    </div>
  );
}
