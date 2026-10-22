import { brandOf, clipFor, logoOf, posterFor, stillFor, type Logo, type Project } from "./_shared/data";

// What the Brand Films room (brand-index.tsx) and a brand's opening titles (brand-titles.tsx)
// share: the brands, their films and how a film plays in them.

export type Brand = { name: string; films: Project[]; logo: Logo };

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** The brands with a logo, most films first; each with all its work in this format, its brand films
 *  (the drawer's) leading. Brands without a logo file yet stay off until one comes in. */
export function brandsFrom(drawerFilms: Project[], pool: Project[]): Brand[] {
  const names = [...new Set(pool.map(brandOf).filter(Boolean))];
  return names
    .map((name) => {
      const all = pool.filter((p) => brandOf(p) === name);
      const films = [...all.filter((p) => drawerFilms.includes(p)), ...all.filter((p) => !drawerFilms.includes(p))];
      return { name, films, logo: films.map(logoOf).find(Boolean)! };
    })
    .filter((b) => b.logo?.dark)
    .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
}

/** Each logo's optical size, so they sit at one weight: a wordmark in a square file reads small,
 *  a solid square heavy. */
export const OPTICAL: Record<string, number> = {
  "/brands/etihad-airways.svg": 1.35,
  "/brands/what3words.svg": 0.72,
  "/brands/bmw.svg": 0.9,
  "/brands/rolls-royce.svg": 0.86,
};

/** A film playing: its preview clip (or the film from 20s in; a film with no file yet plays its
 *  stand-in), over its own still while it loads — never another film's (a film with a file but no
 *  shot yet waits on black). */
export const reelOf = (p: Project) => ({ clip: clipFor(p) ?? p.src, still: posterFor(p) ?? (p.film ? undefined : stillFor(p.src)) });

/** iOS plays a film on its own only when it's muted as an attribute, not just the property. */
export const startMuted = (v: HTMLVideoElement | null) => {
  if (!v) return;
  v.muted = true;
  v.setAttribute("muted", "");
  v.play().catch(() => {});
};
