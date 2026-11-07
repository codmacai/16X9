"use client";

import Files from "./files";
import s from "./practice.module.css";

// ===========================================================================
// PRACTICE — how we work, on the paper, following the team as you scroll (no
// edge rising over it): two ways, told as time — Making a film with an end,
// Partnership a series that runs on (files.tsx).
// ===========================================================================

export default function Practice() {
  return (
    <section id="how-we-work" className={s.practice} aria-label="How we work">
      <Files />
    </section>
  );
}
