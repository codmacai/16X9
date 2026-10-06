import * as THREE from "three";

// ===========================================================================
// HERO 25 — zoetrope.
//
// A machined drum, matte black, twelve slits round its wall and twelve frames
// of film printed round the inside. Spin it and you watch the frames through
// the slits, the way people first saw pictures move.
//
// It behaves like the real instrument. The picture advances one frame for
// every slit that passes your eye, so its frame rate is slits × turns a
// second: spin it slowly and it flickers like stop-motion, spin it faster and
// it runs smooth, spin it backwards and the film runs backwards. The slit band
// smears into a dark veil as it speeds up and the strip behind settles into
// one steady, moving picture. At 24 frames a second, the speed of film, a
// motor catches the drum and holds it there.
//
// The film is longer than the twelve frames on the wall: as it runs, the
// strip keeps feeding through, so you see the whole shot, not a 12-frame loop.
// ===========================================================================

export type Reel = { title: string; atlas: string; frames: number };

export type StageEvents = {
  onLock?: (locked: boolean) => void;
};

const N = 12; // slits, and frames on the wall
const P = (Math.PI * 2) / N; // one slit-and-frame period, as an angle
const DUTY = 0.2; // share of a period that is slit
const R = 1.7; // drum radius
const H = 0.66; // drum height: wide and shallow, like the real thing
const BAND = [0.1, 0.6]; // slit band, as heights on the wall
const FRAME_W = R * P * (1 - DUTY);
const FRAME_H = (FRAME_W * 9) / 16;
const FRAME_Y = (BAND[0] + BAND[1]) / 2 - FRAME_H / 2;
const OMEGA_24 = (24 * Math.PI * 2) / N; // rad/s at 24 fps
const ATLAS_C = 8;
const ATLAS_R = 6;

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const f = (n: number) => n.toFixed(6);

const WORLD_VERT = /* glsl */ `
  varying vec3 vW;
  varying vec3 vN;
  varying vec2 vUv;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const COMMON = /* glsl */ `
  #define PI 3.14159265
  #define TAU 6.28318531
  uniform float uDrum;  // drum angle
  uniform float uS;     // 0 … 1: how far the eye has stopped seeing slits and started seeing a film
  uniform float uIn;    // intro
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 toLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  // where a point sits in its period: 0 at a slit's centre, ±0.5 halfway between slits
  float cellPos(float theta){ float w = theta / ${f(P)}; return w - floor(w + 0.5); }
  float inBand(float y){ return step(${f(BAND[0])}, y) * step(y, ${f(BAND[1])}); }
`;

// The inside of the back of the drum: the film strip.
const INNER_FRAG = /* glsl */ `
  ${COMMON}
  uniform sampler2D uAtlas;
  uniform float uLen;     // frames in the reel
  uniform float uAnim;    // the frame the eye is seeing
  uniform float uBlur;    // motion blur, radians
  uniform float uFlicker; // slow speeds flicker
  varying vec3 vW;
  varying vec3 vN;
  varying vec2 vUv;

  vec3 frameAt(float frame, vec2 local){
    float fr = mod(floor(frame + 0.5), uLen);
    vec2 cell = vec2(mod(fr, ${f(ATLAS_C)}), floor(fr / ${f(ATLAS_C)}));
    vec2 inset = 0.5 + (local - 0.5) * 0.985;
    vec2 auv = vec2((cell.x + inset.x) / ${f(ATLAS_C)}, 1.0 - (cell.y + 1.0 - inset.y) / ${f(ATLAS_R)});
    return toLinear(texture2D(uAtlas, auv).rgb);
  }

  // what is printed at a point on the wall: a frame, or the black between them
  vec3 printed(float theta, float y, float baseFrame){
    float w = theta / ${f(P)};
    float k = floor(w + 0.5);
    float u = w - k; // -0.5 … 0.5, slits at ±0.5
    float half_ = ${f((1 - DUTY) / 2)};
    vec2 local = vec2(u / ${f(1 - DUTY)} + 0.5, (y - ${f(FRAME_Y)}) / ${f(FRAME_H)});
    float inside = step(abs(u), half_) * step(0.0, local.y) * step(local.y, 1.0);
    vec3 paper = vec3(0.0015);
    return inside > 0.5 ? frameAt(baseFrame + k, local) : paper;
  }

  void main(){
    float phi = atan(vW.x, vW.z);     // around the drum, 0 facing you
    float y = vW.y;
    float theta = phi - uDrum;         // on the drum's own wall
    float c = cellPos(theta + ${f(P / 2)}); // slits sit between frames
    // the back wall's own slits: open when still, blurred away at speed
    float slit = inBand(y) * step(abs(c), ${f(DUTY / 2)});
    if (slit > 0.5 && uS < 0.02) discard;

    // what's physically there: the strip turning with the drum, blurred by its speed
    vec3 phys = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      float o = (float(i) / 4.0 - 0.5) * uBlur;
      phys += printed(theta + o, y, 0.0);
    }
    phys /= 5.0;

    // what the eye sees at speed: the strip standing still, each window a frame of the film
    vec3 seen = printed(phi - PI, y, uAnim);
    // light through the slits: the image throbs at low frame rates
    float flick = 1.0 - uFlicker * (0.55 + 0.45 * cos(fract(uAnim) * TAU));
    seen *= flick;

    vec3 col = mix(phys * 0.6, seen * ${f(1 / DUTY)} * 1.2, uS);
    col *= 1.0 - slit * (1.0 - uS);
    // the wall curves away from the light at its sides
    col *= 0.55 + 0.45 * cos(phi - PI);
    gl_FragColor = vec4(col * uIn, 1.0);
    #include <colorspace_fragment>
  }
`;

// The outside of the front: anodised black metal, the slit band.
const OUTER_FRAG = /* glsl */ `
  ${COMMON}
  varying vec3 vW;
  varying vec3 vN;
  varying vec2 vUv;
  void main(){
    float phi = atan(vW.x, vW.z);
    float y = vW.y;
    float theta = phi - uDrum;
    float c = cellPos(theta + ${f(P / 2)});
    float band = inBand(y);
    float slit = band * step(abs(c), ${f(DUTY / 2)});

    // open slits when still; at speed the band blurs into a veil you see through
    float alpha = mix(1.0 - slit, mix(1.0, ${f(1 - DUTY)}, band), uS);
    if (alpha < 0.01) discard;

    // matte anodised: a little diffuse, fine brushed lines, two soft studio
    // reflections that stay put while the drum turns under them
    vec3 N = normalize(vN);
    float diff = max(dot(N, normalize(vec3(-0.5, 0.6, 0.65))), 0.0);
    float brushed = 0.85 + 0.15 * hash(vec2(floor(y * 900.0), 1.0));
    vec3 col = vec3(0.0022) + vec3(0.011) * diff * brushed;
    col += vec3(0.03) * exp(-pow(phi + 0.55, 2.0) / 0.012);
    col += vec3(0.01) * exp(-pow(phi - 0.85, 2.0) / 0.03);
    // the slit edges catch the light (sharp when still, gone in the blur)
    float edge = band * (1.0 - smoothstep(0.0, 0.012, abs(abs(c) - ${f(DUTY / 2)})));
    col += vec3(0.035) * edge * (1.0 - uS) * (0.4 + diff);
    // the veil: dark, a faint shimmer of the slits going by
    col = mix(col, vec3(0.0012), uS * band * 0.6);
    gl_FragColor = vec4(col * uIn, alpha);
    #include <colorspace_fragment>
  }
`;

// Turned steel: the lip, the hub, the foot.
const STEEL_FRAG = /* glsl */ `
  uniform float uIn;
  uniform float uBright;
  varying vec3 vW;
  varying vec3 vN;
  varying vec2 vUv;
  void main(){
    float phi = atan(vW.x, vW.z);
    vec3 N = normalize(vN);
    float diff = max(dot(N, normalize(vec3(-0.5, 0.7, 0.6))), 0.0);
    vec3 col = vec3(0.003) + vec3(0.018) * diff;
    col += vec3(0.16) * exp(-pow(phi + 0.55, 2.0) / 0.01) * max(N.y + 0.4, 0.2);
    col += vec3(0.04) * exp(-pow(N.y - 0.9, 2.0) / 0.02);
    gl_FragColor = vec4(col * uBright * uIn, 1.0);
    #include <colorspace_fragment>
  }
`;

const SHADOW_FRAG = /* glsl */ `
  uniform float uIn;
  varying vec2 vUv;
  void main(){
    vec2 d = (vUv - 0.5) * 2.0;
    float a = exp(-dot(d, d) * 3.0) * 0.85;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a * uIn);
  }
`;

export class Zoetrope {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  private inner: THREE.ShaderMaterial;
  private outer: THREE.ShaderMaterial;
  private steel: THREE.ShaderMaterial[] = [];
  private shared = {
    uDrum: { value: 0 },
    uS: { value: 0 },
    uIn: { value: 0 },
  };
  private atlases: THREE.Texture[];
  private reel = 0;

  private angle = 0;
  private omega = 0.55; // rad/s
  private anim = 0;
  private locked = false;
  private motor = false; // spinning itself up to 24
  private dragging = false;
  private grab = { x: 0, angle: 0, t: 0, samples: [] as { x: number; t: number }[] };
  private mouse = new THREE.Vector2();
  private intro = 0;

  private audio: {
    ctx: AudioContext;
    out: GainNode;
    whirr: GainNode;
    band: BiquadFilterNode;
    hum: GainNode;
    clickBuf: AudioBuffer;
  } | null = null;
  private soundOn = false;
  private lastFrame = 0;

  private last = performance.now();
  private raf = 0;
  private disposed = false;
  private cleanups: (() => void)[] = [];

  constructor(
    private host: HTMLElement,
    reels: Reel[],
    private events: StageEvents = {},
    private reduced = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(new THREE.Color("#070707"), 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";

    const loader = new THREE.TextureLoader();
    this.atlases = reels.map((r) => {
      const t = loader.load(r.atlas);
      t.colorSpace = THREE.NoColorSpace; // decoded in the shader
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.anisotropy = 8;
      return t;
    });

    this.inner = new THREE.ShaderMaterial({
      vertexShader: WORLD_VERT,
      fragmentShader: INNER_FRAG,
      side: THREE.BackSide,
      uniforms: {
        ...this.shared,
        uAtlas: { value: this.atlases[0] },
        uLen: { value: reels[0].frames },
        uAnim: { value: 0 },
        uBlur: { value: 0 },
        uFlicker: { value: 0 },
      },
    });
    this.outer = new THREE.ShaderMaterial({
      vertexShader: WORLD_VERT,
      fragmentShader: OUTER_FRAG,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
      uniforms: { ...this.shared },
    });
    this.reels = reels;
    this.build();

    this.resize();
    this.bind();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  private reels: Reel[];

  private steelMat(bright = 1) {
    const m = new THREE.ShaderMaterial({
      vertexShader: WORLD_VERT,
      fragmentShader: STEEL_FRAG,
      uniforms: { uIn: this.shared.uIn, uBright: { value: bright } },
    });
    this.steel.push(m);
    return m;
  }

  private build() {
    const wall = new THREE.CylinderGeometry(R, R, H, 192, 24, true);
    wall.translate(0, H / 2, 0);
    const inside = new THREE.Mesh(wall, this.inner);
    const outside = new THREE.Mesh(wall, this.outer);
    outside.renderOrder = 2;
    this.scene.add(inside, outside);

    // turned steel lip round the top, a band round the foot of the wall
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R, 0.022, 16, 192), this.steelMat(1.2));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = H;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.06, 192, 1, true), this.steelMat(0.8));
    foot.position.y = 0.03;
    this.scene.add(lip, foot);

    // floor of the drum, hub, spindle and base
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 96), this.steelMat(0.5));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 32), this.steelMat(1));
    spindle.position.y = -0.3;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.08, 48), this.steelMat(1.1));
    collar.position.y = -0.04;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.07, 96), this.steelMat(0.9));
    base.position.y = -0.6;
    this.scene.add(floor, spindle, collar, base);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT,
        fragmentShader: SHADOW_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: { uIn: this.shared.uIn },
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.636;
    this.scene.add(shadow);
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    const aspect = w / h;
    this.camera.aspect = aspect;
    // the drum fills about 46% of the width, or 86% on a phone
    const want = aspect < 1 ? 0.88 : 0.54;
    const dist = (R * 2) / want / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    this.camera.userData.dist = Math.max(dist, 5.2);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  // -------------------------------------------------------------------------
  // Input: grab the drum and throw it.
  // -------------------------------------------------------------------------

  private bind() {
    const el = this.host;
    const on = <K extends keyof WindowEventMap>(t: HTMLElement | Window, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.cleanups.push(() => t.removeEventListener(type, fn as EventListener));
    };
    // a pixel dragged across the drum's face turns it by about that much of its rim
    const perPx = () => 1 / (el.clientWidth * (el.clientWidth / el.clientHeight < 1 ? 0.43 : 0.23));

    on(el, "pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      this.dragging = true;
      this.motor = false;
      this.setLocked(false);
      this.grab = { x: e.clientX, angle: this.angle, t: performance.now(), samples: [{ x: e.clientX, t: performance.now() }] };
      this.ensureAudio();
    });
    on(el, "pointermove", (e) => {
      const r = el.getBoundingClientRect();
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (!this.dragging) return;
      const now = performance.now();
      this.angle = this.grab.angle + (e.clientX - this.grab.x) * perPx();
      this.grab.samples.push({ x: e.clientX, t: now });
      while (this.grab.samples.length > 2 && now - this.grab.samples[0].t > 90) this.grab.samples.shift();
      const a = this.grab.samples[0];
      const dtS = Math.max(8, now - a.t) / 1000;
      this.omega = ((e.clientX - a.x) * perPx()) / dtS;
    });
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      const lastS = this.grab.samples[this.grab.samples.length - 1];
      if (performance.now() - lastS.t > 100) this.omega *= 0.2; // held still before letting go
    };
    on(el, "pointerup", up);
    on(el, "pointercancel", up);
    on(el, "pointerleave", () => this.mouse.set(0, 0));
    on(
      el,
      "wheel",
      (e) => {
        e.preventDefault();
        this.motor = false;
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        this.omega -= d * 0.0035;
        this.ensureAudio();
      },
      { passive: false },
    );
    on(window, "resize", () => this.resize());
  }

  private setLocked(l: boolean) {
    if (l === this.locked) return;
    this.locked = l;
    this.events.onLock?.(l);
    if (l) this.thump();
  }

  /** Spin up to 24 by itself (or stop, if it's already running). */
  toggleMotor() {
    this.ensureAudio();
    if (this.motor || this.locked) {
      this.motor = false;
      this.setLocked(false);
      this.omega *= 0.98;
      this.brake = true;
    } else {
      this.motor = true;
      this.brake = false;
    }
  }
  private brake = false;

  setReel(i: number) {
    this.reel = i;
    this.inner.uniforms.uAtlas.value = this.atlases[i];
    this.inner.uniforms.uLen.value = this.reels[i].frames;
  }

  get fps() {
    return (N * this.omega) / (Math.PI * 2);
  }
  get isLocked() {
    return this.locked;
  }
  get isMotor() {
    return this.motor || this.locked;
  }

  // -------------------------------------------------------------------------
  // Sound: a tick for each slit at low speed, rising into a whirr, a hum at 24.
  // -------------------------------------------------------------------------

  setSound(on: boolean) {
    this.soundOn = on;
    this.ensureAudio();
    if (this.audio) {
      if (this.audio.ctx.state === "suspended") this.audio.ctx.resume();
      this.audio.out.gain.setTargetAtTime(on ? 1 : 0, this.audio.ctx.currentTime, 0.1);
    }
  }

  private ensureAudio() {
    if (this.audio || !this.soundOn) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.4;
    band.frequency.value = 300;
    const whirr = ctx.createGain();
    whirr.gain.value = 0;
    noise.connect(band).connect(whirr).connect(out);
    noise.start();

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 48;
    const hum = ctx.createGain();
    hum.gain.value = 0;
    osc.connect(hum).connect(out);
    osc.start();

    const clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.012), ctx.sampleRate);
    const c = clickBuf.getChannelData(0);
    for (let i = 0; i < c.length; i++) c[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / c.length, 3);
    this.audio = { ctx, out, whirr, band, hum, clickBuf };
  }

  private click(gain: number) {
    const a = this.audio;
    if (!a || !this.soundOn) return;
    const s = a.ctx.createBufferSource();
    s.buffer = a.clickBuf;
    const hp = a.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2200;
    const g = a.ctx.createGain();
    g.gain.value = gain;
    s.connect(hp).connect(g).connect(a.out);
    s.start();
  }

  private thump() {
    const a = this.audio;
    if (!a || !this.soundOn) return;
    const o = a.ctx.createOscillator();
    o.frequency.setValueAtTime(90, a.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, a.ctx.currentTime + 0.18);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.35, a.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + 0.25);
    o.connect(g).connect(a.out);
    o.start();
    o.stop(a.ctx.currentTime + 0.3);
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    // physics: a bearing's friction; a motor that holds 24 once it's close
    if (!this.dragging) {
      const fps = Math.abs(this.fps);
      if (this.motor) {
        const dir = this.omega < 0 ? -1 : 1;
        this.omega += (dir * OMEGA_24 - this.omega) * damp(1.1, dt);
        if (Math.abs(Math.abs(this.omega) - OMEGA_24) < 0.15) {
          this.motor = false;
          this.setLocked(true);
        }
      } else if (this.locked) {
        const dir = this.omega < 0 ? -1 : 1;
        this.omega += (dir * OMEGA_24 - this.omega) * damp(4, dt);
      } else {
        // a free drum slows down; a hand-thrown one near 24 is caught
        if (fps > 20 && fps < 28.5 && !this.brake) this.motor = true;
        const fr = this.brake ? 1.6 : 0.32;
        this.omega -= this.omega * fr * dt + Math.sign(this.omega) * 0.04 * dt;
        if (Math.abs(this.omega) < 0.02) {
          this.omega = 0;
          this.brake = false;
        }
      }
      this.angle += this.omega * dt;
    }
    if (this.reduced && !this.dragging && !this.motor && !this.locked) this.omega = 0;

    const fps = Math.abs(this.fps);
    // the picture advances a frame per slit: reversed if the drum is
    this.anim += this.fps * dt;
    const len = this.reels[this.reel].frames;
    this.anim = ((this.anim % len) + len) % len;

    const S = sstep(8, 17, fps);
    this.shared.uDrum.value = this.angle;
    this.shared.uS.value = S;
    this.inner.uniforms.uAnim.value = this.anim;
    this.inner.uniforms.uBlur.value = Math.min(P * 0.9, Math.abs(this.omega) * 0.022);
    this.inner.uniforms.uFlicker.value = (1 - sstep(10, 20, fps)) * sstep(3, 8, fps);

    this.intro = Math.min(1, this.intro + dt / (this.reduced ? 0.01 : 2));
    this.shared.uIn.value = this.intro * this.intro * (3 - 2 * this.intro);

    // camera: a slow settle in, the mouse tilts it a touch
    const d = (this.camera.userData.dist as number) + (1 - this.shared.uIn.value) * 1.6;
    const yaw = this.mouse.x * 0.07;
    const pitch = 0.07 + this.mouse.y * 0.03;
    this.camera.position.set(Math.sin(yaw) * d, 0.34 + Math.sin(pitch) * d * 0.12, Math.cos(yaw) * d);
    this.camera.lookAt(0, 0.08, 0);

    // sound
    if (this.audio && this.soundOn) {
      const t = this.audio.ctx.currentTime;
      const frame = Math.floor(this.anim);
      if (frame !== this.lastFrame) {
        this.lastFrame = frame;
        if (fps < 16) this.click(0.5 * (1 - sstep(8, 16, fps)));
      }
      this.audio.whirr.gain.setTargetAtTime(0.16 * sstep(6, 24, fps), t, 0.08);
      this.audio.band.frequency.setTargetAtTime(160 + fps * 26, t, 0.08);
      this.audio.hum.gain.setTargetAtTime(this.locked ? 0.05 : 0, t, 0.3);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((fn) => fn());
    this.audio?.ctx.close();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
    this.atlases.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
