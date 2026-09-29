"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

// ---------------------------------------------------------------------------
// Content: replace with your clips (compressed, ~3-6 MB each) and titles.
// ---------------------------------------------------------------------------
type Category = "direction" | "motion" | "design";
type Clip = { id: number; title: string; category: Category; src: string; poster?: string };

const CLIPS: Clip[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  title: `Project ${String(i + 1).padStart(2, "0")}`,
  category: (["direction", "motion", "design"] as Category[])[i % 3],
  src: `/Aldar - The Promise.mp4`,
}));
const N = CLIPS.length;

// Where each clip floats: x / y = fraction of the viewport from centre,
// w = fraction of viewport width, a = aspect ratio, rx / ry = tilt in degrees.
type Place = { x: number; y: number; w: number; a: number; rx: number; ry: number };
const PLACES: Place[] = [
  { x: -0.34, y: -0.28, w: 0.12, a: 4 / 5, rx: -4, ry: 26 },
  { x: -0.02, y: -0.36, w: 0.36, a: 2.4, rx: 0, ry: 0 },
  { x: 0.4, y: -0.24, w: 0.13, a: 2 / 3, rx: 3, ry: -28 },
  { x: 0.02, y: 0.02, w: 0.3, a: 16 / 9, rx: 0, ry: 0 },
  { x: 0.36, y: 0.2, w: 0.07, a: 1 / 2, rx: 0, ry: -18 },
  { x: -0.41, y: 0.27, w: 0.1, a: 3 / 4, rx: 2, ry: 22 },
  { x: -0.14, y: 0.34, w: 0.26, a: 16 / 9, rx: 0, ry: 0 },
  { x: 0.3, y: -0.02, w: 0.17, a: 1, rx: 0, ry: -12 },
  { x: -0.3, y: 0.02, w: 0.19, a: 16 / 10, rx: -2, ry: 14 },
  { x: 0.17, y: 0.32, w: 0.16, a: 4 / 3, rx: 4, ry: -8 },
  { x: -0.16, y: -0.18, w: 0.11, a: 3 / 4, rx: 0, ry: 10 },
  { x: 0.2, y: -0.3, w: 0.15, a: 16 / 9, rx: -3, ry: -14 },
];

// ---------------------------------------------------------------------------
// Space
// ---------------------------------------------------------------------------
const PERSP = 1000; // camera distance in px
const DEPTH = 4200; // length of the looping corridor of clips
const BACK = 3400; // how far behind the focus plane the corridor reaches
const FOCUS_Z = 120; // where a selected clip comes to rest
const DRIFT = 28; // px per second the camera floats forward on its own
const Z0 = PLACES.map((_, i) => -(((i * 5) % N) * DEPTH) / N); // scatter depth order

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const wrap = (v: number) => ((((v + BACK) % DEPTH) + DEPTH) % DEPTH) - BACK;

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const HEADLINE = "WATCHED TWICE";
const DISPLAY = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Instrument Serif', 'Times New Roman', serif";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Instrument+Serif:ital@0;1&display=swap');
@keyframes fr-grain {
  0%,100% { transform: translate(0,0) } 20% { transform: translate(-4%,3%) }
  40% { transform: translate(3%,-5%) } 60% { transform: translate(-2%,-3%) } 80% { transform: translate(5%,2%) }
}
.fr-grain { animation: fr-grain 0.9s steps(5) infinite; }
@media (prefers-reduced-motion: reduce) { .fr-grain { animation: none; } }
`;

export default function FloatingReel() {
  const reduce = !!useReducedMotion();
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [moved, setMoved] = useState(false);

  const selRef = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const camTarget = useRef(0);
  const ptr = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const size = useRef({ vw: 1440, vh: 900 });
  const worldRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const headRef = useRef<HTMLHeadingElement>(null);

  // Cursor disc
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const cx = useSpring(mx, { stiffness: 700, damping: 45, mass: 0.35 });
  const cy = useSpring(my, { stiffness: 700, damping: 45, mass: 0.35 });

  useEffect(() => {
    selRef.current = selected;
    if (selected === null) setSoundOn(false);
  }, [selected]);
  useEffect(() => {
    hoverRef.current = hovered;
  }, [hovered]);

  const markMoved = () => {
    if (movedRef.current) return;
    movedRef.current = true;
    setMoved(true);
  };

  // Tile sizes follow the viewport
  useEffect(() => {
    const apply = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      size.current = { vw, vh };
      PLACES.forEach((p, i) => {
        const el = tileRefs.current[i];
        if (!el) return;
        const w = Math.max(p.w * vw, 96);
        el.style.width = `${w}px`;
        el.style.height = `${w / p.a}px`;
      });
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // -------------------------------------------------------------------------
  // Render loop: camera drift, parallax, depth of field, and the flight of a
  // selected clip to the centre (with everything else falling back).
  // -------------------------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    let last = start;
    let cam = camTarget.current;
    let px = 0;
    let py = 0;
    let g = 0;
    let t = 0;
    const sel = PLACES.map(() => 0);
    const hov = PLACES.map(() => 0);
    const lastFilter = PLACES.map(() => "");
    const lastPE = PLACES.map(() => "");

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const k = (rate: number) => 1 - Math.exp(-dt * (reduce ? 40 : rate));
      const selectedId = selRef.current;

      if (!reduce && selectedId === null) camTarget.current += DRIFT * dt;
      cam += (camTarget.current - cam) * k(3.5);

      // Intro: the whole field rushes in from deep space
      const ip = reduce ? 1 : clamp01(((now - start) / 1000 - 0.3) / 3.2);
      const intro = 1 - Math.pow(1 - ip, 4);

      if (!reduce) {
        px += (ptr.current.x - px) * k(2.5);
        py += (ptr.current.y - py) * k(2.5);
      }
      if (worldRef.current) worldRef.current.style.transform = `rotateX(${-py * 5}deg) rotateY(${px * 7}deg)`;

      g += ((selectedId !== null ? 1 : 0) - g) * k(4.5);
      const { vw, vh } = size.current;

      for (let i = 0; i < N; i++) {
        const el = tileRefs.current[i];
        if (!el) continue;
        const p = PLACES[i];
        const id = CLIPS[i].id;

        sel[i] += ((selectedId === id ? 1 : 0) - sel[i]) * k(4);
        hov[i] += ((hoverRef.current === id ? 1 : 0) - hov[i]) * k(7);
        const s = smooth(clamp01(sel[i]));
        const h = hov[i];
        const others = g * (1 - sel[i]);

        const rel = wrap(Z0[i] + cam) - (1 - intro) * 2600;
        const w = Math.max(p.w * vw, 96);
        const hgt = w / p.a;
        const bob = reduce ? 0 : Math.sin(t * 0.55 + i * 1.7) * 12;

        // Floating pose -> centre pose
        const fx = p.x * vw;
        const fy = p.y * vh + bob;
        const fz = rel + h * 90 - others * 900;
        const targetW = Math.min(vw * 0.62, vh * 0.6 * p.a);
        const targetScale = targetW / (w * (PERSP / (PERSP - FOCUS_Z)));

        const x = lerp(fx, 0, s);
        const y = lerp(fy, 0, s);
        const z = lerp(fz, FOCUS_Z, s);
        const rx = lerp(p.rx * (1 - h * 0.6), 0, s);
        const ry = lerp(p.ry * (1 - h * 0.6), 0, s);
        const sc = lerp(1, targetScale, s);
        el.style.transform = `translate3d(${x - w / 2}px, ${y - hgt / 2}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})`;

        // Fog at the back, fade as it passes the camera
        const fog = clamp01((rel + BACK) / 800) * clamp01((820 - rel) / 420);
        const op = lerp(fog * (1 - others * 0.75) * clamp01(ip * 1.6), 1, s);
        el.style.opacity = op.toFixed(3);

        // Depth of field: sharp at the focus plane, softer with distance.
        // Hover pulls focus; a selection throws everything else out of focus.
        const depthBlur = Math.min(12, Math.abs(rel) / 170) * (1 - h) + others * 6;
        const blur = Math.round(lerp(depthBlur, 0, s) * 2) / 2;
        const lit = (0.4 + 0.6 * clamp01(1 - Math.abs(rel) / 3200)) * (1 - others * 0.45) + h * 0.35;
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
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
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
      if (v) v.muted = !(soundOn && CLIPS[i].id === selected);
    });
  }, [soundOn, selected]);

  // Input: wheel / swipe to drift, pointer for parallax, keys for everything
  useEffect(() => {
    let touching = false;
    let startY = 0;
    let lastY = 0;

    const onWheel = (e: WheelEvent) => {
      if (selRef.current !== null) return;
      camTarget.current += e.deltaY * 1.2;
      markMoved();
    };
    const onDown = (e: PointerEvent) => {
      dragged.current = false;
      if (e.pointerType === "mouse") return;
      touching = true;
      startY = lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      ptr.current = { x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 };
      if (touching && selRef.current === null) {
        camTarget.current -= (e.clientY - lastY) * 4;
        lastY = e.clientY;
        if (Math.abs(e.clientY - startY) > 8) {
          dragged.current = true;
          markMoved();
        }
      }
    };
    const onUp = () => {
      touching = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const s = selRef.current;
      if (e.key === "Escape") setSelected(null);
      else if (s !== null && e.key === "ArrowRight") step(1);
      else if (s !== null && e.key === "ArrowLeft") step(-1);
      else if (s === null && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        camTarget.current += e.key === "ArrowDown" ? 420 : -420;
        markMoved();
      }
    };
    const onVisibility = () =>
      videoRefs.current.forEach((v) => v && (document.hidden ? v.pause() : v.play().catch(() => {})));

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Headline always spans the full width, whatever the font or screen
  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "100px";
      el.style.fontSize = `${(100 * window.innerWidth * 0.95) / el.scrollWidth}px`;
    };
    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const selectedClip = selected !== null ? CLIPS[selected - 1] : null;
  const cursorLabel =
    hovered === null ? null : hovered === selected ? (soundOn ? "mute" : "sound") : "play";

  return (
    <main className="relative h-dvh w-full touch-none select-none overflow-hidden bg-black text-[#ece6d8] antialiased">
      <style>{CSS}</style>

      {/* 3D space */}
      <div
        className="absolute inset-0"
        style={{ perspective: `${PERSP}px`, perspectiveOrigin: "50% 50%" }}
        onClick={() => {
          if (!dragged.current) setSelected(null);
        }}
      >
        <div ref={worldRef} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
          {CLIPS.map((clip, i) => (
            <button
              key={clip.id}
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              type="button"
              aria-label={selected === clip.id ? `${clip.title}, toggle sound` : `Open ${clip.title}`}
              onClick={(e) => {
                e.stopPropagation();
                if (dragged.current) return;
                if (selected === clip.id) toggleSound();
                else setSelected(clip.id);
              }}
              onPointerEnter={() => setHovered(clip.id)}
              onPointerLeave={() => setHovered((h) => (h === clip.id ? null : h))}
              onFocus={() => setHovered(clip.id)}
              onBlur={() => setHovered(null)}
              className="absolute left-0 top-0 block overflow-hidden bg-[#0d0d0d] opacity-0 outline-none [backface-visibility:hidden] [will-change:transform,filter,opacity] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[#ece6d8] [@media(pointer:fine)]:cursor-none"
            >
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={clip.src}
                poster={clip.poster}
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

      {/* Headline: blends into the footage behind it */}
      <motion.div
        animate={{ opacity: selected !== null ? 0 : 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center mix-blend-screen"
      >
        <h1
          ref={headRef}
          aria-label="Watched twice"
          className="whitespace-nowrap leading-[0.82] text-[#e0301e]"
          style={{ fontFamily: DISPLAY, fontWeight: 900, fontVariationSettings: "'wdth' 125", letterSpacing: "-0.02em" }}
        >
          <span aria-hidden className="block overflow-hidden pb-[0.04em]">
            {HEADLINE.split("").map((ch, i) => (
              <motion.span
                key={i}
                initial={reduce ? false : { y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.3, ease: EASE_OUT, delay: 2.1 + i * 0.035 }}
                className="inline-block"
              >
                {ch === " " ? "\u00a0" : ch}
              </motion.span>
            ))}
          </span>
        </h1>
      </motion.div>

      {/* Serif line along the bottom */}
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: selected !== null ? 0 : 1 }}
        transition={{ duration: 1.4, ease: EASE_OUT, delay: selected !== null ? 0 : 2.9 }}
        className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex items-end justify-between text-[clamp(2.2rem,6.2vw,6.5rem)] leading-[0.9] text-[#ece6d8] mix-blend-difference sm:inset-x-8 sm:bottom-6"
        style={{ fontFamily: SERIF }}
      >
        <span>We make</span>
        <span className="hidden -translate-y-[0.9em] sm:inline">films worth</span>
        <span className="text-right italic">
          <span className="sm:hidden">films worth </span>a second look
        </span>
      </motion.p>

      <AnimatePresence>
        {!moved && selected === null && (
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 3.6, duration: 1 } }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="pointer-events-none absolute left-1/2 top-[calc(50%+min(9vw,11vh))] z-20 -translate-x-1/2 text-xs text-[#ece6d8]/45"
          >
            scroll to drift through the work
          </motion.p>
        )}
      </AnimatePresence>

      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.75)_100%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[35] overflow-hidden opacity-[0.08]">
        <div className="fr-grain absolute -inset-[50%]" style={{ backgroundImage: GRAIN }} />
      </div>

      {/* Header */}
      <motion.header
        initial={reduce ? false : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: EASE_OUT, delay: 3.0 }}
        className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-4 text-xs sm:px-8 sm:pt-6"
      >
        <a href="/" className="text-[#ece6d8]/85 transition-colors hover:text-[#ece6d8]">
          agency name
        </a>
        <nav aria-label="Main" className="flex items-center gap-5 sm:gap-8">
          <a href="/work" className="hidden text-[#ece6d8]/60 transition-colors hover:text-[#ece6d8] sm:inline">
            work
          </a>
          <a href="/studio" className="hidden text-[#ece6d8]/60 transition-colors hover:text-[#ece6d8] sm:inline">
            studio
          </a>
          <a href="/contact" className="hidden text-[#ece6d8]/60 transition-colors hover:text-[#ece6d8] sm:inline">
            contact
          </a>
          <button
            type="button"
            className="bg-[#ece6d8] px-3 py-1.5 text-black transition-colors hover:bg-[#e0301e] hover:text-[#ece6d8]"
          >
            menu
          </button>
        </nav>
      </motion.header>

      {/* Selected clip: title and controls */}
      <AnimatePresence>
        {selectedClip && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0 : 0.6, duration: 0.9, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.25 } }}
            className="absolute inset-x-0 bottom-0 z-40 flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pb-7"
          >
            <div className="overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedClip.id}
                  initial={reduce ? false : { y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-60%", opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                >
                  <p className="text-[clamp(2rem,4vw,3.75rem)] leading-none" style={{ fontFamily: SERIF }}>
                    {selectedClip.title}
                  </p>
                  <p className="mt-2 text-xs text-[#ece6d8]/50">
                    {selectedClip.category}, {selectedClip.id} of {N}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex gap-5 text-sm text-[#ece6d8]/70">
              <button type="button" onClick={() => step(-1)} className="transition-colors hover:text-[#ece6d8]">
                previous
              </button>
              <button type="button" onClick={() => step(1)} className="transition-colors hover:text-[#ece6d8]">
                next
              </button>
              <button type="button" onClick={toggleSound} className="transition-colors hover:text-[#ece6d8]">
                {soundOn ? "mute" : "sound on"}
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-[#e0301e] transition-colors hover:text-[#ece6d8]"
              >
                close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cursor disc (fine pointers only) */}
      <motion.div
        aria-hidden
        style={{ x: cx, y: cy }}
        className="pointer-events-none fixed left-0 top-0 z-50 hidden [@media(pointer:fine)]:block"
      >
        <motion.div
          animate={
            cursorLabel
              ? { width: 74, height: 74, marginLeft: -37, marginTop: -37, opacity: 1 }
              : { width: 10, height: 10, marginLeft: -5, marginTop: -5, opacity: 0 }
          }
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="grid place-items-center overflow-hidden rounded-full bg-[#e0301e] text-[#ece6d8]"
        >
          <AnimatePresence mode="wait">
            {cursorLabel && (
              <motion.span
                key={cursorLabel}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="text-[11px]"
              >
                {cursorLabel}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </main>
  );
}