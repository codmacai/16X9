// ===========================================================================
// WALL PLAYBACK — decides which few tiles get a live <video>.
//
// Every tile shows a still poster. Only the tiles nearest the centre of the
// screen (plus the hovered one) are allowed to mount and play a video, capped
// per device. Phones can only decode a handful of videos at once; asking for
// 20–30 is what made the wall stutter and hang.
//
// Ranking runs on a slow timer and on hover, never per frame. A tile that is
// already playing gets a head start in the ranking, so videos don't flicker
// on and off as the wall moves.
// ===========================================================================

type Entry = { el: HTMLElement; set: (live: boolean) => void };

const RANK_EVERY_MS = 600;
const KEEP_BONUS = 0.55; // a playing tile ranks as if it were this much closer
const MIN_AREA = 60 * 60; // ignore tiles too small or far back to be worth decoding

/** How many tiles may play at once on this device. */
export function liveBudget(): number {
  if (typeof window === "undefined") return 0;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return 1;
  const small = window.matchMedia("(max-width: 760px)").matches;
  const lowEnd = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  if (small) return lowEnd ? 2 : 3;
  return lowEnd ? 4 : 8;
}

export class WallPlayback {
  private tiles = new Map<string, Entry>();
  private visible = new Set<string>();
  private live = new Set<string>();
  private io: IntersectionObserver | null = null;
  private timer = 0;
  private queued = 0;
  private budget = 0;
  private hovered: string | null = null;
  private paused = false;

  start(budget: number) {
    this.budget = budget;
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.tile;
        if (!id) continue;
        if (e.isIntersecting) this.visible.add(id);
        else this.visible.delete(id);
      }
      this.queue();
    });
    this.tiles.forEach(({ el }) => this.io!.observe(el));
    this.timer = window.setInterval(() => this.rank(), RANK_EVERY_MS);
  }

  stop() {
    this.io?.disconnect();
    this.io = null;
    window.clearInterval(this.timer);
    cancelAnimationFrame(this.queued);
    this.live.forEach((id) => this.tiles.get(id)?.set(false));
    this.live.clear();
    this.visible.clear();
  }

  register(id: string, el: HTMLElement, set: (live: boolean) => void) {
    el.dataset.tile = id;
    this.tiles.set(id, { el, set });
    this.io?.observe(el);
    return () => {
      this.io?.unobserve(el);
      this.tiles.delete(id);
      this.visible.delete(id);
      this.live.delete(id);
    };
  }

  setHovered(id: string | null) {
    if (this.hovered === id) return;
    this.hovered = id;
    this.queue();
  }

  /** Pause every tile (a film is open, or the page is hidden). */
  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.queue();
  }

  isLive(id: string) {
    return this.live.has(id);
  }

  /** Rank on the next frame, coalescing bursts of events into one pass. */
  private queue() {
    cancelAnimationFrame(this.queued);
    this.queued = requestAnimationFrame(() => this.rank());
  }

  private rank() {
    const want = new Set<string>();

    if (!this.paused && this.budget > 0 && !document.hidden) {
      if (this.hovered && this.visible.has(this.hovered)) want.add(this.hovered);

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.45;
      const ranked: { id: string; score: number }[] = [];
      this.visible.forEach((id) => {
        const t = this.tiles.get(id);
        if (!t) return;
        const r = t.el.getBoundingClientRect();
        if (r.width * r.height < MIN_AREA) return;
        const dx = r.left + r.width / 2 - cx;
        const dy = r.top + r.height / 2 - cy;
        const d = dx * dx + dy * dy;
        ranked.push({ id, score: this.live.has(id) ? d * KEEP_BONUS : d });
      });
      ranked.sort((a, b) => a.score - b.score);
      for (const { id } of ranked) {
        if (want.size >= this.budget) break;
        want.add(id);
      }
    }

    this.live.forEach((id) => {
      if (!want.has(id)) {
        this.tiles.get(id)?.set(false);
        this.live.delete(id);
      }
    });
    want.forEach((id) => {
      if (!this.live.has(id)) {
        this.tiles.get(id)?.set(true);
        this.live.add(id);
      }
    });
  }
}

/** Poster for a clip, by convention: /clips/clip-01.mp4 -> /clips/posters/clip-01.webp */
export const posterFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/posters/$1.webp");
