"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, type Clip } from "./stage";
import styles from "./hero23.module.css";

// ===========================================================================
// HERO 23 — shards.
//
// A small cluster of rounded film tiles hangs in the middle of a dark room,
// each playing its own clip. Click and hold: they turn to face you and settle
// into a contact sheet of the work; let go and they drift apart again. Drag to
// turn the cluster. The 3D is in stage.ts; this file is the quiet type around it.
// ===========================================================================

const CLIPS: Clip[] = Array.from({ length: 15 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/clips/clip-${n}.mp4`, poster: `/clips/posters/clip-${n}.webp` };
});

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
  const [menu, setMenu] = useState(false);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setTouch(window.matchMedia("(hover: none)").matches);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stage = new Stage(host, CLIPS, { onGathered: setWhole }, reduced);

    // the hold line under "click & hold" fills as the tiles gather
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

  return (
    <main className={`${styles.root} ${whole ? styles.whole : ""}`}>
      <div ref={hostRef} className={styles.stage} aria-label="Click and hold to gather the films" />

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
        <span className={styles.captionNo}>Selected work</span>
        <span className={styles.captionTitle}>{pad2(CLIPS.length)} films, one room</span>
        <span className={styles.captionMeta}>Release to let them drift</span>
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
