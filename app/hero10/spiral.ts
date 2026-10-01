import * as THREE from "three";

// ===========================================================================
// HERO 10 — the spiral. A ribbon of 16:9 panels wound around an invisible
// vertical cylinder as a helix. Each panel is bent to the cylinder in the
// vertex shader and sits level at the helix height of its centre, so the
// ribbon steps down to the right across the front and up to the right round
// the back, as in the reference.
//
// Proportions, measured from the reference at 2000 × 1301 (all in cylinder radii):
//   cylinder spans x 440 → 1690 (radius ≈ 625px, axis 65px right of centre)
//   front panel ≈ 565 × 340px; panels round the back ≈ 0.62 of that → camera 4.3 radii out
//   one turn of the helix ≈ 780px; neighbouring panels ≈ 0.78 rad apart
// From those: fov 27°, panel height 0.42, arc 0.68 rad, gap 0.1 rad, pitch 0.199 per rad.
// ===========================================================================

export const SPIRAL = {
  radius: 1,
  arc: 0.68, // radians one panel covers
  gap: 0.1, // radians between panels
  height: 0.42, // panel height
  pitch: 0.199, // how far the ribbon drops per radian (one turn ≈ 1.25)
  count: 26, // panels on the ribbon (~3.2 turns, more than fill the frame)
  camera: { distance: 4.3, fov: 27, y: 0, x: -0.04 },
  tilt: { x: 0.05, z: -0.1 }, // the whole spiral leans right, like an italic S, and its top tips away
  drift: 0.24, // radians per second the ribbon turns on its own (a full turn in ~26 s)
};

const STEP = SPIRAL.arc + SPIRAL.gap;
export const LENGTH = STEP * SPIRAL.count;

// Each panel's quad is drawn a little larger than the film, so the glow around
// a lifted tile has room; the film itself fills uv 0–1 inside that margin.
const GLOW = 0.09; // how far the glow reaches past the edge, in radii
const MARGIN = new THREE.Vector2(GLOW / (SPIRAL.arc * SPIRAL.radius), GLOW / SPIRAL.height);
const ASPECT = (SPIRAL.arc * SPIRAL.radius) / SPIRAL.height;

const vertex = /* glsl */ `
  uniform float uStart;
  uniform float uArc;
  uniform float uRadius;
  uniform float uHeight;
  uniform float uPitch;
  uniform vec2 uMargin;
  uniform float uLift; // 0 → 1 as the tile is pointed at: it rises out of the spiral toward you
  varying vec2 vUv;
  varying float vFacing;
  varying float vSide;
  varying float vY;
  void main() {
    vec2 e = uv * (1.0 + 2.0 * uMargin) - uMargin;
    vUv = e;
    // lifted: a touch larger, further out from the axis, and a little higher
    vec2 c = (e - 0.5) * (1.0 + 0.07 * uLift) + 0.5;
    float a = uStart + c.x * uArc;
    // each panel sits level at the helix height of its centre, so the ribbon steps
    // down panel by panel like a staircase (as in the reference)
    float mid = uStart + uArc * 0.5;
    float r = uRadius + 0.15 * uLift;
    vec3 p = vec3(sin(a) * r, (c.y - 0.5) * uHeight - mid * uPitch + 0.025 * uLift, cos(a) * r);
    vec3 n = vec3(sin(a), 0.0, cos(a));
    vec3 t = vec3(cos(a), 0.0, -sin(a));
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec3 toCamera = normalize(cameraPosition - world.xyz);
    vFacing = dot(normalize(mat3(modelMatrix) * n), toCamera);
    vSide = dot(normalize(mat3(modelMatrix) * t), toCamera); // how far the tile is turned away
    vY = world.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uFade;
  uniform float uEdge;
  uniform float uFocus; // 1 = the panel you're pointing at, 0 = the rest while one is
  uniform float uDim;   // how far the rest dim while a panel has focus
  uniform float uLift;
  uniform float uTime;
  uniform float uSeed;
  uniform float uAspect;
  varying vec2 vUv;
  varying float vFacing;
  varying float vSide;
  varying float vY;

  // signed distance to the tile's rounded rectangle (negative inside), in panel heights
  float tileDist(vec2 uv) {
    vec2 q = (uv - 0.5) * vec2(uAspect, 1.0);
    vec2 h = vec2(uAspect, 1.0) * 0.5;
    float r = 0.06;
    vec2 d = abs(q) - h + r;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
  }

  vec3 grade(vec3 c) {
    // a touch more contrast and colour, cool shadows, warm highlights
    c = clamp((c - 0.5) * 1.1 + 0.5, 0.0, 1.0);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, 1.22);
    return c * mix(vec3(0.9, 0.98, 1.08), vec3(1.07, 1.0, 0.9), smoothstep(0.05, 0.7, l));
  }

  void main() {
    float d = tileDist(vUv);
    float aa = fwidth(d) * 1.2;
    float inside = 1.0 - smoothstep(-aa, aa, d);
    float f = vFacing;
    float front = step(0.0, f);
    vec3 paper = vec3(0.97, 0.95, 0.93);

    // ---- the film, seen through a window: a little zoomed, shifting as the tile turns
    float zoom = mix(1.13, 1.03, uLift);
    vec2 tuv = (vUv - 0.5) / zoom + 0.5 + vec2(vSide * 0.045, 0.0);
    vec2 dir = vUv - 0.5;
    vec2 ca = dir * (0.006 + 0.008 * dot(dir, dir)); // a faint lens fringe toward the edges
    vec3 c = vec3(texture2D(uMap, tuv + ca).r, texture2D(uMap, tuv).g, texture2D(uMap, tuv - ca).b);
    c = grade(c);
    // a soft vignette inside each frame
    c *= mix(0.68, 1.0, smoothstep(0.78, 0.12, length(dir * vec2(1.0, 1.25))));

    // ---- light on the tile
    float light = f > 0.0 ? mix(0.7, 1.0, smoothstep(0.0, 0.9, f)) : mix(0.48, 0.7, smoothstep(0.0, 0.9, -f));
    light *= mix(1.0 - uDim, 1.12, uFocus);
    vec3 col = c * light;

    // a sheen that sweeps across now and then, like light passing over glass
    float phase = fract(uTime * 0.065 + uSeed) * 2.8 - 0.9;
    float band = vUv.x * 0.8 + vUv.y * 0.55 - phase;
    float sheen = exp(-band * band * 140.0) * (0.09 + 0.22 * uFocus);
    // and a highlight when the tile squarely faces you
    float spec = pow(max(f, 0.0), 36.0) * 0.07;
    col += paper * (sheen + spec) * front;

    // ---- the rim: a hairline of light just inside the edge, brighter when lifted
    float rimW = 0.006 + 0.006 * uFocus;
    float rim = (1.0 - smoothstep(0.0, rimW, -d)) * inside;
    col = mix(col, paper, rim * (0.28 + 0.6 * uFocus) * mix(0.12, 1.0, front));

    // ---- the glow around a lifted tile
    float glow = d > 0.0 ? exp(-d * 30.0) * 0.55 * uFocus * front : 0.0;

    // the ends of the ribbon dissolve into the black, top and bottom
    float ends = 1.0 - smoothstep(uEdge - 0.55, uEdge, abs(vY));
    float k = ends * uFade;
    vec3 rgb = mix(paper * 0.92, max(col, 0.0), inside);
    float alpha = max(inside, glow) * k;
    gl_FragColor = vec4(rgb * mix(1.0, k, inside), alpha);
    #include <colorspace_fragment>
  }
`;

export type Panel = { mesh: THREE.Mesh; material: THREE.ShaderMaterial; clip: number };

export function makePanel(clip: number, map: THREE.Texture, edge: number, seed = 0): Panel {
  const geometry = new THREE.PlaneGeometry(1, 1, 48, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    side: THREE.DoubleSide,
    transparent: true, // for the glow; tiles are drawn back to front (see renderOrder in page.tsx)
    depthWrite: false,
    uniforms: {
      uStart: { value: 0 },
      uArc: { value: SPIRAL.arc },
      uRadius: { value: SPIRAL.radius },
      uHeight: { value: SPIRAL.height },
      uPitch: { value: SPIRAL.pitch },
      uMargin: { value: MARGIN },
      uAspect: { value: ASPECT },
      uMap: { value: map },
      uFade: { value: 0 },
      uEdge: { value: edge },
      uFocus: { value: 0 },
      uDim: { value: 0 },
      uLift: { value: 0 },
      uTime: { value: 0 },
      uSeed: { value: seed },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // positions come from the shader
  return { mesh, material, clip };
}

/** Where panel i starts on the ribbon, for a given travel along it, wrapped so the ribbon never ends. */
export function panelStart(i: number, travel: number) {
  const raw = i * STEP - LENGTH / 2 + travel;
  return ((((raw + LENGTH / 2) % LENGTH) + LENGTH) % LENGTH) - LENGTH / 2;
}

export const centreAngle = (start: number) => start + SPIRAL.arc / 2;

/** A point on a panel (u along the arc, v up the panel, 0–1), in the spiral's own space. */
export function panelPoint(start: number, u: number, v: number, out: THREE.Vector3) {
  const a = start + u * SPIRAL.arc;
  const mid = start + SPIRAL.arc / 2;
  return out.set(Math.sin(a) * SPIRAL.radius, (v - 0.5) * SPIRAL.height - mid * SPIRAL.pitch, Math.cos(a) * SPIRAL.radius);
}
