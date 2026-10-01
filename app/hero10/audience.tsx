import { memo } from "react";
import type { Room } from "./room";
import styles from "./hero10.module.css";

// ===========================================================================
// THE AUDIENCE — a row of people seen from behind, watching the screens.
// Each is a flat silhouette with a rim of light along the top of the head and
// shoulders, in the colour of the screen in front of them (CSS variables
// --c0/--c1/--c2, sampled from the films as they play). The light gradients
// use objectBoundingBox units, so one gradient per screen lights every head
// and every pair of shoulders from its own top edge.
// ===========================================================================

type Hair = "short" | "bun" | "long" | "cap" | "curly";
type Person = { cx: number; top: number; s: number; hair: Hair; screen: 0 | 1 | 2; tilt: number };

const HAIRS: Hair[] = ["short", "long", "cap", "bun", "short", "curly", "long", "short", "bun"];

function seat(room: Room): Person[] {
  const { count, y, scale } = room.audience;
  const span = room.W * (room.mode === "wide" ? 1.04 : 1.16);
  const start = (room.W - span) / 2;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    // a little irregular, like a real row: heights, spacing and lean vary
    const jitter = ((i * 37) % 11) / 10 - 0.5;
    const cx = start + i * step + jitter * step * 0.18;
    const s = scale * (0.92 + (((i * 53) % 7) / 7) * 0.2);
    const top = y + (((i * 29) % 5) - 2) * 9 * scale;
    const third = room.W / 3;
    const screen = (room.mode === "tall" ? 1 : cx < third ? 0 : cx < third * 2 ? 1 : 2) as 0 | 1 | 2;
    return { cx, top, s, hair: HAIRS[i % HAIRS.length], screen, tilt: (((i * 17) % 5) - 2) * 1.6 };
  });
}

/** One person's outline, in stage units: head, ears, and neck-and-shoulders, plus hair. */
function shapes(p: Person, floor: number) {
  const { cx, top: y0, s } = p;
  const at = (dx: number, dy: number) => `${(cx + dx * s).toFixed(1)},${(y0 + dy * s).toFixed(1)}`;
  const oval = (dx: number, dy: number, rx: number, ry: number) =>
    `M${at(dx - rx, dy)} a${rx * s},${ry * s} 0 1,0 ${2 * rx * s},0 a${rx * s},${ry * s} 0 1,0 ${-2 * rx * s},0 Z`;
  const head = oval(0, 39, 31, 39);
  const ears = oval(-30, 46, 6, 10) + oval(30, 46, 6, 10);
  const body =
    `M${at(-13, 66)} L${at(-15, 98)} C${at(-40, 104)} ${at(-92, 110)} ${at(-112, 134)} ` +
    `C${at(-128, 150)} ${at(-134, 185)} ${at(-136, 230)} L${(cx - 138 * s).toFixed(1)},${floor} ` +
    `L${(cx + 138 * s).toFixed(1)},${floor} L${at(136, 230)} C${at(134, 185)} ${at(128, 150)} ${at(112, 134)} ` +
    `C${at(92, 110)} ${at(40, 104)} ${at(15, 98)} L${at(13, 66)} Z`;
  let hair = "";
  if (p.hair === "bun") hair = oval(3, 2, 14, 13);
  if (p.hair === "long")
    hair = `M${at(-31, 30)} C${at(-38, 70)} ${at(-36, 112)} ${at(-26, 132)} L${at(26, 132)} C${at(36, 112)} ${at(38, 70)} ${at(31, 30)} Z`;
  if (p.hair === "cap") hair = `M${at(-34, 32)} a${34 * s},${31 * s} 0 1,1 ${68 * s},0 Z`;
  if (p.hair === "curly") hair = oval(0, 37, 38, 42);
  return [head, ears, body, hair].filter(Boolean);
}

const Audience = memo(function Audience({ room }: { room: Room }) {
  const people = seat(room);
  const floor = room.H + 40;
  return (
    <svg className={styles.audience} viewBox={`0 0 ${room.W} ${room.H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        {/* each person is lit from the top: brightest on the head, fading down the shoulders */}
        {people.map((p, i) => (
          <linearGradient
            key={i}
            id={`rim-${i}`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={p.top - 6 * p.s}
            x2="0"
            y2={p.top + 200 * p.s}
          >
            <stop offset="0" style={{ stopColor: `rgb(var(--c${p.screen}))`, stopOpacity: `calc(0.95 * var(--g${p.screen}))` }} />
            <stop offset="0.24" style={{ stopColor: `rgb(var(--c${p.screen}))`, stopOpacity: `calc(0.5 * var(--g${p.screen}))` }} />
            <stop offset="0.52" style={{ stopColor: `rgb(var(--c${p.screen}))`, stopOpacity: `calc(0.32 * var(--g${p.screen}))` }} />
            <stop offset="0.85" style={{ stopColor: `rgb(var(--c${p.screen}))`, stopOpacity: 0 }} />
          </linearGradient>
        ))}
      </defs>
      {people.map((p, i) => {
        const parts = shapes(p, floor);
        return (
          <g
            key={i}
            className={styles.person}
            style={{ animationDuration: `${5 + (i % 4) * 1.3}s`, animationDelay: `${-i * 0.9}s` }}
          >
            <g className={`${styles.lean} ${i % 4 === 1 ? styles.glance : ""}`} style={{ rotate: `${p.tilt}deg` }}>
              {/* the rim: every part stroked in the light, then the silhouette filled over it,
                  so only a thin halo shows outside the outline and no inner edges */}
              {parts.map((d, k) => (
                <path key={`r${k}`} d={d} fill="none" stroke={`url(#rim-${i})`} strokeWidth={5 * p.s} strokeLinejoin="round" />
              ))}
              {parts.map((d, k) => (
                <path key={`f${k}`} d={d} className={styles.personFill} />
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
});

export default Audience;
