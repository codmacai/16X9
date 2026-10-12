"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import RoomSwitch from "../hero3/room-switch";
import { Band, EASE, rootClass } from "./_shared/chrome";
import { ACCOUNTS, instagramOf } from "./_shared/data";
import styles from "./accounts.module.css";

// ===========================================================================
// WORK, 9x16 — the Instagram accounts the studio runs, as four slim 9:16
// frames in the dark, outlined in a hairline, each holding the brand's logo
// at its centre (its Instagram picture, in a circle) and its followers and
// posts at the foot; name and handle sit underneath. Point at one and it
// fills with paper and the logo comes forward. Click to open the account on
// Instagram.
// ===========================================================================

export default function Accounts() {
  const reduce = !!useReducedMotion();
  const router = useRouter();
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
              <a className={styles.item} href={instagramOf(a)} target="_blank" rel="noopener noreferrer" aria-label={`${a.name} on Instagram (@${a.handle})`}>
                <span className={styles.frame} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.logo} src={a.logo} alt="" draggable={false} />
                  <span className={styles.stats}>
                    {a.followers} followers · {a.posts} posts
                  </span>
                </span>
                <span className={styles.name}>{a.name}</span>
                <span className={styles.handle}>
                  @{a.handle} <i aria-hidden="true">↗</i>
                </span>
              </a>
            </motion.li>
          ))}
        </ul>
      </section>
    </main>
  );
}
