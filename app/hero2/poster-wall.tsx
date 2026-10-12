"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import { motion } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import type { TileRect } from "../hero7/project-view";
import { FORMATS, Ratio, type FormatKey } from "../hero13/formats";
import styles from "./hero2.module.css";

// ===========================================================================
// THE ROOM — a format's films hung like posters in the dark, every one in
// the format's proportion.
//
// 16x9 and 9x16: a wall that curves round you, the way the inside of a dome
// does: the posters at the centre face you square, those toward the edges
// turn in and come nearer, each one a little crooked, as if pinned up by
// hand. Drag or scroll and it slides past in any direction (it never ends);
// let go and it glides on, then settles into a slow roll upward. The faster
// it moves, the more the posters lean into the move.
//
// Beyond: the posters cover a great sphere, in clean rows circling it pole
// to pole, seen up close so it fills the screen as one curved surface; the
// posters shade off a little toward its rim. It answers the pointer: the
// posters near it swell out of the surface toward you, growing and
// brightening, a bulge that follows the pointer across it. Drag and it turns
// under your hand; let go and it spins on, then slowly turns by itself.
//
// Zoom: grab the room and it pushes in toward you, and stays in. Pinch,
// Ctrl/Cmd + scroll, the - and + keys or the slider at the foot take it
// back out (out far enough, the whole sphere comes into view); 0 or the level resets it.
//
// Opening the room, the posters swing up into place from the centre
// outward. Pointing at one straightens it, brings it toward you, wipes its
// still into the film playing and puts a white button with an arrow at its
// centre while the rest go down; clicking opens the film. A fine crosshair
// follows the pointer across the dark.
//
// One loop places every poster with a transform: nothing re-renders while
// the room moves, posters out of sight are skipped, and only the poster
// under the pointer has a <video>.
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
const DRIFT = 14; // px per second the room moves when nothing moves it (the wall rolls up, the sphere turns)
const GLIDE = 3; // how quickly a throw settles (per second)
const TOP_SPEED = 2600; // px per second counted as full speed
const LIFT = 56; // px the poster under the pointer comes toward you
// Zoom, as a scale of the posters: the range on the wall and on the sphere, where each starts (the
// sphere starts close, so it fills the screen as a curved surface rather than a ball), the level a drag
// pushes in to (and stays at), a step of the keys and buttons, and how fast it follows.
const ZOOM = { wall: [0.72, 1.8], sphere: [0.6, 2.4], base: { wall: 1, sphere: 1.55 }, held: { wall: 1.4, sphere: 1.8 }, step: 1.25, rate: 7 } as const;
// The sphere: its radius and a poster's width as shares of the screen's width
// (wide screen, phone), and the latitude its rows reach toward the poles.
const SPHERE = { r: 0.62, rSmall: 1.1, tile: 0.23, tileSmall: 0.42, lat: 1.25, tiltMax: 0.6 };
// ...and how it answers the pointer: the bulge round it (its reach as a share of the screen's width,
// how far it lifts the posters as a share of the radius, how much it grows them).
const ALIVE = { reach: 0.16, lift: 0.12, grow: 0.12 };
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
      <span className={styles.posterDim} />
      <span className={styles.posterRim} data-rim="" />
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

type Slot = {
  id: string;
  clip: number;
  /** the wall: column and row */
  c: number;
  r: number;
  /** the sphere: latitude (down is positive) and longitude, in radians */
  lat: number;
  lon: number;
  tilt: { x: number; y: number; z: number };
};

/** The slider at the foot: zoom out, a hairline track with a knob, zoom in, and the level (click it to reset). */
function ZoomBar({
  min,
  max,
  ctl,
  knob,
  fill,
  read,
}: {
  min: number;
  max: number;
  ctl: RefObject<{ set: (z: number) => void; by: (f: number) => void; reset: () => void } | null>;
  knob: RefObject<HTMLSpanElement | null>;
  fill: RefObject<HTMLSpanElement | null>;
  read: RefObject<HTMLButtonElement | null>;
}) {
  const track = useRef<HTMLSpanElement>(null);
  const at = (x: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    const t = Math.max(0, Math.min(1, (x - r.left) / r.width));
    ctl.current?.set(Math.exp(Math.log(min) + t * (Math.log(max) - Math.log(min))));
  };
  return (
    <div className={styles.zoom} data-nodrag="">
      <button type="button" className={styles.zoomBtn} aria-label="Zoom out" onClick={() => ctl.current?.by(1 / ZOOM.step)}>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <span
        ref={track}
        className={styles.zoomTrack}
        role="presentation"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          at(e.clientX);
        }}
        onPointerMove={(e) => e.buttons & 1 && at(e.clientX)}
      >
        <span ref={fill} className={styles.zoomFill} />
        <span ref={knob} className={styles.zoomKnob} />
      </span>
      <button type="button" className={styles.zoomBtn} aria-label="Zoom in" onClick={() => ctl.current?.by(ZOOM.step)}>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <button ref={read} type="button" className={styles.zoomRead} aria-label="Reset zoom" onClick={() => ctl.current?.reset()}>
        100%
      </button>
    </div>
  );
}

export default function PosterWall({
  fmt,
  clips,
  paused,
  reduce,
  delay,
  preview = false,
  onOpen,
}: {
  fmt: FormatKey;
  clips: Clip[];
  /** a film or the menu is open over the room: it holds still */
  paused: boolean;
  reduce: boolean;
  /** seconds before the posters swing up (the index is still opening its film) */
  delay: number;
  /** shown behind something else (hero 3's index): it doesn't take the pointer and has no controls */
  preview?: boolean;
  onOpen: PosterOpen;
}) {
  const size = useSyncExternalStore(subscribeSize, () => `${window.innerWidth}x${window.innerHeight}`, () => "1440x900");
  const [vw, vh] = size.split("x").map(Number);
  const spec = SPECS[fmt];
  const f = FORMATS.find((x) => x.key === fmt) ?? FORMATS[0];
  const sphere = fmt === "beyond";
  const [zMin, zMax] = sphere ? ZOOM.sphere : ZOOM.wall;
  const zBase: number = sphere ? ZOOM.base.sphere : ZOOM.base.wall;
  const zHeld: number = sphere ? ZOOM.held.sphere : ZOOM.held.wall;

  // ---- the posters: on the wall, enough to cover the screen past its edges at the widest zoom; on the sphere, rows round it ----
  const geo = useMemo(() => {
    const small = vw <= 760;
    const gap = Math.max(10, vw * (small ? 0.03 : 0.014));
    const step = steps(clips.length);
    const tilt = (n: number) => ({
      x: (hash(n + 5) - 0.5) * 2 * CROOKED.xy,
      y: (hash(n + 9) - 0.5) * 2 * CROOKED.xy,
      z: (hash(n) - 0.5) * 2 * CROOKED.z,
    });
    const slots: Slot[] = [];
    if (sphere) {
      const R = vw * (small ? SPHERE.rSmall : SPHERE.r);
      const tw = Math.round(vw * (small ? SPHERE.tileSmall : SPHERE.tile));
      const th = Math.round(tw / spec.ratio);
      const dLat = (th + gap * 0.8) / R;
      const half = Math.floor(SPHERE.lat / dLat);
      for (let r = -half; r <= half; r++) {
        const lat = r * dLat;
        const n = Math.max(3, Math.floor((2 * Math.PI * R * Math.cos(lat)) / (tw + gap)));
        for (let i = 0; i < n; i++) {
          slots.push({
            id: `${r}:${i}`,
            c: i,
            r,
            clip: (((i * step.a + (r + half) * step.b) % clips.length) + clips.length) % clips.length,
            lat,
            lon: ((i + (r % 2 ? 0.5 : 0)) / n) * Math.PI * 2,
            tilt: { x: 0, y: 0, z: 0 },
          });
        }
      }
      return { tw, th, cellW: tw + gap, cellH: th + gap, cols: 0, rows: 0, R, slots };
    }
    const tw = Math.round(vw * (small ? spec.small : spec.desk));
    const th = Math.round(tw / spec.ratio);
    const cellW = tw + gap;
    const cellH = th + gap;
    const even = (n: number) => n + (n % 2);
    const reach = 1 / ZOOM.wall[0] + 0.12;
    const cols = even(Math.ceil((reach * vw) / cellW) + 2);
    const rows = even(Math.ceil((reach * vh) / cellH) + 2);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        slots.push({ id: `${c}-${r}`, c, r, clip: (c * step.a + r * step.b) % clips.length, lat: 0, lon: 0, tilt: tilt(c * 31 + r * 17) });
    return { tw, th, cellW, cellH, cols, rows, R: 0, slots };
  }, [vw, vh, spec, clips.length, sphere]);

  const [hovered, setHovered] = useState<string | null>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);
  const hairX = useRef<HTMLSpanElement>(null);
  const hairY = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const read = useRef<HTMLButtonElement>(null);
  const ctl = useRef<{ set: (z: number) => void; by: (f: number) => void; reset: () => void } | null>(null);
  const hoverRef = useRef<string | null>(null);
  const pausedRef = useRef(paused);
  const draggedRef = useRef(false);
  useEffect(() => {
    hoverRef.current = hovered;
  }, [hovered]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // ---- the loop: drift, throw, drag, pinch, zoom, curve, sway, lift, the entrance; every poster in sight placed ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const { tw, th, cellW, cellH, cols, rows, R, slots } = geo;
    const W = cols * cellW;
    const H = rows * cellH;
    const off = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    const sway = { x: 0, y: 0 };
    const pointer = { x: vw / 2, y: vh / 2, seen: false };
    const cross = { x: vw / 2, y: vh / 2 };
    const zoom = { now: zBase, to: zBase, shown: -1 };
    const lift = new Map<string, number>(); // 0..1 per poster, eased
    const shown = new Map<string, boolean>();
    const rims = new Map<string, HTMLElement | null>();
    let drift = 0;
    let speed = 0;
    let field = 0; // 0..1: the bulge round the pointer, up while the pointer is over the sphere and not dragging
    let dragging = false;
    let settled = reduce;
    const born = performance.now();
    let last = born;
    let raf = 0;
    let rect = root.getBoundingClientRect();
    // the eye's distance from the screen (the CSS perspective): the room comes toward it to zoom in
    const eye = parseFloat(getComputedStyle(root).perspective) || 1000;
    const clampZ = (z: number) => Math.max(zMin, Math.min(zMax, z));
    const wrap = (v: number, span: number) => (((v % span) + span) % span) - span / 2;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const rimOf = (id: string, el: HTMLElement) => {
      if (!rims.has(id)) rims.set(id, el.querySelector<HTMLElement>("[data-rim]"));
      return rims.get(id) ?? null;
    };
    const show = (id: string, el: HTMLElement, on: boolean) => {
      if (shown.get(id) === on) return;
      shown.set(id, on);
      el.style.visibility = on ? "" : "hidden";
    };

    ctl.current = {
      set: (z) => (zoom.to = clampZ(z)),
      by: (k) => (zoom.to = clampZ(zoom.to * k)),
      reset: () => (zoom.to = zBase),
    };

    const place = (now: number) => {
      const age = (now - born) / 1000 - delay;
      const dolly = eye * (1 - 1 / zoom.now);
      let entering = false;
      if (sphere) {
        // ---- the sphere: its centre a radius behind the screen; turned by the drag, tipped (a little) by it too ----
        const lon0 = off.x / R;
        const tip = Math.max(-SPHERE.tiltMax, Math.min(SPHERE.tiltMax, off.y / R));
        const st = Math.sin(tip);
        const ct = Math.cos(tip);
        const px0 = pointer.x - vw / 2;
        const py0 = pointer.y - vh / 2;
        const reach2 = (vw * ALIVE.reach) ** 2;
        for (const s of slots) {
          const el = slotRefs.current.get(s.id);
          if (!el) continue;
          const lon = s.lon + lon0;
          // how squarely it faces you: 1 at the centre, 0 at the rim, below that round the back
          const face = -Math.sin(s.lat) * st + Math.cos(s.lat) * Math.cos(lon) * ct;
          const on = face > 0.06;
          show(s.id, el, on);
          if (!on) continue;
          const l = lift.get(s.id) ?? 0;
          let p = 1;
          if (!settled) {
            p = Math.max(0, Math.min(1, (age - (1 - face) * SWING.spread * 1.4) / SWING.s));
            if (p < 1) entering = true;
          }
          const e = ease(p);
          // where it lands on the screen, to feel the pointer: its point on the sphere, seen from the eye
          let w = 0;
          if (field > 0.001) {
            const cl = Math.cos(s.lat);
            const nx = cl * Math.sin(lon);
            const ny = Math.sin(s.lat) * ct + cl * Math.cos(lon) * st;
            const k = eye / (eye - (dolly - R + R * face));
            const dx = R * nx * k - px0;
            const dy = R * ny * k - py0;
            w = field * Math.exp(-(dx * dx + dy * dy) / reach2);
          }
          const out = R * (1 + w * ALIVE.lift) + l * LIFT + (1 - e) * SWING.back * 1.6;
          el.style.transform = `translateZ(${(dolly - R).toFixed(1)}px) rotateX(${(-tip).toFixed(4)}rad) rotateY(${lon.toFixed(4)}rad) rotateX(${(-s.lat).toFixed(4)}rad) translateZ(${out.toFixed(1)}px) scale(${(1 + w * ALIVE.grow).toFixed(3)})`;
          if (!settled) el.style.opacity = String(Math.min(1, p * 1.8));
          const rim = rimOf(s.id, el);
          if (rim) rim.style.opacity = (Math.max(0, Math.min(0.6, (0.5 - face) * 1.2)) * (1 - w)).toFixed(2);
        }
      } else {
        // ---- the wall: curved round you, the posters in sight placed, the rest skipped ----
        const curve = CURVE + CURVE_FAST * speed;
        const z0 = zoom.now;
        const reachX = vw / 2 / z0 + tw;
        const reachY = vh / 2 / z0 + th;
        for (const s of slots) {
          const el = slotRefs.current.get(s.id);
          if (!el) continue;
          const u = wrap(s.c * cellW + off.x, W);
          const v = wrap(s.r * cellH + off.y, H);
          // in sight, and away from the seam where a poster wraps round to the far side
          const on =
            Math.abs(u) < Math.min(reachX * 1.08, W / 2 - cellW * 0.55) && Math.abs(v) < Math.min(reachY * 1.08, H / 2 - cellH * 0.55);
          show(s.id, el, on);
          if (!on) continue;
          const nx = u / (vw / 2);
          const ny = v / (vh / 2);
          const l = lift.get(s.id) ?? 0;
          const hang = 1 - l;
          let p = 1;
          if (!settled) {
            const dist = Math.min(1.4, Math.hypot(nx * 0.8, ny * 0.6));
            p = Math.max(0, Math.min(1, (age - dist * SWING.spread) / SWING.s));
            if (p < 1) entering = true;
          }
          const e = ease(p);
          // the curve is set by where a poster lands on the screen, so it holds as the wall zooms
          const sx = nx * z0;
          const sy = ny * z0;
          const rx = sy * curve * 0.8 + sway.y + s.tilt.x * hang + (1 - e) * SWING.from;
          const ry = -sx * curve + sway.x + s.tilt.y * hang;
          const rz = s.tilt.z * hang;
          const z = ((sx * sx * 0.65 + sy * sy * 0.35) * NEAR * vw) / z0 + l * LIFT + dolly - (1 - e) * SWING.back;
          el.style.transform = `translate3d(${u.toFixed(1)}px, ${v.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
          if (!settled) el.style.opacity = String(Math.min(1, p * 1.8));
        }
      }
      if (!settled && !entering && age > 0) {
        settled = true;
        slotRefs.current.forEach((el) => (el.style.opacity = "1"));
      }
    };

    // the slider at the foot follows the zoom
    const showZoom = () => {
      if (Math.abs(zoom.shown - zoom.now) < 0.0005) return;
      zoom.shown = zoom.now;
      const t = (Math.log(zoom.now) - Math.log(zMin)) / (Math.log(zMax) - Math.log(zMin));
      if (knob.current) knob.current.style.left = `${(t * 100).toFixed(2)}%`;
      if (fill.current) fill.current.style.transform = `scaleX(${t.toFixed(4)})`;
      if (read.current) read.current.textContent = `${Math.round((zoom.now / zBase) * 100)}%`;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const still = pausedRef.current;
      const held = hoverRef.current !== null;
      const age = (now - born) / 1000 - delay;
      // the slow drift waits for the posters to be up, and holds while one is pointed at
      const rolling = !(still || held || dragging || reduce || age < SWING.s);
      drift += ((rolling ? 1 : 0) - drift) * (1 - Math.exp(-dt * 1.6));
      if (!dragging) {
        const g = Math.exp(-GLIDE * dt);
        vel.x *= g;
        vel.y *= g;
        off.x += (vel.x + (sphere ? DRIFT * 1.6 * drift : 0)) * dt;
        off.y += (vel.y - (sphere ? 0 : DRIFT * drift)) * dt;
      }
      // the sphere only tips so far: past it, it eases back
      if (sphere) {
        const lim = SPHERE.tiltMax * R;
        if (Math.abs(off.y) > lim) {
          off.y += (Math.sign(off.y) * lim - off.y) * (1 - Math.exp(-dt * 8));
          if (!dragging) vel.y *= 0.8;
        }
      }
      // zoom follows its target, evenly in scale
      const kz = 1 - Math.exp(-dt * (reduce ? 1000 : ZOOM.rate));
      zoom.now = Math.exp(Math.log(zoom.now) + (Math.log(zoom.to) - Math.log(zoom.now)) * kz);
      if (Math.abs(zoom.now - zoom.to) < 0.0005) zoom.now = zoom.to;
      // the faster it goes, the more the posters lean into it
      const k = 1 - Math.exp(-dt * 5);
      const sp = reduce ? 0 : Math.min(1, Math.hypot(vel.x, vel.y) / TOP_SPEED);
      speed += (sp - speed) * k;
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      sway.x += ((reduce ? 0 : -clamp(vel.x / TOP_SPEED) * SWAY) - sway.x) * k;
      sway.y += ((reduce ? 0 : clamp(vel.y / TOP_SPEED) * SWAY) - sway.y) * k;
      // the poster under the pointer comes toward you and straightens; the one left goes back
      const kl = 1 - Math.exp(-dt * (reduce ? 1000 : 9));
      const target = hoverRef.current;
      if (target && !lift.has(target)) lift.set(target, 0);
      lift.forEach((v, id) => {
        const to = id === target ? 1 : 0;
        const nv = v + (to - v) * kl;
        if (to === 0 && nv < 0.002) lift.delete(id);
        else lift.set(id, nv);
      });
      const kf = 1 - Math.exp(-dt * (reduce ? 1000 : 4));
      field += ((sphere && pointer.seen && !dragging && !still && !reduce ? 1 : 0) - field) * kf;
      place(now);
      showZoom();
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
    showZoom();
    raf = requestAnimationFrame(frame);

    // ---- drag (mouse or finger) with a throw, which also pushes the room in; two fingers pinch ----
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { d0: number; z0: number } | null = null;
    const spread = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y) || 1;
    };
    let id = -1;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;
    let lt = 0;
    const endDrag = () => {
      id = -1;
      if (!dragging) return;
      dragging = false;
      root.classList.remove(styles.wallDragging);
    };
    const down = (e: PointerEvent) => {
      if ((e.pointerType === "mouse" && e.button !== 0) || pausedRef.current) return;
      if ((e.target as Element | null)?.closest("[data-nodrag]")) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        pinch = { d0: spread(), z0: zoom.to };
        draggedRef.current = true;
        endDrag();
        vel.x = vel.y = 0;
        return;
      }
      if (pts.size > 2) return;
      id = e.pointerId;
      sx = lx = e.clientX;
      sy = ly = e.clientY;
      lt = performance.now();
      draggedRef.current = false;
      vel.x = vel.y = 0;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
        if (!pointer.seen) {
          pointer.seen = true;
          cross.x = pointer.x;
          cross.y = pointer.y;
          root.classList.add(styles.hudOn);
        }
      }
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        zoom.to = clampZ((pinch.z0 * spread()) / pinch.d0);
        return;
      }
      if (e.pointerId !== id) return;
      if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
        dragging = true;
        draggedRef.current = true;
        root.classList.add(styles.wallDragging);
        root.setPointerCapture?.(id);
        setHovered(null);
        // grabbing the room pulls it in toward you, and it stays in
        if (!reduce) zoom.to = clampZ(Math.max(zoom.to, zHeld));
      }
      if (!dragging) return;
      const now = performance.now();
      // the room moves under the pointer at the scale it's shown at
      const dx = (e.clientX - lx) / zoom.now;
      const dy = (e.clientY - ly) / zoom.now;
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
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (e.pointerId !== id) return;
      const wasDragging = dragging;
      endDrag();
      if (!wasDragging) return;
      if (performance.now() - lt > 80) vel.x = vel.y = 0; // held still before letting go: no throw
      vel.x = Math.max(-4200, Math.min(4200, vel.x));
      vel.y = Math.max(-4200, Math.min(4200, vel.y));
    };
    const out = () => {
      pointer.seen = false;
      root.classList.remove(styles.hudOn);
    };
    // scroll moves the room; Ctrl/Cmd + scroll (and a trackpad pinch) zooms it
    const wheel = (e: WheelEvent) => {
      if (pausedRef.current) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 32 : 1;
      if (e.ctrlKey || e.metaKey) {
        zoom.to = clampZ(zoom.to * Math.exp(-e.deltaY * unit * 0.01));
        return;
      }
      // the room slides out from under the pointer: let go of the poster it was on
      if (hoverRef.current) setHovered(null);
      if (sphere) {
        // the sphere turns with either direction of scroll
        vel.x = Math.max(-3600, Math.min(3600, vel.x - (e.deltaY + e.deltaX) * unit * 6));
        return;
      }
      vel.x = Math.max(-3600, Math.min(3600, vel.x - e.deltaX * unit * 6));
      vel.y = Math.max(-3600, Math.min(3600, vel.y - e.deltaY * unit * 6));
    };
    const key = (e: KeyboardEvent) => {
      if (pausedRef.current || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "+" || e.key === "=") zoom.to = clampZ(zoom.to * ZOOM.step);
      else if (e.key === "-" || e.key === "_") zoom.to = clampZ(zoom.to / ZOOM.step);
      else if (e.key === "0") zoom.to = zBase;
    };
    const resize = () => (rect = root.getBoundingClientRect());
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointerleave", out);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    root.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      ctl.current = null;
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointerleave", out);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
      root.removeEventListener("wheel", wheel);
    };
  }, [geo, vw, vh, reduce, delay, sphere, zMin, zMax, zBase, zHeld]);

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
    const w = Math.min(vw * 0.5, vh * 0.5 * spec.ratio);
    const h = w / spec.ratio;
    onOpen(index, { top: (vh - h) / 2, left: (vw - w) / 2, width: w, height: h });
  };

  return (
    <motion.div
      ref={rootRef}
      className={`${styles.wall} ${sphere ? styles.wallSphere : ""} ${hovered ? styles.wallPointing : ""}`}
      style={{ "--tw": `${geo.tw}px`, "--th": `${geo.th}px`, pointerEvents: preview ? "none" : undefined } as CSSProperties}
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

      {!preview && <ZoomBar min={zMin} max={zMax} ctl={ctl} knob={knob} fill={fill} read={read} />}

      <ul className={styles.sr} hidden={preview}>
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
