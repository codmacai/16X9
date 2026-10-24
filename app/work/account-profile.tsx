"use client";

import { useEffect, useRef, useState } from "react";
import type { Account } from "./_shared/data";
import ReelMedia from "./reel-media";
import { Views } from "./profile";
import styles from "./accounts.module.css";

// An account's Instagram page in its 9:16 frame on the 9x16 page
// (accounts.tsx), only while it's pointed at — as the app has it, in its dark
// mode: the handle at the top; the picture (the frame's logo, which the CSS
// flies up into its place) with the posts and followers beside it; the name
// and the blue Follow; the tabs, Reels lit; and the reels three across, each
// with its views. It scrolls inside the frame like the app (at its ends the
// page has the wheel); the reel pointed at plays, and a click plays it whole.
// A click anywhere else opens the account's page.

const GridIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
  </svg>
);
const ReelsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M3 8h18M8 3l3 5M14 3l3 5" />
    <path d="m10 11.5 4.5 2.5-4.5 2.5z" />
  </svg>
);

export default function AccountProfile({ account: a, on, onPick }: { account: Account; on: boolean; onPick: (i: number) => void }) {
  const reels = a.reels ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState<number | null>(null);
  // pointed at again: from the top of the page, nothing playing yet
  const [was, setWas] = useState(on);
  if (on !== was) {
    setWas(on);
    if (on) setPlay(null);
  }
  useEffect(() => {
    if (on && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [on]);

  return (
    <div className={`${styles.ig} ${on ? styles.igOn : ""}`} aria-hidden={!on}>
      <div ref={scrollRef} className={styles.igScroll}>
        <div className={styles.igTop}>
          <b>{a.demo ? a.name : a.handle}</b>
        </div>
        <div className={styles.igHead}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.igAvatar} src={a.logo} alt="" draggable={false} />
          <div className={styles.igStats}>
            <span>
              <b>{a.demo ? reels.length : a.posts.toLocaleString("en-US")}</b> {a.demo ? "reels" : "posts"}
            </span>
            {!a.demo && (
              <span>
                <b>{a.followers}</b> followers
              </span>
            )}
          </div>
        </div>
        <p className={styles.igName}>{a.name}</p>
        {a.demo && <p className={styles.igBio}>Demo account</p>}
        <span className={styles.igFollow}>Follow</span>
        <div className={styles.igTabs}>
          <i>
            <GridIcon />
          </i>
          <i className={styles.igTabOn}>
            <ReelsIcon />
          </i>
        </div>
        <div className={styles.igGrid}>
          {reels.map((r, i) => (
            <button
              key={i}
              type="button"
              className={styles.igCell}
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
      </div>
    </div>
  );
}
