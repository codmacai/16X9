"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gallery, type Film } from "./stage";
import styles from "./hero22.module.css";

// ===========================================================================
// HERO 22 — the gallery.
//
// A wide screen in a dark gallery under a ceiling of diamond light boxes,
// seen from the middle of the room. The type stays out of the room's way:
// the top bar, and an exhibition placard at the foot (the line, what's
// showing, the films). Click the screen to walk up to it. The room is in
// stage.ts.
// ===========================================================================

const FILMS: (Film & { title: string; meta: string })[] = [
  { src: "/hero22/right.mp4", poster: "/hero22/right.webp", title: "Empty Highway", meta: "Nike, Pitch film" },
  { src: "/hero22/centre.mp4", poster: "/hero22/centre.webp", title: "Abu Dhabi, at Dusk", meta: "Cleveland Clinic, Campaign" },
  { src: "/hero22/left.mp4", poster: "/hero22/left.webp", title: "The Desert Breathes", meta: "Cleveland Clinic, Brand film" },
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
  const [ready, setReady] = useState(false);
  const [focus, setFocus] = useState(false);
  const [film, setFilm] = useState(0);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const g = new Gallery(host, FILMS, { onReady: () => setReady(true), onFocus: setFocus, onFilm: setFilm }, reduced);
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

  return (
    <main className={`${styles.root} ${ready ? styles.ready : ""} ${focus ? styles.focused : ""}`}>
      <div ref={hostRef} className={styles.stage} aria-label="A screen in a gallery. Click it to step closer." />

      <header className={styles.top}>
        <Link href="/" className={styles.logo} aria-label="Home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="16x9" />
        </Link>
        <nav className={styles.nav} aria-label="Studios">
          {STUDIOS.map((s) => (
            <a key={s.label} href={s.href}>
              {s.label}
            </a>
          ))}
          <span className={styles.rule} aria-hidden="true" />
          <button type="button" className={styles.sound} onClick={toggleSound} aria-pressed={sound}>
            <span className={styles.bars} data-on={sound}>
              <i />
              <i />
              <i />
            </span>
            Sound {sound ? "on" : "off"}
          </button>
        </nav>
      </header>

      {/* the placard */}
      <div className={styles.placard}>
        <h1 className={styles.headline}>
          <span>Stories beyond</span>
          <span>the frame</span>
        </h1>
        <p className={styles.showing} aria-live="polite">
          <span className={styles.label}>Now showing</span>
          <span key={film} className={styles.title}>
            {f.title}
          </span>
          <span className={styles.meta}>{f.meta}</span>
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.switcher}>
          <button type="button" onClick={() => step(-1)} aria-label="Previous film">
            ←
          </button>
          <span>
            {pad2(film + 1)} / {pad2(FILMS.length)}
          </span>
          <button type="button" onClick={() => step(1)} aria-label="Next film">
            →
          </button>
        </div>
        <p className={styles.hint}>{focus ? "Click or Esc to step back" : "Click the screen to step closer"}</p>
      </div>

      <div className={styles.grain} aria-hidden="true" />
    </main>
  );
}
