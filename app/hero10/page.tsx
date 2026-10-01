"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AnimatePresence,
  cubicBezier,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { resolveVariant, type Clip, type HeroVariant } from "@/components/Hero-config";
import { posterFor } from "../hero7/wall-playback";
import Audience from "./audience";
import { fitRoom, PROGRAMMES, type ScreenBox } from "./room";
import styles from "./hero10.module.css";

// ===========================================================================
// HERO 10 — the screening room.
//
// A dark room seen from behind the audience. Three screens play the work,
// grouped as People, Places and Impact, and their light is the only light in
// the room: it spills onto the floor and rims the heads and shoulders of the
// people watching, in the colours of the films as they play.
//
// Layers: stage (0) → screens (10) → audience (20) → interface (30).
// Point at a screen and it brightens while the others dim; click it (or just
// scroll) and the camera dollies past the audience into that screen until its
// film fills the frame.
// ===========================================================================

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const dolly = cubicBezier(0.65, 0, 0.35, 1);

const NAV = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
] as const;
const LOGO_SRC = "/logo.png";
const CYCLE_MS = 7000; // how long a film holds on a screen before the next one
const SAMPLE_MS = 220; // how often the room reads the colour off each screen
const DEPTH = { stage: 6, screens: 12, audience: 30 }; // pointer parallax, stage units

const pad = (n: number) => String(n).padStart(2, "0");
const hexRgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// ---------------------------------------------------------------------------
// client-only values without effects
// ---------------------------------------------------------------------------
const noop = () => () => {};
const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
function useViewport() {
  const snap = useSyncExternalStore(subscribeResize, () => `${window.innerWidth}x${window.innerHeight}`, () => "");
  if (!snap) return null;
  const [vw, vh] = snap.split("x").map(Number);
  return { vw, vh };
}

export default function Hero10Page() {
  const viewport = useViewport();
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient || !viewport) return <section className={styles.root} style={{ height: "100svh" }} aria-hidden="true" />;
  return <ScreeningRoom vw={viewport.vw} vh={viewport.vh} />;
}

// ===========================================================================
// THE ROOM
// ===========================================================================
function ScreeningRoom({ vw, vh }: { vw: number; vh: number }) {
  const variant = useMemo<HeroVariant>(
    () => resolveVariant(new Date(), new URLSearchParams(window.location.search).get("hero")),
    []
  );
  const clips = variant.clips;
  const reduce = !!useReducedMotion();
  const fit = fitRoom(vw, vh);
  const { room, s } = fit;
  const tall = room.mode === "tall";

  const sectionRef = useRef<HTMLElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([null, null, null]);
  const nowPlaying = useRef<Clip[]>([clips[0], clips[1], clips[2]]);
  const [active, setActive] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);
  const [lit, setLit] = useState(reduce);
  const activeMV = useMotionValue(1);
  useEffect(() => {
    activeMV.set(active);
  }, [active, activeMV]);

  // lights come up once the screens have switched on
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setLit(true), 900);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // ---- the room's light: read the colour off each screen, ease toward it ----
  useEffect(() => {
    const root = lightRef.current;
    if (!root) return;
    const canvas = document.createElement("canvas");
    canvas.width = 6;
    canvas.height = 4;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const target = nowPlaying.current.map((c) => hexRgb(c.accent));
    const shown = target.map((c) => [...c]);
    const write = (i: number) => root.style.setProperty(`--c${i}`, shown[i].map((v) => Math.round(v)).join(" "));
    [0, 1, 2].forEach(write);

    const sample = () => {
      videos.current.forEach((v, i) => {
        if (!ctx || !v || v.paused || v.readyState < 2) return;
        try {
          ctx.drawImage(v, 0, 0, 6, 4);
          const d = ctx.getImageData(0, 0, 6, 4).data;
          let r = 0, g = 0, b = 0;
          for (let k = 0; k < d.length; k += 4) {
            r += d[k];
            g += d[k + 1];
            b += d[k + 2];
          }
          const n = d.length / 4;
          // lift dark frames so the light still reads, keep the hue
          const peak = Math.max(r, g, b) / n || 1;
          const lift = Math.max(1, 175 / peak);
          target[i] = [r, g, b].map((c) => Math.min(255, (c / n) * lift));
        } catch {
          /* a frame that can't be read yet: keep the last colour */
        }
      });
    };
    const timer = window.setInterval(sample, SAMPLE_MS);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const k = 1 - Math.exp(-((now - last) / 1000) * 2.4);
      last = now;
      for (let i = 0; i < 3; i++) {
        let moved = false;
        for (let c = 0; c < 3; c++) {
          const d = target[i][c] - shown[i][c];
          if (Math.abs(d) > 0.6) {
            shown[i][c] += d * k;
            moved = true;
          }
        }
        if (moved) write(i);
      }
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => {
      window.clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  // ---- pointer: each layer moves at its own depth ----
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 45, damping: 18, mass: 0.7 });
  const spy = useSpring(py, { stiffness: 45, damping: 18, mass: 0.7 });
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

  // ---- scroll: the camera dollies past the audience into the active screen ----
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const t = useTransform(scrollYProgress, [0, 0.62], [0, 1], { clamp: true, ease: dolly });
  const actBox: ScreenBox = room.slots[tall ? 0 : ((active - 1) as -1 | 0 | 1)];
  const acx = fit.left + (actBox.x + actBox.w / 2) * s;
  const acy = fit.top + (actBox.y + actBox.h / 2) * s;
  const full = Math.max(vw / (actBox.w * s), vh / (actBox.h * s)) * 1.02;
  const screensX = useTransform([t, spx] as MotionValue[], ([k, p]: unknown[]) => (k as number) * (vw / 2 - acx) - (p as number) * DEPTH.screens * s * (1 - (k as number)));
  const screensY = useTransform([t, spy] as MotionValue[], ([k, p]: unknown[]) => (k as number) * (vh / 2 - acy) - (p as number) * DEPTH.screens * 0.5 * s * (1 - (k as number)));
  const screensScale = useTransform(t, (k) => 1 + k * (full - 1));
  const audX = useTransform([t, spx] as MotionValue[], ([k, p]: unknown[]) => -(p as number) * DEPTH.audience * s * (1 - (k as number)));
  const audY = useTransform([t, spy] as MotionValue[], ([k, p]: unknown[]) => (k as number) * vh * 0.55 - (p as number) * DEPTH.audience * 0.4 * s);
  const audScale = useTransform(t, [0, 1], [1, 1.7]);
  const audFade = useTransform(t, [0, 0.55], [1, 0]);
  const stageX = useTransform(spx, (p) => -p * DEPTH.stage * s);
  const roomFade = useTransform(t, [0, 0.8], [1, 0]);
  const uiFade = useTransform(t, [0, 0.25], [1, 0]);
  const endFade = useTransform(scrollYProgress, [0.66, 0.82], [0, 1]);
  const endY = useTransform(scrollYProgress, [0.66, 0.82], [30, 0]);
  const [arrived, setArrived] = useState(false);
  useMotionValueEvent(endFade, "change", (v) => setArrived(v > 0.5));

  // click a screen: make it the active one and fly into it
  const flyInto = (i: number) => {
    setActive(i);
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  // phones: swipe sideways to change screens
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const glow = (i: number) => (!lit ? 0 : hovered === null ? 0.8 : hovered === i ? 1 : 0.32);
  const programme = PROGRAMMES[active];
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <section
      ref={sectionRef}
      className={styles.root}
      style={{ height: reduce ? "100svh" : "300svh" }}
      aria-label="16x9 — the screening room"
    >
      <div
        ref={lightRef}
        className={styles.sticky}
        style={{ ["--g0" as string]: glow(0), ["--g1" as string]: glow(1), ["--g2" as string]: glow(2) }}
        onTouchStart={(e) => (swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const sw = swipe.current;
          if (!sw || !tall) return;
          const dx = e.changedTouches[0].clientX - sw.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.changedTouches[0].clientY - sw.y))
            setActive((a) => Math.max(0, Math.min(2, a + (dx < 0 ? 1 : -1))));
        }}
      >
        {/* ================= STAGE (z 0): the dark room and the light on its floor ================= */}
        <motion.div className={styles.stage} style={{ x: stageX, opacity: roomFade }} aria-hidden="true">
          <div
            className={styles.floor}
            style={{ top: fit.top + room.floor * s, ["--fx0" as string]: tall ? "-30%" : "22%", ["--fx2" as string]: tall ? "130%" : "78%" }}
          />
          <div className={styles.haze} />
          {/* the light each screen throws into the room (kept out of the 3D layer, so it
              never draws over the screens or their labels) */}
          {PROGRAMMES.map((prog, i) => {
            const slot = (tall ? Math.max(-1, Math.min(1, i - active)) : i - 1) as -1 | 0 | 1;
            const b = room.slots[slot];
            return (
              <span
                key={prog.label}
                className={styles.glow}
                style={{
                  left: fit.left + b.x * s + vw * 0.04,
                  top: fit.top + b.y * s + vh * 0.04,
                  width: b.w * s,
                  height: b.h * s,
                  ["--c" as string]: `var(--c${i})`,
                  ["--g" as string]: `var(--g${i})`,
                }}
              />
            );
          })}
        </motion.div>

        {/* ================= SCREENS (z 10) ================= */}
        <motion.div
          className={styles.screens}
          style={{
            left: fit.left,
            top: fit.top,
            width: fit.w,
            height: fit.h,
            x: screensX,
            y: screensY,
            scale: screensScale,
            transformOrigin: `${acx - fit.left}px ${acy - fit.top}px`,
            perspective: fit.w * 1.4,
          }}
        >
          {PROGRAMMES.map((prog, i) => {
            const slot = (tall ? Math.max(-1, Math.min(1, i - active)) : i - 1) as -1 | 0 | 1;
            const hidden = tall && Math.abs(i - active) > 1;
            const box = room.slots[slot];
            return (
              <Screen
                key={prog.label}
                index={i}
                label={prog.label}
                playlist={prog.clips.map((c) => clips[c % clips.length])}
                box={box}
                style={{ left: pct(box.x, room.W), top: pct(box.y, room.H), width: pct(box.w, room.W), height: pct(box.h, room.H) }}
                hidden={hidden}
                play={!reduce && (!tall || i === active)}
                reduce={reduce}
                dim={hovered !== null && hovered !== i}
                t={t}
                activeMV={activeMV}
                labelSize={Math.max(10, 12 * s * (tall ? 1.5 : 1))}
                onVideo={(el) => {
                  videos.current[i] = el;
                }}
                onClip={(c) => {
                  nowPlaying.current[i] = c;
                }}
                onEnter={() => setHovered(i)}
                onLeave={() => setHovered((h) => (h === i ? null : h))}
                onPick={() => (tall && i !== active ? setActive(i) : flyInto(i))}
              />
            );
          })}
        </motion.div>

        {/* ================= AUDIENCE (z 20) ================= */}
        <motion.div
          className={styles.audienceLayer}
          style={{ left: fit.left, top: fit.top, width: fit.w, height: fit.h, x: audX, y: audY, scale: audScale, opacity: audFade }}
        >
          <motion.div
            className={styles.audienceIn}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 1.3, duration: 1.8, ease: EASE } }}
          >
            <Audience room={room} />
          </motion.div>
        </motion.div>

        {/* ================= INTERFACE (z 30) ================= */}
        <motion.div className={styles.ui} style={{ opacity: uiFade }}>
          <motion.header
            className={styles.topbar}
            initial={reduce ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 1.8, duration: 1, ease: EASE } }}
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

          <motion.div
            className={styles.footer}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 2.1, duration: 1.2, ease: EASE } }}
          >
            <p className={styles.footLeft}>16X9 — Bringing brands to life</p>
            <p className={styles.scroll}>
              <span>Scroll</span>
              <span className={styles.scrollLine} aria-hidden="true" />
            </p>
            <p className={styles.footRight}>
              {tall ? (
                <span className={styles.dots} aria-label={`Screen ${active + 1} of 3`}>
                  {PROGRAMMES.map((p, i) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`${styles.dot} ${i === active ? styles.dotOn : ""}`}
                      onClick={() => setActive(i)}
                      aria-label={`Show ${p.label}`}
                    />
                  ))}
                </span>
              ) : (
                <>Now showing · People, Places, Impact</>
              )}
            </p>
          </motion.div>
        </motion.div>

        {/* ================= ARRIVAL: inside the screen ================= */}
        <motion.div
          className={styles.arrival}
          style={{ opacity: endFade, y: endY, pointerEvents: arrived ? "auto" : "none" }}
          aria-hidden={!arrived}
        >
          <p className={styles.arrivalEyebrow}>
            {pad(active + 1)} — Now showing
          </p>
          <h2 className={styles.arrivalTitle}>{programme.label}</h2>
          <p className={styles.arrivalMeta}>{programme.clips.length} films</p>
          <a className={styles.arrivalCta} href="#work" tabIndex={arrived ? 0 : -1}>
            View the work <span aria-hidden="true">↗</span>
          </a>
        </motion.div>

        <RingCursor show={hovered !== null && !arrived} label={hovered !== null ? PROGRAMMES[hovered].label : ""} />
      </div>
    </section>
  );
}

// ===========================================================================
// SCREEN — a projection in the room. It switches on like a projector (a line
// of light that opens), plays its programme a film at a time with a dip to
// black between them, and turns to face you as the camera flies into it.
// ===========================================================================
function Screen({
  index,
  label,
  playlist,
  box,
  style,
  hidden,
  play,
  reduce,
  dim,
  t,
  activeMV,
  labelSize,
  onVideo,
  onClip,
  onEnter,
  onLeave,
  onPick,
}: {
  index: number;
  label: string;
  playlist: Clip[];
  box: ScreenBox;
  style: React.CSSProperties;
  hidden: boolean;
  play: boolean;
  reduce: boolean;
  dim: boolean;
  t: MotionValue<number>;
  activeMV: MotionValue<number>;
  labelSize: number;
  onVideo: (el: HTMLVideoElement | null) => void;
  onClip: (c: Clip) => void;
  onEnter: () => void;
  onLeave: () => void;
  onPick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [n, setN] = useState(0);
  const [dip, setDip] = useState(false);
  const clip = playlist[n % playlist.length];

  useEffect(() => {
    onClip(clip);
  }, [clip, onClip]);

  // the next film, with a dip to black between them
  useEffect(() => {
    if (!play || reduce) return;
    let t2 = 0;
    const t1 = window.setTimeout(() => {
      setDip(true);
      t2 = window.setTimeout(() => {
        setN((k) => k + 1);
        setDip(false);
      }, 420);
    }, CYCLE_MS + index * 1300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [n, play, reduce, index]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (play) v.play().catch(() => {});
    else v.pause();
  }, [play, clip]);

  // the screen's angle eases between slots, and straightens as we fly into it
  const base = useSpring(box.rot, { stiffness: 90, damping: 20 });
  useEffect(() => {
    base.set(box.rot);
  }, [box.rot, base]);
  const rotateY = useTransform([base, t, activeMV] as MotionValue[], ([b, k, a]: unknown[]) =>
    (b as number) * (1 - ((a as number) === index ? (k as number) : 0))
  );
  const fadeOthers = useTransform([t, activeMV] as MotionValue[], ([k, a]: unknown[]) =>
    (a as number) === index ? 1 : 1 - Math.min(1, (k as number) * 1.8)
  );

  return (
    <motion.div
      className={`${styles.screen} ${dim ? styles.screenDim : ""} ${hidden ? styles.screenHidden : ""}`}
      style={{ ...style, rotateY, opacity: fadeOthers, transformOrigin: box.rot > 0 ? "100% 50%" : box.rot < 0 ? "0% 50%" : "50% 50%", ["--c" as string]: `var(--c${index})`, ["--g" as string]: `var(--g${index})` }}
      onPointerEnter={(e) => e.pointerType === "mouse" && onEnter()}
      onPointerLeave={onLeave}
      onClick={onPick}
      role="button"
      tabIndex={hidden ? -1 : 0}
      aria-label={`${label}: ${clip.title}`}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick())}
    >
      {/* the projection: opens from a line of light */}
      <motion.div
        className={styles.glass}
        initial={reduce ? false : { scaleY: 0.008 }}
        animate={{ scaleY: 1, transition: { delay: 0.35 + index * 0.18, duration: 1.05, ease: EASE_CINE } }}
      >
        <video
          ref={(el) => {
            videoRef.current = el;
            onVideo(el);
          }}
          className={styles.video}
          src={clip.src}
          poster={posterFor(clip.src)}
          muted
          loop
          playsInline
          autoPlay={play}
          preload={play ? "auto" : "metadata"}
        />
        <span className={styles.shade} aria-hidden="true" />
        <span className={`${styles.dip} ${dip ? styles.dipOn : ""}`} aria-hidden="true" />
        <motion.span
          className={styles.flash}
          initial={reduce ? false : { opacity: 1 }}
          animate={{ opacity: 0, transition: { delay: 0.5 + index * 0.18, duration: 1.1, ease: EASE } }}
          aria-hidden="true"
        />
      </motion.div>

      {/* label above the screen: the programme on the left, the film on the right */}
      <motion.div
        className={styles.label}
        style={{ fontSize: labelSize }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 1.5 + index * 0.12, duration: 1, ease: EASE } }}
      >
        <span>
          {pad(index + 1)} — {label}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={clip.title}
            className={styles.labelFilm}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.3 } }}
          >
            {clip.title}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ===========================================================================
// RING CURSOR — a thin paper ring over a screen, with the programme's name
// ===========================================================================
function RingCursor({ show, label }: { show: boolean; label: string }) {
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
        {show && (
          <motion.div
            key="ring"
            className={styles.ring}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.45, ease: EASE } }}
            exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.25, ease: EASE } }}
          >
            <svg className={styles.ringPlay} viewBox="0 0 12 14">
              <path d="M0 0L12 7L0 14Z" />
            </svg>
            <span className={styles.ringLabel}>{label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

