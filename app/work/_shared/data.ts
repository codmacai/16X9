import type { Clip } from "@/components/Hero-config";

// ===========================================================================
// WORK — the films and the categories they're filed under. Content only:
// every variation of the work page reads from here.
// ===========================================================================

export const CATEGORIES = [
  { id: "commercial", label: "Commercials", short: "Ads" },
  { id: "brand", label: "Brand films", short: "Brand" },
  { id: "fashion", label: "Fashion", short: "Fashion" },
  { id: "social", label: "Social", short: "Social" },
  { id: "documentary", label: "Documentary", short: "Docs" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export type Project = Clip & {
  no: string;
  client: string;
  year: number;
  category: CategoryId;
  /** one line under the title */
  line: string;
};

const P = (
  n: number,
  title: string,
  client: string,
  category: CategoryId,
  year: number,
  duration: string,
  line: string,
  accent: string
): Project => {
  const no = String(n).padStart(2, "0");
  return { no, title, client, category, year, duration, line, accent, src: `/clips/clip-${no}.mp4` };
};

export const PROJECTS: Project[] = [
  P(4, "Night run", "Norrland", "commercial", 2026, "0:36", "A city after dark, one runner", "#e1142b"),
  P(9, "First light", "Tessera", "commercial", 2025, "0:45", "The Meridian, launch film", "#f2c14e"),
  P(11, "Skin", "Lumen & Co", "commercial", 2025, "0:20", "A scent, in close-up", "#c9a4ff"),
  P(13, "Care", "Oko Health", "commercial", 2024, "1:12", "The people behind the ward", "#3cc8ff"),
  P(6, "City of tomorrow", "Kaji", "brand", 2026, "1:05", "Dubai, from the edge of the frame", "#ff7ab8"),
  P(2, "The long road", "Maison Vert", "brand", 2025, "0:58", "Brand film, shot across the Empty Quarter", "#ffb27a"),
  P(10, "Coastline", "Aster", "brand", 2024, "1:20", "From the shore, a brand story", "#4fe3c1"),
  P(5, "Threads", "Aster", "fashion", 2026, "0:48", "SS26, in white", "#ff5a3c"),
  P(12, "Court culture", "Maison Vert", "fashion", 2025, "0:30", "Winter, on the court", "#7be06a"),
  P(1, "Arcade", "Oko Audio", "social", 2026, "0:25", "Neon, sound and a launch", "#ff9f1c"),
  P(8, "Weekend league", "Kaji", "social", 2025, "0:42", "Friday night, in the air", "#9fd8ff"),
  P(14, "Beat", "Oko Audio", "social", 2024, "0:20", "A drop, on the street", "#e1142b"),
  P(3, "Heritage", "Tessera", "documentary", 2026, "1:12", "What the desert remembers", "#f2c14e"),
  P(7, "Majlis", "Kaji", "documentary", 2025, "0:52", "Stories told sitting down", "#ffb27a"),
  P(15, "Sand & time", "Norrland", "documentary", 2024, "1:05", "Dunes, wind and patience", "#c9a4ff"),
];

export const categoryOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;
export const countIn = (id: CategoryId) => PROJECTS.filter((p) => p.category === id).length;

/** 1280×720 still for every film: /clips/clip-01.mp4 -> /clips/stills/clip-01.webp */
export const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");
