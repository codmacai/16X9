"use client";

import { type RefObject } from "react";
import { motion, type Variants } from "framer-motion";
import { FilmStill } from "./_shared/chrome";
import { brandOf, CATEGORIES, logoOf, type Project } from "./_shared/data";
import s from "./story.module.css";

// ===========================================================================
// THE CASE — on a film's page, above the screen, set out like a film's credit
// sheet. On the left, a tall black card: the film's still, low in the dark,
// the brand's mark at its head and its name large at its foot. On the right,
// the project's details in cards: a black one with the film's name and who
// directed it, a dashed line between; one with its client, category, year and
// format under a black strip of their names; and one with the case itself —
// the client, the task, the solution — under a strip of its own. They rise
// into place one after another as they come into view. Every film has all
// three parts of its case: one whose case isn't written yet has one drafted
// from what we know of it (caseOf).
// ===========================================================================

const RISE: Variants = {
  hidden: { opacity: 0, y: 40 },
  shown: (k: number) => ({ opacity: 1, y: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1], delay: k * 0.12 } }),
};

/**
 * The three parts of a film's case. Written ones (film.story) are used as they
 * are; until a film's is written, each part is drafted from its details: the
 * client, the line under its title, and its synopsis. Replace the drafts by
 * giving the film a story in data.ts.
 */
export function caseOf(film: Project) {
  if (film.story)
    return [
      { name: "The client", text: film.story.client },
      { name: "The task", text: film.story.challenge },
      { name: "The solution", text: film.story.idea },
    ];
  const line = film.line.replace(/\.?$/, ".");
  const synopsis = film.synopsis.trim();
  return [
    { name: "The client", text: film.client ? `${film.client}.` : `${film.title}.` },
    { name: "The task", text: line },
    {
      name: "The solution",
      // some films' synopsis is still just their line: don't say it twice
      text: synopsis && synopsis !== line ? synopsis : `${film.title}, directed and produced by 16×9 & Beyond.`,
    },
  ];
}

/** who directed it, from its credits (the studio, until they're in) */
function directionOf(film: Project) {
  for (const g of film.credits ?? []) for (const r of g.rows) if (r.role && /^direct/i.test(r.role)) return { role: r.role, names: r.names };
  return { role: "Direction", names: ["16×9 & Beyond"] };
}

export default function Story({ film, root, reduce }: { film: Project; root: RefObject<HTMLElement | null>; reduce: boolean }) {
  const parts = caseOf(film);
  const brand = brandOf(film);
  const logo = logoOf(film);
  const dir = directionOf(film);
  const kind = CATEGORIES.find((c) => c.id === film.category)?.label ?? "Film";
  const facts = [
    { label: "Client", value: brand },
    { label: "Category", value: kind },
    film.year ? { label: "Year", value: String(film.year) } : null,
    film.duration ? { label: "Runtime", value: film.duration } : null,
    { label: "Format", value: film.format === "9x16" ? "9:16" : "16:9" },
  ].filter((f): f is { label: string; value: string } => !!f);

  const rise = (k: number) =>
    reduce
      ? {}
      : { custom: k, variants: RISE, initial: "hidden" as const, whileInView: "shown" as const, viewport: { root, once: true, amount: 0.25 } };

  return (
    <section className={s.story} aria-label="The case">
      {/* the brand: the film's still low in the dark, the mark at its head, the name at its foot */}
      <motion.div className={s.brand} {...rise(0)}>
        <FilmStill film={film} className={s.still} />
        <span className={s.shade} aria-hidden="true" />
        <span className={s.mark}>
          {logo?.dark ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.dark} alt="" draggable={false} />
          ) : logo ? (
            <span className={s.markMask} style={{ maskImage: `url(${logo.src})`, WebkitMaskImage: `url(${logo.src})` }} />
          ) : null}
        </span>
        <span className={s.brandFoot}>
          <span className={s.lab}>Client</span>
          <span className={s.brandName}>{brand}</span>
        </span>
      </motion.div>

      <div className={s.cards}>
        {/* the film's name, and who directed it */}
        <motion.div className={`${s.card} ${s.black} ${s.duo}`} {...rise(1)}>
          <div className={s.cell}>
            <span className={s.lab}>Project</span>
            <span className={s.big}>{film.title}</span>
          </div>
          <div className={s.cell}>
            <span className={s.lab}>{dir.role}</span>
            <span className={s.big}>
              {dir.names.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </div>
        </motion.div>

        {/* its details, under a strip of their names */}
        <motion.div className={`${s.card} ${s.facts}`} style={{ "--n": facts.length } as React.CSSProperties} {...rise(2)}>
          <div className={s.strip}>
            {facts.map((f) => (
              <span key={f.label}>{f.label}</span>
            ))}
          </div>
          <div className={s.row}>
            {facts.map((f) => (
              <div key={f.label} className={s.cell}>
                {/* (on a phone each carries its own label: the strip goes) */}
                <span className={`${s.lab} ${s.cellLab}`}>{f.label}</span>
                <span className={s.mid}>{f.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* the case: the client, the task, the solution */}
        <motion.div className={`${s.card} ${s.case}`} {...rise(3)}>
          <div className={s.strip}>
            <span>The case</span>
          </div>
          <div className={s.row}>
            {parts.map((p) => (
              <div key={p.name} className={`${s.cell} ${s.part}`}>
                <span className={s.lab}>{p.name}</span>
                <p className={s.text}>{p.text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
