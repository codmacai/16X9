"use client";

import { motion } from "framer-motion";
import { FORMATS, FrameGlyph, Ratio, type FormatKey } from "../hero3/format-hero";
import styles from "./room-switch.module.css";

// ===========================================================================
// THE ROOM SWITCH — at the top, in the middle, in every room: the three
// frames side by side, always in view, the one you're in held in a pill
// that slides to whichever you pick. A small arrow before them goes back to
// the index. Minimal — three words and a pill — but it's the one thing at
// the top of the screen, so it reads first.
// ===========================================================================

const EASE = [0.16, 1, 0.3, 1] as const;
const SLIDE = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 } as const; // no bounce

export default function RoomSwitch({
  room,
  onSwitch,
  onIndex,
  tone = "dark",
}: {
  room: FormatKey;
  onSwitch: (k: FormatKey) => void;
  onIndex: () => void;
  /** "light": ink on a paper page */
  tone?: "dark" | "light";
}) {
  return (
    <motion.nav
      className={`${styles.root} ${tone === "light" ? styles.light : ""}`}
      aria-label="Formats"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.6, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <button type="button" className={styles.index} onClick={onIndex} aria-label="Back to the index">
        <svg viewBox="0 0 14 10" aria-hidden="true">
          <path d="M13 5H1.5M5 1L1 5l4 4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <div className={styles.track} role="radiogroup">
        {FORMATS.map((x) => {
          const on = x.key === room;
          return (
            <button
              key={x.key}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${styles.opt} ${on ? styles.optOn : ""}`}
              onClick={() => !on && onSwitch(x.key)}
            >
              {on && <motion.span layoutId="room-pill" className={styles.pill} transition={SLIDE} />}
              <span className={styles.optIn}>
                <FrameGlyph k={x.key} className={styles.glyph} />
                <Ratio text={x.label} className={styles.x} />
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
