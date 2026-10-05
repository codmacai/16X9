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
import ProjectView, { type OpenProject } from "../hero7/project-view";
import { posterFor } from "../hero7/wall-playback";
import Drawer from "../hero11/drawer";
import styles from "./hero20.module.css";

// ===========================================================================
// HERO 20 — "Viewfinder". You're the director.
//
// A quiet paper page: the line, one small line under it, the bar, the foot.
// The films are there all along, hidden under the paper. Your cursor is a
// camera viewfinder, the 16x9 logo's rectangle with "16 | 9" at its corner,
// and wherever you point it you see through the page: the film plays inside
// it, and the type turns white where it passes. It swings a little as you
// move, like a camera in the hand.
//
// Click to shoot: a flash, a shutter, and the frame you took flies into one
// of three slots at the foot. Three shots and it's a wrap: roll the reel.
//
// ENTRANCE: the viewfinder draws itself in the middle of the page, the camera
// comes on (the film, REC, the timecode), the line rises through it, then the
// rest of the page. After that it follows you. Left alone, it wanders.
// Phones: drag to frame, tap to shoot.
// ===========================================================================

// ---------------------------------------------------------------- copy ----
const HEADLINE = ["Stories beyond", "the frame"];
const SUB = "Film & video production, Dubai";
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
const SHOTS = 3; // shots to a wrap

// -------------------------------------------------------------- timing ----
const FILM_MS = 9000; // the film under the page changes this often
const IDLE_MS = 4500; // after this long without the pointer, the viewfinder wanders
const T = { film: 1000, head: 1250, ui: 1900, ready: 2400 }; // ms from load (the frame draws from 0)
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");
/** hh:mm:ss:ff at 25 fps */
const timecode = (s: number) => {
  const t = Math.max(0, s || 0);
  return `00:${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}:${pad2(Math.floor((t % 1) * 25))}`;
};

type Geo = { vw: number; vh: number; small: boolean; w: number; h: number; home: { x: number; y: number } };
const geoFor = (vw: number, vh: number): Geo => {
  const small = vw < 760 || vw < vh * 0.8;
  const w = small ? Math.min(vw * 0.62, 300) : Math.min(Math.max(vw * 0.21, 230), 360);
  return { vw, vh, small, w, h: (w * 9) / 16, home: { x: vw / 2, y: vh * (small ? 0.44 : 0.45) } };
};

/** A frame you took: where it flies from (relative to its slot) and the film it came from. */
type Shot = {
  id: number;
  still: HTMLCanvasElement | null; // the frame itself (no encoding, so the shutter never stutters)
  poster: string; // used if the film had no frame to grab yet
  film: number;
  time: number;
  fly: { x: number; y: number; s: number; r: number };
  tilt: number;
};

/** A soft mechanical shutter, made on the spot (no audio file). */
function shutter(ctx: AudioContext) {
  const click = (at: number, gain: number, freq: number) => {
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(ctx.currentTime + at);
  };
  click(0, 0.5, 2600);
  click(0.075, 0.32, 1700);
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

/** The line and the line under it. Set twice: in ink on the page, in white inside the viewfinder. */
function Words({ white }: { white?: boolean }) {
  return (
    <div className={`${styles.words} ${white ? styles.wordsWhite : ""}`} aria-hidden="true">
      <p className={styles.headline}>
        {HEADLINE.map((l, i) => (
          <span key={l} className={styles.mask}>
            <span className={styles.riseLine} style={{ "--i": i } as CSSProperties}>
              {l}
            </span>
          </span>
        ))}
      </p>
      <p className={styles.sub}>{SUB}</p>
    </div>
  );
}

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
  return <Viewfinder key={variant.id} variant={variant} />;
}

function Viewfinder({ variant }: { variant: HeroVariant }) {
  const clips = variant.clips;
  const N = clips.length;
  const reduce = !!useReducedMotion();

  const [geo, setGeo] = useState<Geo>(() => geoFor(window.innerWidth, window.innerHeight));
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState(0); // 0 drawing, 1 camera on, 2 line, 3 page, 4 ready
  const [shots, setShots] = useState<Shot[]>([]);
  const [sound, setSound] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [project, setProject] = useState<OpenProject | null>(null);

  const rootRef = useRef<HTMLElement>(null);
  const vfRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const vidRefs = useRef<(HTMLVideoElement | null)[]>([null, null]);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const frontRef = useRef(0);
  const indexRef = useRef(0);
  const geoRef = useRef(geo);
  const readyRef = useRef(false);
  const pausedRef = useRef(false);
  const reduceRef = useRef(reduce);
  const shotsRef = useRef<Shot[]>([]);
  const soundRef = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);
  const idRef = useRef(0);
  // the viewfinder's spring: where it is, where it's going, how it leans
  const camRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, r: 0, last: -1e9 });

  useEffect(() => {
    geoRef.current = geo;
  }, [geo]);
  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);
  useEffect(() => {
    pausedRef.current = menuOpen || !!project;
  }, [menuOpen, project]);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // ---- the films under the page ----
  const load = useCallback(
    (slot: number, film: number) => {
      const v = vidRefs.current[slot];
      if (!v) return;
      const src = clips[film].src;
      if (v.dataset.src === src) return;
      v.dataset.src = src;
      v.poster = posterFor(src);
      v.src = src;
    },
    [clips]
  );

  // ---- the entrance, the film rotation ----
  useEffect(() => {
    const g = geoRef.current;
    const cam = camRef.current;
    cam.x = cam.tx = g.home.x;
    cam.y = cam.ty = g.home.y;
    vidRefs.current.forEach((v) => {
      if (!v) return;
      v.muted = true;
      v.defaultMuted = true;
    });
    load(0, 0);
    vidRefs.current[0]?.play().catch(() => {});
    const preload = window.setTimeout(() => load(1, 1 % N), 1800);
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, reduce ? 0 : ms);
    const timers = [
      at(T.film, () => setStage(1)),
      at(T.head, () => setStage(2)),
      at(T.ui, () => setStage(3)),
      at(T.ready, () => {
        readyRef.current = true;
        setStage(4);
      }),
    ];

    // the next film, every so often, crossfaded under the page
    const turn = window.setInterval(() => {
      if (pausedRef.current || reduceRef.current || !readyRef.current) return;
      const next = (indexRef.current + 1) % N;
      const back = frontRef.current === 0 ? 1 : 0;
      load(back, next);
      const v = vidRefs.current[back];
      if (!v) return;
      try {
        v.currentTime = 0;
      } catch {}
      v.play().catch(() => {});
      const old = frontRef.current;
      frontRef.current = back;
      vidRefs.current[back]?.classList.add(styles.filmFront);
      vidRefs.current[old]?.classList.remove(styles.filmFront);
      window.setTimeout(() => {
        vidRefs.current[old]?.pause();
        load(old, (next + 1) % N);
      }, 1000);
      indexRef.current = next;
      setIndex(next);
    }, FILM_MS);

    return () => {
      timers.forEach(clearTimeout);
      window.clearTimeout(preload);
      window.clearInterval(turn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the films rest under the menu and the player
  useEffect(() => {
    const v = vidRefs.current[frontRef.current];
    if (!v) return;
    if (menuOpen || project) v.pause();
    else v.play().catch(() => {});
  }, [menuOpen, project]);

  // ---- the viewfinder follows: a spring, a lean, a wander when left alone ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const g = geoRef.current;
      const cam = camRef.current;
      if (readyRef.current && now - cam.last > IDLE_MS) {
        const t = (now - t0) / 1000;
        cam.tx = g.home.x + g.vw * (g.small ? 0.1 : 0.18) * Math.sin(t * 0.31);
        cam.ty = g.home.y + g.vh * 0.06 * Math.sin(t * 0.53);
      }
      // it stays on the page: between the bar and the foot, with room for its 9
      cam.tx = Math.min(Math.max(cam.tx, g.w / 2 + 8), g.vw - g.w / 2 - 28);
      cam.ty = Math.min(Math.max(cam.ty, g.h / 2 + (g.small ? 64 : 80)), g.vh - g.h / 2 - (g.small ? 190 : 120));
      if (reduceRef.current) {
        cam.x = cam.tx;
        cam.y = cam.ty;
        cam.r = 0;
      } else {
        const k = 140;
        const c = 2 * Math.sqrt(k) * 0.82; // a touch under critical: it settles with weight
        cam.vx += (k * (cam.tx - cam.x) - c * cam.vx) * dt;
        cam.vy += (k * (cam.ty - cam.y) - c * cam.vy) * dt;
        cam.x += cam.vx * dt;
        cam.y += cam.vy * dt;
        const lean = Math.max(-6, Math.min(6, cam.vx * 0.006));
        cam.r += (lean - cam.r) * Math.min(1, dt * 10);
      }
      const vf = vfRef.current;
      const inner = innerRef.current;
      if (vf && inner) {
        vf.style.transform = `translate3d(${(cam.x - g.w / 2).toFixed(2)}px, ${(cam.y - g.h / 2).toFixed(2)}px, 0) rotate(${cam.r.toFixed(3)}deg)`;
        // the page inside the window stays put: the exact inverse of the window's move
        inner.style.transform = `translate(${(g.w / 2).toFixed(2)}px, ${(g.h / 2).toFixed(2)}px) rotate(${(-cam.r).toFixed(3)}deg) translate(${(-cam.x).toFixed(2)}px, ${(-cam.y).toFixed(2)}px)`;
      }
      const v = vidRefs.current[frontRef.current];
      if (tcRef.current && v) tcRef.current.textContent = timecode(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- resize ----
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setGeo(geoFor(window.innerWidth, window.innerHeight)));
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ---- opening films ----
  const openFilm = useCallback((film: number, rect: OpenProject["rect"], time: number) => {
    setProject({ index: film, rect, time });
  }, []);

  const rollReel = useCallback(() => {
    const first = shotsRef.current[0];
    const el = slotRefs.current[0];
    if (!first || !el) return;
    const r = el.getBoundingClientRect();
    openFilm(first.film, { left: r.left, top: r.top, width: r.width, height: r.height }, first.time);
  }, [openFilm]);

  // ---- shooting ----
  const shoot = useCallback(() => {
    if (!readyRef.current || pausedRef.current) return;
    if (shotsRef.current.length >= SHOTS) {
      rollReel();
      return;
    }
    const g = geoRef.current;
    const cam = camRef.current;
    const v = vidRefs.current[frontRef.current];

    // the flash, and the shutter
    flashRef.current?.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    vfRef.current?.animate([{ scale: "1" }, { scale: "0.94" }, { scale: "1" }], {
      duration: 360,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
    if (soundRef.current && audioRef.current) {
      try {
        if (audioRef.current.state === "suspended") audioRef.current.resume().catch(() => {});
        shutter(audioRef.current);
      } catch {}
    }

    // the frame: exactly what was in the window (the film is laid out object-fit: cover on the page)
    let still: HTMLCanvasElement | null = null;
    if (v && v.readyState >= 2 && v.videoWidth) {
      const s = Math.max(g.vw / v.videoWidth, g.vh / v.videoHeight);
      const ox = (g.vw - v.videoWidth * s) / 2;
      const oy = (g.vh - v.videoHeight * s) / 2;
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 180;
      try {
        c.getContext("2d")!.drawImage(v, (cam.x - g.w / 2 - ox) / s, (cam.y - g.h / 2 - oy) / s, g.w / s, g.h / s, 0, 0, 320, 180);
        still = c;
      } catch {}
    }
    // it flies from the window to the next free slot
    const r = slotRefs.current[shotsRef.current.length]?.getBoundingClientRect();
    const shot: Shot = {
      id: ++idRef.current,
      still,
      poster: posterFor(clips[indexRef.current].src),
      film: indexRef.current,
      time: v?.currentTime ?? 0,
      fly: r
        ? { x: cam.x - g.w / 2 - r.left, y: cam.y - g.h / 2 - r.top, s: g.w / r.width, r: cam.r }
        : { x: 0, y: 0, s: 1, r: 0 },
      tilt: (Math.random() - 0.5) * 5,
    };
    // the flash paints first; the shot arrives on the next frame
    requestAnimationFrame(() => setShots((s) => [...s, shot]));
  }, [clips, rollReel]);

  // the shutter's audio is set up ahead of time (it starts silent until the first click)
  useEffect(() => {
    if (stage < 4 || audioRef.current) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioRef.current = new AC();
    } catch {}
  }, [stage]);
  useEffect(() => () => void audioRef.current?.close().catch(() => {}), []);

  // ---- the pointer ----
  const downRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const aim = (x: number, y: number) => {
    const cam = camRef.current;
    cam.tx = x;
    cam.ty = y;
    cam.last = performance.now();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!readyRef.current) return;
    const d = downRef.current;
    if (e.pointerType === "mouse") aim(e.clientX, e.clientY);
    else if (d) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true;
      aim(e.clientX, e.clientY - geoRef.current.h * 0.75); // above the thumb, so you can see it
    }
  };
  const onDown = (e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onUp = (e: React.PointerEvent) => {
    const d = downRef.current;
    downRef.current = null;
    if (!d || !readyRef.current) return;
    if (e.pointerType === "mouse" || !d.moved) shoot();
  };

  // keys: Enter or Space shoots (when nothing else has focus)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "button" || tag === "a" || tag === "input") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        shoot();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shoot]);

  // ---- render ----
  const g = geo;
  const clip = clips[index];
  const wrapped = shots.length >= SHOTS;
  const rise = (i: number) => ({ "--i": i }) as CSSProperties;
  const cls = [
    styles.root,
    stage >= 1 ? styles.camOn : "",
    stage >= 2 ? styles.headOn : "",
    stage >= 3 ? styles.uiOn : "",
    stage >= 4 ? styles.ready : "",
    g.small ? styles.small : "",
    wrapped ? styles.wrapped : "",
  ].join(" ");

  return (
    <section ref={rootRef} className={cls} aria-label="16x9">
      <h1 className={styles.sr}>16x9, a film and video production house in Dubai. {HEADLINE.join(" ")}.</h1>

      {/* the page, in ink */}
      <Words />

      {/* the stage: the whole page is the camera's field */}
      <div
        className={styles.stage}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (downRef.current = null)}
        aria-hidden="true"
      />

      {/* ================= the viewfinder ================= */}
      <div ref={vfRef} className={styles.vf} style={{ width: g.w, height: g.h }} aria-hidden="true">
        <div className={styles.window}>
          {/* the page as the camera sees it: the film, and the type in white */}
          <div ref={innerRef} className={styles.inner} style={{ width: g.vw, height: g.vh }}>
            {[0, 1].map((i) => (
              <video
                key={i}
                ref={(el) => void (vidRefs.current[i] = el)}
                className={`${styles.film} ${i === 0 ? styles.filmFront : ""}`}
                muted
                loop
                playsInline
                preload="auto"
              />
            ))}
            <div className={styles.innerShade} />
            <Words white />
          </div>
          <div ref={flashRef} className={styles.flash} />
          <div className={styles.hud}>
            <span className={styles.rec}>
              <i /> Rec
            </span>
            <span className={styles.hudTitle}>{wrapped ? "That's a wrap" : clip.title}</span>
            <span ref={tcRef} className={styles.tc}>
              00:00:00:00
            </span>
            <span className={styles.hudShots}>
              {wrapped ? "Click to roll" : `Shot ${Math.min(shots.length + 1, SHOTS)}/${SHOTS}`}
            </span>
            <span className={styles.cross} />
          </div>
        </div>
        {/* the logo's rectangle, drawn: up the right, along the top, down the left, along the foot */}
        <i className={styles.lineR} />
        <i className={styles.lineT} />
        <i className={styles.lineL} />
        <i className={styles.lineB} />
        <i className={styles.tick} />
        <span className={styles.tag}>
          <span>16</span>
          <span>9</span>
        </span>
      </div>

      {/* ================= the bar ================= */}
      <header className={styles.bar} data-ui>
        <Link href="/" className={`${styles.logo} ${styles.rise}`} style={rise(0)} aria-label="16x9 home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" />
        </Link>
        <nav className={`${styles.studios} ${styles.rise}`} style={rise(1)} aria-label="Studios">
          {STUDIOS.map((s, i) => (
            <span key={s.label}>
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
          aria-expanded={menuOpen}
        >
          Menu
        </button>
      </header>

      {/* ================= the foot: how to play, the three shots, sound ================= */}
      <footer className={styles.foot} data-ui>
        <p className={`${styles.hint} ${styles.rise}`} style={rise(3)}>
          {wrapped ? "That's a wrap" : g.small ? "Drag to frame, tap to shoot" : "Move to frame, click to shoot"}
        </p>

        <div className={`${styles.reel} ${styles.rise}`} style={rise(4)}>
          <div className={styles.slots}>
            {Array.from({ length: SHOTS }, (_, i) => {
              const s = shots[i];
              return (
                <div key={i} ref={(el) => void (slotRefs.current[i] = el)} className={styles.slot}>
                  <span className={styles.slotNo}>{pad2(i + 1)}</span>
                  {s && <ShotCard shot={s} onOpen={openFilm} reduce={reduce} />}
                </div>
              );
            })}
          </div>
          <AnimatePresence>
            {wrapped && (
              <motion.div
                className={styles.wrap}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE, delay: 0.9 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <button type="button" className={`${styles.link} ${styles.roll}`} onClick={rollReel}>
                  Roll the reel
                </button>
                <button type="button" className={`${styles.link} ${styles.mute}`} onClick={() => setShots([])}>
                  Reshoot
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={`${styles.footEnd} ${styles.rise}`} style={rise(5)}>
          <button type="button" className={styles.link} onClick={() => setSound((s) => !s)} aria-pressed={sound}>
            Sound {sound ? "on" : "off"}
          </button>
          <button type="button" className={`${styles.link} ${styles.sr}`} onClick={shoot}>
            Take a shot
          </button>
        </div>
      </footer>

      <Menu open={menuOpen} reduce={reduce} onClose={() => setMenuOpen(false)} />
      <AnimatePresence>
        {project && <ProjectView key="project" clips={clips} open={project} onClose={() => setProject(null)} />}
      </AnimatePresence>
    </section>
  );
}

/** A shot: it flies from where it was taken into its slot, and opens its film. */
function ShotCard({
  shot,
  onOpen,
  reduce,
}: {
  shot: Shot;
  onOpen: (film: number, rect: OpenProject["rect"], time: number) => void;
  reduce: boolean;
}) {
  const f = shot.fly;
  const holdRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = holdRef.current;
    if (el && shot.still && !el.contains(shot.still)) el.appendChild(shot.still);
  }, [shot.still]);
  return (
    <motion.button
      type="button"
      className={styles.shot}
      initial={reduce ? false : { x: f.x, y: f.y, scale: f.s, rotate: f.r }}
      animate={{ x: 0, y: 0, scale: 1, rotate: shot.tilt, transition: { duration: 0.95, ease: EASE_CINE, delay: 0.15 } }}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onOpen(shot.film, { left: r.left, top: r.top, width: r.width, height: r.height }, shot.time);
      }}
      aria-label="Open the film this shot came from"
    >
      {shot.still ? (
        <span ref={holdRef} className={styles.still} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shot.poster} alt="" draggable={false} />
      )}
      <span className={styles.shotTc}>{timecode(shot.time)}</span>
    </motion.button>
  );
}
