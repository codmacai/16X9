"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BEYOND_CATEGORIES } from "../work/_shared/data";
import type { FormatKey } from "../hero13/formats";
import styles from "./hero2.module.css";

// hero 9: Beyond as a lit panel in a wall. No film: the screen becomes a wall of dark matte
// panels — drawn once, as a real surface: a fine brushed grain, recessed seams, each panel
// catching the light at its top, the room lit from above — and the tile in the middle, 16:9, our
// frame, set in the wall like the rest, lights white from a line across it. On it, with the line
// of words, one lockup: Beyond's categories in bold Arial, one after another, each set to the
// line's exact width and sitting right above it — each arriving close and huge, cropped by the
// tile's edges, and drawing back until it locks into place. The line turns with the tile under it
// (differenced: paper on the dark wall, ink on the lit tile). Clicking BEYOND the panel grows to the whole screen, and Beyond's page comes
// out from under it (work/beyond.tsx).
const N = BEYOND_CATEGORIES.length;
const HOLD_MS = 2300;
const ZOOM = [0.16, 1, 0.3, 1] as const;

export default function BeyondPanel({
  on,
  go,
  reduce,
  word,
}: {
  on: boolean;
  go: boolean;
  reduce: boolean;
  /** the line of words, so each category can be set to its width, right above it */
  word: RefObject<Partial<Record<FormatKey, HTMLElement | null>>>;
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

  // the lockup: where the line of words stands on the tile, and each category's size to match its
  // width (measured as it comes on, and again if the screen changes)
  const measureRef = useRef<HTMLSpanElement>(null);
  const [lock, setLock] = useState<{ x: number; y: number; sizes: number[] } | null>(null);
  useLayoutEffect(() => {
    if (!on) return;
    const m = measureRef.current;
    const a = word.current["16x9"];
    const z = word.current.beyond;
    if (!m || !a || !z) return;
    const fit = () => {
      const ra = a.getBoundingClientRect();
      const rz = z.getBoundingClientRect();
      const { cx, cy, pw, ph } = panelAt(window.innerWidth, window.innerHeight);
      const width = rz.right - ra.left;
      setLock({
        x: ra.left + width / 2 - (cx - (pw - 4) / 2),
        y: ra.top - ra.height * 0.14 - (cy - (ph - 4) / 2),
        sizes: [...m.children].map((el) => width / ((el as HTMLElement).offsetWidth / 100)),
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
      <div className={styles.panel}>
        <span ref={measureRef} className={styles.panelMeasure}>
          {BEYOND_CATEGORIES.map((k) => (
            <span key={k.short}>{k.short}</span>
          ))}
        </span>
        <AnimatePresence initial={false}>
          {lock && (
            <motion.span
              key={c.short}
              className={styles.panelWord}
              style={{ left: lock.x, top: lock.y, x: "-50%", y: "-100%", fontSize: lock.sizes[i] }}
              initial={reduce ? false : { scale: 2.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { scale: 0.86, opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={
                reduce ? { duration: 0 } : { scale: { duration: 1.7, ease: ZOOM }, opacity: { duration: 0.4, ease: "easeOut", delay: 0.18 } }
              }
            >
              {c.short}
            </motion.span>
          )}
        </AnimatePresence>
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
  float gap = 2.0 * uDpr;

  // the material: a dark, faintly warm grey, each panel a shade apart; a fine brushed grain
  float v = 0.15 + 0.018 * (hash(tile + 3.7) - 0.5);
  float px1 = 1.0 / uDpr;
  v += (noise(vec2(px.x * 0.004 * px1, px.y * 0.8 * px1)) - 0.5) * 0.016;
  v += (noise(vec2(px.x * 0.02 * px1, px.y * 1.6 * px1)) - 0.5) * 0.008;
  v += (hash(px) - 0.5) * 0.01;
  // each panel catching the light at its top, falling off down it
  v *= 1.0 + 0.2 * pow(1.0 - l.y / s.y, 1.6);
  // the room's light, from above the middle
  vec2 q = (px - vec2(uRes.x * 0.5, -uRes.y * 0.2)) / vec2(uRes.x * 0.62, uRes.y * 1.25);
  float key = exp(-dot(q, q) * 1.5);
  v *= 0.38 + 1.0 * key;
  // the lit tile's light, faint on the wall round it
  vec2 e = max(abs(px - c) - s * 0.5, 0.0);
  v += 0.03 * exp(-length(e) / s.y * 5.0);
  // the seams: recessed, a little shadow either side of them, the top edge of each panel lit
  v *= mix(0.7, 1.0, smoothstep(gap, gap + 9.0 * uDpr, d));
  v += 0.045 * smoothstep(gap + 1.6 * uDpr, gap + 0.4 * uDpr, l.y) * step(gap, l.y) * step(gap, min(l.x, s.x - l.x));
  v = mix(v, 0.02, 1.0 - smoothstep(gap - 0.8 * uDpr, gap + 0.2 * uDpr, d));

  gl_FragColor = vec4(vec3(v) * vec3(1.0, 0.985, 0.962), 1.0);
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
  const pw = vw <= vh ? vw * 0.9 : Math.min(vw * 0.58, vh * 1.5);
  const ph = (pw * 9) / 16;
  return { cx: w / 2, cy: h / 2 - ph * 0.1, pw, ph };
}

function WallSurface() {
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
