"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Gallery, type Film } from "./stage";
import styles from "./hero22.module.css";

// ===========================================================================
// HERO 22 — the gallery.
//
// A dark gallery; the ceiling's tubes strike one by one; the screen comes on
// with the mark (16X9 & BEYOND, as in hero 13), and nothing else is on the
// page but the way in. Scroll, click or swipe up: the camera walks up to the
// screen, the letters lift out, the card gives way to the films, and only
// then does the site arrive: the line over the film, the menu along the top,
// the studios along the foot. Scroll up, swipe down or Esc: back to the room.
//
// The room is in stage.ts. This file is the page around it: a loader while
// the room gets ready, a cursor that says "Enter" over the screen, the menu
// (a sheet on phones), the film's progress, and a plain version of the page
// for browsers that can't draw the room.
// ===========================================================================

const FILMS: (Film & { title: string; meta: string })[] = [
  { src: "/hero22/right.mp4", poster: "/hero22/right.webp", title: "Empty Highway", meta: "Nike, Pitch film" },
  { src: "/hero22/centre.mp4", poster: "/hero22/centre.webp", title: "Abu Dhabi, at Dusk", meta: "Cleveland Clinic, Campaign" },
  { src: "/hero22/left.mp4", poster: "/hero22/left.webp", title: "The Desert Breathes", meta: "Cleveland Clinic, Brand film" },
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

const FILM_HOLD = 9; // seconds per film, when the room can't be drawn (the room keeps its own)

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Can this browser draw the room? Asked once, quietly, before three.js tries (and logs). */
function canDrawRoom() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

export default function Hero22() {
  const hostRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<Gallery | null>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const fallbackSince = useRef(0);

  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [inside, setInside] = useState(false);
  const [film, setFilm] = useState(0);
  const [hover, setHover] = useState(false);
  const [menu, setMenu] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [touch, setTouch] = useState(false);
  const [fine, setFine] = useState(false);
  const [overUi, setOverUi] = useState(false);

  // ---- the room
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setTouch(window.matchMedia("(hover: none)").matches);
    setFine(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const plain = () => {
      galleryRef.current?.dispose();
      galleryRef.current = null;
      setFallback(true);
    };
    if (!canDrawRoom()) {
      plain();
      return;
    }
    try {
      galleryRef.current = new Gallery(
        host,
        FILMS,
        {
          onStart: () => setStarted(true),
          onReady: () => setReady(true),
          onFocus: (inside) => {
            setInside(inside);
            if (!inside) setMenu(false); // stepping back out closes the menu too
          },
          onFilm: setFilm,
          onHover: setHover,
          onLost: plain,
        },
        reduced,
      );
    } catch {
      plain(); // no WebGL 2: the films, without the room
    }
    return () => {
      galleryRef.current?.dispose();
      galleryRef.current = null;
    };
  }, []);

  // without the room, the page is simply open
  const shown = inside || fallback;

  // ---- the plain version moves through the films by itself
  useEffect(() => {
    if (!fallback) return;
    fallbackSince.current = performance.now();
    const id = window.setTimeout(() => setFilm((i) => (i + 1) % FILMS.length), FILM_HOLD * 1000);
    return () => window.clearTimeout(id);
  }, [fallback, film]);

  // ---- the line under the film's title fills as it plays
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const g = galleryRef.current;
      const p = g ? g.filmProgress : fallback ? Math.min(1, (performance.now() - fallbackSince.current) / (FILM_HOLD * 1000)) : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fallback]);

  // ---- the menu sheet: the room stops answering while it's open; Esc closes it
  useEffect(() => {
    galleryRef.current?.setInput(!menu);
    if (menu) sheetRef.current?.querySelector<HTMLElement>("a")?.focus();
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setMenu(false);
      burgerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [menu]);

  // ---- the cursor: a dot that trails the mouse, a ring that says Enter over the screen
  useEffect(() => {
    if (!fine) return;
    const el = cursorRef.current;
    if (!el) return;
    let x = -200;
    let y = -200;
    let px = x;
    let py = y;
    let raf = 0;
    let last = performance.now();
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (x < -100) {
        px = e.clientX;
        py = e.clientY;
      }
      x = e.clientX;
      y = e.clientY;
    };
    const over = (e: PointerEvent) => setOverUi(!!(e.target as Element | null)?.closest?.("a, button"));
    const leave = () => {
      x = -200;
      y = -200;
      px = x;
      py = y;
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const k = 1 - Math.exp(-20 * Math.min((now - last) / 1000, 0.1));
      last = now;
      px += (x - px) * k;
      py += (y - py) * k;
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [fine]);
  const cursor = fine && started && !shown && !overUi && !menu ? (hover && ready ? "enter" : "dot") : "off";

  const enter = useCallback(() => galleryRef.current?.enter(), []);
  const step = (d: number) => {
    if (galleryRef.current) galleryRef.current.showFilm(film + d);
    else setFilm((film + d + FILMS.length) % FILMS.length);
  };
  const f = FILMS[film];
  const tab = shown ? 0 : -1;

  return (
    <main
      className={cx(
        styles.root,
        (started || fallback) && styles.started,
        ready && styles.ready,
        shown && styles.inside,
        menu && styles.menuOpen,
        cursor !== "off" && styles.ownCursor,
      )}
    >
      {fallback ? (
        <video
          key={f.src}
          className={styles.plain}
          src={f.src}
          poster={f.poster}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ) : (
        <div ref={hostRef} className={styles.stage} aria-hidden="true" />
      )}

      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.loader} aria-hidden="true">
        <span />
      </div>

      <h1 className={styles.srOnly}>16x9 &amp; Beyond — stories beyond the frame</h1>

      {/* the only thing on the page before entering, once the mark has landed */}
      <button type="button" className={styles.enter} onClick={enter} tabIndex={ready && !shown ? 0 : -1} aria-hidden={!ready || shown}>
        <span>{touch ? "Swipe up or tap to enter" : "Scroll or click to enter"}</span>
        <span className={styles.enterLine} aria-hidden="true" />
      </button>

      {/* ---- everything below arrives only once you are inside the screen ---- */}
      <header className={styles.top} aria-hidden={!shown}>
        <Link href="/" className={styles.logo} aria-label="16x9 home" tabIndex={tab}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={170} height={140} />
        </Link>
        <nav className={styles.menu} aria-label="Main">
          {MENU.map((m, i) => (
            <a key={m.label} href={m.href} tabIndex={tab} style={stagger(i)}>
              {m.label}
            </a>
          ))}
        </nav>
        <button
          ref={burgerRef}
          type="button"
          className={styles.burger}
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
          aria-controls="hero22-menu"
          onClick={() => setMenu((o) => !o)}
          tabIndex={tab}
        >
          <span />
          <span />
        </button>
      </header>

      <p className={styles.headline} aria-hidden={!shown}>
        <span>
          <span>Stories beyond</span>
        </span>
        <span>
          <span>the frame</span>
        </span>
      </p>

      <footer className={styles.bottom} aria-hidden={!shown}>
        <div className={styles.showing}>
          <p className={styles.nowLine} aria-live="polite">
            <span className={styles.label}>Now showing</span>
            <span key={film} className={styles.title}>
              {f.title}
            </span>
            <span className={styles.meta}>{f.meta}</span>
          </p>
          <span className={styles.progress} aria-hidden="true">
            <span ref={progressRef} />
          </span>
        </div>
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
            <Arrow flip />
          </button>
          <span className={styles.count}>
            {pad2(film + 1)} <i>/</i> {pad2(FILMS.length)}
          </span>
          <button type="button" onClick={() => step(1)} aria-label="Next film" tabIndex={tab}>
            <Arrow />
          </button>
        </div>
      </footer>

      {/* the menu, as a sheet, on phones */}
      <div id="hero22-menu" ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!menu}>
        <nav className={styles.sheetNav} aria-label="Main">
          {MENU.map((m, i) => (
            <a key={m.label} href={m.href} tabIndex={menu ? 0 : -1} style={stagger(i)} onClick={() => setMenu(false)}>
              {m.label}
            </a>
          ))}
        </nav>
        <nav className={styles.sheetStudios} aria-label="Studios">
          {STUDIOS.map((s) => (
            <a key={s.label} href={s.href} tabIndex={menu ? 0 : -1} onClick={() => setMenu(false)}>
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      <div ref={cursorRef} className={cx(styles.cursor, styles[`cursor_${cursor}`])} aria-hidden="true">
        <span className={styles.cursorDot} />
        <span className={styles.cursorRing}>
          <span>Enter</span>
        </span>
      </div>

      <div className={styles.grain} aria-hidden="true" />
    </main>
  );
}

function Arrow({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
