import type { Clip } from "@/components/Hero-config";

// ===========================================================================
// WORK — the films and the categories they're filed under. Content only:
// every variation of the work page reads from here.
// ===========================================================================

export const CATEGORIES = [
  { id: "brand", label: "Brand Films", short: "Brand" },
  { id: "documentary", label: "Documentaries", short: "Docs" },
  { id: "music", label: "Music Videos", short: "Music" },
  { id: "tvc", label: "TVC's", short: "TVC" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export type Project = Clip & {
  no: string;
  client: string;
  category: CategoryId;
  /** when it was made; blank until it's confirmed */
  year?: number;
  /** the frame it was made for (16x9, 9x16 or Beyond); the work page filters on it when opened from
   * that format's room (/work?format=16x9). Projects without one show under every format. */
  format?: "16x9" | "9x16" | "beyond";
  /** one line under the title */
  line: string;
  /** the full film (a direct video URL: an .mp4 from Vimeo, Mux, Cloudflare Stream or similar),
   * played in the film page's cover. Without it the cover plays the stand-in clip (src). */
  film?: string;
  /** the behind-the-scenes film (a direct video URL), played in the film page's curved screen.
   * Without it the screen plays the stand-in clip (src). */
  bts?: string;
  /** a few sentences for the film's own page */
  synopsis: string;
  /** the case, told on the film's page under the screen: who the client is, what was asked, the idea.
   * Without it the page tells the synopsis instead. */
  story?: { client: string; challenge: string; idea: string };
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
    // BMW iX × INSHI. The film itself isn't in yet: this plays another clip as a stand-in until the
    // real one is hosted (see the video setup); the year is to confirm.
    ...P(7, "INSHI", "BMW", "tvc", 2021, "0:52", "BMW iX, as a ballet", "#c8a95c",
      "The all-new BMW iX, told through the choreography of the INSHI ballet: the car and the human body, side by side."),
    no: "16",
    format: "16x9",
    story: {
      client:
        "German automotive and aviation conglomerate and its eponymous brand that drives the world of premium and luxury-class automobiles and motorcycles, turning their driving experience into true pleasure.",
      challenge:
        "The BMW iX model represents a new evolutionary stage. Sustainable consumption and a mindful approach towards nature define a new era of technological advancement. We needed to present the all-new flagship model, the BMW iX, at an unmatched level, transforming it into an emotional show.",
      idea:
        "BMW iX has become much closer to nature. We decided to draw visual analogies between the car and the perfect creation of nature – the human body. The choreography of the “INSHI” ballet expressed all the key advantages of the new BMW iX in motion. We created a multi-layered video with a unique atmosphere, visual metaphors, and the technical advantages of the model, allowing us to evoke the desired sensations of harmony with nature and futuristic comfort in the viewers.",
    },
  },
  {
    ...P(11, "Talisman", "Rolls-Royce Kyiv", "tvc", 2025, "1:00", "Rolls-Royce Kyiv × Oberig Jewelry", "#c9a4ff",
      "Two talismans, one evening in Kyiv: the Spirit of Ecstasy on the bonnet, and an Oberig piece at the throat. A film about the things we carry close, made for Rolls-Royce Kyiv with Oberig Jewelry."),
    credits: TALISMAN_CREDITS,
  },
  P(4, "Night run", "Norrland", "tvc", 2026, "0:36", "A city after dark, one runner", "#e1142b",
    "One runner, one city, one night. We followed the light from the waterfront to the empty highway and let the streets set the pace."),
  P(9, "First light", "Tessera", "tvc", 2025, "0:45", "The Meridian, launch film", "#f2c14e",
    "A launch film for the Meridian, built around the first minutes of the morning: the face before the watch, the watch before the day."),
  P(13, "Care", "Oko Health", "tvc", 2024, "1:12", "The people behind the ward", "#3cc8ff",
    "Inside the ward, with the people who run it. Shot over four nights, without a script, so the work could speak for itself."),
  P(6, "City of tomorrow", "Kaji", "brand", 2026, "1:05", "Dubai, from the edge of the frame", "#ff7ab8",
    "Dubai at dusk, seen from its edges. A brand film about looking out, shot from rooftops, overpasses and the last of the light."),
  P(2, "The long road", "Maison Vert", "brand", 2025, "0:58", "Brand film, shot across the Empty Quarter", "#ffb27a",
    "Three days across the Empty Quarter with a crew of six. A brand film about distance, and the patience it takes to cover it."),
  P(10, "Coastline", "Aster", "brand", 2024, "1:20", "From the shore, a brand story", "#4fe3c1",
    "A brand story told from the shore: the tide, the people who work it and the colour the water takes at six in the evening."),
  P(5, "Threads", "Aster", "brand", 2026, "0:48", "SS26, in white", "#ff5a3c",
    "The SS26 collection, in white. Hands, fabric and movement, cut to the rhythm of the loom it was made on."),
  P(12, "Court culture", "Maison Vert", "brand", 2025, "0:30", "Winter, on the court", "#7be06a",
    "A winter collection taken out of the studio and onto a painted court, where the city plays after dark."),
  P(1, "Arcade", "Oko Audio", "music", 2026, "0:25", "Neon, sound and a launch", "#ff9f1c",
    "Neon, noise and a launch. A social-first film for a new speaker, cut to be watched loud and shared fast."),
  P(8, "Weekend league", "Kaji", "music", 2025, "0:42", "Friday night, in the air", "#9fd8ff",
    "Friday night, in the air. A series for social shot in one evening with a crew small enough to keep up."),
  P(14, "Beat", "Oko Audio", "music", 2024, "0:20", "A drop, on the street", "#e1142b",
    "A drop, on the street. Twenty seconds built for the scroll: one idea, one move, one cut."),
  P(3, "Heritage", "Tessera", "documentary", 2026, "1:12", "What the desert remembers", "#f2c14e",
    "What the desert remembers. A documentary portrait of the people who still read the dunes the old way."),
  P(7, "Majlis", "Kaji", "documentary", 2025, "0:52", "Stories told sitting down", "#ffb27a",
    "Stories told sitting down. We set up in a majlis for a week and let the conversation come to the camera."),
  P(15, "Sand & time", "Norrland", "documentary", 2024, "1:05", "Dunes, wind and patience", "#c9a4ff",
    "Dunes, wind and patience. A slow documentary about a landscape that rebuilds itself every night."),
];

// ---------------------------------------------------------------------------
// 16x9 — the studio's real films, as filed in the Drive (WEBSITE ASSETS 16X9 →
// 16X9 → a folder per category). Titles and clients come from the file names;
// years and runtimes are left blank until confirmed. Until each film is hosted
// (see the video setup) it plays a stand-in clip.
// ---------------------------------------------------------------------------
const KIND: Record<CategoryId, string> = { brand: "Brand film", documentary: "Documentary", music: "Music video", tvc: "TVC" };
let realNo = 17;
const R = (title: string, client: string, category: CategoryId): Project => {
  const no = String(realNo++);
  const line = client ? `${KIND[category]} for ${client}` : KIND[category];
  return {
    no,
    title,
    client,
    category,
    format: "16x9",
    duration: "",
    line,
    accent: "#cfc8bd",
    synopsis: `${line}.`,
    src: `/clips/clip-${String(((realNo - 18) % 15) + 1).padStart(2, "0")}.mp4`,
  };
};

PROJECTS.push(
  // Brand Films
  R("Inspiring Peaks", "Aldar", "brand"),
  R("The Promise", "Aldar", "brand"),
  R("NYC FC", "Etihad Airways", "brand"),
  R("Ramadan Fridge", "Etihad Airways", "brand"),
  R("Class Of", "Masdar Institute", "brand"),
  R("Prime Minister's Office", "Prime Minister's Office", "brand"),
  R("1001: One Tank Challenge", "Toyota Prius", "brand"),
  R("Hybrid Adventurer", "Toyota Prius", "brand"),
  R("Hybrid Falcon", "Toyota Prius", "brand"),
  R("Hybrid Graffiti", "Toyota Prius", "brand"),
  R("Riyadh Marathon 2025", "Riyadh Marathon", "brand"),
  // Documentaries
  R("Digital Divide", "GMIS", "documentary"),
  R("General Corporation", "GMIS", "documentary"),
  R("Rural Transformation", "GMIS", "documentary"),
  R("Sustainable Cities", "GMIS", "documentary"),
  R("Sustainable Energy", "GMIS", "documentary"),
  R("UAE Pioneers", "", "documentary"),
  // Music Videos
  R("I Love Kuwait", "", "music"),
  R("RELM", "", "music"),
  // TVC's
  R("Cleveland Clinic", "Cleveland Clinic", "tvc"),
  R("A True Story of Recovery", "Cleveland Clinic", "tvc"),
  R("EHS", "EHS", "tvc"),
  R("National", "Etisalat", "tvc"),
  R("DMI Promo", "Expo", "tvc"),
  R("Fast Government", "UAE Government", "tvc"),
  R("Toyota", "Filmmaster MEA", "tvc"),
  R("Shahid", "MBC", "tvc"),
  R("Museum of the Future", "Museum of the Future", "tvc"),
  R("National Day — 50", "", "tvc"),
  R("Saadiyat", "Rotana", "tvc"),
);

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
  { heading: "Filmed in", rows: [{ names: [p.year ? `Dubai, ${p.year}` : "Dubai"] }] },
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

// ---------------------------------------------------------------------------
// 9x16 — the Instagram accounts the studio runs. The 9x16 work page shows
// these in place of the films. Followers and posts as of October 2026;
// update them here as they grow.
// ---------------------------------------------------------------------------
export type Account = {
  name: string;
  handle: string;
  followers: string;
  posts: number;
  /** the brand's logo (its Instagram picture; cut from a screenshot for now, swap in the real file) */
  logo: string;
};

export const ACCOUNTS: Account[] = [
  { name: "DED Cafe", handle: "ded_cafe", followers: "23K", posts: 670, logo: "/work/accounts/ded_cafe.webp" },
  { name: "Amer Lounge", handle: "amerlounge", followers: "10K", posts: 148, logo: "/work/accounts/amerlounge.webp" },
  { name: "Business Lounge", handle: "businesslounge.ae", followers: "8,508", posts: 309, logo: "/work/accounts/businesslounge.webp" },
  { name: "Business Avenue", handle: "businessavenue.ae", followers: "7,309", posts: 99, logo: "/work/accounts/businessavenue.webp" },
];

export const instagramOf = (a: Account) => `https://www.instagram.com/${a.handle}/`;
