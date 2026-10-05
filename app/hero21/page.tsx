"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import { posterFor } from "../hero7/wall-playback";
import Drawer from "../hero11/drawer";
import Screening, { Swap, type ScreeningOpen } from "./screening";
import styles from "./hero21.module.css";

// ===========================================================================
// HERO 21 — "In frame", across.
//
// Hero 20 turned on its side: one row of films runs across the middle of a
// white page, through a viewfinder that is the 16x9 logo itself (a thin
// rectangle, "16" by its corner and "9" past its edge). Films outside the
// frame are grey stills; the one in the frame develops into colour and plays.
//
// ENTRANCE
//   1. On white, the logo draws itself in the centre, line by line.
//   2. It opens out into the viewfinder, and the first film blooms inside it.
//   3. The other films unfold out from behind it, left and right.
//   4. The type rises in.
//
// After that the row advances a film every few seconds, like a projector.
// Scroll, drag, swipe or the arrow keys move it. The
// row is a lens: films shrink a little as they travel away from the frame.
// Click the framed film to open it (see screening.tsx); click any other to frame it.
//
// Type: Archivo, extended (as in hero 13): light uppercase for the line,
// small spaced uppercase for everything else.
// ===========================================================================

// ---------------------------------------------------------------- copy ----
const HEADLINE = ["Stories beyond", "the frame"];
const NAV = [
  { label: "Work", href: "#work" },
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
];
// the house and its sister studios; 16x9 is this site
const STUDIOS = [
  { label: "16x9", href: "/", here: true },
  { label: "9x16", href: "https://9x16.studio/", here: false },
  { label: "Beyond", href: "#beyond", here: false }, // replace with the Beyond site
];
const LOGO_SRC = "/logo.png";
// one line each, by film (they repeat if there are more films)
const CATEGORY = [
  "Fashion, Campaign",
  "Audio, Launch film",
  "Lifestyle, Brand film",
  "Watches, Product film",
  "Studio, Documentary",
  "Beauty, Campaign",
  "Outerwear, Campaign",
  "Sport, Social",
  "Craft, Brand film",
  "Travel, Destination",
  "Music, Live session",
  "Tech, Launch film",
];
const SERVICES = [
  "Concept, Direction, Production",
  "Direction, Post, Sound",
  "Production, Colour",
  "Concept, Production, Post",
  "Direction, Edit",
  "Production, Post, Colour",
];

// -------------------------------------------------------------- timing ----
const HOLD_MS = 4200; // a film holds in frame this long before the row advances
const T = { open: 1000, unfold: 1850, type: 2300, ready: 3000 }; // ms from load (the logo draws from 0)
const OPEN_MS = 950;
const UNFOLD_MS = 1300;
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeCine = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
const grayPoster = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/posters-gray/$1.webp");

// ------------------------------------------------------------ geometry ----
type Geo = { vw: number; vh: number; small: boolean; w: number; h: number; gap: number; m: number; cy: number };
const geoFor = (vw: number, vh: number): Geo => {
  const small = vw < 760 || vw < vh * 0.8;
  const w = small ? Math.min(vw * 0.72, 520) : Math.min(Math.max(vw * 0.27, 320), 640, (vh * 0.4 * 16) / 9);
  return {
    vw,
    vh,
    small,
    w,
    h: (w * 9) / 16,
    gap: small ? 14 : 24,
    m: small ? 9 : 12,
    cy: small ? vh * 0.52 : vh * 0.53,
  };
};
const LOGO_BOX = { w: 112, h: 56 }; // the logo's size when it first draws

// The row is a lens: a film's scale falls off with its distance from the
// frame, and its position is the integral of that scale, so the gaps stay even.
const LENS = 0.3;
function lens(d: number, R: number) {
  const a = Math.abs(d);
  const s = 1 - LENS * Math.min(1, a / R);
  const x = a < R ? a - (LENS * a * a) / (2 * R) : R - (LENS * R) / 2 + (1 - LENS) * (a - R);
  return { x: Math.sign(d) * x, s };
}

// ---------------------------------------------------------------- menu ----
// Phones: the hero 11 drawer, wiped down over the page like a sheet (as in hero 13).
function Menu({ open, reduce, onClose }: { open: boolean; reduce: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="menu"
          className={styles.menuSheet}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)" }}
          animate={
            reduce
              ? { opacity: 1, transition: { duration: 0 } }
              : { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, ease: EASE_CINE } }
          }
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0 } }
              : { clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.75, ease: EASE_CINE } }
          }
        >
          <Drawer onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The arrow on links that leave this site. */
const Out = () => (
  <svg className={styles.out} viewBox="0 0 10 10" aria-hidden="true">
    <path d="M2.5 7.5l5-5M3.5 2.5h4v4" fill="none" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);

// ---------------------------------------------------------------- hero ----
// The variant depends on the URL and today's date, so it's read on the client only.
const noopSubscribe = () => () => {};
export default function Hero21({ variantId }: { variantId?: string }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const variant = useMemo<HeroVariant | null>(
    () =>
      isClient
        ? resolveVariant(new Date(), variantId ?? new URLSearchParams(window.location.search).get("hero"))
        : null,
    [isClient, variantId]
  );
  if (!variant) return <section className={styles.root} aria-hidden="true" />;
  return <InFrameAcross key={variant.id} variant={variant} />;
}

function InFrameAcross({ variant }: { variant: HeroVariant }) {
  const clips = variant.clips;
  const N = clips.length;
  const reduce = !!useReducedMotion();

  const [geo, setGeo] = useState<Geo>(() => geoFor(window.innerWidth, window.innerHeight));
  const [active, setActive] = useState(0);
  const [typeOn, setTypeOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState<ScreeningOpen | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [label, setLabel] = useState<"play" | "view" | null>(null);

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const geoRef = useRef(geo);
  const reduceRef = useRef(reduce);
  const readyRef = useRef(false);
  const pausedRef = useRef(false);
  const hoverRef = useRef(false);
  const posRef = useRef(0); // the row's position, in films (fractional while it moves)
  const targetRef = useRef(0);
  const activeRef = useRef(0);
  const heldRef = useRef(0); // ms the row has rested on this film
  const dragRef = useRef<{ x: number; pos: number; t: number; v: number; moved: boolean } | null>(null);
  const dirtyRef = useRef(true);

  useEffect(() => {
    geoRef.current = geo;
    dirtyRef.current = true;
  }, [geo]);
  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);
  useEffect(() => {
    pausedRef.current = !!project || menuOpen;
  }, [project, menuOpen]);

  // ---- moving the row ----
  const goTo = useCallback(
    (i: number) => {
      const cur = Math.round(targetRef.current);
      const k = (((i - cur) % N) + N) % N; // the shortest way round
      targetRef.current = cur + (k > N / 2 ? k - N : k);
      heldRef.current = 0;
    },
    [N]
  );
  const step = useCallback((d: number) => {
    if (!readyRef.current || pausedRef.current) return;
    targetRef.current = Math.round(targetRef.current) + d;
    heldRef.current = 0;
  }, []);

  // ---- the framed film ----
  const loadFilm = useCallback(
    (i: number) => {
      const v = videoRef.current;
      if (!v) return;
      const src = clips[i].src;
      if (v.dataset.src === src) return;
      v.dataset.src = src;
      v.poster = posterFor(src);
      v.src = src;
      v.play().catch(() => {});
    },
    [clips]
  );

  // ---- one loop: the entrance, the row, the frame ----
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      v.defaultMuted = true;
    }
    loadFilm(0);
    const t0 = performance.now();
    let raf = 0;
    let last = t0;
    let lastE = -1;
    let lastU = -1;
    let lastPos = NaN;
    let filmShown = -1;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = geoRef.current;
      const t = reduceRef.current ? 1e9 : now - t0;
      const e = easeCine(clamp01((t - T.open) / OPEN_MS)); // the logo opens into the frame
      const u = easeOut(clamp01((t - T.unfold) / UNFOLD_MS)); // the films unfold from behind it
      const dirty = dirtyRef.current;
      dirtyRef.current = false;

      // the frame: the logo, opening into the viewfinder
      const bw = LOGO_BOX.w + (g.w + 2 * g.m - LOGO_BOX.w) * e;
      const bh = LOGO_BOX.h + (g.h + 2 * g.m - LOGO_BOX.h) * e;
      if (e !== lastE || dirty) {
        const box = boxRef.current;
        if (box) {
          box.style.width = `${bw.toFixed(1)}px`;
          box.style.height = `${bh.toFixed(1)}px`;
          box.style.setProperty("--e", e.toFixed(4));
        }
        // the 16 | 9 sits inside the logo's corner, then steps below the frame
        if (tagRef.current) tagRef.current.style.transform = `translate3d(0, ${(-22 + 28 * e).toFixed(2)}px, 0)`;
      }

      // the row eases to its target (or follows a drag)
      const drag = dragRef.current;
      if (!drag) {
        posRef.current += (targetRef.current - posRef.current) * (1 - Math.exp(-dt * 5.5));
        if (Math.abs(targetRef.current - posRef.current) < 0.0005) posRef.current = targetRef.current;
      }
      const pos = posRef.current;
      const settled = !drag && Math.abs(targetRef.current - pos) < 0.004;

      // the projector advance
      if (readyRef.current && settled && !pausedRef.current && !hoverRef.current && !reduceRef.current) {
        heldRef.current += dt * 1000;
        if (heldRef.current >= HOLD_MS) {
          targetRef.current = Math.round(targetRef.current) + 1;
          heldRef.current = 0;
        }
      }

      const idx = ((Math.round(pos) % N) + N) % N;
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActive(idx);
        loadFilm(idx);
      }

      if (dirty || e !== lastE || u !== lastU || pos !== lastPos) {
        const R = g.vw * 0.42;
        const pitch = g.w + g.gap;
        cardRefs.current.forEach((el, i) => {
          if (!el) return;
          let d = (((i - pos) % N) + N) % N;
          if (d > N / 2) d -= N;
          const { x, s } = lens(d * pitch, R);
          const scale = 0.9 + (s - 0.9) * u;
          // the framed card waits for the frame to open; the rest wait to unfold
          const op = Math.abs(d) < 0.5 ? (e >= 1 ? 1 : 0) : u;
          el.style.transform = `translate3d(${(x * u).toFixed(2)}px, 0, 0) scale(${scale.toFixed(4)})`;
          el.style.opacity = op.toFixed(3);
          const z = String(100 - Math.round(Math.abs(d) * 2));
          if (el.style.zIndex !== z) el.style.zIndex = z;
        });
        lastPos = pos;
      }

      // the colour film sits on the framed card. While the logo opens it is
      // cropped to the inside of the logo; after that it shows once the row
      // comes to rest, and steps away the moment it moves.
      const film = filmRef.current;
      if (film) {
        if (e !== lastE || dirty) {
          const ix = Math.max(0, (g.w - (bw - 2 * g.m)) / 2);
          const iy = Math.max(0, (g.h - (bh - 2 * g.m)) / 2);
          film.style.clipPath = e < 1 ? `inset(${iy.toFixed(1)}px ${ix.toFixed(1)}px)` : "none";
        }
        const show = e > 0 && (e < 1 || settled) ? 1 : 0;
        if (show !== filmShown) {
          film.classList.toggle(styles.filmOn, show === 1);
          filmShown = show;
        }
      }
      lastE = e;
      lastU = u;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const timers = [
      window.setTimeout(() => setTypeOn(true), reduce ? 0 : T.type),
      window.setTimeout(
        () => {
          readyRef.current = true;
          setReady(true);
        },
        reduce ? 0 : T.ready
      ),
    ];
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the film rests under the player and the menu
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (project || menuOpen) v.pause();
    else v.play().catch(() => {});
  }, [project, menuOpen]);

  // ---- resize, wheel, keys ----
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setGeo(geoFor(window.innerWidth, window.innerHeight)));
    };
    // a trackpad keeps firing after a flick: hold the lock until it goes quiet
    let acc = 0;
    let accTimer = 0;
    let lockUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (pausedRef.current || !readyRef.current) return;
      const now = performance.now();
      if (now < lockUntil) {
        lockUntil = Math.max(lockUntil, now + 140);
        return;
      }
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      window.clearTimeout(accTimer);
      accTimer = window.setTimeout(() => (acc = 0), 200);
      if (Math.abs(acc) > 40) {
        step(acc > 0 ? 1 : -1);
        acc = 0;
        lockUntil = now + 600;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") step(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") step(-1);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(accTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [step]);

  // ---- the row under the pointer: drag to move it, click to open or to frame ----
  const openFilm = useCallback(() => {
    const g = geoRef.current;
    setProject({
      index: activeRef.current,
      // the row's frame, outer edge: the screening frame grows out of it
      from: { left: (g.vw - g.w) / 2 - g.m, top: g.cy - g.h / 2 - g.m, width: g.w + 2 * g.m, height: g.h + 2 * g.m },
      time: videoRef.current?.currentTime ?? 0,
    });
  }, []);

  const cardAt = (x: number, y: number) => {
    const el = document
      .elementsFromPoint(x, y)
      .find((n) => (n as HTMLElement).dataset?.card !== undefined) as HTMLElement | undefined;
    return el ? Number(el.dataset.card) : -1;
  };

  const onDown = (e: React.PointerEvent) => {
    if (!readyRef.current || pausedRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, pos: posRef.current, t: performance.now(), v: 0, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const cur = cursorRef.current;
    if (cur) cur.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    const d = dragRef.current;
    if (!d) {
      if (e.pointerType === "mouse" && readyRef.current) {
        const i = cardAt(e.clientX, e.clientY);
        const next = i < 0 ? null : i === activeRef.current ? "play" : "view";
        setLabel((l) => (l === next ? l : next));
      }
      return;
    }
    const g = geoRef.current;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      setLabel(null);
    }
    if (!d.moved) return;
    const now = performance.now();
    const next = d.pos - dx / (g.w + g.gap);
    d.v = 0.75 * d.v + 0.25 * (((next - posRef.current) / Math.max(1, now - d.t)) * 1000);
    d.t = now;
    posRef.current = next;
  };
  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.moved) {
      targetRef.current = Math.round(posRef.current + Math.max(-3, Math.min(3, d.v * 0.2)));
      heldRef.current = 0;
      return;
    }
    const i = cardAt(e.clientX, e.clientY);
    if (i < 0) return;
    if (i === activeRef.current && Math.abs(targetRef.current - posRef.current) < 0.01) openFilm();
    else goTo(i);
  };

  // ---- render ----
  const g = geo;
  const clip = clips[active];
  const band = g.h + 80; // the strip of page the row lives in
  const slot = { width: g.w, height: g.h, marginLeft: -g.w / 2, marginTop: -g.h / 2 } as CSSProperties;
  const rise = (i: number) => ({ "--i": i }) as CSSProperties;

  return (
    <section
      className={`${styles.root} ${typeOn ? styles.typeOn : ""} ${ready ? styles.ready : ""} ${g.small ? styles.small : ""}`}
      aria-label="Selected films"
    >
      <h1 className={styles.sr}>16x9, a film and video production house. {HEADLINE.join(" ")}.</h1>

      {/* ================= the row ================= */}
      <div
        className={styles.stage}
        style={{ top: g.cy - band / 2, height: band }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (dragRef.current = null)}
        onPointerEnter={() => (hoverRef.current = true)}
        onPointerLeave={() => {
          hoverRef.current = false;
          setLabel(null);
        }}
      >
        {clips.map((c, i) => (
          <div
            key={c.src + i}
            ref={(el) => void (cardRefs.current[i] = el)}
            className={styles.card}
            style={slot}
            data-card={i}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={grayPoster(c.src)} alt="" draggable={false} />
          </div>
        ))}

        {/* the framed film, in colour */}
        <div ref={filmRef} className={styles.film} style={slot} aria-hidden="true">
          <video ref={videoRef} muted loop playsInline preload="auto" />
        </div>
      </div>

      {/* ================= the frame: the logo, grown into a viewfinder ================= */}
      <div ref={boxRef} className={styles.frame} style={{ top: g.cy }} aria-hidden="true">
        <i className={styles.lineR} />
        <i className={styles.lineT} />
        <i className={styles.lineL} />
        <i className={styles.lineB} />
        <i className={styles.tick} />
        <div ref={tagRef} className={styles.tag}>
          <span className={styles.tag16}>16</span>
          <span className={styles.tag9}>9</span>
        </div>
      </div>

      {/* ================= the type ================= */}

      {/* the bar: logo (left), the studios (centred over the frame), the pages (right) */}
      <header className={styles.bar}>
        <Link href="/" className={`${styles.logo} ${styles.rise}`} style={rise(0)} aria-label="16x9 home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" />
        </Link>
        <nav className={`${styles.pages} ${styles.rise}`} style={rise(1)} aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={styles.link}>
              {n.label}
            </a>
          ))}
        </nav>
        <nav className={`${styles.studios} ${styles.rise}`} style={rise(2)} aria-label="Studios">
          {STUDIOS.map((s, i) => (
            <span key={s.label} className={styles.studio}>
              {s.here ? (
                <a href={s.href} className={`${styles.link} ${styles.here}`} aria-current="page">
                  {s.label}
                </a>
              ) : (
                <a
                  href={s.href}
                  className={styles.link}
                  {...(s.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  {s.label}
                  <Out />
                </a>
              )}
              {i < STUDIOS.length - 1 ? <span className={styles.slash}>/</span> : null}
            </span>
          ))}
        </nav>
        <button
          type="button"
          className={`${styles.menuBtn} ${styles.link} ${styles.rise}`}
          style={rise(3)}
          onClick={() => setMenuOpen(true)}
          disabled={!ready}
          aria-expanded={menuOpen}
        >
          Menu
        </button>
      </header>

      {/* the line, centred just above the frame */}
      <p className={styles.headline} style={{ top: g.cy - g.h / 2 - g.m - (g.small ? 28 : 36) }}>
        {HEADLINE.map((l, i) => (
          <span key={l} className={styles.mask}>
            <span className={styles.riseLine} style={rise(i)}>
              {l}
            </span>
          </span>
        ))}
      </p>

      {/* under the frame: the framed film */}
      <div className={`${styles.caption} ${styles.rise}`} style={{ top: g.cy + g.h / 2 + g.m + 44, ...rise(4) }}>
        <p className={styles.captionTitle}>
          <Swap k={active}>{clip.title}</Swap>
        </p>
        <p className={styles.captionMeta}>
          <Swap k={active}>
            {CATEGORY[active % CATEGORY.length]}
            <span className={styles.dot} aria-hidden="true" />
            {SERVICES[active % SERVICES.length]}
          </Swap>
        </p>
      </div>
      <p className={styles.sr} aria-live="polite">
        Film {active + 1} of {N}: {clip.title}
      </p>

      {/* the foot: how to move, and the count on phones */}
      <div className={`${styles.hint} ${styles.rise}`} style={rise(7)}>
        <p>{g.small ? "Swipe to browse" : "Scroll, drag or use the arrow keys"}</p>
        <p className={styles.footCount}>
          <Swap k={active}>{pad2(active + 1)}</Swap>
          <span className={styles.mute}>/{pad2(N)}</span>
        </p>
        <p className={`${styles.mute} ${styles.copy}`}>&copy; 2026 16x9</p>
      </div>

      {/* the word that follows the cursor over the row */}
      <div ref={cursorRef} className={styles.cursor} aria-hidden="true">
        <AnimatePresence>
          {label && (
            <motion.span
              key={label}
              className={styles.cursorPill}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.35, ease: EASE } }}
              exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
            >
              {label === "play" ? "Play" : "View"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <Menu open={menuOpen} reduce={reduce} onClose={() => setMenuOpen(false)} />
      <AnimatePresence>
        {project && (
          <Screening
            key="screening"
            clips={clips}
            open={project}
            category={(i) => CATEGORY[i % CATEGORY.length]}
            services={(i) => SERVICES[i % SERVICES.length]}
            onClose={(i) => {
              setProject(null);
              goTo(i); // the row comes back on the film you were watching
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
