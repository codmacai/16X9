"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import { FORMATS, type FormatKey } from "./formats";
import { EASE } from "./index-stage";
import styles from "./home.module.css";

// ===========================================================================
// THE SCREENING ROOM — a format's films on a wall in the dark. The wall
// bulges gently out toward you, the way a great curved screen does, and
// fills the screen edge to edge: the films at the centre face you, those at
// the edges turn away a little and grow smaller. Every film is in the
// format's proportion, in black and white, its name at its centre.
//
// Drag (or scroll) and the wall slides over its curve in any direction; let
// go and it glides on, then settles into a slow drift. The faster it moves,
// the more it bulges, relaxing as it settles; it leans a touch toward the
// pointer. Opening a room, the flat wall swells into its curve as the films
// come up from the centre. Pointing at a film holds the wall, lifts the film
// off it toward you, brings it into colour and plays it while the rest dim;
// clicking it opens the film.
//
// One loop places every film with a transform: nothing re-renders while the
// wall moves, and only the film under the pointer has a <video>.
// ===========================================================================

type Spec = { ratio: number; desk: number; small: number };
const SPECS: Record<FormatKey, Spec> = {
  // a film's width as a share of the screen's width, on a wide screen and on a phone
  "16x9": { ratio: 16 / 9, desk: 0.2, small: 0.56 },
  "9x16": { ratio: 9 / 16, desk: 0.11, small: 0.3 },
  beyond: { ratio: 2.39, desk: 0.27, small: 0.74 },
};
const DRIFT = { x: -12, y: -7 }; // px per second along the wall, when nothing else moves it
const GLIDE = 3.2; // how quickly a throw settles (per second)
// The curve: its radius as a share of the screen's width (wide screen, phone)
// and how much more it bulges at full speed.
const CURVE = { desk: 1.35, small: 1.9, swell: 0.6 };
const FILL = 1.35; // how much more than the screen the wall covers, so its edges never show
const LEAN = 2.2; // degrees the wall leans toward the pointer
const LIFT = 70; // px the film under the pointer comes off the wall
const SWELL_S = 1.5; // the flat wall swells into its curve as a room opens

// These films are scope pictures with black bars baked into a 16:9 file;
// the tiles zoom past the bars (except Beyond's, which crop them already).
const SCOPE = new Set(["clip-02", "clip-03", "clip-05", "clip-07", "clip-09", "clip-11", "clip-13", "clip-15"]);
const nameOf = (src: string) => src.replace(/^.*\/([^/]+)\.mp4$/i, "$1");
const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");
const pad2 = (n: number) => String(n).padStart(2, "0");

const subscribeSize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

export type TileOpen = (index: number, el: HTMLElement) => void;

const Tile = memo(function Tile({
  id,
  clip,
  index,
  fmt,
  on,
  onHover,
  onOpen,
}: {
  id: string;
  clip: Clip;
  index: number;
  fmt: FormatKey;
  on: boolean;
  onHover: (id: string | null) => void;
  onOpen: (index: number, el: HTMLElement) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const zoom = fmt !== "beyond" && SCOPE.has(nameOf(clip.src)) ? 1.37 : 1;
  return (
    <button
      type="button"
      className={styles.tile}
      style={{ "--z": zoom } as CSSProperties}
      aria-label={`Play ${clip.title}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(id)}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        setPlaying(false);
        onHover(null);
      }}
      onClick={(e) => onOpen(index, e.currentTarget)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stillFor(clip.src)} alt="" draggable={false} decoding="async" />
      {on && (
        <video
          className={playing ? styles.tileVideoOn : undefined}
          src={clip.src}
          muted
          loop
          playsInline
          autoPlay
          disablePictureInPicture
          onPlaying={() => setPlaying(true)}
        />
      )}
      {/* its name, at its centre */}
      <span className={styles.tileName} aria-hidden="true">
        <i>{pad2(index + 1)}</i>
        <b>{clip.title}</b>
        <span className={styles.tileRule} />
        <i>{clip.duration}</i>
      </span>
    </button>
  );
});

export default function FormatGrid({
  fmt,
  clips,
  paused,
  reduce,
  onOpen,
}: {
  fmt: FormatKey;
  clips: Clip[];
  /** a film or the menu is open over the room: the wall holds still */
  paused: boolean;
  reduce: boolean;
  onOpen: TileOpen;
}) {
  const size = useSyncExternalStore(subscribeSize, () => `${window.innerWidth}x${window.innerHeight}`, () => "1440x900");
  const [vw, vh] = size.split("x").map(Number);
  const spec = SPECS[fmt];
  const f = FORMATS.find((x) => x.key === fmt) ?? FORMATS[0];

  // ---- the wall: enough films to cover the screen past its edges, with the seam out of sight ----
  const geo = useMemo(() => {
    const small = vw <= 760;
    const gap = Math.max(6, vw * (small ? 0.02 : 0.007));
    const tw = Math.round(vw * (small ? spec.small : spec.desk));
    const th = Math.round(tw / spec.ratio);
    const cellW = tw + gap;
    const cellH = th + gap;
    const R = vw * (small ? CURVE.small : CURVE.desk);
    const even = (n: number) => n + (n % 2);
    const cols = even(Math.ceil((FILL * vw) / cellW) + 2);
    const rows = even(Math.ceil((FILL * vh) / cellH) + 2);
    const slots: { id: string; c: number; r: number; clip: number; dist: number }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const u = c * cellW - (cols * cellW) / 2;
        const v = r * cellH - (rows * cellH) / 2;
        slots.push({
          id: `${c}-${r}`,
          c,
          r,
          clip: (c * 5 + r * 7) % clips.length,
          dist: Math.min(1, Math.hypot(u / vw, v / vh) * 1.3),
        });
      }
    return { tw, th, cellW, cellH, cols, rows, R, slots };
  }, [vw, vh, spec, clips.length]);

  const [hovered, setHovered] = useState<string | null>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<string | null>(null);
  const pausedRef = useRef(paused);
  const draggedRef = useRef(false);
  useEffect(() => {
    hoverRef.current = hovered;
  }, [hovered]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // ---- the loop: drift, throw, drag, lean, breath, lift; every film placed on the curve ----
  useEffect(() => {
    const root = rootRef.current;
    const wall = wallRef.current;
    if (!root || !wall) return;
    const { cellW, cellH, cols, rows, R: R0, slots } = geo;
    const W = cols * cellW;
    const H = rows * cellH;
    const off = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    const lean = { x: 0, y: 0 };
    const pointer = { x: vw / 2, y: vh / 2 };
    const lift = new Map<string, number>(); // 0..1 per film, eased
    const shown = new Map<string, boolean>();
    let drift = reduce ? 0 : 1;
    let dragging = false;
    let swell = 0;
    const born = performance.now();
    let last = born;
    let raf = 0;
    let prev = "";
    const wrap = (v: number, span: number) => (((v % span) + span) % span) - span / 2;

    const place = (kappa: number) => {
      const R = 1 / kappa;
      wall.style.transform = `translateZ(${(-R).toFixed(1)}px) rotateX(${lean.y.toFixed(3)}deg) rotateY(${lean.x.toFixed(3)}deg)`;
      for (const s of slots) {
        const el = slotRefs.current.get(s.id);
        if (!el) continue;
        const u = wrap(s.c * cellW + off.x + W / 2, W);
        const v = wrap(s.r * cellH + off.y + H / 2, H);
        // the seam, where a film wraps round to the far side, stays out of sight
        const on = Math.abs(u) < W / 2 - cellW * 0.6 && Math.abs(v) < H / 2 - cellH * 0.6;
        if (shown.get(s.id) !== on) {
          shown.set(s.id, on);
          el.style.visibility = on ? "" : "hidden";
        }
        if (!on) continue;
        const z = R + (lift.get(s.id) ?? 0) * LIFT;
        el.style.transform = `rotateY(${(u * kappa).toFixed(5)}rad) rotateX(${(-v * kappa).toFixed(5)}rad) translateZ(${z.toFixed(1)}px)`;
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const still = pausedRef.current;
      const held = hoverRef.current !== null;
      drift += ((still || held || dragging || reduce ? 0 : 1) - drift) * (1 - Math.exp(-dt * 2.5));
      if (!dragging) {
        const g = Math.exp(-GLIDE * dt);
        vel.x *= g;
        vel.y *= g;
        off.x += (vel.x + DRIFT.x * drift) * dt;
        off.y += (vel.y + DRIFT.y * drift) * dt;
      }
      if (!reduce && !still) {
        const k = 1 - Math.exp(-dt * 2.4);
        lean.x += (((pointer.x / vw) * 2 - 1) * LEAN - lean.x) * k;
        lean.y += ((1 - (pointer.y / vh) * 2) * LEAN - lean.y) * k;
      }
      // the film under the pointer comes off the wall; the one left goes back
      let lifting = false;
      const kl = 1 - Math.exp(-dt * (reduce ? 1000 : 9));
      const target = hoverRef.current;
      if (target && !lift.has(target)) lift.set(target, 0);
      lift.forEach((v, id) => {
        const to = id === target ? 1 : 0;
        const nv = v + (to - v) * kl;
        if (to === 0 && nv < 0.002) {
          lift.delete(id);
          lifting = true;
        } else {
          lift.set(id, nv);
          if (Math.abs(to - nv) > 0.002) lifting = true;
        }
      });
      // the wall breathes with its speed, and swells out of a flat wall as the room opens
      const speed = Math.min(1, Math.hypot(vel.x, vel.y) / 2200);
      swell += (speed - swell) * (1 - Math.exp(-dt * 4));
      const open = reduce ? 1 : Math.min(1, (now - born) / 1000 / SWELL_S);
      const grow = 1 - Math.pow(1 - open, 3);
      const kappa = Math.max(1e-5, (grow * (1 + CURVE.swell * swell)) / R0);
      const key = `${off.x.toFixed(1)},${off.y.toFixed(1)},${lean.x.toFixed(2)},${lean.y.toFixed(2)},${kappa.toExponential(4)}`;
      if (key !== prev || lifting) {
        prev = key;
        place(kappa);
      }
      raf = requestAnimationFrame(frame);
    };
    place(reduce ? 1 / R0 : 1e-5);
    raf = requestAnimationFrame(frame);

    // ---- drag (mouse or finger) with a throw; wheel and trackpad push it ----
    let id = -1;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;
    let lt = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || pausedRef.current) return;
      id = e.pointerId;
      sx = lx = e.clientX;
      sy = ly = e.clientY;
      lt = performance.now();
      draggedRef.current = false;
      vel.x = vel.y = 0;
    };
    const move = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (e.pointerId !== id) return;
      if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
        dragging = true;
        draggedRef.current = true;
        root.classList.add(styles.gridDragging);
        root.setPointerCapture?.(id);
        setHovered(null);
      }
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      off.x += dx;
      off.y += dy;
      const inv = 1000 / Math.max(8, now - lt);
      vel.x = vel.x * 0.4 + dx * inv * 0.6;
      vel.y = vel.y * 0.4 + dy * inv * 0.6;
      lx = e.clientX;
      ly = e.clientY;
      lt = now;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      if (!dragging) return;
      dragging = false;
      root.classList.remove(styles.gridDragging);
      if (performance.now() - lt > 80) vel.x = vel.y = 0; // held still before letting go: no throw
      vel.x = Math.max(-4000, Math.min(4000, vel.x));
      vel.y = Math.max(-4000, Math.min(4000, vel.y));
    };
    const wheel = (e: WheelEvent) => {
      if (pausedRef.current) return;
      e.preventDefault();
      vel.x = Math.max(-3000, Math.min(3000, vel.x - e.deltaX * 7));
      vel.y = Math.max(-3000, Math.min(3000, vel.y - e.deltaY * 7));
    };
    root.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    root.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      root.removeEventListener("wheel", wheel);
    };
  }, [geo, vw, vh, reduce]);

  const open = useCallback(
    (index: number, el: HTMLElement) => {
      if (draggedRef.current) return; // that was a drag, not a click
      onOpen(index, el);
    },
    [onOpen]
  );
  // pointing at a film takes it; leaving lets go of whichever film was held
  const hover = useCallback((id: string | null) => setHovered(id), []);

  return (
    <motion.div
      ref={rootRef}
      className={`${styles.grid} ${hovered ? styles.gridPointing : ""}`}
      style={{ "--tw": `${geo.tw}px`, "--th": `${geo.th}px`, "--ratio": String(spec.ratio) } as CSSProperties}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.5, ease: EASE, delay: reduce ? 0 : 0.1 } }}
      aria-label={`${f.label}: ${f.line}`}
    >
      {/* the wall: its centre lies a radius behind the screen; each film is turned out onto its face */}
      <div ref={wallRef} className={styles.wall}>
        {geo.slots.map((s) => {
          const clip = clips[s.clip];
          const on = hovered === s.id;
          return (
            <div
              key={s.id}
              ref={(el) => {
                if (el) slotRefs.current.set(s.id, el);
                else slotRefs.current.delete(s.id);
              }}
              className={`${styles.slot} ${on ? styles.slotOn : ""}`}
            >
              {/* each film comes up from the centre outward, and leaves the same way */}
              <motion.div
                className={styles.slotIn}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.1 + s.dist * 0.6, duration: 0.9, ease: EASE } }}
                exit={{ opacity: 0, transition: { delay: (1 - s.dist) * 0.15, duration: 0.35 } }}
              >
                <Tile id={s.id} clip={clip} index={s.clip} fmt={fmt} on={on} onHover={hover} onOpen={open} />
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* the dark closes in at the edges, and a fine grain lies over everything */}
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
    </motion.div>
  );
}
