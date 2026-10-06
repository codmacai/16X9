"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, type Film } from "./stage";
import styles from "./hero23.module.css";

// ===========================================================================
// HERO 23 — the frame, broken.
//
// A film breaks into a slow sphere of small video cubes in the dark. Click and
// hold to pull them back into one frame; let go and it breaks, and the next
// film comes in. Drag to turn the sphere. The 3D is in stage.ts; this file is
// the quiet type around it.
// ===========================================================================

const FILMS: (Film & { title: string; meta: string })[] = [
  { src: "/hero22/centre.mp4", poster: "/hero22/centre.webp", title: "Abu Dhabi, at Dusk", meta: "Cleveland Clinic, Campaign" },
  { src: "/hero22/right.mp4", poster: "/hero22/right.webp", title: "Empty Highway", meta: "Nike, Pitch film" },
  { src: "/hero22/left.mp4", poster: "/hero22/left.webp", title: "The Desert Breathes", meta: "Cleveland Clinic, Brand film" },
];

const MENU = [
  { label: "Work", href: "#work" },
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
];
const STUDIOS = [
  { label: "16x9", href: "/" },
  { label: "9x16", href: "https://9x16.studio/" },
  { label: "Beyond", href: "#beyond" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Hero23() {
  const hostRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [whole, setWhole] = useState(false);
  const [film, setFilm] = useState(0);
  const [menu, setMenu] = useState(false);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setTouch(window.matchMedia("(hover: none)").matches);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stage = new Stage(host, FILMS, { onAssembled: setWhole, onFilm: setFilm }, reduced);

    // the hold line under "click & hold" fills as the frame comes together
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (barRef.current) barRef.current.style.transform = `scaleX(${stage.holdProgress.toFixed(3)})`;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      stage.dispose();
    };
  }, []);

  const f = FILMS[film];

  return (
    <main className={`${styles.root} ${whole ? styles.whole : ""}`}>
      <div ref={hostRef} className={styles.stage} aria-label="Click and hold to bring the film together" />

      <a className={styles.all} href="#work">
        View all work
      </a>

      <button type="button" className={styles.burger} onClick={() => setMenu(true)} aria-label="Open menu">
        <span />
        <span />
        <span />
      </button>

      <h1 className={styles.title}>
        <span>16x9 · Film Studio</span>
        <span>Stories beyond the frame</span>
      </h1>

      <div className={styles.hold} aria-hidden="true">
        <span className={styles.holdLabel}>{touch ? "Touch & hold" : "Click & hold"}</span>
        <span className={styles.holdTrack}>
          <span ref={barRef} className={styles.holdBar} />
        </span>
      </div>

      <div className={styles.caption} aria-live="polite">
        <span className={styles.captionNo}>{pad2(film + 1)} / {pad2(FILMS.length)}</span>
        <span className={styles.captionTitle}>{f.title}</span>
        <span className={styles.captionMeta}>{f.meta}</span>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.mark} src="/logo.png" alt="16x9" width={34} height={28} />

      <div className={`${styles.menu} ${menu ? styles.menuOpen : ""}`} aria-hidden={!menu}>
        <button type="button" className={styles.close} onClick={() => setMenu(false)} aria-label="Close menu" tabIndex={menu ? 0 : -1}>
          <span />
          <span />
        </button>
        <nav className={styles.menuNav}>
          {MENU.map((m, i) => (
            <a key={m.label} href={m.href} onClick={() => setMenu(false)} style={{ transitionDelay: `${0.08 + i * 0.05}s` }} tabIndex={menu ? 0 : -1}>
              {m.label}
            </a>
          ))}
        </nav>
        <div className={styles.menuStudios}>
          {STUDIOS.map((s) => (
            <a key={s.label} href={s.href} tabIndex={menu ? 0 : -1}>
              {s.label}
            </a>
          ))}
        </div>
      </div>

      <div className={styles.grain} aria-hidden="true" />
    </main>
  );
}
