"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { resolveVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "../hero7/project-view";
import { posterFor } from "../hero7/wall-playback";
import Drawer from "../hero11/drawer";
import { Reel, type ReelFilm } from "./stage";
import styles from "./hero24.module.css";

// ===========================================================================
// HERO 24 — the reel.
//
// Hero 13's film tiles, gathered into one curved band in the middle of the
// page: three rows of screens around the inside of a cylinder, each playing
// its film in black and white. Drag or scroll to run the reel; point at a
// film to bring it forward in colour; click to open it (hero 7's project
// view). The headline sits above the band, the line and the client names
// below. The 3D is in stage.ts.
// ===========================================================================

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const LOGO_SRC = "/logo.png";

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Hero24() {
  const variant = useMemo(() => resolveVariant(new Date()), []);
  const clips = variant.clips;
  const films: ReelFilm[] = useMemo(() => clips.map((c) => ({ ...c, poster: posterFor(c.src) })), [clips]);
  const reduce = !!useReducedMotion();

  const hostRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<Reel | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [project, setProject] = useState<OpenProject | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reel = new Reel(
      host,
      films,
      {
        onHover: setHover,
        onOpen: (index, rect, time) => setProject({ index, rect, time }),
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    reelRef.current = reel;
    return () => {
      reel.dispose();
      reelRef.current = null;
    };
  }, [films]);

  // the reel goes quiet under the film and the menu
  useEffect(() => {
    reelRef.current?.setPaused(project !== null || menu);
  }, [project, menu]);

  const rise = (delay: number, y = 14) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0, transition: { duration: 1.2, delay, ease: EASE } },
        };

  const hovered = hover !== null ? clips[hover] : null;

  return (
    <section className={styles.root} aria-label={`16x9 — ${variant.headline.join(" ")}`}>
      <div ref={hostRef} className={styles.stage} aria-hidden="true" />

      {/* ================= Top bar ================= */}
      <motion.header className={styles.top} {...rise(0.6, -10)}>
        <Link href="/" className={styles.logo} aria-label="Home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" />
        </Link>
        <button
          type="button"
          className={`${styles.burger} ${menu ? styles.burgerOpen : ""}`}
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <span />
          <span />
        </button>
      </motion.header>

      {/* ================= Headline, above the band ================= */}
      <motion.h1 className={styles.headline} {...rise(0.9)}>
        {variant.headline.join(" ")}
      </motion.h1>

      {/* ================= Under the band: the line, or the film you point at ================= */}
      <motion.div className={styles.under} {...rise(1.4, 8)}>
        <span className={styles.hint}>
          <span aria-hidden="true">←</span> Drag <span aria-hidden="true">→</span>
        </span>
        <div className={styles.readout} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={hover === null ? "sub" : `film-${hover}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
            >
              {hovered ? (
                <>
                  <b>{pad2((hover ?? 0) + 1)}</b> {hovered.title} <i>{hovered.duration}</i>
                </>
              ) : (
                variant.sub
              )}
            </motion.span>
          </AnimatePresence>
        </div>
        <span className={styles.count}>{pad2(clips.length)} films</span>
      </motion.div>

      {/* ================= Client names ================= */}
      <motion.div className={styles.clients} {...rise(1.8, 0)} aria-label="Clients">
        <div className={styles.clientsTrack}>
          {[0, 1].map((k) => (
            <div key={k} className={styles.clientsRun} aria-hidden={k === 1}>
              {variant.clients.map((c) => (
                <span key={c.name} className={styles[`client_${c.style}`]}>
                  {c.name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ================= Menu ================= */}
      <AnimatePresence>
        {menu && (
          <motion.div
            key="menu"
            className={styles.menuSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)" }}
            animate={reduce ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, ease: EASE_CINE } }}
            exit={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.75, ease: EASE_CINE } }}
          >
            <Drawer onClose={() => setMenu(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= The film, opened from its screen ================= */}
      <AnimatePresence>
        {project && <ProjectView key="project" clips={clips} open={project} onClose={() => setProject(null)} />}
      </AnimatePresence>
    </section>
  );
}
