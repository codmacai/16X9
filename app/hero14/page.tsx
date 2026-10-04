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
// One film fills the screen. A frame over it shows the story in full light;
// beyond the frame the same film carries on, in shadow. The frame is the
// navigation: it holds 16×9, turns a quarter like a phone going vertical to
// become 9×16 (the film behind it never moves, only the window onto it), and
// for Beyond it opens past the edges of the screen, and the visitor can look
// around the film with the pointer. The three cycle on their own; the strip
// at the foot picks one, and each leads to its page.
//
// Opening: on black the line rises, a slit of light opens between its two
// halves and pushes them apart into the frame, the corner marks close in, and
// then the film fades up beyond the frame.
//
// Everything that moves per frame is a transform or an opacity, so the
// compositor does it all: the veil is four solid panels that slide round the
// frame, never a shape that is redrawn. No filters, no blend modes, and one
// film playing at a time.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

// ---- copy: the client's site structure ----
const LOGO_SRC = "/logo.png";
const LOGLINE = ["Stories beyond", "the frame"];
const NAV = [
  { label: "Who we are", href: "#who-we-are" },
  { label: "Contact", href: "#contact" },
];

type Film = { desk: string; mobile: string; poster: string; posterMobile: string };
const film = (name: string): Film => ({
  desk: `/hero14/films/${name}-1080.mp4`,
  mobile: `/hero14/films/${name}-m.mp4`, // a vertical crop, for portrait screens
  poster: `/hero14/films/${name}.webp`,
  posterMobile: `/hero14/films/${name}-m.webp`,
});

type Mode = {
  key: string;
  no: string;
  label: string;
  /** what the viewfinder reads, top left of the frame */
  hud: string;
  line: string;
  detail: string;
  href: string;
  /** the film's caption, bottom left of the frame */
  title: string;
  film: Film;
  portrait: boolean;
  beyond: boolean;
};

const MODES: Mode[] = [
  {
    key: "16x9",
    no: "01",
    label: "16×9",
    hud: "16 : 9",
    line: "Films for the big screen",
    detail: "TVCs · Brand films · Documentaries",
    href: "#16x9",
    title: "Desert — brand film",
    film: film("wide"),
    portrait: false,
    beyond: false,
  },
  {
    key: "9x16",
    no: "02",
    label: "9×16",
    hud: "9 : 16",
    line: "Stories made for the scroll",
    detail: "Social · Branded content",
    href: "#9x16",
    title: "Movement — social cut",
    film: film("vertical"),
    portrait: true,
    beyond: false,
  },
  {
    key: "beyond",
    no: "03",
    label: "Beyond",
    hud: "Beyond",
    line: "Stories you step into",
    detail: "Immersive · Interactive",
    href: "#beyond",
    title: "Dubai — look around",
    film: film("beyond"),
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
  marks: 2.95, // corner marks and viewfinder close in
  beyond: 3.15, // the film fades up beyond the frame
  ui: 3.3, // top bar and format strip
  settle: 4.7, // from here the hero answers the pointer
};
const MORPH = 1.45; // 16×9 ⇄ 9×16
const MORPH_BEYOND = 1.75; // into or out of Beyond
const DWELL = 6.5; // seconds on each format before the next
const VEIL = 0.74; // how dark the film is beyond the frame
const MARK_GAP = 10; // corner marks sit this far outside the frame
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

const pad2 = (n: number) => String(n).padStart(2, "0");
const timecode = (frame: number) =>
  `TC 00:${pad2(Math.floor(frame / 1500) % 60)}:${pad2(Math.floor(frame / 25) % 60)}:${pad2(frame % 25)}`;

// Portrait screens get the vertical crop of each film (sharper, a third of the size).
const PORTRAIT_Q = "(max-aspect-ratio: 1/1)";
const subscribePortrait = (cb: () => void) => {
  const mq = window.matchMedia(PORTRAIT_Q);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const noopSubscribe = () => () => {};

type FrameState = { angle: number; s: number; wx: number; o: number; g: number; bo: number };
type Engine = { go: (i: number) => void; inside: (x: number, y: number) => boolean };

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
  const filmsRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const partRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const marksRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLSpanElement>(null);
  const composeRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const markRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hudRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
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

  // ---- the frame: one engine draws the window, its marks and the viewfinder ----
  useEffect(() => {
    const root = rootRef.current;
    const veil = veilRef.current;
    const edge = edgeRef.current;
    const marks = marksRef.current;
    const hud = hudRef.current;
    const spacer = spacerRef.current;
    const l1 = line1Ref.current;
    const l2 = line2Ref.current;
    const compose = composeRef.current;
    if (!root || !veil || !edge || !marks || !hud || !spacer || !l1 || !l2 || !compose) return;
    const markEls = markRefs.current;
    const parts = partRefs.current;
    const lines = lineRefs.current;
    const hudEls = hudRefs.current;

    // The frame's resting size and place come from the layout (the gap held
    // open between the two halves of the line), so CSS is the one source.
    const geo = { cx: 0, cy: 0, W: 1, H: 1, vw: 1, vh: 1, left: 0, top: 0, roomTop: 0, roomBottom: 0, B: 1 };
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
      // Each veil panel reaches this far out from its edge of the frame, enough
      // to cover the screen at any turn. Panels overlap at the corners; the veil
      // is faded as one group, so the overlaps never show.
      const B = Math.ceil(2 * Math.hypot(r.width, r.height));
      if (B !== geo.B) {
        geo.B = B;
        parts.forEach((el, i) => {
          if (!el) return;
          el.style.width = `${i < 2 ? 2 * B : B}px`;
          el.style.height = `${i < 2 ? B : 2 * B}px`;
        });
      }
    };
    measure();

    const st: FrameState = reduce
      ? { angle: 0, s: 1, wx: 1, o: 1, g: MARK_GAP, bo: 1 }
      : { angle: 0, s: 1, wx: 0, o: 0, g: 40, bo: 0 };
    let angleTarget = 0;
    let hudTimer = 0;
    let current = 0;
    let prog = 0;

    const scaleFor = (i: number) => {
      const md = MODES[i];
      const { cx, cy, W, H, vw, vh } = geo;
      // Beyond: past every edge of the screen, with room to spare for the marks
      if (md.beyond) return Math.max((2 * Math.max(cx, vw - cx)) / W, (2 * Math.max(cy, vh - cy)) / H) * 1.2;
      // 9×16: as tall as the room between the top bar and the strip allows
      if (md.portrait) {
        const room = 2 * (Math.min(cy - geo.roomTop, geo.roomBottom - cy) - 8);
        return Math.min(Math.min(room, 0.74 * vh) / W, (0.9 * vw) / H);
      }
      return 1;
    };

    const f1 = (n: number) => n.toFixed(1);
    let lastBase = "";
    let lastOff = Number.NaN;
    const render = () => {
      const { cx, cy, W, H } = geo;
      const hw = (W * st.s * st.wx) / 2;
      const hh = (H * st.s * st.o) / 2;
      const rad = (st.angle * Math.PI) / 180;
      const c = Math.cos(rad);
      const sn = Math.sin(rad);
      const B = geo.B;

      // The veil and the hairline live in the frame's own space: placed at its
      // centre and turned with it, so every piece inside only slides.
      const base = `translate3d(${f1(cx)}px, ${f1(cy)}px, 0) rotate(${st.angle.toFixed(3)}deg)`;
      if (base !== lastBase) {
        veil.style.transform = base;
        edge.style.transform = base;
        lastBase = base;
      }
      // the veil: four solid panels, one off each side of the frame
      const panels: [number, number][] = [
        [-B, -hh - B], // above
        [-B, hh], // below
        [-hw - B, -B], // left
        [hw, -B], // right
      ];
      panels.forEach(([x, y], i) => {
        const el = parts[i];
        if (el) el.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0)`;
      });
      // the hairline: four 1px lines, stretched to the frame's sides
      const w = Math.max(0, hw * 2);
      const h = Math.max(0, hh * 2);
      const sides: [number, number, number, number][] = [
        [-hw, -hh, w, 1],
        [-hw, hh - 1, w, 1],
        [-hw, -hh, 1, h],
        [hw - 1, -hh, 1, h],
      ];
      sides.forEach(([x, y, sx, sy], i) => {
        const el = lines[i];
        if (el) el.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0) scale(${f1(sx)}, ${f1(sy)})`;
      });
      edge.style.opacity = String(st.bo);

      // corner marks, turning with the frame
      const g = st.g;
      const corners: [number, number, number][] = [
        [-hw - g, -hh - g, 0],
        [hw + g, -hh - g, 90],
        [hw + g, hh + g, 180],
        [-hw - g, hh + g, 270],
      ];
      corners.forEach(([x, y, r], i) => {
        const el = markEls[i];
        if (el)
          el.style.transform = `translate3d(${f1(cx + x * c - y * sn)}px, ${f1(cy + x * sn + y * c)}px, 0) rotate(${(st.angle + r).toFixed(2)}deg)`;
      });
      marks.style.opacity = String(st.bo);

      // the viewfinder reads at the corners of the frame's upright bounds
      const ex = Math.abs(c) * hw + Math.abs(sn) * hh;
      const ey = Math.abs(sn) * hw + Math.abs(c) * hh;
      const spots: [number, number][] = [
        [cx - ex, cy - ey],
        [cx + ex, cy - ey],
        [cx - ex, cy + ey],
        [cx + ex, cy + ey],
      ];
      spots.forEach(([x, y], i) => {
        const el = hudEls[i];
        if (el) el.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0)`;
      });
      hud.style.opacity = String(st.bo);

      // in the opening, the two halves of the line ride the slit apart
      const off = Math.round((1 - st.o) * (H / 2) * 10) / 10;
      if (off !== lastOff) {
        l1.style.transform = off ? `translate3d(0, ${off}px, 0)` : "";
        l2.style.transform = off ? `translate3d(0, ${-off}px, 0)` : "";
        lastOff = off;
      }
    };

    // Two channels so the marks can move while the frame does.
    const tweens: Partial<Record<"frame" | "marks", AnimationPlaybackControls>> = {};
    const running = { frame: false, marks: false };
    const to = (
      ch: "frame" | "marks",
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

    const go = (i: number) => {
      if (i === current) return;
      const md = MODES[i];
      const was = MODES[current];
      // a quarter turn whenever the orientation changes, always the same way round
      const portraitNow = ((Math.round(angleTarget / 90) % 2) + 2) % 2 === 1;
      if (md.portrait !== portraitNow) angleTarget += 90;
      const dur = md.beyond || was.beyond ? MORPH_BEYOND : MORPH;
      // the viewfinder steps aside while the frame turns, and reads again once it lands
      hud.classList.add(styles.hudAway);
      window.clearTimeout(hudTimer);
      hudTimer = window.setTimeout(() => hud.classList.remove(styles.hudAway), dur * 820);
      to("frame", { angle: angleTarget, s: scaleFor(i), wx: 1, o: 1 }, dur, EASE_CINE);
      if (md.beyond) to("marks", { bo: 0, g: 40 }, 0.7, EASE);
      else to("marks", { bo: 1, g: MARK_GAP }, 0.9, EASE, was.beyond ? dur * 0.55 : 0);
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
    engineRef.current = { go, inside };

    render();

    // ---- the opening ----
    const timers: number[] = [];
    const later = (t: number, fn: () => void) => timers.push(window.setTimeout(fn, t * 1000));
    let veilAnim: AnimationPlaybackControls | null = null;
    if (reduce) {
      veil.style.opacity = String(VEIL);
    } else {
      later(T.slit, () => to("frame", { wx: 1, o: Math.min(1, 2 / geo.H) }, T.slitDur, EASE_CINE));
      later(T.open, () => to("frame", { o: 1 }, T.openDur, EASE_CINE));
      later(T.marks, () => to("marks", { bo: 1, g: MARK_GAP }, 1.1, EASE));
      later(T.beyond, () => {
        veilAnim = animate(veil, { opacity: VEIL }, { duration: 1.8, ease: [...EASE] });
      });
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
      root.classList.toggle(styles.onFrame, on);
      const md = MODES[current];
      cursorRef.current?.show(on ? cursorLabel(md) : null);
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

    // ---- one loop: the cycle's progress, Beyond's look-around, the timecode ----
    let raf = 0;
    let last = performance.now();
    let lastFrame = -1;
    let lastMode = current;
    const pan = { x: 0, y: 0 };
    let panCss = "";
    const films = filmsRef.current;
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
        if (onFrame) {
          const md = MODES[current];
          cursorRef.current?.show(cursorLabel(md));
        }
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
      if (films) {
        const css = `translate3d(${pan.x.toFixed(3)}%, ${pan.y.toFixed(3)}%, 0) scale(1.08)`;
        if (css !== panCss) {
          films.style.transform = css;
          panCss = css;
        }
      }

      const v = videoRefs.current[current];
      const tc = tcRef.current;
      if (v && tc) {
        const fr = Math.floor(v.currentTime * 25);
        if (fr !== lastFrame) {
          lastFrame = fr;
          tc.textContent = timecode(fr);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(hudTimer);
      tweens.frame?.stop();
      tweens.marks?.stop();
      veilAnim?.stop();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      root.classList.remove(styles.onFrame);
      engineRef.current = null;
    };
  }, [reduce]);

  // a new format: the frame turns to it
  useEffect(() => {
    modeRef.current = mode;
    engineRef.current?.go(mode);
  }, [mode]);

  // its film starts from the top and fades in over the last; the last one stops after
  useEffect(() => {
    const vids = videoRefs.current;
    const v = vids[mode];
    if (v) {
      v.muted = true;
      v.setAttribute("muted", ""); // iOS wants the attribute before it will autoplay
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
      {/* ================= the film: fills the screen ================= */}
      <div ref={filmsRef} className={styles.films} aria-hidden="true">
        {isClient &&
          MODES.map((md, i) => (
            <video
              key={md.key}
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              className={`${styles.film} ${i === mode ? styles.filmOn : ""}`}
              src={portraitScreen ? md.film.mobile : md.film.desk}
              poster={portraitScreen ? md.film.posterMobile : md.film.poster}
              muted
              loop
              playsInline
              autoPlay={i === 0 && !reduce}
              preload={i === 0 ? "auto" : "metadata"}
              disablePictureInPicture
            />
          ))}
      </div>

      {/* beyond the frame, the film carries on in shadow */}
      <div ref={veilRef} className={styles.veil} aria-hidden="true">
        {["Above", "Below", "Left", "Right"].map((side, i) => (
          <span
            key={side}
            ref={(el) => {
              partRefs.current[i] = el;
            }}
            className={`${styles.veilPart} ${styles[`veil${side}`]}`}
          />
        ))}
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.shadeBeyond} aria-hidden="true" />

      {/* ================= the frame: hairline, corner marks, viewfinder ================= */}
      <div ref={edgeRef} className={styles.edge} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            className={styles.edgeLine}
          />
        ))}
      </div>
      <div ref={marksRef} className={styles.marks} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            ref={(el) => {
              markRefs.current[i] = el;
            }}
            className={styles.mark}
          />
        ))}
      </div>
      <div ref={hudRef} className={styles.hud} aria-hidden="true">
        <div ref={(el) => void (hudRefs.current[0] = el)} className={styles.hudTL}>
          <span key={`a${mode}`} className={styles.hudSwap}>
            <i className={styles.rec} /> {m.hud}
          </span>
        </div>
        <div ref={(el) => void (hudRefs.current[1] = el)} className={styles.hudTR}>
          <span ref={tcRef}>TC 00:00:00:00</span>
        </div>
        <div ref={(el) => void (hudRefs.current[2] = el)} className={styles.hudBL}>
          <span key={`b${mode}`} className={styles.hudSwap}>
            {m.title}
          </span>
        </div>
        <div ref={(el) => void (hudRefs.current[3] = el)} className={styles.hudBR}>
          <span key={`c${mode}`} className={styles.hudSwap}>
            {m.no} / {pad2(MODES.length)}
          </span>
        </div>
      </div>

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
