import { FILM_KEYS, PREVIEW_CLIPS, SHOTS } from "./shots";
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
    format: "16x9",
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
/** A film's file -> its URL, at the path the build found it under in the bucket (FILM_KEYS, for a
 *  file named without its folder) or as named. */
const filmUrl = (key?: string) => hosted(key && (FILM_KEYS[key] ?? key));

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
    film: filmUrl(file),
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
  // Documentaries (named as uploaded, without a folder: the build finds where they sit in the bucket)
  R("Digital Divide", "GMIS", "documentary", "gims_digital_divide_docu.mp4_v1 (720p).mp4"),
  R("General Corporation", "GMIS", "documentary", "gims_general_corporation_docu.mp4_v1 (1080p).mp4"),
  R("Rural Transformation", "GMIS", "documentary", "gmis_rural_transformation_docu_v1 (1080p).mp4"),
  R("Sustainable Cities", "GMIS", "documentary", "gmis_sustainable_cities_docu.mp4_v1 (1080p).mp4"),
  R("Sustainable Energy", "GMIS", "documentary", "gmis_sustainablr_energy_docu.mp4_v1 (720p).mp4"),
  R("UAE Pioneers", "", "documentary", "uae_pioneers_-_dr_zainab_v1 (720p).mp4"),
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

/** The real film's own shot (scripts/make-shots.mjs picks a sharp frame from it at build time), by film URL. */
const SHOT_BY_FILM = new Map(Object.entries(SHOTS).map(([key, shot]) => [filmUrl(key), shot]));
export const shotFor = (film?: string) => (film ? SHOT_BY_FILM.get(film) : undefined);
/** A film's poster (cards, the cover, the screen, the folders): the shot cut from the film itself,
 *  or nothing — never another film's picture. Without one, FilmStill (chrome.tsx) shows a frame
 *  read from the film, or the film's title. */
export const posterFor = (p: Project) => shotFor(p.film);

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
  reels?: Reel[];
  /** a demo account, holding a place until a real one comes in: no Instagram link, no counts */
  demo?: boolean;
};

/** One reel: either a video file we host (`src`) or a reel on Instagram (`ig`, its id from the link
 *  instagram.com/reel/<id>/, played through Instagram's own embed). `views` as shown on Instagram. */
export type Reel = {
  src?: string;
  ig?: string;
  views: string;
  /** an Instagram reel's shape in the embed, height / width (default 1.25) */
  ar?: number;
  /** a demo work's name and kind, shown under it and in the player */
  title?: string;
  kind?: string;
  /** how far a hosted film is scaled up to fill 9:16 (the stand-ins carry black bands) */
  zoom?: number;
};

const standIn = (...n: number[]): Reel[] =>
  n.map((x, i) => ({ src: `/clips/clip-${String(x).padStart(2, "0")}.mp4`, views: (((x * 977 + i * 613) % 3100) + 380).toLocaleString("en-US") }));
/** Instagram reels: [id, views]. Update the views from the account's Reels tab. */
const ig = (...r: ([string, string] | [string, string, number])[]): Reel[] => r.map(([id, views, ar]) => ({ ig: id, views, ar }));
export const reelEmbed = (id: string) => `https://www.instagram.com/reel/${id}/embed/`;
export const reelLink = (id: string) => `https://www.instagram.com/reel/${id}/`;

export const ACCOUNTS: Account[] = [
  { name: "DED Cafe", handle: "ded_cafe", followers: "23K", posts: 670, logo: "/work/accounts/ded_cafe.webp", reels: ig(
      ["DePRhCZMJfb", "—"],
      ["DeH2TX_MMtl", "—"],
      ["Dc6GULOsuPf", "—", 0.75],
      ["Dc4QpK3MStl", "—"],
      ["DcWWeeJsGTH", "—"],
      ["Dbx9SG4sO6-", "—"]
    ) },
  { name: "Amer Lounge", handle: "amerlounge", followers: "10K", posts: 148, logo: "/work/accounts/amerlounge.webp", reels: standIn(5, 9, 14, 1, 6, 10, 15, 3, 8) },
  { name: "Business Lounge", handle: "businesslounge.ae", followers: "8,508", posts: 309, logo: "/work/accounts/businesslounge.webp", reels: standIn(8, 12, 4, 15, 2, 7, 11, 13, 6) },
  { name: "Business Avenue", handle: "businessavenue.ae", followers: "7,309", posts: 99, logo: "/work/accounts/businessavenue.webp", reels: standIn(6, 10, 13, 2, 4, 9, 1, 14, 7) },
  // demo accounts for now, under the logos of brands the studio has made films for (their own
  // profile pictures, drawn from the logo files) — replace each with a real account we run
  ...([
    ["Etihad Airways", "etihad", "/work/accounts/demo-etihad.svg", [3, 7, 12, 2, 15, 9]],
    ["Toyota", "toyota", "/work/accounts/demo-toyota.svg", [6, 15, 2, 11, 4, 8]],
    ["Masdar", "masdar", "/work/accounts/demo-masdar.webp", [11, 9, 3, 14, 7, 12]],
    ["what3words", "what3words", "/work/accounts/demo-what3words.svg", [15, 2, 8, 3, 10, 4]],
  ] as const).map(([name, slug, logo, reels]): Account => ({
    name,
    handle: `demo-${slug}`,
    followers: "",
    posts: 0,
    logo,
    reels: standIn(...reels),
    demo: true,
  })),
];

// ---------------------------------------------------------------------------
// 9x16's selected reels, under the accounts: demo works for now, cut from the
// studio's reel. Swap each for a real vertical film (its MP4 in
// /public/work/reels/, or an Instagram reel as `ig`) with its real name and kind.
// ---------------------------------------------------------------------------
const demo = (clip: string, title: string, kind: string): Reel => ({ src: `/clips/clip-${clip}.mp4`, views: "", title, kind, zoom: 1.46 });
export const WORKS_9X16: Reel[] = [
  demo("03", "Golden Hour", "Brand reel"),
  demo("12", "Court Session", "Fashion reel"),
  demo("04", "Night Shift", "Short documentary"),
  demo("10", "After Hours", "Event recap"),
  demo("02", "The Long Horizon", "Travel series"),
  demo("08", "Break", "Culture reel"),
  demo("11", "In Her Words", "Portrait series"),
  demo("14", "Beat", "Music teaser"),
  demo("07", "The Majlis", "Hospitality reel"),
  demo("15", "Dune Line", "Travel series"),
  demo("09", "First Person", "Portrait series"),
  demo("01", "Press Play", "Launch teaser"),
];

// ---------------------------------------------------------------------------
// 9x16's services, under the accounts: each plays its kind of work in the
// small frame before its name (stand-in clips for now; swap each for a reel of
// that service). Its name; three words on what it covers.
// ---------------------------------------------------------------------------
export type Service = { name: [string, string]; tags: string[]; clip: string };
export const SERVICES_9X16: Service[] = [
  { name: ["Social media", "management"], tags: ["Strategy", "Calendar", "Community"], clip: "/clips/clip-06.mp4" },
  { name: ["Short-form", "reels"], tags: ["Concept", "Shoot", "Edit"], clip: "/clips/clip-08.mp4" },
  { name: ["Content", "series"], tags: ["Formats", "Hosts", "Episodes"], clip: "/clips/clip-11.mp4" },
  { name: ["Paid", "social"], tags: ["Ads", "Cutdowns", "Testing"], clip: "/clips/clip-01.mp4" },
  { name: ["Creator", "campaigns"], tags: ["Casting", "Briefs", "Production"], clip: "/clips/clip-14.mp4" },
  { name: ["Event", "coverage"], tags: ["Live stories", "Highlights", "Recaps"], clip: "/clips/clip-10.mp4" },
];

export const instagramOf = (a: Account) => `https://www.instagram.com/${a.handle}/`;

// ---------------------------------------------------------------------------
// The brands' logos, by client (single-colour SVGs, drawn in paper over the
// film). From the simple-icons set (CC0); add a brand by dropping its SVG in
// /public/brands and naming it here. A client without one shows its name.
// ---------------------------------------------------------------------------
export const BRAND_LOGOS: Record<string, string> = {
  Toyota: "/brands/toyota.svg",
  "Toyota Prius": "/brands/toyota.svg",
  "Filmmaster MEA": "/brands/toyota.svg", // Toyota Corolla
  BMW: "/brands/bmw.svg",
  "Rolls-Royce Kyiv": "/brands/rolls-royce.svg",
  "Etihad Airways": "/brands/etihad-airways.svg",
  what3words: "/brands/what3words.svg",
  "Masdar Institute": "/brands/masdar.png", // the wordmark (alpha PNG)
};
// logos far wider than tall, given a wider box on a tile
const WIDE_LOGOS = new Set(["/brands/masdar.png"]);

/** The brand shown for a film: Filmmaster MEA made Toyota's Corolla film, so it reads as Toyota. */
const BRAND_NAME: Record<string, string> = {
  "Filmmaster MEA": "Toyota",
  "Toyota Prius": "Toyota",
  "Masdar Institute": "Masdar",
  "Rolls-Royce Kyiv": "Rolls-Royce",
};
/** Each logo in its own colours: on a white ground (/public/brands/colour) and on a dark one
 *  (/public/brands/colour-dark: the versions the brands use on black), and the brand's colour. */
const LOGO_COLOUR: Record<string, { src: string; dark: string; hex: string }> = {
  "/brands/toyota.svg": { src: "/brands/colour/toyota.svg", dark: "/brands/colour/toyota.svg", hex: "#EB0A1E" },
  "/brands/bmw.svg": { src: "/brands/colour/bmw.svg", dark: "/brands/colour-dark/bmw.svg", hex: "#0066B1" },
  "/brands/rolls-royce.svg": { src: "/brands/colour/rolls-royce.svg", dark: "/brands/colour-dark/rolls-royce.svg", hex: "#281432" },
  "/brands/etihad-airways.svg": { src: "/brands/colour/etihad-airways.svg", dark: "/brands/colour/etihad-airways.svg", hex: "#BD8B13" },
  "/brands/what3words.svg": { src: "/brands/colour/what3words.svg", dark: "/brands/colour-dark/what3words.svg", hex: "#E11F26" },
  "/brands/masdar.png": { src: "/brands/colour/masdar.png", dark: "/brands/colour/masdar.png", hex: "#3271A9" },
};
export type Logo = { src: string; wide: boolean; colour?: string; dark?: string; hex?: string };
/** The brand a film was made for, and its logo (if we have the file): the single-colour mark (`src`),
 *  the logo in its own colours for white (`colour`) and for black (`dark`), and the brand's colour (`hex`). */
export const brandOf = (p: Project) => BRAND_NAME[p.client] ?? p.client;
export const logoOf = (p: Project): Logo | undefined => {
  const src = BRAND_LOGOS[p.client];
  const c = src ? LOGO_COLOUR[src] : undefined;
  return src ? { src, wide: WIDE_LOGOS.has(src), colour: c?.src, dark: c?.dark, hex: c?.hex } : undefined;
};

export type Preview = { src: string; title: string; brand: string; logo?: string; shot?: string };

/** The real 16x9 films with their full film in the bucket (MP4 only, so every browser plays them),
 *  for the start screen's 16x9 window: a different one, with its brand, each time it opens. */
export const PREVIEWS_16X9: Preview[] = PROJECTS.filter((p) => p.format === "16x9" && p.film && /\.mp4$/i.test(p.film)).map((p) => ({
  src: p.film!,
  title: p.title,
  brand: BRAND_NAME[p.client] ?? p.client,
  logo: BRAND_LOGOS[p.client],
  shot: shotFor(p.film),
}));

/** A film on hero 6's 16x9 wall: its 5-second preview clip (cut by scripts/make-shots.mjs), its
 *  shot as the still under it, and its brand's logo. */
export type WallFilm = { clip: string; shot?: string; brand: string; logo: string; wide?: boolean; title: string };
const CLIP_BY_FILM = new Map(Object.entries(PREVIEW_CLIPS).map(([key, clip]) => [filmUrl(key), clip]));
/** A film moving, for a preview: its 5-second clip once cut, else the film itself from 20s in (MP4s only). */
export const clipFor = (p: Project) =>
  p.film ? (CLIP_BY_FILM.get(p.film) ?? (/\.mp4$/i.test(p.film) ? `${p.film}#t=20` : undefined)) : undefined;
// only the films of brands we have a logo for, each tile its own film under its own brand's logo:
// its preview clip once cut, else the film itself from 20s in (MP4 only, so every browser plays it)
const onWall = (p: Project) =>
  p.format === "16x9" && !!p.film && !!BRAND_LOGOS[p.client] && (CLIP_BY_FILM.has(p.film) || /\.mp4$/i.test(p.film));
export const WALL_16X9: WallFilm[] = PROJECTS.filter(onWall).map((p) => ({
  clip: CLIP_BY_FILM.get(p.film!) ?? `${p.film}#t=20`,
  shot: shotFor(p.film),
  brand: BRAND_NAME[p.client] ?? p.client,
  logo: BRAND_LOGOS[p.client],
  wide: WIDE_LOGOS.has(BRAND_LOGOS[p.client]),
  title: p.title,
}));

// For now: brands with no film in the bucket yet, each on stand-in clips from the studio's reel.
// When a brand's own film comes in, add it to PROJECTS (with its logo above) and drop it from here.
const STAND_INS: { brand: string; logo: string; clips: string[] }[] = [
  { brand: "BMW", logo: "/brands/bmw.svg", clips: ["clip-04", "clip-15"] }, // night lights, the dunes
  { brand: "Nike", logo: "/brands/nike.svg", clips: ["clip-12", "clip-08"] }, // dance, breaking
  { brand: "Rolls-Royce", logo: "/brands/rolls-royce.svg", clips: ["clip-02", "clip-07"] }, // the Arabian horse, the majlis
  { brand: "Aldar", logo: "/brands/aldar.png", clips: ["clip-03"] }, // the Abu Dhabi skyline
  // not clip-06 (Emaar's name is on its skyline) nor clip-05 (a hospital)
];
WALL_16X9.push(
  ...STAND_INS.flatMap(({ brand, logo, clips }) =>
    clips.map((c) => ({ clip: `/clips/${c}.mp4`, shot: `/clips/stills/${c}.webp`, brand, logo, wide: WIDE_LOGOS.has(logo), title: brand }))
  )
);
