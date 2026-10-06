import * as THREE from "three";

// ===========================================================================
// HERO 24 — the reel.
//
// One band of films in the middle of the page: three rows of 16:9 screens set
// around the inside of a cylinder, so the band curves away from you at both
// ends like a cinema wall, and fades out before it reaches the edges. Every
// screen plays its film, in black and white, dressed like hero 13's tiles:
// title, number, running time, a hairline frame.
//
// Drag (or scroll) to run the reel; it carries on with your throw and settles
// into a slow drift. The three rows travel at slightly different speeds, so
// the band has depth. Point at a film: it comes forward, in colour, framed in
// its own accent, and the rest dim. Click to open it.
//
// Every film is drawn, with its labels, into one shared canvas each frame, so
// the whole band is one texture and one draw call; the shader bends each
// screen onto the curve.
// ===========================================================================

export type ReelFilm = { title: string; duration: string; src: string; poster: string; accent: string };

export type ReelEvents = {
  onHover?: (film: number | null) => void;
  onOpen?: (film: number, rect: { top: number; left: number; width: number; height: number }, time: number) => void;
};

const ROWS = 3;
const COLS = 22; // screens around the whole circle, per row
const R = 6.4; // radius of the curve
const STEP = (Math.PI * 2) / COLS;
const GAP = 0.13;
const TW = STEP * R - GAP; // screen width along the curve
const TH = (TW * 9) / 16;
const TA = TW / R; // a screen's width as an angle
const BAND_H = ROWS * TH + (ROWS - 1) * GAP;
const ROW_SPEED = [1.0, 0.86, 1.14];
const CORNER = 0.045;
const CELL_W = 480;
const CELL_H = 270;
const ATLAS_COLS = 4;
const DRIFT = -0.035; // radians a second, when left alone

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const rowY = (r: number) => BAND_H / 2 - TH / 2 - r * (TH + GAP);

const f = (n: number) => n.toFixed(6);

const VERT = /* glsl */ `
  uniform float uOff0, uOff1, uOff2;
  uniform float uIntro;
  attribute float aRow;
  attribute float aCol;
  attribute float aFilm;
  attribute vec3 aAccent;
  attribute float aLift; // 0 … 1, the screen under the pointer comes forward
  varying vec2 vUv;
  varying float vFilm;
  varying vec3 vAccent;
  varying float vLift;
  varying float vSide;
  varying float vIn;

  float ease(float t){ return 1.0 - pow(1.0 - t, 4.0); }

  void main(){
    float off = aRow < 0.5 ? uOff0 : (aRow < 1.5 ? uOff1 : uOff2);
    float centre = aCol * ${f(STEP)} + off;
    centre = mod(centre + 3.14159265, 6.28318531) - 3.14159265; // 0 is straight ahead

    // in: from the middle out, row by row
    float t = clamp(uIntro * 1.9 - abs(centre) * 0.6 - aRow * 0.16, 0.0, 1.0);
    float e = ease(t);

    float s = 1.0 + aLift * 0.07;
    float a = centre + position.x * ${f(TA)} * s;
    float rad = ${f(R)} - aLift * 0.5 - (1.0 - e) * 0.8;
    float y = ${f(BAND_H / 2 - TH / 2)} - aRow * ${f(TH + GAP)} + position.y * ${f(TH)} * s - (1.0 - e) * 0.35;
    vec3 p = vec3(rad * sin(a), y, -rad * cos(a));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vUv = uv;
    vFilm = aFilm;
    vAccent = aAccent;
    vLift = aLift;
    vSide = abs(a); // per point, so the fade runs smoothly across a screen
    vIn = e;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D atlas;
  uniform float uAny; // 0 … 1, something is hovered
  varying vec2 vUv;
  varying float vFilm;
  varying vec3 vAccent;
  varying float vLift;
  varying float vSide;
  varying float vIn;

  vec3 toLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

  void main(){
    // rounded corners, measured in world units
    vec2 size = vec2(${f(TW)}, ${f(TH)});
    vec2 q = abs(vUv - 0.5) * size - (size * 0.5 - ${f(CORNER)});
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${f(CORNER)};
    float aa = fwidth(dist);
    float alpha = 1.0 - smoothstep(-aa, aa, dist);
    if (alpha < 0.01) discard;

    float c = floor(vFilm + 0.5);
    vec2 cell = vec2(mod(c, ${ATLAS_COLS.toFixed(1)}), floor(c / ${ATLAS_COLS.toFixed(1)}));
    vec2 auv = vec2((cell.x + vUv.x) / ${ATLAS_COLS.toFixed(1)}, 1.0 - (cell.y + 1.0 - vUv.y) / ATLAS_ROWS);
    vec3 film = toLinear(texture2D(atlas, auv).rgb);

    // black and white at rest; the film you point at is in colour
    float grey = dot(film, vec3(0.2126, 0.7152, 0.0722));
    vec3 col = mix(vec3(grey) * 0.9, film, vLift);
    col *= mix(1.0, 0.38, uAny * (1.0 - vLift));

    // hairline frame, white at rest, the film's accent when pointed at
    float line = 1.0 - smoothstep(0.0, aa * 1.6 + 0.004, abs(dist + 0.004));
    vec3 frame = mix(vec3(0.22), toLinear(vAccent), vLift);
    col = mix(col, frame, line * mix(0.75, 1.0, vLift));

    // fade out toward the ends of the band
    float fade = 1.0 - smoothstep(0.26, 0.64, vSide);
    fade *= fade;
    // fade into the room's own black (#050505), not past it
    gl_FragColor = vec4(mix(vec3(0.00152), col, fade * vIn), alpha);
    #include <colorspace_fragment>
  }
`;

type Source = { video: HTMLVideoElement; poster: HTMLImageElement };

export class Reel {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
  private mat: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  private lift: Float32Array;
  private sources: Source[];
  private atlas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private font = "sans-serif";

  private off = 0; // how far the reel has run (radians)
  private vel = DRIFT;
  private hovered: number | null = null; // instance
  private any = 0;
  private intro = 0;
  private pointer = new THREE.Vector2(9, 9);
  private press = { x: 0, off: 0, t: 0, down: false, moved: false, lastX: 0, lastT: 0 };
  private paused = false;

  private last = performance.now();
  private raf = 0;
  private disposed = false;
  private cleanups: (() => void)[] = [];

  constructor(
    private host: HTMLElement,
    private films: ReelFilm[],
    private events: ReelEvents = {},
    private reduced = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(new THREE.Color("#050505"), 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.font = getComputedStyle(host).fontFamily || "sans-serif";

    this.sources = films.map((film) => {
      const video = document.createElement("video");
      video.src = film.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute("playsinline", "");
      video.play().catch(() => {});
      const poster = new Image();
      poster.src = film.poster;
      return { video, poster };
    });

    const atlasRows = Math.ceil(films.length / ATLAS_COLS);
    this.atlas = document.createElement("canvas");
    this.atlas.width = CELL_W * ATLAS_COLS;
    this.atlas.height = CELL_H * atlasRows;
    this.ctx = this.atlas.getContext("2d")!;
    this.ctx.fillStyle = "#111";
    this.ctx.fillRect(0, 0, this.atlas.width, this.atlas.height);
    this.tex = new THREE.CanvasTexture(this.atlas);
    this.tex.colorSpace = THREE.NoColorSpace; // decoded in the shader
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.tex.anisotropy = 4;

    // the screens
    const count = ROWS * COLS;
    const plane = new THREE.PlaneGeometry(1, 1, 12, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = plane.index;
    this.geo.setAttribute("position", plane.getAttribute("position"));
    this.geo.setAttribute("uv", plane.getAttribute("uv"));
    this.geo.instanceCount = count;
    const row = new Float32Array(count);
    const col = new Float32Array(count);
    const film = new Float32Array(count);
    const accent = new Float32Array(count * 3);
    this.lift = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      row[i] = r;
      col[i] = c;
      // each row starts at a different film, so no column repeats
      const fi = (c * 1 + r * 5) % films.length;
      film[i] = fi;
      const ac = new THREE.Color(films[fi].accent);
      accent.set([ac.r, ac.g, ac.b], i * 3);
    }
    this.geo.setAttribute("aRow", new THREE.InstancedBufferAttribute(row, 1));
    this.geo.setAttribute("aCol", new THREE.InstancedBufferAttribute(col, 1));
    this.geo.setAttribute("aFilm", new THREE.InstancedBufferAttribute(film, 1));
    this.geo.setAttribute("aAccent", new THREE.InstancedBufferAttribute(accent, 3));
    this.geo.setAttribute("aLift", new THREE.InstancedBufferAttribute(this.lift, 1));

    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: `#define ATLAS_ROWS ${atlasRows.toFixed(1)}\n` + FRAG,
      uniforms: {
        atlas: { value: this.tex },
        uOff0: { value: 0 },
        uOff1: { value: 0 },
        uOff2: { value: 0 },
        uIntro: { value: reduced ? 1 : 0 },
        uAny: { value: 0 },
      },
      alphaToCoverage: true,
    });
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    this.resize();
    this.bind();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Stand a little behind the centre of the curve, so the band bows.
    const z = 1.6;
    this.camera.position.set(0, 0, z);
    this.camera.lookAt(0, 0, -R);
    // The band fills about half the height on wide screens; on phones, show
    // about three screens across instead.
    const dist = R + z;
    const bandFrac = aspect < 1 ? 0.3 : 0.5;
    let vfov = 2 * Math.atan(BAND_H / bandFrac / 2 / dist);
    if (aspect < 1) {
      const hfov = 2 * Math.atan((TW * 3.1) / 2 / (R * 0.98 + z));
      vfov = Math.max(vfov, 2 * Math.atan(Math.tan(hfov / 2) / aspect));
    }
    this.camera.fov = THREE.MathUtils.radToDeg(vfov);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private bind() {
    const el = this.host;
    const on = <K extends keyof WindowEventMap>(t: HTMLElement | Window, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.cleanups.push(() => t.removeEventListener(type, fn as EventListener));
    };
    const ndc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    // how far the reel turns per pixel dragged: about the width of the screen per half turn
    const perPx = () => (Math.PI * 0.9) / (el.clientWidth || 1);

    on(el, "pointerdown", (e) => {
      if (this.paused) return;
      ndc(e);
      el.setPointerCapture(e.pointerId);
      const now = performance.now();
      this.press = { x: e.clientX, off: this.off, t: now, down: true, moved: false, lastX: e.clientX, lastT: now };
      this.vel = 0;
      for (const s of this.sources) s.video.play().catch(() => {});
    });
    on(el, "pointermove", (e) => {
      ndc(e);
      if (!this.press.down) return;
      const dx = e.clientX - this.press.x;
      if (Math.abs(dx) > 6) this.press.moved = true;
      this.off = this.press.off + dx * perPx();
      const now = performance.now();
      const dt = Math.max(1, now - this.press.lastT) / 1000;
      this.vel = ((e.clientX - this.press.lastX) * perPx()) / dt;
      this.press.lastX = e.clientX;
      this.press.lastT = now;
    });
    const up = () => {
      if (!this.press.down) return;
      this.press.down = false;
      if (performance.now() - this.press.lastT > 80) this.vel = 0; // held still before letting go
      if (!this.press.moved && this.hovered !== null) this.open(this.hovered);
    };
    on(el, "pointerup", up);
    on(el, "pointercancel", up);
    on(el, "pointerleave", () => this.pointer.set(9, 9));
    on(
      el,
      "wheel",
      (e) => {
        if (this.paused) return;
        e.preventDefault();
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        this.vel += -d * 0.0009;
      },
      { passive: false },
    );
    on(window, "keydown", (e) => {
      if (this.paused) return;
      if (e.key === "ArrowRight") this.vel -= 0.9;
      if (e.key === "ArrowLeft") this.vel += 0.9;
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

  /** Stop answering the pointer (while a film is open over the reel). */
  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.pointer.set(9, 9);
  }

  /** Which screen is under the pointer: hit the inside of the curve, then find row and column. */
  private pick(): number | null {
    if (this.pointer.x > 2 || this.press.down) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.pointer, this.camera);
    const o = ray.ray.origin;
    const d = ray.ray.direction;
    // x² + z² = R², far root (we stand inside)
    const a = d.x * d.x + d.z * d.z;
    const b = 2 * (o.x * d.x + o.z * d.z);
    const c = o.x * o.x + o.z * o.z - R * R;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b + Math.sqrt(disc)) / (2 * a);
    const p = o.clone().addScaledVector(d, t);
    const ang = Math.atan2(p.x, -p.z);
    if (Math.abs(ang) > 0.5) return null; // faded out there
    for (let r = 0; r < ROWS; r++) {
      if (Math.abs(p.y - rowY(r)) > TH / 2) continue;
      const local = wrapPi(ang - this.off * ROW_SPEED[r]);
      const col = Math.round(local / STEP);
      if (Math.abs(local - col * STEP) > TA / 2) return null;
      return r * COLS + (((col % COLS) + COLS) % COLS);
    }
    return null;
  }

  private filmOf(instance: number) {
    return (this.geo.getAttribute("aFilm") as THREE.InstancedBufferAttribute).getX(instance);
  }

  /** The screen's box on the page, for the film to open out of. */
  private open(instance: number) {
    const r = Math.floor(instance / COLS);
    const c = instance % COLS;
    const centre = wrapPi(c * STEP + this.off * ROW_SPEED[r]);
    const rect = this.host.getBoundingClientRect();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const sx of [-0.5, 0.5]) {
      for (const sy of [-0.5, 0.5]) {
        const a = centre + sx * TA * 1.07;
        const rad = R - 0.5;
        const v = new THREE.Vector3(rad * Math.sin(a), rowY(r) + sy * TH * 1.07, -rad * Math.cos(a)).project(this.camera);
        xs.push(rect.left + ((v.x + 1) / 2) * rect.width);
        ys.push(rect.top + ((1 - v.y) / 2) * rect.height);
      }
    }
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const film = this.filmOf(instance);
    this.events.onOpen?.(film, { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }, this.sources[film].video.currentTime);
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private drawAtlas() {
    const g = this.ctx;
    this.films.forEach((film, i) => {
      const x = (i % ATLAS_COLS) * CELL_W;
      const y = Math.floor(i / ATLAS_COLS) * CELL_H;
      const s = this.sources[i];
      const v = s.video;
      if (v.readyState >= 2 && v.currentTime > 0) g.drawImage(v, x, y, CELL_W, CELL_H);
      else if (s.poster.complete && s.poster.naturalWidth) g.drawImage(s.poster, x, y, CELL_W, CELL_H);
      else return;

      // hero 13's dressing: shade top and foot, title, number, running time
      const top = g.createLinearGradient(0, y, 0, y + CELL_H * 0.4);
      top.addColorStop(0, "rgba(0,0,0,0.55)");
      top.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = top;
      g.fillRect(x, y, CELL_W, CELL_H * 0.4);
      const foot = g.createLinearGradient(0, y + CELL_H * 0.72, 0, y + CELL_H);
      foot.addColorStop(0, "rgba(0,0,0,0)");
      foot.addColorStop(1, "rgba(0,0,0,0.6)");
      g.fillStyle = foot;
      g.fillRect(x, y + CELL_H * 0.72, CELL_W, CELL_H * 0.28);

      g.fillStyle = "rgba(255,255,255,0.94)";
      g.textBaseline = "alphabetic";
      g.font = `300 30px ${this.font}`;
      g.fillText(film.title.toUpperCase(), x + 22, y + 46, CELL_W - 44);
      g.font = `600 15px ${this.font}`;
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.fillText(String(i + 1).padStart(2, "0"), x + 22, y + CELL_H - 20);
      const dur = film.duration;
      g.fillText(dur, x + CELL_W - 22 - g.measureText(dur).width, y + CELL_H - 20);
    });
    this.tex.needsUpdate = true;
  }

  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const u = this.mat.uniforms;

    this.drawAtlas();

    // run the reel: the throw decays into the drift; hovering holds it still
    if (!this.press.down) {
      const rest = this.hovered !== null || this.reduced || this.paused ? 0 : DRIFT;
      this.vel += (rest - this.vel) * damp(this.hovered !== null ? 4 : 1.3, dt);
      this.off += this.vel * dt;
    }
    u.uOff0.value = this.off * ROW_SPEED[0];
    u.uOff1.value = this.off * ROW_SPEED[1];
    u.uOff2.value = this.off * ROW_SPEED[2];

    // hover: the screen under the pointer lifts, the rest dim
    const hit = this.paused ? null : this.pick();
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.host.style.cursor = hit !== null ? "pointer" : "";
      this.events.onHover?.(hit === null ? null : this.filmOf(hit));
    }
    const k = damp(9, dt);
    let changed = false;
    for (let i = 0; i < this.lift.length; i++) {
      const to = i === this.hovered ? 1 : 0;
      const v = this.lift[i] + (to - this.lift[i]) * k;
      if (Math.abs(v - this.lift[i]) > 1e-4) {
        this.lift[i] = v;
        changed = true;
      }
    }
    if (changed) (this.geo.getAttribute("aLift") as THREE.InstancedBufferAttribute).needsUpdate = true;
    this.any += ((this.hovered !== null ? 1 : 0) - this.any) * damp(6, dt);
    u.uAny.value = this.any;

    if (!this.reduced) this.intro = Math.min(1, this.intro + dt / 2.2);
    else this.intro = 1;
    u.uIntro.value = this.intro;

    this.renderer.render(this.scene, this.camera);
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
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
