"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  cubicBezier,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "../hero7/project-view";
import { posterFor } from "../hero7/wall-playback";
import { fitStage, points, type Layout, type Stripe, type Word } from "./composition";
import styles from "./hero8.module.css";

// ===========================================================================
// HERO 8 — "16x9 & beyond", after the chevron poster reference.
//
// A white "‹" bracket and "›" arrow wrap a showreel window, slashes cut in from
// the corners, and the headline sits above and below the film. Everything
// enters in sequence, leans with the pointer, the arrow nudges forward now and
// then, the reel cycles with a diagonal wipe, and scrolling pulls the stripes
// away and grows the film to full screen (Hero-config `takeover`).
//
// The stripe colour is one token: --accent in hero8.module.css.
// ===========================================================================

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const scrollEase = cubicBezier(0.65, 0, 0.35, 1);

const NAV = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
] as const;
const RAIL = "16X9 · Bringing brands to life";
const LOGO_SRC = "/logo.png";
const CYCLE_MS = 6000; // how long each film holds before the next wipes in

// Entrance, in seconds
const T = { grids: 0.1, stripes: 0.25, film: 0.75, top: 1.0, bottom: 1.25, film_ui: 1.6, ui: 1.5, nudge: 3.2 };

// Pointer depth, in stage units per unit of pointer travel (-1 … 1)
const DEPTH = { grids: 10, stripes: 22, film: 9, words: 16 };

type Geo = { vw: number; vh: number; film: { left: number; top: number; width: number; height: number } };

// ---------------------------------------------------------------------------
// client-only values without effects (no hydration mismatch, no setState-in-effect)
// ---------------------------------------------------------------------------
const noop = () => () => {};
const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
function useViewport() {
  const snap = useSyncExternalStore(
    subscribeResize,
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => ""
  );
  if (!snap) return null;
  const [vw, vh] = snap.split("x").map(Number);
  return { vw, vh };
}

export default function Hero8Page() {
  const viewport = useViewport();
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient || !viewport) return <section className={styles.root} aria-hidden="true" />;
  return <Hero vw={viewport.vw} vh={viewport.vh} />;
}

// ===========================================================================
// HERO
// ===========================================================================
function Hero({ vw, vh }: { vw: number; vh: number }) {
  const variant = useMemo<HeroVariant>(
    () => resolveVariant(new Date(), new URLSearchParams(window.location.search).get("hero")),
    []
  );
  const clips = variant.clips;
  const reduce = !!useReducedMotion();
  const stage = fitStage(vw, vh);
  const L = stage.layout;
  const s = stage.scale;
  const takeover = variant.takeover.enabled && !reduce;

  const sectionRef = useRef<HTMLElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [current, setCurrent] = useState(0);
  const [swaps, setSwaps] = useState(0);
  const [hoverFilm, setHoverFilm] = useState(false);
  const [project, setProject] = useState<OpenProject | null>(null);

  const go = useCallback(
    (i: number) => {
      const next = ((i % clips.length) + clips.length) % clips.length;
      if (next === current) return;
      setCurrent(next);
      setSwaps((n) => n + 1);
    },
    [clips.length, current]
  );

  // ---- the reel cycles on its own, but never while you are looking at it ----
  useEffect(() => {
    if (reduce || project || hoverFilm) return;
    const t = window.setTimeout(() => {
      if (!document.hidden) go(current + 1);
    }, CYCLE_MS);
    return () => window.clearTimeout(t);
  }, [current, reduce, project, hoverFilm, go]);

  // ---- the hero film rests while the full player is open ----
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (project) v.pause();
    else v.play().catch(() => {});
  }, [project]);

  // ---- pointer: one pair of springs feeds every layer's depth ----
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 50, damping: 18, mass: 0.6 });
  const spy = useSpring(py, { stiffness: 50, damping: 18, mass: 0.6 });
  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px.set((e.clientX / window.innerWidth) * 2 - 1);
      py.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py, reduce]);

  // ---- scroll: 0 = the poster, 1 = the film full screen ----
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const e = useTransform(scrollYProgress, [0, 0.55], [0, 1], { clamp: true, ease: scrollEase });
  const fade = useTransform(e, [0, 0.6], [1, 0]);
  const panelOpacity = useTransform(scrollYProgress, [0.62, 0.8], [0, 1]);
  const panelY = useTransform(scrollYProgress, [0.62, 0.8], [40, 0]);

  // film geometry (viewport px), kept in a motion value so the scroll maths follows resizes
  const film = {
    left: stage.left + L.film.x * s,
    top: stage.top + L.film.y * s,
    width: L.film.w * s,
    height: L.film.h * s,
  };
  const geo = useMotionValue<Geo>({ vw, vh, film });
  useEffect(() => {
    geo.set({ vw, vh, film: { left: film.left, top: film.top, width: film.width, height: film.height } });
  }, [geo, vw, vh, film.left, film.top, film.width, film.height]);

  const filmX = useTransform([e, geo, spx] as MotionValue[], ([t, g, p]: unknown[]) => {
    const k = t as number;
    const G = g as Geo;
    return k * (G.vw / 2 - (G.film.left + G.film.width / 2)) + (p as number) * DEPTH.film * s * (1 - k);
  });
  const filmY = useTransform([e, geo, spy] as MotionValue[], ([t, g, p]: unknown[]) => {
    const k = t as number;
    const G = g as Geo;
    return k * (G.vh / 2 - (G.film.top + G.film.height / 2)) + (p as number) * DEPTH.film * s * (1 - k);
  });
  const filmScale = useTransform([e, geo] as MotionValue[], ([t, g]: unknown[]) => {
    const G = g as Geo;
    const full = Math.max(G.vw / G.film.width, G.vh / G.film.height);
    return 1 + (t as number) * (full - 1);
  });
  const grey = useTransform(e, (t) => `grayscale(${1 - t}) contrast(${1.08 - t * 0.08})`);

  // stripes: pushed out to their side on scroll, and lean with the pointer
  const pushL = useTransform([e, spx] as MotionValue[], ([t, x]: unknown[]) => -(t as number) * L.W * 0.75 + (x as number) * DEPTH.stripes);
  const pushR = useTransform([e, spx] as MotionValue[], ([t, x]: unknown[]) => (t as number) * L.W * 0.75 + (x as number) * DEPTH.stripes);
  const stripeY = useTransform(spy, (y) => y * DEPTH.stripes * 0.6);

  // the headline parts on scroll: the top word rises away, the bottom one sinks
  const topDrift = useTransform(e, (t) => -t * vh * 0.4);
  const bottomDrift = useTransform(e, (t) => t * vh * 0.4);

  const openFilm = () => {
    const el = filmRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHoverFilm(false);
    setProject({
      index: current,
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      time: videoRef.current?.currentTime ?? 0,
    });
  };
  const closeProject = useCallback(() => setProject(null), []);

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const clip = clips[current];

  return (
    <section
      ref={sectionRef}
      className={styles.root}
      style={{ height: takeover ? `${variant.takeover.scrollLength}svh` : "100svh" }}
      aria-label="16x9 & beyond"
    >
      <div className={styles.sticky}>
        {/* ================= THE STAGE: stripes, grids, film, headline ================= */}
        <div className={styles.stage} style={{ left: stage.left, top: stage.top, width: stage.w, height: stage.h }}>
          {/* dot grids, furthest back */}
          {L.grids.map((g, i) => (
            <Parallax key={i} x={spx} y={spy} depth={DEPTH.grids * s} fade={fade}>
              <motion.div
                className={styles.grid}
                style={{ left: pct(g.x, L.W), top: pct(g.y, L.H), width: pct(g.w, L.W), height: pct(g.h, L.H), backgroundSize: `${14 * s}px ${14 * s}px` }}
                initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
                animate={{ clipPath: "inset(0 0% 0 0)", transition: { delay: T.grids + i * 0.2, duration: 1.4, ease: EASE_CINE } }}
              />
            </Parallax>
          ))}

          {/* the stripes */}
          <svg className={styles.stripes} viewBox={`0 0 ${L.W} ${L.H}`} aria-hidden="true">
            <motion.g style={{ x: pushL, y: stripeY }}>
              {L.stripes.filter((st) => st.side === -1).map((st, i) => (
                <StripeShape key={`l${i}`} stripe={st} order={i * 2} reduce={reduce} hug={hoverFilm} />
              ))}
            </motion.g>
            <motion.g style={{ x: pushR, y: stripeY }}>
              {L.stripes.filter((st) => st.side === 1).map((st, i) => (
                <StripeShape key={`r${i}`} stripe={st} order={i * 2 + 1} reduce={reduce} hug={hoverFilm} />
              ))}
            </motion.g>
          </svg>

          {/* the headline: above and below the film */}
          <Headline word={L.top} layout={L} s={s} delay={T.top} reduce={reduce} x={spx} y={spy} drift={topDrift} fade={fade} />
          <Headline word={L.bottom} layout={L} s={s} delay={T.bottom} reduce={reduce} x={spx} y={spy} drift={bottomDrift} fade={fade} />
        </div>

        {/* ================= THE FILM WINDOW (viewport-positioned so it can grow to full screen) ================= */}
        <motion.div
          ref={filmRef}
          className={styles.film}
          style={{ left: film.left, top: film.top, width: film.width, height: film.height, x: filmX, y: filmY, scale: filmScale }}
          initial={reduce ? false : { clipPath: "inset(50% 0% 50% 0%)" }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { delay: T.film, duration: 1.1, ease: EASE_CINE } }}
          onPointerEnter={(ev) => ev.pointerType === "mouse" && setHoverFilm(true)}
          onPointerLeave={() => setHoverFilm(false)}
          onClick={openFilm}
          role="button"
          tabIndex={0}
          aria-label={`Play ${clip.title}`}
          onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), openFilm())}
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={clip.src}
              className={styles.reel}
              initial={{ clipPath: "polygon(0% 0%, 0% 0%, -30% 100%, -30% 100%)", zIndex: 2 }}
              animate={{ clipPath: "polygon(0% 0%, 130% 0%, 100% 100%, -30% 100%)", zIndex: 2, transition: { duration: 1, ease: EASE_CINE } }}
              exit={{ zIndex: 1, transition: { duration: 1 } }}
            >
              <motion.video
                ref={(el) => {
                  if (el) videoRef.current = el;
                }}
                className={styles.reelVideo}
                style={{ filter: grey }}
                src={clip.src}
                poster={posterFor(clip.src)}
                autoPlay={!reduce}
                muted
                loop
                playsInline
                preload="auto"
              />
            </motion.div>
          </AnimatePresence>

          {/* a white band rides the edge of each wipe */}
          {swaps > 0 && !reduce && (
            <motion.span
              key={`band-${swaps}`}
              className={styles.band}
              initial={{ left: "-30%" }}
              animate={{ left: "130%", transition: { duration: 1, ease: EASE_CINE } }}
              aria-hidden="true"
            />
          )}

          {/* inside the film: the line top left, the logo top right, the film's name along the bottom */}
          <motion.div className={styles.filmUi} style={{ fontSize: Math.max(10, 12 * s), opacity: fade }}>
            <motion.p
              className={styles.caption}
              initial={reduce ? false : { opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0, transition: { delay: T.film_ui, duration: 0.9, ease: EASE } }}
            >
              {variant.sub}
            </motion.p>
            <motion.img
              src={LOGO_SRC}
              alt=""
              className={styles.filmLogo}
              initial={reduce ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1, transition: { delay: T.film_ui + 0.1, duration: 0.9, ease: EASE } }}
            />
            <div className={styles.filmFoot}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={clip.title}
                  className={styles.filmTitle}
                  style={{ fontSize: Math.max(17, 30 * s) }}
                  initial={reduce ? { opacity: 0 } : { y: "70%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1, transition: { duration: 0.8, ease: EASE, delay: swaps === 0 && !reduce ? T.film_ui + 0.15 : 0.35 } }}
                  exit={{ y: "-70%", opacity: 0, transition: { duration: 0.35, ease: EASE_CINE } }}
                >
                  {clip.title}
                </motion.p>
              </AnimatePresence>
              <span className={styles.filmIndex}>{String(current + 1).padStart(2, "0")}</span>
            </div>
          </motion.div>
        </motion.div>

        {/* ================= UI: top bar, rails, marks, buttons ================= */}
        <motion.div className={styles.ui} style={{ opacity: fade }}>
          <motion.header
            className={styles.topbar}
            initial={reduce ? false : { opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0, transition: { delay: T.ui, duration: 1, ease: EASE } }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="16x9" className={styles.logo} />
            <nav className={styles.nav} aria-label="Main">
              {NAV.map((n) => (
                <a key={n.label} href={n.href}>
                  {n.label}
                </a>
              ))}
            </nav>
          </motion.header>

          {/* left rail: + › marks, the vertical line, two dots */}
          <Marks reduce={reduce} />
          <motion.p
            className={styles.rail}
            initial={reduce ? false : { opacity: 0, letterSpacing: "0.6em" }}
            animate={{ opacity: 1, letterSpacing: "0.18em", transition: { delay: T.ui + 0.2, duration: 1.4, ease: EASE } }}
          >
            {RAIL}
          </motion.p>

          {/* right rail: one dot per film; the current one is filled */}
          <motion.div
            className={styles.pager}
            initial={reduce ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0, transition: { delay: T.ui + 0.3, duration: 0.9, ease: EASE } }}
          >
            {clips.map((c, i) => (
              <button
                key={c.src}
                type="button"
                className={`${styles.pagerDot} ${i === current ? styles.pagerOn : ""}`}
                onClick={() => go(i)}
                aria-label={`Show ${c.title}`}
                aria-current={i === current ? "true" : undefined}
              />
            ))}
            <span className={styles.pagerCount}>
              {String(current + 1).padStart(2, "0")} / {String(clips.length).padStart(2, "0")}
            </span>
          </motion.div>

          {/* bottom: view work (left), play reel (right) — both magnetic */}
          <motion.div
            className={styles.ctaLeft}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0, transition: { delay: T.ui + 0.45, duration: 0.9, ease: EASE } }}
          >
            <Magnetic>
              <a className={styles.pill} href={variant.takeover.ctaHref}>
                <span aria-hidden="true">↗</span> View work
              </a>
            </Magnetic>
          </motion.div>
          <motion.div
            className={styles.ctaRight}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: T.ui + 0.55, duration: 0.9, ease: EASE } }}
          >
            <Magnetic>
              <button type="button" className={styles.round} onClick={openFilm} aria-label="Play the reel">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </button>
            </Magnetic>
          </motion.div>
        </motion.div>

        {/* ================= TAKEOVER PANEL (arrives once the film is full screen) ================= */}
        {takeover && (
          <motion.aside
            className={styles.panel}
            style={{ opacity: panelOpacity, y: panelY, pointerEvents: "auto" }}
            aria-label="About the work"
          >
            <p className={styles.panelBody}>{variant.takeover.body}</p>
            <a className={styles.panelCta} href={variant.takeover.ctaHref}>
              {variant.takeover.ctaLabel} <span aria-hidden="true">↗</span>
            </a>
          </motion.aside>
        )}

        <PlayCursor show={hoverFilm && !project} />
      </div>

      <AnimatePresence>
        {project && <ProjectView key="project" clips={clips} open={project} onClose={closeProject} />}
      </AnimatePresence>
    </section>
  );
}

// ===========================================================================
// STRIPE — slides in along its own direction; the chevrons lean toward the
// film on hover; the "›" arrow nudges forward every few seconds.
// ===========================================================================
const StripeShape = memo(function StripeShape({
  stripe,
  order,
  reduce,
  hug,
}: {
  stripe: Stripe;
  order: number;
  reduce: boolean;
  hug: boolean;
}) {
  const lean = stripe.hug && hug ? -stripe.side * 16 : 0;
  return (
    <motion.g animate={{ x: lean }} transition={{ type: "spring", stiffness: 160, damping: 18 }}>
      <motion.g
        animate={stripe.nudge && !reduce ? { x: [0, 26, 0] } : undefined}
        transition={stripe.nudge ? { delay: T.nudge, duration: 0.9, ease: EASE_CINE, repeat: Infinity, repeatDelay: 3.4 } : undefined}
      >
        <motion.polygon
          className={styles.stripe}
          points={points(stripe.pts)}
          initial={reduce ? false : { x: stripe.from[0], y: stripe.from[1], opacity: 0 }}
          animate={{
            x: 0,
            y: 0,
            opacity: 1,
            transition: {
              delay: T.stripes + order * 0.08,
              duration: 1.15,
              ease: EASE_CINE,
              opacity: { delay: T.stripes + order * 0.08, duration: 0.2 },
            },
          }}
        />
      </motion.g>
    </motion.g>
  );
});

// ===========================================================================
// HEADLINE — heavy lowercase, each character rising out of its own mask
// ===========================================================================
function Headline({
  word,
  layout,
  s,
  delay,
  reduce,
  x,
  y,
  drift,
  fade,
}: {
  word: Word;
  layout: Layout;
  s: number;
  delay: number;
  reduce: boolean;
  x: MotionValue<number>;
  y: MotionValue<number>;
  drift: MotionValue<number>;
  fade: MotionValue<number>;
}) {
  const size = word.size * s;
  const tx = useTransform(x, (v) => v * DEPTH.words * s);
  const ty = useTransform([y, drift] as MotionValue[], ([v, d]: unknown[]) => (v as number) * DEPTH.words * s + (d as number));
  const BASELINE = 0.84; // where the baseline sits inside a line-height:1 box, as a fraction of the font size
  return (
    <motion.h2
      className={styles.word}
      style={{
        fontSize: size,
        top: (word.baseline * s) - size * BASELINE,
        ...(word.align === "left" ? { left: word.x * s } : { right: (layout.W - word.x) * s }),
        x: tx,
        y: ty,
        opacity: fade,
      }}
      aria-label={word.text}
    >
      {[...word.text].map((ch, i) => (
        <span key={i} className={styles.charMask} aria-hidden="true">
          <motion.span
            className={styles.char}
            initial={reduce ? false : { y: "108%" }}
            animate={{ y: 0, transition: { delay: delay + i * 0.045, duration: 1.05, ease: EASE } }}
          >
            {ch === " " ? " " : ch}
          </motion.span>
        </span>
      ))}
    </motion.h2>
  );
}

// ===========================================================================
// SMALL MARKS — + and › around the stage, popping in after the stripes
// ===========================================================================
function Marks({ reduce }: { reduce: boolean }) {
  const marks: { cls: string; glyph: string; d: number }[] = [
    { cls: styles.mPlusL, glyph: "+", d: 0 },
    { cls: styles.mChevL, glyph: "›", d: 0.08 },
    { cls: styles.mPlusR, glyph: "+", d: 0.12 },
    { cls: styles.mDots, glyph: "", d: 0.2 },
    { cls: styles.mChevR, glyph: "» ›", d: 0.28 },
  ];
  return (
    <>
      {marks.map((m) => (
        <motion.span
          key={m.cls}
          className={`${styles.mark} ${m.cls}`}
          aria-hidden="true"
          initial={reduce ? false : { opacity: 0, scale: 0.4, rotate: -90 }}
          animate={{ opacity: 1, scale: 1, rotate: 0, transition: { delay: T.ui + m.d, duration: 0.8, ease: EASE } }}
        >
          {m.glyph || (
            <>
              <i />
              <i />
            </>
          )}
        </motion.span>
      ))}
    </>
  );
}

// ===========================================================================
// PARALLAX — moves its child with the pointer by `depth` px
// ===========================================================================
function Parallax({
  x,
  y,
  depth,
  fade,
  children,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  depth: number;
  fade: MotionValue<number>;
  children: ReactNode;
}) {
  const tx = useTransform(x, (v) => v * depth);
  const ty = useTransform(y, (v) => v * depth);
  return (
    <motion.div className={styles.layer} style={{ x: tx, y: ty, opacity: fade }}>
      {children}
    </motion.div>
  );
}

// ===========================================================================
// MAGNETIC — the child leans toward the pointer while it is near
// ===========================================================================
function Magnetic({ children, strength = 0.35 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 });
  return (
    <motion.div
      ref={ref}
      className={styles.magnet}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

// ===========================================================================
// PLAY CURSOR — a small white block that follows the pointer over the film
// ===========================================================================
function PlayCursor({ show }: { show: boolean }) {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 700, damping: 50, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 700, damping: 50, mass: 0.4 });
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
        {show && (
          <motion.span
            key="play"
            className={styles.cursorTag}
            initial={{ clipPath: "inset(0% 100% 0% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.4, ease: EASE_CINE } }}
            exit={{ clipPath: "inset(0% 0% 0% 100%)", transition: { duration: 0.25, ease: EASE_CINE } }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
            Play reel
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
