// The home's way into Beyond and Beyond's work page (work/beyond.tsx) are one move. Hero 8's door:
// clicking BEYOND the hairline of light reaches the full height of the dark, and Beyond's page,
// arriving, starts as that same dark and line and parts from it onto itself. Hero 9's panel: the
// lit panel grows to the whole screen, and Beyond's page comes out from under it, the panel
// lifting away. The
// home leaves a note of which as it goes; the page reads it once, and only soon after (a reload,
// or coming back later, opens plainly).
export type Entry = "door" | "panel";

const KEY = "16x9:door";

export function leaveDoor(entry: Entry = "door") {
  try {
    sessionStorage.setItem(KEY, `${entry}:${Date.now()}`);
  } catch {}
}

/** how this page was just come into from the home, if it was (the note is then used up) */
export function takeDoor(): Entry | null {
  try {
    const [entry, at] = (sessionStorage.getItem(KEY) ?? "").split(":");
    sessionStorage.removeItem(KEY);
    return (entry === "door" || entry === "panel") && Date.now() - Number(at) < 8000 ? entry : null;
  } catch {
    return null;
  }
}
