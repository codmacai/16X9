/**
 * HERO CONFIG — the one file the client edits.
 * No layout or animation code in here, only content.
 *
 * How a variant is chosen (first match wins):
 *   1. ?hero=<id> in the URL (handy for previewing: /?hero=campaign)
 *   2. a variant whose `from`/`to` dates contain today (campaign takeovers)
 *   3. the "default" variant
 */

export type Clip = {
    title: string;
    duration: string;
    src: string; // file in /public/clips
    accent: string; // the film's colour (use the client's brand colour)
  };
  
  export type ClientName = {
    name: string;
    /** a = heavy, b = light and tight, c = italic, d = wide and spaced */
    style: "a" | "b" | "c" | "d";
  };
  
  export type HeroVariant = {
    id: string;
    /** ISO dates, e.g. "2026-10-01". Both optional. The variant is live between them (inclusive). */
    from?: string;
    to?: string;
    /** Headline lines, one per line. */
    headline: string[];
    sub: string;
    /** Letters cut out of the colour block. Defaults to "16X9". */
    wordmark?: string;
    /** The FIRST clip fills the big tile and opens out on scroll. */
    clips: Clip[];
    /** Swap spare clips into the wall over time. Turn off to pin a campaign film. */
    swap: boolean;
    clients: ClientName[];
    /** Scrolling zooms the big film to full screen and reveals this panel. */
    takeover: {
      enabled: boolean;
      /** Total height of the scroll section in svh. 100 = no scroll room. 240 is a good default. */
      scrollLength: number;
      body: string;
      ctaLabel: string;
      ctaHref: string;
    };
  };
  
  // ---------------------------------------------------------------------------
  // Films. Files live in /public/clips. Keep them short (5–15 s), muted, 720p.
  // Have more films than the wall has tiles (8 desktop, 5 mobile) so there are
  // spares to swap in.
  // ---------------------------------------------------------------------------
  const FILMS: Clip[] = [
    { title: "Aster SS26", duration: "0:48", src: "/clips/clip-01.mp4", accent: "#ff5a3c" },
    { title: "Oko Audio launch", duration: "1:12", src: "/clips/clip-02.mp4", accent: "#3cc8ff" },
    { title: "Maison Vert winter", duration: "0:30", src: "/clips/clip-03.mp4", accent: "#7be06a" },
    { title: "Tessera watches", duration: "0:45", src: "/clips/clip-04.mp4", accent: "#f2c14e" },
    { title: "Kaji studio", duration: "1:05", src: "/clips/clip-05.mp4", accent: "#ff7ab8" },
    { title: "Lumen & Co scent", duration: "0:20", src: "/clips/clip-06.mp4", accent: "#c9a4ff" },
    { title: "Norrland outerwear", duration: "0:58", src: "/clips/clip-07.mp4", accent: "#9fd8ff" },
    { title: "Night run", duration: "0:36", src: "/clips/clip-08.mp4", accent: "#e1142b" },
    { title: "Atelier", duration: "0:42", src: "/clips/clip-09.mp4", accent: "#ffb27a" },
    { title: "Coastline", duration: "1:20", src: "/clips/clip-10.mp4", accent: "#4fe3c1" },
    { title: "Studio session", duration: "0:25", src: "/clips/clip-11.mp4", accent: "#ff9f1c" },
    { title: "Launch day", duration: "0:52", src: "/clips/clip-12.mp4", accent: "#e1142b" },
  ];
  
  /** Same films, with one moved to the front (the big tile). */
  const featuring = (src: string): Clip[] => [
    ...FILMS.filter((c) => c.src === src),
    ...FILMS.filter((c) => c.src !== src),
  ];
  
  const CLIENTS: ClientName[] = [
    { name: "Norrland", style: "a" },
    { name: "oko", style: "b" },
    { name: "Maison Vert", style: "c" },
    { name: "TESSERA", style: "d" },
    { name: "kaji", style: "b" },
    { name: "Lumen & Co", style: "c" },
  ];
  
  // ---------------------------------------------------------------------------
  // Variants
  // ---------------------------------------------------------------------------
  export const VARIANTS: HeroVariant[] = [
    {
      id: "default",
      headline: ["Bringing brands", "to life"],
      sub: "Turn target audience into your viewers",
      clips: FILMS,
      swap: true,
      clients: CLIENTS,
      takeover: {
        enabled: true,
        scrollLength: 240,
        body: "Fashion, audio, watches and more. Every film starts with a brand and ends with an audience that wants to watch.",
        ctaLabel: "All cases",
        ctaHref: "https://16x9.agency/cases/",
      },
    },
  
    // Example campaign takeover. Live 1 to 31 October 2026, or any time at /?hero=campaign.
    // Edit the copy, the dates and the featured film, or delete this block.
    {
      id: "campaign",
      from: "2026-10-01",
      to: "2026-10-31",
      headline: ["The new", "Meridian"],
      sub: "Launch film for Tessera, by 16x9",
      clips: featuring("/clips/clip-04.mp4"),
      swap: false, // keep the wall steady so the launch film stays in the big tile
      clients: CLIENTS,
      takeover: {
        enabled: true,
        scrollLength: 260,
        body: "Forty-five seconds, shot in one week. See how the Meridian launch film came together.",
        ctaLabel: "Read the case",
        ctaHref: "https://16x9.agency/cases/",
      },
    },
  ];
  
  /** Picks the variant to show. `override` is an id from the URL or a prop. */
  export function resolveVariant(now: Date, override?: string | null): HeroVariant {
    const byId = override ? VARIANTS.find((v) => v.id === override) : undefined;
    if (byId) return byId;
  
    const t = now.getTime();
    const live = VARIANTS.find((v) => {
      if (!v.from && !v.to) return false;
      const start = v.from ? new Date(`${v.from}T00:00:00`).getTime() : -Infinity;
      const end = v.to ? new Date(`${v.to}T23:59:59`).getTime() : Infinity;
      return t >= start && t <= end;
    });
    return live ?? VARIANTS.find((v) => v.id === "default") ?? VARIANTS[0];
  }