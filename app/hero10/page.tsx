"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { Archivo } from "next/font/google";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "../hero7/project-view";
import { centreAngle, makePanel, panelPoint, panelStart, SPIRAL, type Panel } from "./spiral";
import styles from "./hero10.module.css";

// ===========================================================================
// HERO 10 — the spiral. A ribbon of curved 16:9 panels wound into a helix in
// pure black, turning on its own. Point at a film and the spiral slows, that
// film comes up and the rest dim; click it to watch it full screen. Drag,
// swipe or scroll to spin it. The line sits in the middle; a logo and a menu
// button frame it.
//
// Cinematic finish: letterbox bars open on arrival, a film grade in the
// shader, a vignette and a fine moving grain.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

const COPY = {
  eyebrow: "16X9 — Video production · Dubai",
  headline: ["Bringing brands", "to life"],
};
const LOGO_SRC = "/logo.png";

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const T = { bars: 0.25, spiral: 0.6, head: 1.25, ui: 1.8 }; // entrance, seconds
const MAX_LIVE = 4; // films decoding at once
const LIVE_EVERY_MS = 300;
const FOCUS_SPEED = 0.15; // how fast the spiral turns while you point at a film (1 = normal)
const DRAG_PX = 6; // movement that makes a press a drag rather than a click

const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");
const noop = () => () => {};

export default function Hero10Page() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient) return <section className={`${styles.root} ${wide.variable}`} aria-hidden="true" />;
  return <SpiralHero />;
}

function SpiralHero() {
  const variant = useMemo<HeroVariant>(
    () => resolveVariant(new Date(), new URLSearchParams(window.location.search).get("hero")),
    []
  );
  const clips = variant.clips;
  const hostRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(false);
  const [hover, setHover] = useState<number | null>(null);
  const [project, setProject] = useState<OpenProject | null>(null);

  useEffect(() => {
    projectRef.current = project !== null;
  }, [project]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    // ---- renderer, scene, camera ----
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 1);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(SPIRAL.camera.fov, 1, 0.1, 100);
    const group = new THREE.Group();
    scene.add(group);

    // ---- textures: a still for every film, a live video for the ones facing you ----
    const loader = new THREE.TextureLoader();
    const stills = clips.map((c) => {
      const t = loader.load(stillFor(c.src));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
    const videos = new Map<number, { el: HTMLVideoElement; tex: THREE.VideoTexture; ready: boolean }>();
    const video = (i: number) => {
      const have = videos.get(i);
      if (have) return have;
      const el = document.createElement("video");
      el.src = clips[i].src;
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      el.setAttribute("muted", "");
      el.preload = "auto";
      const tex = new THREE.VideoTexture(el);
      tex.colorSpace = THREE.SRGBColorSpace;
      const entry = { el, tex, ready: false };
      el.addEventListener("playing", () => (entry.ready = true));
      videos.set(i, entry);
      return entry;
    };

    // ---- the ribbon ----
    const tall = host.clientWidth < host.clientHeight;
    const edge = tall ? 1.9 : 1.35; // phones are tall: the ribbon runs further before it fades
    const panels: Panel[] = Array.from({ length: SPIRAL.count }, (_, i) => {
      const clip = i % clips.length;
      const p = makePanel(clip, stills[clip], edge);
      group.add(p.mesh);
      return p;
    });

    // ---- framing: the reference's on wide screens; narrow ones step back until it fits ----
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const halfWide = camera.aspect < 1 ? 0.92 : 1.15;
      const fit = halfWide / (Math.tan(THREE.MathUtils.degToRad(SPIRAL.camera.fov / 2)) * camera.aspect) + SPIRAL.radius;
      const { x, y, distance } = SPIRAL.camera;
      const narrow = camera.aspect < 1;
      camera.position.set(narrow ? 0 : x, y, Math.max(distance, fit));
      camera.lookAt(narrow ? 0 : x, y, 0);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ---- hit test: the panel under a screen point (front-facing, nearest first) ----
    const v3 = new THREE.Vector3();
    const n3 = new THREE.Vector3();
    const SEG = 10;
    const outline = (p: Panel) => {
      const start = p.material.uniforms.uStart.value as number;
      const r = host.getBoundingClientRect();
      const pts: { x: number; y: number }[] = [];
      let depth = 0;
      const push = (u: number, v: number) => {
        panelPoint(start, u, v, v3).applyMatrix4(group.matrixWorld).project(camera);
        depth += v3.z;
        pts.push({ x: r.left + ((v3.x + 1) / 2) * r.width, y: r.top + ((1 - v3.y) / 2) * r.height });
      };
      for (let k = 0; k <= SEG; k++) push(k / SEG, 1);
      for (let k = SEG; k >= 0; k--) push(k / SEG, 0);
      return { pts, depth: depth / pts.length };
    };
    const inside = (x: number, y: number, pts: { x: number; y: number }[]) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i];
        const b = pts[j];
        if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
      }
      return hit;
    };
    const toCam = new THREE.Vector3();
    const facing = (p: Panel) => {
      const start = p.material.uniforms.uStart.value as number;
      panelPoint(start, 0.5, 0.5, v3).applyMatrix4(group.matrixWorld);
      const a = centreAngle(start);
      n3.set(Math.sin(a), 0, Math.cos(a)).transformDirection(group.matrixWorld);
      return n3.dot(toCam.copy(camera.position).sub(v3).normalize());
    };
    const pick = (x: number, y: number) => {
      let best: Panel | null = null;
      let bestDepth = Infinity;
      for (const p of panels) {
        if ((p.material.uniforms.uFade.value as number) < 0.5) continue;
        // only panels in the lit band, facing you
        const mid = centreAngle(p.material.uniforms.uStart.value as number);
        if (Math.abs(mid * SPIRAL.pitch) > edge - 0.3) continue;
        if (facing(p) < 0.15) continue;
        const o = outline(p);
        if (o.depth < bestDepth && inside(x, y, o.pts)) {
          best = p;
          bestDepth = o.depth;
        }
      }
      return best;
    };

    // ---- input ----
    let travel = 0;
    let spin = 0;
    let speed = 1; // eased: slows while a film has focus, stops while the player is open
    let focused: Panel | null = null;
    const pointer = { x: -1, y: -1 };
    const setFocus = (p: Panel | null) => {
      if (p === focused) return;
      focused = p;
      setHover(p ? p.clip : null);
      host.style.cursor = p && fine ? "none" : "";
    };
    const onWheel = (e: WheelEvent) => {
      if (!projectRef.current) spin += e.deltaY * 0.0009;
    };
    let dragging = false;
    let downX = 0;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      downX = lastX = e.clientX;
      host.setPointerCapture(e.pointerId);
    };
    const onMoveHost = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      travel -= dx * 0.004;
      spin = -dx * 0.25;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      // a press that barely moved is a click (or a tap): open the film under it
      if (Math.abs(e.clientX - downX) < DRAG_PX) {
        const p = pick(e.clientX, e.clientY);
        if (p) openPanel(p);
      }
    };
    const onCancel = () => (dragging = false);
    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      lean.tx = (e.clientX / window.innerWidth) * 2 - 1;
      lean.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      pointer.x = -1;
      setFocus(null);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMoveHost);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onCancel);
    host.addEventListener("pointerleave", onLeave);

    // ---- opening a film: the player grows out of the panel's place on screen ----
    const openPanel = (p: Panel) => {
      const { pts } = outline(p);
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.y);
      const left = Math.min(...xs);
      const top = Math.min(...ys);
      const v = videos.get(p.clip);
      setFocus(null);
      setProject({
        index: p.clip,
        rect: { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top },
        time: v && !v.el.paused ? v.el.currentTime : 0,
      });
    };

    // ---- which films play: the panels facing you ----
    const pickLive = () => {
      const scored = panels
        .map((p) => {
          const a = centreAngle(p.material.uniforms.uStart.value as number);
          return { p, score: Math.cos(a) - Math.abs(a * SPIRAL.pitch) * 0.6 };
        })
        .sort((a, b) => b.score - a.score);
      const want = new Set<number>();
      scored.filter((s) => s.score > 0.2).forEach((s) => want.size < MAX_LIVE && want.add(s.p.clip));
      if (focused) want.add(focused.clip);
      if (reduce || document.hidden || projectRef.current) want.clear();
      videos.forEach((v, i) => {
        if (!want.has(i) && !v.el.paused) v.el.pause();
      });
      want.forEach((i) => {
        const v = video(i);
        if (v.el.paused) v.el.play().catch(() => {});
      });
      panels.forEach((p) => {
        const v = videos.get(p.clip);
        p.material.uniforms.uMap.value = v && want.has(p.clip) && v.ready ? v.tex : stills[p.clip];
      });
    };
    const liveTimer = window.setInterval(pickLive, LIVE_EVERY_MS);

    // ---- the loop ----
    let raf = 0;
    let last = performance.now();
    const born = last;
    let dim = 0;
    let checkAt = 0;
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const target = projectRef.current ? 0 : focused ? FOCUS_SPEED : 1;
      speed += (target - speed) * (1 - Math.exp(-dt * 3));
      if (!reduce) {
        if (!dragging) travel += (SPIRAL.drift * speed + spin) * dt;
        spin *= Math.exp(-dt * 2.2);
      }
      // the film under a resting mouse keeps its focus as the spiral carries it (checked ~15×/s)
      if (fine && t > checkAt) {
        checkAt = t + 66;
        setFocus(!dragging && !projectRef.current && pointer.x >= 0 ? pick(pointer.x, pointer.y) : null);
      }

      const age = (t - born) / 1000;
      const f = reduce ? 1 : Math.min(1, Math.max(0, (age - T.spiral) / 1.8));
      const fade = f * f * (3 - 2 * f);
      dim += ((focused ? 0.42 : 0) - dim) * (1 - Math.exp(-dt * 6));
      const kf = 1 - Math.exp(-dt * 6);
      panels.forEach((p, i) => {
        const u = p.material.uniforms;
        u.uStart.value = panelStart(i, travel);
        u.uFade.value = fade;
        u.uDim.value = dim;
        u.uFocus.value += ((p === focused ? 1 : 0) - (u.uFocus.value as number)) * kf;
      });
      const k = 1 - Math.exp(-dt * 2);
      lean.x += (lean.tx - lean.x) * k;
      lean.y += (lean.ty - lean.y) * k;
      group.rotation.y = lean.x * 0.06;
      group.rotation.x = SPIRAL.tilt.x + lean.y * 0.03;
      group.rotation.z = SPIRAL.tilt.z;
      group.updateMatrixWorld();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(liveTimer);
      ro.disconnect();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMoveHost);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onCancel);
      host.removeEventListener("pointerleave", onLeave);
      videos.forEach((v) => {
        v.el.pause();
        v.el.removeAttribute("src");
        v.el.load();
        v.tex.dispose();
      });
      stills.forEach((t) => t.dispose());
      panels.forEach((p) => {
        p.mesh.geometry.dispose();
        p.material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [clips]);

  const rise = (delay: number) => ({
    initial: { y: "110%" },
    animate: { y: 0, transition: { delay, duration: 1.2, ease: EASE } },
  });
  const fadeIn = (delay: number, y = 10) => ({
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0, transition: { delay, duration: 1.1, ease: EASE } },
  });

  return (
    <section className={`${styles.root} ${wide.variable}`} aria-label="16x9 — Bringing brands to life">
      {/* the spiral */}
      <div ref={hostRef} className={styles.canvas} />

      {/* cinematic finish: shade for the type, vignette, grain */}
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      {/* ================= content ================= */}
      <div className={styles.ui}>
        <motion.header className={styles.topbar} {...fadeIn(T.ui, -10)}>
          <a href="#top" className={styles.logo} aria-label="16x9 home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="16x9" />
          </a>
          {/* the menu: not wired up yet */}
          <button type="button" className={styles.burger} aria-label="Menu">
            <span />
            <span />
          </button>
        </motion.header>

        {/* the line, in the middle */}
        <div className={styles.center}>
          <motion.p className={styles.eyebrow} {...fadeIn(T.head - 0.2, 8)}>
            {COPY.eyebrow}
          </motion.p>
          <h1 className={styles.headline}>
            {COPY.headline.map((line, i) => (
              <span key={line} className={styles.mask}>
                <motion.span className={styles.line} {...rise(T.head + i * 0.14)}>
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
        </div>
      </div>

      {/* letterbox: the frame opens on arrival */}
      <motion.div
        className={`${styles.bar} ${styles.barTop}`}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0, transition: { delay: T.bars, duration: 1.5, ease: EASE_CINE } }}
        aria-hidden="true"
      />
      <motion.div
        className={`${styles.bar} ${styles.barBottom}`}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0, transition: { delay: T.bars, duration: 1.5, ease: EASE_CINE } }}
        aria-hidden="true"
      />

      <PlayCursor title={hover !== null ? clips[hover]?.title ?? "" : ""} show={hover !== null && !project} />

      <AnimatePresence>
        {project && <ProjectView key="project" clips={clips} open={project} onClose={() => setProject(null)} />}
      </AnimatePresence>
    </section>
  );
}

// ===========================================================================
// PLAY CURSOR — a thin paper ring with a play mark and the film's name
// ===========================================================================
function PlayCursor({ show, title }: { show: boolean; title: string }) {
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
            <span className={styles.ringLabel}>{title}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
