"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { Archivo } from "next/font/google";
import styles from "./hero11.module.css";

// ===========================================================================
// HERO 11 — the drawer. A navigation hero after the file-divider reference,
// turned horizontal: a black brand band at the top, a paper sheet with the
// line, and three folders stacked down the screen like files in a drawer,
// each with a numbered tab. Point at a folder and it is pulled up out of the
// stack: its film turns from black-and-white to colour and plays, its label
// and a way in come forward, and the other folders sink back. Each folder is
// a link: Work, About, Services.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

const LOGO_SRC = "/logo.png";
const FOLDERS = [
  { no: "01", label: "Work", line: "Films · Campaigns · Content", href: "#work", clip: "/clips/clip-04.mp4", tab: 0.45 },
  { no: "02", label: "About", line: "The studio · The people", href: "#about", clip: "/clips/clip-08.mp4", tab: 0.68 },
  { no: "03", label: "Services", line: "Production · Post · Strategy", href: "#services", clip: "/clips/clip-02.mp4", tab: 0.91 },
] as const;

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");

export default function Hero11Page() {
  const reduce = !!useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  return (
    <section className={`${styles.root} ${wide.variable}`} aria-label="16x9 — Bringing brands to life">
      {/* ================= the brand band ================= */}
      <motion.header
        className={styles.band}
        initial={reduce ? false : { y: "-100%" }}
        animate={{ y: 0, transition: { duration: 1.1, ease: EASE_CINE } }}
      >
        <a href="#top" className={styles.logo} aria-label="16x9 home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" />
        </a>
        <p className={styles.bandMid}>Video production · Dubai</p>
        <p className={styles.bandEnd}>
          Index <span>(03)</span>
        </p>
      </motion.header>

      {/* ================= the paper sheet with the line ================= */}
      <motion.div
        className={styles.sheet}
        // the sheet unrolls down from under the band
        initial={reduce ? false : { clipPath: "inset(0% 0% 100% 0%)" }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { delay: 0.3, duration: 1.15, ease: EASE_CINE } }}
      >
        <p className={styles.sheetSide}>
          <span>From brief</span>
          <span>to screen</span>
        </p>
        <h1 className={styles.headline}>
          {["Bringing brands", "to life"].map((line, i) => (
            <span key={line} className={styles.mask}>
              <motion.span
                className={styles.line}
                initial={reduce ? false : { y: "105%" }}
                animate={{ y: 0, transition: { delay: 0.7 + i * 0.12, duration: 1.1, ease: EASE } }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
      </motion.div>

      {/* ================= the folders ================= */}
      <nav aria-label="Main">
        {FOLDERS.map((f, i) => (
          <Folder
            key={f.label}
            folder={f}
            index={i}
            reduce={reduce}
            hover={hover}
            onHover={setHover}
          />
        ))}
      </nav>

      <EnterCursor show={hover !== null} label={hover !== null ? FOLDERS[hover].label : ""} />
    </section>
  );
}

// ===========================================================================
// FOLDER — a sheet of card stock with a tab, holding a film. Pulled up on
// hover; the film plays only then.
// ===========================================================================
function Folder({
  folder,
  index,
  reduce,
  hover,
  onHover,
}: {
  folder: (typeof FOLDERS)[number];
  index: number;
  reduce: boolean;
  hover: number | null;
  onHover: (i: number | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const on = hover === index;
  const away = hover !== null && !on;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (on && !reduce) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else v.pause();
  }, [on, reduce]);

  return (
    <motion.a
      href={folder.href}
      className={`${styles.folder} ${on ? styles.folderOn : ""} ${away ? styles.folderAway : ""}`}
      style={{ ["--i" as string]: index, ["--tab" as string]: folder.tab }}
      initial={reduce ? false : { y: "110%" }}
      animate={{
        // pulled up out of the stack; the folders in front of it make way, the ones behind stay put
        y: on ? "-10vh" : hover !== null && index > hover ? "2.5vh" : 0,
        transition: on || away ? { type: "spring", stiffness: 140, damping: 20, mass: 0.9 } : { delay: 0.55 + index * 0.14, duration: 1.15, ease: EASE_CINE },
      }}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(index)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(index)}
      onBlur={() => onHover(null)}
      aria-label={`${folder.no} ${folder.label}`}
    >
      <span className={styles.stock}>
        {/* the tab */}
        <span className={styles.tab} aria-hidden="true">
          <span className={styles.tabNo}>{folder.no}</span>
          <span className={styles.tabLabel}>{folder.label}</span>
        </span>

        {/* the film, framed in the card */}
        <span className={styles.window}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.still} src={stillFor(folder.clip)} alt="" draggable={false} />
          <video ref={videoRef} className={styles.video} src={folder.clip} muted loop playsInline preload="none" />
          <span className={styles.windowShade} aria-hidden="true" />

          <span className={styles.caption}>
            <span className={styles.captionMask}>
              <span className={styles.title}>{folder.label}</span>
            </span>
            <span className={styles.meta}>
              <span>{folder.line}</span>
              <span className={styles.enter}>
                Enter <span aria-hidden="true">→</span>
              </span>
            </span>
          </span>
        </span>
      </span>
    </motion.a>
  );
}

// ===========================================================================
// ENTER CURSOR — a thin paper ring with the folder's name
// ===========================================================================
function EnterCursor({ show, label }: { show: boolean; label: string }) {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 520, damping: 42, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 520, damping: 42, mass: 0.5 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);
  return (
    <motion.div className={styles.cursor} style={{ x: sx, y: sy }} aria-hidden="true">
      <AnimatePresence>
        {show && (
          <motion.div
            key="ring"
            className={styles.ring}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.45, ease: EASE } }}
            exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.25, ease: EASE } }}
          >
            <span className={styles.ringArrow}>→</span>
            <span className={styles.ringLabel}>{label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
