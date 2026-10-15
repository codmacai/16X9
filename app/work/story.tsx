"use client";

import { useRef, type RefObject } from "react";
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import type { Project } from "./_shared/data";
import s from "./story.module.css";

// ===========================================================================
// THE CASE — on a film's page, above the screen: Client, Task, Solution.
// Minimal, on the paper. On the left one word stands still while you scroll
// and rolls over to the next part's name; on the right the three parts pass
// by like lines on a prompter — the one at the middle of the screen in full
// ink, the others faded back. Everything follows the scroll through the same
// heavy, over-damped spring as the rest of the page, so it glides, never
// jumps and never wobbles. Every film has all three: a film whose case isn't
// written yet has one drafted from what we know of it (caseOf).
// ===========================================================================

const SMOOTH = { stiffness: 90, damping: 30, mass: 1, restDelta: 0.0001 };

/**
 * The three parts of a film's case. Written ones (film.story) are used as they
 * are; until a film's is written, each part is drafted from its details: the
 * client, the line under its title, and its synopsis. Replace the drafts by
 * giving the film a story in data.ts.
 */
export function caseOf(film: Project) {
  if (film.story)
    return [
      { name: "Client", text: film.story.client },
      { name: "Task", text: film.story.challenge },
      { name: "Solution", text: film.story.idea },
    ];
  const line = film.line.replace(/\.?$/, ".");
  const synopsis = film.synopsis.trim();
  return [
    { name: "Client", text: film.client ? `${film.client}.` : `${film.title}.` },
    { name: "Task", text: line },
    {
      name: "Solution",
      // some films' synopsis is still just their line: don't say it twice
      text: synopsis && synopsis !== line ? synopsis : `${film.title}, directed and produced by 16×9 & Beyond.`,
    },
  ];
}

export default function Story({ film, root, reduce }: { film: Project; root: RefObject<HTMLElement | null>; reduce: boolean }) {
  const parts = caseOf(film);
  const n = parts.length;
  const ref = useRef<HTMLElement>(null);

  // where we are in the case: 0 → n-1, held on each part, rolling between them
  const { scrollYProgress } = useScroll({ container: root, target: ref, offset: ["start center", "end center"] });
  const smooth = useSpring(scrollYProgress, SMOOTH);
  const p = reduce ? scrollYProgress : smooth;
  const at = useTransform(p, (v) => {
    const x = Math.min(n - 1, Math.max(0, v * n - 0.5));
    const i = Math.floor(x);
    const f = x - i;
    // hold on each word, roll quickly through the middle of the gap
    const k = f < 0.35 ? 0 : f > 0.65 ? 1 : (f - 0.35) / 0.3;
    return i + k * k * (3 - 2 * k);
  });
  const reel = useTransform(at, (v) => `${(-v * 1.05).toFixed(4)}em`);
  const count = useTransform(at, (v) => `${(-v * 1.3).toFixed(4)}em`);

  return (
    <section ref={ref} className={s.story} aria-label="The case">
      <div className={s.side}>
        <div className={s.sticky}>
          <p className={s.kicker}>{[film.client, film.year].filter(Boolean).join(" · ")}</p>
          {/* the part's name: one word showing, the next rolling up under it */}
          <div className={s.wordMask} aria-hidden="true">
            <motion.div className={s.reel} style={{ y: reel }}>
              {parts.map((part) => (
                <span key={part.name}>{part.name}</span>
              ))}
            </motion.div>
          </div>
          {n > 1 && (
            <p className={s.count} aria-hidden="true">
              <span className={s.countMask}>
                <motion.span className={s.countReel} style={{ y: count }}>
                  {parts.map((_, i) => (
                    <span key={i}>{String(i + 1).padStart(2, "0")}</span>
                  ))}
                </motion.span>
              </span>
              <i>/</i>
              {String(n).padStart(2, "0")}
            </p>
          )}
        </div>
      </div>

      <div className={s.parts}>
        {parts.map((part) => (
          <Part key={part.name} name={part.name} text={part.text} root={root} reduce={reduce} />
        ))}
      </div>
    </section>
  );
}

/** One part: in full ink at the middle of the screen, faded either side of it. */
function Part({ name, text, root, reduce }: { name: string; text: string; root: RefObject<HTMLElement | null>; reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: root, target: ref, offset: ["start end", "end start"] });
  const smooth = useSpring(scrollYProgress, SMOOTH);
  const p: MotionValue<number> = reduce ? scrollYProgress : smooth;
  const opacity = useTransform(p, [0.15, 0.42, 0.58, 0.85], [0.14, 1, 1, 0.14]);
  const y = useTransform(p, [0, 0.5, 1], ["36px", "0px", "-36px"]);
  return (
    <motion.div ref={ref} className={s.part} style={reduce ? undefined : { opacity, y }}>
      <h3 className={s.partName}>{name}</h3>
      <p className={s.text}>{text}</p>
    </motion.div>
  );
}
