import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// ===========================================================================
// HERO 22 — the screening room.
//
// Three wide screens in a U: one facing you, two hinged in toward you, each
// with a gentle curve of its own. They stand on dark bases over a wet black
// floor that mirrors them (a blurred, streaked copy under the floor line, not
// a second render). Everything is unlit shader work, so it stays cheap.
//
// The camera sits back with a long lens and orbits a pivot in front of the
// screens: drag to look around, the mouse adds a little parallax. Clicking a
// screen walks the camera up to it and dims the others; drag sideways while
// there to move to the next one.
// ===========================================================================

export type Film = { src: string; poster: string };

export type StageEvents = {
  onHover?: (index: number | null) => void;
  onFocus?: (index: number | null) => void;
  onReady?: () => void;
};

const SW = 6; // screen width
const ASPECT = 2.1; // wide, like a cinema screen; the 16:9 films are cropped to fill
const SH = SW / ASPECT;
const CURVE = 15; // each screen's own curve
const Y0 = 0.55; // bottom edge of the screens
const YMID = Y0 + SH / 2;
const ZC = -8; // depth of the centre screen
const HINGE = THREE.MathUtils.degToRad(62); // how far the side screens turn in
const GAP = 0.09;
const CAM_Y = 1.5;
const LOOK = new THREE.Vector3(0, 1.98, ZC);
const CROP = 16 / 9 / ASPECT; // share of the film's height that shows

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

/** A plane of the given size, bent into a shallow curve that comes toward +z at its ends. */
function curved(w: number, h: number, yc: number, segs = 40) {
  const geo = new THREE.PlaneGeometry(w, h, segs, 1);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / CURVE;
    p.setXYZ(i, CURVE * Math.sin(a), p.getY(i) + yc, CURVE * (1 - Math.cos(a)));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// Where each screen stands: the centre one faces the camera, the side ones are
// hinged at its edges and turned in.
const EDGE_A = SW / 2 / CURVE;
const EX = CURVE * Math.sin(EDGE_A);
const EZ = CURVE * (1 - Math.cos(EDGE_A));
const PLACES = (() => {
  const rotate = (x: number, z: number, b: number) => [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
  const side = (dir: -1 | 1) => {
    const b = -dir * HINGE;
    const [lx, lz] = rotate(-dir * EX, EZ, b); // the inner edge, turned
    const [gx, gz] = rotate(dir * GAP, 0, b);
    return { x: dir * EX + gx - lx, z: ZC + EZ + gz - lz, rot: b };
  };
  return [side(-1), { x: 0, z: ZC, rot: 0 }, side(1)];
})();

const HASH = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;
const CROP_UV = /* glsl */ `
  vec2 film(vec2 uv){ return vec2(uv.x, 0.5 + (uv.y - 0.5) * ${CROP.toFixed(4)}); }
`;

const SCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// uPower 0 → 1 switches the screen on like an old set: a white line opens
// into the picture with a brief overexposed flash.
const SCREEN_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uPower, uDim, uHover, uTime;
  varying vec2 vUv;
  ${HASH}
  ${CROP_UV}
  void main(){
    vec2 d = vUv - 0.5;
    float openX = smoothstep(0.0, 0.18, uPower);
    float openY = smoothstep(0.12, 0.8, uPower);
    float mask = step(abs(d.x), openX * 0.5) * step(abs(d.y), openY * 0.5 + 0.004);
    vec3 c = texture2D(map, film(vUv)).rgb;
    float vig = 1.0 - dot(d * vec2(0.8, 1.3), d * vec2(0.8, 1.3)) * 0.45;
    float flash = 1.0 + (1.0 - smoothstep(0.25, 1.0, uPower)) * 2.2;
    vec3 col = c * vig * flash;
    col = mix(col, vec3(1.0), (1.0 - openY) * 0.85);
    col += (hash(vUv * vec2(1200.0, 570.0) + fract(uTime)) - 0.5) * 0.016;
    col *= mix(1.0, 0.26, uDim) * (1.0 + 0.16 * uHover);
    gl_FragColor = vec4(max(col, 0.0) * mask, 1.0);
  }
`;

// The mirrored copy under the floor: blurred upward, broken into streaks
// like a wet floor, and fading with depth.
const WORLD_VERT = /* glsl */ `
  varying vec2 vUv; varying vec3 vW;
  void main(){
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const REFLECT_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uPower, uDim;
  varying vec2 vUv; varying vec3 vW;
  ${CROP_UV}
  void main(){
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float f = float(i) / 7.0;
      acc += texture2D(map, film(vUv + vec2((f - 0.5) * 0.01, f * 0.06))).rgb;
    }
    acc /= 8.0;
    float depth = max(-vW.y, 0.0);
    float fade = exp(-depth * 0.8) * 0.62;
    float streak = 0.6 + 0.4 * sin(vW.x * 17.0 + vW.z * 9.0 + sin(vW.x * 5.3 + vW.z * 3.1) * 2.4);
    float on = smoothstep(0.3, 1.0, uPower);
    gl_FragColor = vec4(acc * fade * streak * on * mix(1.0, 0.3, uDim), 1.0);
  }
`;

// Light a screen throws on the floor in front of it: the film's average colour.
const POOL_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uPower, uDim;
  varying vec2 vUv;
  void main(){
    vec3 c = vec3(0.0);
    c += texture2D(map, vec2(0.2, 0.3)).rgb;
    c += texture2D(map, vec2(0.5, 0.5)).rgb;
    c += texture2D(map, vec2(0.8, 0.3)).rgb;
    c += texture2D(map, vec2(0.35, 0.7)).rgb;
    c += texture2D(map, vec2(0.65, 0.7)).rgb;
    c /= 5.0;
    vec2 d = (vUv - vec2(0.5, 1.0)) * vec2(2.0, 1.15);
    float fall = exp(-dot(d, d) * 3.0);
    fall *= smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.4, vUv.y);
    float on = smoothstep(0.4, 1.0, uPower);
    gl_FragColor = vec4(c * fall * 0.22 * on * mix(1.0, 0.35, uDim), 1.0);
  }
`;

const FLOOR_FRAG = /* glsl */ `
  varying vec2 vUv; varying vec3 vW;
  void main(){
    float r = length(vW.xz - vec2(0.0, ${ZC.toFixed(1)} + 2.0));
    float alpha = mix(0.3, 1.0, smoothstep(6.0, 20.0, r));
    gl_FragColor = vec4(vec3(0.0012), alpha);
  }
`;

const HAZE_FRAG = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vec2 d = (vUv - vec2(0.5, 0.3)) * vec2(1.0, 1.4);
    float g = exp(-dot(d, d) * 6.0) * smoothstep(0.0, 0.3, vUv.y);
    gl_FragColor = vec4(vec3(0.15, 0.13, 0.12) * g * 0.035, 1.0);
  }
`;

const LINE_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main(){
    float ends = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
    float core = 1.0 - abs(vUv.y - 0.5) * 2.0;
    gl_FragColor = vec4(vec3(0.85, 0.88, 0.95) * ends * core * uOpacity, 1.0);
  }
`;

// Dark metal: a soft sheen across, a thin catch-light along the top edge.
const METAL_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform float uTopLight;
  varying vec2 vUv;
  void main(){
    float sheen = 0.65 + 0.35 * sin(vUv.x * 7.0 + 1.0);
    vec3 c = uBase * sheen + vec3(0.1, 0.09, 0.08) * smoothstep(0.9, 1.0, vUv.y) * uTopLight;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const additive = (frag: string, uniforms: Record<string, THREE.IUniform> = {}) =>
  new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

const metal = (color: number, topLight: number) =>
  new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT,
    fragmentShader: METAL_FRAG,
    uniforms: { uBase: { value: new THREE.Color(color) }, uTopLight: { value: topLight } },
  });

type Screen = {
  video: HTMLVideoElement;
  texture: THREE.VideoTexture;
  poster: THREE.Texture;
  live: boolean; // showing the video (not the poster) yet
  mats: THREE.ShaderMaterial[];
  power: number;
  powerAt: number; // ms after start when it switches on
  dim: number;
  hover: number;
  centre: THREE.Vector3;
  normal: THREE.Vector3;
};

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 140);
  private screens: Screen[] = [];
  private hitMeshes: THREE.Mesh[] = [];
  private dust: THREE.Points;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(9, 9);
  private mouse = new THREE.Vector2(); // -1..1, for parallax

  private camPos = new THREE.Vector3();
  private camLook = LOOK.clone();
  private overviewZ = 8;
  private portrait = false;
  private yaw = 0;
  private yawTarget = 0;
  private pitch = 0;
  private pitchTarget = 0;

  private focus: number | null = null;
  private hovered: number | null = null;
  private dragging = false;
  private dragStart = { x: 0, y: 0, yaw: 0, pitch: 0 };
  private dragMoved = false;

  private start = performance.now();
  private last = performance.now();
  private raf = 0;
  private ready = false;
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
    this.renderer.setClearColor(0x000000, 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";

    this.build(films);
    this.dust = this.makeDust();
    this.scene.add(this.dust);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.65, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    // Start further back and higher, so the first seconds are a slow dolly in.
    if (reduced) this.camPos.set(0, CAM_Y, this.overviewZ);
    else this.camPos.set(0, CAM_Y + 1.6, this.overviewZ + 9);

    this.bind();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // -------------------------------------------------------------------------
  // Scene
  // -------------------------------------------------------------------------

  private build(films: Film[]) {
    const mirror = new THREE.Group();
    mirror.scale.y = -1;
    this.scene.add(mirror);

    const lampMat = additive(/* glsl */ `
      varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float g = exp(-d * d * 6.0);
        gl_FragColor = vec4(vec3(1.0, 0.62, 0.32) * g * 1.3, 1.0);
      }
    `);
    const baseH = Y0 - 0.05;
    const baseMat = metal(0x070708, 0.7);

    films.slice(0, 3).forEach((film, i) => {
      const place = PLACES[i];

      const video = document.createElement("video");
      video.src = film.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";
      video.setAttribute("playsinline", "");
      video.play().catch(() => {});

      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      const poster = new THREE.TextureLoader().load(film.poster);
      poster.colorSpace = THREE.SRGBColorSpace;

      const uniforms = () => ({
        map: { value: poster as THREE.Texture },
        uPower: { value: 0 },
        uDim: { value: 0 },
        uHover: { value: 0 },
        uTime: { value: 0 },
      });

      const group = new THREE.Group();
      group.position.set(place.x, 0, place.z);
      group.rotation.y = place.rot;
      this.scene.add(group);
      const twin = new THREE.Group(); // its reflection
      twin.position.copy(group.position);
      twin.rotation.y = place.rot;
      mirror.add(twin);

      const screenMat = new THREE.ShaderMaterial({ vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG, uniforms: uniforms() });
      const screen = new THREE.Mesh(curved(SW, SH, YMID), screenMat);
      screen.userData.index = i;
      group.add(screen);
      this.hitMeshes.push(screen);

      // Bezel: a slightly larger dark panel just behind the picture.
      const bezel = new THREE.Mesh(curved(SW + 0.12, SH + 0.12, YMID), metal(0x0c0c0e, 0.4));
      bezel.position.z = -0.03;
      group.add(bezel);

      // Base it stands on, with small warm lamps along its front.
      const base = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.1, baseH, 0.75), baseMat);
      base.position.set(0, baseH / 2, 0.12);
      group.add(base);
      twin.add(base.clone());
      for (let k = 0; k < 5; k++) {
        const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), lampMat);
        lamp.position.set(-SW / 2 + 0.5 + (k / 4) * (SW - 1), baseH - 0.1, 0.5);
        group.add(lamp);
      }

      const reflectMat = new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT,
        fragmentShader: REFLECT_FRAG,
        uniforms: uniforms(),
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      twin.add(new THREE.Mesh(curved(SW, SH, YMID), reflectMat));

      const poolMat = new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT,
        fragmentShader: POOL_FRAG,
        uniforms: uniforms(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(SW * 1.25, 6), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, 0.004, 0.5 + 3);
      pool.renderOrder = 2;
      group.add(pool);

      group.updateMatrixWorld(true);
      const centre = new THREE.Vector3(0, YMID, 0).applyMatrix4(group.matrixWorld);
      const normal = new THREE.Vector3(Math.sin(place.rot), 0, Math.cos(place.rot));

      this.screens.push({
        video,
        texture,
        poster,
        live: false,
        mats: [screenMat, reflectMat, poolMat],
        power: 0,
        powerAt: (this.reduced ? 0 : 700) + [280, 0, 520][i],
        dim: 0,
        hover: 0,
        centre,
        normal,
      });
    });

    // Wet floor: transparent enough to show the reflections, black far away.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.ShaderMaterial({ vertexShader: WORLD_VERT, fragmentShader: FLOOR_FRAG, transparent: true, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = 1;
    this.scene.add(floor);

    // Thin stage lines on the floor.
    const lineMat = additive(LINE_FRAG, { uOpacity: { value: 0.4 } });
    const line = (ax: number, az: number, bx: number, bz: number, w = 0.03) => {
      const dx = bx - ax;
      const dz = bz - az;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(dx, dz), w), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(dz, dx);
      m.position.set((ax + bx) / 2, 0.006, (az + bz) / 2);
      m.renderOrder = 3;
      this.scene.add(m);
    };
    line(-16, ZC + 2, -3.2, ZC + 17, 0.05);
    line(16, ZC + 2, 3.2, ZC + 17, 0.05);

    // Faint haze in the dark above the screens.
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), additive(HAZE_FRAG));
    haze.position.set(0, 12.5, ZC - 10);
    this.scene.add(haze);
  }

  private makeDust() {
    const n = 160;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = 0.3 + Math.random() * 4.5;
      pos[i * 3 + 2] = ZC - 0.5 + Math.random() * 7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffdcb8,
      size: 0.018,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geo, mat);
  }

  // -------------------------------------------------------------------------
  // Layout & camera
  // -------------------------------------------------------------------------

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    const aspect = w / h;
    this.portrait = aspect < 1.1;
    this.camera.fov = this.portrait ? 46 : 32;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // Back the camera off until the screens fit: all three on wide screens,
    // the centre one (with the others peeking in) on phones.
    const corners: THREE.Vector3[] = [];
    const indices = this.portrait ? [1] : [0, 2];
    const pts = [[-EX, EZ], [EX, EZ]];
    for (const i of indices) {
      const pl = PLACES[i];
      for (const [x, z] of pts) {
        for (const y of [Y0, Y0 + SH]) {
          const v = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), pl.rot);
          corners.push(v.add(new THREE.Vector3(pl.x, 0, pl.z)));
        }
      }
    }
    const limit = this.portrait ? 1 / 1.12 : 0.93;
    const cam = new THREE.PerspectiveCamera(this.camera.fov, aspect, 0.1, 200);
    let lo = ZC + 4;
    let hi = 90;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      cam.position.set(0, CAM_Y, mid);
      cam.lookAt(LOOK);
      cam.updateMatrixWorld();
      const fits = corners.every((c) => {
        const p = c.clone().project(cam);
        return p.z < 1 && Math.abs(p.x) <= limit;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    this.overviewZ = hi;

    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
  }

  private overview(out: THREE.Vector3, look: THREE.Vector3) {
    // Orbit a pivot just in front of the screens.
    const pivot = new THREE.Vector3(0, CAM_Y, ZC + 3);
    const d = this.overviewZ - pivot.z;
    const yaw = this.yaw + (this.reduced ? 0 : this.mouse.x * 0.035);
    const pitch = this.pitch + (this.reduced ? 0 : this.mouse.y * 0.02);
    out.set(pivot.x + Math.sin(yaw) * Math.cos(pitch) * d, pivot.y + Math.sin(pitch) * d, pivot.z + Math.cos(yaw) * Math.cos(pitch) * d);
    look.copy(LOOK);
    if (this.portrait) look.x += Math.sin(this.yaw) * 6;
  }

  private focused(i: number, out: THREE.Vector3, look: THREE.Vector3) {
    const s = this.screens[i];
    look.copy(s.centre);
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect);
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const dist = Math.max(EX / 0.86 / Math.tan(hHalf), SH / 2 / 0.72 / Math.tan(vHalf)) + EZ;
    out.copy(s.centre).addScaledVector(s.normal, dist);
    out.x += this.mouse.x * 0.15;
    out.y += 0.05 + this.mouse.y * 0.08;
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private bind() {
    const el = this.host;
    const on = <K extends keyof WindowEventMap>(
      target: HTMLElement | Window,
      type: K,
      fn: (e: WindowEventMap[K]) => void,
    ) => {
      target.addEventListener(type, fn as EventListener);
      this.cleanups.push(() => target.removeEventListener(type, fn as EventListener));
    };

    const setPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.mouse.copy(this.pointer);
    };

    on(el, "pointerdown", (e) => {
      setPointer(e);
      this.dragging = true;
      this.dragMoved = false;
      this.dragStart = { x: e.clientX, y: e.clientY, yaw: this.yawTarget, pitch: this.pitchTarget };
      el.setPointerCapture(e.pointerId);
    });
    on(el, "pointermove", (e) => {
      setPointer(e);
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      if (Math.hypot(dx, dy) > 6) this.dragMoved = true;
      if (this.focus === null) {
        const lim = this.portrait ? 0.7 : 0.5;
        this.yawTarget = THREE.MathUtils.clamp(this.dragStart.yaw - dx * 0.003, -lim, lim);
        this.pitchTarget = THREE.MathUtils.clamp(this.dragStart.pitch + dy * 0.0015, -0.04, 0.12);
      }
    });
    on(el, "pointerup", (e) => {
      const dx = e.clientX - this.dragStart.x;
      this.dragging = false;
      if (this.focus !== null && Math.abs(dx) > 60) {
        this.setFocus(THREE.MathUtils.clamp(this.focus + (dx < 0 ? 1 : -1), 0, 2));
        return;
      }
      if (this.dragMoved) return;
      const hit = this.pick();
      if (hit === null) this.setFocus(null);
      else this.setFocus(this.focus === hit ? null : hit);
    });
    on(el, "pointerleave", () => {
      this.pointer.set(9, 9);
      this.mouse.set(0, 0);
    });
    on(window, "keydown", (e) => {
      if (e.key === "Escape") this.setFocus(null);
      if (e.key === "ArrowRight") this.setFocus(this.focus === null ? 1 : Math.min(2, this.focus + 1));
      if (e.key === "ArrowLeft") this.setFocus(this.focus === null ? 1 : Math.max(0, this.focus - 1));
    });
    on(window, "resize", () => this.resize());

    const onVisible = () => {
      for (const s of this.screens) {
        if (document.hidden) s.video.pause();
        else s.video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisible));
  }

  private pick(): number | null {
    if (this.pointer.x > 2) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.hitMeshes, false)[0];
    return hit ? (hit.object.userData.index as number) : null;
  }

  setFocus(i: number | null) {
    if (i === this.focus) return;
    this.focus = i;
    if (i === null) {
      this.yawTarget = 0;
      this.pitchTarget = 0;
    }
    this.events.onFocus?.(i);
  }

  /** Make sure films are playing (after a user gesture, if autoplay was blocked). */
  play() {
    for (const s of this.screens) s.video.play().catch(() => {});
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const t = now - this.start;

    const hover = this.dragging ? null : this.pick();
    if (hover !== this.hovered) {
      this.hovered = hover;
      this.host.style.cursor = hover !== null ? "pointer" : "";
      this.events.onHover?.(hover);
    }

    let allOn = true;
    this.screens.forEach((s, i) => {
      if (!s.live && s.video.readyState >= 2 && s.video.currentTime > 0) {
        s.live = true;
        for (const m of s.mats) m.uniforms.map.value = s.texture;
      }
      const hasFrame = s.live || s.poster.image != null;
      const wantOn = t > s.powerAt && (hasFrame || t > s.powerAt + 2500) ? 1 : 0;
      if (this.reduced) s.power = wantOn;
      else s.power = Math.min(1, s.power + (wantOn ? dt / 0.9 : 0));
      if (s.power < 1) allOn = false;
      const dimTo = this.focus !== null && this.focus !== i ? 1 : 0;
      s.dim += (dimTo - s.dim) * damp(5, dt);
      const hoverTo = this.hovered === i && this.focus === null ? 1 : 0;
      s.hover += (hoverTo - s.hover) * damp(8, dt);
      for (const m of s.mats) {
        m.uniforms.uPower.value = s.power;
        m.uniforms.uDim.value = s.dim;
        m.uniforms.uHover.value = s.hover;
        m.uniforms.uTime.value = t / 1000;
      }
    });
    if (allOn && !this.ready) {
      this.ready = true;
      this.events.onReady?.();
    }

    this.yaw += (this.yawTarget - this.yaw) * damp(6, dt);
    this.pitch += (this.pitchTarget - this.pitch) * damp(6, dt);
    const wantPos = new THREE.Vector3();
    const wantLook = new THREE.Vector3();
    if (this.focus === null) this.overview(wantPos, wantLook);
    else this.focused(this.focus, wantPos, wantLook);
    const k = damp(this.ready || this.reduced ? 3 : 1.0, dt);
    this.camPos.lerp(wantPos, k);
    this.camLook.lerp(wantLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    if (!this.reduced) {
      const p = this.dust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * 0.05;
        if (y > 4.8) y = 0.3;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t / 2400 + i) * dt * 0.015);
      }
      p.needsUpdate = true;
    }

    this.composer.render();
  }

  /** Where the camera is turned, for parallax in the HTML layer (about -1..1). */
  get turn() {
    return this.yaw / 0.5 + this.mouse.x * 0.1;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((fn) => fn());
    for (const s of this.screens) {
      s.video.pause();
      s.video.removeAttribute("src");
      s.video.load();
      s.texture.dispose();
      s.poster.dispose();
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
