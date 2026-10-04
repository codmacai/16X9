"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type AnimationPlaybackControls,
} from "framer-motion";
import { Archivo } from "next/font/google";
import styles from "./hero14.module.css";

// ===========================================================================
// HERO 14 — the homepage. "Stories beyond the frame", played out on screen.
//
// A frame floats in a dark room, the whole film inside it, and the film's
// own light spills out beyond the frame and fills the room, the way a screen
// lights a cinema. The frame is the navigation: it holds 16×9, turns a quarter
// like a phone going vertical to become 9×16 (the film stays upright and
// fills it), and for Beyond it opens past the edges of the screen: the film
// breaks out of the frame, and the visitor can look around it with the
// pointer. The three cycle on their own; the strip at the foot picks one,
// and each leads to its page.
//
// Opening: on black the line rises, a slit of light opens between its two
// halves and pushes them apart into the frame, then the film's light spills
// out into the room.
//
// Smooth everywhere: what moves per frame is a transform, an opacity or the
// frame's clip. The light is a tiny pre-blurred copy of each film (192×108,
// ~25 KB) stretched to the screen: no blur filter, nearly free to decode.
// Films are laid out once and only scaled; one film (and its light) plays at
// a time.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

// ---- copy: the client's site structure ----
const LOGO_SRC = "/logo.png";
const LOGLINE = ["Stories beyond", "the frame"];
const NAV = [
  { label: "Who we are", href: "#who-we-are" },
  { label: "Contact", href: "#contact" },
];

// Each film comes in two cuts, one for wide screens and a lighter one for
// portrait screens (phones), plus its light: the tiny blurred copy that fills
// the room. `aspect` is the cut's width / height.
type Cut = { src: string; poster: string; aspect: number };
type Film = { desk: Cut; small: Cut; light: string };
const F = "/hero14/films";
const VERTICAL_ASPECT = 608 / 1080;
const FILMS: Record<"wide" | "vertical" | "beyond", Film> = {
  wide: {
    desk: { src: `${F}/wide-1080.mp4`, poster: `${F}/wide.webp`, aspect: 16 / 9 },
    small: { src: `${F}/wide-540.mp4`, poster: `${F}/wide-540.webp`, aspect: 16 / 9 },
    light: `${F}/wide-light.mp4`,
  },
  vertical: {
    desk: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: VERTICAL_ASPECT },
    small: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: VERTICAL_ASPECT },
    light: `${F}/vertical-light.mp4`,
  },
  beyond: {
    desk: { src: `${F}/beyond-1080.mp4`, poster: `${F}/beyond.webp`, aspect: 16 / 9 },
    // full screen on a phone: the vertical crop
    small: { src: `${F}/beyond-m.mp4`, poster: `${F}/beyond-m.webp`, aspect: VERTICAL_ASPECT },
    light: `${F}/beyond-light.mp4`,
  },
};

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
    film: FILMS.wide,
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
    film: FILMS.vertical,
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
    film: FILMS.beyond,
    portrait: false,
    beyond: true,
  },
];

// ---- timing, in seconds ----
const T = {
  words: 0.25, // the line rises
  slit: 1.45, // a slit of light draws across between its halves
  slitDur: 0.65,
  open: 2.1, // the slit opens into the frame
  openDur: 1.25,
  depth: 2.9, // the frame lifts off the dark (its shadow)
  light: 3.0, // the film's light spills out into the room
  ui: 3.3, // top bar and format strip
  settle: 4.7, // from here the hero answers the pointer
};
const MORPH = 1.45; // 16×9 ⇄ 9×16
const MORPH_BEYOND = 1.75; // into or out of Beyond
const DWELL = 6.5; // seconds on each format before the next
const PAN = 3; // how far Beyond lets you look around, in % of the screen

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const cursorLabel = (md: Mode) => `${md.beyond ? "Step into" : "Explore"} ${md.label.replace("×", " x ")}`;

/** 16×9 set as type: a light, lowercase x between the numbers. */
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

// Portrait screens get the small cut of each film.
const PORTRAIT_Q = "(max-aspect-ratio: 1/1)";
const subscribePortrait = (cb: () => void) => {
  const mq = window.matchMedia(PORTRAIT_Q);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const noopSubscribe = () => () => {};

/** The frame: its turn, scale, how far open (width, height) and how far lifted. */
type FrameState = { angle: number; s: number; wx: number; o: number; d: number };
type Engine = { go: (i: number) => void; inside: (x: number, y: number) => boolean; refresh: () => void };

export default function Hero14() {
  const reduce = !!useReducedMotion();
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const portraitScreen = useSyncExternalStore(
    subscribePortrait,
    () => window.matchMedia(PORTRAIT_Q).matches,
    () => false
  );

  const [mode, setMode] = useState(0);
  const m = MODES[mode];

  // Nothing answers until the opening has played out.
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
  const frameRef = useRef<HTMLDivElement>(null);
  const filmsRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const spacerRef = useRef<HTMLSpanElement>(null);
  const composeRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const lightRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const cursorRef = useRef<CursorHandle>(null);
  const engineRef = useRef<Engine | null>(null);
  const modeRef = useRef(0);
  // the cycle rests while the visitor is pointing at the frame or the strip
  const frameHoverRef = useRef(false);
  const stripHoverRef = useRef(false);
  const pausedRef = useRef(false);
  const syncPaused = () => {
    pausedRef.current = frameHoverRef.current || stripHoverRef.current;
  };

  // ---- the frame: one engine places the window, the film in it and its shadow ----
  useEffect(() => {
    const root = rootRef.current;
    const frame = frameRef.current;
    const films = filmsRef.current;
    const shadow = shadowRef.current;
    const spacer = spacerRef.current;
    const compose = composeRef.current;
    const l1 = line1Ref.current;
    const l2 = line2Ref.current;
    if (!root || !frame || !films || !shadow || !spacer || !compose || !l1 || !l2) return;

    // The frame's resting size and place come from the layout (the gap held
    // open between the two halves of the line), so CSS is the one source.
    const geo = { cx: 0, cy: 0, W: 1, H: 1, vw: 1, vh: 1, left: 0, top: 0, roomTop: 0, roomBottom: 0 };
    const filmBase = new Map<HTMLVideoElement, { w: number; h: number; css: string }>();
    const measure = () => {
      const r = root.getBoundingClientRect();
      const s = spacer.getBoundingClientRect();
      geo.left = r.left;
      geo.top = r.top;
      geo.vw = r.width;
      geo.vh = r.height;
      geo.W = Math.max(1, s.width);
      geo.H = Math.max(1, s.height);
      geo.cx = s.left - r.left + s.width / 2;
      geo.cy = s.top - r.top + s.height / 2;
      // the room between the top bar and the strip
      const c = compose.getBoundingClientRect();
      geo.roomTop = c.top - r.top;
      geo.roomBottom = c.bottom - r.top;
      // Each film is laid out once at the frame's resting size in its own
      // shape (so its poster is drawn sharp), then only ever scaled.
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
        filmBase.set(v, { w, h, css: "" });
      });
      // the shadow is drawn once at the resting size, then scaled with the frame
      shadow.style.width = `${geo.W}px`;
      shadow.style.height = `${geo.H}px`;
      shadow.style.marginLeft = `${-geo.W / 2}px`;
      shadow.style.marginTop = `${-geo.H / 2}px`;
    };
    measure();

    const st: FrameState = reduce
      ? { angle: 0, s: 1, wx: 1, o: 1, d: 1 }
      : { angle: 0, s: 1, wx: 0, o: 0, d: 0 };
    let angleTarget = 0;
    let current = 0;
    let prog = 0;

    const scaleFor = (i: number) => {
      const md = MODES[i];
      const { cx, cy, W, H, vw, vh } = geo;
      // Beyond: past every edge of the screen
      if (md.beyond) return Math.max((2 * Math.max(cx, vw - cx)) / W, (2 * Math.max(cy, vh - cy)) / H) * 1.15;
      // 9×16: as tall as the room between the top bar and the strip allows
      if (md.portrait) {
        const room = 2 * (Math.min(cy - geo.roomTop, geo.roomBottom - cy) - 8);
        return Math.min(Math.min(room, 0.74 * vh) / W, (0.9 * vw) / H);
      }
      return 1;
    };

    // The film sits in the frame's own space: centred in it and turned back
    // upright. `place` is where it is; `pan` is Beyond's look-around.
    const place = { hw: 0, hh: 0, angle: 0 };
    const pan = { x: 0, y: 0 };
    let filmsCss = "";
    const placeFilms = () => {
      const rad = (place.angle * Math.PI) / 180;
      const c = Math.cos(rad);
      const sn = Math.sin(rad);
      const px = (pan.x / 100) * geo.vw;
      const py = (pan.y / 100) * geo.vh;
      // the screen-space pan, turned into the frame's space
      const x = place.hw + px * c + py * sn;
      const y = place.hh - px * sn + py * c;
      const css = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(-place.angle).toFixed(3)}deg)`;
      if (css !== filmsCss) {
        films.style.transform = css;
        filmsCss = css;
      }
    };

    const f1 = (n: number) => n.toFixed(1);
    let lastW = "";
    let lastH = "";
    let lastOff = Number.NaN;
    const render = () => {
      const { cx, cy, W, H, vw, vh } = geo;
      const hw = (W * st.s * st.wx) / 2;
      const hh = (H * st.s * st.o) / 2;
      const rad = (st.angle * Math.PI) / 180;
      const c = Math.cos(rad);
      const sn = Math.sin(rad);
      const turn = `rotate(${st.angle.toFixed(3)}deg)`;

      // the window: sized to the frame, turned about its centre; it clips the film
      const w = f1(hw * 2);
      const h = f1(hh * 2);
      if (w !== lastW) {
        frame.style.width = `${w}px`;
        lastW = w;
      }
      if (h !== lastH) {
        frame.style.height = `${h}px`;
        lastH = h;
      }
      frame.style.transform = `translate3d(${f1(cx - hw)}px, ${f1(cy - hh)}px, 0) ${turn}`;

      // its shadow, lifting it off the room
      shadow.style.transform = `translate3d(${f1(cx)}px, ${f1(cy)}px, 0) ${turn} scale(${(st.s * st.wx).toFixed(4)}, ${(st.s * st.o).toFixed(4)})`;
      shadow.style.opacity = String(st.d);

      // The film stays upright and fills the frame: scaled to cover the frame's
      // upright bounds, which at rest are the frame itself, so the whole film
      // shows. The opening doesn't shrink it (the slit opens onto it at full
      // size). In Beyond it covers the screen, with a little room to look around.
      const hwN = (W * st.s) / 2;
      const hhN = (H * st.s) / 2;
      const hx = Math.min(Math.abs(c) * hwN + Math.abs(sn) * hhN, Math.max(cx, vw - cx) * 1.08);
      const hy = Math.min(Math.abs(sn) * hwN + Math.abs(c) * hhN, Math.max(cy, vh - cy) * 1.08);
      filmBase.forEach((b, v) => {
        const css = `scale(${Math.max((2 * hx) / b.w, (2 * hy) / b.h).toFixed(4)})`;
        if (css !== b.css) {
          v.style.transform = css;
          b.css = css;
        }
      });
      place.hw = hw;
      place.hh = hh;
      place.angle = st.angle;
      placeFilms();

      // in the opening, the two halves of the line ride the slit apart
      const off = Math.round((1 - st.o) * (H / 2) * 10) / 10;
      if (off !== lastOff) {
        l1.style.transform = off ? `translate3d(0, ${off}px, 0)` : "";
        l2.style.transform = off ? `translate3d(0, ${-off}px, 0)` : "";
        lastOff = off;
      }
    };

    // Two channels so the shadow can move while the frame does.
    type Channel = "frame" | "depth";
    const tweens: Partial<Record<Channel, AnimationPlaybackControls>> = {};
    const running = { frame: false, depth: false };
    const to = (
      ch: Channel,
      target: Partial<FrameState>,
      duration: number,
      ease: readonly [number, number, number, number],
      delay = 0
    ) => {
      tweens[ch]?.stop();
      if (reduce) {
        Object.assign(st, target);
        render();
        return;
      }
      const from = { ...st };
      const keys = Object.keys(target) as (keyof FrameState)[];
      running[ch] = true;
      tweens[ch] = animate(0, 1, {
        duration,
        delay,
        ease: [...ease],
        onUpdate: (p) => {
          for (const k of keys) {
            const a = from[k];
            const b = target[k] as number;
            // scale eases in log space, so a big zoom feels even all the way
            st[k] = k === "s" ? Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * p) : a + (b - a) * p;
          }
          render();
        },
        onComplete: () => {
          running[ch] = false;
        },
      });
    };

    // the room's light: off in Beyond (the film is the room there)
    let lightTimer = 0;
    let openTimer = 0;
    const setLight = (on: boolean, delay = 0) => {
      window.clearTimeout(lightTimer);
      lightTimer = window.setTimeout(() => {
        if (on) root.dataset.lit = "";
        else delete root.dataset.lit;
      }, reduce ? 0 : delay * 1000);
    };

    const go = (i: number) => {
      if (i === current) return;
      const md = MODES[i];
      const was = MODES[current];
      // a quarter turn whenever the orientation changes, always the same way round
      const portraitNow = ((Math.round(angleTarget / 90) % 2) + 2) % 2 === 1;
      if (md.portrait !== portraitNow) angleTarget += 90;
      const dur = md.beyond || was.beyond ? MORPH_BEYOND : MORPH;
      to("frame", { angle: angleTarget, s: scaleFor(i), wx: 1, o: 1 }, dur, EASE_CINE);
      window.clearTimeout(openTimer);
      if (md.beyond) {
        to("depth", { d: 0 }, 0.8, EASE);
        setLight(false, dur * 0.7);
        // past the screen's edges: the corners can square off unseen
        openTimer = window.setTimeout(() => (root.dataset.open = ""), dur * 650);
      } else {
        delete root.dataset.open;
        to("depth", { d: 1 }, 0.9, EASE, was.beyond ? dur * 0.5 : 0);
        if (was.beyond) setLight(true);
      }
      current = i;
      prog = 0;
      barRefs.current.forEach((b) => b && (b.style.transform = "scaleX(0)"));
    };

    // where the pointer is, in the hero's own coordinates
    const inside = (x: number, y: number) => {
      if (MODES[current].beyond) return true;
      const dx = x - geo.cx;
      const dy = y - geo.cy;
      const rad = (-st.angle * Math.PI) / 180;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      return Math.abs(lx) <= (geo.W * st.s * st.wx) / 2 && Math.abs(ly) <= (geo.H * st.s * st.o) / 2;
    };
    const refresh = () => {
      measure();
      render();
    };
    engineRef.current = { go, inside, refresh };

    render();

    // ---- the opening ----
    const timers: number[] = [];
    const later = (t: number, fn: () => void) => timers.push(window.setTimeout(fn, t * 1000));
    if (reduce) {
      setLight(true);
    } else {
      later(T.slit, () => to("frame", { wx: 1, o: Math.min(1, 2 / geo.H) }, T.slitDur, EASE_CINE));
      later(T.open, () => to("frame", { o: 1 }, T.openDur, EASE_CINE));
      later(T.depth, () => to("depth", { d: 1 }, 1.4, EASE));
      later(T.light, () => setLight(true));
    }

    // ---- resize: re-measure, and hold the current format's size ----
    const onResize = () => {
      measure();
      if (!running.frame) st.s = scaleFor(current);
      render();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);
    ro.observe(spacer);
    document.fonts?.ready.then(onResize).catch(() => {});

    // ---- pointer: the cursor over the frame, and where Beyond looks ----
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const p = { x: geo.vw / 2, y: geo.vh / 2 };
    let onFrame = false;
    const setOnFrame = (on: boolean) => {
      if (on === onFrame) return;
      onFrame = on;
      // a data attribute, not a class: React owns the class list and would wipe it
      if (on) root.dataset.onFrame = "";
      else delete root.dataset.onFrame;
      cursorRef.current?.show(on ? cursorLabel(MODES[current]) : null);
    };
    const onMove = (e: PointerEvent) => {
      p.x = e.clientX - geo.left;
      p.y = e.clientY - geo.top;
      if (e.pointerType !== "mouse") return;
      const overUi = !!(e.target as Element | null)?.closest?.("a, button, header, nav, [data-ui]");
      const on = readyRef.current && !overUi && inside(p.x, p.y);
      setOnFrame(on);
      frameHoverRef.current = on && !MODES[current].beyond;
      syncPaused();
    };
    const onLeave = () => {
      setOnFrame(false);
      frameHoverRef.current = false;
      syncPaused();
      p.x = geo.vw / 2;
      p.y = geo.vh / 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    // ---- one loop: the cycle's progress and Beyond's look-around ----
    let raf = 0;
    let last = performance.now();
    let lastMode = current;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (readyRef.current && !reduce && !pausedRef.current) {
        prog += dt / DWELL;
        if (prog >= 1) {
          prog = 0;
          setMode((v) => (v + 1) % MODES.length);
        }
        const bar = barRefs.current[current];
        if (bar) bar.style.transform = `scaleX(${prog.toFixed(4)})`;
      }

      // the label changes with the format even if the pointer rests on the frame
      if (lastMode !== current) {
        lastMode = current;
        if (onFrame) cursorRef.current?.show(cursorLabel(MODES[current]));
      }

      let tx = 0;
      let ty = 0;
      if (MODES[current].beyond && !reduce) {
        if (fine) {
          tx = -((p.x / geo.vw) * 2 - 1) * PAN;
          ty = -((p.y / geo.vh) * 2 - 1) * PAN * 0.6;
        } else {
          const t = now / 1000; // no pointer: a slow look around on its own
          tx = Math.sin(t * 0.22) * PAN;
          ty = Math.sin(t * 0.15) * PAN * 0.4;
        }
      }
      const k = 1 - Math.exp(-dt * 2.2);
      pan.x += (tx - pan.x) * k;
      pan.y += (ty - pan.y) * k;
      placeFilms();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      tweens.frame?.stop();
      tweens.depth?.stop();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      delete root.dataset.onFrame;
      delete root.dataset.lit;
      delete root.dataset.open;
      window.clearTimeout(lightTimer);
      window.clearTimeout(openTimer);
      engineRef.current = null;
    };
  }, [reduce]);

  // the films mount after hydration (and change cut on rotation): size them
  useEffect(() => {
    engineRef.current?.refresh();
  }, [isClient, portraitScreen]);

  // a new format: the frame turns to it
  useEffect(() => {
    modeRef.current = mode;
    engineRef.current?.go(mode);
  }, [mode]);

  // its film (and its light) start from the top and fade in over the last;
  // the last ones stop once they're covered
  useEffect(() => {
    const all = [videoRefs.current, lightRefs.current];
    all.forEach((list) => {
      const v = list[mode];
      if (!v) return;
      v.muted = true;
      v.setAttribute("muted", ""); // iOS wants the attribute before it will autoplay
      v.currentTime = 0;
      v.play().catch(() => {});
    });
    const t = window.setTimeout(() => {
      all.forEach((list) =>
        list.forEach((o, i) => {
          if (o && i !== mode) o.pause();
        })
      );
    }, 1600);
    return () => window.clearTimeout(t);
  }, [mode, isClient, portraitScreen]);

  // once the opening is done, the other films may load ahead
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

  // arrow keys step through the formats
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!readyRef.current) return;
      if (e.key === "ArrowRight") setMode((v) => (v + 1) % MODES.length);
      if (e.key === "ArrowLeft") setMode((v) => (v + MODES.length - 1) % MODES.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // clicking the frame goes to that format; a sideways swipe on a phone changes it
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
      {/* ================= the room, lit by the film ================= */}
      <div className={styles.light} aria-hidden="true">
        {isClient &&
          MODES.map((md, i) => (
            <video
              key={md.key}
              ref={(el) => {
                lightRefs.current[i] = el;
              }}
              className={`${styles.lightFilm} ${i === mode ? styles.lightOn : ""}`}
              src={md.film.light}
              muted
              loop
              playsInline
              autoPlay={i === 0 && !reduce}
              preload="auto"
              disablePictureInPicture
            />
          ))}
      </div>
      <div className={styles.vignette} aria-hidden="true" />

      {/* ================= the frame, and the whole film in it ================= */}
      <span ref={shadowRef} className={styles.shadow} aria-hidden="true" />
      <div ref={frameRef} className={styles.frame} aria-hidden="true">
        <div ref={filmsRef} className={styles.films}>
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
      </div>

      {/* in Beyond, a little shade so the line reads on the open film */}
      <div className={styles.shade} aria-hidden="true" />

      {/* ================= the line, split by the frame ================= */}
      <div ref={composeRef} className={styles.compose}>
        <h1 className={styles.logline}>
          <span ref={line1Ref} className={styles.line}>
            <span className={styles.mask}>
              <motion.span
                className={styles.words}
                initial={reduce ? false : { y: "112%" }}
                animate={{ y: 0, transition: { delay: T.words, duration: 1.15, ease: EASE } }}
              >
                {LOGLINE[0]}
              </motion.span>
            </span>
          </span>
          <span ref={spacerRef} className={styles.spacer} aria-hidden="true" />
          <span ref={line2Ref} className={styles.line}>
            <span className={styles.mask}>
              <motion.span
                className={styles.words}
                initial={reduce ? false : { y: "112%" }}
                animate={{ y: 0, transition: { delay: T.words + 0.12, duration: 1.15, ease: EASE } }}
              >
                {LOGLINE[1]}
              </motion.span>
            </span>
          </span>
        </h1>
      </div>

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

      {/* ================= phones: the format's line, above the strip ================= */}
      <motion.div className={styles.caption} data-ui {...enter(T.ui + 0.15)}>
        <p key={m.key} className={styles.captionText}>
          {m.line}
          <span>{m.detail}</span>
        </p>
        <a href={m.href} className={styles.captionGo}>
          Explore <span aria-hidden="true">→</span>
        </a>
      </motion.div>

      {/* ================= the three formats ================= */}
      <motion.nav
        className={styles.formats}
        aria-label="Formats"
        onPointerEnter={() => {
          stripHoverRef.current = true;
          syncPaused();
        }}
        onPointerLeave={() => {
          stripHoverRef.current = false;
          syncPaused();
        }}
        {...enter(T.ui + 0.1)}
      >
        {MODES.map((md, i) => (
          <div key={md.key} className={`${styles.format} ${i === mode ? styles.formatOn : ""}`}>
            <span className={styles.formatBar} aria-hidden="true">
              <span
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                className={styles.formatFill}
              />
            </span>
            <button
              type="button"
              className={styles.formatPick}
              aria-pressed={i === mode}
              disabled={!ready}
              onClick={() => select(i)}
            >
              <span className={styles.formatNo}>{md.no}</span>
              <span className={styles.formatLabel}>
                <Ratio text={md.label} />
              </span>
            </button>
            <p className={styles.formatLine}>
              {md.line}
              <span>{md.detail}</span>
            </p>
            <a href={md.href} className={styles.formatGo} tabIndex={i === mode ? 0 : -1} aria-hidden={i !== mode}>
              Explore <span aria-hidden="true">→</span>
            </a>
          </div>
        ))}
      </motion.nav>

      <Cursor ref={cursorRef} />
    </section>
  );
}

// ===========================================================================
// CURSOR — over the frame, a thin paper ring with where it leads. Shown
// through a ref, so following the pointer never re-renders the hero.
// ===========================================================================
type CursorHandle = { show: (label: string | null) => void };

function Cursor({ ref }: { ref: Ref<CursorHandle> }) {
  const [label, setLabel] = useState<string | null>(null);
  useImperativeHandle(ref, () => ({ show: setLabel }), []);
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 520, damping: 42, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 520, damping: 42, mass: 0.5 });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);
  return (
    <motion.div className={styles.cursor} style={{ x: sx, y: sy }} aria-hidden="true">
      <AnimatePresence>
        {label && (
          <motion.div
            key="ring"
            className={styles.ring}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.45, ease: EASE } }}
            exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.25, ease: EASE } }}
          >
            <span className={styles.ringArrow}>→</span>
            <span className={styles.ringLabel}>{label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
