// Beyond's door (hero 8) and Beyond's work page (work/beyond.tsx) are one move: the film seen
// through the door as it opens is the deck's first project, and the page picks it up where the
// door left it — the same film, at the same moment, full screen — before it settles into its card.
// The door leaves a note of which film and how far in; the page reads it once, and only soon after.
export type Door = { clip: string; t: number; at: number };

const KEY = "16x9:door";

export function leaveDoor(d: Door) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d));
  } catch {}
}

/** the door's note, if it was left for this film just now (and it's then used up) */
export function takeDoor(clip: string): Door | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Door | null;
    sessionStorage.removeItem(KEY);
    return d && d.clip === clip && Date.now() - d.at < 8000 ? d : null;
  } catch {
    return null;
  }
}

/** a film picked up where the door left it: there, plus the time since */
export function seekDoor(v: HTMLVideoElement, d: Door) {
  const go = () => {
    const t = d.t + (Date.now() - d.at) / 1000;
    v.currentTime = v.duration ? t % v.duration : t;
  };
  if (v.readyState >= 1) go();
  else v.addEventListener("loadedmetadata", go, { once: true });
}
