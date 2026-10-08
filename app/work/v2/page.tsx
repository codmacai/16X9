"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Band, EASE, EASE_CINE, EnterCursor, Info, rootClass, usePlayer } from "../_shared/chrome";
import { CATEGORIES, PROJECTS, categoryOf, stillFor, type CategoryId, type Project } from "../_shared/data";
import styles from "./v2.module.css";

// ===========================================================================
// WORK 02 — THE INDEX. A single folder of card stock with a tab for every
// category; pick a tab and it comes forward, joined to the folder, and the
// list inside is refiled. The list is set like the menu's headline: light,
// wide capitals over hairlines. Point at a title and the film opens inside
// the line, a capsule the height of the capitals, the way the menu's
// "to life" carries its reel; the rest of the list steps back.
// ===========================================================================

type Filter = CategoryId | "all";
const TABS: { id: Filter; label: string; count: number }[] = [
  { id: "all", label: "All work", count: PROJECTS.length },
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: PROJECTS.filter((p) => p.category === c.id).length })),
];

export default function WorkIndex() {
  const reduce = !!useReducedMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const [hover, setHover] = useState<Project | null>(null);
  const list = useMemo(() => (filter === "all" ? PROJECTS : PROJECTS.filter((p) => p.category === filter)), [filter]);
  const { play, player } = usePlayer(list);

  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band crumb="02 The index" />

      <motion.section
        className={styles.sheet}
        initial={reduce ? false : { clipPath: "inset(0% 0% 100% 0%)" }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { delay: 0.2, duration: 1.15, ease: EASE_CINE } }}
      >
        <Info left="16X9 — Selected work" centre="Dubai · 2024 — 2026" />

        <header className={styles.head}>
          <h1 className={styles.headline}>
            <span className={styles.mask}>
              <motion.span
                className={styles.word}
                initial={reduce ? false : { y: "105%" }}
                animate={{ y: 0, transition: { delay: 0.6, duration: 1.15, ease: EASE } }}
              >
                Work
              </motion.span>
            </span>
            <motion.sup
              className={styles.count}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 1.1, duration: 0.8 } }}
            >
              ({String(list.length).padStart(2, "0")})
            </motion.sup>
          </h1>
          <motion.p
            className={styles.lede}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 1.2, duration: 1.1, ease: EASE } }}
          >
            Films, campaigns and content for brands that want to be seen — and remembered. Point at a title to watch it
            in the line.
          </motion.p>
        </header>

        {/* ================= the folder and its tabs ================= */}
        <div className={styles.tabs} role="tablist" aria-label="Categories">
          {TABS.map((t, i) => {
            const on = filter === t.id;
            return (
              <motion.button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={`${styles.tab} ${on ? styles.tabOn : ""}`}
                onClick={() => setFilter(t.id)}
                initial={reduce ? false : { y: "100%" }}
                animate={{ y: 0, transition: { delay: 0.8 + i * 0.07, duration: 1, ease: EASE_CINE } }}
              >
                <span className={styles.tabNo}>{String(i).padStart(2, "0")}</span>
                <span>{t.label}</span>
                <span className={styles.tabNo}>{t.count}</span>
              </motion.button>
            );
          })}
        </div>

        <div className={styles.folder}>
          <div className={styles.cols} aria-hidden="true">
            <span>No.</span>
            <span>Film</span>
            <span>Client</span>
            <span>Category</span>
            <span>Year</span>
          </div>
          <ol className={styles.list} onPointerLeave={() => setHover(null)}>
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map((p, i) => {
                const on = hover === p;
                const away = hover !== null && !on;
                return (
                  <motion.li
                    key={p.no}
                    layout={!reduce}
                    className={`${styles.row} ${on ? styles.rowOn : ""} ${away ? styles.rowAway : ""}`}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.035, duration: 0.7, ease: EASE } }}
                    exit={{ opacity: 0, transition: { duration: 0.25 } }}
                  >
                    <button
                      type="button"
                      className={styles.rowButton}
                      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(p)}
                      onFocus={() => setHover(p)}
                      onBlur={() => setHover(null)}
                      onClick={(e) => play(p, e.currentTarget)}
                      aria-label={`Play ${p.title}, ${p.client}, ${p.year}`}
                    >
                      <span className={styles.no}>{p.no}</span>
                      <span className={styles.titleCell}>
                        <span className={styles.title}>{p.title}</span>
                        {/* the film, inside the line */}
                        <motion.span
                          className={styles.reel}
                          initial={false}
                          animate={{ width: on ? "2.4em" : "0em", opacity: on ? 1 : 0 }}
                          transition={{ duration: reduce ? 0 : 0.8, ease: EASE_CINE }}
                          style={{ backgroundImage: `url(${stillFor(p.src)})` }}
                          aria-hidden="true"
                        >
                          {on && <video src={p.src} muted loop playsInline autoPlay preload="auto" />}
                        </motion.span>
                      </span>
                      <span className={`${styles.cell} ${styles.client}`}>{p.client}</span>
                      <span className={`${styles.cell} ${styles.cat}`}>{categoryOf(p.category).label}</span>
                      <span className={styles.cell}>
                        {p.year}
                        <span className={styles.enter}>
                          {p.duration} <i>→</i>
                        </span>
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        </div>

        <footer className={styles.foot}>
          <span>Have a film in mind?</span>
          <a href="#contact">Let&apos;s talk →</a>
        </footer>
      </motion.section>

      <EnterCursor label={hover ? "Play" : null} dark />
      {player}
    </main>
  );
}
