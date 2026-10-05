"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "../hero7/project-view";
import { posterFor } from "../hero7/wall-playback";
import Drawer from "../hero11/drawer";
import { MirageGL } from "./mirage-gl";
import styles from "./hero20.module.css";

// ===========================================================================
// HERO 20 — "Mirage".
//
// Dubai heat as the medium. The film runs above a horizon line; below it the
// road holds the film's mirage, upside down and rippling, the way a hot road
// mirrors the sky. "Stories beyond the frame" floats on the horizon and its
// reflection wavers beneath it. Everything is seen through rising heat, and
// where you look (the cursor; on phones, the touch or a slow wandering gaze)
// the air clears.
//
// ENTRANCE: white-out glare, like stepping into the midday sun. It cools,
// the haze settles, the scene comes through, the line rises out of the
// shimmer, the horizon draws across, the type arrives.
// CUTS: every few seconds a wave of heat rolls through, the glare flares, and
// the next film melts out of the shimmer. Scroll, swipe or the arrow keys
// cut too. Click the film to open it.
//
// The picture is one WebGL shader (mirage-gl.ts) on one or two playing
// videos. Without WebGL the films simply play, full bleed.
// ===========================================================================

// ---------------------------------------------------------------- copy ----
const HEADLINE = ["Stories beyond", "the frame"];
const PLACE = "Dubai, 25.20° N 55.27° E";
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

// -------------------------------------------------------------- timing ----
const SHOT_MS = 7000; // a film holds this long before the heat takes it
const CUT_MS = 1800; // the wave of heat between two films
const COOL_MS = 2600; // the opening glare cooling to the scene
const T = { text: 1100, line: 1700, type: 2200, ready: 2800 }; // ms from load
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Geo = { vw: number; vh: number; small: boolean; horizon: number };
const geoFor = (vw: number, vh: number): Geo => {
  const small = vw < 760 || vw < vh * 0.8;
  return { vw, vh, small, horizon: small ? 0.56 : 0.62 };
};

/** A line that rolls up to its next value. */
function Swap({ k, children }: { k: number; children: ReactNode }) {
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={k}
          className={styles.swapIn}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1, transition: { duration: 0.7, ease: EASE, delay: 0.3 } }}
          exit={{ y: "-100%", opacity: 0, transition: { duration: 0.35, ease: EASE_CINE } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

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

const Out = () => (
  <svg className={styles.out} viewBox="0 0 10 10" aria-hidden="true">
    <path d="M2.5 7.5l5-5M3.5 2.5h4v4" fill="none" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);

// ---------------------------------------------------------------- hero ----
const noopSubscribe = () => () => {};
export default function Hero20({ variantId }: { variantId?: string }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const variant = useMemo<HeroVariant | null>(
    () =>
      isClient
        ? resolveVariant(new Date(), variantId ?? new URLSearchParams(window.location.search).get("hero"))
        : null,
    [isClient, variantId]
  );
  if (!variant) return <section className={styles.root} aria-hidden="true" />;
  return <Mirage key={variant.id} variant={variant} />;
}

type Slot = { video: HTMLVideoElement | null; poster: HTMLImageElement | null; posterUp: boolean; aspect: number; lastT: number };

function Mirage({ variant }: { variant: HeroVariant }) {
  const clips = variant.clips;
  const N = clips.length;
  const reduce = !!useReducedMotion();

  const [geo, setGeo] = useState<Geo>(() => geoFor(window.innerWidth, window.innerHeight));
  const [index, setIndex] = useState(0);
  const [typeOn, setTypeOn] = useState(false);
  const [lineOn, setLineOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [project, setProject] = useState<OpenProject | null>(null);

  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vidRefs = useRef<(HTMLVideoElement | null)[]>([null, null]);
  const geoRef = useRef(geo);
  const reduceRef = useRef(reduce);
  const readyRef = useRef(false);
  const pausedRef = useRef(false);
  const indexRef = useRef(0);
  const curRef = useRef<0 | 1>(0);
  const cutRef = useRef<{ t0: number; next: number } | null>(null);
  const elapsedRef = useRef(0);
  const gazeRef = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, last: -1e9, touch: false });
  const slotsRef = useRef<Slot[]>([
    { video: null, poster: null, posterUp: false, aspect: 16 / 9, lastT: -1 },
    { video: null, poster: null, posterUp: false, aspect: 16 / 9, lastT: -1 },
  ]);
  const redrawTextRef = useRef<() => void>(() => {});
  const scaleRef = useRef(1); // render scale: drops on devices that can't keep up

  useEffect(() => {
    geoRef.current = geo;
  }, [geo]);
  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);
  useEffect(() => {
    pausedRef.current = menuOpen || !!project;
  }, [menuOpen, project]);

  // ---- films ----
  const load = useCallback(
    (i: 0 | 1, film: number) => {
      const s = slotsRef.current[i];
      const v = vidRefs.current[i];
      if (!v) return;
      s.video = v;
      const src = clips[film].src;
      if (v.dataset.src === src) return;
      v.dataset.src = src;
      v.src = src;
      s.lastT = -1;
      s.posterUp = false;
      const img = new Image();
      img.decoding = "async";
      img.src = posterFor(src);
      img.onload = () => {
        if (s.poster === img) s.aspect = img.naturalWidth / img.naturalHeight || 16 / 9;
      };
      s.poster = img;
      v.onloadedmetadata = () => {
        if (v.videoWidth) s.aspect = v.videoWidth / v.videoHeight;
      };
    },
    [clips]
  );

  const cut = useCallback(
    (d: number) => {
      if (!readyRef.current || pausedRef.current || cutRef.current) return;
      const next = (indexRef.current + d + N) % N;
      const other = curRef.current === 0 ? 1 : 0;
      load(other, next);
      const v = vidRefs.current[other];
      if (v) {
        try {
          v.currentTime = 0;
        } catch {}
        v.play().catch(() => {});
      }
      indexRef.current = next;
      setIndex(next);
      cutRef.current = { t0: performance.now(), next };
      elapsedRef.current = 0;
    },
    [N, load]
  );
  const cutRef2 = useRef(cut);
  useEffect(() => {
    cutRef2.current = cut;
  }, [cut]);

  // ---- the renderer, the text texture, the loop ----
  useEffect(() => {
    vidRefs.current.forEach((v) => {
      if (!v) return;
      v.muted = true;
      v.defaultMuted = true;
    });
    load(0, 0);
    vidRefs.current[0]?.play().catch(() => {});
    const preload = window.setTimeout(() => load(1, 1 % N), 1500);

    const canvas = canvasRef.current!;
    const gl = MirageGL.create(canvas);
    if (!gl) setNoGL(true);

    // the headline, drawn white into its own texture, so the heat bends it too
    const textCanvas = document.createElement("canvas");
    const drawText = () => {
      if (!gl) return;
      const g = geoRef.current;
      // the haze is soft, so this is plenty; slower devices drop further (see the loop)
      const dpr = Math.min(window.devicePixelRatio || 1, g.small ? 1.5 : 1.25) * scaleRef.current;
      const W = Math.round(g.vw * dpr);
      const H = Math.round(g.vh * dpr);
      gl.resize(W, H);
      textCanvas.width = W;
      textCanvas.height = H;
      const ctx = textCanvas.getContext("2d")!;
      ctx.clearRect(0, 0, W, H);
      const fam = getComputedStyle(rootRef.current ?? document.body).fontFamily;
      const fs = (g.small ? g.vw * 0.082 : Math.min(84, Math.max(34, g.vw * 0.036))) * dpr;
      ctx.font = `300 ${fs}px ${fam}`;
      const c2 = ctx as CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };
      if ("fontStretch" in c2) c2.fontStretch = "semi-expanded";
      if ("letterSpacing" in c2) c2.letterSpacing = `${(-0.025 * fs).toFixed(1)}px`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const lines = g.small ? HEADLINE.map((l) => l.toUpperCase()) : [HEADLINE.join(" ").toUpperCase()];
      const base = g.horizon * H - fs * 0.2; // the last line sits just on the horizon
      const lead = fs * 0.98;
      lines.forEach((l, i) => ctx.fillText(l, W / 2, base - (lines.length - 1 - i) * lead));
      gl.uploadText(textCanvas);
    };
    redrawTextRef.current = drawText;
    drawText();
    document.fonts?.ready.then(drawText).catch(() => {});

    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    let ema = 1 / 60; // smoothed frame time
    let checkAt = t0 + 4000;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = geoRef.current;
      const rm = reduceRef.current;
      const since = now - t0;

      // keep it smooth: if frames run long, render the heat at a lower resolution
      ema = ema * 0.92 + dt * 0.08;
      if (now > checkAt && gl && !document.hidden) {
        checkAt = now + 1200;
        if (ema > 1 / 48 && scaleRef.current > 0.5) {
          scaleRef.current = Math.max(0.5, scaleRef.current * 0.8);
          drawText();
        }
      }

      // the opening: white-out cooling to the scene, heat settling
      const cool = rm ? 1 : easeInOut(clamp01((since - 250) / COOL_MS));
      let expo = 1 - cool;
      const haze = rm ? 0.3 : 1 + 2.4 * (1 - cool);
      const textIn = rm ? 1 : smooth(T.text, T.text + 1500, since);

      // a cut: the heat surges, the glare flares, the next film melts in
      let wave = 0;
      let mix = 0;
      const c = cutRef.current;
      if (c) {
        const p = rm ? 1 : clamp01((now - c.t0) / CUT_MS);
        wave = Math.sin(Math.PI * p);
        mix = smooth(0.3, 0.72, p);
        expo += 0.32 * Math.pow(Math.sin(Math.PI * p), 2);
        if (p >= 1) {
          const old = curRef.current;
          vidRefs.current[old]?.pause();
          curRef.current = old === 0 ? 1 : 0;
          cutRef.current = null;
          mix = 0;
          wave = 0;
          // the free slot quietly loads the film after this one
          window.setTimeout(() => {
            if (!cutRef.current) load(old, (indexRef.current + 1) % N);
          }, 600);
        }
      } else if (readyRef.current && !pausedRef.current && !rm) {
        elapsedRef.current += dt * 1000;
        if (elapsedRef.current >= SHOT_MS) cutRef2.current(1);
      }

      // the gaze: the pointer, or a slow wander along the horizon
      const gz = gazeRef.current;
      if (now - gz.last > 2600) {
        const tt = since / 1000;
        gz.tx = 0.5 + 0.3 * Math.sin(tt * 0.21);
        gz.ty = g.horizon - 0.1 + 0.06 * Math.sin(tt * 0.33);
      }
      const k = 1 - Math.exp(-dt * 4);
      gz.x += (gz.tx - gz.x) * k;
      gz.y += (gz.ty - gz.y) * k;

      if (gl && !pausedRef.current) {
        // new frames in (only the slots that are showing)
        const cur = curRef.current;
        const live: (0 | 1)[] = c ? [cur, cur === 0 ? 1 : 0] : [cur];
        live.forEach((i) => {
          const s = slotsRef.current[i];
          const v = s.video;
          if (v && v.readyState >= 2) {
            if (v.currentTime !== s.lastT) {
              gl.upload(i, v);
              s.lastT = v.currentTime;
            }
          } else if (s.poster && s.poster.complete && s.poster.naturalWidth && !s.posterUp) {
            gl.upload(i, s.poster);
            s.posterUp = true;
          }
        });
        const other = cur === 0 ? 1 : 0;
        gl.draw(
          {
            time: since / 1000,
            mix,
            horizon: g.horizon,
            expo,
            haze,
            wave,
            textIn,
            clear: rm ? 0 : 0.95,
            gx: gz.x,
            gy: gz.y,
            a0: slotsRef.current[cur].aspect,
            a1: slotsRef.current[other].aspect,
          },
          cur
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const timers = [
      window.setTimeout(() => setLineOn(true), reduce ? 0 : T.line),
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
      window.clearTimeout(preload);
      timers.forEach(clearTimeout);
      gl?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw the headline when the screen changes
  useEffect(() => {
    redrawTextRef.current();
  }, [geo]);

  // the film rests under the menu and the player
  useEffect(() => {
    const v = vidRefs.current[curRef.current];
    if (!v) return;
    if (menuOpen || project) v.pause();
    else v.play().catch(() => {});
  }, [menuOpen, project]);

  // ---- resize, wheel, keys, the gaze ----
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setGeo(geoFor(window.innerWidth, window.innerHeight)));
    };
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
        cutRef2.current(acc > 0 ? 1 : -1);
        acc = 0;
        lockUntil = now + CUT_MS;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") cutRef2.current(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") cutRef2.current(-1);
    };
    const onPointer = (e: PointerEvent) => {
      const g = geoRef.current;
      const gz = gazeRef.current;
      gz.tx = e.clientX / g.vw;
      gz.ty = e.clientY / g.vh;
      gz.last = performance.now();
      gz.touch = e.pointerType !== "mouse";
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(accTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  // ---- the stage: tap to open, swipe to cut ----
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const openFilm = useCallback(() => {
    if (!readyRef.current || pausedRef.current) return;
    const g = geoRef.current;
    const v = vidRefs.current[curRef.current];
    setProject({
      index: indexRef.current,
      rect: { left: 0, top: 0, width: g.vw, height: g.vh * g.horizon },
      time: v?.currentTime ?? 0,
    });
  }, []);
  const onDown = (e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const d = downRef.current;
    downRef.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 44) cutRef2.current((Math.abs(dx) > Math.abs(dy) ? dx : dy) < 0 ? 1 : -1);
    else if (dist < 10) openFilm();
  };

  // ---- render ----
  const g = geo;
  const clip = clips[index];
  const hy = g.horizon * g.vh;
  const rise = (i: number) => ({ "--i": i }) as CSSProperties;

  return (
    <section
      ref={rootRef}
      className={`${styles.root} ${typeOn ? styles.typeOn : ""} ${lineOn ? styles.lineOn : ""} ${g.small ? styles.small : ""} ${noGL ? styles.noGL : ""}`}
      aria-label="Showreel"
    >
      <h1 className={styles.sr}>16x9, a film and video production house in Dubai. {HEADLINE.join(" ")}.</h1>

      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {/* the films feed the shader; without WebGL they are shown as they are */}
      <div className={styles.films} aria-hidden="true">
        {[0, 1].map((i) => (
          <video
            key={i}
            ref={(el) => void (vidRefs.current[i] = el)}
            className={`${styles.video} ${noGL && i === 0 ? styles.videoOn : ""}`}
            muted
            loop
            playsInline
            preload="auto"
          />
        ))}
      </div>

      <div
        className={styles.stage}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (downRef.current = null)}
        aria-hidden="true"
      />

      {/* ================= the bar ================= */}
      <header className={styles.bar}>
        <Link href="/" className={`${styles.logo} ${styles.rise}`} style={rise(0)} aria-label="16x9 home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" />
        </Link>
        <nav className={`${styles.studios} ${styles.rise}`} style={rise(1)} aria-label="Studios">
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
        <nav className={`${styles.pages} ${styles.rise}`} style={rise(2)} aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={styles.link}>
              {n.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className={`${styles.menuBtn} ${styles.link} ${styles.rise}`}
          style={rise(2)}
          onClick={() => setMenuOpen(true)}
          disabled={!ready}
          aria-expanded={menuOpen}
        >
          Menu
        </button>
      </header>

      {/* ================= the horizon ================= */}
      <div className={styles.horizon} style={{ top: hy }} aria-hidden="true" />
      <p className={`${styles.place} ${styles.rise}`} style={{ top: hy, ...rise(3) }}>
        {PLACE}
      </p>
      <p className={`${styles.now} ${styles.rise}`} style={{ top: hy, ...rise(4) }}>
        <Swap k={index}>{clip.title}</Swap>
        <span className={styles.count}>
          <Swap k={index}>{pad2(index + 1)}</Swap>
          <span className={styles.mute}>/{pad2(N)}</span>
        </span>
      </p>
      <p className={styles.sr} aria-live="polite">
        Film {index + 1} of {N}: {clip.title}
      </p>

      {/* ================= the foot ================= */}
      <div className={`${styles.foot} ${styles.rise}`} style={rise(6)}>
        <p>{g.small ? "Touch to clear the heat" : "Look closer, the heat clears"}</p>
        <button type="button" className={styles.link} onClick={openFilm}>
          Play the film
        </button>
      </div>

      <Menu open={menuOpen} reduce={reduce} onClose={() => setMenuOpen(false)} />
      <AnimatePresence>
        {project && <ProjectView key="project" clips={clips} open={project} onClose={() => setProject(null)} />}
      </AnimatePresence>
    </section>
  );
}
