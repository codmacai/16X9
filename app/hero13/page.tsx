"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Archivo } from "next/font/google";
import Link from "next/link";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "../hero7/project-view";
import Drawer from "../hero11/drawer";
import { FORMATS, FrameGlyph, Ratio, type FormatKey } from "./formats";
import IndexStage, { EASE, EASE_CINE, INTRO } from "./index-stage";
import LensWall, { type FilmRect } from "./lens-wall";
import styles from "./home.module.css";

// ===========================================================================
// THE HOME — 16x9 & BEYOND.
//
// 1. The mark enters in outline on the white page, and the index rises:
//    16x9 / 9x16 / BEYOND (index-stage.tsx). Pointing at a word fades in a
//    film in its format behind the line.
// 2. Clicking a word opens its screening room (lens-wall.tsx): the index fades
//    away and the room's films settle in from the centre outward, all in
//    that word's proportion, on a living lens surface in the dark
//    (lens-wall.tsx; grid.tsx is its fallback without WebGL).
//    The tabs at the top move between rooms; "Index" or Esc goes back.
// 3. Clicking a film opens it full screen (hero7/project-view.tsx).
// ===========================================================================

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });
const LOGO_SRC = "/logo.png";
const HEADLINE = "Stories beyond the frame";
// from here the page answers
const SETTLE_S = INTRO.names + 0.9;
// touch screens have no hover: on the index the formats take turns
const AUTO_MS = 3400;
const AUTO_SEQ: (FormatKey | null)[] = ["16x9", "9x16", "beyond", null];

// The variant depends on the URL and today's date, so it's read on the client only.
const noopSubscribe = () => () => {};
export default function DepthHero({ variantId }: { variantId?: string }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const variant = useMemo<HeroVariant | null>(
    () =>
      isClient
        ? resolveVariant(new Date(), variantId ?? new URLSearchParams(window.location.search).get("hero"))
        : null,
    [isClient, variantId]
  );
  if (!variant) return <section className={`${styles.page} ${archivo.variable}`} aria-hidden="true" />;
  return <Home key={variant.id} variant={variant} />;
}

function Home({ variant }: { variant: HeroVariant }) {
  const clips = variant.clips;
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
  const openRoom = useCallback(
    (k: FormatKey) => {
      if (!ready) return;
      setRoom(k);
      setFmtHover(null);
      setFmtAuto(null);
    },
    [ready]
  );
  const toIndex = useCallback(() => {
    setProject(null);
    setRoom(null);
  }, []);
  const openFilm = useCallback((index: number, rect: FilmRect) => {
    setProject({ index, rect, time: 0 });
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
    >
      <h1 className={styles.sr}>16x9 &amp; Beyond. {HEADLINE}.</h1>

      {/* ================= the screening room, under the index ================= */}
      <AnimatePresence>
        {room && (
          <LensWall
            key={room}
            fmt={room}
            clips={clips}
            paused={project !== null || menuOpen}
            reduce={reduce}
            onOpen={openFilm}
          />
        )}
      </AnimatePresence>

      {/* ================= the index ================= */}
      <IndexStage
        open={room !== null}
        show={room === null && !menuOpen}
        first={menuKey === 0}
        reduce={reduce}
        ready={ready}
        active={indexFmt}
        onHover={hover}
        onOpen={openRoom}
      />

      {/* ================= the top bar: the logo (on the index), the rooms, the menu ================= */}
      <motion.header className={styles.topbar} {...enter(INTRO.names - 0.1)}>
        <Link href="/" className={styles.logo} aria-label="Home" tabIndex={room ? -1 : 0}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" className={styles.logoImg} />
        </Link>

        <AnimatePresence>
          {room && !menuOpen && (
            <motion.nav
              key="rooms"
              className={styles.rooms}
              aria-label="Formats"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.45, duration: 0.7, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              <button type="button" className={styles.roomBack} onClick={toIndex}>
                <span aria-hidden="true">←</span> Index
              </button>
              <span className={styles.roomTabs}>
                {FORMATS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`${styles.roomTab} ${room === f.key ? styles.roomTabOn : ""}`}
                    aria-pressed={room === f.key}
                    onClick={() => setRoom(f.key)}
                  >
                    <FrameGlyph k={f.key} className={styles.roomGlyph} />
                    <Ratio text={f.label} className={styles.fmtX} />
                    {room === f.key && (
                      <motion.span layoutId="room-tab-line" className={styles.roomTabLine} transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                    )}
                  </button>
                ))}
              </span>
            </motion.nav>
          )}
        </AnimatePresence>

        <button
          type="button"
          className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="hero12-menu"
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
            className={styles.menuSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)" }}
            animate={reduce ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, ease: EASE_CINE } }}
            exit={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.75, ease: EASE_CINE } }}
          >
            <Drawer onClose={closeMenu} />
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
