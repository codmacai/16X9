"use client";

import { Fragment, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Band, EASE, EASE_CINE, EnterCursor, Info, rootClass, Still, usePlayer } from "../_shared/chrome";
import { CATEGORIES, PROJECTS, stillFor, type CategoryId, type Project } from "../_shared/data";
import styles from "./v1.module.css";

// ===========================================================================
// WORK 01 — THE CABINET. The burger menu's drawer, opened all the way: every
// category is a divider with its own tab, and the films are filed behind it.
// Scroll and the files slide up and settle on the stack, one over the next.
// The dividers' tabs stay up top as you pass them, side by side the way a
// real drawer's do, so the top of the screen fills in as an index of where
// you've been; click one to go back to it. Point at a film and it comes into
// colour and starts to play.
// ===========================================================================

const ORDER = CATEGORIES.map((c) => ({ ...c, films: PROJECTS.filter((p) => p.category === c.id) }));
const LIST = ORDER.flatMap((c) => c.films); // the order they're filed in
const TOTAL = String(LIST.length).padStart(2, "0");

const toDivider = (id: CategoryId) => {
  const el = document.getElementById(`divider-${id}`);
  if (!el) return;
  // dividers are sticky, so measure where it sits in the flow, not where it's stuck
  const top = (el.parentElement?.offsetTop ?? 0) + el.offsetTop;
  window.scrollTo({ top, behavior: "smooth" });
};

export default function WorkCabinet() {
  const reduce = !!useReducedMotion();
  const [hover, setHover] = useState<Project | null>(null);
  const [pull, setPull] = useState<number | null>(null);
  const { play, player } = usePlayer(LIST);

  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band crumb="01 The cabinet" />

      {/* ================= the front of the cabinet ================= */}
      <motion.section
        className={styles.sheet}
        initial={reduce ? false : { clipPath: "inset(0% 0% 100% 0%)" }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { delay: 0.2, duration: 1.15, ease: EASE_CINE } }}
      >
        <Info left="16X9 — Selected work" centre={`${LIST.length} films · ${CATEGORIES.length} drawers`} />
        <div className={styles.lockup}>
          <h1 className={styles.headline}>
            {["The work,", "on file"].map((line, i) => (
              <span key={line} className={styles.mask}>
                <motion.span
                  className={styles.line}
                  initial={reduce ? false : { y: "105%" }}
                  animate={{ y: 0, transition: { delay: 0.6 + i * 0.12, duration: 1.15, ease: EASE } }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className={styles.lede}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 1.2, duration: 1.1, ease: EASE } }}
          >
            Commercials, brand films, fashion, social and documentary. Pull a folder, or scroll and let the files
            come to you.
          </motion.p>
        </div>

        {/* the front of the drawer: one folder per category, stacked the way the
            menu stacks its three; pull one up and it opens on that divider */}
        <nav className={styles.front} aria-label="Categories" onPointerLeave={() => setPull(null)}>
          {ORDER.map((c, i) => {
            const on = pull === i;
            return (
              <motion.button
                key={c.id}
                type="button"
                className={`${styles.folder} ${on ? styles.folderOn : ""} ${pull !== null && !on ? styles.folderAway : ""}`}
                style={{ ["--c" as string]: i }}
                onClick={() => toDivider(c.id)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setPull(i)}
                onFocus={() => setPull(i)}
                onBlur={() => setPull(null)}
                initial={reduce ? false : { y: "110%" }}
                animate={{
                  y: on ? "-4vh" : pull !== null && i > pull ? "1.6vh" : 0,
                  transition:
                    pull !== null
                      ? { type: "spring", stiffness: 140, damping: 20, mass: 0.9 }
                      : { delay: 0.55 + i * 0.1, duration: 1.15, ease: EASE_CINE },
                }}
                aria-label={`${c.label}, ${c.films.length} films`}
              >
                <span className={styles.stock}>
                  <span className={styles.tab}>
                    <span className={styles.labelNo}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={styles.tabName}>
                      <span className={styles.long}>{c.label}</span>
                      <span className={styles.short}>{c.short}</span>
                    </span>
                    <span className={styles.labelNo}>{c.films.length}</span>
                  </span>
                  <span className={styles.window}>
                    <Still src={stillFor(c.films[0].src)} on={on} />
                    <span className={styles.shade} aria-hidden="true" />
                    <span className={styles.caption}>
                      <span className={styles.title}>{c.label}</span>
                      <span className={styles.meta}>
                        <span>{c.films.map((f) => f.title).join(" · ")}</span>
                        <span className={styles.enter}>
                          Open <span>→</span>
                        </span>
                      </span>
                    </span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </nav>
      </motion.section>

      {/* ================= the drawer ================= */}
      <div className={styles.drawer}>
        {ORDER.map((c, ci) => (
          <Fragment key={c.id}>
            <section id={`divider-${c.id}`} className={styles.divider} style={{ ["--c" as string]: ci }} aria-label={c.label}>
              <span className={styles.stock}>
                <button type="button" className={styles.tab} onClick={() => toDivider(c.id)} aria-label={`Back to ${c.label}`}>
                  <span className={styles.labelNo}>{String(ci + 1).padStart(2, "0")}</span>
                  <span className={styles.tabName}>
                    <span className={styles.long}>{c.label}</span>
                    <span className={styles.short}>{c.short}</span>
                  </span>
                  <span className={styles.labelNo}>{c.films.length}</span>
                </button>
                <span className={styles.dividerBody}>
                  <span className={styles.dividerHead}>
                    <span className={styles.dividerNo}>{String(ci + 1).padStart(2, "0")}</span>
                    <h2 className={styles.dividerTitle}>{c.label}</h2>
                  </span>
                  <ol className={styles.dividerList}>
                    {c.films.map((p) => (
                      <li key={p.no}>
                        <span>{p.title}</span>
                        <span>{p.client}</span>
                        <span>{p.year}</span>
                      </li>
                    ))}
                  </ol>
                </span>
              </span>
            </section>

            {c.films.map((p, k) => {
              const n = LIST.indexOf(p) + 1;
              const on = hover === p;
              return (
                <article
                  key={p.no}
                  className={`${styles.file} ${on ? styles.fileOn : ""}`}
                  style={{ ["--k" as string]: k }}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHover(p)}
                  onPointerLeave={() => setHover(null)}
                >
                  <button
                    type="button"
                    className={styles.fileStock}
                    onClick={(e) => play(p, e.currentTarget.querySelector(`.${styles.window}`) ?? e.currentTarget)}
                    onFocus={() => setHover(p)}
                    onBlur={() => setHover(null)}
                    aria-label={`Play ${p.title}, ${p.client}, ${p.year}`}
                  >
                    <span className={styles.fileStrip} aria-hidden="true">
                      <span>
                        {String(n).padStart(2, "0")} / {TOTAL}
                      </span>
                      <span>{c.label}</span>
                      <span>{p.client}</span>
                    </span>
                    <span className={styles.window}>
                      <Still src={stillFor(p.src)} on={on} />
                      {on && (
                        <video className={styles.video} src={p.src} muted loop playsInline autoPlay preload="auto" aria-hidden="true" />
                      )}
                      <span className={styles.shade} aria-hidden="true" />
                      <span className={styles.caption} aria-hidden="true">
                        <span className={styles.title}>{p.title}</span>
                        <span className={styles.meta}>
                          <span>{p.line}</span>
                          <span>
                            {p.year} · {p.duration}
                          </span>
                          <span className={styles.enter}>
                            Play <span>→</span>
                          </span>
                        </span>
                      </span>
                    </span>
                  </button>
                </article>
              );
            })}
          </Fragment>
        ))}
        {/* the back of the drawer */}
        <div className={styles.back}>
          <span>End of the drawer</span>
          <a href="#contact">Start a film with us →</a>
        </div>
      </div>

      <EnterCursor label={hover ? hover.title : pull !== null ? ORDER[pull].label : null} />
      {player}
    </main>
  );
}
