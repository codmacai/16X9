"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { useRouter } from "next/navigation";
import RoomSwitch from "../hero4/room-switch";
import { Band, rootClass } from "./_shared/chrome";
import { ACCOUNTS, WORKS_9X16, instagramOf } from "./_shared/data";
import AccountReels from "./account-reels";
import Footer from "./_shared/footer";
import Intro916 from "./intro-916";
import Services916 from "./services-916";
import Profile, { Player } from "./profile";
import styles from "./accounts.module.css";
import SectionLabel from "./section-label";
import { useSmoothWheel } from "./smooth-wheel";

// ===========================================================================
// WORK, 9x16 — it opens on one vertical frame in the dark (intro-916.tsx),
// and the scroll brings up, over it, a sheet holding the Instagram accounts
// the studio runs, as slim 9:16 frames, outlined in a
// hairline, each holding the brand's logo at its centre (its Instagram
// picture, in a circle) and its followers and posts at the foot; name and
// handle underneath. Point at one and its reels come up in the frame, the
// grid alone, three across (account-reels.tsx): the one pointed at plays, a
// click plays it whole. Click the frame to open the account's page. The name underneath
// opens the account on Instagram. Four to a row (two on a phone), in true
// rows, each frame rising into place as it comes into view. Then what
// we do: the services, as cards, type only (services-916.tsx); then the footer.
// ===========================================================================

// a frame rising into place as it scrolls in
const RISE: Transition = { type: "spring", stiffness: 80, damping: 17, mass: 1 };

export default function Accounts() {
  const reduce = !!useReducedMotion();
  const router = useRouter();
  const [on, setOn] = useState<string | null>(null);
  // clicked: the account opens as its Instagram page, a grid of its reels
  const [open, setOpen] = useState<string | null>(null);
  const openAcc = ACCOUNTS.find((a) => a.handle === open);
  // a reel in the opening's frame clicked: it plays full height, the others a scroll away
  const [work, setWork] = useState<number | null>(null);
  // a reel clicked in an account's grid plays on its own
  const [reel, setReel] = useState<{ handle: string; i: number } | null>(null);
  const reelAcc = reel ? ACCOUNTS.find((a) => a.handle === reel.handle) : undefined;
  // the page glides on the wheel, except while something is open over it
  useSmoothWheel(!open && !reel && work === null);
  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band
        crumb="Index"
        workHref="/work?format=9x16"
        /* a reel or an account's page open: Back closes it first */
        onBack={work !== null ? () => setWork(null) : reel ? () => setReel(null) : open ? () => setOpen(null) : undefined}
        center={<RoomSwitch room="9x16" onSwitch={(k) => router.replace(`/work?format=${k}`, { scroll: false })} tone="light" />}
      />
      <Intro916 reduce={reduce} onOpen={setWork} />
      <section id="accounts" className={`${styles.sheet} ${reduce ? "" : styles.over}`} aria-label="9x16 work — the Instagram accounts we run">
        <SectionLabel no="01" reduce={reduce}>
          The accounts we run
        </SectionLabel>
        <ul className={styles.row}>
          {ACCOUNTS.map((a, i) => (
            // the frames in true rows, each rising into place as it comes into view
            <motion.li key={a.handle}>
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 70, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ ...RISE, delay: (i % 4) * 0.09 }}
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
                  {!a.demo && (
                    <span className={styles.stats}>
                      {a.followers} followers · {a.posts} posts
                    </span>
                  )}
                  {a.reels?.length ? <AccountReels reels={a.reels} on={on === a.handle} onPick={(i) => setReel({ handle: a.handle, i })} /> : null}
                </span>
                {a.demo ? (
                  <>
                    <span className={styles.name}>{a.name}</span>
                    <span className={styles.handle}>Demo account</span>
                  </>
                ) : (
                  <>
                    <a className={styles.name} onClick={(e) => e.stopPropagation()} href={instagramOf(a)} target="_blank" rel="noopener noreferrer" aria-label={`${a.name} on Instagram (@${a.handle})`}>
                      {a.name}
                    </a>
                    <span className={styles.handle}>
                      @{a.handle} <i aria-hidden="true">↗</i>
                    </span>
                  </>
                )}
              </div>
              </motion.div>
            </motion.li>
          ))}
        </ul>
      </section>
      <Services916 reduce={reduce} />
      <Footer />
      <AnimatePresence>
        {reelAcc && reel && (
          <Player key="reel" reels={reelAcc.reels ?? []} start={reel.i} handle={reelAcc.demo ? reelAcc.name : reelAcc.handle} logo={reelAcc.logo} onClose={() => setReel(null)} dark />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {work !== null && <Player key="work" reels={WORKS_9X16.slice(0, 5)} start={work} onClose={() => setWork(null)} dark />}
      </AnimatePresence>
      <AnimatePresence>{openAcc && <Profile key={openAcc.handle} account={openAcc} onClose={() => setOpen(null)} />}</AnimatePresence>
    </main>
  );
}

