"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import type { TileRect } from "../hero7/project-view";
import { FORMATS, Ratio, type FormatKey } from "../hero13/formats";
import styles from "./hero2.module.css";

// ===========================================================================
// THE ROOM — a format's films hung like posters on a wall in the dark,
// edge to edge, every one in the format's proportion.
//
// The wall curves round you, the way the inside of a dome does: the posters
// at the centre face you square, those toward the edges turn in and come
// nearer. Each one hangs a little crooked, as if pinned up by hand.
//
// Drag or scroll and the wall slides past in any direction (it never ends).
// Held, it pushes in toward you: the posters grow, the wall curves deeper
// and they hang more crooked; let go and it glides on, eases back out, then
// settles into a slow roll upward. The faster it moves, the more the
// posters lean into the move. Opening the room, the posters swing up onto the wall from the centre
// outward. Pointing at one straightens it, brings it toward you, wipes its
// still into the film playing and puts a white button with an arrow at its
// centre while the rest go down; clicking opens the film. A fine crosshair
// follows the pointer across the dark.
//
// One loop places every poster with a transform: nothing re-renders while
// the wall moves, and only the poster under the pointer has a <video>.
// ===========================================================================

type Spec = { ratio: number; desk: number; small: number };
const SPECS: Record<FormatKey, Spec> = {
  // a poster's width as a share of the screen's width, on a wide screen and on a phone
  "16x9": { ratio: 16 / 9, desk: 0.25, small: 0.64 },
  "9x16": { ratio: 9 / 16, desk: 0.138, small: 0.38 },
  beyond: { ratio: 2.39, desk: 0.32, small: 0.8 },
};
const CURVE = 17; // degrees a poster at the edge of the screen turns in toward you
const CURVE_FAST = 16; // ...and how many more at full speed
const NEAR = 0.07; // how far (share of the screen's width) the edges come toward you
const SWAY = 14; // degrees the posters lean into a fast move
const CROOKED = { z: 1.6, xy: 4 }; // the most a poster hangs off true, in degrees
const DRIFT = -14; // px per second the wall rolls upward when nothing moves it
const GLIDE = 3; // how quickly a throw settles (per second)
const TOP_SPEED = 2600; // px per second counted as full speed
const LIFT = 56; // px the poster under the pointer comes toward you
// While the wall is held (dragged, or still running fast) it pushes in toward you: the posters grow by
// `zoom`, the wall curves `curve` degrees deeper and the posters hang `crooked` times more off true.
// It pushes in at rate `in` and eases back out, once let go, at rate `out` (per second).
const PUSH = { zoom: 1.42, curve: 9, crooked: 1.8, in: 5, out: 2.4 };
const SWING = { s: 0.95, spread: 0.55, from: 78, back: 420 }; // the entrance: duration, stagger by distance, degrees, px
const FADE = [0.45, 0, 0.55, 1] as const; // a room leaving fades evenly, so the next one swings up through it

// These films are scope pictures with black bars baked into a 16:9 file;
// the posters zoom past the bars (except Beyond's, which crop them already).
const SCOPE = new Set(["clip-02", "clip-03", "clip-05", "clip-07", "clip-09", "clip-11", "clip-13", "clip-15"]);
const nameOf = (src: string) => src.replace(/^.*\/([^/]+)\.mp4$/i, "$1");
const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");
const pad2 = (n: number) => String(n).padStart(2, "0");
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Steps across and down the wall through the films, so that no two neighbours (or diagonals) match. */
function steps(n: number) {
  const prime = (k: number) => gcd(k, n) === 1;
  const a = [5, 7, 11, 13, 3, 1].find(prime) ?? 1;
  const b = [7, 11, 13, 3, 5, 2, 1].find((k) => k % n !== a % n && prime(k) && (a + k) % n !== 0 && (a - k + n * 4) % n !== 0) ?? 2;
  return { a, b };
}
// a fixed, scattered number in 0..1 for each poster: how it hangs
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const subscribeSize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

export type PosterOpen = (index: number, rect: TileRect) => void;

const Poster = memo(function Poster({
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
  const f = FORMATS.find((x) => x.key === fmt) ?? FORMATS[0];
  const zoom = fmt !== "beyond" && SCOPE.has(nameOf(clip.src)) ? 1.37 : 1;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      className={styles.poster}
      style={{ "--z": zoom } as CSSProperties}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(id)}
      onPointerMove={(e) => e.pointerType === "mouse" && !on && onHover(id)}
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
          className={playing ? styles.posterFilmOn : undefined}
          src={clip.src}
          muted
          loop
          playsInline
          autoPlay
          disablePictureInPicture
          onPlaying={() => setPlaying(true)}
        />
      )}
      <span className={styles.posterShade} />
      {/* a poster's small print: number and format above, runtime and studio below; the title at its centre */}
      <span className={`${styles.posterPrint} ${styles.posterPrintTop}`}>
        <i>{pad2(index + 1)}</i>
        <i>
          <Ratio text={f.label} className={styles.fmtX} />
        </i>
      </span>
      <span className={styles.posterTitle}>{clip.title}</span>
      <span className={`${styles.posterPrint} ${styles.posterPrintFoot}`}>
        <i>{clip.duration}</i>
        <i>16x9 &amp; Beyond</i>
      </span>
      {/* the button: white, with an arrow, at the centre */}
      <span className={styles.posterGo}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
    </button>
  );
});

export default function PosterWall({
  fmt,
  clips,
  paused,
  reduce,
  delay,
  onOpen,
}: {
  fmt: FormatKey;
  clips: Clip[];
  /** a film or the menu is open over the room: the wall holds still */
  paused: boolean;
  reduce: boolean;
  /** seconds before the posters swing up (the index is still opening its film) */
  delay: number;
  onOpen: PosterOpen;
}) {
  const size = useSyncExternalStore(subscribeSize, () => `${window.innerWidth}x${window.innerHeight}`, () => "1440x900");
  const [vw, vh] = size.split("x").map(Number);
  const spec = SPECS[fmt];
  const f = FORMATS.find((x) => x.key === fmt) ?? FORMATS[0];

  // ---- the wall: enough posters to cover the screen past its edges, with the seam out of sight ----
  const geo = useMemo(() => {
    const small = vw <= 760;
    const gap = Math.max(10, vw * (small ? 0.03 : 0.014));
    const tw = Math.round(vw * (small ? spec.small : spec.desk));
    const th = Math.round(tw / spec.ratio);
    const cellW = tw + gap;
    const cellH = th + gap;
    const even = (n: number) => n + (n % 2);
    const cols = even(Math.ceil((1.3 * vw) / cellW) + 2);
    const rows = even(Math.ceil((1.3 * vh) / cellH) + 2);
    const step = steps(clips.length);
    const slots: { id: string; c: number; r: number; clip: number; tilt: { x: number; y: number; z: number } }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const n = c * 31 + r * 17;
        slots.push({
          id: `${c}-${r}`,
          c,
          r,
          clip: (c * step.a + r * step.b) % clips.length,
          tilt: {
            x: (hash(n + 5) - 0.5) * 2 * CROOKED.xy,
            y: (hash(n + 9) - 0.5) * 2 * CROOKED.xy,
            z: (hash(n) - 0.5) * 2 * CROOKED.z,
          },
        });
      }
    return { tw, th, cellW, cellH, cols, rows, slots };
  }, [vw, spec, clips.length, vh]);

  const [hovered, setHovered] = useState<string | null>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);
  const hairX = useRef<HTMLSpanElement>(null);
  const hairY = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef<string | null>(null);
  const pausedRef = useRef(paused);
  const draggedRef = useRef(false);
  useEffect(() => {
    hoverRef.current = hovered;
  }, [hovered]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // ---- the loop: drift, throw, drag, curve, sway, lift, the entrance; every poster placed ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const { cellW, cellH, cols, rows, slots } = geo;
    const W = cols * cellW;
    const H = rows * cellH;
    const off = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    const sway = { x: 0, y: 0 };
    const pointer = { x: vw / 2, y: vh / 2, seen: false };
    const cross = { x: vw / 2, y: vh / 2 };
    const lift = new Map<string, number>(); // 0..1 per poster, eased
    const shown = new Map<string, boolean>();
    let drift = 0;
    let speed = 0;
    let push = 0; // 0 at rest, 1 held: how far the wall has pushed in
    let dragging = false;
    // the eye's distance from the wall (the CSS perspective), and how near the wall comes when held
    const eye = parseFloat(getComputedStyle(root).perspective) || 1000;
    const near = eye * (1 - 1 / PUSH.zoom);
    // how much bigger the wall looks right now: a drag moves it under the pointer at that scale
    const scale = () => 1 / (1 - (push * near) / eye);
    let settled = reduce;
    const born = performance.now();
    let last = born;
    let raf = 0;
    const wrap = (v: number, span: number) => (((v % span) + span) % span) - span / 2;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const place = (now: number) => {
      const age = (now - born) / 1000 - delay;
      const curve = CURVE + CURVE_FAST * speed + PUSH.curve * push;
      const crooked = 1 + PUSH.crooked * push;
      const dolly = push * near;
      let entering = false;
      for (const s of slots) {
        const el = slotRefs.current.get(s.id);
        if (!el) continue;
        const u = wrap(s.c * cellW + off.x, W);
        const v = wrap(s.r * cellH + off.y, H);
        // the seam, where a poster wraps round to the far side, stays out of sight
        const on = Math.abs(u) < W / 2 - cellW * 0.55 && Math.abs(v) < H / 2 - cellH * 0.55;
        if (shown.get(s.id) !== on) {
          shown.set(s.id, on);
          el.style.visibility = on ? "" : "hidden";
        }
        if (!on) continue;
        const nx = u / (vw / 2);
        const ny = v / (vh / 2);
        const l = lift.get(s.id) ?? 0;
        const hang = (1 - l) * crooked;
        // the entrance: each poster swings up onto the wall, the centre first
        let p = 1;
        if (!settled) {
          const dist = Math.min(1.4, Math.hypot(nx * 0.8, ny * 0.6));
          p = Math.max(0, Math.min(1, (age - dist * SWING.spread) / SWING.s));
          if (p < 1) entering = true;
        }
        const e = ease(p);
        const rx = ny * curve * 0.8 + sway.y + s.tilt.x * hang + (1 - e) * SWING.from;
        const ry = -nx * curve + sway.x + s.tilt.y * hang;
        const rz = s.tilt.z * hang;
        const z = (nx * nx * 0.65 + ny * ny * 0.35) * NEAR * vw + l * LIFT + dolly - (1 - e) * SWING.back;
        el.style.transform = `translate3d(${u.toFixed(1)}px, ${v.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg)`;
        if (!settled) el.style.opacity = String(Math.min(1, p * 1.8));
      }
      if (!settled && !entering && age > 0) {
        settled = true;
        slotRefs.current.forEach((el) => (el.style.opacity = "1"));
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const still = pausedRef.current;
      const held = hoverRef.current !== null;
      const age = (now - born) / 1000 - delay;
      // the slow roll waits for the posters to be up, and holds while one is pointed at
      const rolling = !(still || held || dragging || reduce || age < SWING.s);
      drift += ((rolling ? 1 : 0) - drift) * (1 - Math.exp(-dt * 1.6));
      if (!dragging) {
        const g = Math.exp(-GLIDE * dt);
        vel.x *= g;
        vel.y *= g;
        off.x += vel.x * dt;
        off.y += (vel.y + DRIFT * drift) * dt;
      }
      // the faster it goes, the deeper it curves and the more the posters lean into it
      const k = 1 - Math.exp(-dt * 5);
      const sp = reduce ? 0 : Math.min(1, Math.hypot(vel.x, vel.y) / TOP_SPEED);
      speed += (sp - speed) * k;
      // held, the wall pushes in; let go, it eases back out as the throw dies away
      const want = reduce ? 0 : Math.max(dragging ? 1 : 0, Math.min(1, speed * 1.4));
      push += (want - push) * (1 - Math.exp(-dt * (want > push ? PUSH.in : PUSH.out)));
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      sway.x += ((reduce ? 0 : -clamp(vel.x / TOP_SPEED) * SWAY) - sway.x) * k;
      sway.y += ((reduce ? 0 : clamp(vel.y / TOP_SPEED) * SWAY) - sway.y) * k;
      // the poster under the pointer comes off the wall and straightens; the one left goes back
      const kl = 1 - Math.exp(-dt * (reduce ? 1000 : 9));
      const target = hoverRef.current;
      if (target && !lift.has(target)) lift.set(target, 0);
      lift.forEach((v, id) => {
        const to = id === target ? 1 : 0;
        const nv = v + (to - v) * kl;
        if (to === 0 && nv < 0.002) lift.delete(id);
        else lift.set(id, nv);
      });
      place(now);
      // the crosshair follows the pointer
      if (pointer.seen) {
        const kc = 1 - Math.exp(-dt * 16);
        cross.x += (pointer.x - cross.x) * kc;
        cross.y += (pointer.y - cross.y) * kc;
        if (hairX.current) hairX.current.style.transform = `translateY(${cross.y.toFixed(1)}px)`;
        if (hairY.current) hairY.current.style.transform = `translateX(${cross.x.toFixed(1)}px)`;
        if (ring.current) ring.current.style.transform = `translate(${cross.x.toFixed(1)}px, ${cross.y.toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(frame);
    };
    place(performance.now());
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
      if (e.pointerType === "mouse") {
        const r = root.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
        if (!pointer.seen) {
          pointer.seen = true;
          cross.x = pointer.x;
          cross.y = pointer.y;
          root.classList.add(styles.hudOn);
        }
      }
      if (e.pointerId !== id) return;
      if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
        dragging = true;
        draggedRef.current = true;
        root.classList.add(styles.wallDragging);
        root.setPointerCapture?.(id);
        setHovered(null);
      }
      if (!dragging) return;
      const now = performance.now();
      const z = scale();
      const dx = (e.clientX - lx) / z;
      const dy = (e.clientY - ly) / z;
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
      root.classList.remove(styles.wallDragging);
      if (performance.now() - lt > 80) vel.x = vel.y = 0; // held still before letting go: no throw
      vel.x = Math.max(-4200, Math.min(4200, vel.x));
      vel.y = Math.max(-4200, Math.min(4200, vel.y));
    };
    const out = () => {
      pointer.seen = false;
      root.classList.remove(styles.hudOn);
    };
    const wheel = (e: WheelEvent) => {
      if (pausedRef.current) return;
      e.preventDefault();
      // the wall slides out from under the pointer: let go of the poster it was on
      if (hoverRef.current) setHovered(null);
      const unit = e.deltaMode === 1 ? 32 : 1;
      vel.x = Math.max(-3600, Math.min(3600, vel.x - e.deltaX * unit * 6));
      vel.y = Math.max(-3600, Math.min(3600, vel.y - e.deltaY * unit * 6));
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointerleave", out);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    root.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointerleave", out);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      root.removeEventListener("wheel", wheel);
    };
  }, [geo, vw, vh, reduce, delay]);

  const open = useCallback(
    (index: number, el: HTMLElement) => {
      if (draggedRef.current) return; // that was a drag, not a click
      const r = el.getBoundingClientRect();
      onOpen(index, { top: r.top, left: r.left, width: r.width, height: r.height });
    },
    [onOpen]
  );
  const hover = useCallback((id: string | null) => setHovered(id), []);
  // the films for a screen reader or the keyboard: a plain list
  const openFromList = (index: number) => {
    const w = Math.min(vw * 0.5, ((vh * 0.5) * spec.ratio));
    const h = w / spec.ratio;
    onOpen(index, { top: (vh - h) / 2, left: (vw - w) / 2, width: w, height: h });
  };

  return (
    <motion.div
      ref={rootRef}
      className={`${styles.wall} ${hovered ? styles.wallPointing : ""}`}
      style={{ "--tw": `${geo.tw}px`, "--th": `${geo.th}px` } as CSSProperties}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.7, ease: FADE } }}
      aria-label={`${f.label}: ${f.line}`}
      role="region"
    >
      <div className={styles.wallPlane}>
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
              style={reduce ? undefined : { opacity: 0 }}
            >
              <Poster id={s.id} clip={clip} index={s.clip} fmt={fmt} on={on} onHover={hover} onOpen={open} />
            </div>
          );
        })}
      </div>

      {/* the dark closes in at the edges, a fine grain over everything, and the crosshair */}
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <span ref={hairX} className={`${styles.hair} ${styles.hairX}`} aria-hidden="true" />
      <span ref={hairY} className={`${styles.hair} ${styles.hairY}`} aria-hidden="true" />
      <span ref={ring} className={styles.ring} aria-hidden="true" />

      <ul className={styles.sr}>
        {clips.map((c, i) => (
          <li key={c.src}>
            <button type="button" onClick={() => openFromList(i)}>
              Play {c.title}, {c.duration}
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
