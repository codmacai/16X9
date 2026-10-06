"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gallery, type Film } from "./stage";
import styles from "./hero19.module.css";

// ===========================================================================
// HERO 19 — the gallery.
//
// A dark gallery; the ceiling's light boxes flicker on one by one; the screen
// comes on with the mark (16X9 & BEYOND, as in hero 13), and nothing else is
// on the page. Click the screen: the camera walks up to it, the letters lift
// out, the card gives way to the film, and only then does the site arrive:
// the line over the film, the menu along the top, the studios along the foot.
// Esc leads back out into the room. The room is in stage.ts.
// ===========================================================================

const FILMS: (Film & { title: string; meta: string })[] = [
  { src: "/hero19/right.mp4", poster: "/hero19/right.webp", title: "Empty Highway", meta: "Nike, Pitch film" },
  { src: "/hero19/centre.mp4", poster: "/hero19/centre.webp", title: "Abu Dhabi, at Dusk", meta: "Cleveland Clinic, Campaign" },
  { src: "/hero19/left.mp4", poster: "/hero19/left.webp", title: "The Desert Breathes", meta: "Cleveland Clinic, Brand film" },
];

const MENU = [
  { label: "Work", href: "#work" },
  { label: "Who we are", href: "#who-we-are" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
];

const STUDIOS = [
  { label: "16x9", href: "/" },
  { label: "9x16", href: "https://9x16.studio/" },
  { label: "Beyond", href: "#beyond" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Hero19() {
  const hostRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<Gallery | null>(null);
  const [ready, setReady] = useState(false);
  const [inside, setInside] = useState(false);
  const [film, setFilm] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const g = new Gallery(host, FILMS, { onReady: () => setReady(true), onFocus: setInside, onFilm: setFilm }, reduced);
    galleryRef.current = g;
    return () => {
      g.dispose();
      galleryRef.current = null;
    };
  }, []);

  const step = (d: number) => galleryRef.current?.showFilm((film + d + FILMS.length) % FILMS.length);
  const f = FILMS[film];
  const tab = inside ? 0 : -1;

  return (
    <main className={`${styles.root} ${inside ? styles.inside : ""}`}>
      <div ref={hostRef} className={styles.stage} role="button" aria-label="16x9 and Beyond. Click the screen to enter." />
      {/* the only thing on the page before entering, once the mark has landed */}
      <button
        type="button"
        className={`${styles.enter} ${ready && !inside ? styles.enterOn : ""}`}
        onClick={() => galleryRef.current?.setFocus(true)}
        tabIndex={ready && !inside ? 0 : -1}
      >
        <span>Scroll or click to enter</span>
        <span className={styles.enterLine} aria-hidden="true" />
      </button>
      <h1 className={styles.srOnly}>16x9 &amp; Beyond — stories beyond the frame</h1>

      {/* ---- everything below arrives only once you are inside the screen ---- */}
      <header className={styles.top} aria-hidden={!inside}>
        <Link href="/" className={styles.logo} aria-label="Home" tabIndex={tab}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="16x9" />
        </Link>
        <nav className={styles.menu} aria-label="Menu">
          {MENU.map((m) => (
            <a key={m.label} href={m.href} tabIndex={tab}>
              {m.label}
            </a>
          ))}
        </nav>
      </header>

      <p className={styles.headline} aria-hidden={!inside}>
        <span>
          <span>Stories beyond</span>
        </span>
        <span>
          <span>the frame</span>
        </span>
      </p>

      <footer className={styles.bottom} aria-hidden={!inside}>
        <p className={styles.showing} aria-live="polite">
          <span className={styles.label}>Now showing</span>
          <span key={film} className={styles.title}>
            {f.title}
          </span>
          <span className={styles.meta}>{f.meta}</span>
        </p>
        <nav className={styles.studios} aria-label="Studios">
          {STUDIOS.map((s, i) => (
            <span key={s.label} className={styles.studio}>
              {i > 0 && <span className={styles.dot} aria-hidden="true" />}
              <a href={s.href} tabIndex={tab}>
                {s.label}
              </a>
            </span>
          ))}
        </nav>
        <div className={styles.switcher}>
          <button type="button" onClick={() => step(-1)} aria-label="Previous film" tabIndex={tab}>
            ←
          </button>
          <span>
            {pad2(film + 1)} / {pad2(FILMS.length)}
          </span>
          <button type="button" onClick={() => step(1)} aria-label="Next film" tabIndex={tab}>
            →
          </button>
        </div>
      </footer>

      <div className={styles.grain} aria-hidden="true" />
    </main>
  );
}
