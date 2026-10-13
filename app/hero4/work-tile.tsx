"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FrameGlyph, Ratio } from "../hero3/format-hero";
import { PROJECTS } from "../work/_shared/data";
import s from "./work-tile.module.css";

// ===========================================================================
// THE WORK TILE — in a room, the way to all of that format's work is one tile
// of the wall itself: the size of a film's tile, in a lane beside the middle,
// pinned while the films run past above and below it — paper among the black
// and white. The format and the number of films, "View full work" and an
// arrow. Pointed at, the words open out and the arrow turns; clicked, it opens
// that format's work page.
// ===========================================================================

const EASE = [0.16, 1, 0.3, 1] as const;

export default function WorkTile({ room }: { room: "16x9" | "9x16" }) {
  const count = PROJECTS.filter((p) => !p.format || p.format === room).length;
  return (
    <motion.div
      className={`${s.pin} ${room === "9x16" ? s.tall : ""}`}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.5, duration: 0.9, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <Link href={`/work?format=${room}`} className={s.card} aria-label={`View all ${room} work`}>
        <span className={s.top}>
          <span className={s.index}>
            <FrameGlyph k={room} className={s.glyph} /> Index
          </span>
          <span>{String(count).padStart(2, "0")} films</span>
        </span>

        <span className={s.mid}>
          <span className={s.kicker}>
            <Ratio text={room} className={s.x} />
          </span>
          <span className={s.title}>
            View full
            <br />
            work
          </span>
          <span className={s.go} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
        </span>

      </Link>
    </motion.div>
  );
}
