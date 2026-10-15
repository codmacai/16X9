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
];

// ---------------------------------------------------------------------------
// 16x9 — the studio's real films, as filed in the Drive (WEBSITE ASSETS 16X9 →
// 16X9 → a folder per category). Titles and clients come from the file names;
// years and runtimes are left blank until confirmed.
//
// The full films live in the Cloudflare R2 bucket "my-website-videos", a
// folder per category (brandfilms/, music/, TVC_s/); each film below names its
// file there, exactly as it's spelled in the bucket. They play from the
// bucket's public address, NEXT_PUBLIC_VIDEO_BASE (its r2.dev link or a custom
// domain, without the trailing slash). Until that's set, or for a film with no
// file yet, the film plays its stand-in clip.
// ---------------------------------------------------------------------------
const VIDEO_BASE = (process.env.NEXT_PUBLIC_VIDEO_BASE || "https://pub-9d250cf0ea9541beac9a7e373fe10d2f.r2.dev").replace(/\/+$/, "");
/** A file in the bucket -> its public URL (each part of the path escaped: the names have spaces, brackets, apostrophes). */
const hosted = (key?: string) =>
  key && VIDEO_BASE ? `${VIDEO_BASE}/${key.split("/").map(encodeURIComponent).join("/")}` : undefined;

const KIND: Record<CategoryId, string> = { brand: "Brand film", documentary: "Documentary", music: "Music video", tvc: "TVC" };
let realNo = 17;
const R = (title: string, client: string, category: CategoryId, file?: string): Project => {
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
    film: hosted(file),
  };
};

PROJECTS.push(
  // Brand Films (brandfilms/)
  R("Ramadan Fridge", "Etihad Airways", "brand", "brandfilms/etihad_ramadan_fridge_introduction.mp4_v1 (720p).mp4"),
  R("Class of 2015", "Masdar Institute", "brand", "brandfilms/masdar_institute_class_of__2015_.mp4_v1 (720p).mp4"),
  R("Dr Ahmed's Story", "Prime Minister's Office", "brand", "brandfilms/Prime Minister's Office - Dr_Ahmed_uae_inspiring_story_v1 (720p).mp4"),
  R("1001: One Tank Challenge", "Toyota Prius", "brand", "brandfilms/prius_1001_one_tank_challenge_v1 (720p) (1).mp4"),
  R("Hybrid Falcon", "Toyota Prius", "brand", "brandfilms/prius_hybrid_falcon.mp4_v1 (1080p).mp4"),
  R("Riyadh Marathon 2025", "Riyadh Marathon", "brand", "brandfilms/riyadh_marathon_2025_fanzone_casestudy_v1 (1080p).mp4"),
  // Documentaries
  R("Digital Divide", "GMIS", "documentary"),
  R("General Corporation", "GMIS", "documentary"),
  R("Rural Transformation", "GMIS", "documentary"),
  R("Sustainable Cities", "GMIS", "documentary"),
  R("Sustainable Energy", "GMIS", "documentary"),
  R("UAE Pioneers", "", "documentary"),
  // Music Videos (music/)
  R("I Love Kuwait", "", "music", "music/I Love Kuwait - FINAL.MP4"),
  R("RELM", "", "music", "music/RELM 2 min final 16x9.mp4"),
  // TVC's (TVC_s/)
  R("Cleveland Clinic", "Cleveland Clinic", "tvc", "TVC_s/cleveland_clinic_1.mp4_v1 (1080p).mp4"),
  R("A True Story of Recovery", "Cleveland Clinic", "tvc", "TVC_s/cleveland_clinic_2.mp4_v1 (1080p).mp4"),
  R("EHS", "EHS", "tvc", "TVC_s/EHS.MP4"),
  R("National Campaign", "Etisalat", "tvc", "TVC_s/ETISALAT - NATIONAL CAMPAIGN.MP4"),
  R("DMI Promo", "Expo", "tvc", "TVC_s/Expo DMI Promo.mov"),
  R("Fast Government", "UAE Government", "tvc", "TVC_s/fast_government_uae.mp4_v1 (1080p).mp4"),
  R("Toyota Corolla", "Filmmaster MEA", "tvc", "TVC_s/filmmaster_mea_toyota_-_corolla(1)_v1 (1080p).mp4"),
  R("Shahid", "MBC", "tvc", "TVC_s/mbc_shahid_tvc_v1 (1080p).mp4"),
  R("Museum of the Future", "Museum of the Future", "tvc", "TVC_s/museum_of__the_future_schools.mp4_v1 (1080p).mp4"),
  R("National Day — 50 Years", "", "tvc", "TVC_s/National Day - 50 Years.MP4"),
  R("Saadiyat", "Rotana", "tvc", "TVC_s/rotana_saddiyat_v1 (1080p).mp4"),
  R("Water Projection", "Toyota", "tvc", "TVC_s/Copy of toyota_water_projection_tvc_v1 (1080p).mp4"),
  R("Brand Film 2019", "Toyota", "tvc", "TVC_s/toyota_brand_film_2019_v1 (1080p).mp4"),
  R("Saudi National Day", "", "tvc", "TVC_s/saudi_national_day_v1 (1080p).mp4"),
  R("Special Olympics", "Special Olympics", "tvc", "TVC_s/special_olympics_v1 (1080p).mp4"),
  R("Ministry of Education", "UAE Ministry of Education", "tvc", "TVC_s/uae_ministry_of_education_tvc_v1 (1080p).mp4"),
  R("UAE National Anthem", "", "tvc", "TVC_s/uae_national_anthem_.mp4_v1 (720p).mp4"),
  R("what3words", "what3words", "tvc", "TVC_s/what_3_words_tvc.mp4_v1 (1080p).mp4"),
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
  /** its reels, played in its frame when pointed at. Stand-ins for now: drop the account's real
   *  reel files (vertical MP4s) in /public/work/reels/<handle>/ and list them here. */
  reels?: string[];
};

const standIn = (...n: number[]) => n.map((x) => `/clips/clip-${String(x).padStart(2, "0")}.mp4`);

export const ACCOUNTS: Account[] = [
  { name: "DED Cafe", handle: "ded_cafe", followers: "23K", posts: 670, logo: "/work/accounts/ded_cafe.webp", reels: standIn(3, 7, 11, 2) },
  { name: "Amer Lounge", handle: "amerlounge", followers: "10K", posts: 148, logo: "/work/accounts/amerlounge.webp", reels: standIn(5, 9, 14, 1) },
  { name: "Business Lounge", handle: "businesslounge.ae", followers: "8,508", posts: 309, logo: "/work/accounts/businesslounge.webp", reels: standIn(8, 12, 4, 15) },
  { name: "Business Avenue", handle: "businessavenue.ae", followers: "7,309", posts: 99, logo: "/work/accounts/businessavenue.webp", reels: standIn(6, 10, 13, 2) },
];

export const instagramOf = (a: Account) => `https://www.instagram.com/${a.handle}/`;
