"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import RoomSwitch from "../hero3/room-switch";
import { Band, EASE, rootClass } from "./_shared/chrome";
import { ACCOUNTS, instagramOf } from "./_shared/data";
import Reels from "./reels";
import Profile, { Player } from "./profile";
import styles from "./accounts.module.css";

// ===========================================================================
// WORK, 9x16 — the Instagram accounts the studio runs, as four slim 9:16
// frames in the dark, outlined in a hairline, each holding the brand's logo
// at its centre (its Instagram picture, in a circle) and its followers and
// posts at the foot; name and handle sit underneath. Point at one (or tap it)
// and it plays that account's reels inside the frame, a feed you scroll
// through like the app. The name underneath opens the account on Instagram.
// ===========================================================================

export default function Accounts() {
  const reduce = !!useReducedMotion();
  const router = useRouter();
  const [on, setOn] = useState<string | null>(null);
  // clicked: the account opens as its Instagram page, a grid of its reels
  const [open, setOpen] = useState<string | null>(null);
  const openAcc = ACCOUNTS.find((a) => a.handle === open);
  // a reel clicked in a frame's grid plays on its own
  const [reel, setReel] = useState<{ handle: string; i: number } | null>(null);
  const reelAcc = reel ? ACCOUNTS.find((a) => a.handle === reel.handle) : undefined;
  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band
        crumb="Index"
        workHref="/work?format=9x16"
        center={<RoomSwitch room="9x16" onSwitch={(k) => router.push(`/work?format=${k}`, { scroll: false })} onIndex={() => router.push("/hero3")} tone="light" />}
      />
      <section className={styles.sheet} aria-label="9x16 work — the Instagram accounts we run">
        <motion.p
          className={styles.kicker}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.5, duration: 0.9 } }}
        >
          Made for the scroll — the accounts we run
        </motion.p>
        <ul className={styles.row}>
          {ACCOUNTS.map((a, i) => (
            <motion.li
              key={a.handle}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.6 + i * 0.08, duration: 1, ease: EASE } }}
            >
              <div
                className={`${styles.item} ${on === a.handle ? styles.itemOn : ""}`}
                onPointerEnter={(e) => e.pointerType === "mouse" && setOn(a.handle)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setOn(null)}
                onClick={() => setOpen(a.handle)}
              >
                <span className={styles.frame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.logo} src={a.logo} alt="" draggable={false} />
                  <span className={styles.stats}>
                    {a.followers} followers · {a.posts} posts
                  </span>
                  {a.reels?.length ? <Reels reels={a.reels} logo={a.logo} handle={a.handle} on={on === a.handle} onPick={(i) => setReel({ handle: a.handle, i })} /> : null}
                </span>
                <a className={styles.name} onClick={(e) => e.stopPropagation()} href={instagramOf(a)} target="_blank" rel="noopener noreferrer" aria-label={`${a.name} on Instagram (@${a.handle})`}>
                  {a.name}
                </a>
                <span className={styles.handle}>
                  @{a.handle} <i aria-hidden="true">↗</i>
                </span>
              </div>
            </motion.li>
          ))}
        </ul>
      </section>
      <AnimatePresence>
        {reelAcc && reel && (
          <Player key="reel" reels={reelAcc.reels ?? []} start={reel.i} handle={reelAcc.handle} logo={reelAcc.logo} onClose={() => setReel(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>{openAcc && <Profile key={openAcc.handle} account={openAcc} onClose={() => setOpen(null)} />}</AnimatePresence>
    </main>
  );
}
