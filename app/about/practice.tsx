"use client";

import { useRef } from "react";
import Curve from "./curve";
import Files from "./files";
import s from "./practice.module.css";

// ===========================================================================
// PRACTICE — how we work. Paper again, rising over the black of the team's
// wall by its arched edge (curve.tsx): two ways, told as time — Making a film
// with an end, Partnership a series that runs on (files.tsx).
// ===========================================================================

export default function Practice() {
  const ref = useRef<HTMLElement>(null);
  return (
    <section ref={ref} id="how-we-work" className={s.practice} aria-label="How we work">
      <Curve target={ref} color="#f7f2ee" />
      <Files />
    </section>
  );
}
