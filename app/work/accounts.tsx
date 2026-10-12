"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Band, EASE, Info, rootClass } from "./_shared/chrome";
import { ACCOUNTS, instagramOf } from "./_shared/data";
import cabinet from "./cabinet.module.css";
import styles from "./accounts.module.css";

// ===========================================================================
// WORK, 9x16 — the Instagram accounts the studio runs, each a tall 9:16
// frame like the screen it lives on: its number and the platform above, the
// account's name large at its centre with the handle under it, followers and
// posts at its foot. Point at one and it lifts, its edge lights and the way
// out to Instagram comes forward; click to open the account.
// ===========================================================================

export default function Accounts() {
  const reduce = !!useReducedMotion();
  return (
    <main className={`${rootClass} ${cabinet.page} ${styles.page}`}>
      <Band crumb="Index" />
      <section className={`${cabinet.sheet} ${styles.sheet}`} aria-label="9x16 work">
        <Info left="16X9 — 9x16 work" />
        <div className={cabinet.lockup}>
          <h1 className={cabinet.headline}>
            {["9x16", "work"].map((line, i) => (
              <span key={line} className={cabinet.mask}>
                <motion.span
                  className={cabinet.line}
                  initial={{ y: "105%" }}
                  animate={{ y: 0, transition: reduce ? { duration: 0 } : { delay: 0.4 + i * 0.12, duration: 1.15, ease: EASE } }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className={cabinet.lede}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { delay: 0.9, duration: 1.1, ease: EASE } }}
          >
            Stories made for the scroll. The Instagram accounts we run, day in, day out.
          </motion.p>
        </div>

        <ul className={styles.row}>
          {ACCOUNTS.map((a, i) => (
            <motion.li
              key={a.handle}
              initial={reduce ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.7 + i * 0.09, duration: 1.1, ease: EASE } }}
            >
              <a className={styles.card} href={instagramOf(a)} target="_blank" rel="noopener noreferrer" aria-label={`${a.name} on Instagram (@${a.handle})`}>
                <span className={styles.top}>
                  <i>{String(i + 1).padStart(2, "0")}</i>
                  <i>Instagram</i>
                </span>
                <span className={styles.name}>
                  <b>{a.name}</b>
                  <span className={styles.rule} />
                  <i>@{a.handle}</i>
                </span>
                <span className={styles.foot}>
                  <span>
                    <b>{a.followers}</b> followers
                  </span>
                  <span>
                    <b>{a.posts}</b> posts
                  </span>
                </span>
                <span className={styles.go} aria-hidden="true">
                  Open <span>↗</span>
                </span>
              </a>
            </motion.li>
          ))}
        </ul>
      </section>
    </main>
  );
}
