"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type Ref } from "react";
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
import styles from "./hero18.module.css";

// ===========================================================================
// HERO 18 — "Three frames". Black, one line of light, three formats.
//
// At rest the page is black with a single slit of light running through the
// middle of the line: 16x9 × 9x16 × BEYOND. Point at a word and the slit
// opens into its frame: a landscape window, a tall one, or the whole screen.
// The window morphs from one shape to the next as you move along the words,
// carrying its corner marks and aspect label with it, and closes back to the
// slit when you leave. Everything set in ink is in difference, so where the
// film passes behind the type it turns negative.
//
// The frame's description sits under the line in its own space; the foot is
// one bar (links left, Dubai time right), so nothing ever crowds.
// On touch screens the frames play through on their own.
//
// Smooth: the window is one clipped box resized by the engine; the film
// inside is only scaled; marks, label and slit are transforms; one film
// plays at a time; the grain is painted once.
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
  ratio: string;
  title: string;
  detail: string;
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
    ratio: "16 : 9",
    title: "Films for the big screen",
    detail: "TVCs · Brand films · Documentaries",
    href: "#16x9",
    shape: "wide",
    desk: { src: `${F}/wide-1080.mp4`, poster: `${F}/wide.webp`, aspect: 16 / 9 },
    small: { src: `${F}/wide-540.mp4`, poster: `${F}/wide-540.webp`, aspect: 16 / 9 },
  },
  {
    key: "9x16",
    no: "02",
    word: "9x16",
    ratio: "9 : 16",
    title: "Stories made for the scroll",
    detail: "Social · Branded content",
    href: "#9x16",
    shape: "tall",
    desk: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: V },
    small: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: V },
  },
  {
    key: "beyond",
    no: "03",
    word: "Beyond",
    ratio: "Beyond",
    title: "Stories you step into",
    detail: "Immersive · Interactive",
    href: "#beyond",
    shape: "beyond",
    desk: { src: `${F}/beyond-1080.mp4`, poster: `${F}/beyond.webp`, aspect: 16 / 9 },
    small: { src: `${F}/beyond-m.mp4`, poster: `${F}/beyond-m.webp`, aspect: V },
  },
];

const T = { slit: 0.2, words: 0.75, chrome: 1.3, ready: 2.0 };
const OPEN = 1.0; // a frame opening or changing shape
const CLOSE = 0.75; // back to the slit
const CYCLE = 4.5; // touch screens: seconds per frame
const LEAVE_GRACE = 160; // ms: moving across a separator doesn't close the frame
const MARK_INSET = 22; // px: in Beyond the corner marks sit this far inside the screen
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
  const lineRef = useRef<HTMLHeadingElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const filmsRef = useRef<HTMLDivElement>(null);
  const slitRef = useRef<HTMLDivElement>(null);
  const markRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLSpanElement>(null);
  const footRef = useRef<HTMLElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const cursorRef = useRef<CursorHandle>(null);
  const placeRef = useRef<((i: number | null) => void) | null>(null);
  const refreshRef = useRef<(() => void) | null>(null);
  const [time, setTime] = useState("");

  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => (readyRef.current = true), T.ready * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // ---- Dubai time, ticking ----
  useEffect(() => {
    const tick = () => setTime(dubaiTime());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  // ---- the engine: the window, its marks and label, and the slit ----
  useEffect(() => {
    const root = rootRef.current;
    const line = lineRef.current;
    const win = winRef.current;
    const films = filmsRef.current;
    const slit = slitRef.current;
    const label = labelRef.current;
    const caption = captionRef.current;
    const foot = footRef.current;
    if (!root || !line || !win || !films || !slit || !label || !caption || !foot) return;
    // measured on resize (never per frame): the line's middle and foot, the foot bar's top
    const geo = { cx: 0, lineBottom: 0, footTop: 0, capH: 0 };
    const measure = () => {
      const r = root.getBoundingClientRect();
      const l = line.getBoundingClientRect();
      geo.cx = l.left - r.left + l.width / 2;
      geo.lineBottom = l.bottom - r.top;
      geo.footTop = foot.getBoundingClientRect().top - r.top;
      geo.capH = caption.offsetHeight;
    };

    const box: Rect = { x: 0, y: 0, w: 0, h: 0 };
    const filmBase = new Map<HTMLVideoElement, { w: number; h: number }>();
    let current: number | null = null;
    let hold: Rect | null = null; // the frame's full size while the slit opens or closes

    // the window opens around the middle of the line
    const centre = () => {
      const r = root.getBoundingClientRect();
      const l = line.getBoundingClientRect();
      return { vw: r.width, vh: r.height, cx: l.left - r.left + l.width / 2, cy: l.top - r.top + l.height / 2, lw: l.width };
    };

    const targetFor = (i: number | null): Rect => {
      const { vw, vh, cx, cy, lw } = centre();
      const narrow = vw <= 760;
      if (i === null) {
        // shut: the slit, a line through the words, a little wider than they are
        const w = Math.min(vw - 2 * MARK_INSET, lw * (narrow ? 1.25 : 1.12));
        return { x: cx - w / 2, y: cy, w, h: 0 };
      }
      const shape = FRAMES[i].shape;
      if (shape === "beyond") return { x: 0, y: 0, w: vw, h: vh };
      if (shape === "tall") {
        const h = Math.min(vh * (narrow ? 0.68 : 0.72), (vw * 0.84 * 16) / 9);
        const w = (h * 9) / 16;
        return { x: cx - w / 2, y: cy - h / 2, w, h };
      }
      const w = Math.min(vw * (narrow ? 0.9 : 0.62), (vh * 0.6 * 16) / 9);
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

    const f1 = (n: number) => n.toFixed(1);
    let lastW = "";
    let lastH = "";
    const render = () => {
      const { x, y, w, h } = box;
      const vw = root.clientWidth;
      const vh = root.clientHeight;
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

      // the film: centred in the window, covering it (or the full frame while the slit opens)
      films.style.transform = `translate3d(${f1(w / 2)}px, ${f1(h / 2)}px, 0)`;
      const fw = Math.max(w, hold ? hold.w : 0, 1);
      const fh = Math.max(h, hold ? hold.h : 0, 1);
      filmBase.forEach((b, v) => {
        v.style.transform = `scale(${Math.max(fw / b.w, fh / b.h).toFixed(4)})`;
      });

      // the slit: brightest when shut, gone once the window has opened a little
      slit.style.transform = `translate3d(${f1(x)}px, ${f1(y + h / 2)}px, 0) scaleX(${f1(Math.max(1, w))})`;
      slit.style.opacity = Math.max(0, 1 - h / 14).toFixed(3);

      // corner marks and the label ride the window, kept inside the screen
      const m = MARK_INSET;
      const lx = Math.max(x, m);
      const ty = Math.max(y, m);
      const rx = Math.min(x + w, vw - m);
      const by = Math.min(y + h, vh - m);
      const open = Math.max(0, Math.min(1, (h - 8) / 60)).toFixed(3);
      const spots: [number, number][] = [
        [lx, ty],
        [rx, ty],
        [rx, by],
        [lx, by],
      ];
      markRefs.current.forEach((el, i) => {
        if (!el) return;
        el.style.transform = `translate3d(${f1(spots[i][0])}px, ${f1(spots[i][1])}px, 0)`;
        el.style.opacity = open;
      });
      label.style.transform = `translate3d(${f1(lx)}px, ${f1(ty)}px, 0)`;
      label.style.opacity = open;

      // the caption: under the line, pushed below the window as it opens, kept above the foot
      const gap = Math.max(22, vh * 0.035);
      const capY = Math.min(Math.max(geo.lineBottom + gap, y + h + gap), geo.footTop - geo.capH - gap);
      caption.style.transform = `translate3d(${f1(geo.cx)}px, ${f1(capY)}px, 0)`;
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
      to(targetFor(i), i === null ? CLOSE : OPEN);
    };
    placeRef.current = place;
    refreshRef.current = () => {
      measure();
      sizeFilms();
      if (!running) Object.assign(box, targetFor(current));
      render();
    };

    measure();
    sizeFilms();
    Object.assign(box, targetFor(null));
    render();

    const ro = new ResizeObserver(() => refreshRef.current?.());
    ro.observe(root);
    ro.observe(line);
    document.fonts?.ready.then(() => refreshRef.current?.()).catch(() => {});
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
        v.setAttribute("muted", ""); // iOS wants the attribute before it will autoplay
        v.currentTime = 0;
        v.play().catch(() => {});
      }
    }
    const t = window.setTimeout(() => {
      vids.forEach((o, i) => {
        if (o && i !== active) o.pause();
      });
    }, 1100);
    return () => window.clearTimeout(t);
  }, [active]);

  // the films load ahead once the page has settled
  useEffect(() => {
    if (!isClient) return;
    const t = window.setTimeout(() => {
      videoRefs.current.forEach((v) => {
        if (v) v.preload = "auto";
      });
    }, 2200);
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

  const fade = (delay: number, y = 0) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0, transition: { delay, duration: 1.2, ease: EASE } },
        };

  const a = active === null ? null : FRAMES[active];

  return (
    <section
      ref={rootRef}
      className={`${styles.root} ${wide.variable} ${a?.shape === "beyond" ? styles.isBeyond : ""}`}
      aria-label="16x9 & Beyond — stories beyond the frame"
    >
      {/* ================= the window, behind everything in ink ================= */}
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

      {/* the slit of light: the window, shut */}
      <div ref={slitRef} className={styles.slit} aria-hidden="true">
        <span />
      </div>

      {/* the window's corner marks and aspect label */}
      <div className={styles.frameUi} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            ref={(el) => {
              markRefs.current[i] = el;
            }}
            className={styles.mark}
          />
        ))}
        <span ref={labelRef} className={styles.labelAnchor}>
          <span key={a?.key ?? "none"} className={styles.label}>
            {a?.ratio ?? ""}
          </span>
        </span>
        {/* the frame's description: under the line when shut, under the window when
            open, above the foot in Beyond (placed by the engine, never crowding) */}
        <span ref={captionRef} className={styles.captionAnchor}>
          <motion.div className={styles.caption} aria-live="polite" {...fade(T.chrome + 0.15)}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={a?.key ?? "idle"}
                className={styles.captionText}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.2, ease: EASE } }}
              >
                {a ? (
                  <>
                    <span className={styles.captionTitle}>{a.title}</span>
                    <span className={styles.captionDetail}>{a.detail}</span>
                  </>
                ) : (
                  <span className={styles.captionIdle}>Point at a frame</span>
                )}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        </span>
      </div>

      {/* fine grain over the whole page, painted once */}
      <div className={styles.grain} aria-hidden="true" />

      {/* ================= everything in ink: difference over the film ================= */}
      <div className={styles.ink}>
        <header className={styles.top}>
          <motion.a href="#top" className={styles.logo} aria-label="16x9 & Beyond — home" {...fade(T.chrome)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="16x9 & Beyond" />
          </motion.a>
          <motion.p className={styles.studio} {...fade(T.chrome + 0.05)}>
            16x9 &amp; Beyond
            <span>A film studio · Dubai</span>
          </motion.p>
          <motion.p className={styles.logline} {...fade(T.chrome + 0.1)}>
            Stories beyond the frame
          </motion.p>
        </header>

        <div className={styles.centre}>
          <h1 ref={lineRef} className={styles.line} onPointerLeave={leave}>
            <span className={styles.sr}>16x9 &amp; Beyond — stories beyond the frame: </span>
            {FRAMES.map((f, i) => (
              <span key={f.key} className={styles.slot}>
                {i > 0 && (
                  <motion.span className={styles.sep} aria-hidden="true" {...fade(T.words + 0.3 + i * 0.1)}>
                    ×
                  </motion.span>
                )}
                <span className={styles.mask}>
                  <motion.a
                    href={f.href}
                    className={`${styles.word} ${i === active ? styles.wordOn : ""} ${active !== null && i !== active ? styles.wordAway : ""}`}
                    aria-label={`${f.word} — ${f.title}`}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== "mouse") return;
                      enter(i);
                      cursorRef.current?.show(true);
                    }}
                    onPointerLeave={() => cursorRef.current?.show(false)}
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
                          initial: { y: "115%" },
                          animate: { y: 0, transition: { delay: T.words + i * 0.13, duration: 1.3, ease: EASE } },
                        })}
                  >
                    <sup className={styles.no}>{f.no}</sup>
                    <Word text={f.word} />
                  </motion.a>
                </span>
              </span>
            ))}
          </h1>

        </div>

        <motion.footer ref={footRef} className={styles.foot} {...fade(T.chrome + 0.2, 6)}>
          <nav className={styles.links} aria-label="Main">
            <a href="#who-we-are">Who we are</a>
            <a href="#contact">Contact</a>
            <a href="#instagram">Instagram</a>
            <a href="#linkedin">LinkedIn</a>
          </nav>
          <p className={styles.clock}>
            <i aria-hidden="true" />
            Dubai <span suppressHydrationWarning>{time || "--:--:--"}</span>
          </p>
        </motion.footer>

        <Cursor ref={cursorRef} />
      </div>
    </section>
  );
}

// ===========================================================================
// CURSOR — over a word, a thin ring that reads "Enter". Shown through a ref,
// so following the pointer never re-renders the page.
// ===========================================================================
type CursorHandle = { show: (on: boolean) => void };

function Cursor({ ref }: { ref: Ref<CursorHandle> }) {
  const [on, setOn] = useState(false);
  useImperativeHandle(ref, () => ({ show: setOn }), []);
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
        {on && (
          <motion.span
            key="ring"
            className={styles.ring}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.45, ease: EASE } }}
            exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.25, ease: EASE } }}
          >
            Enter
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
