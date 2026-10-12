"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Archivo } from "next/font/google";
import Link from "next/link";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject, type TileRect } from "../hero7/project-view";
import Drawer from "../hero11/drawer";
import { FORMATS, Ratio, type FormatKey } from "../hero13/formats";
import Chooser, { EASE, EASE_CINE, INTRO } from "../hero2/chooser";
import PosterWall from "../hero2/poster-wall";
import LensRoom from "../hero3/lens-room";
import RoomSwitch from "../hero3/room-switch";
import styles from "../hero2/hero2.module.css";
import own from "./hero14.module.css";

// ===========================================================================
// HERO 14 — 16x9 & BEYOND: hero 2's white start, hero 3's rooms.
//
// 1. The mark enters in outline on the white page, and the index rises:
//    16x9 / 9x16 / BEYOND, one quiet line (hero2/chooser.tsx). Pointing at a
//    word opens it like a window onto a film in its format.
// 2. Clicking a word opens its film to the edges of the screen, and the page
//    gives way to that format's room, as in hero 3: 16x9 and 9x16 hang their
//    films round a curved wall (hero2/poster-wall.tsx, in hero 3's quiet
//    tone), Beyond is the bulging lens wall with its columns running
//    (hero3/lens-room.tsx).
// 3. At the top in the middle, the room switch moves between the rooms or
//    back to the index; "View all … work" at the foot leads to that format's
//    work, and so does the menu's Work. Esc goes back too.
// 4. Clicking a film opens it full screen (hero7/project-view.tsx).
// ===========================================================================

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });
const LOGO_SRC = "/logo.png";
const HEADLINE = "Stories beyond the frame";
// from here the page answers
const SETTLE_S = INTRO.names + 0.9;
// touch screens have no hover: on the index the formats take turns
const AUTO_MS = 3400;
const AUTO_SEQ: (FormatKey | null)[] = ["16x9", "9x16", "beyond", null];
// seconds before a room's posters swing up: from the index (its film is still opening), or from another room
const ROOM_DELAY = { fromIndex: 1.15, fromRoom: 0.2 };

// The variant depends on the URL and today's date, so it's read on the client only.
const noopSubscribe = () => () => {};
export default function HeroFourteen() {
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
  const [roomDelay, setRoomDelay] = useState(ROOM_DELAY.fromIndex);
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
      setRoomDelay(reduce ? 0 : ROOM_DELAY.fromIndex);
      setLaunch(k);
      setRoom(k);
      setFmtHover(null);
      setFmtAuto(null);
    },
    [ready, reduce]
  );
  const switchRoom = useCallback(
    (k: FormatKey) => {
      setRoomDelay(reduce ? 0 : ROOM_DELAY.fromRoom);
      setLaunch(k);
      setRoom(k);
    },
    [reduce]
  );
  const toIndex = useCallback(() => {
    setProject(null);
    setRoom(null);
  }, []);
  const openFilm = useCallback((index: number, rect: TileRect) => {
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
  const roomF = room ? (FORMATS.find((x) => x.key === room) ?? FORMATS[0]) : null;

  return (
    <section
      className={`${styles.page} ${archivo.variable}`}
      aria-label="16x9 & Beyond"
      data-room={room ? "" : undefined}
      data-dark={room || indexFmt === "beyond" ? "" : undefined}
    >
      <h1 className={styles.sr}>16x9 &amp; Beyond. {HEADLINE}.</h1>

      {/* ================= the room, under the index: hero 3's rooms ================= */}
      <AnimatePresence>
        {(room === "16x9" || room === "9x16") && (
          <PosterWall
            key={room}
            fmt={room}
            clips={clips}
            paused={project !== null || menuOpen}
            reduce={reduce}
            delay={roomDelay}
            tone="mono"
            onOpen={openFilm}
          />
        )}
        {room === "beyond" && (
          <LensRoom key="beyond" fmt="beyond" clips={clips} paused={project !== null || menuOpen} reduce={reduce} onOpen={openFilm} />
        )}
      </AnimatePresence>

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
      />

      {/* ================= the top bar: the logo, the rooms, the menu ================= */}
      <motion.header className={styles.topbar} {...enter(INTRO.names - 0.1)}>
        <Link
          href="/hero14"
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

        {/* in a room, at the top in the middle: which one, and a small sheet to switch (or go back to the index) */}
        <div className={own.switch}>
          <AnimatePresence>
            {room && !menuOpen && (
              <RoomSwitch key="switch" room={room} onSwitch={(k) => room !== k && switchRoom(k)} onIndex={toIndex} />
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="hero14-menu"
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

      {/* ================= the room's foot: what it holds, and how to move it ================= */}
      <AnimatePresence>
        {roomF && !menuOpen && (
          <motion.div
            key="hud"
            className={styles.hud}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: roomDelay + 0.5, duration: 0.8 } }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            <span>
              <i>{roomF.no}</i> {roomF.line} <i>— {clips.length} films</i>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= in a room: the way to all of its work, at the foot on the right ================= */}
      <AnimatePresence>
        {roomF && !menuOpen && (
          <motion.div
            key={`all-${roomF.key}`}
            className={own.viewAll}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: roomDelay + 0.5, duration: 0.7, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <Link href={`/work?format=${roomF.key}`}>
              <span>
                View all <Ratio text={roomF.label} className={own.viewAllX} /> work
              </span>
              <i aria-hidden="true">→</i>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= the menu ================= */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu"
            id="hero14-menu"
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
