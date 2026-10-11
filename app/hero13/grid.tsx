"use client";

import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import { FORMATS, Ratio, type FormatKey } from "./formats";
import { EASE, EASE_CINE } from "./index-stage";
import styles from "./home.module.css";

// ===========================================================================
// THE SCREENING ROOM — a format's films, on the paper, on a dome. The tiles,
// all in the format's proportion, lie on the face of a great sphere that
// bulges out toward you: the film at the centre faces you, the rest curve
// away and fade into the paper as they turn. Drag (or scroll) and the dome
// turns like a globe; let go and it glides on, then settles into a slow
// drift. It breathes: the faster it turns, the more it bulges, and it
// relaxes as it settles. It leans a little toward the pointer, like a glass
// ball in the hand. Opening a room, the flat sheet swells into the dome.
// The brand sits at the front, in a frame of the format's shape. Pointing at
// a film holds the dome, brings the film into colour and plays it; clicking
// it opens the film.
//
// One loop places every tile with a transform (and an opacity at the rim):
// nothing re-renders while the dome turns, and only the film under the
// pointer has a <video>.
// ===========================================================================

type Spec = { ratio: number; desk: number; small: number };
const SPECS: Record<FormatKey, Spec> = {
  // tile width as a fraction of the screen's width, on a wide screen and on a phone
  "16x9": { ratio: 16 / 9, desk: 0.22, small: 0.6 },
  "9x16": { ratio: 9 / 16, desk: 0.12, small: 0.34 },
  beyond: { ratio: 2.39, desk: 0.3, small: 0.78 },
};
const CAPTION = 30; // the line under each tile, px
const DRIFT = { x: -12, y: -7 }; // px per second along the surface, when nothing else moves it
const GLIDE = 3.2; // how quickly a throw settles (per second)
// The dome: its radius as a share of the screen's width (wide screen, phone),
// how much more it bulges at full speed, how far round it shows films
// (radians from the front) and where they start to fade into the paper.
const DOME = { desk: 0.78, small: 1.15, swell: 0.55, edge: 1.15, fade: 0.62 };
const LEAN = 4; // degrees the dome leans toward the pointer
const SWELL_S = 1.5; // the flat sheet swells into the dome as a room opens

// These films are scope pictures with black bars baked into a 16:9 file;
// the tiles zoom past the bars (except Beyond's, which crop them already).
const SCOPE = new Set(["clip-02", "clip-03", "clip-05", "clip-07", "clip-09", "clip-11", "clip-13", "clip-15"]);
const nameOf = (src: string) => src.replace(/^.*\/([^/]+)\.mp4$/i, "$1");
const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");

const subscribeSize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

export type TileOpen = (index: number, el: HTMLElement) => void;

const Tile = memo(function Tile({
  clip,
  index,
  fmt,
  on,
  onEnter,
  onLeave,
  onOpen,
}: {
  clip: Clip;
  index: number;
  fmt: FormatKey;
  on: boolean;
  onEnter: () => void;
  onLeave: () => void;
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
      onPointerEnter={(e) => e.pointerType === "mouse" && onEnter()}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        setPlaying(false);
        onLeave();
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
  /** a film or the menu is open over the room: the field holds still */
  paused: boolean;
  reduce: boolean;
  onOpen: TileOpen;
}) {
  const size = useSyncExternalStore(subscribeSize, () => `${window.innerWidth}x${window.innerHeight}`, () => "1440x900");
  const [vw, vh] = size.split("x").map(Number);
  const spec = SPECS[fmt];
  const f = FORMATS.find((x) => x.key === fmt) ?? FORMATS[0];

  // ---- the field: enough slots to cover the dome as far round as it shows films, plus a seam ----
  const geo = useMemo(() => {
    const small = vw <= 760;
    const gap = Math.max(14, vw * (small ? 0.04 : 0.018));
    const tw = Math.round(vw * (small ? spec.small : spec.desk));
    const th = Math.round(tw / spec.ratio);
    const cellW = tw + gap;
    const cellH = th + CAPTION + gap;
    const R = vw * (small ? DOME.small : DOME.desk);
    // the seam (where a slot wraps round) must sit past the rim, out of sight
    const even = (n: number) => n + (n % 2);
    const cols = even(Math.ceil((2 * DOME.edge * R) / cellW) + 2);
    const rows = even(Math.ceil((2 * DOME.edge * R) / cellH) + 2);
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
          dist: Math.min(1, Math.hypot(u / vw, v / vh) * 1.2),
        });
      }
    return { tw, th, cellW, cellH, cols, rows, R, slots };
  }, [vw, vh, spec, clips.length]);

  const [hovered, setHovered] = useState<string | null>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);
  const domeRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef(false);
  const pausedRef = useRef(paused);
  const draggedRef = useRef(false);
  useEffect(() => {
    holdRef.current = hovered !== null;
  }, [hovered]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // ---- the loop: drift, throw, drag, lean, breath; every tile placed on the dome ----
  useEffect(() => {
    const root = rootRef.current;
    const dome = domeRef.current;
    if (!root || !dome) return;
    const { cellW, cellH, cols, rows, R: R0, slots } = geo;
    const W = cols * cellW;
    const H = rows * cellH;
    const off = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    const lean = { x: 0, y: 0 };
    const pointer = { x: vw / 2, y: vh / 2 };
    let drift = reduce ? 0 : 1;
    let dragging = false;
    let swell = 0; // extra bulge from speed, eased
    const born = performance.now();
    let last = born;
    let raf = 0;
    let prev = "";
    const shown = new Map<string, boolean>();
    const wrap = (v: number, span: number) => (((v % span) + span) % span) - span / 2;

    const place = (kappa: number) => {
      const R = 1 / kappa;
      dome.style.transform = `translateZ(${(-R).toFixed(1)}px) rotateX(${lean.y.toFixed(3)}deg) rotateY(${lean.x.toFixed(3)}deg)`;
      for (const s of slots) {
        const el = slotRefs.current.get(s.id);
        if (!el) continue;
        // where the slot lies on the flat sheet, measured from the front of the dome
        const u = wrap(s.c * cellW + off.x + W / 2, W);
        const v = wrap(s.r * cellH + off.y + H / 2, H);
        const ax = u * kappa;
        const ay = v * kappa;
        const d = Math.hypot(ax, ay);
        const on = d < DOME.edge;
        if (shown.get(s.id) !== on) {
          shown.set(s.id, on);
          el.style.visibility = on ? "" : "hidden";
        }
        if (!on) continue;
        el.style.transform = `rotateY(${ax.toFixed(4)}rad) rotateX(${(-ay).toFixed(4)}rad) translateZ(${R.toFixed(1)}px)`;
        // turning away, it fades into the paper
        const t = Math.min(1, Math.max(0, (d - DOME.fade) / (DOME.edge - DOME.fade)));
        el.style.opacity = (1 - t * t * (3 - 2 * t)).toFixed(3);
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const still = pausedRef.current;
      drift += ((still || holdRef.current || dragging || reduce ? 0 : 1) - drift) * (1 - Math.exp(-dt * 2.5));
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
      // the dome breathes with its speed, and swells out of a flat sheet as the room opens
      const speed = Math.min(1, Math.hypot(vel.x, vel.y) / 2200);
      swell += (speed - swell) * (1 - Math.exp(-dt * 4));
      const open = reduce ? 1 : Math.min(1, (now - born) / 1000 / SWELL_S);
      const grow = 1 - Math.pow(1 - open, 3);
      const kappa = Math.max(1e-5, (grow * (1 + DOME.swell * swell)) / R0);
      const key = `${off.x.toFixed(1)},${off.y.toFixed(1)},${lean.x.toFixed(2)},${lean.y.toFixed(2)},${kappa.toExponential(4)}`;
      if (key !== prev) {
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

  const open = (index: number, el: HTMLElement) => {
    if (draggedRef.current) return; // that was a drag, not a click
    onOpen(index, el);
  };

  return (
    <motion.div
      ref={rootRef}
      className={styles.grid}
      style={{ "--tw": `${geo.tw}px`, "--sh": `${geo.th + CAPTION}px`, "--ratio": String(spec.ratio) } as CSSProperties}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.5, ease: EASE, delay: reduce ? 0 : 0.15 } }}
      aria-label={`${f.label}: ${f.line}`}
    >
      {/* the dome: its centre lies a radius behind the screen; each film is turned out onto its face */}
      <div ref={domeRef} className={styles.dome}>
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
            {/* each tile settles in from the centre outward, and leaves the same way */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.15 + s.dist * 0.55, duration: 0.9, ease: EASE } }}
              exit={{ opacity: 0, y: -14, transition: { delay: (1 - s.dist) * 0.2, duration: 0.35, ease: EASE_CINE } }}
            >
              <Tile
                clip={clip}
                index={s.clip}
                fmt={fmt}
                on={on}
                onEnter={() => setHovered(s.id)}
                onLeave={() => setHovered((h) => (h === s.id ? null : h))}
                onOpen={open}
              />
              <span className={styles.cap}>
                <span>{clip.title}</span>
                <span>{clip.duration}</span>
              </span>
            </motion.div>
          </div>
        );
      })}
      </div>

      {/* the paper closes in softly at the edges */}
      <div className={styles.gridFade} aria-hidden="true" />

      {/* the brand at the centre, in a frame of the format's shape */}
      <CentreMark fmt={fmt} label={f.line} reduce={reduce} />
    </motion.div>
  );
}

const EDGES = ["top", "right", "bottom", "left"] as const;

function CentreMark({ fmt, label, reduce }: { fmt: FormatKey; label: string; reduce: boolean }) {
  const f = FORMATS.find((x) => x.key === fmt) ?? FORMATS[0];
  return (
    <div className={`${styles.mark} ${styles[`mark_${fmt.replace("x", "by")}`]}`} aria-hidden="true">
      {fmt !== "beyond" &&
        EDGES.map((side, i) => {
          const across = side === "top" || side === "bottom";
          return (
            <motion.span
              key={side}
              className={`${styles.introEdge} ${styles[`introEdge_${side}`]}`}
              initial={reduce ? false : across ? { scaleX: 0 } : { scaleY: 0 }}
              animate={across ? { scaleX: 1 } : { scaleY: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={{ delay: 0.35 + i * 0.12, duration: 0.4, ease: EASE_CINE }}
            />
          );
        })}
      {fmt === "beyond" &&
        (["tl", "tr", "bl", "br"] as const).map((c) => (
          <motion.span
            key={c}
            className={`${styles.markCorner} ${styles[`finder_${c}`]}`}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.4, duration: 0.6 } }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          />
        ))}
      <motion.span
        className={styles.markInner}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.7, duration: 0.8, ease: EASE } }}
        exit={{ opacity: 0, transition: { duration: 0.25 } }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className={styles.markLogo} />
        <span className={styles.markLabel}>
          <span>
            <Ratio text={f.label} className={styles.fmtX} />
          </span>
          <i>{label}</i>
        </span>
      </motion.span>
    </div>
  );
}
