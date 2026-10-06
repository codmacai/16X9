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
//             diamonds. The coffers are light boxes. The middle row is lit,
//             the rows either side are dimmer. Every lit box is also a real
//             area light, so it lights the floor, the beams' sides and the
//             wall the way it would in the room.
//   Wall      black, glossy, built from horizontal slabs, 11.2 m away; it
//             catches the ceiling's light.
//   Floor     polished concrete. It carries a true planar reflection (the
//             room rendered a second time from below the floor), blurred
//             into the long, soft streaks a polished floor gives, stronger at
//             a glancing angle.
//   Screen    a wide, thin slab on two feet, playing the films with small
//             labels down its left edge and the mark in its corner. It is an
//             area light too, so the floor in front of it takes the film's
//             colour.
//
// The ceiling comes on box by box, the screen after it, while the camera
// eases forward. The mouse moves the camera a little (the beams shift against
// the screen); drag to look round; click the screen to walk up to it.
// ===========================================================================

export type Film = { src: string; poster: string };

export type StageEvents = {
  onReady?: () => void;
  onFocus?: (focused: boolean) => void;
  onFilm?: (index: number) => void;
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

const LOOK_Z = S_Z;
const FOV_DESKTOP = 26; // the long lens

const SQ2 = Math.SQRT2;
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 4);
const easeIn = (t: number) => Math.pow(clamp01(t), 3);
const cine = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const WHITE = new THREE.Color(1, 1, 1);
const f = (n: number) => n.toFixed(6);

/** How bright the coffer whose centre is at (x, z) is, 0 … 1. The middle row is lit. */
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
  uniform float uOn;   // 0 … 1, the ceiling coming on
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vW;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
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

    // switch-on: box by box from the screen end, each blinking like a tube
    // catching before it holds (the lights below use the same pattern)
    float order = clamp(-cz / 12.0, 0.0, 1.0) * 0.55 + ax * 0.05;
    float t = clamp((uOn * 1.6 - (0.6 - order)) * 1.8, 0.0, 1.0);
    float seed = floor(cx * 1.7 + 0.5) * 3.7 + floor(cz * 0.37 + 0.5) * 1.3;
    float blink = step(0.42, fract(sin(floor(t * 11.0) * 7.13 + seed) * 43758.5453));
    float on = t >= 1.0 ? 1.0 : (t > 0.02 ? blink * (0.55 + 0.45 * t) : 0.0);

    float r = max(abs(local.x), abs(local.y)) * 2.0;     // 0 middle … 1 edge
    float glow = 0.74 + 0.26 * (1.0 - r * r);
    float rim = smoothstep(0.86, 1.0, r);                // shaded where it meets the beams
    float grain = 0.97 + 0.03 * hash(floor(vW.xz * 90.0));
    vec3 white = vec3(1.0, 0.99, 0.975);
    // the far boxes against the wall are dark, as in the room
    level *= (cz < -9.5 && ax > 0.2) ? 0.15 : 1.0;
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
    vec3 mark = vec3(0.9) * card * (1.0 - letter);

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

type Clip = { video: HTMLVideoElement; tex: THREE.VideoTexture; poster: THREE.Texture; live: boolean };

export class Gallery {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV_DESKTOP, 1, 0.1, 80);

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
  private markCanvas: HTMLCanvasElement;
  private markTex: THREE.CanvasTexture;
  private sampler: CanvasRenderingContext2D | null;

  private clips: Clip[];
  private film = 0;
  private next = -1;
  private mix = 0;
  private filmSince = 0;

  private t0 = performance.now();
  private last = performance.now();
  private frame = 0;
  private ceilOn = 0;
  private ready = false;
  private time = 0;
  private brandMode: "intro" | "out" | "in" = "intro";
  private brandAt = 0;
  private brand = 1;

  private mouse = new THREE.Vector2();
  private yaw = 0;
  private yawTo = 0;
  private pitch = 0;
  private pitchTo = 0;
  private focus = false;
  private drag = { down: false, x: 0, y: 0, yaw: 0, pitch: 0, moved: false };
  private camPos = new THREE.Vector3(0, EYE + 0.15, 3.4);
  private camLook = new THREE.Vector3(0, EYE, LOOK_Z);
  private portrait = false;

  private raf = 0;
  private disposed = false;
  private cleanups: (() => void)[] = [];

  constructor(
    private host: HTMLElement,
    films: Film[],
    private events: StageEvents = {},
    private reduced = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";

    RectAreaLightUniformsLib.init();

    // films
    this.clips = films.map((fl) => {
      const video = document.createElement("video");
      video.src = fl.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("playsinline", "");
      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.NoColorSpace; // decoded in the shader, the same in every browser
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      const poster = new THREE.TextureLoader().load(fl.poster);
      poster.colorSpace = THREE.NoColorSpace;
      return { video, tex, poster, live: false };
    });
    this.clips[0].video.play().catch(() => {});

    // 16X9 & BEYOND, cut into the screen
    this.markCanvas = document.createElement("canvas");
    this.markCanvas.width = 2048;
    this.markCanvas.height = Math.round(2048 / (SW / SH));
    this.markTex = new THREE.CanvasTexture(this.markCanvas);
    this.markTex.colorSpace = THREE.NoColorSpace;
    this.markTex.anisotropy = 8;
    this.drawMark();

    const s = document.createElement("canvas");
    s.width = 16;
    s.height = 8;
    this.sampler = s.getContext("2d", { willReadFrequently: true });

    // the floor's mirror and its blur
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true };
    this.reflRT = new THREE.WebGLRenderTarget(2, 2, rtOpts);
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

    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.08, 0.4, 0.97); // a breath of glow; keeps the mark's letters crisp
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    if (reduced) {
      // no opening: start as if it had already played
      this.camPos.set(0, EYE, 0);
      this.t0 -= 10000;
    }
    this.bind();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    if (document.fonts) document.fonts.ready.then(() => !this.disposed && this.drawMark());
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
      uniforms: { uOn: { value: 0 }, uTime: { value: 0 } },
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
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ln.turn);
      m.compose(new THREE.Vector3(x, HC + COFFER / 2, z), q, new THREE.Vector3(1, 1, 1));
      beams.setMatrixAt(i, m);
    });
    this.scene.add(beams);

    // the lit boxes are real lights (the brightest few)
    const centres: { x: number; z: number }[] = [];
    for (let i = -6; i <= 6; i++) {
      for (let j = -6; j <= 6; j++) {
        const u = (i + 0.5) * LATTICE;
        const v = (j + 0.5) * LATTICE;
        const x = (u + v) / SQ2;
        const z = (u - v) / SQ2 + LAT_Z;
        if (z < WALL_Z || z > 2.5) continue;
        if (Math.abs(x) > 3) continue;
        if (z < -9.5 && Math.abs(x) > 0.2) continue; // dark against the wall
        centres.push({ x, z });
      }
    }
    for (const c of centres) {
      const level = cofferLevel(c.x);
      const light = new THREE.RectAreaLight(0xfffcf6, 0, LATTICE * 0.97, LATTICE * 0.97);
      light.position.set(c.x, HC + COFFER - 0.02, c.z);
      light.lookAt(c.x, 0, c.z);
      light.rotateZ(Math.PI / 4);
      this.scene.add(light);
      const order = clamp01(-c.z / 12) * 0.55 + Math.abs(c.x) * 0.05;
      const seed = Math.floor(c.x * 1.7 + 0.5) * 3.7 + Math.floor(c.z * 0.37 + 0.5) * 1.3;
      this.cofferLights.push({ light, level, order, seed });
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
    this.portrait = aspect < 1;
    // The long lens frames the screen at about half the width; where the page
    // is narrow, open the lens until the whole screen fits.
    const need = Math.atan(((SW / 2) * 1.12) / Math.abs(S_Z) / aspect) * 2;
    this.camera.fov = Math.max(FOV_DESKTOP, THREE.MathUtils.radToDeg(need));
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    const pr = this.renderer.getPixelRatio();
    const rw = Math.max(2, Math.round(w * pr * 0.5));
    const rh = Math.max(2, Math.round(h * pr * 0.5));
    this.reflRT.setSize(rw, rh);
    this.blurA.setSize(Math.max(2, rw >> 1), Math.max(2, rh >> 1));
    this.blurB.setSize(Math.max(2, rw >> 1), Math.max(2, rh >> 1));
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private bind() {
    const el = this.host;
    const on = <K extends keyof WindowEventMap>(t: HTMLElement | Window, type: K, fn: (e: WindowEventMap[K]) => void) => {
      t.addEventListener(type, fn as EventListener);
      this.cleanups.push(() => t.removeEventListener(type, fn as EventListener));
    };
    const ray = new THREE.Raycaster();
    const ndc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const overScreen = (p: THREE.Vector2) => {
      ray.setFromCamera(p, this.camera);
      return ray.intersectObject(this.screenMesh, false).length > 0;
    };

    on(el, "pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      this.drag = { down: true, x: e.clientX, y: e.clientY, yaw: this.yawTo, pitch: this.pitchTo, moved: false };
      this.play();
    });
    on(el, "pointermove", (e) => {
      const p = ndc(e);
      this.mouse.copy(p);
      if (!this.drag.down) {
        el.style.cursor = !this.focus && this.ready && overScreen(p) ? "pointer" : "";
        return;
      }
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 6) this.drag.moved = true;
      this.yawTo = THREE.MathUtils.clamp(this.drag.yaw - dx * 0.0016, -0.22, 0.22);
      this.pitchTo = THREE.MathUtils.clamp(this.drag.pitch + dy * 0.0008, -0.05, 0.07);
    });
    const up = (e: PointerEvent) => {
      if (!this.drag.down) return;
      this.drag.down = false;
      if (this.drag.moved) return;
      // the screen is the way in; once inside, the page is the film (Esc leads back out)
      if (!this.focus && overScreen(ndc(e))) this.setFocus(true);
    };
    on(el, "pointerup", up);
    on(el, "pointercancel", () => (this.drag.down = false));
    on(el, "pointerleave", () => this.mouse.set(0, 0));
    on(window, "keydown", (e) => {
      if (e.key === "Escape") this.setFocus(false);
      if (e.key === "ArrowRight") this.showFilm((this.film + 1) % this.clips.length);
      if (e.key === "ArrowLeft") this.showFilm((this.film - 1 + this.clips.length) % this.clips.length);
    });
    on(window, "resize", () => this.resize());
    const onVisible = () => {
      const v = this.clips[this.film].video;
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisible));
  }

  setFocus(f: boolean) {
    if (f === this.focus || !this.ready) return;
    this.focus = f;
    this.brandMode = f ? "out" : "in";
    this.brandAt = this.time;
    if (f) {
      const c = this.clips[this.film];
      c.video.currentTime = 0;
      c.video.play().catch(() => {});
      this.filmSince = this.time;
    }
    this.yawTo = 0;
    this.pitchTo = 0;
    this.events.onFocus?.(f);
  }

  /** Cross-fade to a film. */
  showFilm(i: number) {
    if (i === this.film || i === this.next) return;
    this.next = i;
    this.mix = 0;
    const c = this.clips[i];
    c.video.currentTime = 0;
    c.video.play().catch(() => {});
    this.events.onFilm?.(i);
  }

  play() {
    this.clips[this.film].video.play().catch(() => {});
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
      this.screenColour.lerp(new THREE.Color().setRGB(r / n, gg / n, b / n, THREE.SRGBColorSpace), 0.3);
    } catch {
      // not readable yet
    }
  }

  private renderMirror() {
    const cam = this.camera;
    const mc = this.mirrorCam;
    mc.copy(cam);
    mc.position.set(cam.position.x, -cam.position.y, cam.position.z);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const target = cam.position.clone().add(dir);
    target.y = -target.y;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    up.y = -up.y;
    mc.up.copy(up);
    mc.lookAt(target);
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

  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const t = (now - this.t0) / 1000;
    this.frame++;

    // ---- the opening: the ceiling, box by box, then the screen
    this.time = t;
    this.ceilOn = clamp01((t - 0.3) / 2.4);
    this.coffers.uniforms.uOn.value = this.ceilOn;
    this.coffers.uniforms.uTime.value = t;
    for (const c of this.cofferLights) {
      const tt = clamp01((this.ceilOn * 1.6 - (0.6 - c.order)) * 1.8);
      const h = Math.sin(Math.floor(tt * 11) * 7.13 + c.seed) * 43758.5453;
      const blink = h - Math.floor(h) >= 0.42 ? 1 : 0;
      const on = tt >= 1 ? 1 : tt > 0.02 ? blink * (0.55 + 0.45 * tt) : 0;
      c.light.intensity = 3.0 * c.level * on;
    }
    // the screen: the mark comes on, then (on entering) gives way to the film
    let card = 1;
    let letY = 0;
    let brand = 1;
    const s = t - this.brandAt;
    if (this.brandMode === "intro") {
      card = cine((t - 2.9) / 0.95);
      letY = 1 - easeOut((t - 3.55) / 0.9);
      if (!this.ready && t > 4.5) {
        this.ready = true;
        this.events.onReady?.();
      }
    } else if (this.brandMode === "out") {
      letY = -easeIn(s / 0.55);
      brand = 1 - cine((s - 0.35) / 0.85);
    } else {
      brand = cine(s / 0.6);
      letY = 1 - easeOut((s - 0.45) / 0.9);
    }
    this.brand = brand;
    this.screenMat.uniforms.uCard.value = card;
    this.screenMat.uniforms.uLetY.value = letY;
    this.screenMat.uniforms.uBrand.value = brand;

    // ---- films: swap posters for video once playing; cross-fade; move on every so often
    const cur = this.clips[this.film];
    this.screenMat.uniforms.uA.value = this.texOf(cur);
    if (this.next >= 0) {
      const nx = this.clips[this.next];
      this.screenMat.uniforms.uB.value = this.texOf(nx);
      this.mix = Math.min(1, this.mix + dt / 0.9);
      if (this.mix >= 1) {
        cur.video.pause();
        this.film = this.next;
        this.next = -1;
        this.mix = 0;
        this.filmSince = t;
        this.screenMat.uniforms.uA.value = this.texOf(this.clips[this.film]);
      }
    } else if (this.focus && this.brand < 0.01 && t - this.filmSince > 9) {
      this.showFilm((this.film + 1) % this.clips.length);
    }
    this.screenMat.uniforms.uMix.value = this.mix * this.mix * (3 - 2 * this.mix);
    if (this.frame % 4 === 0 && brand < 1) this.sampleColour();
    // the white card lights the floor white; the film, in its own colour
    this.screenLight.color.copy(this.screenColour).lerp(WHITE, brand);
    this.screenLight.intensity = card * (2.6 * brand + 1.6 * (1 - brand));

    // ---- camera: ease in from the door; the mouse leans it; drag turns it; click walks up
    this.yaw += (this.yawTo - this.yaw) * damp(5, dt);
    this.pitch += (this.pitchTo - this.pitch) * damp(5, dt);
    if (!this.drag.down) {
      this.yawTo += (0 - this.yawTo) * damp(0.6, dt); // drifts back to the middle
      this.pitchTo += (0 - this.pitchTo) * damp(0.6, dt);
    }
    const want = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (this.focus) {
      const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect);
      const fill = this.portrait ? 0.94 : 0.84;
      const dist = SW / 2 / fill / Math.tan(hHalf);
      want.set(this.mouse.x * 0.08, S_MID + this.mouse.y * 0.03, S_Z + dist);
      look.set(0, S_MID, S_Z);
    } else {
      const pivot = new THREE.Vector3(0, EYE, S_Z);
      const d = -S_Z;
      want.set(Math.sin(this.yaw) * d, EYE + Math.sin(this.pitch) * d * 0.3, pivot.z + Math.cos(this.yaw) * d);
      want.x += this.mouse.x * 0.32;
      want.y += this.mouse.y * 0.1;
      look.set(want.x * 0.15, want.y, LOOK_Z);
    }
    const k = damp(this.reduced ? 20 : this.ready ? 2.4 : 0.9, dt);
    this.camPos.lerp(want, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.updateMatrixWorld();

    this.renderMirror();
    this.composer.render();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
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
