"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import s from "./team.module.css";

// ===========================================================================
// THE TEAM — the people behind the frame, and nothing else. On the black, a
// small label and the count over the wall: everyone once, five across and
// three down, each portrait the same size, in black and white, its corners
// rounded, a fine gap between them. They come up into place row by row as it
// comes into view; one pointed at brightens a little.
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
      <div className={s.head}>
        <h2 id="team-title" className={s.label}>
          The team
        </h2>
        <span className={s.label}>{String(PEOPLE.length).padStart(2, "0")}</span>
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
