import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// ===========================================================================
// HERO 23 — the frame, broken.
//
// A film, cut into a grid of small cubes, drifts apart into a slow hollow
// sphere in the dark. Each cube still carries its piece of the moving picture
// on its face; the sides are dark glass that catches the light at the edges.
// Click and hold: the cubes fly home, from the middle out, and lock together
// into one 16:9 frame playing the film. Let go and it breaks again, and the
// next film takes its place.
//
// All the motion is on the GPU: every cube knows where it sits in the frame
// and where it floats in the sphere, and the shader moves it between the two.
// A light chromatic split and grain finish it, stronger while it's broken.
// ===========================================================================

export type Film = { src: string; poster: string };

export type StageEvents = {
  onAssembled?: (whole: boolean) => void;
  onFilm?: (index: number) => void;
};

const GX = 28; // cubes across
const GY = 16; // cubes down
const FRAME_W = 6.4; // the assembled frame, in world units
const CELL = FRAME_W / GX;
const SHELL = 1.95; // radius of the broken sphere
const CROP_X = Math.min(1, GX / GY / (16 / 9)) * 0.985; // share of the film's width the grid shows, a hair inside the edge
const CROP_Y = Math.min(1, 16 / 9 / (GX / GY)) * 0.975;

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

const CUBE_VERT = /* glsl */ `
  uniform float uTime, uAssemble;
  uniform vec3 uPointer;
  uniform float uPointerOn;
  attribute vec2 aCell;
  attribute vec3 aScatter;
  attribute vec3 aSpin;
  attribute vec4 aSeed;
  varying vec2 vUv;
  varying vec2 vTile;
  varying vec3 vN;
  varying vec3 vView;
  varying float vFront;
  varying float vA;

  mat3 rot(vec3 a){
    float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
    return mat3(cy*cz, cy*sz, -sy,
                sx*sy*cz - cx*sz, sx*sy*sz + cx*cz, sx*cy,
                cx*sy*cz + sx*sz, cx*sy*sz - sx*cz, cx*cy);
  }
  float ease(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }

  void main(){
    vec2 grid = vec2(${GX.toFixed(1)}, ${GY.toFixed(1)});
    vec3 home = vec3((aCell.x + 0.5 - grid.x * 0.5) * ${CELL.toFixed(5)}, (aCell.y + 0.5 - grid.y * 0.5) * ${CELL.toFixed(5)}, 0.0);

    // from the middle of the frame out, with a little scatter
    float d = length((aCell + 0.5) / grid - 0.5) / 0.7071;
    float delay = d * 0.55 + aSeed.y * 0.15;
    float t = clamp(uAssemble * 1.7 - delay, 0.0, 1.0);
    float e = ease(t);

    // the broken sphere breathes and drifts a little
    vec3 drift = aScatter * (1.0 + 0.04 * sin(uTime * 0.6 + aSeed.x * 6.283));
    vec3 pos = mix(drift, home, e);
    pos += normalize(aScatter) * sin(e * 3.14159) * (0.35 + aSeed.z * 0.5); // fly out, then home

    // the cursor pushes floating cubes aside
    vec3 away = pos - uPointer;
    float near = exp(-dot(away, away) * 1.6) * uPointerOn * (1.0 - e);
    pos += normalize(away + 1e-4) * near * 0.65;

    vec3 ang = (aSpin * uTime + aSeed.xyz * 6.283) * (1.0 - e);
    ang += aSpin * near * 2.0;
    mat3 R = rot(ang);
    float size = mix(0.4 + aSeed.w * 0.75, 1.001, e) * ${CELL.toFixed(5)};

    vec3 p = R * (position * vec3(size, size, size * mix(0.9, 0.35, e))) + pos;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    vUv = uv;
    vTile = (aCell + uv) / grid;
    vN = normalize(normalMatrix * (R * normal));
    vView = -mv.xyz;
    vFront = step(0.5, normal.z);
    vA = e;
  }
`;

const CUBE_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uFade;
  varying vec2 vUv;
  varying vec2 vTile;
  varying vec3 vN;
  varying vec3 vView;
  varying float vFront;
  varying float vA;

  vec3 toLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

  void main(){
    vec3 N = normalize(vN);
    vec3 V = normalize(vView);
    vec3 L = normalize(vec3(0.55, 0.75, 0.6));
    float diff = max(dot(N, L), 0.0);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 48.0);
    float edgeD = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float edge = 1.0 - smoothstep(0.0, 0.07, edgeD);
    float loose = 1.0 - vA;

    vec2 tuv = 0.5 + (vTile - 0.5) * vec2(${CROP_X.toFixed(4)}, ${CROP_Y.toFixed(4)});
    vec3 film = toLinear(texture2D(map, tuv).rgb);

    // dark glass sides, lit at the edges
    vec3 side = vec3(0.008) + vec3(0.045) * diff + vec3(0.3) * fres * 0.5 + vec3(0.9) * spec * 0.7 + vec3(0.16) * edge * loose;
    // the face: its piece of the film, dimmed while broken, full when whole
    vec3 face = film * mix(0.62, 1.0, vA) * mix(0.75 + 0.35 * diff, 1.0, vA)
              + (vec3(0.8) * spec * 0.5 + vec3(0.14) * edge + vec3(0.15) * fres) * loose;
    face *= 1.0 - (1.0 - smoothstep(0.0, 0.025, edgeD)) * 0.22 * vA;
    vec3 col = mix(side, face, vFront);
    gl_FragColor = vec4(col * uFade, 1.0);
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

type FilmTex = { video: HTMLVideoElement; texture: THREE.VideoTexture; poster: THREE.Texture; live: boolean };

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private finish: ShaderPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private films: FilmTex[] = [];
  private film = 0;
  private nextPending = false;

  private assemble = 0; // 0 broken … 1 whole
  private holding = false;
  private whole = false;
  private rotY = 0;
  private rotX = 0.15;
  private velY = 0.07; // slow turn while broken
  private velX = 0;
  private pointerNdc = new THREE.Vector2(9, 9);
  private pointerOn = 0;
  private press = { x: 0, y: 0, rotY: 0, rotX: 0, t: 0, dragging: false, down: false };
  private intro = 0;

  private last = performance.now();
  private start = performance.now();
  private raf = 0;
  private disposed = false;
  private cleanups: (() => void)[] = [];

  constructor(
    private host: HTMLElement,
    films: Film[],
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

    this.films = films.map((f) => {
      const video = document.createElement("video");
      video.src = f.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("playsinline", "");
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      const poster = new THREE.TextureLoader().load(f.poster);
      poster.colorSpace = THREE.NoColorSpace;
      return { video, texture, poster, live: false };
    });
    this.films[0].video.play().catch(() => {});

    this.mat = new THREE.ShaderMaterial({
      vertexShader: CUBE_VERT,
      fragmentShader: CUBE_FRAG,
      uniforms: {
        map: { value: this.films[0].poster as THREE.Texture },
        uTime: { value: 0 },
        uAssemble: { value: 0 },
        uPointer: { value: new THREE.Vector3(99, 99, 99) },
        uPointerOn: { value: 0 },
        uFade: { value: 0 },
      },
    });
    this.scene.add(this.group);
    this.group.add(this.makeCubes());

    this.camera.position.set(0, 0, 9.2);
    this.camera.lookAt(0, 0, 0);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.4, 0.7));
    this.finish = new ShaderPass(FINISH);
    this.composer.addPass(this.finish);
    this.composer.addPass(new OutputPass());

    this.resize();
    this.bind();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  private makeCubes() {
    const n = GX * GY;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = box.index;
    for (const name of ["position", "normal", "uv"]) geo.setAttribute(name, box.getAttribute(name));
    geo.instanceCount = n;
    const cell = new Float32Array(n * 2);
    const scatter = new Float32Array(n * 3);
    const spin = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    const golden = Math.PI * (3 - Math.sqrt(5));
    // shuffle which cube goes where on the sphere, so neighbours in the frame scatter apart
    const order = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) {
      cell[i * 2] = i % GX;
      cell[i * 2 + 1] = Math.floor(i / GX);
      const k = order[i];
      const y = 1 - (k / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * k;
      const rad = SHELL * (0.82 + Math.random() * 0.36);
      scatter[i * 3] = Math.cos(th) * r * rad;
      scatter[i * 3 + 1] = y * rad;
      scatter[i * 3 + 2] = Math.sin(th) * r * rad;
      spin[i * 3] = (Math.random() - 0.5) * 0.9;
      spin[i * 3 + 1] = (Math.random() - 0.5) * 0.9;
      spin[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      seed[i * 4] = Math.random();
      seed[i * 4 + 1] = Math.random();
      seed[i * 4 + 2] = Math.random();
      seed[i * 4 + 3] = Math.random();
    }
    geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 2));
    geo.setAttribute("aScatter", new THREE.InstancedBufferAttribute(scatter, 3));
    geo.setAttribute("aSpin", new THREE.InstancedBufferAttribute(spin, 3));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // the whole frame should fill about 64% of the width, never more than 92%
    const visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const visW = visH * this.camera.aspect;
    const s = Math.min(1, (visW * 0.92) / FRAME_W, (visH * 0.7) / (FRAME_W * (GY / GX)));
    this.group.scale.setScalar(s);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
  }

  // -------------------------------------------------------------------------
  // Input: press and hold to assemble, drag to turn the sphere.
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
      this.press = { x: e.clientX, y: e.clientY, rotY: this.rotY, rotX: this.rotX, t: performance.now(), dragging: false, down: true };
      this.setHold(true);
    });
    on(el, "pointermove", (e) => {
      ndc(e);
      if (!this.press.down) return;
      const dx = e.clientX - this.press.x;
      const dy = e.clientY - this.press.y;
      if (!this.press.dragging && Math.hypot(dx, dy) > 10 && !this.whole) {
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
      const v = this.films[this.film].video;
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisible));
  }

  setHold(h: boolean) {
    if (h === this.holding) return;
    this.holding = h;
    if (h) this.films[this.film].video.play().catch(() => {});
    // let go after the frame was whole: the next film takes over once it's broken
    if (!h && this.whole) this.nextPending = true;
  }

  get holdProgress() {
    return this.assemble;
  }

  private showFilm(i: number) {
    const prev = this.films[this.film];
    this.film = i;
    const f = this.films[i];
    f.video.currentTime = 0;
    f.video.play().catch(() => {});
    this.mat.uniforms.map.value = f.live ? f.texture : f.poster;
    setTimeout(() => prev.video.pause(), 300);
    this.events.onFilm?.(i);
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const t = (now - this.start) / 1000;
    const u = this.mat.uniforms;

    // the film on the cubes: swap the poster for the video once it plays
    const f = this.films[this.film];
    if (!f.live && f.video.readyState >= 2 && f.video.currentTime > 0) {
      f.live = true;
      u.map.value = f.texture;
    }

    // assembling: a steady pull while held, a quicker break on release
    const target = this.holding ? 1 : 0;
    const speed = this.holding ? 0.62 : 0.9;
    this.assemble = this.reduced ? target : THREE.MathUtils.clamp(this.assemble + Math.sign(target - this.assemble) * dt * speed, 0, 1);
    if (Math.abs(target - this.assemble) < 0.004) this.assemble = target;
    const whole = this.assemble >= 1;
    if (whole !== this.whole) {
      this.whole = whole;
      this.events.onAssembled?.(whole);
    }
    if (this.nextPending && this.assemble < 0.2) {
      this.nextPending = false;
      this.showFilm((this.film + 1) % this.films.length);
    }

    // turning: momentum and a slow drift while broken; square up to face you as it assembles
    if (!this.press.dragging) {
      this.velY += (0.07 - this.velY) * damp(0.8, dt);
      this.velX += (0 - this.velX) * damp(2, dt);
      this.rotY += this.velY * dt * (this.reduced ? 0 : 1);
      this.rotX += this.velX * dt;
      this.rotX += (0.15 - this.rotX) * damp(0.6, dt);
    }
    const a = this.assemble;
    const pull = a * a * (3 - 2 * a);
    const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
    if (pull > 0.001) {
      this.rotY = wrap(this.rotY);
    }
    this.group.rotation.y = this.rotY * (1 - pull);
    this.group.rotation.x = this.rotX * (1 - pull);

    // where the cursor is, in the cubes' own space, for the push
    this.pointerOn += ((this.pointerNdc.x < 2 && !this.press.dragging ? 1 : 0) - this.pointerOn) * damp(4, dt);
    if (this.pointerNdc.x < 2) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(this.pointerNdc, this.camera);
      const hit = new THREE.Vector3();
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -SHELL * 0.35 * this.group.scale.x), hit);
      this.group.updateMatrixWorld();
      u.uPointer.value.copy(this.group.worldToLocal(hit));
    }

    this.intro = Math.min(1, this.intro + dt / (this.reduced ? 0.01 : 1.8));
    u.uTime.value = t;
    u.uAssemble.value = this.assemble;
    u.uPointerOn.value = this.pointerOn;
    u.uFade.value = this.intro * this.intro * (3 - 2 * this.intro);
    this.finish.uniforms.uAmount.value = 0.004 + 0.012 * (1 - pull);
    this.finish.uniforms.uTime.value = t;

    this.composer.render();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((fn) => fn());
    for (const f of this.films) {
      f.video.pause();
      f.video.removeAttribute("src");
      f.video.load();
      f.texture.dispose();
      f.poster.dispose();
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    this.mat.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
