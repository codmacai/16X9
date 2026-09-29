"use client";

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

// ===========================================================================
// CONTENT — replace with your own
// ===========================================================================
// The wall plays short clips from /public/clips (clip-01.mp4 ... clip-15.mp4).
// The two full films load only when someone opens a card in the lightbox.
// Odd clips (01, 03, ...) were cut from FILMS[0], even clips from FILMS[1].
// Keep this order in sync with the ffmpeg script you used.
const FILMS = [
  encodeURI("/cleveland_clinic_1.mp4_v1 (1080p) (1).mp4"), // film 1
  encodeURI("/nike_pitch_nov_25.mp4_v1 (1080p).mp4"), // film 2
];
const COUNT = 15; // number of cards / clips in total
const CLIP_LEN = 4; // seconds each clip lasts (used to find the moment in the full film)
const LOAD_TIMEOUT = 6000; // ms: never keep the visitor waiting longer than this

type Item = {
  id: number;
  title: string;
  client: string;
  logo: string; // client name / logo text shown on the frame
  category: string;
  src: string; // the short clip shown on the wall
  film: string; // the full film shown in the lightbox
  poster?: string;
  start?: number; // optional: force the moment (seconds) the lightbox opens at
  slot: number; // this clip's position within its own film
  slots: number; // how many clips share that film
};

// The company logo shown on the black opening card, before the video wipes
// over it. Drop your file in /public and change the path here.
const COMPANY_LOGO_SRC = encodeURI("/Screenshot 2026-09-29 at 10.25.42 PM.png");

const CLIP_FILES = Array.from({ length: COUNT }, (_, i) => `/clips/clip-${String(i + 1).padStart(2, "0")}.mp4`);

const ITEMS: Item[] = Array.from({ length: COUNT }, (_, i) => {
  const v = i % FILMS.length; // which film this card was cut from
  return {
    id: i + 1,
    title: `Project ${String(i + 1).padStart(2, "0")}`,
    client: "Client name",
    logo: "LOGO",
    category: ["commercial", "brand film", "music video"][i % 3],
    src: CLIP_FILES[i],
    film: FILMS[v],
    slot: Math.floor(i / FILMS.length),
    slots: Math.ceil((COUNT - v) / FILMS.length),
    // start: 12, // uncomment to pick an exact moment for this card
  };
});
const N = ITEMS.length;

const LOGO_SRC = encodeURI("/Screenshot 2026-09-29 at 10.25.42 PM.png"); // your logo in /public
const BRAND = "16x9";
const NAV = [
  { label: "Work", href: "/work" },
  { label: "Services", href: "/services" },
  { label: "Studio", href: "/studio" },
  { label: "Contact", href: "/contact" },
];
const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/16x9videoagency/" },
  { label: "Vimeo", href: "https://vimeo.com/16x9agency" },
  { label: "Facebook", href: "https://www.facebook.com/16x9videocontentagency" },
  { label: "YouTube", href: "https://www.youtube.com/user/16on9" },
];
const LEFT_LINE = "Bringing brands to life";
const RIGHT_LINES = ["Turn target audience", "into your viewers"];

// ===========================================================================
// WALL — equal cards, edge to edge. Each row is shifted sideways by its own
// amount so the columns never line up. A 5 x 3 block repeats endlessly in
// every direction. [col, row, width, height] in cells.
// ===========================================================================
const BLOCK_COLS = 5;
const BLOCK_ROWS = 3;
const ROW_SHIFT = [0.62, 0.18, 0.44]; // per-row sideways shift, in cards
const PATTERN: [number, number, number, number][] = [];
for (let r = 0; r < BLOCK_ROWS; r++)
  for (let c = 0; c < BLOCK_COLS; c++) PATTERN.push([c + ROW_SHIFT[r], r, 1, 1]);

// How many cards fit across / down the screen, by screen size
const getView = (vw: number, vh: number) => {
  if (vw < 640) return { cols: 2, rows: 4 }; // phones
  if (vw < 1024) return vh > vw ? { cols: 3, rows: 4 } : { cols: 3, rows: 3 }; // tablets
  if (vw >= 2200) return { cols: 4, rows: 3 }; // very large screens
  return { cols: 3, rows: 3 }; // desktop
};

const CURVE = 0.55; // outward bend of the whole wall (0 = flat)
const PERSP = 1400;
// Hover bulge: the wall swells toward you around the hovered card like a
// dome, so the card rises and every card around it tilts to follow.
const LIFT = 170; // px the peak rises toward the viewer (scaled down on small screens)
const SPREAD = 1.15; // width of the dome, in cards
const PUSH = 0.05; // slight sideways swell so the rise reads as volume

// Opening: the centre card surfaces out of the dark and its footage wipes up.
// Every other card then reveals right where it sits, nearest the centre first.
// Hover and drag unlock once it settles. The opening clock starts only once the
// centre card's video has data, so the footage is ready the moment it wipes up.
const INTRO = {
  center: 0.35,
  centerDur: 1.8,
  cardVideo: 1.7, // footage wipe starts (the logo card is held until then)
  wipeDur: 1.3,
  zoomDur: 2.4,
  // every other card reveals right where it sits, nearest the centre first
  fadeStart: 2.7,
  fadeSpread: 0.9,
  fadeDur: 1.4,
};
const SETTLE_S = INTRO.fadeStart + INTRO.fadeSpread + INTRO.fadeDur + 0.2;
const CHROME = 3.5; // copy, nav and marks arrive after the reel unfolds
const FPS = 25;
const GATE_MAX = 2500; // ms: start the opening anyway if the centre video is slow

// ===========================================================================
// TYPE & COLOUR — Archivo (wide cut for display), white on black
// ===========================================================================
const FONT = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
const WIDE = { fontFamily: FONT, fontVariationSettings: "'wdth' 125" } as const;
const HEAD = { ...WIDE, fontWeight: 900, letterSpacing: "-0.02em" } as const;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const CSS_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap');
@keyframes gh-grain {
  0%,100% { transform: translate(0,0) } 20% { transform: translate(-4%,3%) }
  40% { transform: translate(3%,-5%) } 60% { transform: translate(-2%,-3%) } 80% { transform: translate(5%,2%) }
}
.gh-grain { animation: gh-grain 0.9s steps(5) infinite; }
@keyframes gh-rec { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
.gh-rec { animation: gh-rec 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .gh-grain, .gh-rec { animation: none; } }
`;

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
const easeInOut = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2);

// ---------------------------------------------------------------------------
// Projective transform: maps a w x h element onto any four screen points.
// Neighbouring frames share their corner points, so the whole mosaic can
// bend and bulge without ever opening a gap.
// ---------------------------------------------------------------------------
type M3 = number[];
const adj = (m: M3): M3 => [
  m[4] * m[8] - m[5] * m[7],
  m[2] * m[7] - m[1] * m[8],
  m[1] * m[5] - m[2] * m[4],
  m[5] * m[6] - m[3] * m[8],
  m[0] * m[8] - m[2] * m[6],
  m[2] * m[3] - m[0] * m[5],
  m[3] * m[7] - m[4] * m[6],
  m[1] * m[6] - m[0] * m[7],
  m[0] * m[4] - m[1] * m[3],
];
const mulMM = (a: M3, b: M3): M3 => {
  const c: number[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) c[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
  return c;
};
const mulMV = (m: M3, v: number[]) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const basis = (p: number[]): M3 => {
  const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1];
  const v = mulMV(adj(m), [p[6], p[7], 1]);
  return mulMM(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
};
// dst: top-left, top-right, bottom-left, bottom-right
const toMatrix = (srcAdj: M3, dst: number[]) => {
  const t = mulMM(basis(dst), srcAdj);
  const k = t[8] || 1;
  const f = (n: number) => (n / k).toFixed(6);
  return `matrix3d(${f(t[0])},${f(t[3])},0,${f(t[6])},${f(t[1])},${f(t[4])},0,${f(t[7])},0,0,1,0,${f(t[2])},${f(t[5])},0,1)`;
};

type PoolTile = { p: number; t: number; bx: number; by: number; w: number; h: number; cx: number; cy: number };
type CenterTile = { p: number; x: number; y: number };

// ===========================================================================
// LOADER — the default export. Downloads every clip, the logo and the font
// behind a black screen with a 000 to 100 counter. The reel mounts only
// afterwards, so every card can play straight from memory.
// ===========================================================================
export default function OneScreenReel() {
  const [pct, setPct] = useState(0);
  const [blobs, setBlobs] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const map: Record<string, string> = {};
    const total = CLIP_FILES.length + 2; // clips + logo + font
    let done = 0;
    const tick = () => {
      done++;
      if (!cancelled) setPct(Math.min(100, Math.round((done / total) * 100)));
    };

    const clips = CLIP_FILES.map((src) =>
      fetch(src)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("bad response"))))
        .then((b) => {
          const u = URL.createObjectURL(b);
          urls.push(u);
          map[src] = u;
        })
        .catch(() => {})
        .finally(tick)
    );

    const logo = new Promise<void>((res) => {
      const img = new Image();
      img.onload = img.onerror = () => res();
      img.src = COMPANY_LOGO_SRC;
    }).finally(tick);

    const font = (document.fonts
      ? Promise.all([document.fonts.load("900 1em Archivo"), document.fonts.load("800 1em Archivo"), document.fonts.load("300 1em Archivo"), document.fonts.load("500 1em Archivo")])
      : Promise.resolve()
    )
      .catch(() => {})
      .finally(tick);

    const timeout = new Promise((res) => setTimeout(res, LOAD_TIMEOUT));
    Promise.race([Promise.all([...clips, logo, font]), timeout]).then(() => {
      if (cancelled) return;
      setPct(100);
      setBlobs({ ...map });
    });

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  if (!blobs)
    return (
      <main
        aria-label="Loading"
        className="relative grid h-dvh w-full place-items-center overflow-hidden bg-black text-white antialiased"
        style={{ fontFamily: FONT }}
      >
        <style>{CSS}</style>
        <div className="flex flex-col items-center gap-5">
          <span className="text-[length:clamp(2.5rem,8vw,5rem)] leading-none tabular-nums" style={HEAD}>
            {String(pct).padStart(3, "0")}
          </span>
          <span className="relative block h-px w-40 overflow-hidden bg-white/15">
            <span
              className="absolute inset-y-0 left-0 block w-full origin-left bg-white transition-transform duration-200"
              style={{ transform: `scaleX(${pct / 100})` }}
            />
          </span>
        </div>
      </main>
    );

  return <Reel blobs={blobs} />;
}

// ===========================================================================
// PAGE
// ===========================================================================
function Reel({ blobs }: { blobs: Record<string, string> }) {
  const reduce = !!useReducedMotion();
  const [grid, setGrid] = useState({ CW: 480, CH: 300, vw: 1440, vh: 900, px: 2, py: 2 });
  const [hovered, setHovered] = useState<number | null>(null);
  const [film, setFilm] = useState<Item | null>(null);
  const [dragging, setDragging] = useState(false);
  const [explored, setExplored] = useState(false);
  const [settled, setSettled] = useState(false);

  const rootRef = useRef<HTMLElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const shadeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const titleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const clientRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const logoRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const introRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const introImgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const current = useRef<number[]>([]);
  const blobsRef = useRef(blobs);
  const hoverRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  useEffect(() => {
    hoverRef.current = hovered;
  }, [hovered]);

  // Reduced motion has no opening, so interaction is available straight away.
  // Otherwise the render loop unlocks hover, drag and scroll when the opening ends.
  useEffect(() => {
    if (reduce) {
      settledRef.current = true;
      setSettled(true);
    }
  }, [reduce]);

  const m = useRef({ ox: 0, oy: 0, vx: 0, vy: 0, down: false, moved: 0, captured: false, lastX: 0, lastY: 0, lastT: 0, lampX: 720, lampY: 450 });

  const gx = useMotionValue(-1000);
  const gy = useMotionValue(-1000);
  const glowX = useSpring(gx, { stiffness: 120, damping: 24 });
  const glowY = useSpring(gy, { stiffness: 120, damping: 24 });

  // Cell size: the view fits getView().cols x rows cells. Debounced so mobile
  // address-bar height changes don't rebuild the wall.
  useEffect(() => {
    let timer = 0;
    let lastW = 0;
    let lastH = 0;
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      lastW = vw;
      lastH = vh;
      const v = getView(vw, vh);
      // enough repeats of the block to cover the screen while wrapping
      const px = Math.ceil((v.cols + 3) / BLOCK_COLS);
      const py = Math.ceil((v.rows + 3) / BLOCK_ROWS);
      setGrid({ CW: vw / v.cols, CH: vh / v.rows, vw, vh, px, py });
      m.current.lampX = vw / 2;
      m.current.lampY = vh / 2;
      gx.jump(vw / 2);
      gy.jump(vh / 2);
    };
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
        measure();
      }, 150);
    };
    measure();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [gx, gy]);

  const pool: PoolTile[] = [];
  for (let by = 0; by < grid.py; by++)
    for (let bx = 0; bx < grid.px; bx++)
      PATTERN.forEach(([c, r, w, h], t) => {
        pool.push({
          p: pool.length,
          t,
          bx,
          by,
          w: w * grid.CW,
          h: h * grid.CH,
          cx: (bx * BLOCK_COLS + c + w / 2) * grid.CW - (grid.px * BLOCK_COLS * grid.CW) / 2,
          cy: (by * BLOCK_ROWS + r + h / 2) * grid.CH - (grid.py * BLOCK_ROWS * grid.CH) / 2,
        });
      });
  const poolRef = useRef(pool);
  poolRef.current = pool;

  // -------------------------------------------------------------------------
  // Render loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    const { CW, CH, vw, vh, px, py } = grid;
    const tiles = poolRef.current;
    const count = tiles.length;
    current.current = Array.from({ length: count }, () => -1);
    const playing = Array.from({ length: count }, () => false);
    const shown = Array.from({ length: count }, () => true);
    const shadeCache = Array.from({ length: count }, () => "");
    const srcAdj = tiles.map((t) => adj(basis([0, 0, t.w, 0, 0, t.h, t.w, t.h])));
    const spanX = px * BLOCK_COLS * CW;
    const spanY = py * BLOCK_ROWS * CH;
    const R = vw / CURVE;
    const reach = Math.max(vw, vh) * 0.55;
    const liftPx = LIFT * Math.min(1, vw / 1440);
    const s = m.current;
    // If the opening already played (e.g. window resize), skip straight to the end
    let start = performance.now() - (settledRef.current ? 60000 : 0);
    // The opening clock stays at zero until the centre card's video has data
    let started = settledRef.current || reduce;
    const gateStart = performance.now();
    let last = performance.now();
    let raf = 0;
    let visible = true;
    let wipeCleared = false;
    let introShown = false;
    let center: CenterTile | null = null;
    let filmShift = 0; // makes the opening card show the first film
    // Bulge state: follows the hovered frame
    let b = 0;
    let hx = 0;
    let hy = 0;
    let sgx = CW;
    let sgy = CH;

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        playing.fill(false);
        videoRefs.current.forEach((v) => v?.pause());
      }
    });
    if (rootRef.current) io.observe(rootRef.current);

    const wrapped = (t: PoolTile) => {
      const ux = t.cx + s.ox;
      const uy = t.cy + s.oy;
      const x = mod(ux + spanX / 2, spanX) - spanX / 2;
      const y = mod(uy + spanY / 2, spanY) - spanY / 2;
      const nx = Math.round((x - ux) / spanX);
      const ny = Math.round((y - uy) / spanY);
      return { x, y, bx: t.bx + px * nx, by: t.by + py * ny };
    };

    // How high the dome is at a flat point (0..1)
    const dome = (x: number, y: number) => {
      if (b < 0.001) return 0;
      const dx = x - hx;
      const dy = y - hy;
      return b * Math.exp(-((dx * dx) / (sgx * sgx) + (dy * dy) / (sgy * sgy)));
    };

    // flat point -> dome -> outward curve -> screen
    const project = (x: number, y: number) => {
      const lift = dome(x, y);
      if (lift > 0) {
        const f = 1 + PUSH * lift;
        x = hx + (x - hx) * f;
        y = hy + (y - hy) * f;
      }
      const fx = x / R;
      const fy = y / R;
      const X = R * Math.sin(fx);
      const Y = R * Math.sin(fy);
      const Z = R * (1 - Math.cos(fx) * Math.cos(fy)) + liftPx * lift;
      const k = PERSP / (PERSP - Z);
      return [vw / 2 + X * k, vh / 2 + Y * k];
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      const t = started ? (now - start) / 1000 : 0;
      const k = (rate: number) => 1 - Math.exp(-dt * (reduce ? 40 : rate));

      // Hover, drag and scroll unlock once the opening has finished
      if (!settledRef.current && started && t >= SETTLE_S) {
        settledRef.current = true;
        setSettled(true);
      }
      const live = settledRef.current;

      if (!s.down) {
        s.ox += s.vx * dt;
        s.oy += s.vy * dt;
        const f = Math.exp(-dt * (reduce ? 20 : 3));
        s.vx *= f;
        s.vy *= f;
      }

      // First frame: nudge the wall so the card nearest the middle sits
      // exactly in the middle of the screen. That card opens the reel.
      if (!center) {
        let best = Infinity;
        let bestTile: PoolTile | null = null;
        for (const tile of tiles) {
          const w = wrapped(tile);
          const d = Math.hypot(w.x, w.y * 1.3);
          if (d < best) {
            best = d;
            bestTile = tile;
          }
        }
        if (bestTile) {
          const w = wrapped(bestTile);
          s.ox -= w.x;
          s.oy -= w.y;
          center = { p: bestTile.p, x: 0, y: 0 };
          const w2 = wrapped(bestTile);
          filmShift = mod(-(bestTile.t + w2.bx * 5 + w2.by * 11), N);
        }
      }
      const cen = center;

      // Bulge follows the hovered frame, swelling in and settling out
      const hp = live ? hoverRef.current : null;
      if (hp !== null && !reduce) {
        const ht = tiles[hp];
        const w = wrapped(ht);
        hx = b < 0.02 ? w.x : lerp(hx, w.x, k(14));
        hy = b < 0.02 ? w.y : lerp(hy, w.y, k(14));
        sgx = lerp(sgx, ht.w * SPREAD, k(10));
        sgy = lerp(sgy, ht.h * SPREAD, k(10));
      }
      b += ((hp !== null && !reduce ? 1 : 0) - b) * k(6);

      for (const tile of tiles) {
        const p = tile.p;
        const el = tileRefs.current[p];
        const v = videoRefs.current[p];
        if (!el || !v) continue;
        const w = wrapped(tile);

        // Which film this frame shows
        const idx = mod(tile.t + w.bx * 5 + w.by * 11 + filmShift, N);
        if (current.current[p] !== idx) {
          current.current[p] = idx;
          const it = ITEMS[idx];
          v.poster = it.poster ?? "";
          // Centre card and everything near the screen buffer fully; the rest only fetch metadata
          const near = cen?.p === p || (Math.abs(w.x) < vw * 0.7 && Math.abs(w.y) < vh * 0.7);
          v.preload = near ? "auto" : "metadata";
          v.src = blobsRef.current[it.src] ?? it.src;
          playing[p] = false;
          const set = (r: (HTMLSpanElement | null)[], text: string) => {
            const node = r[p];
            if (node) node.textContent = text;
          };
          set(titleRefs.current, it.title);
          set(clientRefs.current, it.client);
          set(logoRefs.current, it.logo);
        }

        // Opening (in the flat wall)
        let scale = 1;
        let opacity = 1;
        let dark = 0;
        const isCenter = cen?.p === p;
        if (!reduce && cen) {
          if (isCenter) {
            const e = easeOut(clamp01((t - INTRO.center) / INTRO.centerDur));
            scale = 0.86 + 0.14 * e;
            opacity = e;
          } else {
            // Every other card reveals in its own place, nearest the centre first
            const near = Math.min(1, Math.hypot(w.x / vw, w.y / vh) * 1.6);
            const t0 = INTRO.fadeStart + near * INTRO.fadeSpread;
            const e = clamp01((t - t0) / INTRO.fadeDur);
            scale = 0.9 + 0.1 * easeOut(e);
            opacity = smoothstep(e * 2.5);
            dark = 0.95 * (1 - easeOut(e));
          }
        }
        const cx = w.x;
        const cy = w.y;

        // Cull what is well off screen
        const onScreen = Math.abs(cx) - tile.w / 2 < vw * 0.62 && Math.abs(cy) - tile.h / 2 < vh * 0.62 && opacity > 0;
        if (onScreen !== shown[p]) {
          shown[p] = onScreen;
          el.style.visibility = onScreen ? "visible" : "hidden";
        }
        if (!onScreen) {
          if (playing[p]) {
            playing[p] = false;
            v.pause();
          }
          continue;
        }

        // Corners in the flat wall (scaled / spun for the opening), then
        // through the bulge and the curve onto the screen
        const hw = (tile.w / 2) * scale;
        const hh = (tile.h / 2) * scale;
        const corner = (ax: number, ay: number) => project(cx + ax, cy + ay);
        const a = corner(-hw, -hh);
        const b2 = corner(hw, -hh);
        const c = corner(-hw, hh);
        const d = corner(hw, hh);
        el.style.transform = toMatrix(srcAdj[p], [a[0], a[1], b2[0], b2[1], c[0], c[1], d[0], d[1]]);
        el.style.opacity = opacity.toFixed(3);
        el.style.zIndex = isCenter && !live ? "5" : hoverRef.current === p ? "3" : "1";

        // Centre card: footage wipes up while zooming out from 1.3x
        if (isCenter && !reduce) {
          if (t < INTRO.cardVideo + INTRO.zoomDur + 0.1) {
            if (!introShown) {
              introShown = true;
              const layer = introRefs.current[p];
              const img = introImgRefs.current[p];
              if (layer && img) {
                img.src = COMPANY_LOGO_SRC;
                layer.style.display = "grid";
              }
            }
            const wp = easeInOut(clamp01((t - INTRO.cardVideo) / INTRO.wipeDur));
            const zp = easeOut(clamp01((t - INTRO.cardVideo) / INTRO.zoomDur));
            // hide the card's own client logo while the company logo is on screen
            const cl = logoRefs.current[p];
            if (cl) cl.style.opacity = "0";
            v.style.clipPath = `inset(${((1 - wp) * 100).toFixed(2)}% 0% 0% 0%)`;
            v.style.transform = `scale(${(1.3 - 0.3 * zp).toFixed(4)})`;
          } else if (!wipeCleared) {
            wipeCleared = true;
            const layer = introRefs.current[p];
            const img = introImgRefs.current[p];
            const cl = logoRefs.current[p];
            if (cl) cl.style.opacity = "";
            if (layer) layer.style.display = "none";
            if (img) img.removeAttribute("src");
            v.style.clipPath = "";
            v.style.transform = "";
          }
        }

        // Light: darker the further from the pointer
        const mid = project(cx, cy);
        // cards on the slope of the dome catch less light
        const slope =
          b > 0.001
            ? Math.abs(dome(cx + tile.w / 2, cy) - dome(cx - tile.w / 2, cy)) +
              Math.abs(dome(cx, cy + tile.h / 2) - dome(cx, cy - tile.h / 2))
            : 0;
        const shade =
          hoverRef.current === p && live
            ? "0"
            : Math.max(
                dark,
                Math.min(0.92, 0.12 + 0.7 * smoothstep(Math.hypot(mid[0] - s.lampX, mid[1] - s.lampY) / reach) + 0.35 * slope)
              ).toFixed(2);
        if (shade !== shadeCache[p]) {
          shadeCache[p] = shade;
          const sh = shadeRefs.current[p];
          if (sh) sh.style.opacity = shade;
        }

        const play = !document.hidden;
        if (play !== playing[p]) {
          playing[p] = play;
          if (play) v.play().catch(() => {});
          else v.pause();
        }
      }

      // Hold the opening at zero until the centre card's video has data, so the
      // footage is already there when the logo card lifts. Never wait longer than GATE_MAX.
      if (!started && cen) {
        const cv = videoRefs.current[cen.p];
        if (!cv || cv.readyState >= 3 || now - gateStart > GATE_MAX) {
          started = true;
          start = now;
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [grid, reduce]);

  // -------------------------------------------------------------------------
  // Input: drag / swipe with momentum, trackpad, arrow keys (after the intro)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const s = m.current;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (film || !settledRef.current) return;
      s.ox -= e.deltaX;
      s.oy -= e.deltaY;
      s.vx = 0;
      s.vy = 0;
      setExplored(true);
    };
    const onMove = (e: PointerEvent) => {
      s.lampX = e.clientX;
      s.lampY = e.clientY;
      gx.set(e.clientX);
      gy.set(e.clientY);
    };
    const onKey = (e: KeyboardEvent) => {
      if (film || !settledRef.current) return;
      const push = 1100;
      if (e.key === "ArrowLeft") s.vx += push;
      else if (e.key === "ArrowRight") s.vx -= push;
      else if (e.key === "ArrowUp") s.vy += push;
      else if (e.key === "ArrowDown") s.vy -= push;
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [film, gx, gy]);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!settledRef.current) return;
    const s = m.current;
    s.down = true;
    s.moved = 0;
    s.captured = false;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = performance.now();
    s.vx = 0;
    s.vy = 0;
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const s = m.current;
    if (!s.down) return;
    const now = performance.now();
    const dx = e.clientX - s.lastX;
    const dy = e.clientY - s.lastY;
    s.ox += dx;
    s.oy += dy;
    s.moved += Math.abs(dx) + Math.abs(dy);
    const dt = Math.max(1, now - s.lastT) / 1000;
    s.vx = s.vx * 0.5 + (dx / dt) * 0.5;
    s.vy = s.vy * 0.5 + (dy / dt) * 0.5;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = now;
    if (!s.captured && s.moved > 6) {
      s.captured = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(true);
      setHovered(null);
      setExplored(true);
    }
  };
  const endDrag = () => {
    const s = m.current;
    if (!s.down) return;
    if (performance.now() - s.lastT > 80) {
      s.vx = 0;
      s.vy = 0;
    }
    s.down = false;
    setDragging(false);
  };

  const rise = (delay: number) =>
    reduce ? {} : { initial: { y: "105%" }, animate: { y: 0 }, transition: { duration: 1.2, ease: EASE_OUT, delay } };

  return (
    <main
      ref={rootRef}
      aria-label="Showreel"
      className="relative h-dvh w-full select-none overflow-hidden bg-black text-white antialiased"
      style={{ fontFamily: FONT }}
    >
      <style>{CSS}</style>
      <h1 className="sr-only">
        {BRAND}. {LEFT_LINE}. {RIGHT_LINES.join(" ")}.
      </h1>

      {/* ================= The mosaic ================= */}
      <div
        className="absolute inset-0"
        style={{ touchAction: "none", cursor: !settled ? "default" : dragging ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHovered(null)}
      >
        {pool.map((tile) => {
          const p = tile.p;
          const active = settled && hovered === p && !dragging;
          return (
            <div
              key={p}
              ref={(el) => {
                tileRefs.current[p] = el;
              }}
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: tile.w,
                height: tile.h,
                opacity: 0,
                willChange: "transform, opacity",
                pointerEvents: settled ? "auto" : "none",
              }}
            >
              <button
                type="button"
                data-cursor={settled ? "play" : undefined}
                aria-label="Play this film"
                tabIndex={settled ? 0 : -1}
                onPointerEnter={(e) =>
                  e.pointerType === "mouse" && settledRef.current && !m.current.down && setHovered(p)
                }
                onPointerLeave={() => setHovered((h) => (h === p ? null : h))}
                onClick={() => {
                  if (!settledRef.current || m.current.moved > 6) return;
                  const idx = current.current[p];
                  if (idx >= 0) setFilm(ITEMS[idx]);
                }}
                className="absolute inset-0 block overflow-hidden bg-[#0c0c0c] outline-none focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-4 focus-visible:outline-white [@media(pointer:fine)]:cursor-none"
              >
                {/* The picture */}
                <span className="absolute inset-0 overflow-hidden bg-[#0c0c0c]">
                  {/* Opening card only: black, with the company logo. The video wipes up over it. */}
                  <span
                    ref={(el) => {
                      introRefs.current[p] = el;
                    }}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 hidden place-items-center bg-black"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={(el) => {
                        introImgRefs.current[p] = el;
                      }}
                      alt=""
                      draggable={false}
                      className="h-auto max-h-[42%] w-auto max-w-[74%] object-contain"
                    />
                  </span>
                  <video
                    ref={(el) => {
                      videoRefs.current[p] = el;
                    }}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    style={{
                      filter: active ? "grayscale(0) contrast(1.02)" : "grayscale(0.6) contrast(1.1)",
                      transition: "filter 700ms ease",
                    }}
                  />

                  {/* Darkness, set each frame by distance from the pointer.
                      No CSS transition during the opening, so the light-up follows the animation exactly. */}
                  <span
                    ref={(el) => {
                      shadeRefs.current[p] = el;
                    }}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-black"
                    style={{
                      opacity: 0.95,
                      transition: settled ? "opacity 500ms ease" : "none",
                    }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/65 to-transparent transition-opacity duration-500"
                    style={{ opacity: active ? 1 : 0 }}
                  />

                  {/* Client logo: centred at rest, glides into the corner on hover */}
                  <span
                    ref={(el) => {
                      logoRefs.current[p] = el;
                    }}
                    aria-hidden
                    className="pointer-events-none absolute whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.3em]"
                    style={{
                      left: active ? "calc(100% - 12px)" : "50%",
                      top: active ? "calc(100% - 12px)" : "50%",
                      transform: active ? "translate(-100%, -100%) scale(0.85)" : "translate(-50%, -50%)",
                      transformOrigin: active ? "100% 100%" : "50% 50%",
                      color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                      transition: reduce
                        ? "none"
                        : `left 700ms ${CSS_EASE}, top 700ms ${CSS_EASE}, transform 700ms ${CSS_EASE}, color 500ms ease`,
                    }}
                  />

                  {/* Title, only on hover */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-3 left-3 block text-left leading-tight transition-[opacity,transform] duration-500"
                    style={{ opacity: active ? 1 : 0, transform: `translateY(${active ? 0 : 6}px)` }}
                  >
                    <span
                      ref={(el) => {
                        titleRefs.current[p] = el;
                      }}
                      className="block text-[11px] uppercase sm:text-[13px]"
                      style={{ ...WIDE, fontWeight: 700 }}
                    />
                    <span
                      ref={(el) => {
                        clientRefs.current[p] = el;
                      }}
                      className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.2em] text-white/55 sm:text-[10px]"
                    />
                  </span>
                </span>

                {/* Hairline seam; a fine white rule on hover */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 transition-[box-shadow] duration-500"
                  style={{ boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.3)" : "inset 0 0 0 0.5px rgba(0,0,0,0.7)" }}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Light that follows the pointer */}
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-30 h-[560px] w-[560px] rounded-full mix-blend-screen"
          style={{
            x: glowX,
            y: glowY,
            marginLeft: -280,
            marginTop: -280,
            background: "radial-gradient(circle, rgba(255,255,255,0.1), rgba(255,255,255,0.03) 40%, transparent 70%)",
          }}
        />
      )}

      {/* Vignette and the dark corners behind the copy */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.72)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_0%_100%,rgba(0,0,0,0.8),transparent_40%),radial-gradient(ellipse_at_100%_100%,rgba(0,0,0,0.8),transparent_40%)]"
      />

      {/* ================= Copy ================= */}
      <div className="pointer-events-none absolute inset-x-6 bottom-7 z-40 flex items-end justify-between gap-6 sm:inset-x-12 sm:bottom-10">
        <p
          className="max-w-[55%] overflow-hidden pb-[0.1em] text-[clamp(1.6rem,4.4vw,4.5rem)] uppercase leading-[0.95]"
          style={{ ...WIDE, fontWeight: 800, letterSpacing: "0.01em" }}
        >
          <motion.span className="block" {...rise(CHROME)}>
            {LEFT_LINE}
          </motion.span>
        </p>
        <p
          className="text-right text-[clamp(0.8rem,1.15vw,1.1rem)] uppercase leading-[1.15]"
          style={{ ...WIDE, fontWeight: 300, letterSpacing: "0.02em" }}
        >
          {RIGHT_LINES.map((l, i) => (
            <span key={l} className="block overflow-hidden">
              <motion.span className="block" {...rise(CHROME + 0.06 * (i + 1))}>
                {l}
              </motion.span>
            </span>
          ))}
        </p>
      </div>

      {/* Hint, until the first drag */}
      <AnimatePresence>
        {!explored && (
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: CHROME + 0.6, duration: 1 } }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="pointer-events-none absolute bottom-9 left-1/2 z-40 hidden -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.3em] text-white/60 sm:block"
          >
            Drag to explore
          </motion.p>
        )}
      </AnimatePresence>

      {/* Socials, set vertically on the right edge */}
      <motion.nav
        aria-label="Social"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: EASE_OUT, delay: CHROME + 0.2 }}
        className="absolute right-6 top-1/2 z-40 hidden -translate-y-1/2 sm:right-12 sm:block"
      >
        <ul className="flex rotate-180 gap-7 [writing-mode:vertical-rl]">
          {SOCIALS.map((s) => (
            <li key={s.label}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/55 transition-colors hover:text-white"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </motion.nav>

      {/* Film grain */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[45] overflow-hidden opacity-[0.08]">
        <div className="gh-grain absolute -inset-[50%]" style={{ backgroundImage: GRAIN }} />
      </div>

      <Viewfinder reduce={reduce} />
      <Lightbox item={film} onClose={() => setFilm(null)} />
      <Cursor />
    </main>
  );
}

// ===========================================================================
// VIEWFINDER NAVBAR — crop marks, a focus box that snaps to links, and a
// recording readout; full-screen menu on phones
// ===========================================================================
function Viewfinder({ reduce }: { reduce: boolean }) {
  const [focus, setFocus] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Corner crop marks */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-3 z-50 sm:inset-5"
        initial={reduce ? false : { opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: EASE_OUT, delay: CHROME - 0.3 }}
      >
        {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map(
          (pos) => (
            <span key={pos} className={`absolute h-5 w-5 border-white/45 sm:h-7 sm:w-7 ${pos}`} />
          )
        )}
      </motion.div>

      <motion.header
        initial={reduce ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: EASE_OUT, delay: CHROME }}
        className="absolute inset-x-0 top-0 z-50 flex items-center justify-between px-6 pt-6 sm:px-12 sm:pt-9"
      >
        <a href="/" aria-label={`${BRAND}, home`} className="block opacity-90 transition-opacity hover:opacity-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt={BRAND} className="h-9 w-auto sm:h-11" />
        </a>

        <LayoutGroup id="gh-nav">
          <nav
            aria-label="Main"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
            onMouseLeave={() => setFocus(null)}
          >
            {NAV.map((n, i) => (
              <a
                key={n.label}
                href={n.href}
                onMouseEnter={() => setFocus(i)}
                onFocus={() => setFocus(i)}
                onBlur={() => setFocus(null)}
                className={`relative px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.3em] transition-colors duration-300 ${
                  focus === i ? "text-white" : "text-white/60"
                }`}
              >
                <Scramble text={n.label} active={focus === i && !reduce} />
                <AnimatePresence>
                  {focus === i && (
                    <motion.span
                      layoutId="gh-focus"
                      aria-hidden
                      className="absolute inset-0"
                      initial={{ opacity: 0, scale: 1.25 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.15 }}
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    >
                      <FocusCorners />
                    </motion.span>
                  )}
                </AnimatePresence>
              </a>
            ))}
          </nav>
        </LayoutGroup>

        <div className="flex items-center gap-6">
          <span className="hidden items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.25em] text-white/60 sm:flex">
            <span className="gh-rec block h-1.5 w-1.5 rounded-full bg-white" />
            <span>Rec</span>
            <Timecode />
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="gh-menu"
            className="relative px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3em] text-white md:hidden"
          >
            {open ? "Close" : "Menu"}
            <span aria-hidden className="absolute inset-0">
              <FocusCorners />
            </span>
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="gh-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ clipPath: "inset(50% 0% 50% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            exit={{ clipPath: "inset(50% 0% 50% 0%)" }}
            transition={{ duration: 0.7, ease: EASE_CINE }}
            className="fixed inset-0 z-[48] flex flex-col justify-between bg-black px-6 pb-10 pt-32 md:hidden"
          >
            <nav aria-label="Menu" className="flex flex-col gap-3">
              {NAV.map((n) => (
                <a
                  key={n.label}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="text-[clamp(2.25rem,11vw,3.5rem)] uppercase leading-none text-white"
                  style={HEAD}
                >
                  {n.label}
                </a>
              ))}
            </nav>
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium uppercase tracking-[0.25em] text-white/60"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FocusCorners() {
  const base = "absolute h-2 w-2 border-white";
  return (
    <>
      <span className={`${base} left-0 top-0 border-l border-t`} />
      <span className={`${base} right-0 top-0 border-r border-t`} />
      <span className={`${base} bottom-0 left-0 border-b border-l`} />
      <span className={`${base} bottom-0 right-0 border-b border-r`} />
    </>
  );
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function Scramble({ text, active }: { text: string; active: boolean }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!active) {
      setOut(text);
      return;
    }
    let frame = 0;
    const total = text.length * 2 + 4;
    const id = window.setInterval(() => {
      frame++;
      const resolved = Math.floor((frame / total) * text.length);
      setOut(
        text
          .split("")
          .map((ch, i) => (i < resolved || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join("")
      );
      if (frame >= total) {
        window.clearInterval(id);
        setOut(text);
      }
    }, 28);
    return () => window.clearInterval(id);
  }, [active, text]);
  return (
    <span className="relative inline-block">
      <span className="invisible">{text}</span>
      <span className="absolute inset-0" aria-hidden>
        {out}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

function Timecode() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const f = Math.floor(((now - start) / 1000) * FPS);
      const s = Math.floor(f / FPS);
      if (ref.current)
        ref.current.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % FPS)}`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span ref={ref} className="tabular-nums">
      00:00:00:00
    </span>
  );
}

// ===========================================================================
// LIGHTBOX — the full film, with sound and controls. Opens at the moment
// the clicked clip was cut from, and only loads the big file when opened.
// ===========================================================================
function Lightbox({ item, onClose }: { item: Item | null; onClose: () => void }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
          initial={{ clipPath: "inset(50% 0% 50% 0%)" }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(50% 0% 50% 0%)", transition: { duration: 0.5, ease: EASE_CINE } }}
          transition={{ duration: 0.8, ease: EASE_CINE }}
          className="fixed inset-0 z-[70] flex flex-col bg-black text-white"
          onClick={onClose}
        >
          <div className="flex items-start justify-between px-6 pt-6 sm:px-12 sm:pt-9">
            <div>
              <p className="text-[clamp(1.1rem,2vw,1.75rem)] uppercase leading-none" style={HEAD}>
                {item.title}
              </p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">
                {item.client}, {item.category}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="relative px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3em] text-white"
            >
              Close
              <span aria-hidden className="absolute inset-0">
                <FocusCorners />
              </span>
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4 sm:p-10">
            <video
              key={item.id}
              src={item.film}
              autoPlay
              controls
              playsInline
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                const span = Math.max(0, v.duration - CLIP_LEN);
                const at = Math.min(item.start ?? span * (item.slot / item.slots), span);
                if (at > 0) v.currentTime = at;
              }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full w-full max-w-[min(100%,160svh)] bg-black"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ===========================================================================
// CURSOR — a white disc that labels anything with data-cursor (fine pointers)
// ===========================================================================
function Cursor() {
  const [label, setLabel] = useState<string | null>(null);
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const x = useSpring(mx, { stiffness: 700, damping: 45, mass: 0.35 });
  const y = useSpring(my, { stiffness: 700, damping: 45, mass: 0.35 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      const el = (e.target as Element | null)?.closest?.("[data-cursor]");
      const next = el ? el.getAttribute("data-cursor") : null;
      setLabel((prev) => (prev === next ? prev : next));
    };
    const onLeave = () => setLabel(null);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [mx, my]);

  return (
    <motion.div
      aria-hidden
      style={{ x, y }}
      className="pointer-events-none fixed left-0 top-0 z-[80] hidden [@media(pointer:fine)]:block"
    >
      <motion.div
        animate={
          label
            ? { width: 68, height: 68, marginLeft: -34, marginTop: -34, opacity: 1 }
            : { width: 10, height: 10, marginLeft: -5, marginTop: -5, opacity: 0 }
        }
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="grid place-items-center overflow-hidden rounded-full bg-white text-black"
      >
        <AnimatePresence mode="wait">
          {label && (
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-[10px] font-semibold uppercase tracking-[0.15em]"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}