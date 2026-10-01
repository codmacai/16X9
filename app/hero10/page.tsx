"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import { centreAngle, makePanel, panelStart, SPIRAL, type Panel } from "./spiral";
import styles from "./hero10.module.css";

// ===========================================================================
// HERO 10 — the spiral (after the Framer reference). A ribbon of curved 16:9
// panels wound into a helix in pure black. It turns slowly on its own; scroll,
// drag or swipe to spin it, and it coasts back to its own pace. The panels
// facing you play their film; the rest show a still.
// ===========================================================================

const MAX_LIVE = 4; // films decoding at once
const LIVE_EVERY_MS = 300;

const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");
const noop = () => () => {};

export default function Hero10Page() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient) return <section className={styles.root} aria-hidden="true" />;
  return <Spiral />;
}

function Spiral() {
  const variant = useMemo<HeroVariant>(
    () => resolveVariant(new Date(), new URLSearchParams(window.location.search).get("hero")),
    []
  );
  const clips = variant.clips;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      let v = videos.get(i);
      if (v) return v;
      const el = document.createElement("video");
      el.src = clips[i].src;
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      el.setAttribute("muted", "");
      el.preload = "auto";
      const tex = new THREE.VideoTexture(el);
      tex.colorSpace = THREE.SRGBColorSpace;
      v = { el, tex, ready: false };
      const entry = v;
      el.addEventListener("playing", () => (entry.ready = true));
      videos.set(i, v);
      return v;
    };

    // ---- the ribbon ----
    // phones are tall: let the ribbon run further up and down before it fades out
    const edge = host.clientWidth < host.clientHeight ? 1.9 : 1.35;
    const panels: Panel[] = Array.from({ length: SPIRAL.count }, (_, i) => {
      const clip = i % clips.length;
      const p = makePanel(clip, stills[clip], edge);
      group.add(p.mesh);
      return p;
    });

    // ---- size: keep the reference's framing; on narrow screens step back so it fits ----
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // wide screens frame it exactly as the reference; narrow ones step back until it fits
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

    // ---- motion: drift on its own; scroll, drag and swipe add spin that coasts away ----
    let travel = 0;
    let spin = 0;
    const onWheel = (e: WheelEvent) => {
      spin += e.deltaY * 0.0009;
    };
    let dragX: number | null = null;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      dragX = e.clientX;
      lastX = e.clientX;
      host.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (dragX === null) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      travel -= dx * 0.004;
      spin = -dx * 0.25;
    };
    const onUp = () => (dragX = null);
    window.addEventListener("wheel", onWheel, { passive: true });
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);

    // a little lean toward the pointer
    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      lean.tx = (e.clientX / window.innerWidth) * 2 - 1;
      lean.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // ---- which films play: the panels facing you, nearest the centre first ----
    const pickLive = () => {
      const want = new Set<number>();
      panels
        .map((p) => {
          const a = centreAngle(p.material.uniforms.uStart.value as number);
          const y = -a * SPIRAL.pitch;
          return { clip: p.clip, score: Math.cos(a) - Math.abs(y) * 0.5 };
        })
        .filter((s) => s.score > 0.2)
        .sort((a, b) => b.score - a.score)
        .forEach((s) => want.size < MAX_LIVE && want.add(s.clip));
      if (reduce || document.hidden) want.clear();
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
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) {
        if (dragX === null) travel += (SPIRAL.drift + spin) * dt;
        spin *= Math.exp(-dt * 2.2);
      }
      // fade up from black on arrival
      const fade = reduce ? 1 : Math.min(1, (now - born) / 1600);
      panels.forEach((p, i) => {
        p.material.uniforms.uStart.value = panelStart(i, travel);
        p.material.uniforms.uFade.value = fade * fade * (3 - 2 * fade);
      });
      const k = 1 - Math.exp(-dt * 2);
      lean.x += (lean.tx - lean.x) * k;
      lean.y += (lean.ty - lean.y) * k;
      group.rotation.y = lean.x * 0.06;
      group.rotation.x = SPIRAL.tilt.x + lean.y * 0.03;
      group.rotation.z = SPIRAL.tilt.z;
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
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
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

  return <section ref={hostRef} className={styles.root} aria-label="16x9 — showreel spiral" />;
}
