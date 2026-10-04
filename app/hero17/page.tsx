"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { animate, motion, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";
import { Archivo } from "next/font/google";
import styles from "./hero17.module.css";

// ===========================================================================
// HERO 17 — "Shadow box". A paper diorama, white with black ink.
//
// The screen is a stack of white sheets, each with a window cut through it,
// nested and set at different depths: soft shadows fall from every cut edge
// onto the sheet below. The film sits in the deepest window, whole.
//
// Opening: a blank white page; the sheets are cut open one by one, from the
// outside in, until the film shows in the deepest window.
// 16×9: a landscape shadow box. 9×16: the sheets turn a quarter one after the
// other, a cascade of paper, into a portrait box (the film stays upright).
// Beyond: the sheets fly past the camera, the nearest first, and you fall
// through the frames into the film.
// The pointer shifts the sheets by their depth, so the box tilts like an
// object. The switcher is three paper cards with the format cut into each.
//
// Smooth: sheets are solid panels and shadows drawn once, all moved by
// transform; one film plays at a time.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

const LOGO_SRC = "/logo.png";
const NAV = [
  { label: "Who we are", href: "#who-we-are" },
  { label: "Contact", href: "#contact" },
];

type Cut = { src: string; poster: string; aspect: number };
type Film = { desk: Cut; small: Cut };
const F = "/hero14/films";
const V = 608 / 1080;
type Mode = {
  key: string;
  no: string;
  label: string;
  line: string;
  detail: string;
  href: string;
  film: Film;
  portrait: boolean;
  beyond: boolean;
};

const MODES: Mode[] = [
  {
    key: "16x9",
    no: "01",
    label: "16×9",
    line: "Films for the big screen",
    detail: "TVCs · Brand films · Documentaries",
    href: "#16x9",
    film: {
      desk: { src: `${F}/wide-1080.mp4`, poster: `${F}/wide.webp`, aspect: 16 / 9 },
      small: { src: `${F}/wide-540.mp4`, poster: `${F}/wide-540.webp`, aspect: 16 / 9 },
    },
    portrait: false,
    beyond: false,
  },
  {
    key: "9x16",
    no: "02",
    label: "9×16",
    line: "Stories made for the scroll",
    detail: "Social · Branded content",
    href: "#9x16",
    film: {
      desk: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: V },
      small: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: V },
    },
    portrait: true,
    beyond: false,
  },
  {
    key: "beyond",
    no: "03",
    label: "Beyond",
    line: "Stories you step into",
    detail: "Immersive · Interactive",
    href: "#beyond",
    film: {
      desk: { src: `${F}/beyond-1080.mp4`, poster: `${F}/beyond.webp`, aspect: 16 / 9 },
      small: { src: `${F}/beyond-m.mp4`, poster: `${F}/beyond-m.webp`, aspect: V },
    },
    portrait: false,
    beyond: true,
  },
];

// ---- the sheets ----
const SHEETS = 4; // 0 = the deepest (holds the film), SHEETS-1 = the nearest
const PAD = 0.09; // each sheet's window is this much (of the film's width) bigger than the one below
const TONES = ["#e4e3df", "#eeedea", "#f6f5f3", "#ffffff"]; // deeper sheets catch less light
// each sheet sits a touch off true, as cut paper laid by hand (the film's window stays straight)
const TILT = [0, 1.4, -1.8, 0.9];
const DEPTH = 9; // px the nearest sheet shifts with the pointer (the deepest doesn't move)

const T = {
  cut: 0.45, // the first (nearest) sheet is cut open
  cutStep: 0.16, // then each one below
  cutDur: 1.25,
  ui: 1.9,
  settle: 3.6,
};
const MORPH = 1.35;
const MORPH_BEYOND = 1.6;
const STAGGER = 0.08; // the cascade, between sheets
const DWELL = 6.5;
const PAN = 2.5;
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

function Ratio({ text }: { text: string }) {
  const [a, b] = text.split("×");
  if (b === undefined) return <>{text}</>;
  return (
    <>
      {a}
      <span className={styles.by}>x</span>
      {b}
    </>
  );
}

/** The format, cut into a little paper card. */
function CardIcon({ k }: { k: string }) {
  if (k === "16x9")
    return (
      <svg viewBox="0 0 48 32" aria-hidden="true">
        <rect x="4" y="4" width="40" height="24" />
        <rect x="11" y="9" width="26" height="14" />
      </svg>
    );
  if (k === "9x16")
    return (
      <svg viewBox="0 0 48 32" aria-hidden="true">
        <rect x="14" y="2" width="20" height="28" />
        <rect x="19" y="7" width="10" height="18" />
      </svg>
    );
  return (
    <svg viewBox="0 0 48 32" aria-hidden="true">
      <path d="M4 10V4h8M36 4h8v6M44 22v6h-8M12 28H4v-6" />
      <path d="M17 13l-5-4M31 13l5-4M31 19l5 4M17 19l-5 4" />
    </svg>
  );
}

const PORTRAIT_Q = "(max-aspect-ratio: 1/1)";
const subscribePortrait = (cb: () => void) => {
  const mq = window.matchMedia(PORTRAIT_Q);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const noopSubscribe = () => () => {};

type Engine = { go: (i: number) => void; inside: (x: number, y: number) => boolean; refresh: () => void };

export default function Hero17() {
  const reduce = !!useReducedMotion();
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const portraitScreen = useSyncExternalStore(
    subscribePortrait,
    () => window.matchMedia(PORTRAIT_Q).matches,
    () => false
  );
  const [mode, setMode] = useState(0);
  const m = MODES[mode];

  const [ready, setReady] = useState(reduce);
  const readyRef = useRef(reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => {
      readyRef.current = true;
      setReady(true);
    }, T.settle * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const filmsRef = useRef<HTMLDivElement>(null);
  const sheetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const ringRefs = useRef<(SVGRectElement | null)[]>([]);
  const engineRef = useRef<Engine | null>(null);
  const modeRef = useRef(0);
  const pausedRef = useRef(false);

  // ---- the engine: places the sheets, their windows and the film ----
  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const films = filmsRef.current;
    const sheets = sheetRefs.current;
    if (!root || !stage || !films || sheets.some((s) => !s)) return;
    const sheetEls = sheets as HTMLDivElement[];
    // each sheet: four solid panels round its window, and the shadow its cut edge casts
    const parts = sheetEls.map((el) => ({
      panels: Array.from(el.querySelectorAll<HTMLElement>(`.${styles.panel}`)),
      shadow: el.querySelector<HTMLElement>(`.${styles.cut}`)!,
    }));

    const geo = { cx: 0, cy: 0, W: 1, H: 1, vw: 1, vh: 1, left: 0, top: 0, pad: 1, B: 1 };
    const filmBase = new Map<HTMLVideoElement, { w: number; h: number }>();
    const measure = () => {
      const r = root.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      geo.left = r.left;
      geo.top = r.top;
      geo.vw = r.width;
      geo.vh = r.height;
      geo.cx = s.left - r.left + s.width / 2;
      geo.cy = s.top - r.top + s.height / 2;
      // the film's window: as big as leaves room for the sheets round it
      const narrow = r.width <= 760;
      // (the outermost sheet's window is 1 + 6·PAD of this, so keep it clear of the line and the cards)
      geo.W = Math.min(s.width * (narrow ? 0.62 : 0.36), (s.height * 0.5 * 16) / 9);
      geo.H = (geo.W * 9) / 16;
      geo.pad = geo.W * PAD;
      geo.B = Math.ceil(2 * Math.hypot(r.width, r.height));
      sheetEls.forEach((_, i) => {
        const { panels, shadow } = parts[i];
        panels.forEach((p, j) => {
          p.style.width = `${j < 2 ? 2 * geo.B : geo.B}px`;
          p.style.height = `${j < 2 ? geo.B : 2 * geo.B}px`;
        });
        // the shadow, drawn once at the window's resting size
        const sw = geo.W + 2 * i * geo.pad;
        const sh = geo.H + 2 * i * geo.pad;
        shadow.style.width = `${sw}px`;
        shadow.style.height = `${sh}px`;
        shadow.style.marginLeft = `${-sw / 2}px`;
        shadow.style.marginTop = `${-sh / 2}px`;
      });
      filmBase.clear();
      videoRefs.current.forEach((v) => {
        if (!v) return;
        const a = Number(v.dataset.aspect) || 16 / 9;
        const w = a >= 1 ? geo.W : geo.W * a;
        const h = a >= 1 ? geo.W / a : geo.W;
        v.style.width = `${w}px`;
        v.style.height = `${h}px`;
        v.style.marginLeft = `${-w / 2}px`;
        v.style.marginTop = `${-h / 2}px`;
        filmBase.set(v, { w, h });
      });
    };
    measure();

    // each sheet's turn and scale (s: 0 = cut shut, 1 = open at rest)
    const ang = reduce ? [...TILT] : new Array(SHEETS).fill(0);
    const sc = new Array(SHEETS).fill(reduce ? 1 : 0.0001);
    let angleTarget = 0;
    let current = 0;
    let prog = 0;
    const pan = { x: 0, y: 0 }; // the pointer, -1…1, eased
    const look = { x: 0, y: 0 }; // Beyond's look-around, %

    const scaleFor = (i: number) => {
      const md = MODES[i];
      const { cx, cy, W, H, vw, vh } = geo;
      if (md.beyond) return Math.max((2 * Math.max(cx, vw - cx)) / W, (2 * Math.max(cy, vh - cy)) / H) * 1.1;
      if (md.portrait) {
        const room = Math.min(geo.vh - 2 * 24, stage.getBoundingClientRect().height);
        return Math.min((room * 0.86) / (W + 2 * (SHEETS - 1) * geo.pad), (0.9 * vw) / (H + 2 * (SHEETS - 1) * geo.pad));
      }
      return 1;
    };

    const f1 = (n: number) => n.toFixed(1);
    const render = () => {
      const { cx, cy, W, H, vw, vh, B, pad } = geo;
      for (let i = 0; i < SHEETS; i++) {
        const s = sc[i];
        const hw = (W / 2 + i * pad) * s;
        const hh = (H / 2 + i * pad) * s;
        const ox = pan.x * DEPTH * (i / (SHEETS - 1));
        const oy = pan.y * DEPTH * 0.7 * (i / (SHEETS - 1));
        const el = sheetEls[i];
        el.style.transform = `translate3d(${f1(cx + ox)}px, ${f1(cy + oy)}px, 0) rotate(${ang[i].toFixed(3)}deg)`;
        const { panels, shadow } = parts[i];
        const spots: [number, number][] = [
          [-B, -hh - B],
          [-B, hh],
          [-hw - B, -B],
          [hw, -B],
        ];
        panels.forEach((p, j) => (p.style.transform = `translate3d(${f1(spots[j][0])}px, ${f1(spots[j][1])}px, 0)`));
        shadow.style.transform = `scale(${s.toFixed(4)})`;
        // the shadow only shows near the sheet's resting size: as it flies off it
        // fades, so it is never drawn huge
        const so = Math.max(0, Math.min(1, 1 - (s - 1.05) / 0.25));
        shadow.style.opacity = so.toFixed(3);
        const sv = so <= 0 ? "hidden" : "";
        if (shadow.style.visibility !== sv) shadow.style.visibility = sv;
        const gone = s > 1.6 && MODES[current].beyond ? "hidden" : "";
        if (el.style.visibility !== gone) el.style.visibility = gone;
      }
      // the film: in the deepest window, upright, filling it (the whole film shows)
      const a0 = (ang[0] * Math.PI) / 180;
      const c = Math.abs(Math.cos(a0));
      const sn = Math.abs(Math.sin(a0));
      const hwN = (W / 2) * Math.max(sc[0], 0.0001);
      const hhN = (H / 2) * Math.max(sc[0], 0.0001);
      const hx = Math.min(c * hwN + sn * hhN, Math.max(cx, vw - cx) * 1.06);
      const hy = Math.min(sn * hwN + c * hhN, Math.max(cy, vh - cy) * 1.06);
      filmBase.forEach((b, v) => {
        v.style.transform = `scale(${Math.max((2 * hx) / b.w, (2 * hy) / b.h).toFixed(4)})`;
      });
      films.style.transform = `translate3d(${f1(cx + (look.x / 100) * vw)}px, ${f1(cy + (look.y / 100) * vh)}px, 0)`;
    };

    // one tween per sheet, so they can cascade
    const tweens: (AnimationPlaybackControls | undefined)[] = [];
    const running = new Array(SHEETS).fill(false);
    const toSheet = (i: number, a: number, s: number, duration: number, delay: number, ease: readonly number[]) => {
      tweens[i]?.stop();
      if (reduce) {
        ang[i] = a;
        sc[i] = s;
        render();
        return;
      }
      const a0 = ang[i];
      const s0 = sc[i];
      const logScale = s0 > 0.01 && s > 0.01;
      running[i] = true;
      tweens[i] = animate(0, 1, {
        duration,
        delay,
        ease: [...ease] as [number, number, number, number],
        onUpdate: (p) => {
          ang[i] = a0 + (a - a0) * p;
          sc[i] = logScale ? Math.exp(Math.log(s0) + (Math.log(s) - Math.log(s0)) * p) : s0 + (s - s0) * p;
          render();
        },
        onComplete: () => {
          running[i] = false;
        },
      });
    };

    const go = (i: number) => {
      if (i === current) return;
      const md = MODES[i];
      const was = MODES[current];
      const portraitNow = ((Math.round(angleTarget / 90) % 2) + 2) % 2 === 1;
      if (md.portrait !== portraitNow) angleTarget += 90;
      const target = scaleFor(i);
      const dur = md.beyond || was.beyond ? MORPH_BEYOND : MORPH;
      for (let k = 0; k < SHEETS; k++) {
        if (md.beyond) {
          // fall through the frames: the nearest sheet flies past first, each further out
          toSheet(k, angleTarget + TILT[k], target * (1 + k * 0.9), dur, (SHEETS - 1 - k) * STAGGER, EASE_CINE);
        } else if (was.beyond) {
          // and back: the deepest settles first, the nearest last
          toSheet(k, angleTarget + TILT[k], target, dur, k * STAGGER, EASE_CINE);
        } else {
          // the cascade: the deepest turns first, the paper follows
          toSheet(k, angleTarget + TILT[k], target, dur, k * STAGGER, EASE_CINE);
        }
      }
      current = i;
      prog = 0;
      ringRefs.current.forEach((r) => r && r.style.setProperty("stroke-dashoffset", "1"));
    };

    const inside = (x: number, y: number) => {
      if (MODES[current].beyond) return true;
      const dx = x - geo.cx;
      const dy = y - geo.cy;
      const rad = (-ang[0] * Math.PI) / 180;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      return Math.abs(lx) <= (geo.W * sc[0]) / 2 && Math.abs(ly) <= (geo.H * sc[0]) / 2;
    };
    const refresh = () => {
      measure();
      render();
    };
    engineRef.current = { go, inside, refresh };
    render();

    // ---- the opening: the sheets are cut open from the outside in ----
    const timers: number[] = [];
    if (!reduce) {
      for (let k = SHEETS - 1; k >= 0; k--) {
        const order = SHEETS - 1 - k;
        timers.push(window.setTimeout(() => toSheet(k, TILT[k], 1, T.cutDur, 0, EASE_CINE), (T.cut + order * T.cutStep) * 1000));
      }
    }

    const onResize = () => {
      measure();
      if (running.every((r) => !r)) {
        const s = scaleFor(current);
        for (let k = 0; k < SHEETS; k++) sc[k] = MODES[current].beyond ? s * (1 + k * 0.9) : s;
      }
      render();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);
    ro.observe(stage);

    // ---- pointer: the box tilts by depth; Beyond looks around ----
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const p = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      p.x = ((e.clientX - geo.left) / geo.vw) * 2 - 1;
      p.y = ((e.clientY - geo.top) / geo.vh) * 2 - 1;
      if (e.pointerType !== "mouse") return;
      const overUi = !!(e.target as Element | null)?.closest?.("a, button, header, nav, [data-ui]");
      const on = readyRef.current && !overUi && inside(e.clientX - geo.left, e.clientY - geo.top);
      if (on) root.dataset.onFrame = "";
      else delete root.dataset.onFrame;
    };
    const onLeave = () => {
      p.x = 0;
      p.y = 0;
      delete root.dataset.onFrame;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (readyRef.current && !reduce && !pausedRef.current) {
        prog += dt / DWELL;
        if (prog >= 1) {
          prog = 0;
          setMode((v) => (v + 1) % MODES.length);
        }
        const ring = ringRefs.current[current];
        if (ring) ring.style.setProperty("stroke-dashoffset", (1 - prog).toFixed(4));
      }
      const k = 1 - Math.exp(-dt * 3);
      let moved = false;
      if (fine && !reduce) {
        const nx = pan.x + (p.x - pan.x) * k;
        const ny = pan.y + (p.y - pan.y) * k;
        if (Math.abs(nx - pan.x) > 0.0005 || Math.abs(ny - pan.y) > 0.0005) moved = true;
        pan.x = nx;
        pan.y = ny;
      }
      let tx = 0;
      let ty = 0;
      if (MODES[current].beyond && !reduce) {
        if (fine) {
          tx = -p.x * PAN;
          ty = -p.y * PAN * 0.6;
        } else {
          const t = now / 1000;
          tx = Math.sin(t * 0.22) * PAN;
          ty = Math.sin(t * 0.15) * PAN * 0.4;
        }
      }
      const lx = look.x + (tx - look.x) * (1 - Math.exp(-dt * 2.2));
      const ly = look.y + (ty - look.y) * (1 - Math.exp(-dt * 2.2));
      if (Math.abs(lx - look.x) > 0.001 || Math.abs(ly - look.y) > 0.001) moved = true;
      look.x = lx;
      look.y = ly;
      if (moved && running.every((r) => !r)) render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      tweens.forEach((t) => t?.stop());
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      delete root.dataset.onFrame;
      engineRef.current = null;
    };
  }, [reduce]);

  useEffect(() => {
    engineRef.current?.refresh();
  }, [isClient, portraitScreen]);

  useEffect(() => {
    modeRef.current = mode;
    engineRef.current?.go(mode);
  }, [mode]);

  useEffect(() => {
    const vids = videoRefs.current;
    const v = vids[mode];
    if (v) {
      v.muted = true;
      v.setAttribute("muted", "");
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    const t = window.setTimeout(() => {
      vids.forEach((o, i) => {
        if (o && i !== mode) o.pause();
      });
    }, 1600);
    return () => window.clearTimeout(t);
  }, [mode, isClient, portraitScreen]);

  useEffect(() => {
    if (!ready) return;
    videoRefs.current.forEach((v) => {
      if (v) v.preload = "auto";
    });
  }, [ready]);

  const select = useCallback((i: number) => {
    if (!readyRef.current) return;
    setMode(i);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!readyRef.current) return;
      if (e.key === "ArrowRight") setMode((v) => (v + 1) % MODES.length);
      if (e.key === "ArrowLeft") setMode((v) => (v + MODES.length - 1) % MODES.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onStageClick = (e: ReactMouseEvent<HTMLElement>) => {
    const root = rootRef.current;
    if (!readyRef.current || !root) return;
    if ((e.target as Element).closest("a, button, nav, header, [data-ui]")) return;
    const r = root.getBoundingClientRect();
    if (engineRef.current?.inside(e.clientX - r.left, e.clientY - r.top)) {
      window.location.hash = MODES[modeRef.current].href.slice(1);
    }
  };
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: ReactPointerEvent<HTMLElement>) => {
    swipe.current = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: ReactPointerEvent<HTMLElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || !readyRef.current) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      setMode((v) => (v + (dx < 0 ? 1 : MODES.length - 1)) % MODES.length);
    }
  };

  const enter = (delay: number, y = 10) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0, transition: { delay, duration: 1.1, ease: EASE } },
        };

  return (
    <section
      ref={rootRef}
      className={`${styles.root} ${wide.variable} ${m.beyond ? styles.isBeyond : ""}`}
      aria-label="16x9 & Beyond — Stories beyond the frame"
      onClick={onStageClick}
      onPointerDown={onDown}
      onPointerUp={onUp}
    >
      {/* ================= the film, in the deepest window ================= */}
      <div className={styles.back} aria-hidden="true" />
      <div ref={filmsRef} className={styles.films} aria-hidden="true">
        {isClient &&
          MODES.map((md, i) => {
            const cut = portraitScreen ? md.film.small : md.film.desk;
            return (
              <video
                key={md.key}
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                className={`${styles.film} ${i === mode ? styles.filmOn : ""}`}
                src={cut.src}
                poster={cut.poster}
                data-aspect={cut.aspect}
                muted
                loop
                playsInline
                autoPlay={i === 0 && !reduce}
                preload={i === 0 ? "auto" : "metadata"}
                disablePictureInPicture
              />
            );
          })}
      </div>

      {/* ================= the sheets of paper, deepest first ================= */}
      {Array.from({ length: SHEETS }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            sheetRefs.current[i] = el;
          }}
          className={styles.sheet}
          style={{ zIndex: 2 + i, ["--tone" as string]: TONES[i] }}
          aria-hidden="true"
        >
          <span className={styles.panel} />
          <span className={styles.panel} />
          <span className={styles.panel} />
          <span className={styles.panel} />
          <span className={styles.cut} />
        </div>
      ))}

      <div className={styles.shade} aria-hidden="true" />
      <div ref={stageRef} className={styles.stage} aria-hidden="true" />

      {/* ================= top bar ================= */}
      <motion.header className={styles.topbar} {...enter(T.ui, -10)}>
        <a href="#top" className={styles.logo} aria-label="16x9 & Beyond — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9 & Beyond" />
        </a>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={styles.navLink}>
              <span className={styles.roll}>
                <span>{n.label}</span>
                <span aria-hidden="true">{n.label}</span>
              </span>
            </a>
          ))}
        </nav>
      </motion.header>

      {/* ================= the line, on the paper ================= */}
      <motion.h1 className={styles.logline} {...enter(T.ui + 0.05)}>
        <span>Stories beyond</span>
        <span>the frame</span>
      </motion.h1>
      <motion.p className={styles.place} {...enter(T.ui + 0.15)}>
        16x9 &amp; Beyond
        <span>A film studio · Dubai</span>
      </motion.p>

      {/* ================= the foot: the format's line, the cards, the way in ================= */}
      <motion.div className={styles.foot} data-ui {...enter(T.ui + 0.1)}>
        <div className={styles.now}>
          <p key={m.key} className={styles.nowText}>
            <span className={styles.nowNo}>{m.no}</span>
            {m.line}
            <span className={styles.nowDetail}>{m.detail}</span>
          </p>
        </div>

        <nav
          className={styles.cards}
          aria-label="Formats"
          onPointerEnter={() => (pausedRef.current = true)}
          onPointerLeave={() => (pausedRef.current = false)}
        >
          {MODES.map((md, i) => (
            <button
              key={md.key}
              type="button"
              className={`${styles.card} ${i === mode ? styles.cardOn : ""}`}
              aria-pressed={i === mode}
              aria-label={`${md.label} — ${md.line}`}
              disabled={!ready}
              onClick={() => select(i)}
            >
              <span className={styles.cardPaper}>
                <CardIcon k={md.key} />
                {/* the timer: a line drawn round the card's edge */}
                <svg className={styles.ring} viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">
                  <rect
                    ref={(el) => {
                      ringRefs.current[i] = el;
                    }}
                    x="0.5"
                    y="0.5"
                    width="99"
                    height="69"
                    pathLength={1}
                  />
                </svg>
              </span>
              <span className={styles.cardLabel}>
                <Ratio text={md.label} />
              </span>
            </button>
          ))}
        </nav>

        <a href={m.href} className={styles.go}>
          <span className={styles.roll}>
            <span>Explore</span>
            <span aria-hidden="true">Explore</span>
          </span>
          <span className={styles.goArrow} aria-hidden="true">
            →
          </span>
        </a>
      </motion.div>
    </section>
  );
}
