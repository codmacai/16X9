"use client";

import type { RefObject } from "react";
import { motion } from "framer-motion";
import { EASE } from "./_shared/chrome";
import type { Project } from "./_shared/data";
import s from "./story.module.css";

// ===========================================================================
// THE CASE — on a film's page, under the screen: what lies behind it, told in
// three parts (Client, Challenge, Idea), or, for a film without its case
// written yet, its synopsis. Each part is a row on the paper: a hairline
// draws itself across, its number and its name rise out of a mask in the
// wide light capitals of the headings, and the words follow, a line at a
// time. It all plays once, as the row scrolls into view.
// ===========================================================================

export default function Story({ film, root, reduce }: { film: Project; root: RefObject<HTMLElement | null>; reduce: boolean }) {
  const rows = film.story
    ? [
        { name: "Client", text: film.story.client },
        { name: "Challenge", text: film.story.challenge },
        { name: "Idea", text: film.story.idea },
      ]
    : [{ name: "The film", text: film.synopsis }];
  const view = { root, once: true, amount: 0.35 } as const;

  return (
    <section className={s.story} aria-label="Behind the film">
      <motion.p
        className={s.kicker}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={view}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <span>Behind the film</span>
        <i aria-hidden="true" />
        <span>
          {[film.client, film.year].filter(Boolean).join(" · ")}
        </span>
      </motion.p>

      {rows.map((r, i) => (
        <motion.article key={r.name} className={s.row} initial={reduce ? false : "hidden"} whileInView="shown" viewport={view}>
          {/* the hairline, drawn across */}
          <motion.span
            className={s.rule}
            aria-hidden="true"
            variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1, transition: { duration: 1.2, ease: [0.76, 0, 0.24, 1] } } }}
          />
          <h3 className={s.name}>
            <motion.i
              className={s.no}
              variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { delay: 0.2, duration: 0.8 } } }}
            >
              {String(i + 1).padStart(2, "0")}
            </motion.i>
            <span className={s.mask}>
              <motion.span
                className={s.word}
                variants={{ hidden: { y: "108%" }, shown: { y: "0%", transition: { delay: 0.15, duration: 1.1, ease: EASE } } }}
              >
                {r.name}
              </motion.span>
            </span>
          </h3>
          <motion.p
            className={s.text}
            variants={{ hidden: { opacity: 0, y: 24 }, shown: { opacity: 1, y: 0, transition: { delay: 0.35, duration: 1.1, ease: EASE } } }}
          >
            {r.text}
          </motion.p>
        </motion.article>
      ))}
    </section>
  );
}
