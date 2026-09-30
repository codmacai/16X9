"use client";

import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import CRTScreen, { CurvedGrid, useCRT } from "./crt/CRTScreen";
import styles from "./Hero.module.css";

/**
 * Your clips. Put the files in /public/clips.
 * Keep them short (5–15 s), muted, 720p or smaller, under ~3 MB each.
 * Any clip that can't be found shows a placeholder until you add it.
 */
const CLIPS = [
  { title: "Aster SS26", duration: "0:48", src: "/clips/clip-01.mp4" },
  { title: "Oko Audio launch", duration: "1:12", src: "/clips/clip-02.mp4" },
  { title: "Maison Vert winter", duration: "0:30", src: "/clips/clip-03.mp4" },
  { title: "Tessera watches", duration: "0:45", src: "/clips/clip-04.mp4" },
  { title: "Kaji studio", duration: "1:05", src: "/clips/clip-05.mp4" },
  { title: "Lumen & Co scent", duration: "0:20", src: "/clips/clip-06.mp4" },
  { title: "Norrland outerwear", duration: "0:58", src: "/clips/clip-07.mp4" },
  { title: "Night run", duration: "0:36", src: "/clips/clip-08.mp4" },
  { title: "Atelier", duration: "0:42", src: "/clips/clip-09.mp4" },
  { title: "Coastline", duration: "1:20", src: "/clips/clip-10.mp4" },
  { title: "Studio session", duration: "0:25", src: "/clips/clip-11.mp4" },
  { title: "Launch day", duration: "0:52", src: "/clips/clip-12.mp4" },
];

/** Floating navbar links. */
const NAV = [
  { label: "Cases", href: "https://16x9.agency/cases/" },
  { label: "Services", href: "https://16x9.agency/services/" },
  { label: "About", href: "https://16x9.agency/about/" },
];
const CONTACT_HREF = "https://16x9.agency/#";
/** Set to your logo file in /public (e.g. "/logo.svg") to replace the text logo. */
const LOGO_SRC: string | null = "/logo.png";

const CLIENTS = [
  { name: "Norrland", cls: styles.logoA },
  { name: "oko", cls: styles.logoB },
  { name: "Maison Vert", cls: styles.logoC },
  { name: "TESSERA", cls: styles.logoD },
  { name: "kaji", cls: styles.logoB },
  { name: "Lumen & Co", cls: styles.logoC },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** hh:mm:ss:ff at 24 fps, written straight to the DOM so React doesn't re-render. */
function Timecode() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = performance.now() - (11 * 60 + 1) * 1000;
    let raf = 0;
    let last = "";
    const tick = (now: number) => {
      const frames = Math.floor(((now - start) / 1000) * 24);
      const s = Math.floor(frames / 24);
      const tc = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(frames % 24)}`;
      if (tc !== last && ref.current) {
        ref.current.textContent = tc;
        last = tc;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span ref={ref} className={styles.tc}>
      00:11:01:00
    </span>
  );
}

/** Thin arrow used in the buttons. */
function Arrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 10" aria-hidden="true" fill="none">
      <path d="M0 5h14.5M10.5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Starts muted autoplay reliably across browsers. */
const autoplay = (el: HTMLVideoElement | null) => {
  if (!el) return;
  el.muted = true;
  el.play().catch(() => {});
};

function Clip({
  index,
  src,
  failed,
  onFail,
}: {
  index: number;
  src: string;
  failed: boolean;
  onFail: (i: number) => void;
}) {
  if (failed) {
    return (
      <div className={styles.placeholder} style={{ "--seed": index } as CSSProperties}>
        <div />
      </div>
    );
  }
  return (
    <video
      ref={autoplay}
      className={styles.video}
      src={src}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      onError={() => onFail(index)}
    />
  );
}

/**
 * The video wall inside the tube. On Safari / iOS the grid gaps are drawn as
 * curved lines instead, so the wall still looks bent.
 */
function Wall({
  clips,
  cols,
  rows,
  active,
  focused,
  failed,
  onFail,
}: {
  clips: typeof CLIPS;
  cols: number;
  rows: number;
  active: number | null;
  focused: number | null;
  failed: boolean[];
  onFail: (i: number) => void;
}) {
  const { mode } = useCRT();
  const fallback = mode === "fallback";
  const current = focused !== null ? CLIPS[focused] : null;
  return (
    <div className={styles.wall} data-hover={active !== null} data-focus={focused !== null}>
      <div
        className={styles.grid}
        data-fallback={fallback}
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {clips.map((c, i) => (
          <div key={c.src} className={styles.tile} data-active={active === i}>
            <Clip index={i} src={c.src} failed={failed[i]} onFail={onFail} />
            <div className={styles.grade} />
          </div>
        ))}
      </div>
      <CurvedGrid cols={cols} rows={rows} width={5} />
      <div className={styles.spot} />

      {current && focused !== null && (
        <div key={focused} className={styles.channel}>
          <Clip index={focused} src={current.src} failed={failed[focused]} onFail={onFail} />
        </div>
      )}
    </div>
  );
}

export default function Hero() {
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [failed, setFailed] = useState<boolean[]>(() => CLIPS.map(() => false));

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocused(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onFail = useCallback((i: number) => {
    setFailed((f) => (f[i] ? f : f.map((v, j) => (j === i ? true : v))));
  }, []);

  const cols = compact ? 2 : 4;
  const rows = compact ? 4 : 3;
  const clips = CLIPS.slice(0, cols * rows);
  const grid = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  } as CSSProperties;
  const current = focused !== null ? CLIPS[focused] : null;

  return (
    <main className={styles.page}>
      <CRTScreen
        curvature={compact ? 0.06 : 0.1}
        scanlineSize={3}
        scanlineOpacity={0.22}
        scanlineColor="#1a0004"
        vignette={0.72}
        aberration={0}
        phosphor={0}
        backdrop={
          <Wall
            clips={clips}
            cols={cols}
            rows={rows}
            active={active}
            focused={focused}
            failed={failed}
            onFail={onFail}
          />
        }
      >
        <div className={styles.stage} data-focus={focused !== null}>
          {/* invisible grid on top that picks up hover, focus and clicks */}
          <div
            className={styles.hitGrid}
            style={grid}
            onPointerLeave={() => setActive(null)}
            aria-label="Films"
          >
            {clips.map((c, i) => (
              <button
                key={c.src}
                type="button"
                className={styles.hit}
                data-active={active === i}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setFocused(i)}
                aria-label={`Play ${c.title}`}
                tabIndex={focused !== null ? -1 : 0}
              >
                <span className={styles.tag}>
                  <b>{pad(i + 1)}</b>
                  <span>{c.title}</span>
                  <span>{c.duration}</span>
                </span>
              </button>
            ))}
          </div>

          <nav className={styles.nav} aria-label="Main">
            <a href="https://16x9.agency/" className={styles.logo} aria-label="16x9, home">
              {LOGO_SRC ? <img src={LOGO_SRC} alt="" /> : "16x9"}
            </a>
            <ul className={styles.navLinks}>
              {NAV.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
            <a href={CONTACT_HREF} className={`${styles.cta} ${styles.ctaSmall}`}>
              <span className={styles.ctaFace}>
                <i className={styles.ctaRec} aria-hidden="true" />
                <span className={styles.ctaLabel}>Contact us</span>
              </span>
            </a>
          </nav>

          <section className={styles.copy}>
            <h1 className={styles.headline}>
              Brand films,
              <br />
              shot like cinema.
            </h1>
            <p className={styles.sub}>
              We write, shoot and finish campaign films for fashion and product
              brands, from first treatment to final grade.
            </p>
            <a href="#contact" className={styles.cta}>
              <span className={styles.ctaFace}>
                <i className={styles.ctaRec} aria-hidden="true" />
                <span className={styles.ctaLabel}>Book a call</span>
                <Arrow className={styles.ctaIcon} />
              </span>
            </a>
          </section>

          {current && focused !== null && (
            <div className={styles.nowPlaying} key={focused}>
              <b>{pad(focused + 1)}</b>
              <div>
                <span>{current.title}</span>
                <span>{current.duration}</span>
              </div>
              <button
                type="button"
                className={`${styles.cta} ${styles.ctaDark} ${styles.close}`}
                onClick={() => setFocused(null)}
                autoFocus
              >
                <span className={styles.ctaFace}>
                  <Arrow className={`${styles.ctaIcon} ${styles.ctaIconBack}`} />
                  <span className={styles.ctaLabel}>All films</span>
                </span>
              </button>
            </div>
          )}

          <div className={styles.clients} aria-label="Clients">
            <div className={styles.track}>
              {[...CLIENTS, ...CLIENTS].map((c, i) => (
                <span key={i} className={c.cls} aria-hidden={i >= CLIENTS.length}>
                  {c.name}
                </span>
              ))}
            </div>
          </div>

          <footer className={styles.hud}>
            <span className={styles.rec}>
              <i aria-hidden="true" />
              REC <Timecode />
            </span>
            <span>
              {focused !== null ? (
                <>
                  <span className={styles.hintMouse}>Press Esc to go back</span>
                  <span className={styles.hintTouch}>Now playing</span>
                </>
              ) : (
                <>
                  <span className={styles.hintMouse}>Hover a film to preview, click to play</span>
                  <span className={styles.hintTouch}>Tap a film to play</span>
                </>
              )}
            </span>
            <span>Est. 2019</span>
          </footer>
        </div>
      </CRTScreen>
    </main>
  );
}
