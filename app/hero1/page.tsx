"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

// ===========================================================================
// CONTENT — replace with your own
// ===========================================================================
// Two (or more) videos. Cards alternate between them, and each video's clips
// are spread evenly across that video's own duration.
const VIDEOS = [
  encodeURI("/cleveland_clinic_1.mp4_v1 (1080p) (1).mp4"), // video 1
  encodeURI("/nike_pitch_nov_25.mp4_v1 (1080p).mp4"), // video 2: change to your real file name in /public
];
const COUNT = 12; // number of clips (must match the number of entries in PLACES)
const CLIP_LEN = 4; // seconds each card loops

type Project = {
  id: number;
  title: string;
  client: string;
  year: string;
  category: string;
  src: string;
  slot: number; // this clip's position within its own video
  slots: number; // how many clips share that video
  poster?: string;
};

const PROJECTS: Project[] = Array.from({ length: COUNT }, (_, i) => {
  const v = i % VIDEOS.length;
  return {
    id: i + 1,
    title: `Project ${String(i + 1).padStart(2, "0")}`,
    client: "Client name",
    year: "2026",
    category: ["commercial", "brand film", "music video"][i % 3],
    src: VIDEOS[v],
    slot: Math.floor(i / VIDEOS.length),
    slots: Math.ceil((COUNT - v) / VIDEOS.length),
  };
});
const N = PROJECTS.length;

const BRAND = "16x9";
const NAV = [
  { label: "Work", href: "/work" },
  { label: "Services", href: "/services" },
  { label: "Studio", href: "/studio" },
  { label: "Contact", href: "/contact" },
];
const CTA = { label: "Start a project", href: "mailto:hello@agencyname.com" }; // set your email
const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/16x9videoagency/" },
  { label: "Vimeo", href: "https://vimeo.com/16x9agency" },
  { label: "Facebook", href: "https://www.facebook.com/16x9videocontentagency" },
  { label: "YouTube", href: "https://www.youtube.com/user/16on9" },
];

// Hero copy
const CENTER = "Bringing brands to life";
const BOTTOM = ["Turn target audience", "into your viewers"];

// ===========================================================================
// TYPE — Archivo, using its wide cut for display text
// ===========================================================================
const FONT = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
const WIDE = { fontFamily: FONT, fontVariationSettings: "'wdth' 125" } as const;
const HEAD = { ...WIDE, fontWeight: 900, letterSpacing: "-0.02em" } as const;
const WHITE = "#ffffff";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

// Entrance timeline (seconds): a projector line draws, the letterbox opens
// like a 16:9 frame, the clips rush in, then the copy and chrome settle.
const T = { line: 0.1, bars: 0.55, barsDur: 1.5, copy: 1.55, nav: 1.85, side: 2.1 };
const FPS = 25; // timecode frame rate

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap');
@keyframes hs-grain {
  0%,100% { transform: translate(0,0) } 20% { transform: translate(-4%,3%) }
  40% { transform: translate(3%,-5%) } 60% { transform: translate(-2%,-3%) } 80% { transform: translate(5%,2%) }
}
.hs-grain { animation: hs-grain 0.9s steps(5) infinite; }
@keyframes hs-scroll { 0% { transform: translateY(-100%) } 100% { transform: translateY(250%) } }
.hs-scroll { animation: hs-scroll 1.9s cubic-bezier(0.76,0,0.24,1) infinite; }
@keyframes hs-rec { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
.hs-rec { animation: hs-rec 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .hs-grain, .hs-scroll, .hs-rec { animation: none; } }
`;

// ===========================================================================
// SPACE
// x, y are fractions of the viewport width / height; w is a fraction of the
// viewport width. Desktop and tablets use PLACES; phones use MOBILE_PLACES,
// a layout built for a tall, narrow screen.
// ===========================================================================
type Place = { x: number; y: number; w: number; a: number; rx: number; ry: number };
const PLACES: Place[] = [
  { x: -0.3, y: -0.22, w: 0.26, a: 16 / 9, rx: 0, ry: 8 },
  { x: 0.32, y: 0.24, w: 0.2, a: 4 / 5, rx: 0, ry: -14 },
  { x: 0.3, y: -0.3, w: 0.3, a: 2.2, rx: 0, ry: 0 },
  { x: -0.34, y: 0.28, w: 0.17, a: 3 / 4, rx: 2, ry: 18 },
  { x: 0.02, y: -0.36, w: 0.34, a: 2.35, rx: 0, ry: 0 },
  { x: 0.4, y: -0.02, w: 0.15, a: 2 / 3, rx: 0, ry: -24 },
  { x: -0.1, y: 0.33, w: 0.3, a: 16 / 9, rx: 0, ry: 0 },
  { x: -0.4, y: -0.06, w: 0.15, a: 2 / 3, rx: 0, ry: 24 },
  { x: 0.22, y: 0.3, w: 0.26, a: 16 / 10, rx: 0, ry: -6 },
  { x: -0.24, y: -0.32, w: 0.2, a: 1, rx: -2, ry: 12 },
  { x: 0.36, y: -0.26, w: 0.17, a: 3 / 4, rx: 2, ry: -18 },
  { x: -0.3, y: 0.26, w: 0.28, a: 16 / 9, rx: 0, ry: 6 },
];
const MOBILE_PLACES: Place[] = [
  { x: -0.24, y: -0.26, w: 0.44, a: 16 / 9, rx: 0, ry: 8 },
  { x: 0.26, y: 0.2, w: 0.36, a: 4 / 5, rx: 0, ry: -12 },
  { x: 0.24, y: -0.3, w: 0.48, a: 16 / 10, rx: 0, ry: -6 },
  { x: -0.26, y: 0.26, w: 0.34, a: 3 / 4, rx: 2, ry: 14 },
  { x: 0, y: -0.36, w: 0.5, a: 2.2, rx: 0, ry: 0 },
  { x: 0.3, y: 0.02, w: 0.3, a: 2 / 3, rx: 0, ry: -18 },
  { x: -0.1, y: 0.34, w: 0.5, a: 16 / 9, rx: 0, ry: 0 },
  { x: -0.3, y: -0.04, w: 0.3, a: 2 / 3, rx: 0, ry: 18 },
  { x: 0.2, y: 0.32, w: 0.44, a: 16 / 10, rx: 0, ry: -6 },
  { x: -0.2, y: -0.34, w: 0.36, a: 1, rx: -2, ry: 10 },
  { x: 0.28, y: -0.22, w: 0.32, a: 3 / 4, rx: 2, ry: -14 },
  { x: -0.24, y: 0.16, w: 0.46, a: 16 / 9, rx: 0, ry: 6 },
];
const pickPlaces = (vw: number) => (vw < 720 ? MOBILE_PLACES : PLACES);

// Tile size for the current screen: a little larger on tablets, and never
// taller than 42% of the viewport height (matters on landscape phones).
const tileSize = (p: Place, vw: number, vh: number) => {
  const scale = vw >= 720 && vw < 1024 ? 1.25 : 1;
  let w = Math.max(p.w * vw * scale, 150);
  let h = w / p.a;
  const maxH = vh * 0.42;
  if (h > maxH) {
    h = maxH;
    w = h * p.a;
  }
  return { w, h };
};

const PERSP = 1400;
const SPACING = 800; // depth between clips
const DEPTH = N * SPACING;
const BACK = DEPTH - 1200;
const VISIBLE = 2600;
const FOCUS_Z = 150;
const SPEED = 900; // px per second the clips move toward you on their own (0 = still)
const Z0 = Array.from({ length: N }, (_, i) => -i * SPACING);

const wrap = (v: number) => ((((v + BACK) % DEPTH) + DEPTH) % DEPTH) - BACK;

type OpenFilm = Project & { at: number };

// ===========================================================================
// HERO
// ===========================================================================
export default function HeroSection() {
  const reduce = !!useReducedMotion();
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [film, setFilm] = useState<OpenFilm | null>(null);

  const selRef = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const ptr = useRef({ x: 0, y: 0 });
  const size = useRef({ vw: 1440, vh: 900 });
  const placesRef = useRef<Place[]>(PLACES);
  const worldRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const startRefs = useRef<number[]>(PROJECTS.map(() => 0)); // clip start (seconds) per tile

  useEffect(() => {
    selRef.current = selected;
    if (selected === null) setSoundOn(false);
  }, [selected]);
  useEffect(() => {
    hoverRef.current = hovered;
  }, [hovered]);

  // Tile sizes and the layout choice follow the viewport
  useEffect(() => {
    const apply = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      size.current = { vw, vh };
      placesRef.current = pickPlaces(vw);
      placesRef.current.forEach((p, i) => {
        const el = tileRefs.current[i];
        if (!el) return;
        const { w, h } = tileSize(p, vw, vh);
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      });
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Render loop: the clips float toward you on their own
  // -------------------------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    let last = start;
    let cam = 0;
    let drift = 0;
    let px = 0;
    let py = 0;
    let g = 0;
    let t = 0;
    const sel = Array.from({ length: N }, () => 0);
    const hov = Array.from({ length: N }, () => 0);
    const lastFilter = Array.from({ length: N }, () => "");
    const lastPE = Array.from({ length: N }, () => "");

    const onMove = (e: PointerEvent) => {
      ptr.current = { x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 };
    };
    window.addEventListener("pointermove", onMove);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const k = (rate: number) => 1 - Math.exp(-dt * (reduce ? 40 : rate));
      const selectedId = selRef.current;

      if (!reduce && selectedId === null) drift += SPEED * dt;
      cam += (drift - cam) * k(3.5);

      const ip = reduce ? 1 : clamp01(((now - start) / 1000 - 0.3) / 3.2);
      const intro = 1 - Math.pow(1 - ip, 4);

      if (!reduce) {
        px += (ptr.current.x - px) * k(2.5);
        py += (ptr.current.y - py) * k(2.5);
      }
      if (worldRef.current) worldRef.current.style.transform = `rotateX(${-py * 4}deg) rotateY(${px * 6}deg)`;

      g += ((selectedId !== null ? 1 : 0) - g) * k(4.5);
      const { vw, vh } = size.current;
      const places = placesRef.current;
      const focusFrac = vw < 720 ? 0.9 : 0.58; // how much of the width an opened clip fills

      for (let i = 0; i < N; i++) {
        const el = tileRefs.current[i];
        if (!el) continue;
        const p = places[i];
        const id = PROJECTS[i].id;

        sel[i] += ((selectedId === id ? 1 : 0) - sel[i]) * k(4);
        hov[i] += ((hoverRef.current === id ? 1 : 0) - hov[i]) * k(7);
        const s = smooth(clamp01(sel[i]));
        const h = hov[i];
        const others = g * (1 - sel[i]);

        const rel = wrap(Z0[i] + cam) - (1 - intro) * 3200;
        const { w, h: hgt } = tileSize(p, vw, vh);
        const bob = reduce ? 0 : Math.sin(t * 0.5 + i * 1.7) * 10;

        const fx = p.x * vw;
        const fy = p.y * vh + bob;
        const fz = rel + h * 80 - others * 800;
        const targetW = Math.min(vw * focusFrac, vh * 0.55 * p.a);
        const targetScale = targetW / (w * (PERSP / (PERSP - FOCUS_Z)));

        const x = lerp(fx, 0, s);
        const y = lerp(fy, 0, s);
        const z = lerp(fz, FOCUS_Z, s);
        const rx = lerp(p.rx * (1 - h * 0.6), 0, s);
        const ry = lerp(p.ry * (1 - h * 0.6), 0, s);
        const sc = lerp(1, targetScale, s);
        el.style.transform = `translate3d(${x - w / 2}px, ${y - hgt / 2}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})`;

        const back = clamp01((rel + VISIBLE) / 900);
        const front = clamp01((900 - rel) / 500);
        const presence = rel > -400 ? 1 : 0.15 + 0.85 * clamp01(1 - (-rel - 400) / 1400);
        const op = lerp(back * front * presence * (1 - others * 0.75) * clamp01(ip * 1.6), 1, s);
        el.style.opacity = op.toFixed(3);

        const depthBlur = Math.min(10, Math.abs(rel) / 220) * (1 - h) + others * 6;
        const blur = Math.round(lerp(depthBlur, 0, s) * 2) / 2;
        const lit = (0.45 + 0.55 * clamp01(1 - Math.abs(rel) / VISIBLE)) * (1 - others * 0.45) + h * 0.35;
        const bright = Math.round(Math.min(1, lerp(lit, 1, s)) * 20) / 20;
        const f = `blur(${blur}px) brightness(${bright})`;
        if (f !== lastFilter[i]) {
          el.style.filter = f;
          lastFilter[i] = f;
        }
        const pe = op > 0.35 ? "auto" : "none";
        if (pe !== lastPE[i]) {
          el.style.pointerEvents = pe;
          lastPE[i] = pe;
        }

        // Keep each card inside its own clip: jump back to the start at the end
        const v = videoRefs.current[i];
        if (v && !v.paused && v.readyState >= 1 && v.currentTime >= startRefs.current[i] + CLIP_LEN) {
          v.currentTime = startRefs.current[i];
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduce]);

  const step = useCallback((dir: 1 | -1) => {
    const s = selRef.current;
    if (s === null) return;
    setSelected(((s - 1 + dir + N) % N) + 1);
  }, []);

  // Unmute inside the click itself so browsers accept it as a user gesture
  const toggleSound = useCallback(() => {
    const s = selRef.current;
    if (s === null) return;
    setSoundOn((on) => {
      const next = !on;
      const v = videoRefs.current[s - 1];
      if (v) v.muted = !next;
      return next;
    });
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (v) v.muted = !(soundOn && PROJECTS[i].id === selected);
    });
  }, [soundOn, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selRef.current === null || film) return;
      if (e.key === "Escape") setSelected(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    const onVisibility = () =>
      videoRefs.current.forEach((v) => v && (document.hidden ? v.pause() : v.play().catch(() => {})));
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [step, film]);

  // Pause the clips once the hero has scrolled out of view
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      videoRefs.current.forEach((v) => v && (entry.isIntersecting && !document.hidden ? v.play().catch(() => {}) : v.pause()));
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const selectedProject = selected !== null ? PROJECTS[selected - 1] : null;
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { y: "105%" },
          animate: { y: 0 },
          transition: { duration: 1.3, ease: EASE_OUT, delay },
        };
  const appear = (delay: number, y = 12) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 1.2, ease: EASE_OUT, delay },
        };

  return (
    <section
      ref={sectionRef}
      aria-label="Showreel"
      className="relative h-dvh w-full select-none overflow-hidden bg-black text-white antialiased"
      style={{ fontFamily: FONT }}
    >
      <style>{CSS}</style>

      {/* 3D space */}
      <div
        className="absolute inset-0"
        style={{ perspective: `${PERSP}px`, perspectiveOrigin: "50% 50%" }}
        onClick={() => setSelected(null)}
      >
        <div ref={worldRef} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
          {PROJECTS.map((p, i) => (
            <button
              key={p.id}
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              type="button"
              data-cursor={selected === p.id ? (soundOn ? "mute" : "sound") : "play"}
              aria-label={selected === p.id ? `${p.title}, toggle sound` : `Open ${p.title}`}
              onClick={(e) => {
                e.stopPropagation();
                if (selected === p.id) toggleSound();
                else setSelected(p.id);
              }}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(p.id)}
              onPointerLeave={() => setHovered((h) => (h === p.id ? null : h))}
              onFocus={() => setHovered(p.id)}
              onBlur={() => setHovered(null)}
              className="absolute left-0 top-0 block overflow-hidden bg-[#0d0d0d] opacity-0 outline-none [backface-visibility:hidden] [will-change:transform,filter,opacity] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white [@media(pointer:fine)]:cursor-none"
            >
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={p.src}
                poster={p.poster}
                autoPlay
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  const span = Math.max(0, v.duration - CLIP_LEN);
                  const startAt = Math.min(span * (p.slot / p.slots), span);
                  startRefs.current[i] = startAt;
                  v.currentTime = startAt;
                }}
                onEnded={(e) => {
                  const v = e.currentTarget;
                  v.currentTime = startRefs.current[i];
                  v.play().catch(() => {});
                }}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
              <span aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />
            </button>
          ))}
        </div>
      </div>

      {/* Soft darkening behind the copy */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,0,0,0.35),transparent_45%),radial-gradient(ellipse_at_0%_100%,rgba(0,0,0,0.7),transparent_55%)]"
      />

      <div
        className="pointer-events-none absolute inset-0 z-40 transition-opacity duration-500"
        style={{ opacity: selected !== null ? 0 : 1 }}
      >
        {/* Centre line */}
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center">
          <h1
            className="overflow-hidden pb-[0.08em] text-[length:clamp(1.75rem,8vw,2.75rem)] uppercase leading-none md:text-[length:clamp(1.5rem,min(3.6vw,7vh),3.75rem)]"
            style={{ ...HEAD, color: WHITE, textShadow: "0 4px 40px rgba(0,0,0,0.45)" }}
          >
            <motion.span className="block" {...rise(T.copy)}>
              {CENTER}
            </motion.span>
          </h1>
        </div>

        {/* Bottom-left, on the same left edge as the navbar */}
        <p
          className="absolute bottom-6 left-5 text-[length:clamp(1.1rem,5vw,1.6rem)] uppercase leading-[1.02] text-white sm:bottom-9 sm:left-12 md:text-[length:clamp(1.1rem,min(2.3vw,4.5vh),2.4rem)]"
          style={{ ...WIDE, fontWeight: 300, letterSpacing: "-0.01em" }}
        >
          {BOTTOM.map((line) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span className="block" {...rise(T.copy + 0.08)}>
                {line}
              </motion.span>
            </span>
          ))}
        </p>

        {/* Right edge: socials, set vertically */}
        <motion.nav
          aria-label="Social"
          {...appear(T.side, 0)}
          className="pointer-events-auto absolute right-5 top-1/2 hidden -translate-y-1/2 sm:right-12 sm:block"
        >
          <ul className="flex rotate-180 gap-7 [writing-mode:vertical-rl]">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/55 transition-colors hover:text-white"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </motion.nav>

        {/* Bottom-right: scroll indicator */}
        <motion.div {...appear(T.side + 0.1)} className="absolute bottom-6 right-5 flex items-end gap-10 sm:bottom-9 sm:right-12">
          <button
            type="button"
            onClick={() => window.scrollBy({ top: window.innerHeight, behavior: "smooth" })}
            aria-label="Scroll to the next section"
            className="pointer-events-auto flex items-end gap-3 text-[10px] font-medium uppercase tracking-[0.3em] text-white/70 transition-colors hover:text-white"
          >
            <span>Scroll</span>
            <span className="relative block h-12 w-px overflow-hidden bg-white/20">
              <span className="hs-scroll absolute left-0 top-0 block h-1/3 w-full bg-white" />
            </span>
          </button>
        </motion.div>

        {/* Social links on phones: a single row above the bottom copy */}
        <motion.ul
          {...appear(T.side)}
          className="pointer-events-auto absolute bottom-28 left-5 flex flex-wrap gap-x-5 gap-y-2 sm:hidden"
        >
          {SOCIALS.map((s) => (
            <li key={s.label}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/60"
              >
                {s.label}
              </a>
            </li>
          ))}
        </motion.ul>
      </div>

      {/* Edge falloff */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.65)_100%)]"
      />

      {/* Opened clip: title and controls */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0 : 0.6, duration: 0.9, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.25 } }}
            className="absolute inset-x-0 bottom-0 z-40 flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-7"
          >
            <div className="overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedProject.id}
                  initial={reduce ? false : { y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-60%", opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                >
                  <p className="text-[clamp(1.5rem,3vw,2.75rem)] uppercase leading-none" style={HEAD}>
                    {selectedProject.title}
                  </p>
                  <p className="mt-2 text-xs font-medium text-white/55">
                    {selectedProject.client}, {selectedProject.category}, {selectedProject.year}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-white/65">
              <button type="button" onClick={() => step(-1)} className="py-1 transition-colors hover:text-white">
                previous
              </button>
              <button type="button" onClick={() => step(1)} className="py-1 transition-colors hover:text-white">
                next
              </button>
              <button type="button" onClick={toggleSound} className="py-1 transition-colors hover:text-white">
                {soundOn ? "mute" : "sound on"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const v = videoRefs.current[selectedProject.id - 1];
                  if (v) v.muted = true;
                  setSoundOn(false);
                  setFilm({ ...selectedProject, at: startRefs.current[selectedProject.id - 1] });
                }}
                className="py-1 text-white transition-opacity hover:opacity-70"
              >
                watch the film
              </button>
              <button type="button" onClick={() => setSelected(null)} className="py-1 transition-colors hover:text-white">
                close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Film grain */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[45] overflow-hidden opacity-[0.07]">
        <div className="hs-grain absolute -inset-[50%]" style={{ backgroundImage: GRAIN }} />
      </div>

      <Navbar hidden={selected !== null} reduce={reduce} />

      {/* Entrance: a projector line draws across, then the frame opens */}
      {!reduce && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[60]">
          <motion.div
            className="absolute inset-x-0 top-0 h-1/2 origin-top bg-black"
            initial={{ scaleY: 1 }}
            animate={{ scaleY: 0 }}
            transition={{ duration: T.barsDur, ease: EASE_CINE, delay: T.bars }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 h-1/2 origin-bottom bg-black"
            initial={{ scaleY: 1 }}
            animate={{ scaleY: 0 }}
            transition={{ duration: T.barsDur, ease: EASE_CINE, delay: T.bars }}
          />
          <motion.div
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }}
            transition={{ duration: 1.2, ease: EASE_CINE, delay: T.line, times: [0, 0.45, 1] }}
          />
        </div>
      )}
      <Lightbox film={film} onClose={() => setFilm(null)} />
      <Cursor />
    </section>
  );
}

// ===========================================================================
// NAVBAR — a slim floating glass bar; full-screen menu on phones
// ===========================================================================
function Navbar({ hidden, reduce }: { hidden: boolean; reduce: boolean }) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const id = window.setTimeout(() => setEntered(true), T.nav * 1000);
    return () => window.clearTimeout(id);
  }, [reduce]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header
        className="absolute inset-x-0 top-0 z-50 px-3 pt-3 transition-[opacity,transform] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-6 sm:pt-5"
        style={{
          opacity: hidden || !entered ? 0 : 1,
          transform: entered ? "none" : "translateY(-16px)",
          pointerEvents: hidden ? "none" : "auto",
        }}
      >
        <div className="flex items-center justify-between rounded-full border border-white/10 bg-black/30 py-2 pl-5 pr-2 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:pl-6">
          <a href="/" className="text-[13px] uppercase text-white" style={{ ...WIDE, fontWeight: 800, letterSpacing: "0.06em" }}>
            {BRAND}
          </a>

          <nav aria-label="Main" className="hidden items-center gap-9 md:flex">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className="group relative py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white/65 transition-colors hover:text-white"
              >
                {n.label}
                <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-white transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={CTA.href}
              className="hidden rounded-full bg-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-white/80 sm:inline-block"
            >
              {CTA.label}
            </a>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="hero-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white md:hidden"
            >
              <span className="relative block h-3 w-4">
                <span
                  className="absolute left-0 top-0 block h-px w-full bg-white transition-transform duration-300"
                  style={{ transform: open ? "translateY(6px) rotate(45deg)" : "none" }}
                />
                <span
                  className="absolute bottom-0 left-0 block h-px w-full bg-white transition-transform duration-300"
                  style={{ transform: open ? "translateY(-5px) rotate(-45deg)" : "none" }}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div
          id="hero-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[45] flex flex-col justify-between bg-black/95 px-6 pb-8 pt-28 backdrop-blur-xl md:hidden"
        >
          <nav aria-label="Menu" className="flex flex-col gap-2">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="text-[clamp(2.25rem,11vw,3.5rem)] uppercase leading-[1] text-white"
                style={HEAD}
              >
                {n.label}
              </a>
            ))}
          </nav>
          <a
            href={CTA.href}
            className="w-full rounded-full bg-white py-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-black"
          >
            {CTA.label}
          </a>
        </div>
      )}
    </>
  );
}

// ===========================================================================
// TIMECODE — a running HH:MM:SS:FF counter, updated without re-rendering.
// Not used right now; drop <Timecode /> anywhere to show it.
// ===========================================================================
export function Timecode() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const f = Math.floor(((now - start) / 1000) * FPS);
      const s = Math.floor(f / FPS);
      if (ref.current)
        ref.current.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % FPS)}`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span ref={ref} className="tabular-nums">
      00:00:00:00
    </span>
  );
}

// ===========================================================================
// LIGHTBOX — full film with sound and controls, opened at the clip's start
// ===========================================================================
function Lightbox({ film, onClose }: { film: OpenFilm | null; onClose: () => void }) {
  useEffect(() => {
    if (!film) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [film, onClose]);

  return (
    <AnimatePresence>
      {film && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={film.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="fixed inset-0 z-[70] flex flex-col bg-black text-white"
          onClick={onClose}
        >
          <div className="flex items-start justify-between px-6 pt-5 text-sm">
            <div>
              <p className="uppercase" style={HEAD}>
                {film.title}
              </p>
              <p className="mt-1 text-xs font-medium text-white/50">
                {film.client}, {film.year}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="bg-white px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-80"
            >
              close
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
            <motion.video
              key={film.id}
              src={film.src}
              autoPlay
              controls
              playsInline
              onLoadedMetadata={(e) => {
                if (film.at) e.currentTarget.currentTime = film.at;
              }}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.1 }}
              className="max-h-full w-full max-w-[min(100%,160svh)] bg-black"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ===========================================================================
// CURSOR — a white disc that labels anything with data-cursor (fine pointers)
// ===========================================================================
function Cursor() {
  const [label, setLabel] = useState<string | null>(null);
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const x = useSpring(mx, { stiffness: 700, damping: 45, mass: 0.35 });
  const y = useSpring(my, { stiffness: 700, damping: 45, mass: 0.35 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      const el = (e.target as Element | null)?.closest?.("[data-cursor]");
      const next = el ? el.getAttribute("data-cursor") : null;
      setLabel((prev) => (prev === next ? prev : next));
    };
    const onLeave = () => setLabel(null);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [mx, my]);

  return (
    <motion.div
      aria-hidden
      style={{ x, y }}
      className="pointer-events-none fixed left-0 top-0 z-[80] hidden [@media(pointer:fine)]:block"
    >
      <motion.div
        animate={
          label
            ? { width: 76, height: 76, marginLeft: -38, marginTop: -38, opacity: 1 }
            : { width: 10, height: 10, marginLeft: -5, marginTop: -5, opacity: 0 }
        }
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="grid place-items-center overflow-hidden rounded-full bg-white text-black"
      >
        <AnimatePresence mode="wait">
          {label && (
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-[11px] font-semibold uppercase tracking-wider"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}