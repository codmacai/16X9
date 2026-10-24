"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./hero2.module.css";

// hero 8: the smoke in the middle, alive, and kept minimal: a slim ribbon of mist just behind the
// line of words, no taller than it needs to hold them, drawn every frame (a small WebGL shader) —
// its wisps curling slowly through each other and drifting sideways, lit warm-white where it's
// dense, thinning to a few tendrils at its ends. As a format
// is pointed at it unfurls from a hairline across the middle — the frame opening from a line —
// and folds back into the line as it goes. It runs only while it shows, drawn at half size
// (smoke is soft; it upscales cleanly). Without WebGL it falls back to the drifting stills.

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uOpen; // 0: a hairline, 1: unfurled

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
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  // narrow screens: the band keeps its height in proportion to the width
  float k = min(1.0, asp / 1.2);
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime * 0.6;

  // the flow: two warps of the noise by itself, each turning slowly, so the wisps curl
  vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t * 0.03)), fbm(p * 1.3 + vec2(5.2, 1.3) - vec2(t * 0.025, 0.0)));
  vec2 r = vec2(fbm(p * 1.8 + 3.2 * q + vec2(1.7, 9.2) + t * 0.045), fbm(p * 1.8 + 3.2 * q + vec2(8.3, 2.8) - t * 0.035));
  float d = fbm(p * 2.2 + 2.8 * r + vec2(t * 0.05, 0.0));

  // the band through the middle, its edge rolling, opening from a hairline
  float py = p.y + (fbm(p * 1.1 + vec2(t * 0.02, 3.0)) - 0.5) * 0.07 * uOpen;
  float h = mix(0.004, 0.068 * k, uOpen);
  float w = mix(0.12, 0.34 * asp, uOpen);
  float across = exp(-pow(abs(p.x) / w, 3.0));
  float core = exp(-pow(py / h, 2.0)) * across;
  float halo = exp(-pow(py / (h * 1.8), 2.0)) * exp(-pow(abs(p.x) / (w * 1.18), 2.4));

  // dense where the noise gathers, a few tendrils reaching out beyond the core
  float dens = core * (0.8 + 1.1 * (d - 0.35)) + halo * smoothstep(0.6, 0.9, d) * 0.25;
  dens = max(dens, 0.0);
  float alpha = 1.0 - exp(-dens * 2.4);

  // lit from the front: brighter on the ridges, a little shade in the folds
  float lit = mix(0.74, 1.0, smoothstep(0.3, 0.75, d));
  vec3 col = vec3(0.965, 0.952, 0.93) * lit;
  alpha *= smoothstep(0.0, 0.18, uOpen);
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

// out quick, settling slow; folding back a little quicker than it opens
const OPEN_S = 1.9;
const CLOSE_S = 0.7;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 4);

export default function LiveSmoke({ on, still }: { on: boolean; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const onRef = useRef(on);
  const wake = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onRef.current = on;
    wake.current();
  }, [on]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    const vs = gl && compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = gl && compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!gl || !vs || !fs) {
      // no WebGL: the stills instead
      setFailed(true);
      return;
    }
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
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uOpen = gl.getUniformLocation(prog, "uOpen");

    // drawn at half the screen's size (smoke is soft), a little more on small screens
    const size = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const s = w < 700 ? 0.7 : 0.5;
      canvas.width = Math.max(1, Math.round(w * s));
      canvas.height = Math.max(1, Math.round(h * s));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    size();
    const ro = new ResizeObserver(() => {
      size();
      draw();
    });
    ro.observe(canvas);

    let open = 0; // how far unfurled, 0..1 (eased)
    let x = 0; // the eased value's own clock, 0..1
    let time = 40; // a moment into the flow, so it starts already moving
    let last = 0;
    let raf = 0;

    const draw = () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (open <= 0) return;
      gl.uniform1f(uTime, time);
      gl.uniform1f(uOpen, open);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (onRef.current) x = Math.min(1, x + dt / OPEN_S);
      else x = Math.max(0, x - dt / CLOSE_S);
      open = still ? (onRef.current ? 1 : 0) : onRef.current ? easeOut(x) : 1 - easeOut(1 - x);
      if (!still) time += dt;
      draw();
      // asleep once folded away, or (reduced motion) once drawn
      if ((!onRef.current && x <= 0) || (still && dt > 0)) {
        raf = 0;
        last = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    wake.current = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    wake.current();

    return () => {
      cancelAnimationFrame(raf);
      wake.current = () => {};
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [still]);

  if (failed)
    return (
      <div className={`${styles.smoke7} ${on ? styles.smoke7On : ""}`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.smoke7A} src="/hero7/smoke-a.webp" alt="" draggable={false} decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.smoke7B} src="/hero7/smoke-b.webp" alt="" draggable={false} decoding="async" />
      </div>
    );
  return <canvas ref={ref} className={styles.liveSmoke} aria-hidden="true" />;
}
