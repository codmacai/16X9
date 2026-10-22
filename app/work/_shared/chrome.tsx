"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { Archivo } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProjectView, { type OpenProject } from "../../hero7/project-view";
import Drawer from "../../hero11/drawer";
import { posterFor, type Project } from "./data";
import styles from "./chrome.module.css";

// ===========================================================================
// The pieces every work page shares, all in the burger menu's language (the
// hero 11 drawer): the black band with the logo, "Let's talk" and the burger;
// the drawer itself as the menu; the paper ring cursor; a still that sits in
// black and white and comes into colour; and the hero 7 player for a film.
// ===========================================================================

export const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

export const EASE = [0.16, 1, 0.3, 1] as const;
export const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const LOGO_SRC = "/logo-16x9.svg";

/** The root class every work page carries: the tokens, the face, the paper. */
export const rootClass = `${styles.root} ${wide.variable}`;

// ---------------------------------------------------------------------------
// The hero a visitor came in from (a hero sets it as it leads to the work), so the logo and Back
// return there rather than to the site's default home.
export const HOME_KEY = "16x9:home";
export const homeHref = () => {
  try {
    return sessionStorage.getItem(HOME_KEY) || "/";
  } catch {
    return "/";
  }
};

// BAND — logo, where you are, "Let's talk", the burger
// ---------------------------------------------------------------------------
export function Band({
  crumb,
  section = "Work",
  center,
  workHref,
  onBack,
}: {
  crumb: string;
  /** the page the crumb belongs to */
  section?: string;
  /** in the middle in place of the crumb (a format's work page puts the room switch there) */
  center?: ReactNode;
  /** where the menu's Work leads */
  workHref?: string;
  /** what Back does here first (a page with something open closes it); otherwise it goes back a page */
  onBack?: () => void;
}) {
  const router = useRouter();
  // came here from this site: Back takes its place over the logo
  const [cameIn, setCameIn] = useState(false);
  useEffect(() => {
    try {
      // the Navigation API only lists this site's own entries; without it, the referrer
      const nav = (window as { navigation?: { currentEntry?: { index: number } } }).navigation;
      const index = nav?.currentEntry?.index;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- only known in the browser, after hydration
      setCameIn(index !== undefined ? index > 0 : !!document.referrer && new URL(document.referrer).origin === location.origin);
    } catch {}
  }, []);
  const canBack = !!onBack || cameIn;
  const [home, setHome] = useState("/");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only read in the browser
  useEffect(() => setHome(homeHref()), []);
  const back = useCallback(() => {
    if (onBack) return onBack();
    if (cameIn) router.back();
    else router.push(homeHref());
  }, [onBack, cameIn, router]);
  const reduce = !!useReducedMotion();
  const [menu, setMenu] = useState(false);
  // come from the menu's Work folder: its band was already here, so this one doesn't slide in
  const [arrived] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem("16x9:from-menu") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.removeItem("16x9:from-menu");
    } catch {}
  }, []);
  const close = useCallback(() => setMenu(false), []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <>
      <motion.header
        className={styles.band}
        data-band="" /* pages measure it to lay out beneath it */
        initial={arrived ? false : { y: "-100%" }} /* same first frame on server and client; reduced motion just makes it instant */
        animate={{ y: 0, transition: reduce ? { duration: 0 } : { duration: 1.1, ease: EASE_CINE } }}
      >
        {/* the logo, or Back in its place when there's somewhere to go back to: one rolls out as the other rolls in */}
        <div className={styles.bandStart}>
          <AnimatePresence initial={false} mode="popLayout">
            {canBack ? (
              <motion.button
                key="back"
                type="button"
                className={styles.back}
                onClick={back}
                aria-label="Go back"
                initial={reduce ? false : { y: "110%", opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { duration: 0.7, ease: EASE } }}
                exit={reduce ? { opacity: 0 } : { y: "-110%", opacity: 0, transition: { duration: 0.45, ease: EASE_CINE } }}
              >
                <svg viewBox="0 0 20 12" aria-hidden="true">
                  <path d="M20 6H2M7 1L2 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                <span>Back</span>
              </motion.button>
            ) : (
              <motion.span
                key="logo"
                className={styles.logoWrap}
                initial={reduce ? false : { y: "-110%", opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { duration: 0.7, ease: EASE } }}
                exit={reduce ? { opacity: 0 } : { y: "110%", opacity: 0, transition: { duration: 0.45, ease: EASE_CINE } }}
              >
                <Link href={home} className={styles.logo} aria-label="16x9 home">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={LOGO_SRC} alt="16x9" />
                </Link>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {center ? (
          <span className={`${styles.crumb} ${styles.crumbSlot}`}>{center}</span>
        ) : (
          <span className={styles.crumb}>
            <span>{section}</span>
            <i aria-hidden="true">/</i>
            <span>{crumb}</span>
          </span>
        )}
        <div className={styles.bandEnd}>
          <a href="/about#contact" className={styles.talk}>
            <span className={styles.talkRoll}>
              <span>Let&apos;s talk</span>
              <span aria-hidden="true">Let&apos;s talk</span>
            </span>
            <span className={styles.talkArrow} aria-hidden="true">
              ↗
            </span>
          </a>
          <button
            type="button"
            className={styles.burger}
            onClick={() => setMenu(true)}
            aria-label="Open menu"
            aria-expanded={menu}
            aria-controls="hero12-menu"
          >
            <span />
            <span />
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {menu && (
          <motion.div
            key="menu"
            className={styles.menu}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? false : { clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, ease: EASE_CINE } }}
            exit={{ clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.7, ease: EASE_CINE } }}
          >
            <Drawer onClose={close} workHref={workHref} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// INFO — studio · place · the time in Dubai, over a hairline
// ---------------------------------------------------------------------------
const dubaiTime = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
    new Date()
  );

export function Info({ left, centre }: { left: string; centre?: string }) {
  const reduce = !!useReducedMotion();
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
    <motion.div
      className={styles.info}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: reduce ? { duration: 0 } : { delay: 0.7, duration: 1, ease: EASE } }}
    >
      <span>{left}</span>
      <span className={styles.infoCentre}>{centre}</span>
      <span className={styles.infoTime}>
        <i className={styles.dot} aria-hidden="true" /> DXB <span suppressHydrationWarning>{time || "--:--:--"}</span>
      </span>
      <motion.span
        className={styles.infoRule}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1, transition: reduce ? { duration: 0 } : { delay: 0.65, duration: 1.4, ease: EASE_CINE } }}
        aria-hidden="true"
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// FILM STILL — a film's own picture, never another's: the shot cut from it at
// build time; else a frame of the film itself, read by the browser (a moment
// in, past any fade up from black); else, for a film with no file yet, a quiet
// dark frame (its title is always beside it). Drawn with the caller's class,
// which fills and covers.
// ---------------------------------------------------------------------------
const FRAME_AT = 12; // seconds into the film, for a frame read from it
export function FilmStill({ film, className, style }: { film: Project; className?: string; style?: CSSProperties }) {
  const shot = posterFor(film);
  if (shot)
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} style={style} src={shot} alt="" draggable={false} decoding="async" />;
  if (film.film)
    return <video className={`${className ?? ""} ${styles.frame}`} style={style} src={`${film.film}#t=${FRAME_AT}`} muted playsInline preload="metadata" aria-hidden="true" />;
  return <span className={`${className ?? ""} ${styles.blank}`} style={style} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// STILL — black and white at rest; `on` fades the colour still in over it
// ---------------------------------------------------------------------------
export function Still({ film, on, className }: { film: Project; on: boolean; className?: string }) {
  // no shot: one layer (a frame read from the film loads once), its grey lifted when on
  if (!posterFor(film))
    return (
      <span className={`${styles.still} ${on ? styles.stillOn : ""} ${className ?? ""}`}>
        <FilmStill film={film} className={styles.stillOne} />
      </span>
    );
  return (
    <span className={`${styles.still} ${on ? styles.stillOn : ""} ${className ?? ""}`}>
      {/* the grey is a filter on a layer that never animates; only the colour
          layer's opacity changes, so nothing repaints while it moves */}
      <FilmStill film={film} className={styles.stillGray} />
      <FilmStill film={film} className={styles.stillColour} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// CURSOR — a thin paper ring with an arrow and the film's name
// ---------------------------------------------------------------------------
export function EnterCursor({ label, dark = false }: { label: string | null; dark?: boolean }) {
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
    <motion.div className={`${styles.cursor} ${dark ? styles.cursorDark : ""}`} style={{ x: sx, y: sy }} aria-hidden="true">
      <AnimatePresence>
        {label !== null && (
          <motion.div
            key="ring"
            className={styles.ring}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.45, ease: EASE } }}
            exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.25, ease: EASE } }}
          >
            <svg className={styles.ringPlay} viewBox="0 0 12 14">
              <path d="M0 0L12 7L0 14Z" />
            </svg>
            <span className={styles.ringLabel}>{label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// PLAYER — the hero 7 project view: a film opens out of whatever was clicked
// ---------------------------------------------------------------------------
export function usePlayer(list: Project[]) {
  const [open, setOpen] = useState<OpenProject | null>(null);
  const play = useCallback(
    (project: Project, el: HTMLElement) => {
      const index = list.indexOf(project);
      if (index < 0) return;
      const r = el.getBoundingClientRect();
      setOpen({ index, rect: { top: r.top, left: r.left, width: r.width, height: r.height }, time: 0 });
    },
    [list]
  );
  const close = useCallback(() => setOpen(null), []);
  const player = <AnimatePresence>{open && <ProjectView key="player" clips={list} open={open} onClose={close} />}</AnimatePresence>;
  return { play, player, playing: open !== null };
}
