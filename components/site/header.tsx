"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Drawer from "@/app/hero11/drawer";
import { SiteLink } from "./transition";
import styles from "./site.module.css";

const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const LOGO_SRC = "/logo.png";

// ===========================================================================
// SITE HEADER — the hero's top bar, carried through the site: the logo, a
// running timecode (the page as a film, scrolled like a playhead), "Let's talk"
// and the burger, which opens the hero's drawer menu. It tucks away while you
// scroll down and comes back when you scroll up. On the homepage it waits until
// the hero (which has its own top bar) has been scrolled past.
// ===========================================================================

export default function SiteHeader() {
  const pathname = usePathname();
  const reduce = !!useReducedMotion();
  const home = pathname === "/";

  // the menu belongs to the page it was opened on, so changing page closes it
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const closeMenu = useCallback(() => setMenuPath(null), []);

  // homepage: hidden while the hero is on screen
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    if (!home) return;
    const hero = document.getElementById("home-hero");
    if (!hero) return;
    const io = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting));
    io.observe(hero);
    return () => io.disconnect();
  }, [home]);

  // tuck away on the way down, back on the way up
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 6) return;
      setTucked(y > last && y > 160);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // the menu holds the page still
  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuPath(null);
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const shown = (!home || pastHero) && (!tucked || menuOpen);

  return (
    <>
      <header className={`${styles.header} ${shown ? "" : styles.headerHidden}`} inert={!shown}>
        <SiteLink href="/" className={styles.logo} aria-label="16x9 & Beyond, home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9 & Beyond" />
        </SiteLink>
        <div className={styles.headerEnd}>
          <Timecode />
          <SiteLink href="/contact" className={styles.talk}>
            Let&apos;s talk <span aria-hidden="true">↗</span>
          </SiteLink>
          <button
            type="button"
            className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="hero12-menu"
            onClick={() => setMenuPath(menuOpen ? null : pathname)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu"
            className={styles.menuSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)" }}
            animate={
              reduce
                ? { opacity: 1, transition: { duration: 0 } }
                : { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, ease: EASE_CINE } }
            }
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0 } }
                : { clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.75, ease: EASE_CINE } }
            }
          >
            <Drawer onClose={closeMenu} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// TIMECODE — HH:MM:SS:FF at 24 fps, from how far down the page you are.
// ---------------------------------------------------------------------------
const PX_PER_FRAME = 3;
const subscribeScroll = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};
const getFrame = () => Math.floor(window.scrollY / PX_PER_FRAME);
const getServerFrame = () => 0;
const two = (n: number) => String(n).padStart(2, "0");

function Timecode() {
  const frames = useSyncExternalStore(subscribeScroll, getFrame, getServerFrame);
  const ff = frames % 24;
  const s = Math.floor(frames / 24);
  return (
    <span className={styles.timecode} aria-hidden="true">
      <i />
      {two(Math.floor(s / 3600))}:{two(Math.floor(s / 60) % 60)}:{two(s % 60)}:{two(ff)}
    </span>
  );
}
