"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { animate, motion, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";
import { Archivo } from "next/font/google";
import styles from "./hero17.module.css";

// ===========================================================================
// HERO 17 — the 16x9 homepage on a filmmaker's screen.
//
// No block grid: the crop frame carries a monitor's guides (action safe,
// title safe, thirds, a centre cross), and four faint registration lines run
// from its edges across the page, moving as the frame changes shape. The
// switcher is a minimal timeline: one hairline, the formats as words, a
// red playhead running along it as the timer, and a live timecode.
//
// From hero 16: hero 15 on black.
//
// Now full page (no display), white paper and black ink, set in our wide
// Archivo: the 9x16 grid as faint rules, the crop-box frame with square
// handles, and the aspect-ratio toolbar as the switcher.
//
// (Earlier: sister to 9x16.studio.)
//
// 9x16 lives inside a phone on a top-down street; 16x9 lives inside a
// widescreen display on a Dubai highway, its status bar reading 16:09. Same
// system: a coral grid with white rules, heavy lowercase type with words
// boxed out, a white header bar, an editor's crop tool with square handles.
//
// The homepage: "stories beyond the frame." The film plays inside a crop box;
// the switcher is an aspect-ratio toolbar. 16x9: the box is wide. 9x16: it is
// dragged tall. Beyond: its handles drag out past the edge of the screen and
// the film escapes the device to fill the world.
//
// Smooth: the crop box is one clipped window resized per frame (no paint),
// the film inside only scaled; one film plays at a time.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

type Cut = { src: string; poster: string; aspect: number };
type Film = { desk: Cut; small: Cut };
const F = "/hero14/films";
const V = 608 / 1080;
type Mode = {
  key: string;
  no: string;
  label: string;
  ratio: string;
  line: string;
  href: string;
  film: Film;
  shape: "wide" | "tall" | "beyond";
};

const MODES: Mode[] = [
  {
    key: "16x9",
    no: "01",
    label: "16x9",
    ratio: "16 : 9",
    line: "the big screen",
    href: "#16x9",
    film: {
      desk: { src: `${F}/wide-1080.mp4`, poster: `${F}/wide.webp`, aspect: 16 / 9 },
      small: { src: `${F}/wide-540.mp4`, poster: `${F}/wide-540.webp`, aspect: 16 / 9 },
    },
    shape: "wide",
  },
  {
    key: "9x16",
    no: "02",
    label: "9x16",
    ratio: "9 : 16",
    line: "the scroll",
    href: "#9x16",
    film: {
      desk: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: V },
      small: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, aspect: V },
    },
    shape: "tall",
  },
  {
    key: "beyond",
    no: "03",
    label: "beyond",
    ratio: "beyond",
    line: "the frame",
    href: "#beyond",
    film: {
      desk: { src: `${F}/beyond-1080.mp4`, poster: `${F}/beyond.webp`, aspect: 16 / 9 },
      small: { src: `${F}/beyond-m.mp4`, poster: `${F}/beyond-m.webp`, aspect: V },
    },
    shape: "beyond",
  },
];

const T = { device: 0.15, words: 0.9, crop: 1.45, cropDur: 1.1, ui: 1.7, settle: 2.9 };
const MORPH = 1.15;
const DWELL = 6.5;
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

/** The 16x9 mark: a landscape grid box, 16x top left, 9 bottom right, a wide accent cell. */
function Mark() {
  return (
    <svg className={styles.mark} viewBox="0 0 60 36" aria-hidden="true">
      <rect x="0.75" y="0.75" width="58.5" height="34.5" className={styles.markBox} />
      <path d="M0.75 22.5H59.25M40 0.75V35.25M20 22.5V35.25" className={styles.markRule} />
      <rect x="20" y="22.5" width="20" height="12.75" className={styles.markCell} />
      <text x="4" y="11.5" className={styles.markText}>
        16x
      </text>
      <text x="45" y="32" className={styles.markText}>
        9
      </text>
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

type Rect = { x: number; y: number; w: number; h: number };
type Engine = { go: (i: number) => void; refresh: () => void };

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
  const deviceRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const filmsRef = useRef<HTMLDivElement>(null);
  const edgeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const handleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tagRef = useRef<HTMLSpanElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const playRef = useRef<HTMLSpanElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const regRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const engineRef = useRef<Engine | null>(null);
  const modeRef = useRef(0);
  const pausedRef = useRef(false);

  // ---- the screen's unit: 1/100 of its width, so the site inside scales as one ----
  useEffect(() => {
    const device = deviceRef.current;
    const root = rootRef.current;
    if (!device || !root) return;
    // a 16:9 unit: the page is laid out as if fitted to a 16:9 screen
    const set = () =>
      root.style.setProperty("--u", `${Math.min(device.clientWidth / 100, device.clientHeight / 56.25)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(device);
    return () => ro.disconnect();
  }, []);

  // ---- the crop box: one clipped window, resized to the format ----
  useEffect(() => {
    const root = rootRef.current;
    const slot = slotRef.current;
    const crop = cropRef.current;
    const win = winRef.current;
    const films = filmsRef.current;
    const tag = tagRef.current;
    if (!root || !slot || !crop || !win || !films || !tag) return;

    const box: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let current = 0;
    let prog = 0;
    // the playhead runs across the three clips; the timecode runs with it (25 fps)
    let lastFrame = -1;
    const setPlayhead = () => {
      const t = (current + prog) / MODES.length;
      if (playRef.current) playRef.current.style.transform = `translate3d(${(t * 100).toFixed(3)}%, 0, 0)`;
      const fr = Math.floor((current + prog) * DWELL * 25);
      if (fr !== lastFrame && tcRef.current) {
        lastFrame = fr;
        const p2 = (n: number) => String(n).padStart(2, "0");
        tcRef.current.textContent = `00:${p2(Math.floor(fr / 1500) % 60)}:${p2(Math.floor(fr / 25) % 60)}:${p2(fr % 25)}`;
      }
    };
    const filmBase = new Map<HTMLVideoElement, { w: number; h: number }>();

    const targetFor = (i: number): Rect => {
      const r = root.getBoundingClientRect();
      const s = slot.getBoundingClientRect();
      const sx = s.left - r.left;
      const sy = s.top - r.top;
      const shape = MODES[i].shape;
      if (shape === "beyond") {
        // past the screen's edge, out into the world
        const mgn = Math.max(14, r.width * 0.018);
        const top = mgn + Math.max(22, r.width * 0.016); // room for the tag above it
        return { x: mgn, y: top, w: r.width - 2 * mgn, h: r.height - top - mgn };
      }
      if (shape === "tall") {
        const h = s.height;
        const w = (h * 9) / 16;
        return { x: sx + (s.width - w) / 2, y: sy, w, h };
      }
      return { x: sx, y: sy, w: s.width, h: s.height };
    };

    const sizeFilms = () => {
      const r = root.getBoundingClientRect();
      const base = Math.max(r.width, r.height) * 0.5;
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
      films.style.transform = `translate3d(${f1(w / 2)}px, ${f1(h / 2)}px, 0)`;
      filmBase.forEach((b, v) => {
        v.style.transform = `scale(${Math.max(w / b.w, h / b.h, 0.0001).toFixed(4)})`;
      });
      // the crop rule: four 1px lines, and a square handle at each corner
      const lines: [number, number, number, number][] = [
        [x, y, w, 1],
        [x, y + h - 1, w, 1],
        [x, y, 1, h],
        [x + w - 1, y, 1, h],
      ];
      lines.forEach(([lx, ly, sx, sy], i) => {
        const el = edgeRefs.current[i];
        if (el) el.style.transform = `translate3d(${f1(lx)}px, ${f1(ly)}px, 0) scale(${f1(Math.max(0, sx))}, ${f1(Math.max(0, sy))})`;
      });
      const corners: [number, number][] = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ];
      corners.forEach(([cx, cy], i) => {
        const el = handleRefs.current[i];
        if (el) el.style.transform = `translate3d(${f1(cx)}px, ${f1(cy)}px, 0)`;
      });
      tag.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0)`;
      // registration lines: from the frame's edges across the whole page
      const regs = [`translate3d(0, ${f1(y)}px, 0)`, `translate3d(0, ${f1(y + h - 1)}px, 0)`, `translate3d(${f1(x)}px, 0, 0)`, `translate3d(${f1(x + w - 1)}px, 0, 0)`];
      regRefs.current.forEach((el, i) => el && (el.style.transform = regs[i]));
      // the handles and the tag come in as the box is drawn out
      const shown = Math.max(0, Math.min(1, (Math.min(w, h) - 6) / 40)).toFixed(3);
      tag.style.opacity = shown;
      handleRefs.current.forEach((el) => el && (el.style.opacity = shown));
    };

    let tween: AnimationPlaybackControls | undefined;
    let running = false;
    const to = (target: Rect, duration: number, delay = 0) => {
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
        delay,
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

    const go = (i: number) => {
      if (i === current) return;
      current = i;
      prog = 0;
      setPlayhead();
      to(targetFor(i), MORPH);
    };
    const refresh = () => {
      sizeFilms();
      if (!running && box.w > 0) Object.assign(box, targetFor(current));
      render();
    };
    engineRef.current = { go, refresh };

    sizeFilms();
    // the opening: the crop is drawn out from the middle of the slot
    const start = targetFor(0);
    if (reduce) Object.assign(box, start);
    else Object.assign(box, { x: start.x + start.w / 2, y: start.y + start.h / 2, w: 0, h: 0 });
    render();
    const timer = reduce ? 0 : window.setTimeout(() => to(targetFor(0), T.cropDur), T.crop * 1000);

    const onResize = () => {
      sizeFilms();
      if (!running && box.w > 0) Object.assign(box, targetFor(current));
      render();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);
    ro.observe(slot);
    document.fonts?.ready.then(onResize).catch(() => {});

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
        setPlayhead();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      tween?.stop();
      ro.disconnect();
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
    }, 1400);
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

  const rise = (delay: number, y = 14) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0, transition: { delay, duration: 1, ease: EASE } },
        };

  return (
    <section
      ref={rootRef}
      className={`${styles.root} ${wide.variable} ${m.shape === "beyond" ? styles.isBeyond : ""}`}
      aria-label="16x9 & Beyond — stories beyond the frame"
      onPointerDown={onDown}
      onPointerUp={onUp}
    >
      {/* ================= the display ================= */}
      <motion.div
        ref={deviceRef}
        className={styles.device}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: T.device, duration: 0.8, ease: EASE } }}
      >
        <div className={styles.screen}>


          <motion.header className={styles.bar} {...rise(T.words - 0.2, -10)}>
            <a href="#top" aria-label="16x9 & Beyond — home">
              <Mark />
            </a>
            <nav className={styles.nav} aria-label="Main">
              <a href="#who-we-are">who we are</a>
              <a href="#contact">contact</a>
            </nav>
            <button type="button" className={styles.burger} aria-label="Menu">
              <span />
              <span />
              <span />
            </button>
          </motion.header>

          <div className={styles.body}>
            <div className={styles.copy}>
              <motion.p className={styles.eyebrow} {...rise(T.words)}>
                16x9 &amp; beyond — film studio, dubai
              </motion.p>
              <h1 className={styles.title}>
                <motion.span className={styles.titleLine} {...rise(T.words + 0.08, 30)}>
                  stories{" "}
                  <span className={styles.hl}>
                    <motion.span
                      className={styles.hlBox}
                      aria-hidden="true"
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1, transition: { delay: T.words + 0.55, duration: 0.7, ease: EASE_CINE } }}
                    />
                    <span className={styles.hlText}>beyond</span>
                  </span>
                </motion.span>
                <motion.span className={styles.titleLine} {...rise(T.words + 0.16, 30)}>
                  the frame.
                </motion.span>
              </h1>
              <motion.p className={styles.lede} {...rise(T.words + 0.3)}>
                TVCs, brand films and documentaries for the big screen, stories for the scroll, and worlds you can step
                into. Story always comes first.
              </motion.p>

              {/* ================= the switcher: an editing timeline ================= */}
              <motion.div className={styles.timeline} {...rise(T.ui)}>
                <div className={styles.tlHead}>
                  <span>sequence — stories beyond the frame</span>
                  <span ref={tcRef} className={styles.tc}>
                    00:00:00:00
                  </span>
                </div>
                <nav
                  className={styles.track}
                  aria-label="Formats"
                  onPointerEnter={() => (pausedRef.current = true)}
                  onPointerLeave={() => (pausedRef.current = false)}
                >
                  {MODES.map((md, i) => (
                    <button
                      key={md.key}
                      type="button"
                      className={`${styles.clip} ${i === mode ? styles.clipOn : ""}`}
                      aria-pressed={i === mode}
                      aria-label={`${md.label} — ${md.line}`}
                      disabled={!ready}
                      onClick={() => select(i)}
                    >
                      <span className={styles.clipNo}>{md.no}</span>
                      <span className={styles.clipLabel}>{md.label}</span>
                    </button>
                  ))}
                  {/* one hairline; the playhead (moved by the engine) fills it as it runs */}
                  <span className={styles.playLane} aria-hidden="true">
                    <span ref={playRef} className={styles.play}>
                      <i />
                    </span>
                  </span>
                </nav>
              </motion.div>
            </div>

            {/* where the crop box sits in the screen */}
            <div className={styles.stage}>
              <div ref={slotRef} className={styles.slot} />
              <motion.a href={m.href} className={styles.go} {...rise(T.ui + 0.1)}>
                explore <span className={styles.goHl}>{m.label}</span> →
              </motion.a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ================= the crop box: above the screen, free to leave it ================= */}
      <div ref={cropRef} className={styles.crop} aria-hidden="true">
        <div ref={winRef} className={styles.win}>
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
          {/* a monitor's guides: action safe, title safe, thirds, centre */}
          <span className={styles.guides}>
            <i className={styles.safeAction} />
            <i className={styles.safeTitle} />
            <i className={styles.thirdV} />
            <i className={styles.thirdV2} />
            <i className={styles.thirdH} />
            <i className={styles.thirdH2} />
            <i className={styles.centre} />
          </span>
        </div>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={`r${i}`}
            ref={(el) => {
              regRefs.current[i] = el;
            }}
            className={`${styles.reg} ${i < 2 ? styles.regH : styles.regV}`}
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <span
            key={`e${i}`}
            ref={(el) => {
              edgeRefs.current[i] = el;
            }}
            className={styles.edge}
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <span
            key={`h${i}`}
            ref={(el) => {
              handleRefs.current[i] = el;
            }}
            className={styles.handle}
          />
        ))}
        <span ref={tagRef} className={styles.tagAnchor}>
          <span key={m.key} className={styles.tag}>
            {m.ratio}
          </span>
        </span>
      </div>
    </section>
  );
}
