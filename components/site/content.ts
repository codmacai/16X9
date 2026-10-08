/**
 * SITE CONTENT — the one file to edit for the website's words, films and links.
 * No layout or animation code in here, only content.
 *
 * PLACEHOLDERS: the films and clients come from components/Hero-config.ts and
 * are stand-ins until the real projects arrive. The email, social links and the
 * testimonial below are placeholders too. Replace them before launch.
 */
import { VARIANTS, type Clip } from "@/components/Hero-config";

export const STUDIO = {
  name: "16x9 & Beyond",
  mark: "16X9",
  place: "Dubai, United Arab Emirates",
  timeZone: "Asia/Dubai",
  email: "hello@16x9andbeyond.com", // PLACEHOLDER
  tagline: "Bringing brands to life",
  statement: "We make films for brands that want to be seen — and remembered.",
  intro:
    "16x9 & Beyond is a film studio in Dubai. We take an idea from the first conversation to the final frame: strategy, production and post, for the cinema screen, the TV and the phone in your hand.",
  socials: [
    { label: "Instagram", href: "#" }, // PLACEHOLDER links
    { label: "LinkedIn", href: "#" },
    { label: "Vimeo", href: "#" },
    { label: "YouTube", href: "#" },
  ],
} as const;

export const NAV = [
  { label: "Work", href: "/work" },
  { label: "Services", href: "/services" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

// ---------------------------------------------------------------------------
// Work. The films are the hero's films; this adds what the site shows about each.
// ---------------------------------------------------------------------------
export const CATEGORIES = ["Brand film", "Campaign", "Commercial", "Social", "Documentary"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Work = Clip & { client: string; category: Category; industry: string; year: number };

const DETAILS: Record<string, Omit<Work, keyof Clip>> = {
  "/clips/clip-01.mp4": { client: "Aster", category: "Campaign", industry: "Fashion", year: 2026 },
  "/clips/clip-02.mp4": { client: "Oko Audio", category: "Commercial", industry: "Technology", year: 2026 },
  "/clips/clip-03.mp4": { client: "Maison Vert", category: "Campaign", industry: "Fashion", year: 2025 },
  "/clips/clip-04.mp4": { client: "Tessera", category: "Brand film", industry: "Luxury", year: 2026 },
  "/clips/clip-05.mp4": { client: "Kaji", category: "Brand film", industry: "Design", year: 2025 },
  "/clips/clip-06.mp4": { client: "Lumen & Co", category: "Social", industry: "Beauty", year: 2026 },
  "/clips/clip-07.mp4": { client: "Norrland", category: "Campaign", industry: "Outdoor", year: 2025 },
  "/clips/clip-08.mp4": { client: "Night Run Club", category: "Social", industry: "Sport", year: 2026 },
  "/clips/clip-09.mp4": { client: "Atelier", category: "Brand film", industry: "Fashion", year: 2025 },
  "/clips/clip-10.mp4": { client: "Coastline", category: "Documentary", industry: "Travel", year: 2025 },
  "/clips/clip-11.mp4": { client: "Studio Session", category: "Social", industry: "Music", year: 2026 },
  "/clips/clip-12.mp4": { client: "Launch Day", category: "Commercial", industry: "Events", year: 2026 },
};

const FILMS = (VARIANTS.find((v) => v.id === "default") ?? VARIANTS[0]).clips;

export const WORK: Work[] = FILMS.filter((c) => DETAILS[c.src]).map((c) => ({ ...c, ...DETAILS[c.src] }));

/** The six on the homepage, in this order. */
export const FEATURED: Work[] = [
  "/clips/clip-04.mp4",
  "/clips/clip-01.mp4",
  "/clips/clip-10.mp4",
  "/clips/clip-06.mp4",
  "/clips/clip-02.mp4",
  "/clips/clip-07.mp4",
]
  .map((src) => WORK.find((w) => w.src === src))
  .filter((w): w is Work => !!w);

export const CLIENTS = ["Aster", "Oko Audio", "Maison Vert", "Tessera", "Kaji", "Lumen & Co", "Norrland", "Atelier"];

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
export type Service = {
  no: string;
  slug: string;
  title: string;
  line: string;
  body: string;
  deliverables: string[];
  clip: string;
  /** the frame the preview plays in: the "& Beyond" service is vertical */
  frame: "wide" | "tall";
};

export const SERVICES: Service[] = [
  {
    no: "01",
    slug: "strategy",
    title: "Strategy & creative",
    line: "The idea before the camera.",
    body: "We start with your audience and your goal, then find the one idea worth filming. You see it in words, frames and references before a single day is booked.",
    deliverables: ["Creative concepts", "Scripts and storyboards", "Campaign platforms", "Content strategy"],
    clip: "/clips/clip-05.mp4",
    frame: "wide",
  },
  {
    no: "02",
    slug: "production",
    title: "Production",
    line: "Crew, cast and locations, done properly.",
    body: "Directors, producers, cinematographers and a trusted crew across the region. We handle permits, casting, locations and kit, so the day runs on time and on brief.",
    deliverables: ["Brand films", "TV and online commercials", "Product films", "Documentary and interviews", "Stills on set"],
    clip: "/clips/clip-04.mp4",
    frame: "wide",
  },
  {
    no: "03",
    slug: "post-production",
    title: "Post-production",
    line: "Where the film is really made.",
    body: "Edit, colour, sound and motion under one roof. We cut for the story first, then finish every frame to broadcast and cinema standard.",
    deliverables: ["Editing", "Colour grading", "Sound design and mix", "Motion graphics and VFX", "Subtitles and versions"],
    clip: "/clips/clip-09.mp4",
    frame: "wide",
  },
  {
    no: "04",
    slug: "social",
    title: "Social & vertical",
    line: "& Beyond: every format, every feed.",
    body: "The same idea, built for the phone: vertical edits, cut-downs and always-on content that feels native to each platform, not shrunk to fit.",
    deliverables: ["Reels, TikTok and Shorts", "9:16, 4:5 and 1:1 versions", "Cut-downs and teasers", "Always-on content"],
    clip: "/clips/clip-06.mp4",
    frame: "tall",
  },
];

// ---------------------------------------------------------------------------
// Process, beliefs, testimonial
// ---------------------------------------------------------------------------
export const PROCESS = [
  { tc: "00:00", title: "Brief", body: "We listen first: your goal, your audience, your budget and your deadline." },
  { tc: "00:15", title: "Idea", body: "Concepts, scripts and boards you can see and sign off before we shoot." },
  { tc: "00:30", title: "Shoot", body: "Crew, cast and kit on the day, run by producers who sweat the details." },
  { tc: "00:45", title: "Finish", body: "Edit, colour and sound, then every version and format you need, delivered." },
];

export const BELIEFS = [
  { title: "Story before spectacle", body: "A beautiful shot that says nothing is still nothing. Every frame has a job." },
  { title: "Every frame counts", body: "16:9, 9:16, 1:1, 4:5: we plan for every screen from day one, not as an afterthought." },
  { title: "Small team, senior hands", body: "The people you meet in the first call are the people on set and in the edit." },
  { title: "On time, on brief", body: "Clear budgets, clear schedules, no surprises. Creative work, run like a business." },
];

export const TESTIMONIAL = {
  // PLACEHOLDER: replace with a real client quote
  quote: "They took a two-line brief and came back with a film our whole team still talks about.",
  name: "Head of Brand",
  company: "Tessera",
};

// ---------------------------------------------------------------------------
// Contact form choices
// ---------------------------------------------------------------------------
export const PROJECT_TYPES = ["Brand film", "Campaign", "Commercial", "Social content", "Post-production", "Something else"];
export const BUDGETS = ["Under AED 25k", "AED 25k – 75k", "AED 75k – 150k", "AED 150k +", "Not sure yet"];
export const TIMELINES = ["As soon as possible", "Within 1–2 months", "In 3 months or more", "Flexible"];
