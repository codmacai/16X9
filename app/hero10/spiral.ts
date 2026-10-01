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
  drift: 0.06, // radians per second the ribbon turns on its own
};

const STEP = SPIRAL.arc + SPIRAL.gap;
export const LENGTH = STEP * SPIRAL.count;

const vertex = /* glsl */ `
  uniform float uStart;
  uniform float uArc;
  uniform float uRadius;
  uniform float uHeight;
  uniform float uPitch;
  varying vec2 vUv;
  varying float vFacing;
  varying float vY;
  void main() {
    vUv = uv;
    float a = uStart + uv.x * uArc;
    // each panel sits level at the helix height of its centre, so the ribbon steps
    // down panel by panel like a staircase (as in the reference)
    float mid = uStart + uArc * 0.5;
    vec3 p = vec3(sin(a) * uRadius, (uv.y - 0.5) * uHeight - mid * uPitch, cos(a) * uRadius);
    vec3 n = vec3(sin(a), 0.0, cos(a));
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec3 toCamera = normalize(cameraPosition - world.xyz);
    vFacing = dot(normalize(mat3(modelMatrix) * n), toCamera);
    vY = world.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uFade;
  uniform float uEdge;
  varying vec2 vUv;
  varying float vFacing;
  varying float vY;
  void main() {
    // seen from inside (round the back) the image is mirrored, as in the reference
    vec3 c = texture2D(uMap, vUv).rgb;
    float f = vFacing;
    float light = f > 0.0 ? mix(0.7, 1.0, smoothstep(0.0, 0.9, f)) : mix(0.5, 0.72, smoothstep(0.0, 0.9, -f));
    // the ends of the ribbon dissolve into the black, top and bottom
    float ends = 1.0 - smoothstep(uEdge - 0.55, uEdge, abs(vY));
    gl_FragColor = vec4(c * light * ends * uFade, 1.0);
    #include <colorspace_fragment>
  }
`;

export type Panel = { mesh: THREE.Mesh; material: THREE.ShaderMaterial; clip: number };

export function makePanel(clip: number, map: THREE.Texture, edge: number): Panel {
  const geometry = new THREE.PlaneGeometry(1, 1, 48, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    side: THREE.DoubleSide,
    uniforms: {
      uStart: { value: 0 },
      uArc: { value: SPIRAL.arc },
      uRadius: { value: SPIRAL.radius },
      uHeight: { value: SPIRAL.height },
      uPitch: { value: SPIRAL.pitch },
      uMap: { value: map },
      uFade: { value: 0 },
      uEdge: { value: edge },
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
