import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

// ===========================================================================
// HERO 22 — the gallery.
//
// One wide screen standing in a dark gallery, seen down a long lens from the
// middle of the room, the way architecture is photographed: verticals
// straight, everything converging on the screen.
//
// THE ROOM (metres; the camera stands at the origin, eye height 1.6, looking
// down -z):
//   Ceiling   a lattice of beams turned 45°, so the coffers between them are
//             diamonds. The coffers are light boxes; the brightest are real
//             area lights too, so they light the floor and the wall.
//   Wall      black, glossy, built from horizontal slabs.
//   Floor     polished concrete with a true planar reflection (the room drawn
//             a second time from below the floor), blurred into the long soft
//             streaks a polished floor gives.
//   Screen    a wide, thin slab on two feet. It shows the mark, then the films,
//             and lights the floor in front of it in their colour.
//
// THE SEQUENCE
//   Nothing runs until the fonts, the posters and every shader are ready, so
//   the opening never stutters. Then, on one clock:
//   1. The tubes strike, far end last: a flash, a dim glow, then they catch.
//      (Under three flashes a second; a plain fade with reduced motion.)
//   2. The camera walks in from the door the whole time, easing in and out.
//   3. The screen opens as hero 13's card: a slit widens to white and
//      16X9 & BEYOND rises into it. Then the way in opens.
//   Scroll, click or swipe up: the camera walks up to the screen, the letters
//   lift out and the card gives way to the films. Scroll up, swipe down or
//   Esc: back into the room. A click during the opening is kept: the opening
//   runs faster and the walk in follows it.
//
// CRAFT
//   Scripted moves are eased tweens on the clock; the hand-held layers (mouse
//   parallax, a slow breath, drag to look round) sit on top as damped offsets
//   and fade out as the camera reaches the screen, so the two never fight.
//   The quality tier is chosen per device and a governor lowers resolution if
//   frames run long. Rendering stops when the hero is off screen or hidden.
// ===========================================================================

export type Film = { src: string; poster: string };

export type StageEvents = {
  /** fonts, posters and shaders are in: the opening has begun */
  onStart?: () => void;
  /** the mark has landed: the way in is open */
  onReady?: () => void;
  onFocus?: (inside: boolean) => void;
  onFilm?: (index: number) => void;
  /** the pointer is over the screen, from the room */
  onHover?: (overScreen: boolean) => void;
  /** the GPU took the context away; show the page without the room */
  onLost?: () => void;
};

// ---------------------------------------------------------------- the room
const EYE = 1.6;
const HC = 2.66; // underside of the ceiling beams
const COFFER = 0.08; // how far the light boxes sit up between the beams
const LATTICE = 3.45; // side of each (turned) coffer square
const LAT_Z = -1.23; // shifts the lattice so a lit diamond sits right over the screen
const BEAM = 0.3;
const WALL_Z = -11.2;
const ROOM_W = 34;

// -------------------------------------------------------------- the screen
const SW = 4.6;
const SH = SW / 2.39; // a cinema screen; the films are cropped to fill
const S_BOTTOM = 0.27;
const S_Z = -10.45;
const S_DEPTH = 0.07;
const S_MID = S_BOTTOM + SH / 2;
const FILM_ASPECT = 16 / 9;
const FOV = 26; // the long lens

// ------------------------------------------------------------ the timeline
/** The opening, in seconds from the moment everything is ready. */
const OPEN = {
  ceil: 0.2, // the first tube strikes
  ceilLen: 1.8, // the whole ceiling, the far end last
  card: 2.0, // the white card opens out of its slit
  cardLen: 0.9,
  letters: 2.5, // 16X9 & BEYOND rise into it
  lettersLen: 0.9,
  ready: 3.4, // the way in opens
  dolly: 3.8, // the walk in from the door
};
const ENTER_S = 1.9; // walking up to the screen
const LEAVE_S = 1.7; // stepping back into the room
const FILM_HOLD = 9; // how long each film plays before the next
const FADE_S = 0.9; // the cross-fade between films
const RUSH = 3; // how much faster the opening runs once someone has asked to go in

const SQ2 = Math.SQRT2;
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOutQuart = (t: number) => 1 - Math.pow(1 - clamp01(t), 4);
const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
const cine = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const frac = (x: number) => x - Math.floor(x);
const WHITE = new THREE.Color(1, 1, 1);
const f = (n: number) => n.toFixed(6);

/**
 * A fluorescent tube coming on, 0 … 1 over its own little window p: it
 * strikes (a short flash), glows dimly, then catches and ramps up. The same
 * curve is written in GLSL below for the light boxes, so the panels and the
 * light they throw flicker together. Without flicker: a plain fade.
 */
function tube(p: number, s: number, flicker: boolean) {
  if (!flicker) return sstep(0.1, 0.9, p);
  const a = 0.08 + 0.1 * s;
  const flash = sstep(a, a + 0.02, p) * (1 - sstep(a + 0.09, a + 0.12, p)) * (0.55 + 0.25 * s);
  const b = a + 0.24 + 0.08 * s;
  const on = sstep(b, b + 0.3, p);
  const glow = sstep(a, a + 0.04, p) * 0.07;
  return Math.max(on, flash, glow);
}

/** When a coffer comes on in the cascade (0 first … 1 last): nearest first, the one over the screen last. */
const cofferOrder = (x: number, z: number) => clamp01(-z / 12) * 0.8 + (Math.min(Math.abs(x), 3) / 3) * 0.2;
/** How bright a coffer is, by its row. */
function cofferLevel(x: number) {
  const a = Math.abs(x);
  return a < 0.2 ? 1 : a < 3 ? 0.3 : a < 6 ? 0.1 : 0.04;
}

// --------------------------------------------------------------- shaders
const FS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// a separable gaussian, used to smear the floor's reflection
const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uStep;
  varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tSrc, vUv).rgb * 0.1964825501511404;
    c += texture2D(tSrc, vUv + uStep * 1.411764705882353).rgb * 0.2969069646728344;
    c += texture2D(tSrc, vUv - uStep * 1.411764705882353).rgb * 0.2969069646728344;
    c += texture2D(tSrc, vUv + uStep * 3.2941176470588234).rgb * 0.09447039785044732;
    c += texture2D(tSrc, vUv - uStep * 3.2941176470588234).rgb * 0.09447039785044732;
    c += texture2D(tSrc, vUv + uStep * 5.176470588235294).rgb * 0.010381362401148057;
    c += texture2D(tSrc, vUv - uStep * 5.176470588235294).rgb * 0.010381362401148057;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const WORLD_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vW;
  void main(){
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// The light boxes: the plane above the beams. Each diamond glows by its row,
// softly brighter in its middle, a little shaded where the beams meet it.
const COFFER_FRAG = /* glsl */ `
  uniform float uCeil;     // 0 … 1, the cascade
  uniform float uFlicker;  // 1 tubes strike, 0 a plain fade
  varying vec2 vUv;
  varying vec3 vW;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float tube(float p, float s){
    if (uFlicker < 0.5) return smoothstep(0.1, 0.9, p);
    float a = 0.08 + 0.1 * s;
    float flash = smoothstep(a, a + 0.02, p) * (1.0 - smoothstep(a + 0.09, a + 0.12, p)) * (0.55 + 0.25 * s);
    float b = a + 0.24 + 0.08 * s;
    float on = smoothstep(b, b + 0.3, p);
    float glow = smoothstep(a, a + 0.04, p) * 0.07;
    return max(on, max(flash, glow));
  }
  void main(){
    float s = ${f(LATTICE)};
    float wz = vW.z - ${f(LAT_Z)};
    vec2 uv = vec2(vW.x + wz, vW.x - wz) / ${f(SQ2)};
    vec2 cell = floor(uv / s);
    vec2 local = uv / s - cell - 0.5;            // -0.5 … 0.5 inside the coffer
    vec2 cc = (cell + 0.5) * s;                   // its centre, turned back
    float cx = (cc.x + cc.y) / ${f(SQ2)};
    float cz = (cc.x - cc.y) / ${f(SQ2)} + ${f(LAT_Z)};

    float ax = abs(cx);
    float level = ax < 0.2 ? 1.0 : (ax < 3.0 ? 0.3 : (ax < 6.0 ? 0.1 : 0.04));
    level *= (cz < -9.5 && ax > 0.2) ? 0.15 : 1.0; // the far boxes against the wall stay dark

    // the cascade: the same order, seed and curve as the lights in stage.ts
    float order = clamp(-cz / 12.0, 0.0, 1.0) * 0.8 + min(ax, 3.0) / 3.0 * 0.2;
    float seed = fract(cell.x * 0.618034 + cell.y * 0.414214);
    float on = tube(clamp((uCeil - order * 0.6) / 0.4, 0.0, 1.0), seed);

    float r = max(abs(local.x), abs(local.y)) * 2.0;     // 0 middle … 1 edge
    float glow = 0.74 + 0.26 * (1.0 - r * r);
    float rim = smoothstep(0.86, 1.0, r);                // shaded where it meets the beams
    float grain = 0.97 + 0.03 * hash(floor(vW.xz * 90.0));
    vec3 white = vec3(1.0, 0.99, 0.975);
    vec3 col = white * 0.62 * level * glow * (1.0 - 0.35 * rim) * grain * on;
    col += vec3(0.006); // even an unlit box is a pale panel
    gl_FragColor = vec4(col, 1.0);
  }
`;

// The screen. First the mark, as in hero 13: a white card opening out of a
// slit, 16X9 & BEYOND rising into it, cut out of the white. On entering, the
// letters lift out and the card gives way to the film (cross-fading to the next).
const SCREEN_FRAG = /* glsl */ `
  uniform sampler2D uA;
  uniform sampler2D uB;
  uniform sampler2D uMark;
  uniform float uMix;
  uniform float uCrop;   // share of the film's height that shows
  uniform float uCard;   // 0 … 1, the card opening out of its slit
  uniform float uLetY;   // where the letters are: 1 below, 0 in place, -1 lifted out
  uniform float uBrand;  // 1 the mark, 0 the film
  uniform float uHover;  // the pointer is over the screen
  uniform float uSlit;   // the slit glows up just before the card opens out of it
  varying vec2 vUv;
  varying vec3 vW;
  vec3 toLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  void main(){
    vec2 fuv = vec2(vUv.x, 0.5 + (vUv.y - 0.5) * uCrop);
    vec3 film = mix(toLinear(texture2D(uA, fuv).rgb), toLinear(texture2D(uB, fuv).rgb), uMix);
    // an LED wall: never quite black, very slightly brighter in the middle
    film = film * (0.96 + 0.04 * (1.0 - length(vUv - 0.5))) + vec3(0.004);

    float aa = fwidth(vUv.y);
    float card = 1.0 - smoothstep(-aa, aa, abs(vUv.y - 0.5) - uCard * 0.5);
    vec2 luv = vec2(vUv.x, vUv.y + uLetY);
    float inside = step(0.0, luv.y) * step(luv.y, 1.0);
    float letter = texture2D(uMark, luv).a * inside;
    vec3 mark = vec3(0.9 + 0.05 * uHover) * card * uSlit * (1.0 - letter);

    gl_FragColor = vec4(mix(film, mark, uBrand), 1.0);
  }
`;

const SHADOW_FRAG = /* glsl */ `
  uniform float uStrength;
  uniform vec2 uSoft;
  varying vec2 vUv;
  void main(){
    vec2 d = abs(vUv - 0.5) * 2.0;
    float a = (1.0 - smoothstep(1.0 - uSoft.x, 1.0, d.x)) * (1.0 - smoothstep(1.0 - uSoft.y, 1.0, d.y));
    gl_FragColor = vec4(0.0, 0.0, 0.0, a * uStrength);
  }
`;

// ------------------------------------------------------------ the concrete
/** Polished concrete: soft clouds, a little grain, long polishing marks. Tiles. */
function concreteTexture(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const octave = (n: number) => {
    const v = Array.from({ length: n * n }, () => Math.random());
    return (x: number, y: number) => {
      const fx = (x / size) * n;
      const fy = (y / size) * n;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const s = (k: number) => k * k * (3 - 2 * k);
      const at = (a: number, b: number) => v[(b % n) * n + (a % n)];
      const a = at(ix, iy);
      const b = at(ix + 1, iy);
      const cc = at(ix, iy + 1);
      const d = at(ix + 1, iy + 1);
      return a + (b - a) * s(tx) + (cc - a) * s(ty) + (a - b - cc + d) * s(tx) * s(ty);
    };
  };
  const o1 = octave(4);
  const o2 = octave(12);
  const o3 = octave(48);
  const streak = octave(64);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // polishing marks run across the room, so stretch one octave sideways
      const marks = streak(Math.floor(x / 8), y);
      const v = o1(x, y) * 0.45 + o2(x, y) * 0.3 + o3(x, y) * 0.15 + marks * 0.1;
      const k = Math.round(Math.min(1, Math.max(0, 0.2 + v * 0.75 + (Math.random() - 0.5) * 0.06)) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.anisotropy = 8;
  return tex;
}

// ------------------------------------------------------------ quality tiers
type Tier = {
  dpr: number; // pixel ratio cap
  samples: number; // MSAA
  refl: number; // the mirror's resolution, as a share of the screen's
  sideLights: boolean; // the dimmer side rows are real lights too
  bloom: boolean;
};

/** Phones, small screens and modest machines get a lighter room; the look stays the same. */
function detectTier(): Tier {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const dpr = window.devicePixelRatio || 1;
  const light = coarse || small || cores < 4 || memory < 4;
  return light
    ? { dpr: Math.min(dpr, 1.25), samples: 2, refl: 0.35, sideLights: false, bloom: false }
    : { dpr: Math.min(dpr, 1.5), samples: 4, refl: 0.5, sideLights: true, bloom: true };
}

type Clip = { video: HTMLVideoElement; tex: THREE.VideoTexture; poster: THREE.Texture; live: boolean };
type Pose = { pos: THREE.Vector3; look: THREE.Vector3 };
type Spot = "door" | "room" | "screen";
const pose = (): Pose => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() });

/** Resolve after `p` or after `ms`, whichever comes first; never throws. */
const within = (p: Promise<unknown>, ms: number) =>
  Promise.race([p.catch(() => undefined), new Promise<void>((r) => setTimeout(r, ms))]);

export class Gallery {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
  private tier: Tier;
  private pr: number;
  private reflScale: number;

  // the floor's mirror
  private mirrorCam = new THREE.PerspectiveCamera();
  private reflRT: THREE.WebGLRenderTarget;
  private blurA: THREE.WebGLRenderTarget;
  private blurB: THREE.WebGLRenderTarget;
  private blurQuad: FullScreenQuad;
  private blurMat: THREE.ShaderMaterial;
  private texMat = new THREE.Matrix4();
  private floor!: THREE.Mesh;
  private hideInMirror: THREE.Object3D[] = [];

  private coffers!: THREE.ShaderMaterial;
  private cofferLights: { light: THREE.RectAreaLight; level: number; order: number; seed: number }[] = [];
  private screenMat!: THREE.ShaderMaterial;
  private screenMesh!: THREE.Mesh;
  private screenLight!: THREE.RectAreaLight;
  private screenColour = new THREE.Color(0.5, 0.45, 0.4);
  private sampledColour = new THREE.Color();
  private markCanvas: HTMLCanvasElement;
  private markTex: THREE.CanvasTexture;
  private sampler: CanvasRenderingContext2D | null;

  // films
  private clips: Clip[];
  private posterLoads: Promise<void>[] = [];
  private film = 0;
  private next = -1;
  private mix = 0;
  private filmSince = 0;

  // the clock and the story
  private clock = 0;
  private frame = 0;
  private started = false;
  private ready = false;
  private pendingEnter = false;
  private focus = false;
  private inputOn = true;
  private flicker: boolean;
  private brandMode: "intro" | "out" | "in" = "intro";
  private brandAt = 0;
  private brand = 1;
  private hovering = false;
  private hoverAmt = 0;

  // the camera: a scripted move, with hand-held layers on top
  private base = pose();
  private move = { from: pose(), to: "room" as Spot, t: 0, dur: OPEN.dolly, intro: true, fromW: 0, toW: 0 };
  private screenW = 0; // 0 in the room … 1 at the screen
  private target = pose();
  private look = new THREE.Vector3();
  private mouse = new THREE.Vector2();
  private par = new THREE.Vector2();
  private yaw = 0;
  private yawTo = 0;
  private pitch = 0;
  private pitchTo = 0;
  private drag = { down: false, x: 0, y: 0, yaw: 0, pitch: 0, moved: false, mouse: false };
  private pointerIn = false; // a mouse is over the hero
  private ray = new THREE.Raycaster();

  // running
  private raf = 0;
  private last = 0;
  private running = false;
  private onScreen = true;
  private perf = { sum: 0, n: 0 };
  private disposed = false;
  private cleanups: (() => void)[] = [];

  constructor(
    private host: HTMLElement,
    films: Film[],
    private events: StageEvents = {},
    private reduced = false,
  ) {
    this.tier = detectTier();
    this.pr = this.tier.dpr;
    this.reflScale = this.tier.refl;
    this.flicker = !reduced;

    // throws where WebGL 2 is missing; the page catches it and shows the films without the room
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(this.pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 1);
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    host.appendChild(canvas);

    RectAreaLightUniformsLib.init();

    // films: the first loads now, the rest just before they are needed
    const loader = new THREE.TextureLoader();
    this.clips = films.map((fl, i) => {
      const video = document.createElement("video");
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute("muted", ""); // iOS reads the attribute, not the property
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.preload = i === 0 ? "auto" : "metadata";
      video.src = fl.src;
      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.NoColorSpace; // decoded in the shader, the same in every browser
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      let done = () => {};
      this.posterLoads.push(new Promise<void>((r) => (done = r)));
      const poster = loader.load(fl.poster, () => done(), undefined, () => done());
      poster.colorSpace = THREE.NoColorSpace;
      return { video, tex, poster, live: false };
    });

    // 16X9 & BEYOND, cut into the screen (drawn again once the font is in)
    this.markCanvas = document.createElement("canvas");
    this.markCanvas.width = 2048;
    this.markCanvas.height = Math.round(2048 / (SW / SH));
    this.markTex = new THREE.CanvasTexture(this.markCanvas);
    this.markTex.colorSpace = THREE.NoColorSpace;
    this.markTex.anisotropy = 8;

    const s = document.createElement("canvas");
    s.width = 16;
    s.height = 8;
    this.sampler = s.getContext("2d", { willReadFrequently: true });

    // the floor's mirror and its blur
    this.reflRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: true });
    this.blurA = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
    this.blurB = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    this.blurQuad = new FullScreenQuad(this.blurMat);

    this.build();

    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: this.tier.samples }),
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.08, 0.4, 0.97); // a breath of glow; keeps the mark crisp
    this.bloom.enabled = this.tier.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // where the camera starts: at the door, or already in the room with reduced motion
    this.spot(reduced ? "room" : "door", this.base);
    this.move.from.pos.copy(this.base.pos);
    this.move.from.look.copy(this.base.look);
    if (reduced) this.move.t = 1;

    this.resize();
    this.bind();
    this.loop = this.loop.bind(this);
    this.setRunning(true);
    void this.prime();
  }

  // -------------------------------------------------------------------------
  // Getting ready: the font for the mark, the posters, every shader compiled,
  // one warm-up frame. Only then does the clock start.
  // -------------------------------------------------------------------------

  private async prime() {
    const family = getComputedStyle(this.host).fontFamily || "sans-serif";
    if (document.fonts) await within(document.fonts.load(`700 100px ${family}`), 2500);
    if (this.disposed) return;
    this.drawMark();
    await within(Promise.all(this.posterLoads), 4000);
    if (this.disposed) return;
    this.update(0);
    // compile every shader before the first frame: in parallel where the GPU can, at once where it can't
    if (this.renderer.extensions.has("KHR_parallel_shader_compile")) {
      await within(this.renderer.compileAsync(this.scene, this.camera), 6000);
    } else {
      this.renderer.compile(this.scene, this.camera);
    }
    if (this.disposed) return;
    this.renderFrame(); // compiles the mirror, the blur and the post passes too
    this.started = true;
    this.events.onStart?.();
  }

  // -------------------------------------------------------------------------
  // The room
  // -------------------------------------------------------------------------

  private build() {
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.62, metalness: 0 });

    // ---- ceiling: the light boxes, then the beams under them
    this.coffers = new THREE.ShaderMaterial({
      vertexShader: WORLD_VERT,
      fragmentShader: COFFER_FRAG,
      uniforms: { uCeil: { value: 0 }, uFlicker: { value: this.flicker ? 1 : 0 } },
    });
    const boxes = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 30), this.coffers);
    boxes.rotation.x = Math.PI / 2; // facing down
    boxes.position.set(0, HC + COFFER, -6);
    this.scene.add(boxes);

    const beamMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9, metalness: 0 });
    const beamGeo = new THREE.BoxGeometry(46, COFFER, BEAM);
    const lines = [] as { c: number; turn: number }[];
    for (let k = -9; k <= 9; k++) {
      lines.push({ c: SQ2 * k * LATTICE, turn: Math.PI / 4 }); // x + z = c
      lines.push({ c: SQ2 * k * LATTICE, turn: -Math.PI / 4 }); // x - z = c
    }
    const beams = new THREE.InstancedMesh(beamGeo, beamMat, lines.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    const zc = -6;
    lines.forEach((ln, i) => {
      let x: number;
      let z: number;
      if (ln.turn > 0) {
        const c = ln.c + LAT_Z; // x + z = c
        x = (c - zc) / 2;
        z = c - x;
      } else {
        const c = ln.c - LAT_Z; // x - z = c
        x = (c + zc) / 2;
        z = x - c;
      }
      q.setFromAxisAngle(up, ln.turn);
      m.compose(new THREE.Vector3(x, HC + COFFER / 2, z), q, one);
      beams.setMatrixAt(i, m);
    });
    this.scene.add(beams);

    // the lit boxes are real lights (the brightest few; all of the middle row)
    for (let i = -6; i <= 6; i++) {
      for (let j = -6; j <= 6; j++) {
        const u = (i + 0.5) * LATTICE;
        const v = (j + 0.5) * LATTICE;
        const x = (u + v) / SQ2;
        const z = (u - v) / SQ2 + LAT_Z;
        if (z < WALL_Z || z > 2.5) continue;
        if (Math.abs(x) > 3) continue;
        if (z < -9.5 && Math.abs(x) > 0.2) continue; // dark against the wall
        if (!this.tier.sideLights && Math.abs(x) > 0.2) continue;
        const light = new THREE.RectAreaLight(0xfffcf6, 0, LATTICE * 0.97, LATTICE * 0.97);
        light.position.set(x, HC + COFFER - 0.02, z);
        light.lookAt(x, 0, z);
        light.rotateZ(Math.PI / 4);
        this.scene.add(light);
        this.cofferLights.push({ light, level: cofferLevel(x), order: cofferOrder(x, z), seed: frac(i * 0.618034 + j * 0.414214) });
      }
    }

    // ---- back wall: black slabs, glossy, each set a hair proud of the last
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x080809, roughness: 0.22, metalness: 0 });
    const wallH = HC + COFFER;
    const rows = 9;
    const slabH = wallH / rows;
    for (let r = 0; r < rows; r++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, slabH - 0.012, 0.3), slabMat);
      slab.position.set(0, slabH * r + slabH / 2, WALL_Z - 0.15 + (r % 2) * 0.018);
      this.scene.add(slab);
    }
    // a shadow gap where the wall meets the floor
    const gap = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 0.05), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    gap.position.set(0, 0.025, WALL_Z + 0.02);
    this.scene.add(gap);
    // side walls, out of shot, so the mirror has something there
    for (const sx of [-ROOM_W / 2, ROOM_W / 2]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(30, wallH), black);
      side.position.set(sx, wallH / 2, -6);
      side.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(side);
    }

    // ---- the screen
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(SW + 0.03, SH + 0.03, S_DEPTH),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.55, metalness: 0.2 }),
    );
    body.position.set(0, S_MID, S_Z - S_DEPTH / 2);
    this.scene.add(body);

    this.screenMat = new THREE.ShaderMaterial({
      vertexShader: WORLD_VERT,
      fragmentShader: SCREEN_FRAG,
      uniforms: {
        uA: { value: this.clips[0].poster },
        uB: { value: this.clips[0].poster },
        uMark: { value: this.markTex },
        uMix: { value: 0 },
        uCrop: { value: FILM_ASPECT / (SW / SH) },
        uCard: { value: 0 },
        uLetY: { value: 1 },
        uBrand: { value: 1 },
        uHover: { value: 0 },
        uSlit: { value: 0 },
      },
    });
    this.screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), this.screenMat);
    this.screenMesh.position.set(0, S_MID, S_Z + 0.001);
    this.scene.add(this.screenMesh);

    // two feet, set back
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4, metalness: 0.4 });
    for (const lx of [-SW / 2 + 0.62, SW / 2 - 0.62]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, S_BOTTOM + 0.02, 0.06), legMat);
      leg.position.set(lx, (S_BOTTOM + 0.02) / 2, S_Z - S_DEPTH / 2);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.5), legMat);
      foot.position.set(lx, 0.009, S_Z - S_DEPTH / 2);
      this.scene.add(leg, foot);
    }

    // the screen lights the room in front of it
    this.screenLight = new THREE.RectAreaLight(0xffffff, 0, SW, SH);
    this.screenLight.position.set(0, S_MID, S_Z + 0.02);
    this.screenLight.lookAt(0, S_MID, 0);
    this.scene.add(this.screenLight);

    // ---- floor: polished concrete with a mirror in it
    const concrete = concreteTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x8c857f,
      map: concrete,
      roughness: 0.8,
      roughnessMap: concrete,
      metalness: 0,
    });
    const uRefl = { value: this.reflRT.texture };
    const uBlur = { value: this.blurB.texture };
    const uTexMat = { value: this.texMat };
    floorMat.onBeforeCompile = (shader) => {
      shader.uniforms.uRefl = uRefl;
      shader.uniforms.uReflBlur = uBlur;
      shader.uniforms.uTexMat = uTexMat;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform mat4 uTexMat;\nvarying vec4 vReflUv;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvReflUv = uTexMat * (modelMatrix * vec4(transformed, 1.0));");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D uRefl;\nuniform sampler2D uReflBlur;\nvarying vec4 vReflUv;")
        .replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>
          {
            vec2 ruv = vReflUv.xy / vReflUv.w;
            vec3 sharp = texture2D(uRefl, ruv).rgb;
            vec3 soft = texture2D(uReflBlur, ruv).rgb;
            // rougher patches blur the reflection more and show less of it
            float r = roughnessFactor;
            vec3 refl = mix(sharp, soft, clamp(0.7 + (r - 0.62) * 2.2, 0.5, 0.98));
            float ndv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
            float fres = 0.06 + 0.94 * pow(1.0 - ndv, 5.0);
            float sheen = clamp(1.25 - r * 0.9, 0.25, 1.0);
            gl_FragColor.rgb += refl * fres * sheen * 0.78;
          }`,
        );
    };
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.scene.add(this.floor);

    // soft contact shadows on the floor: under the screen and its feet, and along the wall
    const shadow = (w: number, d: number, x: number, z: number, strength: number, soft: [number, number]) => {
      const sm = new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT,
        fragmentShader: SHADOW_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: { uStrength: { value: strength }, uSoft: { value: new THREE.Vector2(...soft) } },
      });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), sm);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.003, z);
      p.renderOrder = 1;
      this.scene.add(p);
      this.hideInMirror.push(p);
    };
    shadow(SW + 0.5, 0.9, 0, S_Z - 0.05, 0.55, [0.35, 0.8]);
    for (const lx of [-SW / 2 + 0.62, SW / 2 - 0.62]) shadow(0.5, 0.8, lx, S_Z - S_DEPTH / 2, 0.75, [0.8, 0.8]);
    shadow(ROOM_W, 1.4, 0, WALL_Z + 0.7, 0.6, [0.02, 1.0]);
  }

  // -------------------------------------------------------------------------
  // The mark, as hero 13 sets it: 16X9 in bold, tracked tight, & BEYOND tiny on
  // the same baseline, © in the corner. Drawn once; the shader moves it.
  // -------------------------------------------------------------------------

  private drawMark() {
    const g = this.markCanvas.getContext("2d")!;
    const W = this.markCanvas.width;
    const H = this.markCanvas.height;
    g.clearRect(0, 0, W, H);
    const family = getComputedStyle(this.host).fontFamily || "sans-serif";
    const TRACK = -0.03;
    const CAP = 0.727;
    const SUB_SCALE = 0.17;
    const SUB_GAP = 0.07;
    // draw a word letter by letter with the tracking; returns its width
    const word = (text: string, size: number, x: number, y: number, draw: boolean) => {
      g.font = `700 ${size}px ${family}`;
      let cx = x;
      for (const ch of text) {
        if (draw) g.fillText(ch, cx, y);
        cx += g.measureText(ch).width + TRACK * size;
      }
      return cx - x - TRACK * size;
    };
    const tw = word("16X9", 100, 0, 0, false);
    const ts = word("& BEYOND", 100, 0, 0, false);
    const inner = W * 0.8;
    const fs = (100 * inner) / (tw + 100 * SUB_GAP + ts * SUB_SCALE);
    const total = (fs * tw) / 100 + fs * SUB_GAP + (fs * SUB_SCALE * ts) / 100;
    const x0 = (W - total) / 2;
    const base = H / 2 + (fs * CAP) / 2;
    g.fillStyle = "#000";
    word("16X9", fs, x0, base, true);
    word("& BEYOND", fs * SUB_SCALE, x0 + (fs * tw) / 100 + fs * SUB_GAP, base, true);
    g.font = `600 ${Math.max(14, W * 0.016)}px ${family}`;
    g.textAlign = "right";
    g.fillText("©", W - W * 0.03, H - W * 0.028);
    g.textAlign = "left";
    this.markTex.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    const aspect = w / h;
    // The long lens frames the screen at about half the width; where the page
    // is narrow, open the lens until the whole screen fits.
    const need = Math.atan(((SW / 2) * 1.12) / Math.abs(S_Z) / aspect) * 2;
    this.camera.fov = Math.max(FOV, THREE.MathUtils.radToDeg(need));
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    const rw = Math.max(2, Math.round(w * this.pr * this.reflScale));
    const rh = Math.max(2, Math.round(h * this.pr * this.reflScale));
    this.reflRT.setSize(rw, rh);
    this.blurA.setSize(Math.max(2, rw >> 1), Math.max(2, rh >> 1));
    this.blurB.setSize(Math.max(2, rw >> 1), Math.max(2, rh >> 1));
  }

  /** Where the camera stands for each part of the story. */
  private spot(where: Spot, out: Pose) {
    if (where === "door") {
      out.pos.set(0, EYE + 0.22, 4.2);
      out.look.set(0, EYE + 0.08, S_Z);
    } else if (where === "room") {
      out.pos.set(0, EYE, 0);
      out.look.set(0, EYE, S_Z);
    } else {
      // close enough that the screen fills most of the width (or height, on very wide pages)
      const v = THREE.MathUtils.degToRad(this.camera.fov / 2);
      const h = Math.atan(Math.tan(v) * this.camera.aspect);
      const fill = this.camera.aspect < 1 ? 0.94 : 0.84;
      const dist = Math.max(SW / 2 / fill / Math.tan(h), SH / 2 / 0.8 / Math.tan(v));
      out.pos.set(0, S_MID, S_Z + dist);
      out.look.set(0, S_MID, S_Z);
    }
  }

  // -------------------------------------------------------------------------
  // Running: only while the hero is on screen and the tab is visible
  // -------------------------------------------------------------------------

  private setRunning(on: boolean) {
    if (this.disposed) on = false;
    if (on === this.running) return;
    this.running = on;
    if (on) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    } else {
      cancelAnimationFrame(this.raf);
    }
  }

  private syncRunning() {
    this.setRunning(this.onScreen && !document.hidden);
  }

  /** If frames run long, give up resolution before smoothness. */
  private govern(raw: number) {
    if (raw > 0.25) return; // a tab switch or a hitch, not the steady state
    this.perf.sum += raw;
    this.perf.n++;
    if (this.perf.n < 90) return;
    const avg = this.perf.sum / this.perf.n;
    this.perf.sum = 0;
    this.perf.n = 0;
    if (avg < 1 / 40) return;
    if (this.pr > 1) this.pr = Math.max(1, this.pr - 0.25);
    else if (this.reflScale > 0.25) this.reflScale = 0.25;
    else if (this.bloom.enabled) this.bloom.enabled = false;
    else return;
    this.resize();
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private bind() {
    const el = this.host;
    const area = el.parentElement ?? el; // the whole hero answers scroll and swipes
    const on = <K extends keyof WindowEventMap>(
      t: HTMLElement | Window | Document,
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.cleanups.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    const ndc = new THREE.Vector2();
    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const overScreen = (e: PointerEvent) => this.hits(toNdc(e));

    on(el, "pointerdown", (e) => {
      if (!this.inputOn) return;
      const mouse = e.pointerType !== "touch";
      this.drag = { down: true, x: e.clientX, y: e.clientY, yaw: this.yawTo, pitch: this.pitchTo, moved: false, mouse };
      if (mouse) el.setPointerCapture(e.pointerId);
    });
    on(el, "pointermove", (e) => {
      const mouse = e.pointerType !== "touch";
      if (mouse) {
        this.mouse.copy(toNdc(e));
        this.pointerIn = true;
      }
      if (!this.drag.down) {
        this.setHover(mouse && !this.focus && this.started && this.hits(this.mouse));
        return;
      }
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 6) this.drag.moved = true;
      // look round the room by dragging (mouse and pen; on touch, a swipe is the way in)
      if (this.drag.mouse && !this.focus && !this.reduced) {
        this.yawTo = THREE.MathUtils.clamp(this.drag.yaw - dx * 0.0016, -0.22, 0.22);
        this.pitchTo = THREE.MathUtils.clamp(this.drag.pitch + dy * 0.0008, -0.05, 0.07);
      }
    });
    on(el, "pointerup", (e) => {
      if (!this.drag.down) return;
      this.drag.down = false;
      if (this.drag.moved || !this.inputOn) return;
      // the screen is the way in; once inside, the page is the film
      if (!this.focus && overScreen(e)) this.enter();
    });
    on(el, "pointercancel", () => (this.drag.down = false));
    on(el, "pointerleave", () => {
      this.mouse.set(0, 0);
      this.pointerIn = false;
      this.setHover(false);
    });

    // keyboard: the keys that scroll, scroll; Esc steps back; arrows change films
    on(window, "keydown", (e) => {
      if (!this.inputOn || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (typing) return;
      const onPage = !t || t === document.body || t === document.documentElement;
      if (e.key === "Escape") this.leave();
      else if (onPage && (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ")) {
        e.preventDefault();
        this.enter();
      } else if (onPage && (e.key === "ArrowUp" || e.key === "PageUp")) {
        e.preventDefault();
        this.leave();
      } else if (this.focus && e.key === "ArrowRight") this.showFilm(this.film + 1);
      else if (this.focus && e.key === "ArrowLeft") this.showFilm(this.film - 1);
    });

    // scroll down goes in, scroll up comes back out: one gesture, one step
    let wheelAt = 0;
    on(
      area,
      "wheel",
      (e) => {
        e.preventDefault();
        if (!this.inputOn) return;
        const now = performance.now();
        if (now - wheelAt < 1100 || Math.abs(e.deltaY) < 6) return;
        wheelAt = now;
        if (e.deltaY > 0) this.enter();
        else this.leave();
      },
      { passive: false },
    );
    // and on touch: swipe up goes in, swipe down comes back out
    let touchY = 0;
    let touchX = 0;
    on(area, "touchstart", (e) => {
      touchY = e.touches[0].clientY;
      touchX = e.touches[0].clientX;
    }, { passive: true });
    on(area, "touchend", (e) => {
      if (!this.inputOn) return;
      const dy = e.changedTouches[0].clientY - touchY;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dy) < Math.abs(dx) * 1.2) {
        // sideways: change films, once inside
        if (this.focus && Math.abs(dx) > 50) this.showFilm(this.film + (dx < 0 ? 1 : -1));
        return;
      }
      if (dy < -40) this.enter();
      else if (dy > 60) this.leave();
    }, { passive: true });

    // size, visibility, and the GPU going away
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(el);
    this.cleanups.push(() => ro.disconnect());
    const io = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      this.syncRunning();
    });
    io.observe(el);
    this.cleanups.push(() => io.disconnect());
    const onVisible = () => {
      this.syncRunning();
      const v = this.clips[this.film].video;
      if (document.hidden) v.pause();
      else if (this.focus) v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisible));
    const canvas = this.renderer.domElement;
    const onLost = () => {
      this.setRunning(false);
      this.events.onLost?.();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    this.cleanups.push(() => canvas.removeEventListener("webglcontextlost", onLost));
  }

  /** Is this point (in normalised device coordinates) on the screen? */
  private hits(p: THREE.Vector2) {
    this.ray.setFromCamera(p, this.camera);
    return this.ray.intersectObject(this.screenMesh, false).length > 0;
  }

  private setHover(h: boolean) {
    if (h === this.hovering) return;
    this.hovering = h;
    this.events.onHover?.(h);
  }

  /** While a menu is open over the hero, it stops answering. */
  setInput(on: boolean) {
    this.inputOn = on;
    if (!on) {
      this.drag.down = false;
      this.mouse.set(0, 0);
    }
  }

  /** Go in. Asked during the opening, the opening hurries and the walk in follows it. */
  enter() {
    if (this.focus) return;
    if (!this.ready) {
      this.pendingEnter = true;
      return;
    }
    this.setFocus(true);
  }

  leave() {
    this.pendingEnter = false;
    this.setFocus(false);
  }

  private setFocus(f: boolean) {
    if (f === this.focus || !this.ready) return;
    this.focus = f;
    this.brandMode = f ? "out" : "in";
    this.brandAt = this.clock;
    this.drag.down = false;
    this.yawTo = 0;
    this.pitchTo = 0;
    if (f) {
      const c = this.clips[this.film];
      c.video.currentTime = 0;
      c.video.play().catch(() => {});
      this.filmSince = this.clock + 1.2; // the film is in view about then
      this.prefetch(this.film + 1);
      this.setHover(false);
    }
    // the walk: from wherever the camera is now, eased in and out
    const m = this.move;
    m.from.pos.copy(this.base.pos);
    m.from.look.copy(this.base.look);
    m.to = f ? "screen" : "room";
    m.t = 0;
    m.dur = this.reduced ? 0.0001 : f ? ENTER_S : LEAVE_S;
    m.intro = false;
    m.fromW = this.screenW;
    m.toW = f ? 1 : 0;
    this.events.onFocus?.(f);
  }

  /** Cross-fade to another film (wraps round). */
  showFilm(index: number) {
    const n = this.clips.length;
    const i = ((index % n) + n) % n;
    if (!this.focus || i === this.film || this.next >= 0) return;
    this.next = i;
    this.mix = 0;
    const c = this.clips[i];
    c.video.currentTime = 0;
    c.video.play().catch(() => {});
    this.prefetch(i + 1);
    this.events.onFilm?.(i);
  }

  private prefetch(index: number) {
    const v = this.clips[((index % this.clips.length) + this.clips.length) % this.clips.length].video;
    if (v.preload !== "auto") {
      v.preload = "auto";
      v.load();
    }
  }

  /** How far through its turn the film on screen is, 0 … 1 (for the progress line). */
  get filmProgress() {
    if (!this.focus) return 0;
    if (this.next >= 0) return 1;
    return clamp01((this.clock - this.filmSince) / FILM_HOLD);
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private texOf(c: Clip) {
    if (!c.live && c.video.readyState >= 2 && c.video.currentTime > 0) c.live = true;
    return c.live ? c.tex : c.poster;
  }

  /** The film's average colour, so the screen's light on the floor matches it. */
  private sampleColour() {
    const g = this.sampler;
    const c = this.clips[this.next >= 0 && this.mix > 0.5 ? this.next : this.film];
    const src = (c.live ? c.video : c.poster.image) as CanvasImageSource | undefined;
    if (!g || !src) return;
    try {
      g.drawImage(src, 0, 0, 16, 8);
      const d = g.getImageData(0, 0, 16, 8).data;
      let r = 0;
      let gg = 0;
      let b = 0;
      for (let k = 0; k < d.length; k += 4) {
        r += d[k];
        gg += d[k + 1];
        b += d[k + 2];
      }
      const n = (d.length / 4) * 255;
      this.screenColour.lerp(this.sampledColour.setRGB(r / n, gg / n, b / n, THREE.SRGBColorSpace), 0.3);
    } catch {
      // not readable yet
    }
  }

  private loop(now: number) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = (now - this.last) / 1000;
    this.last = now;
    if (!this.started) return;
    this.govern(raw);
    this.update(Math.min(raw, 0.25));
    this.renderFrame();
  }

  private update(dt: number) {
    this.frame++;
    // the opening hurries once someone has asked to go in
    const sdt = dt * (this.pendingEnter && !this.ready ? RUSH : 1);
    this.clock += sdt;
    const c = this.clock;

    // ---- the ceiling: tube by tube, nearest first, the one over the screen last
    const ceil = clamp01((c - OPEN.ceil) / OPEN.ceilLen);
    this.coffers.uniforms.uCeil.value = ceil;
    for (const l of this.cofferLights) {
      const p = clamp01((ceil - l.order * 0.6) / 0.4);
      l.light.intensity = 3.0 * l.level * tube(p, l.seed, this.flicker);
    }

    // ---- the screen: the mark comes on, then (on entering) gives way to the film
    if (this.frame % 6 === 0 && this.pointerIn && !this.drag.down) {
      this.setHover(!this.focus && this.hits(this.mouse)); // the camera drifts under a still cursor
    }
    this.hoverAmt += ((this.hovering && this.ready && !this.focus ? 1 : 0) - this.hoverAmt) * damp(7, dt);
    let card = 1;
    let slit = 1;
    let letY = 0;
    let brand = 1;
    const s = c - this.brandAt;
    if (this.brandMode === "intro") {
      slit = sstep(OPEN.card - 0.45, OPEN.card, c);
      card = cine((c - OPEN.card) / OPEN.cardLen);
      letY = 1 - easeOutQuart((c - OPEN.letters) / OPEN.lettersLen);
      if (!this.ready && c >= OPEN.ready) {
        this.ready = true;
        this.events.onReady?.();
        if (this.pendingEnter) {
          this.pendingEnter = false;
          this.setFocus(true);
        }
      }
    } else if (this.brandMode === "out") {
      letY = -easeInCubic(s / 0.55);
      brand = 1 - cine((s - 0.4) / 0.9);
    } else {
      brand = cine(s / 0.7);
      letY = 1 - easeOutQuart((s - 0.5) / 0.9);
      // back in the room and the mark is up: the films can rest
      if (brand >= 1) for (const clip of this.clips) if (!clip.video.paused) clip.video.pause();
    }
    letY -= 0.012 * this.hoverAmt; // the mark lifts a hair under the pointer: an invitation
    if (this.reduced) letY = 0; // with reduced motion the letters simply come and go with the card
    this.brand = brand;
    const u = this.screenMat.uniforms;
    u.uCard.value = card;
    u.uLetY.value = letY;
    u.uBrand.value = brand;
    u.uHover.value = this.hoverAmt;
    u.uSlit.value = slit;

    // ---- films: posters until the video plays; cross-fades; the next one in turn
    const cur = this.clips[this.film];
    u.uA.value = this.texOf(cur);
    if (this.next >= 0) {
      u.uB.value = this.texOf(this.clips[this.next]);
      this.mix = Math.min(1, this.mix + sdt / FADE_S);
      if (this.mix >= 1) {
        cur.video.pause();
        this.film = this.next;
        this.next = -1;
        this.mix = 0;
        this.filmSince = c;
        u.uA.value = this.texOf(this.clips[this.film]);
      }
    } else if (this.focus && brand < 0.01 && c - this.filmSince > FILM_HOLD) {
      this.showFilm(this.film + 1);
    }
    u.uMix.value = this.mix * this.mix * (3 - 2 * this.mix);
    if (this.frame % 4 === 0 && brand < 1) this.sampleColour();
    // the white card lights the floor white; the film, in its own colour
    this.screenLight.color.copy(this.screenColour).lerp(WHITE, brand);
    this.screenLight.intensity = card * slit * (2.6 * brand * (1 + 0.12 * this.hoverAmt) + 1.6 * (1 - brand));

    // ---- the camera: the scripted walk …
    const m = this.move;
    m.t = Math.min(1, m.t + sdt / m.dur);
    const e = m.intro ? easeInOutSine(m.t) : cine(m.t);
    this.spot(m.to, this.target);
    this.base.pos.lerpVectors(m.from.pos, this.target.pos, e);
    this.base.look.lerpVectors(m.from.look, this.target.look, e);
    this.screenW = m.fromW + (m.toW - m.fromW) * e;

    // … and the hand-held layers on top, which fade out at the screen
    const roomW = 1 - this.screenW;
    this.yaw += (this.yawTo - this.yaw) * damp(5, dt);
    this.pitch += (this.pitchTo - this.pitch) * damp(5, dt);
    if (!this.drag.down) {
      this.yawTo += -this.yawTo * damp(0.8, dt); // drifts back to the middle
      this.pitchTo += -this.pitchTo * damp(0.8, dt);
    }
    this.par.x += (this.mouse.x - this.par.x) * damp(3, dt);
    this.par.y += (this.mouse.y - this.par.y) * damp(3, dt);
    const P = this.camera.position.copy(this.base.pos);
    const L = this.look.copy(this.base.look);
    if (!this.reduced) {
      // drag: orbit the screen
      const d = P.z - S_Z;
      P.x += Math.sin(this.yaw) * d * roomW;
      P.z += (Math.cos(this.yaw) * d - d) * roomW;
      P.y += Math.sin(this.pitch) * d * 0.3 * roomW;
      // the mouse: the camera leans, so the beams slide against the screen
      const ax = 0.3 * roomW + 0.07 * this.screenW;
      const ay = 0.1 * roomW + 0.03 * this.screenW;
      P.x += this.par.x * ax;
      P.y += this.par.y * ay;
      L.x += this.par.x * ax * 0.15;
      // a slow breath, so the room never quite stands still
      P.x += Math.sin(c * 0.21) * 0.03 * roomW;
      P.y += Math.sin(c * 0.27 + 1.3) * 0.012 * roomW;
    }
    this.camera.lookAt(L);
    this.camera.updateMatrixWorld();
  }

  private renderFrame() {
    this.renderMirror();
    this.composer.render();
  }

  private renderMirror() {
    const cam = this.camera;
    const mc = this.mirrorCam;
    mc.copy(cam);
    mc.position.set(cam.position.x, -cam.position.y, cam.position.z);
    const dir = this.target.pos.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const aim = this.target.look.copy(cam.position).add(dir);
    aim.y = -aim.y;
    mc.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    mc.up.y = -mc.up.y;
    mc.lookAt(aim);
    mc.updateMatrixWorld();
    mc.projectionMatrix.copy(cam.projectionMatrix);
    this.texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.texMat.multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);

    this.floor.visible = false;
    for (const o of this.hideInMirror) o.visible = false;
    const r = this.renderer;
    r.setRenderTarget(this.reflRT);
    r.clear();
    r.render(this.scene, mc);
    this.floor.visible = true;
    for (const o of this.hideInMirror) o.visible = true;

    // smear it: a little across, a lot down (the long streaks of a polished floor)
    const pass = (src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, sx: number, sy: number) => {
      this.blurMat.uniforms.tSrc.value = src.texture;
      this.blurMat.uniforms.uStep.value.set(sx / dst.width, sy / dst.height);
      r.setRenderTarget(dst);
      this.blurQuad.render(r);
    };
    pass(this.reflRT, this.blurA, 1.2, 0);
    pass(this.blurA, this.blurB, 0, 2.2);
    pass(this.blurB, this.blurA, 0, 4.5);
    pass(this.blurA, this.blurB, 0.8, 7.5);
    r.setRenderTarget(null);
  }

  dispose() {
    this.setRunning(false);
    this.disposed = true;
    this.cleanups.forEach((fn) => fn());
    for (const c of this.clips) {
      c.video.pause();
      c.video.removeAttribute("src");
      c.video.load();
      c.tex.dispose();
      c.poster.dispose();
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.markTex.dispose();
    this.reflRT.dispose();
    this.blurA.dispose();
    this.blurB.dispose();
    this.blurQuad.dispose();
    this.blurMat.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
