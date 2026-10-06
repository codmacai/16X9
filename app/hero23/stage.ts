import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// ===========================================================================
// HERO 23 — shards.
//
// A small, slow cluster of film tiles hangs in the middle of a dark room:
// thin 16:9 panes with rounded corners, each playing a different clip, each
// tilted its own way, the whole cluster turning. Their backs are dark glass;
// their edges catch the light.
//
// Click and hold: the tiles turn to face you and settle into a neat contact
// sheet, every film side by side. Let go and they drift back into the cluster.
// Drag to turn it; the cursor nudges the tiles near it.
//
// Every clip is drawn into one shared atlas each frame, so the whole cluster is
// one texture and one draw call; the shader places and turns every tile.
// ===========================================================================

export type Clip = { src: string; poster: string };

export type StageEvents = {
  onGathered?: (gathered: boolean) => void;
};

const COUNT = 30; // tiles
const TW = 0.52; // tile width
const TH = (TW * 9) / 16;
const CORNER = 0.035;
const SHELL = 1.55; // radius of the cluster
const COLS = 6; // the contact sheet when gathered
const ROWS = Math.ceil(COUNT / COLS);
const SHEET_GAP = 0.08;
const ATLAS = 4; // clips per side in the atlas
const CELL_W = 320;
const CELL_H = 180;

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

const TILE_VERT = /* glsl */ `
  uniform float uTime, uHold;
  uniform vec3 uPointer;
  uniform float uPointerOn;
  attribute vec3 aHome;
  attribute vec3 aRot;
  attribute vec3 aSheet;
  attribute vec4 aSeed;
  attribute float aClip;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  varying float vClip;
  varying float vE;

  mat3 rot(vec3 a){
    float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
    return mat3(cy*cz, cy*sz, -sy,
                sx*sy*cz - cx*sz, sx*sy*sz + cx*cz, sx*cy,
                cx*sy*cz + sx*sz, cx*sy*sz - sx*cz, cx*cy);
  }
  float ease(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }

  void main(){
    float t = clamp(uHold * 1.45 - aSeed.y * 0.45, 0.0, 1.0);
    float e = ease(t);

    // floating: a slow bob and sway around its place in the cluster
    vec3 home = aHome * (1.0 + 0.035 * sin(uTime * 0.5 + aSeed.x * 6.283));
    home.y += sin(uTime * 0.7 + aSeed.z * 6.283) * 0.04;
    vec3 pos = mix(home, aSheet, e);
    pos += normalize(aHome) * sin(e * 3.14159) * (0.25 + aSeed.w * 0.35);

    vec3 away = pos - uPointer;
    float near = exp(-dot(away, away) * 2.2) * uPointerOn * (1.0 - e);
    pos += normalize(away + 1e-4) * near * 0.45;

    vec3 sway = vec3(sin(uTime * 0.31 + aSeed.x * 9.0), sin(uTime * 0.27 + aSeed.y * 9.0), sin(uTime * 0.23 + aSeed.z * 9.0)) * 0.22;
    vec3 ang = (aRot + sway + vec3(near * 1.4, near * 0.8, 0.0)) * (1.0 - e);
    mat3 R = rot(ang);
    float s = mix(0.72 + aSeed.w * 0.55, 1.0, e);

    vec3 p = R * (position * vec3(${TW.toFixed(4)} * s, ${TH.toFixed(4)} * s, 1.0)) + pos;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vN = normalize(normalMatrix * (R * vec3(0.0, 0.0, 1.0)));
    vView = -mv.xyz;
    vClip = aClip;
    vE = e;
  }
`;

const TILE_FRAG = /* glsl */ `
  uniform sampler2D atlas;
  uniform float uFade;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  varying float vClip;
  varying float vE;

  vec3 toLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

  void main(){
    // rounded rectangle, measured in world units so every corner matches
    vec2 size = vec2(${TW.toFixed(4)}, ${TH.toFixed(4)});
    vec2 q = abs(vUv - 0.5) * size - (size * 0.5 - ${CORNER.toFixed(4)});
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${CORNER.toFixed(4)};
    float aa = fwidth(dist);
    float alpha = 1.0 - smoothstep(-aa, aa, dist);
    if (alpha < 0.01) discard;
    float rim = 1.0 - smoothstep(0.0, 0.012, -dist);

    vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 V = normalize(vView);
    vec3 L = normalize(vec3(0.5, 0.8, 0.55));
    float diff = max(dot(N, L), 0.0);
    float fres = pow(1.0 - abs(dot(N, V)), 3.0);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 60.0);
    float loose = 1.0 - vE;

    vec3 col;
    if (gl_FrontFacing) {
      float c = floor(vClip + 0.5);
      vec2 cell = vec2(mod(c, ${ATLAS.toFixed(1)}), floor(c / ${ATLAS.toFixed(1)}));
      vec2 inset = 0.5 + (vUv - 0.5) * 0.985;
      vec2 auv = vec2((cell.x + inset.x) / ${ATLAS.toFixed(1)}, 1.0 - (cell.y + 1.0 - inset.y) / ${ATLAS.toFixed(1)});
      vec3 film = toLinear(texture2D(atlas, auv).rgb);
      col = film * mix(0.72 + 0.28 * diff, 1.0, vE)
          + vec3(0.9) * spec * 0.55 * loose
          + vec3(0.55) * rim * (0.35 + fres) * loose
          + vec3(0.12) * fres * loose;
    } else {
      // the back: dark glass
      col = vec3(0.01) + vec3(0.05) * diff + vec3(0.35) * fres + vec3(0.9) * spec * 0.6 + vec3(0.5) * rim * 0.6;
    }
    gl_FragColor = vec4(col * uFade, alpha);
  }
`;

// Chromatic split toward the edges, grain, a soft vignette.
const FINISH = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAmount: { value: 0.006 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount, uTime;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      vec2 off = d * uAmount * (0.35 + length(d) * 1.6);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col *= 1.0 - smoothstep(0.45, 0.95, length(d * vec2(1.0, 0.8))) * 0.45;
      col += (hash(vUv * 1000.0 + fract(uTime * 7.0)) - 0.5) * 0.006;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

type Source = { video: HTMLVideoElement; poster: HTMLImageElement };

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private finish: ShaderPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private sources: Source[];
  private atlas: HTMLCanvasElement;
  private atlasCtx: CanvasRenderingContext2D;
  private atlasTex: THREE.CanvasTexture;

  private hold = 0; // 0 cluster … 1 contact sheet
  private holding = false;
  private gathered = false;
  private rotY = 0;
  private rotX = 0.2;
  private velY = 0.12;
  private velX = 0;
  private pointerNdc = new THREE.Vector2(9, 9);
  private pointerOn = 0;
  private press = { x: 0, y: 0, rotY: 0, rotX: 0, dragging: false, down: false };
  private intro = 0;

  private last = performance.now();
  private start = performance.now();
  private raf = 0;
  private disposed = false;
  private cleanups: (() => void)[] = [];

  constructor(
    private host: HTMLElement,
    clips: Clip[],
    private events: StageEvents = {},
    private reduced = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    // The clear colour is converted for display when it's cleared, and the output
    // pass converts again; linearise it once more so the room ends up #1b1b1d.
    this.renderer.setClearColor(new THREE.Color("#1b1b1d").convertSRGBToLinear(), 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";

    // Every clip, drawn into one canvas each frame.
    this.sources = clips.map((c) => {
      const video = document.createElement("video");
      video.src = c.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("playsinline", "");
      video.play().catch(() => {});
      const poster = new Image();
      poster.src = c.poster;
      return { video, poster };
    });
    this.atlas = document.createElement("canvas");
    this.atlas.width = CELL_W * ATLAS;
    this.atlas.height = CELL_H * ATLAS;
    this.atlasCtx = this.atlas.getContext("2d")!;
    this.atlasCtx.fillStyle = "#111";
    this.atlasCtx.fillRect(0, 0, this.atlas.width, this.atlas.height);
    this.atlasTex = new THREE.CanvasTexture(this.atlas);
    this.atlasTex.colorSpace = THREE.NoColorSpace; // decoded in the shader
    this.atlasTex.minFilter = THREE.LinearFilter;
    this.atlasTex.generateMipmaps = false;

    this.mat = new THREE.ShaderMaterial({
      vertexShader: TILE_VERT,
      fragmentShader: TILE_FRAG,
      side: THREE.DoubleSide,
      transparent: false,
      alphaToCoverage: true,
      uniforms: {
        atlas: { value: this.atlasTex },
        uTime: { value: 0 },
        uHold: { value: 0 },
        uPointer: { value: new THREE.Vector3(99, 99, 99) },
        uPointerOn: { value: 0 },
        uFade: { value: 0 },
      },
    });
    this.scene.add(this.group);
    this.group.add(this.makeTiles(clips.length));

    this.camera.position.set(0, 0, 9.2);
    this.camera.lookAt(0, 0, 0);

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.45, 0.72));
    this.finish = new ShaderPass(FINISH);
    this.composer.addPass(this.finish);
    this.composer.addPass(new OutputPass());

    this.resize();
    this.bind();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  private makeTiles(clipCount: number) {
    const plane = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.setAttribute("position", plane.getAttribute("position"));
    geo.setAttribute("uv", plane.getAttribute("uv"));
    geo.instanceCount = COUNT;

    const home = new Float32Array(COUNT * 3);
    const rotA = new Float32Array(COUNT * 3);
    const sheet = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT * 4);
    const clip = new Float32Array(COUNT);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const sheetW = COLS * TW + (COLS - 1) * SHEET_GAP;
    const sheetH = ROWS * TH + (ROWS - 1) * SHEET_GAP;
    for (let i = 0; i < COUNT; i++) {
      // a loose hollow cluster
      const y = 1 - ((i + 0.5) / COUNT) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const rad = SHELL * (0.75 + Math.random() * 0.45);
      const hx = Math.cos(th) * r * rad;
      const hy = y * rad * 0.9;
      const hz = Math.sin(th) * r * rad;
      home.set([hx, hy, hz], i * 3);
      // face out from the middle, then tip each one its own way
      rotA.set([(Math.random() - 0.5) * 1.1 - y * 0.6, Math.atan2(hx, hz) + (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 1.2], i * 3);
      // the contact sheet, read left to right, top to bottom
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      sheet.set([-sheetW / 2 + TW / 2 + col * (TW + SHEET_GAP), sheetH / 2 - TH / 2 - row * (TH + SHEET_GAP), 0], i * 3);
      seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
      clip[i] = i % clipCount;
    }
    geo.setAttribute("aHome", new THREE.InstancedBufferAttribute(home, 3));
    geo.setAttribute("aRot", new THREE.InstancedBufferAttribute(rotA, 3));
    geo.setAttribute("aSheet", new THREE.InstancedBufferAttribute(sheet, 3));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));
    geo.setAttribute("aClip", new THREE.InstancedBufferAttribute(clip, 1));
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // keep the cluster (and the sheet it gathers into) inside a phone's width
    const visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const visW = visH * this.camera.aspect;
    const sheetW = COLS * TW + (COLS - 1) * SHEET_GAP;
    this.group.scale.setScalar(Math.min(1, (visW * 0.86) / sheetW));
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
  }

  // -------------------------------------------------------------------------
  // Input: press and hold to gather, drag to turn.
  // -------------------------------------------------------------------------

  private bind() {
    const el = this.host;
    const on = <K extends keyof WindowEventMap>(t: HTMLElement | Window, type: K, fn: (e: WindowEventMap[K]) => void) => {
      t.addEventListener(type, fn as EventListener);
      this.cleanups.push(() => t.removeEventListener(type, fn as EventListener));
    };
    const ndc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointerNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };

    on(el, "pointerdown", (e) => {
      ndc(e);
      el.setPointerCapture(e.pointerId);
      this.press = { x: e.clientX, y: e.clientY, rotY: this.rotY, rotX: this.rotX, dragging: false, down: true };
      this.setHold(true);
      for (const s of this.sources) s.video.play().catch(() => {});
    });
    on(el, "pointermove", (e) => {
      ndc(e);
      if (!this.press.down) return;
      const dx = e.clientX - this.press.x;
      const dy = e.clientY - this.press.y;
      if (!this.press.dragging && Math.hypot(dx, dy) > 10 && !this.gathered) {
        this.press.dragging = true;
        this.setHold(false);
      }
      if (this.press.dragging) {
        const ny = this.press.rotY + dx * 0.006;
        const nx = THREE.MathUtils.clamp(this.press.rotX + dy * 0.004, -0.9, 0.9);
        this.velY = (ny - this.rotY) * 30;
        this.velX = (nx - this.rotX) * 30;
        this.rotY = ny;
        this.rotX = nx;
      }
    });
    const up = () => {
      if (!this.press.down) return;
      this.press.down = false;
      this.press.dragging = false;
      this.setHold(false);
    };
    on(el, "pointerup", up);
    on(el, "pointercancel", up);
    on(el, "pointerleave", () => this.pointerNdc.set(9, 9));
    on(window, "keydown", (e) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        this.setHold(true);
      }
    });
    on(window, "keyup", (e) => {
      if (e.code === "Space") this.setHold(false);
    });
    on(window, "resize", () => this.resize());
    const onVisible = () => {
      for (const s of this.sources) {
        if (document.hidden) s.video.pause();
        else s.video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisible));
  }

  setHold(h: boolean) {
    this.holding = h;
  }

  get holdProgress() {
    return this.hold;
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private drawAtlas() {
    const g = this.atlasCtx;
    this.sources.forEach((s, i) => {
      const x = (i % ATLAS) * CELL_W;
      const y = Math.floor(i / ATLAS) * CELL_H;
      const v = s.video;
      if (v.readyState >= 2 && v.currentTime > 0) g.drawImage(v, x, y, CELL_W, CELL_H);
      else if (s.poster.complete && s.poster.naturalWidth) g.drawImage(s.poster, x, y, CELL_W, CELL_H);
    });
    this.atlasTex.needsUpdate = true;
  }

  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const t = (now - this.start) / 1000;
    const u = this.mat.uniforms;

    this.drawAtlas();

    const target = this.holding ? 1 : 0;
    const speed = this.holding ? 0.85 : 1.1;
    this.hold = this.reduced ? target : THREE.MathUtils.clamp(this.hold + Math.sign(target - this.hold) * dt * speed, 0, 1);
    if (Math.abs(target - this.hold) < 0.004) this.hold = target;
    const gathered = this.hold >= 1;
    if (gathered !== this.gathered) {
      this.gathered = gathered;
      this.events.onGathered?.(gathered);
    }

    // a slow turn with momentum; square up to face you as the sheet forms
    if (!this.press.dragging) {
      this.velY += (0.12 - this.velY) * damp(0.8, dt);
      this.velX += (0 - this.velX) * damp(2, dt);
      this.rotY += this.velY * dt * (this.reduced ? 0 : 1);
      this.rotX += this.velX * dt;
      this.rotX += (0.2 - this.rotX) * damp(0.6, dt);
    }
    const a = this.hold;
    const pull = a * a * (3 - 2 * a);
    if (pull > 0.001) this.rotY = Math.atan2(Math.sin(this.rotY), Math.cos(this.rotY));
    this.group.rotation.y = this.rotY * (1 - pull);
    this.group.rotation.x = this.rotX * (1 - pull);

    this.pointerOn += ((this.pointerNdc.x < 2 && !this.press.dragging ? 1 : 0) - this.pointerOn) * damp(4, dt);
    if (this.pointerNdc.x < 2) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(this.pointerNdc, this.camera);
      const hit = new THREE.Vector3();
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -SHELL * 0.5 * this.group.scale.x), hit);
      this.group.updateMatrixWorld();
      u.uPointer.value.copy(this.group.worldToLocal(hit));
    }

    this.intro = Math.min(1, this.intro + dt / (this.reduced ? 0.01 : 1.8));
    u.uTime.value = t;
    u.uHold.value = this.hold;
    u.uPointerOn.value = this.pointerOn;
    u.uFade.value = this.intro * this.intro * (3 - 2 * this.intro);
    this.finish.uniforms.uAmount.value = 0.004 + 0.01 * (1 - pull);
    this.finish.uniforms.uTime.value = t;

    this.composer.render();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((fn) => fn());
    for (const s of this.sources) {
      s.video.pause();
      s.video.removeAttribute("src");
      s.video.load();
    }
    this.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.atlasTex.dispose();
    this.mat.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
