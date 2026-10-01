// ===========================================================================
// HERO 10 — the room. Everything is placed on a fixed stage (16:9 on wide
// screens, 9:16 on phones) scaled to cover the viewport, so the screens and
// the audience always line up as drawn. Units are stage units (W × H).
// ===========================================================================

export type ScreenBox = { x: number; y: number; w: number; h: number; rot: number };

export type Room = {
  W: number;
  H: number;
  /** wide: the three screens are fixed. tall: a carousel, centred on the active screen. */
  mode: "wide" | "tall";
  /** where a screen sits for each slot: -1 left, 0 centre, 1 right */
  slots: Record<-1 | 0 | 1, ScreenBox>;
  /** the audience: where the row of heads starts (y) and how big people are */
  audience: { y: number; scale: number; count: number };
  /** the floor line, where the screens' light lands */
  floor: number;
};

export const WIDE: Room = {
  W: 1600,
  H: 900,
  mode: "wide",
  slots: {
    [-1]: { x: 128, y: 232, w: 404, h: 227, rot: 16 },
    0: { x: 566, y: 200, w: 468, h: 263, rot: 0 },
    1: { x: 1068, y: 232, w: 404, h: 227, rot: -16 },
  },
  audience: { y: 600, scale: 0.86, count: 9 },
  floor: 470,
};

export const TALL: Room = {
  W: 900,
  H: 1600,
  mode: "tall",
  slots: {
    [-1]: { x: -640, y: 380, w: 700, h: 394, rot: 28 },
    0: { x: 100, y: 340, w: 700, h: 394, rot: 0 },
    1: { x: 840, y: 380, w: 700, h: 394, rot: -28 },
  },
  audience: { y: 900, scale: 1.25, count: 5 },
  floor: 740,
};

/** Scale the stage to cover the viewport, never cropping more than ~14%. */
export function fitRoom(vw: number, vh: number) {
  const room = vw / vh < 0.85 ? TALL : WIDE;
  const cover = Math.max(vw / room.W, vh / room.H);
  const contain = Math.min(vw / room.W, vh / room.H);
  const s = Math.min(cover, contain * 1.14);
  const w = room.W * s;
  const h = room.H * s;
  return { room, s, w, h, left: (vw - w) / 2, top: (vh - h) / 2 };
}

/** The three programmes, each a playlist of clip indexes from Hero-config. */
export const PROGRAMMES = [
  { label: "People", clips: [0, 3, 6, 9] },
  { label: "Places", clips: [1, 4, 7, 10] },
  { label: "Impact", clips: [2, 5, 8, 11] },
] as const;
