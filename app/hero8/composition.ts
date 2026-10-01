// ===========================================================================
// HERO 8 — composition. Everything is placed on a fixed stage (16:9 on wide
// screens, 9:16 on phones) that is scaled to cover the viewport, so the
// stripes, the film window and the headline always line up exactly as drawn.
// Units below are stage units (the stage is W × H).
// ===========================================================================

export type Pt = [number, number];

export type Stripe = {
  pts: Pt[];
  /** where it slides in from (offset in stage units) */
  from: Pt;
  /** which way it is pushed out on scroll: -1 left, 1 right */
  side: -1 | 1;
  /** the arrow that nudges forward now and then */
  nudge?: boolean;
  /** the chevrons that lean in toward the film on hover */
  hug?: boolean;
};

export type Rect = { x: number; y: number; w: number; h: number };
export type Word = { text: string; x: number; baseline: number; size: number; align: "left" | "right" };

export type Layout = {
  W: number;
  H: number;
  film: Rect;
  stripes: Stripe[];
  grids: Rect[];
  top: Word;
  bottom: Word;
};

/** Wide screens: a "‹" bracket and a "›" arrow wrap the film, slashes top right and bottom left. */
export const WIDE: Layout = {
  W: 1600,
  H: 900,
  film: { x: 520, y: 265, w: 660, h: 371 },
  stripes: [
    { pts: [[440, 190], [560, 190], [300, 450], [560, 710], [440, 710], [180, 450]], from: [-520, 0], side: -1, hug: true },
    { pts: [[1140, 190], [1260, 190], [1520, 450], [1260, 710], [1140, 710], [1400, 450]], from: [520, 0], side: 1, nudge: true, hug: true },
    { pts: [[1250, -40], [1360, -40], [1232, 150], [1122, 150]], from: [140, -210], side: 1 },
    { pts: [[1420, -40], [1530, -40], [1402, 150], [1292, 150]], from: [140, -210], side: 1 },
    { pts: [[220, 790], [330, 790], [462, 950], [352, 950]], from: [-150, 190], side: -1 },
    { pts: [[392, 790], [502, 790], [634, 950], [524, 950]], from: [-150, 190], side: -1 },
  ],
  grids: [
    { x: 30, y: 25, w: 420, h: 112 },
    { x: 1180, y: 770, w: 220, h: 100 },
  ],
  top: { text: "16x9", x: 600, baseline: 246, size: 150, align: "left" },
  bottom: { text: "& beyond", x: 1132, baseline: 790, size: 128, align: "right" },
};

/** Phones: a narrower window, the chevrons tall and tight against its sides. */
export const TALL: Layout = {
  W: 900,
  H: 1600,
  film: { x: 170, y: 672, w: 560, h: 315 },
  stripes: [
    { pts: [[115, 600], [180, 600], [115, 829.5], [180, 1059], [115, 1059], [50, 829.5]], from: [-320, 0], side: -1, hug: true },
    { pts: [[785, 600], [720, 600], [785, 829.5], [720, 1059], [785, 1059], [850, 829.5]], from: [320, 0], side: 1, nudge: true, hug: true },
    { pts: [[560, 140], [670, 140], [540, 390], [430, 390]], from: [140, -280], side: 1 },
    { pts: [[740, 140], [850, 140], [720, 390], [610, 390]], from: [140, -280], side: 1 },
    { pts: [[60, 1290], [170, 1290], [290, 1470], [180, 1470]], from: [-140, 240], side: -1 },
    { pts: [[250, 1290], [360, 1290], [480, 1470], [370, 1470]], from: [-140, 240], side: -1 },
  ],
  grids: [
    { x: 60, y: 160, w: 330, h: 100 },
    { x: 560, y: 1300, w: 280, h: 110 },
  ],
  top: { text: "16x9", x: 60, baseline: 565, size: 200, align: "left" },
  bottom: { text: "& beyond", x: 840, baseline: 1215, size: 140, align: "right" },
};

/** Scale the stage to cover the viewport, but never crop more than ~12% of it. */
export function fitStage(vw: number, vh: number) {
  const layout = vw / vh < 0.85 ? TALL : WIDE;
  const cover = Math.max(vw / layout.W, vh / layout.H);
  const contain = Math.min(vw / layout.W, vh / layout.H);
  const scale = Math.min(cover, contain * 1.12);
  const w = layout.W * scale;
  const h = layout.H * scale;
  return { layout, scale, w, h, left: (vw - w) / 2, top: (vh - h) / 2 };
}

export const points = (pts: Pt[]) => pts.map((p) => p.join(",")).join(" ");
