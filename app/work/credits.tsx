"use client";

import { useState, type RefObject } from "react";
import { motion } from "framer-motion";
import type { Project } from "./_shared/data";
import d from "./detail.module.css";
import s from "./credits.module.css";

// ===========================================================================
// SIGN-OFF — the film's credits, set as a poster's billing block, on the
// paper, one screen. "A 16×9 & Beyond film" small over the film's title, set
// large and light; then, under a hairline, the credits run on as one centred
// block of type — each role small and wide-set, its names after it in
// capitals, one credit after another as a poster sets them — and at the foot
// the studio's mark with the client and year. Only the credits: no addresses,
// no numbers. As it comes into view the title rises out of its line, the
// hairline draws out from the middle and the block comes up after them.
// ===========================================================================

type Credit = { role: string; names: string[] };

/** every credit, a role and its names (a group's names without a role go under the group's own
 *  name); the client, set under the title, isn't repeated */
function creditsOf(film: Project): Credit[] {
  const out: Credit[] = [];
  for (const g of film.credits ?? []) {
    for (const r of g.rows) {
      if (r.role === "Client") continue;
      out.push({ role: r.role ?? g.heading, names: r.names });
    }
  }
  return out;
}

export default function Credits({
  film,
  container,
  sectionRef,
  reduce,
}: {
  film: Project;
  label?: string;
  container: RefObject<HTMLDivElement | null>;
  sectionRef: RefObject<HTMLElement | null>;
  reduce: boolean;
}) {
  const [seen, setSeen] = useState(false);
  const credits = creditsOf(film);

  return (
    <motion.section
      ref={sectionRef}
      className={`${d.signoff} ${s.signoff} ${seen || reduce ? s.seen : ""}`}
      aria-label={`End credits: ${film.title}`}
      onViewportEnter={() => setSeen(true)}
      viewport={{ root: container, once: true, amount: 0.35 }}
    >
      <p className={s.kicker}>A 16×9 &amp; Beyond film</p>
      <h2 className={s.title}>
        <span className={s.mask}>
          <span className={s.rise}>{film.title}</span>
        </span>
      </h2>
      <p className={s.for}>{[film.client && `for ${film.client}`, film.year].filter(Boolean).join(" · ")}</p>

      <i className={s.rule} aria-hidden="true" />

      {/* the billing block: one credit after another, centred, as a poster sets them */}
      <p className={s.block}>
        {credits.map((c, i) => (
          <span key={i} className={s.credit}>
            <span className={s.role}>{c.role}</span> <span className={s.names}>{c.names.join(" · ")}</span>
          </span>
        ))}
      </p>

      <div className={s.foot}>
        <span className={s.mark} role="img" aria-label="16x9 & Beyond" />
      </div>
    </motion.section>
  );
}
