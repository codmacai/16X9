"use client";

import { type Ref } from "react";
import { motion } from "framer-motion";
import { EASE } from "../_shared/chrome";
import { aFilmBy, stillFor, type Project } from "../_shared/data";
import s from "./file.module.css";

// ===========================================================================
// POSTER — one film as a one-sheet: the picture full bleed in a hairline
// frame; "16X9 presents" and its number across the top; at the foot the
// credit line, the title in the menu's light wide capitals, a condensed
// billing block, and the year, client and runtime on a hairline. The one in
// front is in colour and, once the strip has come to rest on it, plays.
// Coming forward, its title rises in letter by letter.
// FileView moves the poster (cardRef), its picture (artRef, for the parallax)
// and its veil (veilRef) every frame, straight on the DOM.
// ===========================================================================

export default function Poster({
  film,
  label,
  active,
  play,
  reduce,
  delay,
  cardRef,
  artRef,
  veilRef,
  onOpen,
  onHover,
}: {
  film: Project;
  label: string;
  active: boolean;
  play: boolean;
  reduce: boolean;
  /** hold the title back this long (while the posters are still rising in) */
  delay: number;
  cardRef: Ref<HTMLDivElement>;
  artRef: Ref<HTMLDivElement>;
  veilRef: Ref<HTMLSpanElement>;
  onOpen: (el: HTMLElement) => void;
  onHover: (on: boolean) => void;
}) {
  const still = stillFor(film.src);
  const words = film.title.toUpperCase().split(" ");
  const starts = words.map((_, i) => words.slice(0, i).join("").length); // each word's first letter, for the stagger

  return (
    <div
      ref={cardRef}
      className={`${s.poster} ${active ? s.posterOn : ""}`}
      role="button"
      tabIndex={active ? 0 : -1}
      aria-label={active ? `${film.title}: open the film` : `Show ${film.title}`}
      onClick={(e) => onOpen(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(e.currentTarget);
        }
      }}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <div className={s.art}>
        <div ref={artRef} className={s.artInner}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.artGray} src={still} alt="" draggable={false} decoding="async" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.artColour} src={still} alt="" draggable={false} decoding="async" />
          {play && <video className={s.artVideo} src={film.src} muted loop playsInline autoPlay preload="auto" aria-hidden="true" />}
        </div>
      </div>
      <span className={s.grade} aria-hidden="true" />
      <span className={s.frame} aria-hidden="true" />

      <div className={s.posterTop} aria-hidden="true">
        <span>16X9 presents</span>
        <span>Nº {film.no}</span>
      </div>

      <div className={s.posterFoot}>
        <span className={s.credit}>{aFilmBy(film.client)}</span>
        {/* remounted when it comes forward, so the letters rise in again */}
        <h3 key={active ? "on" : "off"} className={s.name} aria-label={film.title}>
          {words.map((w, wi) => (
            <span key={wi} className={s.nameWord} aria-hidden="true">
              {[...w].map((ch, ci) => (
                <motion.span
                  key={ci}
                  className={s.letter}
                  initial={active && !reduce ? { y: "108%" } : false}
                  animate={{ y: "0%" }}
                  transition={{ duration: 0.8, ease: EASE, delay: delay + 0.05 + (starts[wi] + ci) * 0.024 }}
                >
                  {ch}
                </motion.span>
              ))}
            </span>
          ))}
        </h3>
        <p className={s.billing} aria-hidden="true">
          16X9 presents {aFilmBy(film.client).toLowerCase()} · {film.title} · {film.line} · a 16X9 production · made in Dubai · {label} ·{" "}
          {film.year}
        </p>
        <dl className={s.facts}>
          <div>
            <dt>Year</dt>
            <dd>{film.year}</dd>
          </div>
          <div>
            <dt>Client</dt>
            <dd>{film.client}</dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>{film.duration}</dd>
          </div>
        </dl>
      </div>

      <span ref={veilRef} className={s.veil} aria-hidden="true" />
    </div>
  );
}
