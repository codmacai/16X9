"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gallery, type Film } from "./stage";
import styles from "./hero22.module.css";

// ===========================================================================
// HERO 22 — the gallery.
//
// A dark gallery; the ceiling's light boxes flicker on one by one; the screen
// comes on with the mark (16X9 & BEYOND, as in hero 13), and nothing else is
// on the page. Click the screen: the camera walks up to it, the letters lift
// out, the card gives way to the film, and only then does the site arrive:
// the line over the film, the menu along the top, the studios along the foot.
// Esc leads back out into the room. The room is in stage.ts.
// ===========================================================================

const FILMS: (Film & { title: string; meta: string })[] = [
  { src: "/hero22/right.mp4", poster: "/hero22/right.webp", title: "Empty Highway", meta: "Nike, Pitch film" },
  { src: "/hero22/centre.mp4", poster: "/hero22/centre.webp", title: "Abu Dhabi, at Dusk", meta: "Cleveland Clinic, Campaign" },
  { src: "/hero22/left.mp4", poster: "/hero22/left.webp", title: "The Desert Breathes", meta: "Cleveland Clinic, Brand film" },
];

const MENU = [
  { label: "Work", href: "#work" },
  { label: "Studio", href: "#studio" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
];

const STUDIOS = [
  { label: "16x9", href: "/" },
  { label: "9x16", href: "https://9x16.studio/" },
  { label: "Beyond", href: "#beyond" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** A gallery's room tone: low air, a faint hum from the screen. */
function roomTone() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const hum = ctx.createOscillator();
  hum.frequency.value = 100;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.006;
  const out = ctx.createGain();
  out.gain.value = 0;
  noise.connect(lp).connect(out);
  hum.connect(humGain).connect(out);
  out.connect(ctx.destination);
  noise.start();
  hum.start();
  return {
    set(on: boolean) {
      if (ctx.state === "suspended") ctx.resume();
      out.gain.setTargetAtTime(on ? 0.2 : 0, ctx.currentTime, 0.4);
    },
    close() {
      ctx.close();
    },
  };
}

export default function Hero22() {
  const hostRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<Gallery | null>(null);
  const toneRef = useRef<ReturnType<typeof roomTone> | null>(null);
  const [inside, setInside] = useState(false);
  const [film, setFilm] = useState(0);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const g = new Gallery(host, FILMS, { onFocus: setInside, onFilm: setFilm }, reduced);
    galleryRef.current = g;
    return () => {
      g.dispose();
      galleryRef.current = null;
      toneRef.current?.close();
      toneRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    if (!toneRef.current) toneRef.current = roomTone();
    const next = !sound;
    toneRef.current.set(next);
    galleryRef.current?.play();
    setSound(next);
  };
  const step = (d: number) => galleryRef.current?.showFilm((film + d + FILMS.length) % FILMS.length);
  const f = FILMS[film];
  const tab = inside ? 0 : -1;

  return (
    <main className={`${styles.root} ${inside ? styles.inside : ""}`}>
      <div ref={hostRef} className={styles.stage} role="button" aria-label="16x9 and Beyond. Click the screen to enter." />
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
          <span className={styles.rule} aria-hidden="true" />
          <button type="button" className={styles.sound} onClick={toggleSound} aria-pressed={sound} tabIndex={tab}>
            <span className={styles.bars} data-on={sound}>
              <i />
              <i />
              <i />
            </span>
            Sound {sound ? "on" : "off"}
          </button>
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
