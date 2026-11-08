"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import s from "./team.module.css";

// ===========================================================================
// THE TEAM — the people behind the frame, flat and even, on the black. On the
// left, as a title card: "The team", the line large and light, and a word on
// who they are. On the right, the wall: everyone once, five across and three
// down, each portrait the same size, in black and white, its corners rounded,
// a fine gap between them — no perspective, nothing bent. As it comes into
// view the portraits come up into place one after another; point at one and it
// lifts into the light while the rest step back.
// ===========================================================================

// the team, in black and white, each once (stand-ins cut from the old site's
// About page: replace each with the full-size original)
const PEOPLE = Array.from({ length: 15 }, (_, i) => `/about/team/team-${String(i + 1).padStart(2, "0")}.webp`);
const COLS = 5;

export default function Team() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);

  // in view: the portraits come up into place, once
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id="team" className={`${s.section} ${on || reduce ? s.on : ""}`} aria-labelledby="team-title">
      <div className={s.card}>
        <p className={s.label}>The team</p>
        <h2 id="team-title" className={s.title}>
          <span className={s.mask}>
            <span className={s.rise}>The people</span>
          </span>
          <span className={s.mask}>
            <span className={s.rise} style={{ transitionDelay: "0.12s" }}>
              behind the frame
            </span>
          </span>
        </h2>
        <p className={s.line}>Storytellers, filmmakers, strategists and producers — one crew, from the first idea to the final cut.</p>
        <p className={s.count}>
          {String(PEOPLE.length).padStart(2, "0")} <i>people</i>
        </p>
      </div>

      <ul className={s.wall}>
        {PEOPLE.map((src, i) => (
          <li
            key={src}
            className={s.tile}
            // they come up row by row, left to right
            style={{ "--delay": `${(Math.floor(i / COLS) * 0.12 + (i % COLS) * 0.06).toFixed(2)}s` } as React.CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" draggable={false} decoding="async" loading="lazy" />
          </li>
        ))}
      </ul>
    </section>
  );
}
