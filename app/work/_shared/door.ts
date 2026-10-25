// Beyond's door (hero 8) and Beyond's work page (work/beyond.tsx) are one move: clicking BEYOND
// the hairline of light reaches the full height of the dark, and Beyond's page, arriving, starts
// as that same dark and line and opens from it onto itself. The door leaves a note as it goes;
// the page reads it once, and only soon after (a reload, or coming back later, opens plainly).
const KEY = "16x9:door";

export function leaveDoor() {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {}
}

/** whether this page was just come into through the door (the note is then used up) */
export function takeDoor(): boolean {
  try {
    const at = Number(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
    return at > 0 && Date.now() - at < 8000;
  } catch {
    return false;
  }
}
