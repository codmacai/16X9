"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Archivo } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "../hero7/project-view";
import Drawer from "../hero11/drawer";
import { HOME_KEY } from "../work/_shared/chrome";
import { type FormatKey } from "../hero13/formats";
import Chooser, { EASE_CINE, INTRO } from "../hero2/chooser";
import styles from "../hero2/hero2.module.css";

// ===========================================================================
// HERO 5 — 16x9 & BEYOND: hero 2's white start, and each word leads straight to its work.
//
// 1. The mark enters on the white page; 16x9 / 9x16 / BEYOND rise in one line.
//    Pointing at a word opens it like a window onto a film in its format, and
//    each time it's a different film (drawn from the studio's films).
// 2. Clicking a word opens its film to the edges of the screen and goes
//    straight on to that format's work (/work?format=…), by its categories.
// ===========================================================================

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });
const LOGO_SRC = "/logo.png";
const HEADLINE = "Stories beyond the frame";
// from here the page answers
const SETTLE_S = INTRO.names + 0.9;
// touch screens have no hover: on the index the formats take turns
const AUTO_MS = 3400;
const AUTO_SEQ: (FormatKey | null)[] = ["16x9", "9x16", "beyond", null];
// ms from the click to the work page: the film has opened to the edges by then
const GO_MS = 1050;

// The variant depends on the URL and today's date, so it's read on the client only.
const noopSubscribe = () => () => {};
export default function HeroFive() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const variant = useMemo<HeroVariant | null>(
    () => (isClient ? resolveVariant(new Date(), new URLSearchParams(window.location.search).get("hero")) : null),
    [isClient]
  );
  if (!variant) return <section className={`${styles.page} ${archivo.variable}`} aria-hidden="true" />;
  return <Home key={variant.id} variant={variant} />;
}

function Home({ variant }: { variant: HeroVariant }) {
  const clips = variant.clips;
  // the films the words draw from as they open
  const pool = useMemo(() => clips.map((c) => c.src), [clips]);
  const reduce = !!useReducedMotion();
  const touch = useSyncExternalStore(noopSubscribe, () => !window.matchMedia("(hover: hover)").matches, () => false);

  // nothing answers until the words have risen in
  const [ready, setReady] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setReady(true), SETTLE_S * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // the word pointed at (or taking its turn on a touch screen), and the room that's open
  const [fmtHover, setFmtHover] = useState<FormatKey | null>(null);
  const [fmtAuto, setFmtAuto] = useState<FormatKey | null>(null);
  const [room, setRoom] = useState<FormatKey | null>(null);
  const [launch, setLaunch] = useState<FormatKey | null>(null);
  const indexFmt = room ? null : (fmtHover ?? fmtAuto);
  const [project, setProject] = useState<OpenProject | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuKey, setMenuKey] = useState(0);

  // touch screens: the formats take turns on the index
  useEffect(() => {
    if (!touch || !ready || reduce || room || menuOpen) return;
    let i = AUTO_SEQ.indexOf(null);
    const id = window.setInterval(() => {
      i = (i + 1) % AUTO_SEQ.length;
      setFmtAuto(AUTO_SEQ[i]);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [touch, ready, reduce, room, menuOpen]);

  const hover = useCallback((k: FormatKey | null) => setFmtHover(k), []);
  const router = useRouter();
  // the film opens to the edges, then the page goes on to that format's work
  const openRoom = useCallback(
    (k: FormatKey) => {
      if (!ready || room) return;
      setLaunch(k);
      setRoom(k);
      setFmtHover(null);
      setFmtAuto(null);
      router.prefetch(`/work?format=${k}`);
      try {
        sessionStorage.setItem(HOME_KEY, "/hero5");
      } catch {}
      window.setTimeout(() => router.push(`/work?format=${k}`), reduce ? 0 : GO_MS);
    },
    [ready, reduce, room, router]
  );
  const toIndex = useCallback(() => {
    setProject(null);
    setRoom(null);
  }, []);
  const closeFilm = useCallback(() => setProject(null), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Esc: the menu closes, then the room goes back to the index (a film closes itself)
  useEffect(() => {
    if (project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menuOpen) setMenuOpen(false);
      else if (room) toIndex();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, menuOpen, room, toIndex]);

  const enter = (delay: number) =>
    reduce ? { initial: false as const } : { initial: { opacity: 0 }, animate: { opacity: 1, transition: { delay, duration: 0.8 } } };

  return (
    <section
      className={`${styles.page} ${archivo.variable}`}
      aria-label="16x9 & Beyond"
      data-room={room ? "" : undefined}
      data-dark={room || indexFmt === "beyond" ? "" : undefined}
    >
      <h1 className={styles.sr}>16x9 &amp; Beyond. {HEADLINE}.</h1>

      {/* ================= the index ================= */}
      <Chooser
        open={room !== null}
        launch={launch}
        show={room === null && !menuOpen}
        first={menuKey === 0}
        reduce={reduce}
        ready={ready}
        active={indexFmt}
        onHover={hover}
        onOpen={openRoom}
        pool={pool}
      />

      {/* ================= the top bar: the logo, the rooms, the menu ================= */}
      <motion.header className={styles.topbar} {...enter(INTRO.names - 0.1)}>
        <Link
          href="/hero5"
          className={styles.logo}
          aria-label="Home"
          onClick={(e) => {
            if (!room) return;
            e.preventDefault();
            toIndex();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" className={styles.logoImg} />
        </Link>

        <button
          type="button"
          className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="hero5-menu"
          disabled={!ready}
          onClick={() => {
            if (!menuOpen) setMenuKey((k) => k + 1);
            setMenuOpen(!menuOpen);
          }}
        >
          <span />
          <span />
        </button>
      </motion.header>

      {/* ================= the index's foot: quiet links in the corners ================= */}
      <motion.footer
        className={styles.foot}
        initial={reduce ? false : { opacity: 0 }}
        animate={{
          opacity: room === null && !menuOpen ? 1 : 0,
          transition: { delay: menuKey === 0 && room === null ? INTRO.names + 0.3 : 0, duration: 0.6 },
        }}
        style={{ pointerEvents: room === null ? "auto" : "none" }}
      >
        <nav className={styles.footSide} aria-label="Studio">
          <Link href="/work">Work</Link>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <span className={styles.footLine}>{HEADLINE}</span>
        <nav className={styles.footSide} aria-label="Elsewhere">
          <a href="https://9x16.studio">9x16.studio</a>
          <a href="#instagram">Instagram</a>
          <a href="#linkedin">LinkedIn</a>
        </nav>
      </motion.footer>

      {/* ================= the menu ================= */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu"
            id="hero5-menu"
            className={styles.menuSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)" }}
            animate={reduce ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, ease: EASE_CINE } }}
            exit={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.75, ease: EASE_CINE } }}
          >
            <Drawer onClose={closeMenu} workHref={room ? `/work?format=${room}` : "/work"} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= a film, full screen ================= */}
      <AnimatePresence>
        {project && <ProjectView key="project" clips={clips} open={project} onClose={closeFilm} />}
      </AnimatePresence>
    </section>
  );
}
