"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { resolveVariant, type Clip, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "../hero7/project-view";
import styles from "./hero9.module.css";

// ===========================================================================
// HERO 9 — fluted glass.
//
// The landing is a wall of vertical glass ribs lit by an ember glow, with the
// name set huge and condensed across it and "See work" beneath. Opening the
// work turns every rib edge-on, one after another like louvres, and the reel
// is behind them: one film per screen, each in a frame that opens as it
// arrives while the picture inside drifts against the scroll.
//
// The glow colours are tokens at the top of hero9.module.css.
// ===========================================================================

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const NAME = ["16X9", "& BEYOND"];
// width of the set name per 1px of font size (Archivo, wdth 62, weight 800) — measured
const NAME_RATIO = { line: 5.43, longest: 3.63 };
const NAV = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
] as const;
const LOGO_SRC = "/logo.png";
const CONTACT_HREF = "#contact"; // point "Start a project" at the real contact page or mail address
const OPEN_MS = 1700; // the panels' turn, start to finish

const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");
const pad = (n: number) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// client-only values without effects
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

export default function Hero9Page() {
  const viewport = useViewport();
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient || !viewport) return <div className={styles.root} style={{ height: "100svh" }} aria-hidden="true" />;
  return <Hero9 vw={viewport.vw} vh={viewport.vh} />;
}

type Mode = "hero" | "opening" | "work";

// ===========================================================================
// PAGE
// ===========================================================================
function Hero9({ vw, vh }: { vw: number; vh: number }) {
  const variant = useMemo<HeroVariant>(
    () => resolveVariant(new Date(), new URLSearchParams(window.location.search).get("hero")),
    []
  );
  const clips = variant.clips;
  const reduce = !!useReducedMotion();
  const tall = vw / vh < 0.85;

  const [mode, setMode] = useState<Mode>("hero");
  const [visit, setVisit] = useState(0); // remounts the panels so they play their entrance again
  const [active, setActive] = useState(0);
  const [hoverFrame, setHoverFrame] = useState(false);
  const [project, setProject] = useState<OpenProject | null>(null);

  // a visit always starts on the closed panels, at the top
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  // the page only scrolls once the panels have opened
  useEffect(() => {
    if (mode === "work") return;
    const el = document.documentElement;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = "";
    };
  }, [mode]);

  // opening → work once the last panel has turned
  useEffect(() => {
    if (mode !== "opening") return;
    const t = window.setTimeout(() => setMode("work"), reduce ? 450 : OPEN_MS);
    return () => window.clearTimeout(t);
  }, [mode, reduce]);

  const openWork = () => setMode((m) => (m === "hero" ? "opening" : m));

  // a scroll, a swipe up or ↓ on the closed panels opens them too
  useEffect(() => {
    if (mode !== "hero") return;
    const readyAt = performance.now() + 1100; // let the entrance land first
    const open = () => {
      if (performance.now() > readyAt) setMode((m) => (m === "hero" ? "opening" : m));
    };
    let y0 = 0;
    const onWheel = (e: WheelEvent) => e.deltaY > 6 && open();
    const onStart = (e: TouchEvent) => (y0 = e.touches[0].clientY);
    const onEnd = (e: TouchEvent) => y0 - e.changedTouches[0].clientY > 40 && open();
    const onKey = (e: KeyboardEvent) => (e.key === "ArrowDown" || e.key === "PageDown") && open();
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [mode]);

  const backToStart = () => {
    setProject(null);
    setHoverFrame(false);
    window.scrollTo(0, 0);
    setActive(0);
    setVisit((v) => v + 1);
    setMode("hero");
  };

  // ---- pointer: light on the glass follows the mouse ----
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 40, damping: 16, mass: 0.7 });
  const spy = useSpring(py, { stiffness: 40, damping: 16, mass: 0.7 });
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

  const { scrollYProgress } = useScroll();

  return (
    <div className={styles.root}>
      {/* ================= THE WORK (behind the panels) ================= */}
      <main className={styles.work} id="work" aria-label="Selected work" aria-hidden={mode === "hero"}>
        {clips.map((clip, i) => (
          <Frame
            key={clip.src}
            clip={clip}
            index={i}
            reduce={reduce}
            tall={tall}
            revealed={mode !== "hero"}
            paused={mode !== "work" || !!project}
            onActive={setActive}
            onHover={setHoverFrame}
            onOpen={(rect) => {
              setHoverFrame(false);
              setProject({ index: i, rect, time: 0 });
            }}
          />
        ))}
        <Outro onBack={backToStart} />
      </main>

      {/* ================= HUD (once the work is open) ================= */}
      <AnimatePresence>
        {mode === "work" && (
          <motion.div
            key="hud"
            className={styles.hud}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.6, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <button type="button" className={styles.hudLogo} onClick={backToStart} aria-label="Back to the start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_SRC} alt="16x9" />
            </button>
            <p className={styles.hudCount} aria-live="polite">
              <span className={styles.hudNum}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={active}
                    initial={{ y: "100%" }}
                    animate={{ y: 0, transition: { duration: 0.5, ease: EASE } }}
                    exit={{ y: "-100%", transition: { duration: 0.35, ease: EASE_CINE } }}
                  >
                    {pad(active + 1)}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className={styles.hudTotal}>/ {pad(clips.length)}</span>
            </p>
            <motion.span className={styles.hudBar} style={{ scaleX: scrollYProgress }} aria-hidden="true" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= THE PANELS ================= */}
      {mode !== "work" && (
        <Curtain
          key={visit}
          vw={vw}
          vh={vh}
          tall={tall}
          opening={mode === "opening"}
          reduce={reduce}
          total={clips.length}
          sx={spx}
          sy={spy}
          onOpen={openWork}
        />
      )}

      <PlayCursor show={hoverFrame && mode === "work" && !project} />

      <AnimatePresence>
        {project && <ProjectView key="project" clips={clips} open={project} onClose={() => setProject(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ===========================================================================
// CURTAIN — the fluted glass wall, the name and "See work"
// ===========================================================================
function Curtain({
  vw,
  vh,
  tall,
  opening,
  reduce,
  total,
  sx,
  sy,
  onOpen,
}: {
  vw: number;
  vh: number;
  tall: boolean;
  opening: boolean;
  reduce: boolean;
  total: number;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  onOpen: () => void;
}) {
  const count = Math.min(40, Math.max(9, Math.round(vw / (tall ? 36 : 46))));
  const w = vw / count;
  const mid = (count - 1) / 2;

  const sheenX = useTransform(sx, (v) => v * w * 0.9);
  const pulseX = useTransform(sx, (v) => v * vw * 0.12);
  const pulseY = useTransform(sy, (v) => v * vh * 0.1);

  // the name fills the width: one line on wide screens, two on phones
  const lines = tall ? NAME : [NAME.join(" ")];
  const fontSize = tall
    ? Math.min((vw * 0.9) / NAME_RATIO.longest, vh * 0.17)
    : Math.min((vw * 0.88) / NAME_RATIO.line, vh * 0.3);

  // when the panels turn: a wave from left to right
  const turnDelay = (i: number) => 0.28 + (i / Math.max(count - 1, 1)) * 0.55;
  // when they arrive: from the centre outwards
  const arriveDelay = (i: number) => 0.05 + (Math.abs(i - mid) / Math.max(mid, 1)) * 0.45;

  let n = 0; // running character index, for the stagger

  return (
    <div className={styles.curtain}>
      <div className={styles.strips} style={{ perspective: Math.max(vw, 1100) }}>
        {Array.from({ length: count }, (_, i) => (
          <motion.div
            key={i}
            className={styles.strip}
            style={{
              left: i * w,
              width: Math.ceil(w) + 1,
              backgroundSize: `${vw}px ${vh}px`,
              backgroundPosition: `${-i * w}px 0`,
            }}
            initial={reduce ? false : { rotateY: 90 }}
            animate={
              opening
                ? reduce
                  ? { opacity: 0, transition: { duration: 0.4 } }
                  : { rotateY: -90, transition: { delay: turnDelay(i), duration: 0.8, ease: EASE_CINE } }
                : { rotateY: 0, opacity: 1, transition: { delay: arriveDelay(i), duration: 1.2, ease: EASE } }
            }
          >
            <motion.span className={styles.sheen} style={{ x: sheenX }} />
            <motion.span
              className={styles.shade}
              initial={reduce ? false : { opacity: 0.85 }}
              animate={
                opening
                  ? { opacity: 0.92, transition: { delay: turnDelay(i), duration: 0.8, ease: EASE_CINE } }
                  : { opacity: 0, transition: { delay: arriveDelay(i), duration: 1.2, ease: EASE } }
              }
            />
          </motion.div>
        ))}
      </div>

      {/* a soft hot spot that drifts with the pointer and breathes */}
      <motion.div
        className={styles.pulse}
        style={{ x: pulseX, y: pulseY }}
        initial={{ opacity: 0 }}
        animate={
          opening
            ? { opacity: 0, transition: { duration: 0.35 } }
            : reduce
              ? { opacity: 0.7 }
              : { opacity: [0.5, 0.95, 0.5], transition: { delay: 0.9, duration: 7, repeat: Infinity, ease: "easeInOut" } }
        }
        aria-hidden="true"
      />

      {/* ---- the name, and "See work" beneath it ---- */}
      <div className={styles.center}>
        <h1 className={styles.name} style={{ fontSize }} aria-label="16X9 & Beyond">
          {lines.map((line, li) => (
            <span key={li} className={styles.line} aria-hidden="true">
              {[...line].map((ch, ci) => {
                const k = n++;
                return (
                  <span key={ci} className={styles.mask}>
                    <motion.span
                      className={styles.char}
                      initial={reduce ? false : { y: "108%" }}
                      animate={
                        opening
                          ? { y: reduce ? 0 : "-108%", opacity: reduce ? 0 : 1, transition: { delay: k * 0.018, duration: 0.5, ease: EASE_CINE } }
                          : { y: 0, opacity: 1, transition: { delay: 0.7 + k * 0.04, duration: 1.05, ease: EASE } }
                      }
                    >
                      {ch}
                    </motion.span>
                  </span>
                );
              })}
            </span>
          ))}
        </h1>

        <motion.div
          className={styles.seeWrap}
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={
            opening
              ? { opacity: 0, y: -12, transition: { duration: 0.3, ease: EASE_CINE } }
              : { opacity: 1, y: 0, transition: { delay: 1.35, duration: 0.9, ease: EASE } }
          }
        >
          <Magnetic>
            <button type="button" className={styles.seeWork} onClick={onOpen}>
              <span className={styles.seeLabel}>
                <span>See work</span>
                <span aria-hidden="true">See work</span>
              </span>
              <span className={styles.seeArrow} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 4v15M5.5 12.5 12 19l6.5-6.5" />
                </svg>
              </span>
            </button>
          </Magnetic>
        </motion.div>
      </div>

      {/* ---- the frame around it all ---- */}
      <motion.div
        className={styles.chrome}
        initial={reduce ? false : { opacity: 0 }}
        animate={
          opening
            ? { opacity: 0, transition: { duration: 0.3 } }
            : { opacity: 1, transition: { delay: 1.5, duration: 1, ease: EASE } }
        }
      >
        <header className={styles.topbar}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" className={styles.logo} />
          <nav className={styles.nav} aria-label="Main">
            {NAV.map((l) => (
              <a key={l.label} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
        </header>
        <p className={styles.cornerL}>Bringing brands to life</p>
        <p className={styles.cornerR}>
          Selected films <span>({pad(total)})</span>
        </p>
      </motion.div>
    </div>
  );
}

// ===========================================================================
// FRAME — one film per screen. As it arrives, its frame opens from a window
// to full bleed while the picture inside drifts against the scroll.
// ===========================================================================
function Frame({
  clip,
  index,
  reduce,
  tall,
  revealed,
  paused,
  onActive,
  onHover,
  onOpen,
}: {
  clip: Clip;
  index: number;
  reduce: boolean;
  tall: boolean;
  revealed: boolean;
  paused: boolean;
  onActive: (i: number) => void;
  onHover: (on: boolean) => void;
  onOpen: (rect: OpenProject["rect"]) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 0 → 1/3: arriving · 1/3 → 2/3: held on screen · 2/3 → 1: leaving
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // the frame's inset (%) closed → fully open. Wide screens open to full bleed;
  // phones open to a near-square window so the landscape films aren't over-cropped.
  const inset = tall ? { x: [8, 0], y: [40, 25] } : { x: [20, 0], y: [13, 0] };
  const insetAt = (v: number) => ({
    x: inset.x[0] + (inset.x[1] - inset.x[0]) * v,
    y: inset.y[0] + (inset.y[1] - inset.y[0]) * v,
  });
  const open = useTransform(p, [0, 1 / 3, 0.6], [0, 0.45, 1]);
  const clipPath = useTransform(open, (v) => {
    if (reduce) return tall ? "inset(25% 0% 25% 0%)" : "none";
    const { x, y } = insetAt(v);
    return `inset(${y}% ${x}% round ${(1 - v) * 14}px)`;
  });
  const depth = reduce ? 0 : tall ? 0.4 : 1; // phones get a gentler drift: their window is smaller
  const mediaScale = useTransform(p, [0, 1 / 3, 2 / 3, 1], [1 + 0.38 * depth, 1 + 0.16 * depth, 1 + 0.03 * depth, 1]);
  const mediaY = useTransform(p, [0, 1], [`${-12 * depth}%`, `${12 * depth}%`]);
  const dim = useTransform(p, [0.66, 0.98], [0, 0.7]);
  const titleY = useTransform(p, [0.1, 0.3], reduce ? ["0%", "0%"] : ["110%", "0%"]);
  const metaOpacity = useTransform(p, [0.14, 0.3, 0.74, 0.86], [0, 1, 1, 0]);

  useMotionValueEvent(p, "change", (v) => {
    if (v > 0.3 && v < 0.7) onActive(index);
  });

  // play only what is on screen
  const inView = useInView(winRef, { amount: 0.25 });
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView && !paused && !reduce) v.play().catch(() => {});
    else v.pause();
  }, [inView, paused, reduce]);

  const openFilm = () => {
    const el = winRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const { x, y } = insetAt(reduce ? 1 : open.get());
    const dx = (r.width * x) / 100;
    const dy = (r.height * y) / 100;
    onOpen({ left: r.left + dx, top: r.top + dy, width: r.width - dx * 2, height: r.height - dy * 2 });
  };

  const title = clip.title;

  return (
    <section ref={ref} className={styles.frame} aria-label={title}>
      <div className={styles.frameSticky}>
        <motion.div
          className={styles.frameIntro}
          initial={index === 0 && !reduce ? { scale: 1.14 } : false}
          animate={index === 0 && revealed ? { scale: 1, transition: { delay: 0.35, duration: 1.5, ease: EASE } } : undefined}
        >
          <motion.div
            ref={winRef}
            className={styles.window}
            style={{ clipPath }}
            onPointerEnter={(e) => e.pointerType === "mouse" && onHover(true)}
            onPointerLeave={() => onHover(false)}
            onClick={openFilm}
            role="button"
            tabIndex={0}
            aria-label={`Play ${title}`}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openFilm())}
          >
            <motion.div className={`${styles.media} ${tall ? styles.mediaTall : ""}`} style={{ scale: mediaScale, y: mediaY }}>
              <video
                ref={videoRef}
                className={styles.video}
                src={clip.src}
                poster={stillFor(clip.src)}
                muted
                loop
                playsInline
                preload={index < 2 ? "auto" : "none"}
              />
            </motion.div>
            <motion.span className={styles.dim} style={{ opacity: dim }} aria-hidden="true" />
          </motion.div>
        </motion.div>

        {/* the film's name, rising out of the bottom edge */}
        <div className={styles.frameTitleMask}>
          <motion.h2 className={styles.frameTitle} style={{ y: titleY }}>
            {title}
          </motion.h2>
        </div>

        <motion.div className={styles.frameMeta} style={{ opacity: metaOpacity }}>
          <span>({pad(index + 1)})</span>
          <span>{clip.duration}</span>
        </motion.div>

        <motion.div className={styles.frameCta} style={{ opacity: metaOpacity }}>
          <button type="button" className={styles.viewFilm} onClick={openFilm}>
            View film <span aria-hidden="true">↗</span>
          </button>
        </motion.div>
      </div>
    </section>
  );
}

// ===========================================================================
// OUTRO — the glass again, a line and two ways on
// ===========================================================================
function Outro({ onBack }: { onBack: () => void }) {
  const lines = ["Your story", "is next"];
  return (
    <section className={styles.outro} id="contact" aria-label="Start a project">
      {/* the heading watches the viewport; its lines rise out of their masks */}
      <motion.h2 className={styles.outroTitle} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.4 }}>
        {lines.map((l, i) => (
          <span key={l} className={styles.mask}>
            <motion.span
              className={styles.char}
              variants={{
                hidden: { y: "108%" },
                shown: { y: 0, transition: { delay: 0.1 + i * 0.12, duration: 1.1, ease: EASE } },
              }}
            >
              {l}
            </motion.span>
          </span>
        ))}
      </motion.h2>
      <div className={styles.outroActions}>
        <a className={styles.seeWork} href={CONTACT_HREF}>
          <span className={styles.seeLabel}>
            <span>Start a project</span>
            <span aria-hidden="true">Start a project</span>
          </span>
          <span className={styles.seeArrow} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M7 17 17 7M8.5 7H17v8.5" />
            </svg>
          </span>
        </a>
        <button type="button" className={styles.ghost} onClick={onBack}>
          Back to start <span aria-hidden="true">↑</span>
        </button>
      </div>
    </section>
  );
}

// ===========================================================================
// MAGNETIC — leans toward the pointer while it is near
// ===========================================================================
function Magnetic({ children, strength = 0.3 }: { children: React.ReactNode; strength?: number }) {
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
// PLAY CURSOR — a paper tag that follows the pointer over a film
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
            Play film
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
