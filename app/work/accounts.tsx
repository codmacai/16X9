"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue, type Transition, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import RoomSwitch from "../hero4/room-switch";
import { Band, EASE, rootClass } from "./_shared/chrome";
import { ACCOUNTS, SERVICES_9X16, WORKS_9X16, instagramOf, type Reel } from "./_shared/data";
import Reels from "./reels";
import Intro916 from "./intro-916";
import Services916 from "./services-916";
import Profile, { Player } from "./profile";
import styles from "./accounts.module.css";
import label from "./label.module.css";

// ===========================================================================
// WORK, 9x16 — it opens on one vertical frame in the dark (intro-916.tsx),
// and the scroll brings up, over it, a sheet holding the Instagram accounts
// the studio runs, as slim 9:16 frames, outlined in a
// hairline, each holding the brand's logo at its centre (its Instagram
// picture, in a circle) and its followers and posts at the foot; name and
// handle underneath. Point at one (or tap it) and it plays that account's
// reels inside the frame, a feed you scroll through like the app. The name
// underneath opens the account on Instagram. Four to a row (two on a phone);
// as the page scrolls past them each column drifts at its own pace. Then what
// we do: the services, as tickets (services-916.tsx).
// ===========================================================================

// a service clicked plays its kind of work, the others a scroll away
const SERVICE_REELS: Reel[] = SERVICES_9X16.map((sv, i) => ({
  src: sv.clip,
  views: "",
  title: sv.name.join(" "),
  kind: `Service ${String(i + 1).padStart(2, "0")}`,
  zoom: 1.46,
}));

// a frame rising into place as it scrolls in
const RISE: Transition = { type: "spring", stiffness: 80, damping: 17, mass: 1 };
// a section's label, its stub wiping in
const STUB: Variants = {
  out: { clipPath: "inset(0 100% 0 0)", y: 10 },
  in: { clipPath: "inset(0 0% 0 0)", y: 0, transition: { duration: 1.1, ease: EASE } },
};

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
  // a reel in the opening's frame clicked: it plays full height, the others a scroll away
  const [work, setWork] = useState<number | null>(null);
  const [svc, setSvc] = useState<number | null>(null);
  // as the page scrolls past the accounts, each column drifts at its own pace
  const rowRef = useRef<HTMLUListElement>(null);
  const { scrollYProgress } = useScroll({ target: rowRef, offset: ["start end", "end start"] });
  const drift = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.5 });
  const cols = [useDrift(drift, 30, reduce), useDrift(drift, 90, reduce), useDrift(drift, 50, reduce), useDrift(drift, 110, reduce)];
  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band
        crumb="Index"
        workHref="/work?format=9x16"
        /* a reel or an account's page open: Back closes it first */
        onBack={svc !== null ? () => setSvc(null) : work !== null ? () => setWork(null) : reel ? () => setReel(null) : open ? () => setOpen(null) : undefined}
        center={<RoomSwitch room="9x16" onSwitch={(k) => router.replace(`/work?format=${k}`, { scroll: false })} tone="light" />}
      />
      <Intro916 reduce={reduce} onOpen={setWork} />
      <section id="accounts" className={`${styles.sheet} ${reduce ? "" : styles.over}`} aria-label="9x16 work — the Instagram accounts we run">
        <motion.h2 className={label.label} initial={reduce ? false : "out"} whileInView="in" viewport={{ once: true, amount: 0.6 }}>
          <motion.span className={label.stub} variants={STUB}>
            <span>01</span>
            <span>The accounts we run</span>
          </motion.span>
        </motion.h2>
        <ul ref={rowRef} className={styles.row}>
          {ACCOUNTS.map((a, i) => (
            // the column's drift on the scroll, and the frame's own rise into place as it comes into view
            <motion.li key={a.handle} style={{ y: cols[i % 4] }}>
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
                  {a.reels?.length ? <Reels reels={a.reels} logo={a.logo} label={a.demo ? a.name : `@${a.handle}`} on={on === a.handle} onPick={(i) => setReel({ handle: a.handle, i })} /> : null}
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
      <Services916 reduce={reduce} onOpen={setSvc} />
      <AnimatePresence>
        {reelAcc && reel && (
          <Player key="reel" reels={reelAcc.reels ?? []} start={reel.i} handle={reelAcc.demo ? reelAcc.name : reelAcc.handle} logo={reelAcc.logo} onClose={() => setReel(null)} dark />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {work !== null && <Player key="work" reels={WORKS_9X16.slice(0, 5)} start={work} onClose={() => setWork(null)} dark />}
      </AnimatePresence>
      <AnimatePresence>{svc !== null && <Player key="svc" reels={SERVICE_REELS} start={svc} onClose={() => setSvc(null)} dark />}</AnimatePresence>
      <AnimatePresence>{openAcc && <Profile key={openAcc.handle} account={openAcc} onClose={() => setOpen(null)} />}</AnimatePresence>
    </main>
  );
}


// a column's drift as the page scrolls past: from `px` below its place to `px` above it
function useDrift(progress: MotionValue<number>, px: number, reduce: boolean) {
  return useTransform(progress, [0, 1], reduce ? [0, 0] : [px, -px]);
}
