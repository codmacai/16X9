"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { instagramOf, reelLink, stillFor, type Account, type Reel } from "./_shared/data";
import ReelMedia from "./reel-media";
import styles from "./profile.module.css";

// An account opened like its Instagram page, in white: the logo, name and
// numbers on top, then its reels in a three-across grid of 9:16 tiles with
// their views. Click a reel and it plays full height; scroll for the next.
// Views are stand-ins until the real numbers are added.

const EASE = [0.16, 1, 0.3, 1] as const;
// the eye and the count, as on Instagram (left out until the real count is in)
export function Views({ n, small = false }: { n: string; small?: boolean }) {
  if (!n || n === "—") return null;
  return (
    <span className={`${styles.views} ${small ? styles.viewsSmall : ""}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
      {n}
    </span>
  );
}

export default function Profile({ account, onClose }: { account: Account; onClose: () => void }) {
  const reels = account.reels ?? [];
  const [play, setPlay] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (play !== null) setPlay(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [play, onClose]);

  return (
    <motion.div
      className={styles.page}
      role="dialog"
      aria-modal="true"
      aria-label={`${account.name} reels`}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } }}
      exit={{ opacity: 0, y: 30, transition: { duration: 0.35 } }}
    >
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className={styles.inner}>
        <header className={styles.head}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.avatar} src={account.logo} alt="" />
          <div className={styles.meta}>
            <div className={styles.handleRow}>
              <h2>{account.handle}</h2>
              {!account.demo && (
                <a className={styles.follow} href={instagramOf(account)} target="_blank" rel="noopener noreferrer">
                  View on Instagram ↗
                </a>
              )}
            </div>
            {account.demo ? (
              <ul className={styles.counts}>
                <li>Demo account</li>
              </ul>
            ) : (
              <ul className={styles.counts}>
                <li>
                  <b>{account.posts}</b> posts
                </li>
                <li>
                  <b>{account.followers}</b> followers
                </li>
              </ul>
            )}
            <p className={styles.name}>{account.name}</p>
          </div>
        </header>

        <div className={styles.tabs}>
          <span className={styles.tabOn}>Reels</span>
        </div>

        <ul className={styles.grid}>
          {reels.map((r, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.04, duration: 0.6, ease: EASE } }}
            >
              <GridReel reel={r} onClick={() => setPlay(i)} />
            </motion.li>
          ))}
        </ul>
      </div>

      <AnimatePresence>
        {play !== null && <Player reels={reels} start={play} handle={account.handle} logo={account.logo} onClose={() => setPlay(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

// a grid tile: the reel's picture, its views, and (for a video we host) the reel itself while pointed at
function GridReel({ reel, onClick }: { reel: Reel; onClick: () => void }) {
  const [on, setOn] = useState(false);
  return (
    <button type="button" className={styles.tile} onClick={onClick} onPointerEnter={() => setOn(true)} onPointerLeave={() => setOn(false)}>
      <ReelMedia reel={reel} live play={on} />
      <Views n={reel.views} />
    </button>
  );
}

// the reel, full height in the middle like the app; scroll (or the arrows) for the next
export function Player({
  reels,
  start,
  handle,
  logo,
  onClose,
  dark = false,
}: {
  reels: Reel[];
  start: number;
  handle?: string;
  logo?: string;
  onClose: () => void;
  /** over a dark page: the room round the reel goes dark too */
  dark?: boolean;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [at, setAt] = useState(start);

  useEffect(() => {
    const f = feedRef.current;
    if (f) f.scrollTop = start * f.clientHeight;
  }, [start]);
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === at) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else v.pause();
    });
  }, [at]);
  const go = (d: number) => {
    const f = feedRef.current;
    if (f) f.scrollTo({ top: Math.max(0, Math.min(reels.length - 1, at + d)) * f.clientHeight, behavior: "smooth" });
  };

  return (
    <motion.div
      className={`${styles.player} ${dark ? styles.playerDark : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.35 } }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.phone}>
        <div ref={feedRef} className={styles.feed} onScroll={(e) => setAt(Math.round(e.currentTarget.scrollTop / e.currentTarget.clientHeight))}>
          {reels.map((r, i) => (
            <div key={i} className={styles.reel}>
              {r.ig ? (
                // Instagram's own player, cropped to the film: click it to play (Instagram doesn't let embeds start on their own)
                Math.abs(i - at) <= 1 && (
                  <div className={styles.igFull}>
                    <ReelMedia reel={r} interactive />
                  </div>
                )
              ) : (
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={Math.abs(i - at) <= 1 ? r.src : undefined}
                  poster={stillFor(r.src ?? "")}
                  style={r.zoom ? { scale: String(r.zoom) } : undefined}
                  muted
                  loop
                  playsInline
                  onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
                />
              )}
            </div>
          ))}
        </div>
        <span className={styles.playerHead}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} alt="" />}
          {reels[at]?.title ? (
            <span className={styles.playerTitle}>
              {reels[at].title}
              <small>{reels[at].kind}</small>
            </span>
          ) : (
            handle
          )}
          {reels[at]?.views && <Views n={reels[at].views} />}
        </span>
        {reels[at]?.ig && (
          <a className={styles.openIg} href={reelLink(reels[at].ig!)} target="_blank" rel="noopener noreferrer">
            Open on Instagram ↗
          </a>
        )}
      </div>
      <div className={styles.arrows}>
        <button type="button" onClick={() => go(-1)} disabled={at === 0} aria-label="Previous reel">
          ↑
        </button>
        <button type="button" onClick={() => go(1)} disabled={at === reels.length - 1} aria-label="Next reel">
          ↓
        </button>
      </div>
      <button type="button" className={styles.playerClose} onClick={onClose} aria-label="Close reel">
        ✕
      </button>
    </motion.div>
  );
}
