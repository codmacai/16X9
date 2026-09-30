"use client";

import React, { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import CRTScreen from "./crt/CRTScreen";
import styles from "./Hero.module.css";

/**
 * Your clips. Put the files in /public/clips.
 * Keep them short (5–15 s), muted, 720p or smaller, under ~3 MB each.
 * Any clip that can't be found shows a placeholder until you add it.
 */
const CLIPS = [
  { title: "Aster SS26", duration: "0:48", src: "/clips/clip-01.mp4" },
  { title: "Oko Audio launch", duration: "1:12", src: "/clips/clip-02.mp4" },
  { title: "Maison Vert winter", duration: "0:30", src: "/clips/clip-03.mp4" },
  { title: "Tessera watches", duration: "0:45", src: "/clips/clip-04.mp4" },
  { title: "Kaji studio", duration: "1:05", src: "/clips/clip-05.mp4" },
  { title: "Lumen & Co scent", duration: "0:20", src: "/clips/clip-06.mp4" },
  { title: "Norrland outerwear", duration: "0:58", src: "/clips/clip-07.mp4" },
  { title: "Night run", duration: "0:36", src: "/clips/clip-08.mp4" },
  { title: "Atelier", duration: "0:42", src: "/clips/clip-09.mp4" },
  { title: "Coastline", duration: "1:20", src: "/clips/clip-10.mp4" },
  { title: "Studio session", duration: "0:25", src: "/clips/clip-11.mp4" },
  { title: "Launch day", duration: "0:52", src: "/clips/clip-12.mp4" },
];

/** Header links. */
const NAV = [
  { label: "Cases", href: "https://16x9.agency/cases/" },
  { label: "Services", href: "https://16x9.agency/services/" },
  { label: "About", href: "https://16x9.agency/about/" },
];
const CONTACT_HREF = "https://16x9.agency/#";
/** Set to your logo file in /public (e.g. "/logo.svg"), or null for the text logo. */
const LOGO_SRC: string | null = "/logo.png";

const HEADLINE = ["Bringing brands", "to life"];
const SUB = "Turn target audience into your viewers";

const CLIENTS = [
  { name: "Norrland", cls: styles.logoA },
  { name: "oko", cls: styles.logoB },
  { name: "Maison Vert", cls: styles.logoC },
  { name: "TESSERA", cls: styles.logoD },
  { name: "kaji", cls: styles.logoB },
  { name: "Lumen & Co", cls: styles.logoC },
];

// ===========================================================================
// ENTRANCE — one timeline, in seconds.
// The tube powers on (a line of light, then the picture opens from the
// centre), the channels light up from the middle outwards, the header draws
// itself, the headline rises, then the small print settles in.
// ===========================================================================
const EASE = [0.16, 1, 0.3, 1] as const; // long, soft settle
const EASE_CINE = [0.76, 0, 0.24, 1] as const; // shutter-like in and out
const T = {
  line: 0.25, // line of light draws across
  open: 0.8, // picture opens from the centre
  tiles: 0.95, // first channels light up
  tileSpread: 0.55, // how long the ripple takes to reach the edges
  header: 1.35,
  headline: 1.55,
  sub: 2.0,
  clients: 2.2,
  hud: 2.3,
  ready: 2.6, // hover and clicks unlock
};

const pad = (n: number) => String(n).padStart(2, "0");

/** hh:mm:ss:ff at 24 fps, written straight to the DOM so React doesn't re-render. */
function Timecode() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = performance.now() - (11 * 60 + 1) * 1000;
    let raf = 0;
    let last = "";
    const tick = (now: number) => {
      const frames = Math.floor(((now - start) / 1000) * 24);
      const s = Math.floor(frames / 24);
      const tc = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(frames % 24)}`;
      if (tc !== last && ref.current) {
        ref.current.textContent = tc;
        last = tc;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span ref={ref} className={styles.tc}>
      00:11:01:00
    </span>
  );
}

/** Starts muted autoplay reliably across browsers (incl. iOS Safari). */
const autoplay = (el: HTMLVideoElement | null) => {
  if (!el) return;
  el.muted = true;
  el.setAttribute("muted", "");
  el.setAttribute("playsinline", "");
  el.play().catch(() => {});
};

function Clip({
  index,
  src,
  failed,
  onFail,
}: {
  index: number;
  src: string;
  failed: boolean;
  onFail: (i: number) => void;
}) {
  if (failed) {
    return (
      <div className={styles.placeholder} style={{ "--seed": index } as CSSProperties}>
        <div />
      </div>
    );
  }
  return (
    <video
      ref={autoplay}
      className={styles.video}
      src={src}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      onError={() => onFail(index)}
    />
  );
}

/** The tube switching on: a line of light, then the picture opens from the centre. */
function PowerOn({ onDone }: { onDone: () => void }) {
  return (
    <div className={styles.power} aria-hidden="true">
      <motion.div
        className={styles.powerTop}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ delay: T.open, duration: 1, ease: EASE_CINE }}
      />
      <motion.div
        className={styles.powerBottom}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ delay: T.open, duration: 1, ease: EASE_CINE }}
        onAnimationComplete={onDone}
      />
      <motion.div
        className={styles.powerLine}
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0], scaleY: [1, 1, 6] }}
        transition={{ delay: T.line, duration: 1.2, times: [0, 0.45, 1], ease: EASE_CINE }}
      />
    </div>
  );
}

export default function Hero() {
  const reduce = !!useReducedMotion();
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [failed, setFailed] = useState<boolean[]>(() => CLIPS.map(() => false));
  const [menuOpen, setMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [powered, setPowered] = useState(false);

  // Unlock hover and clicks once the entrance has played
  useEffect(() => {
    if (reduce) {
      setReady(true);
      setPowered(true);
      return;
    }
    const id = window.setTimeout(() => setReady(true), T.ready * 1000);
    return () => window.clearTimeout(id);
  }, [reduce]);

  // header: a red marker slides along the hairline to whatever you point at
  const headerRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [markIdx, setMarkIdx] = useState<number | null>(null);
  const [mark, setMark] = useState({ x: 0, w: 0 });
  useEffect(() => {
    if (markIdx === null) return;
    const h = headerRef.current;
    const a = linkRefs.current[markIdx];
    if (!h || !a) return;
    const hr = h.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    setMark({ x: ar.left - hr.left, w: ar.width });
  }, [markIdx]);
  const pointAt = (i: number) => ({
    onPointerEnter: () => setMarkIdx(i),
    onFocus: () => setMarkIdx(i),
    onBlur: () => setMarkIdx(null),
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const sync = () => {
      setCompact(mq.matches);
      setMarkIdx(null);
      if (!mq.matches) setMenuOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocused(null);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- light that follows the pointer across the wall ----
  const wallRef = useRef<HTMLDivElement>(null);
  const light = useRef({ x: 0, y: 0, tx: 0, ty: 0, raf: 0, seen: false });
  const stepLight = useRef<() => void>(() => {});
  stepLight.current = () => {
    const L = light.current;
    const w = wallRef.current;
    if (!w) {
      L.raf = 0;
      return;
    }
    const k = reduce ? 1 : 0.16; // glide factor: lower = softer trail
    L.x += (L.tx - L.x) * k;
    L.y += (L.ty - L.y) * k;
    w.style.setProperty("--lx", `${L.x.toFixed(1)}px`);
    w.style.setProperty("--ly", `${L.y.toFixed(1)}px`);
    L.raf = Math.abs(L.tx - L.x) + Math.abs(L.ty - L.y) > 0.5 ? requestAnimationFrame(() => stepLight.current()) : 0;
  };
  const moveLight = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ready) return;
    const w = wallRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    const L = light.current;
    L.tx = e.clientX - r.left;
    L.ty = e.clientY - r.top;
    if (!L.seen) {
      // first time in: start the light right under the pointer
      L.seen = true;
      L.x = L.tx;
      L.y = L.ty;
    }
    w.dataset.light = "on";
    if (!L.raf) L.raf = requestAnimationFrame(() => stepLight.current());
  };
  const hideLight = () => {
    if (wallRef.current) wallRef.current.dataset.light = "off";
  };
  useEffect(() => () => cancelAnimationFrame(light.current.raf), []);

  const onFail = useCallback((i: number) => {
    setFailed((f) => (f[i] ? f : f.map((v, j) => (j === i ? true : v))));
  }, []);

  const cols = compact ? 2 : 4;
  const rows = compact ? 4 : 3;
  const clips = CLIPS.slice(0, cols * rows);
  const grid = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  } as CSSProperties;
  const current = focused !== null ? CLIPS[focused] : null;

  /** Entrance helper: from -> to at a point on the timeline (skipped for reduced motion). */
  const enter = (delay: number, from: TargetAndTransition, to: TargetAndTransition, duration = 1.1) =>
    reduce ? { initial: false as const } : { initial: from, animate: { ...to, transition: { delay, duration, ease: EASE } } };

  /** How far a tile sits from the middle of the grid, 0 (centre) to 1 (corner). */
  const reach = (i: number) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const dx = (c - (cols - 1) / 2) / (cols / 2);
    const dy = (r - (rows - 1) / 2) / (rows / 2);
    return Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
  };

  return (
    <main className={styles.page}>
      <CRTScreen
        curvature={compact ? 0.06 : 0.1}
        scanlineSize={3}
        scanlineOpacity={0.3}
        scanlineColor="#1a0004"
        vignette={0.72}
        aberration={0}
        phosphor={0}
        backdrop={
          <div ref={wallRef} className={styles.wall} data-hover={active !== null} data-focus={focused !== null} data-light="off">
            <div className={styles.grid} style={grid}>
              {clips.map((c, i) => (
                <motion.div
                  key={c.src}
                  className={styles.tile}
                  data-active={active === i}
                  {...(reduce
                    ? { initial: false as const }
                    : {
                        initial: { opacity: 0, scale: 1.14 },
                        animate: {
                          opacity: 1,
                          scale: 1,
                          transition: {
                            delay: ready ? reach(i) * 0.2 : T.tiles + reach(i) * T.tileSpread,
                            duration: 1.3,
                            ease: EASE,
                          },
                        },
                      })}
                >
                  <Clip index={i} src={c.src} failed={failed[i]} onFail={onFail} />
                  <div className={styles.grade} />
                </motion.div>
              ))}
            </div>
            <div className={styles.spot} />
            <div className={styles.light} />

            {current && focused !== null && (
              <div key={focused} className={styles.channel}>
                <Clip index={focused} src={current.src} failed={failed[focused]} onFail={onFail} />
                <div className={styles.static} />
              </div>
            )}
          </div>
        }
      >
        <div className={styles.stage} data-focus={focused !== null} data-ready={ready}>
          {/* invisible grid on top that picks up hover, focus and clicks */}
          <div
            className={styles.hitGrid}
            style={grid}
            onPointerMove={moveLight}
            onPointerLeave={() => {
              setActive(null);
              hideLight();
            }}
            aria-label="Films"
          >
            {clips.map((c, i) => (
              <button
                key={c.src}
                type="button"
                className={styles.hit}
                data-active={active === i}
                onPointerEnter={() => ready && setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => {
                  if (!ready) return;
                  setActive(null);
                  setMenuOpen(false);
                  setFocused(i);
                }}
                aria-label={`Play ${c.title}`}
                tabIndex={focused !== null ? -1 : 0}
              >
                <span className={styles.tag}>
                  <b>CH {pad(i + 1)}</b>
                  <span>{c.title}</span>
                  <span>{c.duration}</span>
                </span>
              </button>
            ))}
          </div>

          {/* everything that steps aside while a film is playing */}
          <div className={styles.chrome} aria-hidden={focused !== null}>
          <motion.div
            className={styles.topScrim}
            aria-hidden="true"
            {...enter(T.header - 0.2, { opacity: 0 }, { opacity: 1 }, 1.2)}
          />

          {/* ================= Header ================= */}
          <header className={styles.header} ref={headerRef} data-menu={menuOpen}>
            <motion.a
              href="https://16x9.agency/"
              className={styles.logo}
              aria-label="16x9, home"
              {...enter(T.header, { opacity: 0, y: -12 }, { opacity: 1, y: 0 })}
            >
              {LOGO_SRC ? <img src={LOGO_SRC} alt="" /> : "16x9"}
            </motion.a>

            <nav className={styles.links} aria-label="Main" onPointerLeave={() => setMarkIdx(null)}>
              {NAV.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  ref={(el: HTMLAnchorElement | null) => {
                    linkRefs.current[i] = el;
                  }}
                  className={styles.link}
                  {...pointAt(i)}
                  {...enter(T.header + 0.1 + i * 0.07, { opacity: 0, y: -12 }, { opacity: 0.72, y: 0 })}
                >
                  <span className={styles.roll} data-text={l.label}>
                    <span>{l.label}</span>
                  </span>
                </motion.a>
              ))}
            </nav>

            <motion.a
              href={CONTACT_HREF}
              ref={(el: HTMLAnchorElement | null) => {
                linkRefs.current[NAV.length] = el;
              }}
              className={`${styles.link} ${styles.contact}`}
              onPointerLeave={() => setMarkIdx(null)}
              {...pointAt(NAV.length)}
              {...enter(T.header + 0.35, { opacity: 0, y: -12 }, { opacity: 1, y: 0 })}
            >
              <i className={styles.ctaRec} aria-hidden="true" />
              <span className={styles.roll} data-text="Contact us">
                <span>Contact us</span>
              </span>
            </motion.a>

            <motion.button
              type="button"
              className={styles.menuBtn}
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="hero-menu"
              {...enter(T.header + 0.1, { opacity: 0, y: -12 }, { opacity: 1, y: 0 })}
            >
              <span>{menuOpen ? "Close" : "Menu"}</span>
              <i aria-hidden="true" />
            </motion.button>

            <motion.span
              className={styles.rule}
              aria-hidden="true"
              {...enter(T.header, { scaleX: 0 }, { scaleX: 1 }, 1.6)}
            >
              <span
                className={styles.ruleMark}
                style={{ left: mark.x, width: mark.w, opacity: markIdx === null ? 0 : 1 }}
              />
            </motion.span>
          </header>

          </div>

          {/* phones: full-screen menu */}
          <div id="hero-menu" className={styles.menu} data-open={menuOpen} aria-hidden={!menuOpen}>
            <nav aria-label="Menu" className={styles.menuLinks}>
              {NAV.map((l, i) => (
                <a
                  key={l.href}
                  href={l.href}
                  className={styles.menuLink}
                  style={{ "--i": i } as CSSProperties}
                  tabIndex={menuOpen ? 0 : -1}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <a
              href={CONTACT_HREF}
              className={styles.menuContact}
              style={{ "--i": NAV.length } as CSSProperties}
              tabIndex={menuOpen ? 0 : -1}
            >
              <i className={styles.ctaRec} aria-hidden="true" />
              Contact us
            </a>
          </div>

          {/* ================= Headline ================= */}
          <section className={styles.copy}>
            <h1 className={styles.headline}>
              {HEADLINE.map((line, i) => (
                <span key={line} className={styles.line}>
                  <motion.span
                    className={styles.lineInner}
                    {...enter(
                      T.headline + i * 0.12,
                      { y: "115%", rotate: 3 },
                      { y: "0%", rotate: 0 },
                      1.3
                    )}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p
              className={styles.sub}
              {...enter(T.sub, { opacity: 0, y: 14, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)" })}
            >
              {SUB}
            </motion.p>
          </section>

          {/* ================= Now playing ================= */}
          <AnimatePresence>
            {current && focused !== null && (
              <motion.div
                className={styles.nowPlaying}
                key={focused}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.8, ease: EASE } }}
                exit={{ opacity: 0, y: 12, transition: { duration: 0.3, ease: EASE_CINE } }}
              >
                <span className={styles.npNumber}>
                  <motion.b
                    initial={reduce ? false : { y: "100%" }}
                    animate={{ y: "0%", transition: { delay: 0.25, duration: 0.9, ease: EASE } }}
                  >
                    CH {pad(focused + 1)}
                  </motion.b>
                </span>
                <div>
                  <span>{current.title}</span>
                  <span>{current.duration}</span>
                </div>
                <button
                  type="button"
                  className={`${styles.cta} ${styles.ctaDark} ${styles.close}`}
                  onClick={() => setFocused(null)}
                  autoFocus
                >
                  <i className={styles.back} aria-hidden="true" />
                  <span className={styles.ctaText} data-text="All films">
                    <span>All films</span>
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.chrome} aria-hidden={focused !== null}>
          {/* ================= Clients + HUD ================= */}
          <motion.div
            className={styles.clients}
            aria-label="Clients"
            {...enter(T.clients, { opacity: 0 }, { opacity: 1 }, 1.4)}
          >
            <div className={styles.track}>
              {[...CLIENTS, ...CLIENTS].map((c, i) => (
                <span key={i} className={c.cls} aria-hidden={i >= CLIENTS.length}>
                  {c.name}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.footer
            className={styles.hud}
            {...enter(T.hud, { opacity: 0, y: 12 }, { opacity: 1, y: 0 })}
          >
            <span className={styles.rec}>
              <i aria-hidden="true" />
              Rec <Timecode />
            </span>
            <span>{focused !== null ? "Esc to go back" : "Hover a channel, click to tune in"}</span>
            <span>Est. 2019</span>
          </motion.footer>

          </div>

          {!reduce && !powered && <PowerOn onDone={() => setPowered(true)} />}
        </div>
      </CRTScreen>
    </main>
  );
}