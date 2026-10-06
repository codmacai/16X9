"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Zoetrope, type Reel } from "./stage";
import styles from "./hero25.module.css";

// ===========================================================================
// HERO 25 — zoetrope.
//
// A machined drum in a dark room; spin it and the film inside comes alive.
// Its frame rate is yours: the read-out under the drum counts it, and at 24
// (the speed of film) a motor catches it, holds it, and the line arrives.
// Three reels to load. The drum and its physics are in stage.ts.
// ===========================================================================

const REELS: (Reel & { label: string })[] = [
  { title: "Caravan", label: "Cleveland Clinic", atlas: "/hero25/caravan.webp", frames: 43 },
  { title: "Flight", label: "Night run", atlas: "/hero25/flip.webp", frames: 29 },
  { title: "Highway", label: "Nike", atlas: "/hero25/highway.webp", frames: 41 },
];
const SCALE_MAX = 36; // fps at the end of the read-out's scale

const pad2 = (n: number) => String(Math.min(99, Math.round(n))).padStart(2, "0");

export default function Hero25() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Zoetrope | null>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const needleRef = useRef<HTMLSpanElement>(null);
  const dirRef = useRef<HTMLSpanElement>(null);
  const [locked, setLocked] = useState(false);
  const [reel, setReel] = useState(0);
  const [sound, setSound] = useState(false);
  const [motor, setMotor] = useState(false);
  const [phase, setPhase] = useState<"still" | "slow" | "fast">("still");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const z = new Zoetrope(host, REELS, { onLock: setLocked }, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    stageRef.current = z;

    // the read-out runs off the drum directly, never through React
    let raf = 0;
    let lastPhase = "";
    let lastMotor = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const fps = Math.abs(z.fps);
      if (fpsRef.current) fpsRef.current.textContent = pad2(fps);
      if (needleRef.current) needleRef.current.style.transform = `translateX(${(Math.min(fps, SCALE_MAX) / SCALE_MAX) * 100}%)`;
      if (dirRef.current) dirRef.current.textContent = z.fps < -0.3 ? "Reverse" : "Forward";
      const p = fps < 0.6 ? "still" : fps < 16 ? "slow" : "fast";
      if (p !== lastPhase) {
        lastPhase = p;
        setPhase(p as typeof phase);
      }
      if (z.isMotor !== lastMotor) {
        lastMotor = z.isMotor;
        setMotor(lastMotor);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      z.dispose();
      stageRef.current = null;
    };
  }, []);

  const hint = locked
    ? "Locked at 24 frames a second"
    : phase === "still"
      ? "Drag the drum to spin it"
      : phase === "slow"
        ? "Faster. Film runs at 24"
        : "Almost there";

  return (
    <main className={`${styles.root} ${locked ? styles.locked : ""}`}>
      <div ref={hostRef} className={styles.stage} aria-label="A zoetrope. Drag to spin it." />

      <header className={styles.top}>
        <Link href="/" className={styles.logo} aria-label="Home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="16x9" />
        </Link>
        <nav className={styles.nav}>
          <a href="#work">Work</a>
          <a href="#about">Studio</a>
          <a href="#contact">Contact</a>
          <button
            type="button"
            className={styles.sound}
            aria-pressed={sound}
            onClick={() => {
              const next = !sound;
              setSound(next);
              stageRef.current?.setSound(next);
            }}
          >
            <span className={styles.bars} data-on={sound}>
              <i />
              <i />
              <i />
            </span>
            Sound {sound ? "on" : "off"}
          </button>
        </nav>
      </header>

      {/* the line: a quiet caption until the drum locks, then the headline */}
      <div className={styles.head}>
        <p className={styles.kicker}>No. 01 — A study in persistence of vision</p>
        <h1 className={styles.headline} aria-live="polite">
          {"Stories beyond the frame".split(" ").map((w, i) => (
            <span key={i} style={{ transitionDelay: `${0.12 + i * 0.07}s` }}>
              {w}
            </span>
          ))}
        </h1>
      </div>

      {/* reels */}
      <ol className={styles.reels} aria-label="Reels">
        {REELS.map((r, i) => (
          <li key={r.title}>
            <button
              type="button"
              className={i === reel ? styles.on : ""}
              onClick={() => {
                setReel(i);
                stageRef.current?.setReel(i);
              }}
            >
              <span className={styles.reelNo}>{pad2(i + 1)}</span>
              <span className={styles.reelTitle}>{r.title}</span>
              <span className={styles.reelMeta}>
                {r.frames} frames · {r.label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* the read-out */}
      <div className={styles.meter}>
        <div className={styles.fps}>
          <span ref={fpsRef} className={styles.fpsNum}>
            00
          </span>
          <span className={styles.fpsUnit}>
            fps
            <span ref={dirRef} className={styles.dir}>
              Forward
            </span>
          </span>
        </div>
        <div className={styles.scale} aria-hidden="true">
          {Array.from({ length: SCALE_MAX / 2 + 1 }, (_, i) => (
            <i key={i} className={i * 2 === 24 ? styles.mark24 : i % 3 === 0 ? styles.major : ""} style={{ left: `${(i * 2 * 100) / SCALE_MAX}%` }} />
          ))}
          <span className={styles.label24} style={{ left: `${(24 * 100) / SCALE_MAX}%` }}>
            24
          </span>
          <span className={styles.needleTrack}>
            <span ref={needleRef} className={styles.needle} />
          </span>
        </div>
        <p className={styles.hint} aria-live="polite">
          {hint}
        </p>
      </div>

      <button type="button" className={styles.motor} onClick={() => stageRef.current?.toggleMotor()} aria-pressed={motor}>
        <span className={styles.motorDot} data-on={motor} />
        {motor ? "Stop motor" : "Run motor"}
      </button>

      <div className={styles.grain} aria-hidden="true" />
    </main>
  );
}
