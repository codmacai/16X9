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
}: {
  on: boolean;
  go: boolean;
  reduce: boolean;
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
      <WallSurface />
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

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 c = uPanel.xy;
  vec2 s = uPanel.zw;
  // the panels: the size of the one in the middle, their seams running on from its edges
  vec2 g = (px - (c - s * 0.5)) / s;
  vec2 tile = floor(g);
  vec2 l = (g - tile) * s;
  float d = min(min(l.x, s.x - l.x), min(l.y, s.y - l.y));
  float gap = 1.0 * uDpr;
  float px1 = 1.0 / uDpr;

  // the material: a near-black matte, each panel a shade apart, the finest grain
  float v = 0.092 + 0.008 * (hash(tile + 3.7) - 0.5);
  v += (noise(vec2(px.x * 0.0025 * px1, px.y * 0.45 * px1)) - 0.5) * 0.007;
  v += (hash(px) - 0.5) * 0.007;
  // each panel a touch brighter at its top
  v *= 1.0 + 0.1 * pow(1.0 - l.y / s.y, 2.0);
  // a soft pool of light from above the middle; the rest of the room falling away to dark
  vec2 q = (px - vec2(uRes.x * 0.5, uRes.y * 0.08)) / vec2(uRes.x * 0.5, uRes.y * 0.95);
  float key = exp(-dot(q, q) * 1.4);
  v *= 0.3 + 1.05 * key;
  // the lit tile's light on the wall round it, warm and soft
  vec2 e = max(abs(px - c) - s * 0.5, 0.0);
  float spill = exp(-length(e) / s.y * 3.2);
  vec3 col = vec3(v) * vec3(1.0, 0.988, 0.97) + vec3(1.0, 0.965, 0.91) * spill * 0.05;
  // the seams: fine, a breath of shadow either side, the top edge of each panel just lit
  col *= mix(0.78, 1.0, smoothstep(gap, gap + 6.0 * uDpr, d));
  col += 0.025 * smoothstep(gap + 1.2 * uDpr, gap + 0.2 * uDpr, l.y) * step(gap, l.y) * step(gap, min(l.x, s.x - l.x));
  col = mix(col, vec3(0.012), 1.0 - smoothstep(gap - 0.6 * uDpr, gap + 0.2 * uDpr, d));

  gl_FragColor = vec4(col, 1.0);
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
  const pw = vw <= vh ? vw * 0.92 : Math.min(vw * 0.66, vh * 1.42);
  const ph = (pw * 9) / 16;
  return { cx: w / 2, cy: h / 2 - ph * 0.08, pw, ph };
}

export function WallSurface() {
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

    const draw = () => {
      if (!canvas.clientWidth) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      const { cx, cy, pw, ph } = panelAt(canvas.clientWidth, canvas.clientHeight);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform4f(uPanel, cx * dpr, cy * dpr, pw * dpr, ph * dpr);
      gl.uniform1f(uDpr, dpr);
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
  }, []);
  return <canvas ref={ref} className={styles.wallSurface} />;
}
