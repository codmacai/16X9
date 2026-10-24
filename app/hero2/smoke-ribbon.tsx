"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./hero2.module.css";

// hero 8: the smoke in the middle, kept minimal and still: a slim ribbon of mist just behind the
// line of words, no taller than it needs to hold them — its wisps lit warm-white where they're
// dense, thinning to a few tendrils at its ends. Nothing in it moves: it's drawn once (a small
// WebGL shader, so it fits any screen's shape, and again only if the screen changes size) and
// simply fades in and out with the films. Without WebGL it falls back to the hero 7 stills.

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;

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
  const float t = 24.0; // one moment of the smoke, held

  // the noise warped twice by itself, so the wisps curl
  vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t * 0.03)), fbm(p * 1.3 + vec2(5.2, 1.3) - vec2(t * 0.025, 0.0)));
  vec2 r = vec2(fbm(p * 1.8 + 3.2 * q + vec2(1.7, 9.2) + t * 0.045), fbm(p * 1.8 + 3.2 * q + vec2(8.3, 2.8) - t * 0.035));
  float d = fbm(p * 2.2 + 2.8 * r + vec2(t * 0.05, 0.0));

  // the band through the middle, its edge rolling a little
  float py = p.y + (fbm(p * 1.1 + vec2(t * 0.02, 3.0)) - 0.5) * 0.07;
  float h = 0.068 * k;
  float w = 0.34 * asp;
  float core = exp(-pow(py / h, 2.0)) * exp(-pow(abs(p.x) / w, 3.0));
  float halo = exp(-pow(py / (h * 1.8), 2.0)) * exp(-pow(abs(p.x) / (w * 1.18), 2.4));

  // dense where the noise gathers, a few tendrils reaching out beyond the core
  float dens = max(core * (0.8 + 1.1 * (d - 0.35)) + halo * smoothstep(0.6, 0.9, d) * 0.25, 0.0);
  float alpha = 1.0 - exp(-dens * 2.4);

  // lit from the front: brighter on the ridges, a little shade in the folds
  vec3 col = vec3(0.965, 0.952, 0.93) * mix(0.74, 1.0, smoothstep(0.3, 0.75, d));
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

export default function SmokeRibbon({ on }: { on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

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

    // drawn at half the screen's size (smoke is soft; it upscales cleanly), more on small screens
    const draw = () => {
      const s = canvas.clientWidth < 700 ? 0.7 : 0.5;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * s));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * s));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
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

  if (failed)
    return (
      <div className={`${styles.smoke7} ${on ? styles.smoke7On : ""}`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.smoke7A} src="/hero7/smoke-a.webp" alt="" draggable={false} decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.smoke7B} src="/hero7/smoke-b.webp" alt="" draggable={false} decoding="async" />
      </div>
    );
  return <canvas ref={ref} className={`${styles.ribbon} ${on ? styles.ribbonOn : ""}`} aria-hidden="true" />;
}
