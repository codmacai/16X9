"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { EASE } from "./_shared/chrome";
import type { CategoryId, Project } from "./_shared/data";
import { OPTICAL, pad2, reelOf, startMuted, type Brand } from "./brand-shared";
import f from "./file.module.css";
import t from "./titles.module.css";

// ===========================================================================
// A BRAND'S OPENING TITLES — every film the studio made for a brand, rolled
// like the opening of a feature: each film full screen, playing, its title
// set over it like a title card, the brand's logo in its colours at the
// head. The titles roll on by themselves, a slow dissolve from one film to
// the next under a story's progress bars; scroll, swipe, the arrows or the
// keys take them on or back. "Play film" plays it whole; "The film's page"
// opens its story and credits (file-view.tsx, from page.tsx's room).
// ===========================================================================

const HOLD_MS = 7000; // each film holds this long before the next rolls in
const LINE: Transition = { type: "spring", stiffness: 70, damping: 16, mass: 1 };
const KIND: Record<CategoryId, string> = { brand: "Brand film", documentary: "Documentary", music: "Music video", tvc: "TVC" };

export default function BrandTitles({
  brand,
  reduce,
  paused,
  onPlay,
  onPage,
  onClose,
}: {
  brand: Brand;
  reduce: boolean;
  /** a film's page is open over the titles: they hold, and their films stop */
  paused: boolean;
  onPlay: (film: Project, el: HTMLElement) => void;
  onPage: (index: number) => void;
  onClose: () => void;
}) {
  const films = brand.films;
  const n = films.length;
  const [nav, setNav] = useState({ at: 0, prev: -1, dir: 1 });
  const at = nav.at;
  const screenRef = useRef<HTMLDivElement>(null);
  const live = useRef({ paused });
  useEffect(() => {
    live.current.paused = paused;
  }, [paused]);

  const go = useCallback(
    (d: number) => {
      if (n < 2) return;
      setNav((v) => ({ at: (v.at + d + n) % n, prev: v.at, dir: d }));
    },
    [n]
  );

  // the titles roll on by themselves (and hold while the film plays whole, or its page is open)
  useEffect(() => {
    if (n < 2 || paused || reduce) return;
    let id = 0;
    const wait = () => {
      id = window.setTimeout(() => (document.body.style.overflow === "hidden" ? wait() : go(1)), HOLD_MS);
    };
    wait();
    return () => window.clearTimeout(id);
  }, [at, n, paused, reduce, go]);

  // keys and the wheel: one film a gesture
  useEffect(() => {
    let lockUntil = 0;
    let acc = 0;
    const blocked = () => live.current.paused || document.body.style.overflow === "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (blocked()) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
    };
    const onWheel = (e: WheelEvent) => {
      if (blocked()) return;
      e.preventDefault();
      if (e.timeStamp < lockUntil) return;
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(acc) > 40) {
        go(Math.sign(acc));
        acc = 0;
        lockUntil = e.timeStamp + 900;
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [go, onClose]);

  // a swipe
  const x0 = useRef<number | null>(null);
  const down = (e: ReactPointerEvent) => (x0.current = e.clientX);
  const up = (e: ReactPointerEvent) => {
    if (x0.current === null) return;
    const dx = e.clientX - x0.current;
    x0.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  // the film leaving (dissolving out), the one showing, and the next already running out of sight
  const slides = [nav.prev, at, (at + 1) % n].filter((j, i, a) => j >= 0 && a.indexOf(j) === i);
  const film = films[at];
  const meta = [KIND[film.category], film.year].filter(Boolean).join(" · ");
  return (
    <motion.div
      className={t.titles}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
      role="dialog"
      aria-modal="true"
      aria-label={`${brand.name}: ${n} ${n === 1 ? "film" : "films"}`}
    >
      {/* the films, full screen */}
      <div ref={screenRef} className={t.screen} onPointerDown={down} onPointerUp={up}>
        {slides.map((j) => {
          const r = reelOf(films[j]);
          return (
            <span key={films[j].no} className={`${t.slide} ${j === at ? t.slideOn : ""}`} aria-hidden="true">
              {r.still && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={t.pic} src={r.still} alt="" draggable={false} />
              )}
              {!paused && <video ref={startMuted} className={t.pic} src={r.clip} autoPlay muted loop playsInline preload="auto" disablePictureInPicture />}
            </span>
          );
        })}
        <span className={t.grade} aria-hidden="true" />
      </div>

      {/* the head: the brand, and the way back to the wall */}
      <motion.div
        className={`${f.head} ${t.head}`}
        style={{ top: "var(--band)" }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
      >
        <span className={t.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo.dark} alt="" draggable={false} style={{ scale: String(OPTICAL[brand.logo.src] ?? 1) }} data-wide={brand.logo.wide || undefined} />
          <span>{brand.name}</span>
        </span>
        <button type="button" className={f.close} onClick={onClose}>
          <span className={f.closeRoll}>
            <span>All brands</span>
            <span aria-hidden="true">All brands</span>
          </span>
          <span className={f.closeX} aria-hidden="true" />
        </button>
      </motion.div>

      {/* the title card */}
      <div className={t.card}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={film.no} className={t.cardIn} exit={{ opacity: 0, y: -14, transition: { duration: 0.35, ease: EASE } }}>
            <span className={t.mask}>
              <motion.span className={t.kicker} initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ ...LINE, delay: 0.15 }}>
                <b>{pad2(at + 1)}</b> {meta}
              </motion.span>
            </span>
            <span className={t.mask}>
              <motion.h2 className={t.title} initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ ...LINE, delay: 0.25 }}>
                {film.title}
              </motion.h2>
            </span>
            <motion.div className={t.actions} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...LINE, delay: 0.45 }}>
              <button type="button" className={t.play} onClick={() => screenRef.current && onPlay(film, screenRef.current)}>
                <i aria-hidden="true" /> Play film
              </button>
              <button type="button" className={t.page} onClick={() => onPage(at)}>
                The film&apos;s page <span aria-hidden="true">→</span>
              </button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* where you are in the roll */}
      {n > 1 && (
        <motion.div className={t.nav} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.6, ease: EASE }}>
          <span className={t.bars} aria-hidden="true">
            {films.map((p, i) => (
              <i key={p.no} className={i < at ? t.barDone : undefined}>
                {i === at && <b key={at} className={paused || reduce ? t.barHold : undefined} style={{ animationDuration: `${HOLD_MS}ms` }} />}
              </i>
            ))}
          </span>
          <span className={t.count} aria-live="polite">
            {pad2(at + 1)} <i>/ {pad2(n)}</i>
          </span>
          <button type="button" className={t.arrow} onClick={() => go(-1)} aria-label="Previous film">
            ←
          </button>
          <button type="button" className={t.arrow} onClick={() => go(1)} aria-label="Next film">
            →
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
