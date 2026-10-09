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
  /** a few sentences for the film's own page */
  synopsis: string;
  /** the end credits, in groups (a group's rows: a role and its names; no role = names alone) */
  credits?: CreditGroup[];
};

export type CreditGroup = { heading: string; rows: { role?: string; names: string[] }[] };

// ---------------------------------------------------------------------------
// TALISMAN — Rolls-Royce Kyiv × Oberig Jewelry. "Oberig" is Ukrainian for a
// talisman; so is the Spirit of Ecstasy on the bonnet. The credits are the
// production's own, as supplied. (Year and runtime are placeholders, and the
// footage stands in until the film's own is in /public/clips.)
// ---------------------------------------------------------------------------
const TALISMAN_CREDITS: CreditGroup[] = [
  { heading: "Rolls-Royce Kyiv", rows: [{ names: ["Olena Tareieva", "Valentyna Tkalenko"] }] },
  {
    heading: "16×9",
    rows: [
      { role: "Art director", names: ["Arkadiy Pasichnyk"] },
      { role: "Director", names: ["Mykyta Kazmiruk"] },
      { role: "Screenplay", names: ["Mykyta Kazmyruk"] },
      { role: "Producers", names: ["Dmytro Kovalenko", "Illia Shelpuk", "Anna Bondarenko"] },
      { role: "DOP", names: ["Volodymyr Kalishchuk"] },
      { role: "Sound", names: ["Andriy Kozubovsky"] },
      { role: "Gaffer", names: ["Roman Panchenko"] },
      { role: "Production designer", names: ["Dasha Novikova"] },
      { role: "Directors", names: ["Borys Mysharin", "Tymofiy Chepurniy"] },
      { role: "Stylist", names: ["Natasha Shkurkina"] },
      { role: "Makeup artist", names: ["Oleksandra Zelenska"] },
      { role: "Actress", names: ["Masha Tsukanova"] },
      { role: "Location manager", names: ["Heorgiy Yehorov"] },
      { role: "Editing", names: ["Saveliy Zhukov"] },
      { role: "Motion graphics", names: ["Vlad Khvyshchuk"] },
      { role: "Color", names: ["Anri Adler"] },
      { role: "Design", names: ["Roman Honcharenko"] },
      { role: "Backstage", names: ["Illia Chumak"] },
      { role: "Equipment", names: ["Zodiac Film"] },
    ],
  },
  { heading: "Oberig Jewelry", rows: [{ names: ["Product line"] }] },
];

const P = (
  n: number,
  title: string,
  client: string,
  category: CategoryId,
  year: number,
  duration: string,
  line: string,
  accent: string,
  synopsis: string
): Project => {
  const no = String(n).padStart(2, "0");
  return { no, title, client, category, year, duration, line, accent, synopsis, src: `/clips/clip-${no}.mp4` };
};

export const PROJECTS: Project[] = [
  {
    ...P(11, "Talisman", "Rolls-Royce Kyiv", "commercial", 2025, "1:00", "Rolls-Royce Kyiv × Oberig Jewelry", "#c9a4ff",
      "Two talismans, one evening in Kyiv: the Spirit of Ecstasy on the bonnet, and an Oberig piece at the throat. A film about the things we carry close, made for Rolls-Royce Kyiv with Oberig Jewelry."),
    credits: TALISMAN_CREDITS,
  },
  P(4, "Night run", "Norrland", "commercial", 2026, "0:36", "A city after dark, one runner", "#e1142b",
    "One runner, one city, one night. We followed the light from the waterfront to the empty highway and let the streets set the pace."),
  P(9, "First light", "Tessera", "commercial", 2025, "0:45", "The Meridian, launch film", "#f2c14e",
    "A launch film for the Meridian, built around the first minutes of the morning: the face before the watch, the watch before the day."),
  P(13, "Care", "Oko Health", "commercial", 2024, "1:12", "The people behind the ward", "#3cc8ff",
    "Inside the ward, with the people who run it. Shot over four nights, without a script, so the work could speak for itself."),
  P(6, "City of tomorrow", "Kaji", "brand", 2026, "1:05", "Dubai, from the edge of the frame", "#ff7ab8",
    "Dubai at dusk, seen from its edges. A brand film about looking out, shot from rooftops, overpasses and the last of the light."),
  P(2, "The long road", "Maison Vert", "brand", 2025, "0:58", "Brand film, shot across the Empty Quarter", "#ffb27a",
    "Three days across the Empty Quarter with a crew of six. A brand film about distance, and the patience it takes to cover it."),
  P(10, "Coastline", "Aster", "brand", 2024, "1:20", "From the shore, a brand story", "#4fe3c1",
    "A brand story told from the shore: the tide, the people who work it and the colour the water takes at six in the evening."),
  P(5, "Threads", "Aster", "fashion", 2026, "0:48", "SS26, in white", "#ff5a3c",
    "The SS26 collection, in white. Hands, fabric and movement, cut to the rhythm of the loom it was made on."),
  P(12, "Court culture", "Maison Vert", "fashion", 2025, "0:30", "Winter, on the court", "#7be06a",
    "A winter collection taken out of the studio and onto a painted court, where the city plays after dark."),
  P(1, "Arcade", "Oko Audio", "social", 2026, "0:25", "Neon, sound and a launch", "#ff9f1c",
    "Neon, noise and a launch. A social-first film for a new speaker, cut to be watched loud and shared fast."),
  P(8, "Weekend league", "Kaji", "social", 2025, "0:42", "Friday night, in the air", "#9fd8ff",
    "Friday night, in the air. A series for social shot in one evening with a crew small enough to keep up."),
  P(14, "Beat", "Oko Audio", "social", 2024, "0:20", "A drop, on the street", "#e1142b",
    "A drop, on the street. Twenty seconds built for the scroll: one idea, one move, one cut."),
  P(3, "Heritage", "Tessera", "documentary", 2026, "1:12", "What the desert remembers", "#f2c14e",
    "What the desert remembers. A documentary portrait of the people who still read the dunes the old way."),
  P(7, "Majlis", "Kaji", "documentary", 2025, "0:52", "Stories told sitting down", "#ffb27a",
    "Stories told sitting down. We set up in a majlis for a week and let the conversation come to the camera."),
  P(15, "Sand & time", "Norrland", "documentary", 2024, "1:05", "Dunes, wind and patience", "#c9a4ff",
    "Dunes, wind and patience. A slow documentary about a landscape that rebuilds itself every night."),
];

// ---------------------------------------------------------------------------
// Every film has its own end credits. Talisman's are the production's own;
// the others are built from each film's details (its client, its year) with
// the roles credited to the studio — replace each with the film's real
// credits, in the same shape as TALISMAN_CREDITS, as they come in.
// ---------------------------------------------------------------------------
const studioCredits = (p: Project): CreditGroup[] => [
  { heading: p.client, rows: [{ role: "Client", names: [p.client] }] },
  {
    heading: "16×9",
    rows: [
      { role: "Direction", names: ["16×9 Studio"] },
      { role: "Production", names: ["16×9 Studio"] },
      { role: "Camera & light", names: ["16×9 Studio"] },
      { role: "Editing & colour", names: ["16×9 Post"] },
      { role: "Sound", names: ["16×9 Post"] },
    ],
  },
  { heading: "Filmed in", rows: [{ names: [`Dubai, ${p.year}`] }] },
];
for (const p of PROJECTS) p.credits ??= studioCredits(p);

export const categoryOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;
export const countIn = (id: CategoryId) => PROJECTS.filter((p) => p.category === id).length;

/** 1280×720 still for every film: /clips/clip-01.mp4 -> /clips/stills/clip-01.webp */
export const stillFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");

// placeholder posters until each film has its own: four, dealt round the films
const POSTERS = [1, 2, 3, 4].map((n) => `/work/posters/poster-${n}.webp`);
/** A film's poster (cards, the cover, the screen, the folders). */
export const posterFor = (p: Project) => POSTERS[PROJECTS.indexOf(p) % POSTERS.length] ?? stillFor(p.src);
