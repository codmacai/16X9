import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

// ===========================================================================
// HERO 22 — the screening room.
//
// Three wide displays stand on a matte concrete floor in a U: one facing you,
// two turned in toward you. Each is a real slab (a thin matte-black shell with
// depth) with a matte, anti-glare picture. The pictures are the only light in
// the room: every screen is also an area light that takes on its film's colour
// as it plays, so the floor and the frames are lit the way a real room would
// be, soft and diffuse, no mirror tricks.
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

const SW = 6; // picture width
const ASPECT = 2.1; // wide, like a cinema screen; the 16:9 films are cropped to fill
const SH = SW / ASPECT;
const BORDER = 0.05; // matte frame around the picture
const DEPTH = 0.12; // thickness of each display
const CURVE = 15; // each display's own curve
const Y0 = 0.16; // bottom edge of the picture
const YMID = Y0 + SH / 2;
const ZC = -8; // depth of the centre display
const HINGE = THREE.MathUtils.degToRad(60); // how far the side displays turn in
const GAP = 0.16;
const CAM_Y = 1.25;
const LOOK = new THREE.Vector3(0, 1.62, ZC);
const CROP = 16 / 9 / ASPECT; // share of the film's height that shows
const LIGHT = 4.2; // area light strength of a screen at full power

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

/**
 * Bend a geometry around a vertical axis CURVE behind it: x becomes arc length,
 * z stays thickness. The ends come toward +z, so the picture is concave.
 */
function bend<T extends THREE.BufferGeometry>(geo: T, yc: number): T {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / CURVE;
    const r = CURVE - p.getZ(i);
    p.setXYZ(i, r * Math.sin(a), p.getY(i) + yc, CURVE - r * Math.cos(a));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// Where each display stands: the centre one faces the camera, the side ones
// stand at its edges, turned in.
const EDGE_A = (SW / 2 + BORDER) / CURVE;
const EX = CURVE * Math.sin(EDGE_A);
const EZ = CURVE * (1 - Math.cos(EDGE_A));
const PLACES = (() => {
  const rotate = (x: number, z: number, b: number) => [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
  const side = (dir: -1 | 1) => {
    const b = -dir * HINGE;
    const [lx, lz] = rotate(-dir * EX, EZ - DEPTH / 2, b); // its inner back edge, turned
    const [gx, gz] = rotate(dir * GAP, 0, b);
    return { x: dir * EX + gx - lx, z: ZC + EZ - DEPTH / 2 + gz - lz, rot: b };
  };
  return [side(-1), { x: 0, z: ZC, rot: 0 }, side(1)];
})();

const HASH = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;

const SCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// A matte, anti-glare panel: the picture slightly diffused, blacks lifted a
// touch, a soft falloff to the edges. uPower 0 → 1 switches it on: a white
// line opens into the picture with a brief overexposed flash. Films are read
// raw and decoded here, so every browser shows the same colour.
const SCREEN_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uPower, uDim, uHover, uTime;
  varying vec2 vUv;
  ${HASH}
  vec3 toLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  vec3 sampleFilm(vec2 uv){
    uv = vec2(uv.x, 0.5 + (uv.y - 0.5) * ${CROP.toFixed(4)});
    return toLinear(texture2D(map, uv).rgb);
  }
  void main(){
    vec2 d = vUv - 0.5;
    float openX = smoothstep(0.0, 0.18, uPower);
    float openY = smoothstep(0.12, 0.8, uPower);
    float mask = step(abs(d.x), openX * 0.5) * step(abs(d.y), openY * 0.5 + 0.004);

    vec3 sharp = sampleFilm(vUv);
    vec2 o = vec2(0.0016, 0.0034);
    vec3 soft = (sampleFilm(vUv + o) + sampleFilm(vUv - o) + sampleFilm(vUv + vec2(o.x, -o.y)) + sampleFilm(vUv - vec2(o.x, -o.y))) * 0.25;
    vec3 c = mix(sharp, soft, 0.3);

    float edge = smoothstep(0.0, 0.035, 0.5 - abs(d.x)) * smoothstep(0.0, 0.05, 0.5 - abs(d.y));
    float vig = 1.0 - dot(d * vec2(0.7, 1.1), d * vec2(0.7, 1.1)) * 0.35;
    vec3 col = c * vig * mix(0.86, 1.0, edge) * 1.15 + vec3(0.0035);
    float flash = 1.0 + (1.0 - smoothstep(0.25, 1.0, uPower)) * 2.5;
    col *= flash;
    col = mix(col, vec3(1.6), (1.0 - openY) * 0.9);
    col += (hash(vUv * vec2(1260.0, 600.0) + fract(uTime)) - 0.5) * 0.006;
    col *= mix(1.0, 0.18, uDim) * (1.0 + 0.14 * uHover);
    gl_FragColor = vec4(max(col, 0.0) * mask, 1.0);
  }
`;

/** Concrete: soft blotches and fine grain, used for colour and roughness. */
function concreteTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  // value noise at a few scales
  const grid = (n: number) => Array.from({ length: n * n }, () => Math.random());
  const scales = [4, 16, 64].map((n) => ({ n, v: grid(n) }));
  const at = ({ n, v }: { n: number; v: number[] }, x: number, y: number) => {
    const fx = (x / size) * n;
    const fy = (y / size) * n;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const s = (k: number) => k * k * (3 - 2 * k);
    // wrap at the edges, so the tile repeats without a seam
    const cell = (cx: number, cy: number) => v[(cy % n) * n + (cx % n)];
    const a = cell(ix, iy);
    const b = cell(ix + 1, iy);
    const c2 = cell(ix, iy + 1);
    const d = cell(ix + 1, iy + 1);
    return a + (b - a) * s(tx) + (c2 - a) * s(ty) + (a - b - c2 + d) * s(tx) * s(ty);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = at(scales[0], x, y) * 0.5 + at(scales[1], x, y) * 0.3 + at(scales[2], x, y) * 0.2;
      const grain = Math.random() * 0.08;
      const k = Math.round(Math.min(1, 0.35 + v * 0.45 + grain) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.anisotropy = 8;
  return tex;
}

type Screen = {
  video: HTMLVideoElement;
  texture: THREE.VideoTexture;
  poster: THREE.Texture;
  live: boolean; // showing the video (not the poster) yet
  mat: THREE.ShaderMaterial;
  light: THREE.RectAreaLight;
  colour: THREE.Color; // the film's average colour, lighting the room
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
  private sampler: CanvasRenderingContext2D | null;
  private frame = 0;

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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";

    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 8;
    this.sampler = c.getContext("2d", { willReadFrequently: true });

    RectAreaLightUniformsLib.init();
    this.scene.fog = new THREE.Fog(0x000000, 16, 42);
    this.build(films);
    this.dust = this.makeDust();
    this.scene.add(this.dust);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.55, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    // Start further back and higher, so the first seconds are a slow dolly in.
    if (reduced) this.camPos.set(0, CAM_Y, this.overviewZ);
    else this.camPos.set(0, CAM_Y + 1.4, this.overviewZ + 9);

    this.bind();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // -------------------------------------------------------------------------
  // Scene
  // -------------------------------------------------------------------------

  private build(films: Film[]) {
    // Matte black shell; it only shows where the screens light each other.
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.94, metalness: 0 });
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.035));

    films.slice(0, 3).forEach((film, i) => {
      const place = PLACES[i];

      const video = document.createElement("video");
      video.src = film.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("playsinline", "");
      video.play().catch(() => {});

      // Read raw; the shader decodes, the same in every browser.
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      const poster = new THREE.TextureLoader().load(film.poster);
      poster.colorSpace = THREE.NoColorSpace;

      const group = new THREE.Group();
      group.position.set(place.x, 0, place.z);
      group.rotation.y = place.rot;
      this.scene.add(group);

      // The display: a curved slab, its picture set into the front.
      const shell = new THREE.Mesh(
        bend(new THREE.BoxGeometry(SW + 2 * BORDER, SH + 2 * BORDER, DEPTH, 48, 1, 1), YMID),
        shellMat,
      );
      shell.position.z = -DEPTH / 2;
      group.add(shell);

      const mat = new THREE.ShaderMaterial({
        vertexShader: SCREEN_VERT,
        fragmentShader: SCREEN_FRAG,
        uniforms: {
          map: { value: poster as THREE.Texture },
          uPower: { value: 0 },
          uDim: { value: 0 },
          uHover: { value: 0 },
          uTime: { value: 0 },
        },
      });
      const picture = new THREE.Mesh(bend(new THREE.PlaneGeometry(SW, SH, 48, 1), YMID), mat);
      picture.position.z = 0.002;
      picture.userData.index = i;
      group.add(picture);
      this.hitMeshes.push(picture);

      // Feet: two short matte blocks, set back, so it stands on the floor.
      for (const fx of [-SW * 0.36, SW * 0.36]) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, Y0 - BORDER, 0.34), shellMat);
        const a = fx / CURVE;
        foot.position.set(CURVE * Math.sin(a), (Y0 - BORDER) / 2, CURVE * (1 - Math.cos(a)) - DEPTH - 0.1);
        foot.rotation.y = -a;
        group.add(foot);
      }

      // The picture as a light: a flat panel just in front, facing out.
      const colour = new THREE.Color(0.6, 0.5, 0.4);
      const light = new THREE.RectAreaLight(colour, 0, SW * 0.96, SH * 0.94);
      light.position.set(0, YMID, EZ * 0.4 + 0.05);
      group.add(light);
      group.updateMatrixWorld(true);
      light.lookAt(new THREE.Vector3(0, YMID, 10).applyMatrix4(group.matrixWorld)); // lookAt is in world space

      const centre = new THREE.Vector3(0, YMID, 0).applyMatrix4(group.matrixWorld);
      const normal = new THREE.Vector3(Math.sin(place.rot), 0, Math.cos(place.rot));

      this.screens.push({
        video,
        texture,
        poster,
        live: false,
        mat,
        light,
        colour,
        power: 0,
        powerAt: (this.reduced ? 0 : 700) + [280, 0, 520][i],
        dim: 0,
        hover: 0,
        centre,
        normal,
      });
    });

    // Matte polished concrete. Rough enough that the screens' light spreads
    // into soft pools and a long, blurred sheen; never a mirror.
    const concrete = concreteTexture();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({
        color: 0x1d1d1e,
        map: concrete,
        roughness: 0.86,
        roughnessMap: concrete,
        metalness: 0,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
  }

  private makeDust() {
    const n = 70;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = 0.3 + Math.random() * 4;
      pos[i * 3 + 2] = ZC - 0.5 + Math.random() * 7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe2c4,
      size: 0.014,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    return new THREE.Points(geo, mat);
  }

  /** Average colour of what a screen shows, so its light matches the film. */
  private sampleColour(s: Screen) {
    const g = this.sampler;
    const src = (s.live ? s.video : s.poster.image) as CanvasImageSource | undefined;
    if (!g || !src) return;
    try {
      g.drawImage(src, 0, 0, 16, 8);
      const d = g.getImageData(0, 0, 16, 8).data;
      let r = 0;
      let gr = 0;
      let b = 0;
      for (let k = 0; k < d.length; k += 4) {
        r += d[k];
        gr += d[k + 1];
        b += d[k + 2];
      }
      const n = (d.length / 4) * 255;
      const target = new THREE.Color().setRGB(r / n, gr / n, b / n, THREE.SRGBColorSpace);
      s.colour.lerp(target, 0.35);
    } catch {
      // a frame that can't be read yet; keep the last colour
    }
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

    // Back the camera off until the displays fit: all three on wide screens,
    // the centre one (with the others peeking in) on phones.
    const corners: THREE.Vector3[] = [];
    for (const i of this.portrait ? [1] : [0, 2]) {
      const pl = PLACES[i];
      for (const x of [-EX, EX]) {
        for (const y of [Y0 - BORDER, Y0 + SH + BORDER]) {
          const v = new THREE.Vector3(x, y, EZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), pl.rot);
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
    // Orbit a pivot just in front of the displays.
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
    const on = <K extends keyof WindowEventMap>(target: HTMLElement | Window, type: K, fn: (e: WindowEventMap[K]) => void) => {
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
    this.yawTarget = 0;
    this.pitchTarget = 0;
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
    this.frame++;

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
        s.mat.uniforms.map.value = s.texture;
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
      const u = s.mat.uniforms;
      u.uPower.value = s.power;
      u.uDim.value = s.dim;
      u.uHover.value = s.hover;
      u.uTime.value = t / 1000;

      if ((this.frame + i) % 5 === 0) this.sampleColour(s);
      const on = THREE.MathUtils.smoothstep(s.power, 0.3, 1);
      s.light.color.copy(s.colour);
      s.light.intensity = LIGHT * on * (1 - 0.82 * s.dim) * (1 + 0.14 * s.hover);
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
        let y = p.getY(i) + dt * 0.04;
        if (y > 4.3) y = 0.3;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t / 2400 + i) * dt * 0.012);
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
