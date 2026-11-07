"use client";

import { useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { CATEGORIES, type Project } from "./_shared/data";
import s from "./story.module.css";

// ===========================================================================
// THE CASE — on a film's page, above the screen, in the site's own hand: ink
// and hairlines on the paper, one screen tall. The project's name set large
// and light; under it its particulars side by side in columns — who directed
// it, its category, year, runtime and format — each over a hairline that draws
// across as it comes in; and last the case in three numbered parts: the
// client, the task, the solution.
// Every film has all three parts of its case: one whose case isn't written yet
// has one drafted from what we know of it (caseOf).
// ===========================================================================

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
  for (const g of film.credits ?? []) for (const r of g.rows) if (r.role && /^direct/i.test(r.role)) return r.names.join(", ");
  return "16×9 & Beyond";
}

export default function Story({ film, root, reduce }: { film: Project; root: RefObject<HTMLElement | null>; reduce: boolean }) {
  const parts = caseOf(film);
  const kind = CATEGORIES.find((c) => c.id === film.category)?.label ?? "Film";
  const specs = [
    { label: "Direction", value: directionOf(film) },
    { label: "Category", value: kind },
    film.year ? { label: "Year", value: String(film.year) } : null,
    film.duration ? { label: "Runtime", value: film.duration } : null,
    { label: "Format", value: film.format === "9x16" ? "9:16" : "16:9" },
  ].filter((f): f is { label: string; value: string } => !!f);

  // everything on it goes once, as it comes into view (CSS, .on)
  const [seen, setSeen] = useState(false);
  const on = seen || reduce;

  return (
    <motion.section
      className={`${s.story} ${on ? s.on : ""}`}
      aria-label="The case"
      onViewportEnter={() => setSeen(true)}
      viewport={{ root, once: true, amount: 0.2 }}
    >
      {/* the project, as a spec sheet */}
      <div className={s.sheet}>
        <span className={s.lab}>The project</span>
        <h3 className={s.title}>
          <span className={s.mask}>
            <span className={s.rise}>{film.title}</span>
          </span>
        </h3>

        <dl className={s.specs} style={{ "--n": specs.length } as React.CSSProperties}>
          {specs.map((f, i) => (
            <div key={f.label} className={s.spec} style={{ "--i": i } as React.CSSProperties}>
              <i className={s.rule} aria-hidden="true" />
              <dt className={s.lab}>{f.label}</dt>
              <dd className={s.value}>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className={s.case} style={{ "--i": specs.length } as React.CSSProperties}>
          <i className={s.rule} aria-hidden="true" />
          <span className={s.lab}>The case</span>
          <ol className={s.parts}>
            {parts.map((p, i) => (
              <li key={p.name} className={s.part} style={{ "--j": i } as React.CSSProperties}>
                <span className={s.partNo}>{String(i + 1).padStart(2, "0")}</span>
                <h4 className={s.partName}>{p.name}</h4>
                <p className={s.text}>{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </motion.section>
  );
}
