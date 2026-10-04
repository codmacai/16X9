"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Archivo } from "next/font/google";
import styles from "./hero16.module.css";

// ===========================================================================
// HERO 16 — "Type is the frame". White paper, black ink.
//
// One enormous word, 16×9, set in black on white, and the films play inside
// its letters: the letters are the frames. The word takes the shape of the
// format. 16×9: it sits wide, on one line, a landscape. 9×16: the numbers
// swap places and stack, 9 over × over 16, and the word stands tall like a
// phone. Beyond: the paper dissolves and the film spills out of the letters
// to fill the screen; the type turns to paper.
//
// Opening: the word sets in solid black ink, then the film fills the letters.
//
// How: the films play full screen underneath; over them a sheet of paper
// with the black word is blended with `screen`, so white stays white and
// black becomes a window onto the film. The letters move by transform only
// (CSS transitions, on the compositor); the paper fades by opacity.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

const LOGO_SRC = "/logo.png";
const LOGLINE = "Stories beyond the frame";
const NAV = [
  { label: "Who we are", href: "#who-we-are" },
  { label: "Contact", href: "#contact" },
];

type Cut = { src: string; poster: string };
type Mode = {
  key: string;
  no: string;
  label: string;
  line: string;
  detail: string;
  href: string;
  desk: Cut;
  small: Cut; // portrait screens
  layout: "wide" | "tall";
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
    desk: { src: "/hero14/films/wide-1080.mp4", poster: "/hero14/films/wide.webp" },
    small: { src: "/hero16/films/wide-m.mp4", poster: "/hero16/films/wide-m.webp" },
    layout: "wide",
    beyond: false,
  },
  {
    key: "9x16",
    no: "02",
    label: "9×16",
    line: "Stories made for the scroll",
    detail: "Social · Branded content",
    href: "#9x16",
    desk: { src: "/hero16/films/vertical-1080.mp4", poster: "/hero16/films/vertical.webp" },
    small: { src: "/hero14/films/vertical-m.mp4", poster: "/hero14/films/vertical-m.webp" },
    layout: "tall",
    beyond: false,
  },
  {
    key: "beyond",
    no: "03",
    label: "Beyond",
    line: "Stories you step into",
    detail: "Immersive · Interactive",
    href: "#beyond",
    desk: { src: "/hero14/films/beyond-1080.mp4", poster: "/hero14/films/beyond.webp" },
    small: { src: "/hero14/films/beyond-m.mp4", poster: "/hero14/films/beyond-m.webp" },
    layout: "wide",
    beyond: true,
  },
];

// the word's three pieces
const GLYPHS = ["16", "×", "9"] as const;

// ---- timing, in seconds ----
const T = {
  ink: 0.3, // the word sets in black
  fill: 1.5, // the film fills the letters
  ui: 1.6, // bar, line, strip
  settle: 3.2, // from here it answers the pointer
};
const DWELL = 6.5;
const EASE = [0.16, 1, 0.3, 1] as const;

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

const PORTRAIT_Q = "(max-aspect-ratio: 1/1)";
const subscribePortrait = (cb: () => void) => {
  const mq = window.matchMedia(PORTRAIT_Q);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const noopSubscribe = () => () => {};

export default function Hero16() {
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
  const glyphRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const modeRef = useRef(0);
  const placeRef = useRef<((i: number) => void) | null>(null);
  const pausedRef = useRef(false);

  // ---- the opening: ink, then film ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (reduce) {
      root.dataset.in = "";
      root.dataset.fill = "";
      return;
    }
    const a = window.setTimeout(() => (root.dataset.in = ""), T.ink * 1000);
    const b = window.setTimeout(() => (root.dataset.fill = ""), T.fill * 1000);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [reduce]);

  // ---- the word: measured once, then laid out wide or tall ----
  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const els = glyphRefs.current;
    if (!root || !stage || els.some((e) => !e)) return;
    const glyphs = els as HTMLSpanElement[];

    // metrics at a 100px font: each piece's width, and the cap-height line box
    let unit = { w: [1, 1, 1], h: 74 };
    let base = 100; // the font size the letters are set in (the larger layout's)
    const measure = () => {
      glyphs.forEach((g) => (g.style.fontSize = "100px"));
      base = 100;
      unit = { w: glyphs.map((g) => g.offsetWidth), h: glyphs[0].offsetHeight };
    };

    const place = (i: number) => {
      const md = MODES[i];
      const r = root.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      const cx = s.left - r.left + s.width / 2;
      const cy = s.top - r.top + s.height / 2;
      const aw = s.width;
      const ah = s.height;
      const [w16, wx, w9] = unit.w;
      const h = unit.h;
      const gap = 3;
      const lead = 6;
      // how big each layout can be (px per 100px of metrics)
      const uWide = Math.min(aw / (w16 + wx + w9 + 2 * gap), ah / h);
      const uTall = Math.min(aw / Math.max(w16, wx, w9), ah / (3 * h + 2 * lead));
      // set the letters at the larger of the two, so the other only ever shrinks them (stays sharp)
      const F = Math.round(100 * Math.max(uWide, uTall));
      if (F !== base) {
        base = F;
        glyphs.forEach((g) => (g.style.fontSize = `${F}px`));
      }
      const u = md.layout === "tall" ? uTall : uWide * (md.beyond ? 1.12 : 1);
      const k = (u * 100) / F;
      // where each piece's centre goes
      const centres: [number, number][] =
        md.layout === "tall"
          ? [
              [cx, cy + (h + lead) * u], // 16 at the foot
              [cx, cy], // × in the middle
              [cx, cy - (h + lead) * u], // 9 on top
            ]
          : (() => {
              const total = (w16 + wx + w9 + 2 * gap) * u;
              const x0 = cx - total / 2;
              return [
                [x0 + (w16 * u) / 2, cy],
                [x0 + (w16 + gap + wx / 2) * u, cy],
                [x0 + (w16 + gap + wx + gap + w9 / 2) * u, cy],
              ];
            })();
      glyphs.forEach((g, j) => {
        const bw = (unit.w[j] * F) / 100;
        const bh = (h * F) / 100;
        const [gx, gy] = centres[j];
        const turn = j === 1 && md.layout === "tall" ? " rotate(90deg)" : "";
        g.style.transform = `translate3d(${(gx - bw / 2).toFixed(1)}px, ${(gy - bh / 2).toFixed(1)}px, 0) scale(${k.toFixed(4)})${turn}`;
      });
    };

    measure();
    place(modeRef.current);
    placeRef.current = place;
    // first layout without a transition; after that the letters travel
    requestAnimationFrame(() => root.setAttribute("data-placed", ""));

    const onResize = () => place(modeRef.current);
    const ro = new ResizeObserver(onResize);
    ro.observe(stage);
    document.fonts?.ready
      .then(() => {
        measure();
        place(modeRef.current);
      })
      .catch(() => {});
    return () => {
      ro.disconnect();
      placeRef.current = null;
    };
  }, []);

  // a new format: the word changes shape
  useEffect(() => {
    modeRef.current = mode;
    placeRef.current?.(mode);
  }, [mode]);

  // its film starts from the top and fades in over the last
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

  // ---- the cycle: a hairline fills under the format on screen ----
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let last = performance.now();
    let prog = 0;
    let shown = modeRef.current;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (shown !== modeRef.current) {
        shown = modeRef.current;
        prog = 0;
        barRefs.current.forEach((b) => b && (b.style.transform = "scaleX(0)"));
      }
      if (readyRef.current && !pausedRef.current) {
        prog += dt / DWELL;
        if (prog >= 1) {
          prog = 0;
          setMode((v) => (v + 1) % MODES.length);
        }
        const bar = barRefs.current[shown];
        if (bar) bar.style.transform = `scaleX(${prog.toFixed(4)})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

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
      className={`${styles.root} ${wide.variable} ${m.beyond ? styles.isBeyond : ""} ${m.layout === "tall" ? styles.isTall : ""}`}
      aria-label={`16x9 & Beyond — ${LOGLINE}`}
      onPointerDown={onDown}
      onPointerUp={onUp}
    >
      {/* ================= the films, full screen, under the paper ================= */}
      <div className={styles.films} aria-hidden="true">
        {isClient &&
          MODES.map((md, i) => {
            const cut = portraitScreen ? md.small : md.desk;
            return (
              <video
                key={md.key}
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                className={`${styles.film} ${i === mode ? styles.filmOn : ""}`}
                src={cut.src}
                poster={cut.poster}
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

      {/* ================= the paper, with the word cut through it ================= */}
      <div className={styles.paper} aria-hidden="true">
        <div className={styles.sheet} />
        <a
          href={m.href}
          className={styles.word}
          tabIndex={-1}
          onClick={(e) => {
            if (!readyRef.current) e.preventDefault();
          }}
        >
          {GLYPHS.map((g, j) => (
            <span
              key={g}
              ref={(el) => {
                glyphRefs.current[j] = el;
              }}
              className={styles.glyph}
            >
              <span className={styles.glyphInk} style={{ transitionDelay: `${j * 0.08}s` }}>
                {g}
              </span>
            </span>
          ))}
        </a>
      </div>

      <div className={styles.shade} aria-hidden="true" />

      {/* the room the word is laid out in, between the line and the strip */}
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

      {/* ================= the line ================= */}
      <motion.div className={styles.lede} {...enter(T.ui + 0.1)}>
        <h1 className={styles.logline}>{LOGLINE}</h1>
        <p className={styles.place}>
          A film studio in Dubai
          <span>
            Now showing — <Ratio text={m.label} />
          </span>
        </p>
      </motion.div>

      {/* ================= phones: the format's line ================= */}
      <motion.div className={styles.caption} {...enter(T.ui + 0.15)}>
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
        onPointerEnter={() => (pausedRef.current = true)}
        onPointerLeave={() => (pausedRef.current = false)}
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
    </section>
  );
}
