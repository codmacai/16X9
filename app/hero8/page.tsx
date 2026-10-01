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
  motion,
  useMotionValue,
  useReducedMotion,
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
// A white "‹" bracket and "›" arrow wrap a poster window, slashes cut in from
// the corners, and the headline sits above and below it. Everything enters in
// sequence, leans with the pointer, the arrow nudges forward now and then, and
// the black-and-white posters cut from one to the next every few seconds.
//
// The stripe colour is one token: --accent in hero8.module.css.
// ===========================================================================

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const NAV = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
] as const;
const RAIL = "16X9 · Bringing brands to life";
const LOGO_SRC = "/logo.png";
const CYCLE_MS = 2500; // how long each poster holds before cutting to the next

// Entrance, in seconds
const T = { grids: 0.1, stripes: 0.25, film: 0.75, top: 1.0, bottom: 1.25, film_ui: 1.6, ui: 1.5, nudge: 3.2 };

// Pointer depth, in stage units per unit of pointer travel (-1 … 1)
const DEPTH = { grids: 10, stripes: 22, film: 9, words: 16 };


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

  const filmRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [hoverFilm, setHoverFilm] = useState(false);
  const [project, setProject] = useState<OpenProject | null>(null);

  const go = useCallback(
    (i: number) => {
      const next = ((i % clips.length) + clips.length) % clips.length;
      if (next === current) return;
      setCurrent(next);
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

  // film geometry (viewport px)
  const film = {
    left: stage.left + L.film.x * s,
    top: stage.top + L.film.y * s,
    width: L.film.w * s,
    height: L.film.h * s,
  };
  const filmX = useTransform(spx, (v) => v * DEPTH.film * s);
  const filmY = useTransform(spy, (v) => v * DEPTH.film * s);

  // stripes lean with the pointer
  const stripeX = useTransform(spx, (x) => x * DEPTH.stripes);
  const stripeY = useTransform(spy, (y) => y * DEPTH.stripes * 0.6);

  const openFilm = () => {
    const el = filmRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHoverFilm(false);
    setProject({
      index: current,
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      time: 0,
    });
  };
  const closeProject = useCallback(() => setProject(null), []);

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const clip = clips[current];

  return (
    <section
      className={styles.root}
      aria-label="16x9 & beyond"
    >
      <div className={styles.sticky}>
        {/* ================= THE STAGE: stripes, grids, film, headline ================= */}
        <div className={styles.stage} style={{ left: stage.left, top: stage.top, width: stage.w, height: stage.h }}>
          {/* dot grids, furthest back */}
          {L.grids.map((g, i) => (
            <Parallax key={i} x={spx} y={spy} depth={DEPTH.grids * s}>
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
            <motion.g style={{ x: stripeX, y: stripeY }}>
              {L.stripes.filter((st) => st.side === -1).map((st, i) => (
                <StripeShape key={`l${i}`} stripe={st} order={i * 2} reduce={reduce} hug={hoverFilm} />
              ))}
            </motion.g>
            <motion.g style={{ x: stripeX, y: stripeY }}>
              {L.stripes.filter((st) => st.side === 1).map((st, i) => (
                <StripeShape key={`r${i}`} stripe={st} order={i * 2 + 1} reduce={reduce} hug={hoverFilm} />
              ))}
            </motion.g>
          </svg>

          {/* the headline: above and below the film */}
          <Headline word={L.top} layout={L} s={s} delay={T.top} reduce={reduce} x={spx} y={spy} />
          <Headline word={L.bottom} layout={L} s={s} delay={T.bottom} reduce={reduce} x={spx} y={spy} />
        </div>

        {/* ================= THE FILM WINDOW (viewport-positioned so it can grow to full screen) ================= */}
        <motion.div
          ref={filmRef}
          className={styles.film}
          style={{ left: film.left, top: film.top, width: film.width, height: film.height, x: filmX, y: filmY }}
          initial={reduce ? false : { clipPath: "inset(50% 0% 50% 0%)" }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { delay: T.film, duration: 1.1, ease: EASE_CINE } }}
          onPointerEnter={(ev) => ev.pointerType === "mouse" && setHoverFilm(true)}
          onPointerLeave={() => setHoverFilm(false)}
          onClick={openFilm}
          role="button"
          tabIndex={0}
          aria-label={`Open ${clip.title}`}
          onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), openFilm())}
        >
          {/* black-and-white posters, stacked; the current one shows — a straight cut, no transition */}
          <div className={styles.reel}>
            {clips.map((c, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={c.src}
                src={posterFor(c.src)}
                alt=""
                className={styles.poster}
                style={{ opacity: i === current ? 1 : 0 }}
                decoding="async"
                fetchPriority={i === 0 ? "high" : "low"}
              />
            ))}
          </div>

          {/* inside the film: the line top left, the logo top right, the film's name along the bottom */}
          <div className={styles.filmUi} style={{ fontSize: Math.max(10, 12 * s) }}>
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
              <motion.p
                className={styles.filmTitle}
                style={{ fontSize: Math.max(17, 30 * s) }}
                initial={reduce ? false : { y: "70%", opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { duration: 0.8, ease: EASE, delay: T.film_ui + 0.15 } }}
              >
                {clip.title}
              </motion.p>
              <span className={styles.filmIndex}>{String(current + 1).padStart(2, "0")}</span>
            </div>
          </div>
        </motion.div>

        {/* ================= UI: top bar, rails, marks, buttons ================= */}
        <motion.div className={styles.ui}>
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
}: {
  word: Word;
  layout: Layout;
  s: number;
  delay: number;
  reduce: boolean;
  x: MotionValue<number>;
  y: MotionValue<number>;
}) {
  const size = word.size * s;
  const tx = useTransform(x, (v) => v * DEPTH.words * s);
  const ty = useTransform(y, (v) => v * DEPTH.words * s);
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
  children,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  depth: number;
  children: ReactNode;
}) {
  const tx = useTransform(x, (v) => v * depth);
  const ty = useTransform(y, (v) => v * depth);
  return (
    <motion.div className={styles.layer} style={{ x: tx, y: ty }}>
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
