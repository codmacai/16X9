"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import s from "./files.module.css";

// ===========================================================================
// HOW WE WORK — two ways, told as time. Making is a film: it has a start and
// an end. Partnership is a series: it keeps going. Each is a row on the paper
// — its number, its name set large, what kind of work it is — over a hairline
// that draws itself across as the row comes into view, its three points
// landing on it one after another. Making's line closes with an end mark, as
// a film's does; Partnership's never ends — past its last point it runs on
// off the page as a fine dashed line, always moving. Under each, the line
// that sums it up. Point at a point and it comes forward, the others step
// back. On a phone the lines run down the page instead of across.
// ===========================================================================

const WAYS = [
  {
    no: "01",
    name: "Making",
    kind: "A film",
    span: "Start to delivery",
    points: ["Production planning", "Content production", "Execution and delivery"],
    line: "We build the team and approach around the project.",
    ends: true,
  },
  {
    no: "02",
    name: "Partnership",
    kind: "A series",
    span: "Ongoing",
    points: ["Creative team extension", "Ongoing collaboration", "Long-term relationships"],
    line: "We develop a shared understanding that grows over time.",
    ends: false,
  },
] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Files() {
  const reduce = !!useReducedMotion();
  return (
    <div className={s.how}>
      <header className={s.top}>
        <h2 className={s.label}>How we work</h2>
        <p className={s.lede}>
          A film has an end. A series keeps going.
          <br />
          We work both ways.
        </p>
      </header>
      {WAYS.map((w) => (
        <Way key={w.no} way={w} reduce={reduce} />
      ))}
    </div>
  );
}

function Way({ way: w, reduce }: { way: (typeof WAYS)[number]; reduce: boolean }) {
  // everything in the row goes once, as it comes into view (CSS, .on)
  const [seen, setSeen] = useState(false);
  const on = seen || reduce;
  return (
    <motion.article
      className={`${s.way} ${w.ends ? s.film : s.series} ${on ? s.on : ""}`}
      onViewportEnter={() => setSeen(true)}
      viewport={{ once: true, amount: 0.35 }}
    >
      <span className={s.no}>{w.no}</span>
      <div className={s.main}>
        <header className={s.head}>
          <h3 className={s.name}>
            <span className={s.mask}>
              <span className={s.nameIn}>{w.name}</span>
            </span>
          </h3>
          <p className={s.kind}>
            <span>{w.kind}</span>
            <i aria-hidden="true" />
            <span>{w.span}</span>
          </p>
        </header>

        {/* its time: a hairline drawn across, its points landing on it; an end, or none */}
        <div className={s.track}>
          <i className={s.line} aria-hidden="true" />
          {w.ends ? <i className={s.cap} aria-hidden="true" /> : <i className={s.more} aria-hidden="true" />}
          <ol className={s.steps}>
            {w.points.map((p, i) => (
              <li key={p} style={{ "--i": i } as React.CSSProperties}>
                <i className={s.node} aria-hidden="true" />
                <span className={s.stepNo}>{pad2(i + 1)}</span>
                <span className={s.stepName}>{p}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className={s.sum}>{w.line}</p>
      </div>
    </motion.article>
  );
}
