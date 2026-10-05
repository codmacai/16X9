// ===========================================================================
// MIRAGE — the renderer. One full-screen triangle and one fragment shader.
//
// Above the horizon: the film, seen through rising heat (a slow noise field
// that bends the picture, strongest just over the horizon).
// Below the horizon: the road, and on it the film's mirage, the sky turned
// upside down, rippling harder and fading into the asphalt.
// The headline is drawn into its own texture so it shimmers with the heat
// and throws the same reflection. Around the gaze (the cursor) the heat
// clears. `expo` is the glare: 1 is white-out, 0 is the plain scene.
// Two film textures so one film can melt into the next (`mix`).
// ===========================================================================

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); // y runs down, like the page
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uV0;
uniform sampler2D uV1;
uniform sampler2D uText;
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform float uTime;
uniform float uMix;
uniform float uHorizon;
uniform float uExpo;
uniform float uHaze;
uniform float uWave;
uniform float uTextIn;
uniform float uClear;
uniform vec2 uGaze;
uniform float uA0;
uniform float uA1;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// the heat field: two octaves read from a small tiling noise texture (cheap on any GPU)
vec2 heat(vec2 p) {
  vec2 a = texture2D(uNoise, p / 256.0).rg;
  vec2 b = texture2D(uNoise, p / 128.0 + vec2(0.37, 0.71)).rg;
  return a * 0.66 + b * 0.34 - 0.5;
}
// object-fit: cover, for a film of aspect vidA in a box of aspect boxA
vec2 cover(vec2 uv, float boxA, float vidA) {
  vec2 s = boxA > vidA ? vec2(1.0, vidA / boxA) : vec2(boxA / vidA, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 film(vec2 uv, float boxA) {
  uv = clamp(uv, 0.001, 0.999);
  vec3 a = texture2D(uV0, cover(uv, boxA, uA0)).rgb;
  vec3 b = texture2D(uV1, cover(uv, boxA, uA1)).rgb;
  return mix(a, b, uMix);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  float h = uHorizon;
  float boxA = aspect / h;

  // the heat: two noise fields drifting upward
  vec2 q = vec2(uv.x * aspect * 6.0, uv.y * 8.0 + uTime * 1.5);
  vec2 d = heat(q);

  // where you look, the air clears
  float r = length((uv - uGaze) * vec2(aspect, 1.0));
  float clear = (1.0 - smoothstep(0.04, 0.3, r)) * uClear;
  float s = uHaze * (1.0 + 2.6 * uWave) * (1.0 - 0.9 * clear);

  vec3 col;
  if (uv.y < h) {
    float near = uv.y / h;
    vec2 off = d * s * mix(0.0012, 0.009, near * near);
    col = film(vec2(uv.x + off.x, (uv.y + off.y) / h), boxA);
    float ta = texture2D(uText, uv + off * 1.6).a * uTextIn;
    col = mix(col, vec3(1.0), ta);
    col *= mix(0.68, 1.0, smoothstep(0.0, 0.18, uv.y)); // a little shade under the bar
  } else {
    float k = (uv.y - h) / (1.0 - h); // 0 at the horizon, 1 at the foot
    vec2 off = d * s * (0.008 + 0.02 * k) * vec2(1.0, 2.4);
    float my = h - (uv.y - h) * 1.12 + off.y; // the mirror
    float mx = uv.x + off.x;
    vec3 refl = film(vec2(mx, my / h), boxA);
    refl = (refl + film(vec2(mx + 0.004, (my - 0.006) / h), boxA)) * 0.5; // softened
    float ta = texture2D(uText, vec2(mx, my)).a * uTextIn;
    refl = mix(refl, vec3(1.0), ta * 0.75);
    vec3 road = vec3(0.07, 0.064, 0.058);
    float fade = pow(1.0 - k, 1.7);
    col = mix(road, refl * vec3(1.03, 0.98, 0.92), 0.6 * fade);
    col += (1.0 - smoothstep(0.0, 0.035, k)) * 0.06; // the hot shine along the horizon
  }

  // the glare: warm white-out
  col = mix(col, vec3(1.0, 0.985, 0.955), clamp(uExpo, 0.0, 1.0));

  float vig = smoothstep(1.25, 0.25, length((uv - 0.5) * vec2(aspect * 0.55, 1.0)));
  col *= mix(0.8, 1.0, vig);
  col += (hash(uv * uRes + fract(uTime) * 91.0) - 0.5) * 0.03; // grain
  gl_FragColor = vec4(col, 1.0);
}`;

export type MirageFrame = {
  time: number;
  mix: number;
  horizon: number;
  expo: number;
  haze: number;
  wave: number;
  textIn: number;
  clear: number;
  gx: number;
  gy: number;
  a0: number;
  a1: number;
};

const UNIFORMS = [
  "uV0", "uV1", "uText", "uNoise", "uRes", "uTime", "uMix", "uHorizon", "uExpo", "uHaze", "uWave",
  "uTextIn", "uClear", "uGaze", "uA0", "uA1",
] as const;

export class MirageGL {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  private films: [WebGLTexture, WebGLTexture];
  private text: WebGLTexture;
  private noise: WebGLTexture;
  private buf: WebGLBuffer;

  static create(canvas: HTMLCanvasElement): MirageGL | null {
    try {
      const gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      });
      return gl && !gl.isContextLost() ? new MirageGL(gl) : null;
    } catch (e) {
      console.warn("Mirage: WebGL unavailable, showing the films plain.", e);
      return null;
    }
  }

  private constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    this.prog = prog;
    gl.useProgram(prog);

    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    UNIFORMS.forEach((u) => (this.loc[u] = gl.getUniformLocation(prog, u)));
    const tex = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // a black pixel until the first frame arrives
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      return t;
    };
    this.films = [tex(), tex()];
    this.text = tex();
    // 256 x 256 of smooth-ish random values, tiling (power of two, so it can repeat)
    this.noise = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.noise);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const px = new Uint8Array(256 * 256 * 4);
    for (let i = 0; i < px.length; i++) px[i] = (Math.random() * 256) | 0;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.uniform1i(this.loc.uV0, 0);
    gl.uniform1i(this.loc.uV1, 1);
    gl.uniform1i(this.loc.uText, 2);
    gl.uniform1i(this.loc.uNoise, 4);
  }

  /** Put a video frame (or a poster) into film slot i. */
  upload(i: 0 | 1, source: TexImageSource) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.films[i]);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    } catch {
      /* a frame that isn't ready yet; the next one will be */
    }
  }

  uploadText(canvas: HTMLCanvasElement) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.text);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  resize(w: number, h: number) {
    const c = this.gl.canvas as HTMLCanvasElement;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  /** Draw a frame. `cur` is the slot showing now; the other is the one arriving. */
  draw(f: MirageFrame, cur: 0 | 1) {
    const gl = this.gl;
    const L = this.loc;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.films[cur]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.films[cur === 0 ? 1 : 0]);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.text);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.noise);
    gl.uniform2f(L.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(L.uTime, f.time);
    gl.uniform1f(L.uMix, f.mix);
    gl.uniform1f(L.uHorizon, f.horizon);
    gl.uniform1f(L.uExpo, f.expo);
    gl.uniform1f(L.uHaze, f.haze);
    gl.uniform1f(L.uWave, f.wave);
    gl.uniform1f(L.uTextIn, f.textIn);
    gl.uniform1f(L.uClear, f.clear);
    gl.uniform2f(L.uGaze, f.gx, f.gy);
    gl.uniform1f(L.uA0, f.a0);
    gl.uniform1f(L.uA1, f.a1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.films[0]);
    gl.deleteTexture(this.films[1]);
    gl.deleteTexture(this.text);
    gl.deleteTexture(this.noise);
    gl.deleteBuffer(this.buf);
    gl.deleteProgram(this.prog);
    // the context itself is left alive: the canvas may be mounted again
  }
}
