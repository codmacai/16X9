"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, type Film } from "./stage";
import styles from "./hero22.module.css";

// ===========================================================================
// HERO 22 — the screening room.
//
// Three 16:9 screens curve around you in the dark, standing over a wet floor
// that mirrors them. The headline floats above. Drag to look around; click a
// screen to walk up to it. The 3D lives in stage.ts; this file is the HTML
// layer on top (logo, nav, headline, index, caption).
// ===========================================================================

const FILMS: (Film & { title: string; meta: string })[] = [
  { src: "/hero22/left.mp4", poster: "/hero22/left.webp", title: "The Desert Breathes", meta: "Cleveland Clinic, Brand film" },
  { src: "/hero22/centre.mp4", poster: "/hero22/centre.webp", title: "Abu Dhabi, at Dusk", meta: "Cleveland Clinic, Campaign" },
  { src: "/hero22/right.mp4", poster: "/hero22/right.webp", title: "Empty Highway", meta: "Nike, Pitch film" },
];

// the house and its sister studios; each one walks you to a screen
const STUDIOS = ["16x9", "9x16", "Beyond"];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** A low room tone, made on the fly: filtered noise and a faint mains hum. */
function roomTone() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown noise
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  const hum = ctx.createOscillator();
  hum.frequency.value = 50;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.012;
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
      out.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.4);
    },
    close() {
      ctx.close();
    },
  };
}

export default function Hero22() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const toneRef = useRef<ReturnType<typeof roomTone> | null>(null);
  const [ready, setReady] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stage = new Stage(host, FILMS, { onReady: () => setReady(true), onFocus: setFocus, onHover: setHover }, reduced);
    stageRef.current = stage;

    // The headline leans with the camera, a touch, so it sits in the room.
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const h = headRef.current;
      if (h) h.style.transform = `translate3d(${(-stage.turn * 26).toFixed(2)}px, 0, 0)`;
    };
    if (!reduced) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      stage.dispose();
      stageRef.current = null;
      toneRef.current?.close();
      toneRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    if (!toneRef.current) toneRef.current = roomTone();
    const next = !sound;
    toneRef.current.set(next);
    stageRef.current?.play();
    setSound(next);
  };

  const go = (i: number | null) => stageRef.current?.setFocus(i);
  const active = focus === null ? 0 : focus + 1;
  const film = focus !== null ? FILMS[focus] : null;

  return (
    <main className={`${styles.root} ${ready ? styles.ready : ""} ${focus !== null ? styles.focused : ""}`}>
      <div ref={hostRef} className={styles.stage} aria-hidden="true" />

      <header className={styles.top}>
        <a className={styles.logo} href="/">
          16x9
        </a>
        <nav className={styles.nav} aria-label="Studios">
          {STUDIOS.map((label, i) => (
            <button key={label} type="button" className={focus === i ? styles.on : ""} onClick={() => go(focus === i ? null : i)}>
              {label}
            </button>
          ))}
          <span className={styles.rule} aria-hidden="true" />
          <button type="button" className={styles.sound} onClick={toggleSound} aria-pressed={sound}>
            <SpeakerIcon on={sound} />
            Sound {sound ? "on" : "off"}
          </button>
        </nav>
      </header>

      <h1 ref={headRef} className={styles.headline}>
        <span>Stories beyond</span>
        <span>the frame</span>
      </h1>

      <ol className={styles.index} aria-label="Views">
        {[0, 1, 2, 3].map((n) => (
          <li key={n}>
            <button type="button" className={active === n ? styles.on : ""} onClick={() => go(n === 0 ? null : n - 1)}>
              {pad2(n + 1)}
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.hint}>
        <span className={styles.hintIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 4v16M12 20l-4-4M12 20l4-4" />
          </svg>
        </span>
        {focus === null ? (hover !== null ? `Click to enter ${pad2(hover + 1)}` : "Drag to explore") : "Drag or click to leave"}
      </div>

      <div className={styles.caption} aria-live="polite">
        {film && (
          <>
            <span className={styles.captionNo}>{pad2((focus ?? 0) + 1)} / 03</span>
            <span className={styles.captionTitle}>{film.title}</span>
            <span className={styles.captionMeta}>{film.meta}</span>
          </>
        )}
      </div>

      <div className={styles.grain} aria-hidden="true" />
    </main>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
      {on ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M17 10l4 4M21 10l-4 4" />}
    </svg>
  );
}
