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
import styles from "./hero18.module.css";

// ===========================================================================
// HERO 18 — "Unfold". One sheet of white paper, one fold.
//
// The window is die-cut on three sides; its flap folds back on the uncut
// edge like a page being opened, and the whole film is there beneath. The
// flap hangs in perspective, its back in shade, and the cut edges cast a fine
// shadow into the window.
//
// Opening: a blank white page, a faint cut line; then the paper unfolds.
// 9×16: the sheet turns a quarter, so the flap hinges at the side, like a door.
// Beyond: the flap folds flat and the sheet flies past the camera, into the film.
// The pointer moves the light a touch: the flap lifts and settles as you go.
//
// The switcher is a ruler: one hairline, three stops, and a tiny frame of
// four corner marks that rides to the format on screen and changes shape
// with it (landscape, turned portrait, corners flung open for Beyond).
//
// Smooth: paper is solid panels; the flap and its shadow are drawn once and
// only moved (a 3D transform); one film plays at a time.
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

const T = {
  unfold: 0.9, // the flap folds back
  unfoldDur: 1.6,
  ui: 1.9,
  settle: 3.4,
};
const OPEN = 146; // how far the flap folds back (deg): it stands up a little off the paper
const MORPH = 1.4;
const MORPH_BEYOND = 1.6;
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

const PORTRAIT_Q = "(max-aspect-ratio: 1/1)";
const subscribePortrait = (cb: () => void) => {
  const mq = window.matchMedia(PORTRAIT_Q);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const noopSubscribe = () => () => {};

type State = { a: number; s: number; fold: number };
type Engine = { go: (i: number) => void; inside: (x: number, y: number) => boolean; refresh: () => void };

export default function Hero18() {
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
  const sheetRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const cutRef = useRef<HTMLSpanElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const engineRef = useRef<Engine | null>(null);
  const modeRef = useRef(0);
  const pausedRef = useRef(false);

  // ---- the engine: the sheet, its window, the flap and the film ----
  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const films = filmsRef.current;
    const sheet = sheetRef.current;
    const flap = flapRef.current;
    const cut = cutRef.current;
    if (!root || !stage || !films || !sheet || !flap || !cut) return;
    const panels = Array.from(sheet.querySelectorAll<HTMLElement>(`.${styles.panel}`));

    const geo = { cx: 0, cy: 0, W: 1, H: 1, vw: 1, vh: 1, left: 0, top: 0, B: 1 };
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
      const narrow = r.width <= 760;
      // the window, leaving room above it for the open flap
      geo.W = Math.min(s.width * (narrow ? 0.8 : 0.38), (s.height * 0.46 * 16) / 9);
      geo.H = (geo.W * 9) / 16;
      geo.B = Math.ceil(2 * Math.hypot(r.width, r.height));
      panels.forEach((p, j) => {
        p.style.width = `${j < 2 ? 2 * geo.B : geo.B}px`;
        p.style.height = `${j < 2 ? geo.B : 2 * geo.B}px`;
      });
      // the flap and the cut's shadow, drawn once at the window's resting size
      for (const el of [flap, cut]) {
        el.style.width = `${geo.W}px`;
        el.style.height = `${geo.H}px`;
      }
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

    const st: State = reduce ? { a: 0, s: 1, fold: OPEN } : { a: 0, s: 1, fold: 0 };
    let angleTarget = 0;
    let current = 0;
    let prog = 0;
    const tilt = { x: 0, y: 0 }; // the pointer, eased: the flap lifts a touch
    const look = { x: 0, y: 0 }; // Beyond's look-around, %

    const scaleFor = (i: number) => {
      const md = MODES[i];
      const { cx, cy, W, H, vw, vh } = geo;
      if (md.beyond) return Math.max((2 * Math.max(cx, vw - cx)) / W, (2 * Math.max(cy, vh - cy)) / H) * 1.25;
      if (md.portrait) {
        const sh = stage.getBoundingClientRect().height;
        return Math.min((sh * 0.9) / W, (vw * (vw <= 760 ? 0.42 : 0.4)) / H);
      }
      return 1;
    };

    const f1 = (n: number) => n.toFixed(1);
    const render = () => {
      const { cx, cy, W, H, vw, vh, B } = geo;
      const s = st.s;
      const hw = (W / 2) * s;
      const hh = (H / 2) * s;
      const rad = (st.a * Math.PI) / 180;
      const c = Math.cos(rad);
      const sn = Math.sin(rad);
      // the window sits a little away from the flap's side, so the open flap has room
      const off = st.fold > 1 ? hh * 0.62 * Math.min(1, st.fold / OPEN) * Math.min(1, 1.4 / s) : 0;
      // (the offset is "down" in the sheet's own space, so it follows the turn)
      const wx = cx - sn * off;
      const wy = cy + c * off;
      sheet.style.transform = `translate3d(${f1(wx)}px, ${f1(wy)}px, 0) rotate(${st.a.toFixed(3)}deg)`;
      const spots: [number, number][] = [
        [-B, -hh - B],
        [-B, hh],
        [-hw - B, -B],
        [hw, -B],
      ];
      panels.forEach((p, j) => (p.style.transform = `translate3d(${f1(spots[j][0])}px, ${f1(spots[j][1])}px, 0)`));
      // the flap: hinged on the window's top edge, folded back in perspective;
      // the pointer lifts it a little more or less
      const fold = st.fold + (st.fold > 20 ? tilt.y * 6 : 0);
      // (laid out at its resting size with its hinge's middle at the origin, so
      // the scale and the perspective both work from the middle of the hinge)
      flap.style.transform = `translate3d(${f1(-W / 2)}px, ${f1(-hh)}px, 0) scale(${s.toFixed(4)}) perspective(${f1(W * 1.8)}px) rotateX(${(-fold).toFixed(2)}deg) rotateY(${(tilt.x * 5 * Math.min(1, fold / OPEN)).toFixed(2)}deg)`;
      // past upright, we see the paper's underside
      const side = fold > 90 ? "back" : "front";
      if (flap.dataset.side !== side) flap.dataset.side = side;
      cut.style.transform = `translate3d(${f1(-hw)}px, ${f1(-hh)}px, 0) scale(${s.toFixed(4)})`;
      const so = Math.max(0, Math.min(1, 1 - (s - 1.1) / 0.3));
      cut.style.opacity = so.toFixed(3);
      flap.style.opacity = so.toFixed(3);
      const vis = so <= 0 ? "hidden" : "";
      if (flap.style.visibility !== vis) flap.style.visibility = vis;
      if (cut.style.visibility !== vis) cut.style.visibility = vis;

      // the film: in the window, upright, filling it
      const ac = Math.abs(c);
      const as = Math.abs(sn);
      const hx = Math.min(ac * hw + as * hh, Math.max(wx, vw - wx) * 1.06);
      const hy = Math.min(as * hw + ac * hh, Math.max(wy, vh - wy) * 1.06);
      filmBase.forEach((b, v) => {
        v.style.transform = `scale(${Math.max((2 * hx) / b.w, (2 * hy) / b.h).toFixed(4)})`;
      });
      films.style.transform = `translate3d(${f1(wx + (look.x / 100) * vw)}px, ${f1(wy + (look.y / 100) * vh)}px, 0)`;
      place.x = wx;
      place.y = wy;
    };
    const place = { x: 0, y: 0 };

    let tween: AnimationPlaybackControls | undefined;
    let running = false;
    const to = (target: Partial<State>, duration: number, ease: readonly number[], delay = 0) => {
      tween?.stop();
      if (reduce) {
        Object.assign(st, target);
        render();
        return;
      }
      const from = { ...st };
      const keys = Object.keys(target) as (keyof State)[];
      running = true;
      tween = animate(0, 1, {
        duration,
        delay,
        ease: [...ease] as [number, number, number, number],
        onUpdate: (p) => {
          for (const k of keys) {
            const a = from[k];
            const b = target[k] as number;
            st[k] = k === "s" ? Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * p) : a + (b - a) * p;
          }
          render();
        },
        onComplete: () => {
          running = false;
        },
      });
    };

    const go = (i: number) => {
      if (i === current) return;
      const md = MODES[i];
      const was = MODES[current];
      const portraitNow = ((Math.round(angleTarget / 90) % 2) + 2) % 2 === 1;
      if (md.portrait !== portraitNow) angleTarget += 90;
      const dur = md.beyond || was.beyond ? MORPH_BEYOND : MORPH;
      // into Beyond the flap folds flat as the sheet flies past; otherwise it stays open
      to({ a: angleTarget, s: scaleFor(i), fold: md.beyond ? 180 : OPEN }, dur, EASE_CINE);
      current = i;
      prog = 0;
      fillRefs.current.forEach((f) => f && (f.style.transform = "scaleX(0)"));
    };

    const inside = (x: number, y: number) => {
      if (MODES[current].beyond) return true;
      const dx = x - place.x;
      const dy = y - place.y;
      const rad = (-st.a * Math.PI) / 180;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      return Math.abs(lx) <= (geo.W * st.s) / 2 && Math.abs(ly) <= (geo.H * st.s) / 2;
    };
    const refresh = () => {
      measure();
      render();
    };
    engineRef.current = { go, inside, refresh };
    render();

    // ---- the opening: the paper unfolds ----
    const timers: number[] = [];
    if (!reduce) timers.push(window.setTimeout(() => to({ fold: OPEN }, T.unfoldDur, EASE_CINE), T.unfold * 1000));

    const onResize = () => {
      measure();
      if (!running) st.s = scaleFor(current);
      render();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);
    ro.observe(stage);

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
        const fill = fillRefs.current[current];
        if (fill) fill.style.transform = `scaleX(${prog.toFixed(4)})`;
      }
      let moved = false;
      if (fine && !reduce) {
        const k = 1 - Math.exp(-dt * 3);
        const nx = tilt.x + (p.x - tilt.x) * k;
        const ny = tilt.y + (p.y - tilt.y) * k;
        if (Math.abs(nx - tilt.x) > 0.0005 || Math.abs(ny - tilt.y) > 0.0005) moved = true;
        tilt.x = nx;
        tilt.y = ny;
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
      const kl = 1 - Math.exp(-dt * 2.2);
      const lx = look.x + (tx - look.x) * kl;
      const ly = look.y + (ty - look.y) * kl;
      if (Math.abs(lx - look.x) > 0.001 || Math.abs(ly - look.y) > 0.001) moved = true;
      look.x = lx;
      look.y = ly;
      if (moved && !running) render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      tween?.stop();
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
      {/* ================= the film, beneath the paper ================= */}
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

      {/* ================= the sheet: the window cut, the flap folded back ================= */}
      <div ref={sheetRef} className={styles.sheet} aria-hidden="true">
        <span className={styles.panel} />
        <span className={styles.panel} />
        <span className={styles.panel} />
        <span className={styles.panel} />
        <span ref={cutRef} className={styles.cut} />
        <div ref={flapRef} className={styles.flap}>
          <span className={styles.flapFront} />
          <span className={styles.flapBack} />
        </div>
      </div>

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

      <motion.h1 className={styles.logline} {...enter(T.ui + 0.05)}>
        <span>Stories beyond</span>
        <span>the frame</span>
      </motion.h1>
      <motion.p className={styles.place} {...enter(T.ui + 0.15)}>
        16x9 &amp; Beyond
        <span>A film studio · Dubai</span>
      </motion.p>

      {/* ================= the foot: the line, the ruler, the way in ================= */}
      <motion.div className={styles.foot} data-ui {...enter(T.ui + 0.1)}>
        <div className={styles.now}>
          <p key={m.key} className={styles.nowText}>
            <span className={styles.nowNo}>{m.no}</span>
            {m.line}
            <span className={styles.nowDetail}>{m.detail}</span>
          </p>
        </div>

        <nav
          className={styles.ruler}
          aria-label="Formats"
          style={{ ["--at" as string]: mode / (MODES.length - 1) }}
          onPointerEnter={() => (pausedRef.current = true)}
          onPointerLeave={() => (pausedRef.current = false)}
        >
          <span className={styles.rule} aria-hidden="true" />
          {/* the timer: the line fills from the format on screen to the next */}
          {MODES.map((md, i) =>
            i < MODES.length - 1 ? (
              <span
                key={md.key}
                className={styles.span}
                style={{ left: `${(i / (MODES.length - 1)) * 100}%`, width: `${100 / (MODES.length - 1)}%` }}
                aria-hidden="true"
              >
                <span
                  ref={(el) => {
                    fillRefs.current[i] = el;
                  }}
                  className={styles.spanFill}
                />
              </span>
            ) : null
          )}
          {/* the little frame that rides the ruler and takes the format's shape */}
          <span className={`${styles.marker} ${styles[`marker_${m.key.replace("x", "_")}`]}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          {MODES.map((md, i) => (
            <button
              key={md.key}
              type="button"
              className={`${styles.stop} ${i === mode ? styles.stopOn : ""}`}
              style={{ left: `${(i / (MODES.length - 1)) * 100}%` }}
              aria-pressed={i === mode}
              aria-label={`${md.label} — ${md.line}`}
              disabled={!ready}
              onClick={() => select(i)}
            >
              <span className={styles.tick} aria-hidden="true" />
              <span className={styles.stopLabel}>
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
