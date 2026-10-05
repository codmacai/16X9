"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { animate, motion, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";
import { Archivo } from "next/font/google";
import styles from "./hero18.module.css";

// ===========================================================================
// HERO 18 — "Three frames". A white page and one line: 16x9 × 9x16 × BEYOND.
//
// Nothing plays until you point. Each word opens its own frame behind the
// line: 16x9 a landscape window, 9x16 a tall one, BEYOND the whole screen.
// The film opens out of the line like a slit and the window morphs from one
// shape to the next as you move along the words; leave, and it closes back
// to a line. The type is set in difference, so where the film passes behind
// it the letters turn negative. The word you're on is held in crop marks.
// On touch screens the frames play through on their own.
//
// Smooth: the window is one clipped box resized by the engine, the film
// inside only scaled; one film plays at a time.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

const LOGO_SRC = "/logo.png";
const F = "/hero14/films";
const V = 608 / 1080;

type Cut = { src: string; poster: string; aspect: number };
type Frame = {
  key: string;
  no: string;
  word: string;
  line: string;
  href: string;
  shape: "wide" | "tall" | "beyond";
  desk: Cut;
  small: Cut;
};

const FRAMES: Frame[] = [
  {
    key: "16x9",
    no: "01",
    word: "16x9",
    line: "Films for the big screen — TVCs, brand films, documentaries",
    href: "#16x9",
    shape: "wide",
    desk: { src: `${F}/wide-1080.mp4`, poster: `${F}/wide.webp`, aspect: 16 / 9 },
    small: { src: `${F}/wide-540.mp4`, poster: `${F}/wide-540.webp`, aspect: 16 / 9 },
  },
  {
    key: "9x16",
    no: "02",
    word: "9x16",
    line: "Stories made for the scroll — social and branded content",
    href: "#9x16",
    shape: "tall",
    desk: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: V },
    small: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: V },
  },
  {
    key: "beyond",
    no: "03",
    word: "Beyond",
    line: "Stories you step into — immersive and interactive",
    href: "#beyond",
    shape: "beyond",
    desk: { src: `${F}/beyond-1080.mp4`, poster: `${F}/beyond.webp`, aspect: 16 / 9 },
    small: { src: `${F}/beyond-m.mp4`, poster: `${F}/beyond-m.webp`, aspect: V },
  },
];

const T = { words: 0.25, chrome: 0.9, ready: 1.6 };
const OPEN = 0.95; // a frame opening or changing shape
const CLOSE = 0.7; // back to a line
const CYCLE = 4.5; // touch screens: seconds per frame
const LEAVE_GRACE = 140; // ms: moving across a separator doesn't close the frame
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

/** "16x9" with a light lowercase x */
function Word({ text }: { text: string }) {
  const [a, b] = text.split("x");
  if (b === undefined || !/^\d+$/.test(a)) return <>{text}</>;
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

const dubaiTime = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
    new Date()
  );

type Rect = { x: number; y: number; w: number; h: number };

export default function Hero18() {
  const reduce = !!useReducedMotion();
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const portraitScreen = useSyncExternalStore(
    subscribePortrait,
    () => window.matchMedia(PORTRAIT_Q).matches,
    () => false
  );
  const [active, setActive] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const readyRef = useRef(reduce);
  const lastTouch = useRef(0);
  const leaveTimer = useRef(0);

  const rootRef = useRef<HTMLElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const filmsRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const placeRef = useRef<((i: number | null) => void) | null>(null);
  const refreshRef = useRef<(() => void) | null>(null);
  const [time, setTime] = useState("");

  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => (readyRef.current = true), T.ready * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // ---- the clock: Dubai time, as a timecode ----
  useEffect(() => {
    const tick = () => setTime(dubaiTime());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  // ---- the window: one clipped box, resized to the frame you point at ----
  useEffect(() => {
    const root = rootRef.current;
    const win = winRef.current;
    const films = filmsRef.current;
    if (!root || !win || !films) return;

    const box: Rect = { x: 0, y: 0, w: 0, h: 0 };
    const filmBase = new Map<HTMLVideoElement, { w: number; h: number }>();

    const targetFor = (i: number | null): Rect => {
      const vw = root.clientWidth;
      const vh = root.clientHeight;
      const cx = vw / 2;
      const cy = vh / 2;
      if (i === null) {
        // closed: a line through the middle, as wide as it was
        const w = box.w || Math.min(vw * 0.6, vh * 1.1);
        return { x: cx - w / 2, y: cy, w, h: 0 };
      }
      const shape = FRAMES[i].shape;
      if (shape === "beyond") return { x: 0, y: 0, w: vw, h: vh };
      if (shape === "tall") {
        const h = Math.min(vh * 0.74, ((vw * 0.84) * 16) / 9);
        const w = (h * 9) / 16;
        return { x: cx - w / 2, y: cy - h / 2, w, h };
      }
      const w = Math.min(vw * (vw <= 760 ? 0.92 : 0.6), ((vh * 0.62) * 16) / 9);
      const h = (w * 9) / 16;
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    };

    const sizeFilms = () => {
      const base = Math.max(root.clientWidth, root.clientHeight) * 0.5;
      filmBase.clear();
      videoRefs.current.forEach((v) => {
        if (!v) return;
        const a = Number(v.dataset.aspect) || 16 / 9;
        const w = a >= 1 ? base : base * a;
        const h = a >= 1 ? base / a : base;
        v.style.width = `${w}px`;
        v.style.height = `${h}px`;
        v.style.marginLeft = `${-w / 2}px`;
        v.style.marginTop = `${-h / 2}px`;
        filmBase.set(v, { w, h });
      });
    };

    let current: number | null = null;
    let hold: Rect | null = null;
    const f1 = (n: number) => n.toFixed(1);
    let lastW = "";
    let lastH = "";
    const render = () => {
      const { x, y, w, h } = box;
      const ws = f1(Math.max(0, w));
      const hs = f1(Math.max(0, h));
      if (ws !== lastW) {
        win.style.width = `${ws}px`;
        lastW = ws;
      }
      if (hs !== lastH) {
        win.style.height = `${hs}px`;
        lastH = hs;
      }
      win.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0)`;
      const vis = h < 0.5 ? "hidden" : "visible"; // the stylesheet hides it until it opens
      if (win.style.visibility !== vis) win.style.visibility = vis;
      films.style.transform = `translate3d(${f1(w / 2)}px, ${f1(h / 2)}px, 0)`;
      // opening from a line (or closing to one) the film keeps the frame's full
      // size, so the slit opens onto it; between frames it covers the window
      const fw = Math.max(w, hold ? hold.w : 0, 1);
      const fh = Math.max(h, hold ? hold.h : 0, 1);
      filmBase.forEach((b, v) => {
        v.style.transform = `scale(${Math.max(fw / b.w, fh / b.h).toFixed(4)})`;
      });
    };

    let tween: AnimationPlaybackControls | undefined;
    let running = false;
    const to = (target: Rect, duration: number) => {
      tween?.stop();
      if (reduce) {
        Object.assign(box, target);
        render();
        return;
      }
      const from = { ...box };
      running = true;
      tween = animate(0, 1, {
        duration,
        ease: [...EASE_CINE],
        onUpdate: (p) => {
          box.x = from.x + (target.x - from.x) * p;
          box.y = from.y + (target.y - from.y) * p;
          box.w = from.w + (target.w - from.w) * p;
          box.h = from.h + (target.h - from.h) * p;
          render();
        },
        onComplete: () => {
          running = false;
        },
      });
    };

    const place = (i: number | null) => {
      const was = current;
      current = i;
      hold = was === null && i !== null ? targetFor(i) : i === null && was !== null ? targetFor(was) : null;
      if (i !== null && was === null && box.h < 1) {
        // opening from nothing: start as a line at the frame's width
        const t = targetFor(i);
        Object.assign(box, { x: t.x, y: t.y + t.h / 2, w: t.w, h: 0 });
      }
      to(targetFor(i), i === null ? CLOSE : OPEN);
    };
    placeRef.current = place;
    refreshRef.current = () => {
      sizeFilms();
      if (!running) Object.assign(box, targetFor(current));
      render();
    };

    sizeFilms();
    Object.assign(box, targetFor(null));
    render();

    const ro = new ResizeObserver(() => refreshRef.current?.());
    ro.observe(root);
    return () => {
      tween?.stop();
      ro.disconnect();
      placeRef.current = null;
      refreshRef.current = null;
    };
  }, [reduce]);

  useEffect(() => {
    refreshRef.current?.();
  }, [isClient, portraitScreen]);

  // a new frame: the window takes its shape, its film plays from the top
  useEffect(() => {
    activeRef.current = active;
    placeRef.current?.(active);
    const vids = videoRefs.current;
    if (active !== null) {
      const v = vids[active];
      if (v) {
        v.muted = true;
        v.setAttribute("muted", "");
        v.currentTime = 0;
        v.play().catch(() => {});
      }
    }
    const t = window.setTimeout(() => {
      vids.forEach((o, i) => {
        if (o && i !== active) o.pause();
      });
    }, 1000);
    return () => window.clearTimeout(t);
  }, [active]);

  // the films load ahead once the page has settled
  useEffect(() => {
    if (!isClient) return;
    const t = window.setTimeout(() => {
      videoRefs.current.forEach((v) => {
        if (v) v.preload = "auto";
      });
    }, 1800);
    return () => window.clearTimeout(t);
  }, [isClient, portraitScreen]);

  // ---- touch screens: the frames play through on their own ----
  useEffect(() => {
    if (!isClient || window.matchMedia("(hover: hover)").matches) return;
    const id = window.setInterval(() => {
      if (!readyRef.current) return;
      if (performance.now() - lastTouch.current < CYCLE * 2000) return;
      setActive((a) => (a === null ? 0 : (a + 1) % FRAMES.length));
    }, CYCLE * 1000);
    return () => window.clearInterval(id);
  }, [isClient]);

  const enter = useCallback((i: number) => {
    window.clearTimeout(leaveTimer.current);
    if (!readyRef.current) return;
    setActive(i);
  }, []);
  const leave = useCallback(() => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setActive(null), LEAVE_GRACE);
  }, []);

  const rise = (delay: number, y = 18) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0, transition: { delay, duration: 1.1, ease: EASE } },
        };
  const fade = (delay: number) =>
    reduce
      ? { initial: false as const }
      : { initial: { opacity: 0 }, animate: { opacity: 1, transition: { delay, duration: 1, ease: EASE } } };

  const a = active === null ? null : FRAMES[active];

  return (
    <section
      ref={rootRef}
      className={`${styles.root} ${wide.variable} ${a?.shape === "beyond" ? styles.isBeyond : ""}`}
      aria-label="16x9 & Beyond — stories beyond the frame"
    >
      {/* ================= the window, behind the line ================= */}
      <div ref={winRef} className={styles.win} aria-hidden="true">
        <div ref={filmsRef} className={styles.films}>
          {isClient &&
            FRAMES.map((f, i) => {
              const cut = portraitScreen ? f.small : f.desk;
              return (
                <video
                  key={f.key}
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  className={`${styles.film} ${i === active ? styles.filmOn : ""}`}
                  src={cut.src}
                  poster={cut.poster}
                  data-aspect={cut.aspect}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                />
              );
            })}
        </div>
      </div>

      {/* ================= everything set in ink, in difference over the film ================= */}
      <div className={styles.ink}>
        <motion.a href="#top" className={styles.logo} aria-label="16x9 & Beyond — home" {...fade(T.chrome)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9 & Beyond" />
        </motion.a>
        <motion.p className={styles.logline} {...fade(T.chrome)}>
          Stories beyond the frame
        </motion.p>

        <h1 className={styles.line} onPointerLeave={leave}>
          <span className={styles.sr}>16x9 &amp; Beyond — stories beyond the frame: </span>
          {FRAMES.map((f, i) => (
            <span key={f.key} className={styles.slot}>
              {i > 0 && (
                <motion.span className={styles.sep} aria-hidden="true" {...fade(T.words + 0.35 + i * 0.1)}>
                  ×
                </motion.span>
              )}
              <span className={styles.mask}>
                <motion.a
                  href={f.href}
                  className={`${styles.word} ${i === active ? styles.wordOn : ""}`}
                  aria-label={`${f.word} — ${f.line}`}
                  onPointerEnter={(e) => e.pointerType === "mouse" && enter(i)}
                  onFocus={() => enter(i)}
                  onBlur={leave}
                  onClick={(e) => {
                    // touch: the first tap opens the frame, the second goes in
                    if (activeRef.current !== i) {
                      e.preventDefault();
                      lastTouch.current = performance.now();
                      enter(i);
                    }
                  }}
                  {...(reduce
                    ? {}
                    : {
                        initial: { y: "110%" },
                        animate: { y: 0, transition: { delay: T.words + i * 0.12, duration: 1.15, ease: EASE } },
                      })}
                >
                  <Word text={f.word} />
                  {/* crop marks hold the word you're on */}
                  <span className={styles.marks} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </motion.a>
              </span>
            </span>
          ))}
        </h1>

        <motion.p className={styles.caption} aria-live="polite" {...fade(T.chrome + 0.1)}>
          <span key={a?.key ?? "idle"} className={styles.captionText}>
            {a ? (
              <>
                <b>{a.no}</b> {a.line}
              </>
            ) : (
              "Point at a frame"
            )}
          </span>
        </motion.p>

        <motion.nav className={styles.footL} aria-label="Main" {...rise(T.chrome + 0.1, 8)}>
          <a href="#who-we-are">Who we are</a>
          <a href="#contact">Contact</a>
          <a href="#instagram">Instagram</a>
          <a href="#linkedin">LinkedIn</a>
        </motion.nav>
        <motion.p className={styles.footR} {...rise(T.chrome + 0.15, 8)}>
          Dubai <span suppressHydrationWarning>{time || "--:--:--"}</span>
        </motion.p>
      </div>
    </section>
  );
}
