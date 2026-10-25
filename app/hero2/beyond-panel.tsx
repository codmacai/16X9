"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BEYOND_CATEGORIES } from "../work/_shared/data";
import type { FormatKey } from "../hero13/formats";
import styles from "./hero2.module.css";

// hero 9: Beyond as a lit tile in a gallery wall. No film. The screen becomes a wall of near-black
// matte panels — drawn once, as a real surface: fine seams just catching the light, a soft pool
// of light from above — and the tile in the middle, 16:9, our frame, set in the wall like the rest,
// lights from a line across it, a warm white, its light faint on the wall round it. As it lights,
// the line of words resets itself in the tile's type (CSS, .stagePanel) and steps back: each word
// sinks into its mask and rises again drawn in a hairline outline — the others fainter, BEYOND in
// its corners — still where it was, still answering the pointer, so the formats can be gone back
// and forth between. The category is the tile's headline: in regular Arial, a size up from the
// line and over it, on its left edge, with clear air between them — each coming into focus as it
// draws back into place, the one before dissolving. As on a museum label: what the category covers
// small at the tile's head, and its number; at its foot,
// five hairlines, the current one drawing across as it holds. Pointing anywhere on the tile keeps
// it lit, and a click on it goes into Beyond — the tile grows to the whole screen, and Beyond's
// page comes out from under it (work/beyond.tsx).
const N = BEYOND_CATEGORIES.length;
const HOLD_MS = 2600;
const FOCUS = [0.16, 1, 0.3, 1] as const;
const pad2 = (n: number) => String(n).padStart(2, "0");

export default function BeyondPanel({
  on,
  go,
  reduce,
  word,
  onEnter,
  onLeave,
  onOpen,
  light = false,
}: {
  on: boolean;
  go: boolean;
  reduce: boolean;
  /** hero 10: the wall white */
  light?: boolean;
  /** the line of words, so the category can be set on it */
  word: RefObject<Partial<Record<FormatKey, HTMLElement | null>>>;
  /** the tile, pointed at and left, and clicked: it holds the preview open, and goes in */
  onEnter: () => void;
  onLeave: () => void;
  onOpen: () => void;
}) {
  const [i, setI] = useState(0);
  // the categories, one after another, while it's on; going in, the one showing stays; from the
  // first again each time it comes on
  const live = on || go;
  const [was, setWas] = useState(live);
  if (live !== was) {
    setWas(live);
    if (!live) setI(0);
  }
  useEffect(() => {
    if (!on || reduce) return;
    const id = window.setInterval(() => setI((k) => (k + 1) % N), HOLD_MS);
    return () => window.clearInterval(id);
  }, [on, reduce]);

  // the category set over the line of words, the tile's headline: on the line's left edge, a size
  // up from it, with clear air between them (smaller where a long one would run past the tile),
  // measured as it comes on and again if the screen changes
  const measureRef = useRef<HTMLSpanElement>(null);
  const [lock, setLock] = useState<{ x: number; y: number; sizes: number[] } | null>(null);
  useLayoutEffect(() => {
    if (!on) return;
    const m = measureRef.current;
    const a = word.current["16x9"];
    if (!m || !a) return;
    const fit = () => {
      const ra = a.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(a).fontSize) || 60;
      const { cx, cy, pw, ph } = panelAt(window.innerWidth, window.innerHeight);
      const x = ra.left - (cx - pw / 2);
      const room = pw - x - pw * 0.045;
      setLock({
        x,
        y: ra.top - ra.height * 0.42 - (cy - ph / 2),
        sizes: [...m.children].map((el) => Math.min(fs * 1.3, room / ((el as HTMLElement).offsetWidth / 100))),
      });
    };
    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [on, word]);

  const c = BEYOND_CATEGORIES[i];
  return (
    <div className={`${styles.wall} ${on || go ? styles.wallOn : ""} ${go ? styles.wallGo : ""}`} aria-hidden="true">
      <WallSurface light={light} />
      <div className={styles.panel} onPointerEnter={onEnter} onPointerLeave={onLeave} onClick={onOpen}>
        <span ref={measureRef} className={styles.panelMeasure}>
          {BEYOND_CATEGORIES.map((k) => (
            <span key={k.short}>{k.short}</span>
          ))}
        </span>

        {/* at its head, as on a label: what the category covers, and its number */}
        <span className={styles.panelHead}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={c.short}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: FOCUS, delay: 0.1 } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              {c.did.join(" · ")}
            </motion.span>
          </AnimatePresence>
          <span>
            {pad2(i + 1)} / {pad2(N)}
          </span>
        </span>

        {/* the category, coming into focus as it draws back into place on the line, once the one
            before has dissolved */}
        <AnimatePresence mode="wait" initial={false}>
          {lock && (
            <motion.span
              key={c.short}
              className={styles.panelWord}
              style={{ left: lock.x, top: lock.y, y: "-100%", fontSize: lock.sizes[i] }}
              initial={reduce ? false : { scale: 1.32, opacity: 0, filter: "blur(14px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { scale: 0.985, opacity: 0, filter: "blur(6px)", transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { scale: { duration: 1.5, ease: FOCUS }, filter: { duration: 1.1, ease: FOCUS }, opacity: { duration: 0.6, ease: "easeOut" } }
              }
            >
              {c.short}
            </motion.span>
          )}
        </AnimatePresence>

        {/* at its foot, five hairlines: those shown, and the one showing drawing across as it holds */}
        <span className={styles.panelTicks}>
          {BEYOND_CATEGORIES.map((k, n) => (
            <i key={n === i ? `${k.short}-on` : k.short} data-state={n < i ? "past" : n === i ? "on" : undefined} />
          ))}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The wall itself, drawn once (and again only if the screen changes size) at the screen's full
// resolution, round wherever the panel stands. Without WebGL, the wall's CSS ground stands in.
const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FRAG = `
precision highp float;
uniform vec2 uRes;   // device px
uniform vec4 uPanel; // the panel: centre x, centre y (from the top), width, height, device px
uniform float uDpr;
uniform float uLight; // 0: the near-black matte; 1: a white one, its grain stronger, its seams grey
uniform float uLit;   // 1: the tile in the middle is lit, or a screen — its light (or shadow) round it

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    f += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return f;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = px / uRes.y; // in screen heights, from the top
  vec2 c = uPanel.xy;
  vec2 s = uPanel.zw;
  // the panels: the size of the one in the middle, their seams running on from its edges
  vec2 g = (px - (c - s * 0.5)) / s;
  vec2 tile = floor(g);
  vec2 l = (g - tile) * s;
  float d = min(min(l.x, s.x - l.x), min(l.y, s.y - l.y));
  float gap = 1.2 * uDpr;

  // the material: a fine plaster, near-black (or white) — clouded a little as a troweled finish
  // is, each panel cast apart from the next, a fine tooth over it all
  float cloud = fbm(uv * 3.2 + tile * 3.71);
  float tooth = fbm(uv * 55.0);
  float v = mix(0.12, 0.93, uLight);
  v *= 1.0 + mix(0.22, 0.06, uLight) * (cloud - 0.5) + mix(0.1, 0.035, uLight) * (tooth - 0.5);
  v *= 1.0 + mix(0.06, 0.018, uLight) * (hash(tile + 3.7) - 0.5);
  v += (hash(px) - 0.5) * mix(0.006, 0.03, uLight);

  // the light: a row of wall-washers above, each throwing its arc down the wall — a crisp curved
  // top, the light widening and falling away as it comes down — over a low fill
  float wash = 0.0;
  for (int k = -5; k <= 5; k++) {
    float dx = uv.x - (uRes.x * 0.5 / uRes.y + float(k) * 0.5);
    float y = uv.y;
    float cone = exp(-dx * dx / (0.012 + 0.16 * y * y));
    float top = smoothstep(0.0, 0.09, y - 0.01 - 1.4 * dx * dx);
    wash += cone * top * exp(-y * 0.85);
  }
  // the room's fill: brightest high in the middle, falling off to the sides
  vec2 q = (uv - vec2(uRes.x * 0.5 / uRes.y, 0.3)) / vec2(uRes.x / uRes.y * 0.75, 0.9);
  float fill = exp(-dot(q, q));
  float light = mix(0.26 + 0.34 * fill + 0.8 * wash, 0.8 + 0.08 * fill + 0.16 * wash, uLight);
  // the wall darkening into the ceiling and the floor
  light *= mix(mix(0.55, 0.88, uLight), 1.0, smoothstep(0.0, 0.1, uv.y));
  light *= mix(mix(0.5, 0.84, uLight), 1.0, smoothstep(1.0, 0.72, uv.y));
  // the light warm, the fill a touch cooler
  vec3 tint = mix(vec3(0.94, 0.96, 1.0), vec3(1.0, 0.96, 0.9), clamp(wash, 0.0, 1.0));
  tint = mix(tint, vec3(1.0, 0.99, 0.97), uLight * 0.7);
  vec3 col = vec3(v * light) * tint;

  // the lit tile's light on the wall round it, warm and soft
  vec2 e = max(abs(px - c) - s * 0.5, 0.0);
  float spill = exp(-length(e) / s.y * 3.2);
  col += vec3(1.0, 0.965, 0.91) * spill * mix(0.045, 0.01, uLight) * uLit;
  // the screen (or the lit tile) set a little proud of the wall: its shadow soft round it,
  // falling a little below
  vec2 e2 = max(abs(px - c - vec2(0.0, s.y * 0.03)) - s * 0.5, 0.0);
  col *= 1.0 - uLit * mix(0.35, 0.16, uLight) * exp(-length(e2) / (s.y * 0.05));

  // the seams: a fine groove, the light falling into it; the panel's top edge catching the light
  // above, its foot in the groove's shadow, its sides a breath darker
  float lip = smoothstep(gap + 2.5 * uDpr, gap, l.y) * step(gap, l.y);
  float foot = smoothstep(s.y - gap - 5.0 * uDpr, s.y - gap, l.y);
  float side = smoothstep(gap + 4.0 * uDpr, gap, min(l.x, s.x - l.x));
  col *= 1.0 + mix(0.55, 0.06, uLight) * lip * light - mix(0.3, 0.1, uLight) * foot - mix(0.18, 0.06, uLight) * side;
  col = mix(col, col * mix(0.12, 0.62, uLight), 1.0 - smoothstep(gap - 0.6 * uDpr, gap + 0.3 * uDpr, d));

  gl_FragColor = vec4(col + (hash(px + 7.0) - 0.5) / 255.0, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

// where the panel stands at rest — as the CSS sets it (.wall: --pw, --ph, --lift), in px
function panelAt(w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = vw <= vh ? vw * 0.92 : Math.min(vw * 0.74, vh * 1.5);
  const ph = (pw * 9) / 16;
  return { cx: w / 2, cy: h / 2 - ph * 0.08, pw, ph };
}

type Geo = (w: number, h: number) => { cx: number; cy: number; pw: number; ph: number };

/** the wall, its tiles the size of `at`'s (the Beyond tile's by default), their seams running on from
 *  its edges; `light`, the white wall (hero 10); `lit` false, nothing in the middle tile, so no
 *  light (or shadow) round it */
export function WallSurface({ at = panelAt, light = false, lit = true }: { at?: Geo; light?: boolean; lit?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, preserveDrawingBuffer: true });
    const vs = gl && compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = gl && compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!gl || !vs || !fs) return; // no WebGL: the wall's CSS ground
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uPanel = gl.getUniformLocation(prog, "uPanel");
    const uDpr = gl.getUniformLocation(prog, "uDpr");
    const uLight = gl.getUniformLocation(prog, "uLight");
    const uLit = gl.getUniformLocation(prog, "uLit");

    const draw = () => {
      if (!canvas.clientWidth) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      const { cx, cy, pw, ph } = at(canvas.clientWidth, canvas.clientHeight);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform4f(uPanel, cx * dpr, cy * dpr, pw * dpr, ph * dpr);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uLight, light ? 1 : 0);
      gl.uniform1f(uLit, lit ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.dataset.drawn = "";
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [at, light, lit]);
  return <canvas ref={ref} className={styles.wallSurface} />;
}
