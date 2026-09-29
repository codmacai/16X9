"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

// ===========================================================================
// CONTENT — replace with your own
// ===========================================================================
type Category = "direction" | "motion" | "design";
type Clip = { id: number; title: string; category: Category; src: string; poster?: string };

const CLIPS: Clip[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  title: `Project ${String(i + 1).padStart(2, "0")}`,
  category: (["direction", "motion", "design"] as Category[])[i % 3],
  src: `/nike_pitch_nov_25.mp4_v1 (1080p).mp4`,
}));
const C = CLIPS.length;

const LOGO_SRC = "/Screenshot 2026-09-29 at 10.25.42 PM.png"; // your logo in /public
const BRAND = "16x9";
const NAV = [
  { label: "Work", href: "/work" },
  { label: "Services", href: "/services" },
  { label: "Studio", href: "/studio" },
  { label: "Contact", href: "/contact" },
];
const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/16x9videoagency/" },
  { label: "Vimeo", href: "https://vimeo.com/16x9agency" },
  { label: "Facebook", href: "https://www.facebook.com/16x9videocontentagency" },
  { label: "YouTube", href: "https://www.youtube.com/user/16on9" },
];
const CENTER = "Bringing brands to life";
const BOTTOM = ["Turn target audience", "into your viewers"];

// ===========================================================================
// TYPE & COLOUR — Archivo (its wide cut for display), white on black
// ===========================================================================
const FONT = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
const WIDE = { fontFamily: FONT, fontVariationSettings: "'wdth' 125" } as const;
const HEAD = { ...WIDE, fontWeight: 900, letterSpacing: "-0.02em" } as const;

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

// Entrance timeline (seconds): a projector line draws, the letterbox opens,
// the tunnel rushes in, then the copy and chrome settle.
const T = { line: 0.1, bars: 0.55, barsDur: 1.5, copy: 1.55, nav: 1.85, side: 2.1 };
const FPS = 25; // timecode frame rate

// ---------------------------------------------------------------------------
// Tunnel. Four walls (left, right, ceiling, floor) run away from the camera.
// Tiles are mounted flat on the walls and the clips play on them. The centre
// of the tunnel stays empty for the headline.
// ---------------------------------------------------------------------------
type Wall = 0 | 1 | 2 | 3; // left, right, top, bottom
type Tile = { clip: Clip; wall: Wall; a: number; size: number; lat: number; z0: number };

const PERSP = 1400;
const SPACING = 800;
const PER_WALL = 6;
const N = PER_WALL * 4;
const DEPTH = PER_WALL * SPACING;
const BACK = DEPTH - 900;
const VISIBLE = 3800;
const FOCUS_Z = 150;
const SPEED = 1500; // constant camera speed (px/s)
const RING = 400;
const RINGS = 18;
const ROWS = 4;
const COLS = 6;

const WALL_ROT: [number, number][] = [
  [0, 90],
  [0, -90],
  [-90, 0],
  [90, 0],
];
const INWARD: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const PORTRAIT = [3 / 4, 2 / 3, 4 / 5, 3 / 5];
const LANDSCAPE = [16 / 9, 16 / 10, 2.2, 3 / 2];

const rnd = (i: number, k: number) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const TILES: Tile[] = Array.from({ length: N }, (_, i) => {
  const wall = (i % 4) as Wall;
  const slot = Math.floor(i / 4);
  const set = wall < 2 ? PORTRAIT : LANDSCAPE;
  return {
    clip: CLIPS[i % C],
    wall,
    a: set[Math.floor(rnd(i, 1) * set.length)],
    size: rnd(i, 2),
    lat: rnd(i, 3) * 2 - 1,
    z0: -(slot * SPACING + (wall * SPACING) / 4),
  };
});

type Layout = { vw: number; vh: number; tw: number; th: number; tiles: { w: number; h: number; x: number; y: number }[] };

const buildLayout = (vw: number, vh: number): Layout => {
  const tw = vw * 0.62;
  const th = vh * 0.62;
  const mobile = vw < 720;
  const tiles = TILES.map((t) => {
    let w: number;
    let h: number;
    let x: number;
    let y: number;
    if (t.wall < 2) {
      h = vh * (0.3 + 0.22 * t.size) * (mobile ? 0.85 : 1);
      w = h * t.a;
      if (w > 680) {
        w = 680;
        h = w / t.a;
      }
      y = t.lat * Math.max(0, th - h / 2 - 16);
      x = t.wall === 0 ? -tw : tw;
    } else {
      w = Math.max(vw * (0.2 + 0.18 * t.size) * (mobile ? 1.5 : 1), 150);
      h = w / t.a;
      if (h > 640) {
        h = 640;
        w = h * t.a;
      }
      x = t.lat * Math.max(0, tw - w / 2 - 16);
      y = t.wall === 2 ? -th : th;
    }
    return { w, h, x, y };
  });
  return { vw, vh, tw, th, tiles };
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const wrap = (v: number) => ((((v + BACK) % DEPTH) + DEPTH) % DEPTH) - BACK;

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap');
@keyframes th-grain {
  0%,100% { transform: translate(0,0) } 20% { transform: translate(-4%,3%) }
  40% { transform: translate(3%,-5%) } 60% { transform: translate(-2%,-3%) } 80% { transform: translate(5%,2%) }
}
.th-grain { animation: th-grain 0.9s steps(5) infinite; }
@keyframes th-scroll { 0% { transform: translateY(-100%) } 100% { transform: translateY(250%) } }
.th-scroll { animation: th-scroll 1.9s cubic-bezier(0.76,0,0.24,1) infinite; }
@keyframes th-rec { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
.th-rec { animation: th-rec 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .th-grain, .th-scroll, .th-rec { animation: none; } }
`;

export default function FloatingReel() {
  const reduce = !!useReducedMotion();
  const [selected, setSelected] = useState<number | null>(null); // tile index
  const [hovered, setHovered] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  const selRef = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const visibleRef = useRef(true);
  const camTarget = useRef(0);
  const ptr = useRef({ x: 0, y: 0 });
  const layout = useRef<Layout>(buildLayout(1440, 900));
  const dprRef = useRef(1);
  const sectionRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const playing = useRef<boolean[]>(TILES.map(() => true));

  useEffect(() => {
    selRef.current = selected;
    if (selected === null) setSoundOn(false);
  }, [selected]);
  useEffect(() => {
    hoverRef.current = hovered;
  }, [hovered]);

  // Tile sizes and the grid canvas follow the viewport
  useEffect(() => {
    const apply = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const L = buildLayout(vw, vh);
      layout.current = L;
      L.tiles.forEach((t, i) => {
        const el = tileRefs.current[i];
        if (!el) return;
        el.style.width = `${t.w}px`;
        el.style.height = `${t.h}px`;
      });
      const cv = canvasRef.current;
      if (cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        dprRef.current = dpr;
        cv.width = Math.round(vw * dpr);
        cv.height = Math.round(vh * dpr);
        cv.style.width = `${vw}px`;
        cv.style.height = `${vh}px`;
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Stop everything once the hero has scrolled out of view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      if (!entry.isIntersecting) {
        playing.current.fill(false);
        videoRefs.current.forEach((v) => v?.pause());
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // -------------------------------------------------------------------------
  // Render loop: constant forward motion, parallax, the tunnel grid, depth of
  // field, and the flight of a selected clip to the centre.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    let last = start;
    let cam = camTarget.current;
    let speed = 0;
    let px = 0;
    let py = 0;
    let g = 0;
    const sel = TILES.map(() => 0);
    const hov = TILES.map(() => 0);
    const lastFilter = TILES.map(() => "");
    const lastPE = TILES.map(() => "");

    const drawGrid = (a: number, b: number, alpha: number) => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      const { vw, vh, tw, th } = layout.current;
      const dpr = dprRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      if (alpha <= 0.001) return;

      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const cb = Math.cos(b);
      const sb = Math.sin(b);
      const proj = (x: number, y: number, z: number): [number, number] | null => {
        const x1 = x * cb + z * sb;
        const z1 = -x * sb + z * cb;
        const y2 = y * ca - z1 * sa;
        const z2 = y * sa + z1 * ca;
        const d = PERSP - z2;
        if (d < 60) return null;
        const s = PERSP / d;
        return [vw / 2 + x1 * s, vh / 2 + y2 * s];
      };
      const seg = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
        const p = proj(x1, y1, z1);
        const q = proj(x2, y2, z2);
        if (!p || !q) return;
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
      };

      ctx.lineWidth = 1;
      const ZN = 700;
      const ZF = -14000;

      ctx.strokeStyle = `rgba(255,255,255,${(0.06 * alpha).toFixed(3)})`;
      ctx.beginPath();
      for (let j = 0; j <= ROWS; j++) {
        const y = -th + (2 * th * j) / ROWS;
        seg(-tw, y, ZN, -tw, y, ZF);
        seg(tw, y, ZN, tw, y, ZF);
      }
      for (let j = 0; j <= COLS; j++) {
        const x = -tw + (2 * tw * j) / COLS;
        seg(x, -th, ZN, x, -th, ZF);
        seg(x, th, ZN, x, th, ZF);
      }
      ctx.stroke();

      const off = ((cam % RING) + RING) % RING;
      for (let k = -1; k < RINGS; k++) {
        const z = off - k * RING;
        if (z > 600) continue;
        const fade = 1 - Math.min(1, -z / 7500);
        ctx.strokeStyle = `rgba(255,255,255,${(0.06 * alpha * fade).toFixed(3)})`;
        ctx.beginPath();
        seg(-tw, -th, z, tw, -th, z);
        seg(tw, -th, z, tw, th, z);
        seg(tw, th, z, -tw, th, z);
        seg(-tw, th, z, -tw, -th, z);
        ctx.stroke();
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visibleRef.current) return;
      const k = (rate: number) => 1 - Math.exp(-dt * (reduce ? 40 : rate));
      const selectedId = selRef.current;

      // Always moving forward; eases to a stop while a clip is open
      const target = selectedId !== null ? 0 : SPEED;
      speed += (target - speed) * k(3);
      if (!reduce) camTarget.current += speed * dt;
      cam += (camTarget.current - cam) * k(3.5);

      const ip = reduce ? 1 : clamp01(((now - start) / 1000 - 0.3) / 3.2);
      const intro = 1 - Math.pow(1 - ip, 4);

      if (!reduce) {
        px += (ptr.current.x - px) * k(2.5);
        py += (ptr.current.y - py) * k(2.5);
      }
      const ax = -py * 4;
      const by = px * 6;
      if (worldRef.current) worldRef.current.style.transform = `rotateX(${ax}deg) rotateY(${by}deg)`;

      g += ((selectedId !== null ? 1 : 0) - g) * k(4.5);
      const lay = layout.current;
      const { vw, vh } = lay;

      drawGrid((ax * Math.PI) / 180, (by * Math.PI) / 180, clamp01(ip * 1.4) * (1 - g * 0.6));

      for (let i = 0; i < N; i++) {
        const el = tileRefs.current[i];
        if (!el) continue;
        const t = TILES[i];
        const L = lay.tiles[i];

        sel[i] += ((selectedId === i ? 1 : 0) - sel[i]) * k(4);
        hov[i] += ((hoverRef.current === i ? 1 : 0) - hov[i]) * k(7);
        const s = smooth(clamp01(sel[i]));
        const h = hov[i];
        const others = g * (1 - sel[i]);

        const rel = wrap(t.z0 + cam) - (1 - intro) * 3200;

        const inw = INWARD[t.wall];
        const fx = L.x + inw[0] * h * 70;
        const fy = L.y + inw[1] * h * 70;
        const fz = rel - others * 800;
        const targetW = Math.min(vw * 0.58, vh * 0.55 * t.a);
        const targetScale = targetW / (L.w * (PERSP / (PERSP - FOCUS_Z)));

        const x = lerp(fx, 0, s);
        const y = lerp(fy, 0, s);
        const z = lerp(fz, FOCUS_Z, s);
        const rx = lerp(WALL_ROT[t.wall][0], 0, s);
        const ry = lerp(WALL_ROT[t.wall][1], 0, s);
        const sc = lerp(1, targetScale, s);
        el.style.transform = `translate3d(${x - L.w / 2}px, ${y - L.h / 2}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})`;

        const back = clamp01((rel + VISIBLE) / 900);
        const front = clamp01((900 - rel) / 500);
        const op = lerp(back * front * (1 - others * 0.75) * clamp01(ip * 1.6), 1, s);
        el.style.opacity = op.toFixed(3);

        const depthBlur = Math.min(4, Math.abs(rel) / 800) * (1 - h) + others * 6;
        const blur = Math.round(lerp(depthBlur, 0, s) * 2) / 2;
        const lit = (0.1 + 0.6 * Math.pow(clamp01(1 - Math.abs(rel) / VISIBLE), 1.6)) * (1 - others * 0.45) + h * 0.35;
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

        // Only decode video that can actually be seen
        const vis = op > 0.03 && !document.hidden;
        if (vis !== playing.current[i]) {
          playing.current[i] = vis;
          const v = videoRefs.current[i];
          if (v) {
            if (vis) v.play().catch(() => {});
            else v.pause();
          }
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  // Step to the previous / next clip, preferring the copy that is closest
  const step = useCallback((dir: 1 | -1) => {
    const s = selRef.current;
    if (s === null) return;
    const base = (((s % C) + dir) % C + C) % C;
    let best = base;
    let bestD = Infinity;
    for (let i = base; i < N; i += C) {
      const d = Math.abs(wrap(TILES[i].z0 + camTarget.current) + 1000);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const rel = wrap(TILES[best].z0 + camTarget.current);
    if (rel < -3000 || rel > 200) camTarget.current += -1200 - rel;
    setSelected(best);
  }, []);

  // Unmute inside the click itself so browsers accept it as a user gesture
  const toggleSound = useCallback(() => {
    const s = selRef.current;
    if (s === null) return;
    setSoundOn((on) => {
      const next = !on;
      const v = videoRefs.current[s];
      if (v) v.muted = !next;
      return next;
    });
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (v) v.muted = !(soundOn && i === selected);
    });
  }, [soundOn, selected]);

  // Pointer for parallax; keys only while a clip is open
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      ptr.current = { x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 };
    };
    const onKey = (e: KeyboardEvent) => {
      if (selRef.current === null) return;
      if (e.key === "Escape") setSelected(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [step]);

  const selectedTile = selected !== null ? TILES[selected] : null;
  const selectedClip = selectedTile ? selectedTile.clip : null;

  const rise = (delay: number) =>
    reduce ? {} : { initial: { y: "105%" }, animate: { y: 0 }, transition: { duration: 1.3, ease: EASE_OUT, delay } };
  const appear = (delay: number, y = 12) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.2, ease: EASE_OUT, delay } };

  return (
    <main
      ref={sectionRef}
      aria-label="Showreel"
      className="relative h-dvh w-full select-none overflow-hidden bg-black text-white antialiased"
      style={{ fontFamily: FONT }}
    >
      <style>{CSS}</style>

      {/* Tunnel wireframe */}
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0" />

      {/* 3D space (click empty space to close an open clip) */}
      <div
        className="absolute inset-0"
        style={{ perspective: `${PERSP}px`, perspectiveOrigin: "50% 50%" }}
        onClick={() => setSelected(null)}
      >
        <div ref={worldRef} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
          {TILES.map((tile, i) => (
            <button
              key={i}
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              type="button"
              data-cursor={selected === i ? (soundOn ? "mute" : "sound") : "play"}
              aria-label={selected === i ? `${tile.clip.title}, toggle sound` : `Open ${tile.clip.title}`}
              onClick={(e) => {
                e.stopPropagation();
                if (selected === i) toggleSound();
                else setSelected(i);
              }}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              className="absolute left-0 top-0 block overflow-hidden bg-[#0d0d0d] opacity-0 outline-none [backface-visibility:hidden] [will-change:transform,filter,opacity] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white [@media(pointer:fine)]:cursor-none"
            >
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={tile.clip.src}
                poster={tile.clip.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) v.currentTime = (i * 1.37) % v.duration;
                }}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
              <span aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />
            </button>
          ))}
        </div>
      </div>

      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.92)_100%)]"
      />

      {/* ================= Copy + side chrome ================= */}
      <div
        className="pointer-events-none absolute inset-0 z-40 transition-opacity duration-500"
        style={{ opacity: selected !== null ? 0 : 1 }}
      >
        {/* Centre of the tunnel */}
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center">
          <h1
            className="overflow-hidden pb-[0.08em] uppercase leading-none"
            style={{ ...HEAD, fontSize: "clamp(1.5rem, min(3.6vw, 7vh), 3.75rem)", textShadow: "0 4px 40px rgba(0,0,0,0.5)" }}
          >
            <motion.span className="block" {...rise(T.copy)}>
              {CENTER}
            </motion.span>
          </h1>
        </div>

        {/* Bottom-left */}
        <p
          className="absolute bottom-7 left-6 uppercase leading-[1.02] sm:bottom-10 sm:left-12"
          style={{ ...WIDE, fontWeight: 300, letterSpacing: "-0.01em", fontSize: "clamp(1.1rem, min(2.3vw, 4.5vh), 2.4rem)" }}
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
          className="pointer-events-auto absolute right-6 top-1/2 hidden -translate-y-1/2 sm:right-12 sm:block"
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

        {/* Socials on phones: one row above the bottom copy */}
        <motion.ul {...appear(T.side)} className="pointer-events-auto absolute bottom-28 left-6 flex gap-5 sm:hidden">
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

        {/* Bottom-right: scroll indicator */}
        <motion.button
          type="button"
          {...appear(T.side + 0.1)}
          onClick={() => window.scrollBy({ top: window.innerHeight, behavior: "smooth" })}
          aria-label="Scroll to the next section"
          className="pointer-events-auto absolute bottom-7 right-6 flex items-end gap-3 text-[10px] font-medium uppercase tracking-[0.3em] text-white/70 transition-colors hover:text-white sm:bottom-10 sm:right-12"
        >
          <span>Scroll</span>
          <span className="relative block h-12 w-px overflow-hidden bg-white/20">
            <span className="th-scroll absolute left-0 top-0 block h-1/3 w-full bg-white" />
          </span>
        </motion.button>
      </div>

      {/* Film grain */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[45] overflow-hidden opacity-[0.08]">
        <div className="th-grain absolute -inset-[50%]" style={{ backgroundImage: GRAIN }} />
      </div>

      <Viewfinder reduce={reduce} hidden={selected !== null} />

      {/* ================= Opened clip: title and controls ================= */}
      <AnimatePresence>
        {selectedClip && selected !== null && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0 : 0.6, duration: 0.9, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.25 } }}
            className="absolute inset-x-0 bottom-0 z-40 flex flex-col gap-4 px-6 pb-7 sm:flex-row sm:items-end sm:justify-between sm:px-12 sm:pb-10"
          >
            <div className="overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected}
                  initial={reduce ? false : { y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-60%", opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                >
                  <p className="text-[clamp(1.5rem,3vw,2.75rem)] uppercase leading-none" style={HEAD}>
                    {selectedClip.title}
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-white/50">
                    {selectedClip.category}, {selectedClip.id} of {C}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex gap-6 text-[11px] font-medium uppercase tracking-[0.2em] text-white/65">
              <button type="button" onClick={() => step(-1)} className="transition-colors hover:text-white">
                previous
              </button>
              <button type="button" onClick={() => step(1)} className="transition-colors hover:text-white">
                next
              </button>
              <button type="button" onClick={toggleSound} className="transition-colors hover:text-white">
                {soundOn ? "mute" : "sound on"}
              </button>
              <button type="button" onClick={() => setSelected(null)} className="text-white transition-opacity hover:opacity-70">
                close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= Entrance: projector line, then the frame opens ================= */}
      {!reduce && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[70]">
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

      <Cursor />
    </main>
  );
}

// ===========================================================================
// VIEWFINDER NAVBAR
// The whole screen reads like a camera monitor: crop marks in the corners,
// a recording readout top-right, and nav links that a focus box snaps onto
// as you hover, while the label "re-focuses" through scrambled letters.
// ===========================================================================
function Viewfinder({ reduce, hidden }: { reduce: boolean; hidden: boolean }) {
  const [focus, setFocus] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const fade = reduce
    ? {}
    : {
        initial: { opacity: 0, y: -12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 1.2, ease: EASE_OUT, delay: T.nav },
      };

  return (
    <>
      {/* Corner crop marks */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-3 z-50 sm:inset-5"
        initial={reduce ? false : { opacity: 0, scale: 1.04 }}
        animate={{ opacity: hidden ? 0.4 : 1, scale: 1 }}
        transition={{ duration: 1.4, ease: EASE_OUT, delay: hidden ? 0 : T.nav - 0.2 }}
      >
        {(["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"] as const).map(
          (pos) => (
            <span key={pos} className={`absolute h-5 w-5 border-white/45 sm:h-7 sm:w-7 ${pos}`} />
          )
        )}
      </motion.div>

      <div
        className="absolute inset-x-0 top-0 z-50 transition-opacity duration-500"
        style={{ opacity: hidden ? 0 : 1, pointerEvents: hidden ? "none" : "auto" }}
      >
      <motion.header {...fade} className="relative flex items-center justify-between px-6 pt-6 sm:px-12 sm:pt-9">
        {/* Logo */}
        <a href="/" aria-label={`${BRAND}, home`} className="block opacity-90 transition-opacity hover:opacity-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt={BRAND} className="h-9 w-auto sm:h-11" />
        </a>

        {/* Links with a snapping focus box */}
        <LayoutGroup id="viewfinder-nav">
          <nav
            aria-label="Main"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
            onMouseLeave={() => setFocus(null)}
          >
            {NAV.map((n, i) => (
              <a
                key={n.label}
                href={n.href}
                onMouseEnter={() => setFocus(i)}
                onFocus={() => setFocus(i)}
                onBlur={() => setFocus(null)}
                className={`relative px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.3em] transition-colors duration-300 ${
                  focus === i ? "text-white" : "text-white/60"
                }`}
              >
                <Scramble text={n.label} active={focus === i && !reduce} />
                <AnimatePresence>
                  {focus === i && (
                    <motion.span
                      layoutId="focus-box"
                      aria-hidden
                      className="absolute inset-0"
                      initial={{ opacity: 0, scale: 1.25 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.15 }}
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    >
                      <FocusCorners />
                    </motion.span>
                  )}
                </AnimatePresence>
              </a>
            ))}
          </nav>
        </LayoutGroup>

        {/* Recording readout / menu on phones */}
        <div className="flex items-center gap-6">
          
            
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="viewfinder-menu"
            className="relative px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3em] text-white md:hidden"
          >
            {open ? "Close" : "Menu"}
            <span aria-hidden className="absolute inset-0">
              <FocusCorners />
            </span>
          </button>
        </div>
      </motion.header>
      </div>

      {/* Full-screen menu on phones */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="viewfinder-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ clipPath: "inset(50% 0% 50% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            exit={{ clipPath: "inset(50% 0% 50% 0%)" }}
            transition={{ duration: 0.7, ease: EASE_CINE }}
            className="fixed inset-0 z-[48] flex flex-col justify-between bg-black px-6 pb-10 pt-32 md:hidden"
          >
            <nav aria-label="Menu" className="flex flex-col gap-3">
              {NAV.map((n) => (
                <a
                  key={n.label}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="text-[clamp(2.25rem,11vw,3.5rem)] uppercase leading-none text-white"
                  style={HEAD}
                >
                  {n.label}
                </a>
              ))}
            </nav>
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium uppercase tracking-[0.25em] text-white/60"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Four camera-style focus corners that fill their parent
function FocusCorners() {
  const base = "absolute h-2 w-2 border-white";
  return (
    <>
      <span className={`${base} left-0 top-0 border-l border-t`} />
      <span className={`${base} right-0 top-0 border-r border-t`} />
      <span className={`${base} bottom-0 left-0 border-b border-l`} />
      <span className={`${base} bottom-0 right-0 border-b border-r`} />
    </>
  );
}

// Letters flicker through random characters and resolve left to right
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function Scramble({ text, active }: { text: string; active: boolean }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!active) {
      setOut(text);
      return;
    }
    let frame = 0;
    const total = text.length * 2 + 4;
    const id = window.setInterval(() => {
      frame++;
      const resolved = Math.floor((frame / total) * text.length);
      setOut(
        text
          .split("")
          .map((ch, i) => (i < resolved || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join("")
      );
      if (frame >= total) {
        window.clearInterval(id);
        setOut(text);
      }
    }, 28);
    return () => window.clearInterval(id);
  }, [active, text]);
  return (
    <span className="relative inline-block tabular-nums">
      {/* keeps the width steady while letters change */}
      <span className="invisible">{text}</span>
      <span className="absolute inset-0" aria-hidden>
        {out}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

// ===========================================================================
// TIMECODE — a running HH:MM:SS:FF counter, updated without re-rendering
// ===========================================================================
function Timecode() {
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
            ? { width: 74, height: 74, marginLeft: -37, marginTop: -37, opacity: 1 }
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
              className="text-[10px] font-semibold uppercase tracking-[0.15em]"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}