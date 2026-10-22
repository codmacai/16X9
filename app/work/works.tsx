"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "./_shared/chrome";
import { WORKS_9X16 } from "./_shared/data";
import ReelMedia from "./reel-media";
import styles from "./accounts.module.css";

// ===========================================================================
// WORK, 9x16 — under the accounts, the selected reels: a wall of 9:16 frames,
// four across (three on a tablet, two on a phone), every other column set a
// little lower so the wall reads as a scroll of feeds. Each holds its still;
// pointed at, it plays (on a touch screen, the one most in view plays), the
// rest of the wall dims; clicked, it opens full height in the player.
// ===========================================================================

export default function Works({ onOpen }: { onOpen: (i: number) => void }) {
  const reduce = !!useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const [inView, setInView] = useState<number | null>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  // touch screens have no pointing: the frame most in view plays, one at a time
  useEffect(() => {
    if (!window.matchMedia("(hover: none)").matches) return;
    const seen = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(Number((e.target as HTMLElement).dataset.i), e.intersectionRatio));
        let best: number | null = null;
        let most = 0.6;
        seen.forEach((r, i) => {
          if (r > most) [best, most] = [i, r];
        });
        setInView(best);
      },
      { threshold: [0, 0.3, 0.6, 0.8, 1] }
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const playing = hover ?? inView;
  return (
    <section className={styles.works} aria-labelledby="works-title">
      <header className={styles.worksHead}>
        <p className={styles.index}>
          <span>02</span> The work
        </p>
        {/* the lines rise in their masks once the heading is in view (watched on the heading: the
            lines themselves start hidden in their masks, so they'd never be seen to come in) */}
        <motion.h2
          id="works-title"
          className={styles.worksTitle}
          initial={reduce ? false : "hidden"}
          whileInView="shown"
          viewport={{ once: true, amount: 0.5 }}
        >
          {["Selected", "reels"].map((line, i) => (
            <span key={line} className={styles.mask}>
              <motion.span
                variants={{ hidden: { y: "105%" }, shown: { y: 0, transition: { delay: i * 0.08, duration: 1.1, ease: EASE } } }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </motion.h2>
        <p className={styles.worksLede}>Reels, stories and series, shot, cut and graded vertical for the feed they live in.</p>
        <p className={styles.worksCount}>{String(WORKS_9X16.length).padStart(2, "0")} works</p>
      </header>

      <ol className={`${styles.wall} ${hover !== null ? styles.wallFocus : ""}`}>
        {WORKS_9X16.map((w, i) => (
          <li
            key={w.src}
            ref={(el) => {
              items.current[i] = el;
            }}
            data-i={i}
            className={`${styles.work} ${playing === i ? styles.workOn : ""}`}
          >
            <motion.button
              type="button"
              className={styles.workBtn}
              initial={reduce ? false : { opacity: 0, y: 48 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ delay: (i % 4) * 0.07, duration: 1.1, ease: EASE }}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
              onClick={() => onOpen(i)}
              aria-label={`Play ${w.title}, ${w.kind}`}
            >
              <span className={styles.workFrame}>
                <ReelMedia reel={w} live play={playing === i} />
                <span className={styles.workPlay} aria-hidden="true">
                  <i />
                  Play
                </span>
              </span>
              <span className={styles.workMeta}>
                <span className={styles.workNo}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.workTitle}>{w.title}</span>
                <span className={styles.workKind}>{w.kind}</span>
              </span>
            </motion.button>
          </li>
        ))}
      </ol>

      <motion.footer
        className={styles.outro}
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 1, ease: EASE }}
      >
        <p className={styles.outroLine}>Have a story for the scroll?</p>
        <a className={styles.outroLink} href="/about#contact">
          Let&apos;s talk <i aria-hidden="true">↗</i>
        </a>
      </motion.footer>
    </section>
  );
}
