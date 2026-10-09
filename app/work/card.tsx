"use client";

import { type Ref } from "react";
import { motion } from "framer-motion";
import { EASE } from "./_shared/chrome";
import { stillFor, type Project } from "./_shared/data";
import s from "./file.module.css";

// ===========================================================================
// CARD — one film: the picture, rounded, with the category and the title set
// over its foot, and the year, client and runtime beneath it.
//
// It's drawn twice, one over the other:
//   · soft — out of focus and in shadow, as the films either side are seen.
//     Its blur is fixed, so it's worked out once and never again.
//   · focus — sharp, in colour: the poster, never the film. FileView sets its opacity every
//     frame from how close the card is to the front, so moving along the line
//     is a focus pull: the film arriving sharpens and lights up, the one
//     leaving goes soft. Only the focus picture drifts against the move.
// ===========================================================================

const FACTS = (f: Project) =>
  [
    ["Year", String(f.year)],
    ["Client", f.client],
    ["Runtime", f.duration],
  ] as const;

export default function Card({
  film,
  label,
  active,
  reduce,
  delay,
  cardRef,
  focusRef,
  artRef,
  onOpen,
  onHover,
}: {
  film: Project;
  label: string;
  active: boolean;
  reduce: boolean;
  /** hold the title back this long (while the cards are still rising in) */
  delay: number;
  cardRef: Ref<HTMLDivElement>;
  focusRef: Ref<HTMLDivElement>;
  artRef: Ref<HTMLDivElement>;
  onOpen: () => void;
  onHover: (on: boolean) => void;
}) {
  const still = stillFor(film.src);
  const words = film.title.toUpperCase().split(" ");
  const starts = words.map((_, i) => words.slice(0, i).join("").length); // each word's first letter, for the stagger

  return (
    <div
      ref={cardRef}
      className={`${s.card} ${active ? s.cardOn : ""}`}
      role="button"
      tabIndex={active ? 0 : -1}
      aria-label={active ? `${film.title}: open the film` : `Show ${film.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      {/* out of focus */}
      <div className={s.soft} aria-hidden="true">
        <div className={s.media}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.still} src={still} alt="" draggable={false} decoding="async" />
          <span className={s.shade} />
          <span className={s.titleBlock}>
            <span className={s.kicker}>{label}</span>
            <span className={s.name}>{film.title}</span>
          </span>
        </div>
        <dl className={s.facts}>
          {FACTS(film).map(([dt, dd]) => (
            <div key={dt}>
              <dt>{dt}</dt>
              <dd>{dd}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* in focus */}
      <div ref={focusRef} className={s.focus}>
        <div className={s.media}>
          <div ref={artRef} className={s.art}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={s.still} src={still} alt="" draggable={false} decoding="async" />
          </div>
          <span className={s.shade} aria-hidden="true" />
          <span className={s.titleBlock}>
            <span className={s.kicker}>{label}</span>
            {/* remounted when it comes to the front, so the letters rise in again */}
            <h3 key={active ? "on" : "off"} className={s.name} aria-label={film.title}>
              {words.map((w, wi) => (
                <span key={wi} className={s.word} aria-hidden="true">
                  {[...w].map((ch, ci) => (
                    <motion.span
                      key={ci}
                      className={s.letter}
                      initial={active && !reduce ? { y: "106%" } : false}
                      animate={{ y: "0%" }}
                      transition={{ duration: 0.85, ease: EASE, delay: delay + 0.06 + (starts[wi] + ci) * 0.025 }}
                    >
                      {ch}
                    </motion.span>
                  ))}
                </span>
              ))}
            </h3>
          </span>
        </div>
        <dl className={s.facts}>
          {FACTS(film).map(([dt, dd], i) => (
            <motion.div
              key={`${dt}-${active}`}
              initial={active && !reduce ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: delay + 0.3 + i * 0.06 }}
            >
              <dt>{dt}</dt>
              <dd>{dd}</dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </div>
  );
}
