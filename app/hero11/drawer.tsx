"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { Archivo } from "next/font/google";
import styles from "./hero11.module.css";

// ===========================================================================
// HERO 11 — the drawer. A navigation hero after the file-divider reference,
// turned horizontal: a black top bar, a paper sheet carrying the line (an
// editorial meta row, the headline with a film playing inside it, a short
// lede), and three folders stacked down the screen like files in a drawer,
// each with a numbered tab. Point at a folder and it is pulled up out of the
// stack: its poster turns from black-and-white to colour, its label
// and a way in come forward, and the other folders sink back. Each folder is
// a link: Work, About, Services.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

const LOGO_SRC = "/logo.png";
const FOLDERS = [
  { no: "01", label: "Work", line: "Films · Campaigns · Content", href: "/work", poster: "/hero11/work.webp", tab: 0.45 },
  { no: "02", label: "About", line: "The studio · The people", href: "/about", poster: "/hero11/about.webp", tab: 0.68 },
  { no: "03", label: "Services", line: "Production · Post · Strategy", href: "#services", poster: "/hero11/services.webp", tab: 0.91 },
] as const;

const HERO = {
  studio: "16X9 — Video production studio",
  place: "Dubai, United Arab Emirates",
  headline: ["Stories beyond", "the frame"],
  line: "Films, campaigns and content for brands that want to be seen — and remembered.",
  reel: "/clips/clip-10.mp4", // the film playing inside the headline
};

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");

/**
 * The drawer. On its own (/hero11) it is the page's hero; given `onClose` it is
 * a full-screen menu (/hero12, /hero13), and the top bar carries a close button.
 */
export default function Drawer({ onClose }: { onClose?: () => void }) {
  const reduce = !!useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();
  const path = usePathname();

  // a route folder (Work): the band stays; the line lifts away and the folders
  // sink out of sight, and the page that comes in (on the same paper, under the
  // same band) raises its own line and its own folders in their place
  const enter = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("/")) return;
    e.preventDefault();
    if (path === href) return onClose?.();
    router.prefetch(href);
    if (reduce) return router.push(href);
    setLeaving(true);
    setHover(null);
    try {
      sessionStorage.setItem("16x9:from-menu", "1");
    } catch {}
    window.setTimeout(() => router.push(href), 720);
  };

  return (
    <section
      className={`${styles.root} ${wide.variable} ${leaving ? styles.leaving : ""}`}
      aria-label={onClose ? "Menu" : "16x9 — Stories beyond the frame"}
      id={onClose ? "hero12-menu" : undefined}
    >
      {/* ================= the top bar ================= */}
      <motion.header
        className={styles.band}
        initial={reduce ? false : { y: "-100%" }}
        animate={{ y: 0, transition: { duration: 1.1, ease: EASE_CINE } }}
      >
        <Link href="/" className={styles.logo} aria-label="16x9 home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" />
        </Link>
        <div className={styles.bandEnd}>
          <a href="#contact" className={styles.talk}>
            <span className={styles.talkRoll}>
              <span>Let&apos;s talk</span>
              <span aria-hidden="true">Let&apos;s talk</span>
            </span>
            <span className={styles.talkArrow} aria-hidden="true">
              ↗
            </span>
          </a>
          {onClose && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close menu">
              <span />
              <span />
            </button>
          )}
        </div>
      </motion.header>

      {/* ================= the paper sheet: the hero's line ================= */}
      <motion.div
        className={styles.sheet}
        // the sheet unrolls down from under the band
        initial={reduce ? false : { clipPath: "inset(0% 0% 100% 0%)" }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { delay: 0.3, duration: 1.15, ease: EASE_CINE } }}
      >
        {/* an editorial line across the top of the sheet */}
        <motion.div
          className={styles.info}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 1.0, duration: 1, ease: EASE } }}
        >
          <span>{HERO.studio}</span>
          <span className={styles.infoPlace}>{HERO.place}</span>
          <Clock />
          <motion.span
            className={styles.infoRule}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1, transition: { delay: 0.95, duration: 1.4, ease: EASE_CINE } }}
            aria-hidden="true"
          />
        </motion.div>

        <div className={styles.lockup}>
          <h1 className={styles.headline}>
            <span className={styles.mask}>
              <motion.span
                className={styles.line}
                initial={reduce ? false : { y: "105%" }}
                animate={{ y: 0, transition: { delay: 0.75, duration: 1.15, ease: EASE } }}
              >
                {HERO.headline[0]}
              </motion.span>
            </span>
            <span className={`${styles.mask} ${styles.maskRow}`}>
              <motion.span
                className={styles.line}
                initial={reduce ? false : { y: "105%" }}
                animate={{ y: 0, transition: { delay: 0.87, duration: 1.15, ease: EASE } }}
              >
                {HERO.headline[1]}
              </motion.span>
              {/* a film playing inside the line */}
              <motion.span
                className={styles.reel}
                initial={reduce ? false : { width: 0, opacity: 0 }}
                animate={{ width: "2.05em", opacity: 1, transition: { delay: 1.35, duration: 1.1, ease: EASE_CINE } }}
                aria-hidden="true"
              >
                <video src={HERO.reel} poster={stillFor(HERO.reel)} muted loop playsInline autoPlay={!reduce} preload="metadata" />
              </motion.span>
            </span>
          </h1>
          <motion.p
            className={styles.lede}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 1.55, duration: 1.1, ease: EASE } }}
          >
            {HERO.line}
          </motion.p>
        </div>
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
            onEnter={enter}
            leaving={leaving}
          />
        ))}
      </nav>

      <EnterCursor show={hover !== null && !leaving} label={hover !== null ? FOLDERS[hover].label : ""} />
    </section>
  );
}

// ===========================================================================
// FOLDER — a sheet of card stock with a tab, holding a poster. Pulled up on
// hover, where the poster comes into colour.
// ===========================================================================
function Folder({
  folder,
  index,
  reduce,
  hover,
  onHover,
  onEnter,
  leaving,
}: {
  folder: (typeof FOLDERS)[number];
  index: number;
  reduce: boolean;
  hover: number | null;
  onHover: (i: number | null) => void;
  onEnter: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  leaving: boolean;
}) {
  const on = hover === index;
  const away = hover !== null && !on;

  return (
    <motion.a
      href={folder.href}
      onClick={(e) => onEnter(e, folder.href)}
      className={`${styles.folder} ${on ? styles.folderOn : ""} ${away ? styles.folderAway : ""}`}
      style={{ ["--i" as string]: index, ["--tab" as string]: folder.tab }}
      initial={reduce ? false : { y: "110%" }}
      animate={{
        // pulled up out of the stack; the folders in front of it make way, the ones behind stay put
        y: leaving ? "110%" : on ? "-7vh" : hover !== null && index > hover ? "2.5vh" : 0,
        transition: leaving
          ? { duration: 0.62, ease: [0.55, 0, 0.75, 0.15], delay: (2 - index) * 0.05 }
          : on || away ? { type: "spring", stiffness: 140, damping: 20, mass: 0.9 } : { delay: 0.55 + index * 0.14, duration: 1.15, ease: EASE_CINE },
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
          {/* black and white baked into its own file; hover fades the colour one in
              over it, so nothing is filtered or repainted while the folder moves */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`${styles.still} ${styles.stillGray}`} src={folder.poster.replace(/\/([^/]+)$/, "/gray/$1")} alt="" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`${styles.still} ${styles.stillColour}`} src={folder.poster} alt="" draggable={false} />
          <span className={styles.windowDim} aria-hidden="true" />
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
// CLOCK — the time in Dubai, ticking
// ===========================================================================
const dubaiTime = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
    new Date()
  );

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(dubaiTime());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  return (
    <span className={styles.infoTime}>
      <i className={styles.dot} aria-hidden="true" /> DXB <span suppressHydrationWarning>{time || "--:--:--"}</span>
    </span>
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
