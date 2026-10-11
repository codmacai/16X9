"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Clip } from "@/components/Hero-config";
import { FORMATS, type FormatKey } from "./formats";
import { EASE } from "./index-stage";
import FormatGrid from "./grid";
import styles from "./home.module.css";

// ===========================================================================
// THE LENS WALL — a format's films as one living surface in the dark, drawn
// on the GPU in a single pass. The wall never ends in any direction, and it
// bulges out toward you like the face of a lens, filling the screen.
//
//  - A liquid lens rides under the pointer: the films swell and warp round
//    it as it passes, like a drop of water over a contact sheet.
//  - The pointer is a projector beam: the films near it are lit, the rest
//    sink into the dark.
//  - Pointing at a film blooms it into colour and plays it inside its frame,
//    on the curve; a hairline frame draws round it; the wall dims.
//  - Speed bends the wall: dragged fast it stretches, and its colours split
//    at the edges like light through glass under strain; it snaps back as
//    it settles. Let go and it glides, then drifts.
//  - Each film carries its name at its centre, printed on it, so the name
//    bends with the surface.
//  - Opening a room, the films ignite from the centre outward as the
//    surface swells into its bulge. Grain and a vignette are in the same pass.
//
// Without WebGL it falls back to the DOM wall (grid.tsx).
// ===========================================================================

export type FilmRect = { top: number; left: number; width: number; height: number };
export type WallOpen = (index: number, rect: FilmRect) => void;

type Spec = { ratio: number; desk: number; small: number; cell: number };
const SPECS: Record<FormatKey, Spec> = {
  // a film's width as a share of the screen's width (wide screen, phone), and its size in the atlas
  "16x9": { ratio: 16 / 9, desk: 0.2, small: 0.56, cell: 512 },
  "9x16": { ratio: 9 / 16, desk: 0.115, small: 0.32, cell: 288 },
  beyond: { ratio: 2.39, desk: 0.27, small: 0.74, cell: 640 },
};
const DRIFT = { x: -14, y: -8 }; // px per second, when nothing else moves it
const GLIDE = 3.0; // how quickly a throw settles (per second)
const CURVE = 1.0; // how far the surface bulges
const SWELL = 0.42; // how much more it bulges at full speed
const INTRO_S = 1.7; // the films ignite and the surface swells
const SCOPE = new Set(["clip-02", "clip-03", "clip-05", "clip-07", "clip-09", "clip-11", "clip-13", "clip-15"]);
const nameOf = (src: string) => src.replace(/^.*\/([^/]+)\.mp4$/i, "$1");
const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");
const pad2 = (n: number) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------
const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uOff;
uniform vec2 uCell;
uniform vec2 uTile;
uniform float uCurve;
uniform vec2 uVel;
uniform vec2 uMouse;
uniform float uLens;
uniform float uLight;
uniform vec2 uHover;
uniform float uHoverT;
uniform float uAny;
uniform float uVideoOn;
uniform float uTime;
uniform float uIntro;
uniform float uN;
uniform vec2 uGrid;
uniform vec2 uVCrop;
uniform sampler2D uAtlas;
uniform sampler2D uTitles;
uniform sampler2D uVideo;

float S() { return 0.5 * max(uRes.x, uRes.y); }

// a point on the screen -> where it lies on the flat wall (px from the centre)
vec2 toFlat(vec2 px) {
  vec2 c = 0.5 * uRes;
  float s = S();
  vec2 p = (px - c) / s;
  float r2 = dot(p, p);
  // the bulge: the centre swells toward you, the edges fall away
  vec2 q = p * (1.0 - 0.24 * uCurve + 0.34 * uCurve * r2);
  // the liquid lens under the pointer
  vec2 d = p - (uMouse - c) / s;
  q -= d * exp(-dot(d, d) / 0.024) * 0.32 * uLens;
  // speed bends it: the edges trail behind
  q += uVel / s * 0.024 * (0.08 + r2);
  return q * s;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 wall(vec2 f, vec2 px) {
  vec2 w = f + uOff;
  vec2 cell = floor(w / uCell);
  vec2 local = w - cell * uCell;
  vec2 t = (local - 0.5 * (uCell - uTile)) / uTile;
  vec3 dark = vec3(0.02);
  if (t.x < 0.0 || t.y < 0.0 || t.x > 1.0 || t.y > 1.0) return dark;
  float hov = (abs(cell.x - uHover.x) < 0.5 && abs(cell.y - uHover.y) < 0.5) ? 1.0 : 0.0;
  // the films ignite from the centre outward
  vec2 cc = (cell + 0.5) * uCell - uOff;
  float appear = clamp((uIntro * 1.9 - length(cc) / S()) / 0.4, 0.0, 1.0);
  // the film pointed at settles a touch closer inside its frame
  vec2 tz = 0.5 + (t - 0.5) / (1.0 + 0.07 * hov * uHoverT);
  float idx = mod(cell.x * 5.0 + cell.y * 7.0, uN);
  vec2 a = vec2(mod(idx, uGrid.x), floor(idx / uGrid.x));
  vec2 tc = clamp(tz, 0.004, 0.996);
  vec2 auv = vec2((a.x + tc.x) / uGrid.x, 1.0 - (a.y + tc.y) / uGrid.y);
  vec3 img = texture2D(uAtlas, auv).rgb;
  if (hov > 0.5 && uVideoOn > 0.001) {
    vec2 v = 0.5 + (tz - 0.5) * uVCrop;
    img = mix(img, texture2D(uVideo, vec2(v.x, 1.0 - v.y)).rgb, uVideoOn);
  }
  float g = dot(img, vec3(0.299, 0.587, 0.114));
  vec3 col = mix(vec3(g), img, hov * uHoverT);
  // the projector beam, and the wall dimming round the film pointed at
  vec2 dm = (px - uMouse) / S();
  float beam = exp(-dot(dm, dm) / 0.15);
  float level = mix(0.5, 0.24, uAny * (1.0 - hov)) + 0.4 * beam * uLight;
  level = mix(level, 1.0, hov * uHoverT);
  col *= level;
  // its name, printed on it
  vec4 tt = texture2D(uTitles, auv);
  col = mix(col, tt.rgb, tt.a * mix(0.92, 0.35, uAny * (1.0 - hov)));
  // a hairline frame round the film pointed at
  vec2 e = min(t, 1.0 - t) * uTile;
  float edge = 1.0 - smoothstep(0.0, 1.6, min(e.x, e.y));
  col = mix(col, vec3(0.95), edge * hov * uHoverT);
  return mix(dark, col, appear);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  float sp = length(uVel);
  vec3 col;
  if (sp > 80.0) {
    // light through glass under strain: the colours part along the motion
    vec2 dir = uVel / sp * min(sp / 2400.0, 1.0) * 7.0;
    col.r = wall(toFlat(px + dir), px).r;
    col.g = wall(toFlat(px), px).g;
    col.b = wall(toFlat(px - dir), px).b;
  } else {
    col = wall(toFlat(px), px);
  }
  vec2 p = (px - 0.5 * uRes) / S();
  col *= 1.0 - 0.62 * smoothstep(0.42, 1.3, length(p));
  col += (hash(floor(px) + fract(uTime * 7.0) * 113.0) - 0.5) * 0.05;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// the atlas: every film's still, cropped to the format, and its name, in two canvases
// ---------------------------------------------------------------------------
const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

async function buildAtlas(clips: Clip[], fmt: FormatKey, font: string) {
  const spec = SPECS[fmt];
  const cw = spec.cell;
  const ch = Math.round(cw / spec.ratio);
  const cols = 4;
  const rows = Math.ceil(clips.length / cols);
  const atlas = document.createElement("canvas");
  const titles = document.createElement("canvas");
  atlas.width = titles.width = cols * cw;
  atlas.height = titles.height = rows * ch;
  const ia = atlas.getContext("2d");
  const it = titles.getContext("2d");
  if (!ia || !it) throw new Error("no 2d context");
  const imgs = await Promise.all(clips.map((c) => loadImage(stillFor(c.src)).catch(() => null)));
  const fs = Math.round(0.042 * Math.max(cw, ch));
  it.fillStyle = "#f6f4f0";
  it.textAlign = "center";
  it.textBaseline = "middle";
  it.shadowColor = "rgba(0,0,0,0.55)";
  it.shadowBlur = fs * 0.9;
  const spaced = "letterSpacing" in it;
  clips.forEach((clip, i) => {
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * ch;
    const img = imgs[i];
    if (img) {
      // cover the cell; scope films are zoomed past their bars (Beyond's crop does it already)
      const z = fmt !== "beyond" && SCOPE.has(nameOf(clip.src)) ? 1.37 : 1;
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      let sw = W / z;
      let sh = sw / spec.ratio;
      if (sh > H / z) {
        sh = H / z;
        sw = sh * spec.ratio;
      }
      ia.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh, x, y, cw, ch);
    } else {
      ia.fillStyle = "#151515";
      ia.fillRect(x, y, cw, ch);
    }
    // the name: number, title (in up to two lines), a hairline, runtime
    const cx = x + cw / 2;
    const cy = y + ch / 2;
    const title = clip.title.toUpperCase();
    it.font = `400 ${fs}px ${font}`;
    if (spaced) (it as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(fs * 0.22).toFixed(1)}px`;
    const max = cw * 0.84;
    let lines = [title];
    if (it.measureText(title).width > max) {
      const words = title.split(" ");
      const half = Math.ceil(words.length / 2);
      lines = [words.slice(0, half).join(" "), words.slice(half).join(" ")];
    }
    const lh = fs * 1.35;
    const top = cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, k) => it.fillText(l, cx, top + k * lh));
    const small = Math.round(fs * 0.62);
    it.font = `400 ${small}px ${font}`;
    if (spaced) (it as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(small * 0.28).toFixed(1)}px`;
    it.globalAlpha = 0.7;
    it.fillText(pad2(i + 1), cx, top - lh * 0.95);
    const below = top + (lines.length - 1) * lh + lh * 0.95;
    it.fillRect(cx - fs * 0.7, below - 1, fs * 1.4, Math.max(1, fs * 0.06));
    it.fillText(clip.duration, cx, below + lh * 0.7);
    it.globalAlpha = 1;
  });
  return { atlas, titles, cols, rows };
}

// ---------------------------------------------------------------------------
// the wall
// ---------------------------------------------------------------------------
export default function LensWall({
  fmt,
  clips,
  paused,
  reduce,
  onOpen,
}: {
  fmt: FormatKey;
  clips: Clip[];
  /** a film or the menu is open over the room: the wall holds still and stops drawing */
  paused: boolean;
  reduce: boolean;
  onOpen: WallOpen;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const openRef = useRef(onOpen);
  const [fallback, setFallback] = useState(false);
  const f = FORMATS.find((x) => x.key === fmt) ?? FORMATS[0];
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    openRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) {
      // a callback, not the effect's body: the DOM wall takes over
      queueMicrotask(() => setFallback(true));
      return;
    }
    const spec = SPECS[fmt];
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let disposed = false;

    // ---- program ----
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn("lens wall:", gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      queueMicrotask(() => setFallback(true));
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = {
      res: U("uRes"), dpr: U("uDpr"), off: U("uOff"), cell: U("uCell"), tile: U("uTile"), curve: U("uCurve"),
      vel: U("uVel"), mouse: U("uMouse"), lens: U("uLens"), light: U("uLight"), hover: U("uHover"),
      hoverT: U("uHoverT"), any: U("uAny"), videoOn: U("uVideoOn"), time: U("uTime"), intro: U("uIntro"),
      n: U("uN"), grid: U("uGrid"), vcrop: U("uVCrop"), atlas: U("uAtlas"), titles: U("uTitles"), video: U("uVideo"),
    };
    const texture = (unit: number) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([5, 5, 5, 255]));
      return t;
    };
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const tAtlas = texture(0);
    const tTitles = texture(1);
    const tVideo = texture(2);
    gl.uniform1i(u.atlas, 0);
    gl.uniform1i(u.titles, 1);
    gl.uniform1i(u.video, 2);
    gl.uniform1f(u.n, clips.length);

    // ---- size ----
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const tile = { w: 0, h: 0 };
    const cell = { w: 0, h: 0 };
    const resize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      const small = vw <= 760;
      tile.w = Math.round(vw * (small ? spec.small : spec.desk));
      tile.h = Math.round(tile.w / spec.ratio);
      const gap = Math.max(6, vw * (small ? 0.02 : 0.007));
      cell.w = tile.w + gap;
      cell.h = tile.h + gap;
      gl.uniform2f(u.res, vw, vh);
      gl.uniform1f(u.dpr, dpr);
      gl.uniform2f(u.tile, tile.w, tile.h);
      gl.uniform2f(u.cell, cell.w, cell.h);
    };
    resize();
    window.addEventListener("resize", resize);

    // the film under the pointer plays in its frame: cover-cropped from the 16:9 file
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.preload = "auto";
    let videoReady = false;
    video.addEventListener("playing", () => (videoReady = true));
    const V = 16 / 9;
    const cropFor = (clip: Clip) => {
      const z = fmt !== "beyond" && SCOPE.has(nameOf(clip.src)) ? 1.37 : 1;
      const sx = spec.ratio < V ? spec.ratio / V : 1;
      const sy = spec.ratio < V ? 1 : V / spec.ratio;
      return [sx / z, sy / z];
    };

    // ---- the atlas ----
    let ready = false;
    let born = 0;
    const font = getComputedStyle(root).fontFamily || "Helvetica, Arial, sans-serif";
    (document.fonts?.ready ?? Promise.resolve())
      .then(() => buildAtlas(clips, fmt, font))
      .then(({ atlas, titles, cols, rows }) => {
        if (disposed) return;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tAtlas);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tTitles);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, titles);
        gl.uniform2f(u.grid, cols, rows);
        ready = true;
        born = performance.now();
      })
      .catch((err) => {
        console.warn("lens wall:", err);
        if (!disposed) setFallback(true);
      });

    // ---- motion state ----
    const off = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    const mouse = { x: vw / 2, y: vh / 2 };
    const eased = { mouse: { x: vw / 2, y: vh / 2 }, lens: 0, light: fine ? 1 : 0.4, hoverT: 0, any: 0, videoOn: 0, swell: 0 };
    let drift = reduce ? 0 : 1;
    let dragging = false;
    let pointerIn = false;
    let hover: { x: number; y: number; idx: number } | null = null;
    let playing: string | null = null;
    let hoverAt = 0;
    let last = performance.now();
    let raf = 0;
    // the same mapping as the shader, so the pointer finds the film it's over
    const flatAt = (x: number, y: number, curve: number) => {
      const s = 0.5 * Math.max(vw, vh);
      const px = (x - vw / 2) / s;
      const py = (y - vh / 2) / s;
      const r2 = px * px + py * py;
      const k = 1 - 0.24 * curve + 0.34 * curve * r2;
      const b = 0.024 * (0.08 + r2);
      return { x: (px * k + (vel.x / s) * b) * s, y: (py * k + (vel.y / s) * b) * s };
    };
    const filmAt = (x: number, y: number, curve: number) => {
      const fl = flatAt(x, y, curve);
      const wx = fl.x + off.x;
      const wy = fl.y + off.y;
      const cx = Math.floor(wx / cell.w);
      const cy = Math.floor(wy / cell.h);
      const lx = wx - cx * cell.w - (cell.w - tile.w) / 2;
      const ly = wy - cy * cell.h - (cell.h - tile.h) / 2;
      if (lx < 0 || ly < 0 || lx > tile.w || ly > tile.h) return null;
      const n = clips.length;
      const idx = ((((cx * 5 + cy * 7) % n) + n) % n);
      return { x: cx, y: cy, idx };
    };
    let curveNow = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (pausedRef.current || !ready) return;
      const k = (rate: number) => 1 - Math.exp(-dt * rate);

      // motion: drift, throw
      drift += ((hover || dragging || reduce ? 0 : 1) - drift) * k(2.5);
      if (!dragging) {
        const g = Math.exp(-GLIDE * dt);
        vel.x *= g;
        vel.y *= g;
        off.x -= (vel.x + DRIFT.x * drift) * dt;
        off.y -= (vel.y + DRIFT.y * drift) * dt;
      }
      const speed = Math.min(1, Math.hypot(vel.x, vel.y) / 2200);
      eased.swell += (speed - eased.swell) * k(4);
      const intro = reduce ? 1 : Math.min(1, (now - born) / 1000 / INTRO_S);
      const grow = 1 - Math.pow(1 - intro, 3);
      // a tall, narrow phone takes a gentler curve
      curveNow = CURVE * (vw <= 760 ? 0.7 : 1) * grow * (1 + SWELL * eased.swell);

      // the pointer: the lens and the beam follow it, softly
      eased.mouse.x += (mouse.x - eased.mouse.x) * k(reduce ? 1000 : 10);
      eased.mouse.y += (mouse.y - eased.mouse.y) * k(reduce ? 1000 : 10);
      eased.lens += ((fine && pointerIn && !dragging && !reduce ? 1 : 0) - eased.lens) * k(5);
      eased.light += ((fine ? (pointerIn ? 1 : 0.4) : 0.4) - eased.light) * k(3);

      // the film under the pointer
      const at = fine && pointerIn && !dragging ? filmAt(mouse.x, mouse.y, curveNow) : null;
      const same = at && hover && at.x === hover.x && at.y === hover.y;
      if (!same) {
        if (at) {
          hover = at;
          hoverAt = now;
          eased.hoverT = 0;
        } else hover = null;
        videoReady = false;
        eased.videoOn = 0;
        root.style.cursor = at ? "pointer" : "";
      }
      // its film starts once the pointer has rested on it a moment
      if (hover && now - hoverAt > 140 && playing !== clips[hover.idx].src) {
        playing = clips[hover.idx].src;
        video.src = playing;
        const [sx, sy] = cropFor(clips[hover.idx]);
        gl.uniform2f(u.vcrop, sx, sy);
        video.play().catch(() => {});
      }
      if (!hover && playing && eased.videoOn < 0.01) {
        playing = null;
        video.pause();
      }
      eased.hoverT += ((hover ? 1 : 0) - eased.hoverT) * k(6);
      eased.any += ((hover ? 1 : 0) - eased.any) * k(5);
      eased.videoOn += ((hover && videoReady ? 1 : 0) - eased.videoOn) * k(5);
      if (hover && videoReady && video.readyState >= 2) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, tVideo);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      }

      gl.uniform2f(u.off, off.x, off.y);
      gl.uniform1f(u.curve, curveNow);
      gl.uniform2f(u.vel, reduce ? 0 : vel.x, reduce ? 0 : vel.y);
      gl.uniform2f(u.mouse, eased.mouse.x, eased.mouse.y);
      gl.uniform1f(u.lens, eased.lens);
      gl.uniform1f(u.light, eased.light);
      gl.uniform2f(u.hover, hover ? hover.x : -1e5, hover ? hover.y : -1e5);
      gl.uniform1f(u.hoverT, eased.hoverT);
      gl.uniform1f(u.any, eased.any);
      gl.uniform1f(u.videoOn, eased.videoOn);
      gl.uniform1f(u.time, now / 1000);
      gl.uniform1f(u.intro, intro);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    raf = requestAnimationFrame(frame);

    // ---- drag (mouse or finger) with a throw; wheel and trackpad push it; a click opens a film ----
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
      vel.x = vel.y = 0;
    };
    const move = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (e.pointerId !== id) return;
      if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
        dragging = true;
        root.classList.add(styles.gridDragging);
        root.setPointerCapture?.(id);
      }
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      off.x -= dx;
      off.y -= dy;
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
      if (!dragging) {
        // a click (or a tap): open the film under it
        const at = filmAt(e.clientX, e.clientY, curveNow);
        if (at && ready && !pausedRef.current) {
          const w = tile.w * 1.25;
          const h = tile.h * 1.25;
          openRef.current(at.idx, { left: e.clientX - w / 2, top: e.clientY - h / 2, width: w, height: h });
        }
        return;
      }
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
    const enter = () => (pointerIn = true);
    const leave = () => (pointerIn = false);
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointerenter", enter);
    root.addEventListener("pointerleave", leave);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    root.addEventListener("wheel", wheel, { passive: false });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointerenter", enter);
      root.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      root.removeEventListener("wheel", wheel);
      video.pause();
      video.removeAttribute("src");
      video.load();
      gl.deleteTexture(tAtlas);
      gl.deleteTexture(tTitles);
      gl.deleteTexture(tVideo);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      // let the context go only once the canvas has really left the page (an effect can re-run on the same canvas)
      window.setTimeout(() => {
        if (!canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext();
      }, 0);
    };
  }, [fmt, clips, reduce]);

  if (fallback)
    return (
      <FormatGrid
        fmt={fmt}
        clips={clips}
        paused={paused}
        reduce={reduce}
        onOpen={(i, el) => {
          const r = el.getBoundingClientRect();
          onOpen(i, { top: r.top, left: r.left, width: r.width, height: r.height });
        }}
      />
    );

  return (
    <motion.div
      ref={rootRef}
      className={styles.lens}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.6, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.5, ease: EASE } }}
      aria-label={`${f.label}: ${f.line}`}
    >
      <canvas ref={canvasRef} className={styles.lensCanvas} />
      {/* the films, for keyboards and screen readers */}
      <ul className={styles.sr}>
        {clips.map((c, i) => (
          <li key={c.src}>
            <button
              type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onOpen(i, { top: r.top, left: r.left, width: Math.max(r.width, 320), height: Math.max(r.height, 180) });
              }}
            >
              Play {c.title}, {c.duration}
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
