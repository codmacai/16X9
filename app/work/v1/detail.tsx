"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useScroll, useTransform, type Transition } from "framer-motion";
import { EASE } from "../_shared/chrome";
import { aFilmBy, stillFor, type Project } from "../_shared/data";
import d from "./detail.module.css";

// ===========================================================================
// A FILM'S PAGE — slides up over the open file (which steps back behind it).
// It scrolls on its own:
//   · the film, full bleed, playing; it sinks and slows as you scroll (parallax)
//     under the title, rising in letter by letter, and its facts on a hairline,
//   · the statement, its words lighting up as they come into view,
//   · the screen: the film framed, with a slowly turning "Play the film" seal;
//     it opens in the player,
//   · the credits,
//   · the next film in the drawer, its picture opening in the line on hover.
// "Next" swaps the page in place; back (or Esc) lets it slide down again.
// ===========================================================================

const IN: Transition = { type: "spring", stiffness: 70, damping: 17, mass: 1 };
const OUT: Transition = { duration: 0.6, ease: [0.7, 0, 0.84, 0] };
const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Detail({
  films,
  k,
  label,
  band,
  reduce,
  playing,
  onClose,
  onGo,
  onPlay,
}: {
  films: Project[];
  k: number;
  label: string;
  band: number;
  reduce: boolean;
  playing: boolean;
  onClose: () => void;
  onGo: (k: number) => void;
  onPlay: (film: Project, el: HTMLElement) => void;
}) {
  const film = films[k];
  const n = films.length;
  const next = films[(k + 1) % n];
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  const heroY = useTransform(scrollY, [0, 900], [0, 300]);
  const heroScale = useTransform(scrollY, [0, 900], [1.04, 1.16]);
  const heroDim = useTransform(scrollY, [0, 600], [0, 0.6]);

  // a new film: back to the top of its page, and keyboard scrolling lands here
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    scrollRef.current?.focus({ preventScroll: true });
  }, [k]);

  const words = film.title.toUpperCase().split(" ");
  const starts = words.map((_, i) => words.slice(0, i).join("").length);

  return (
    <motion.section
      className={d.sheet}
      style={{ top: band }}
      role="dialog"
      aria-label={film.title}
      initial={{ y: "100%" }}
      animate={{ y: 0, transition: reduce ? { duration: 0 } : IN }}
      exit={{ y: "100%", transition: reduce ? { duration: 0 } : OUT }}
    >
      <div ref={scrollRef} className={d.scroll} tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={film.no}
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: reduce ? 0 : 0.55, ease: EASE }}
          >
            {/* ================= the film ================= */}
            <header className={d.hero}>
              <motion.div className={d.heroMedia} style={reduce ? undefined : { y: heroY, scale: heroScale }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillFor(film.src)} alt="" />
                {!playing && !reduce && <video src={film.src} muted loop playsInline autoPlay preload="auto" aria-hidden="true" />}
              </motion.div>
              <motion.span className={d.heroDim} style={{ opacity: heroDim }} aria-hidden="true" />
              <span className={d.heroShade} aria-hidden="true" />

              <div className={d.heroTop}>
                <button type="button" className={d.back} onClick={onClose}>
                  <span className={d.backDisc} aria-hidden="true">
                    ←
                  </span>
                  <span>{label}</span>
                </button>
                <span className={d.heroIndex}>
                  Nº {film.no} <i>·</i> {pad2(k + 1)} / {pad2(n)}
                </span>
              </div>

              <div className={d.heroFoot}>
                <motion.span
                  className={d.kicker}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : 0.35 }}
                >
                  {aFilmBy(film.client)} · {label}
                </motion.span>
                <h2 className={d.title} aria-label={film.title}>
                  {words.map((w, wi) => (
                    <span key={wi} className={d.titleWord} aria-hidden="true">
                      {[...w].map((ch, ci) => (
                        <motion.span
                          key={ci}
                          className={d.letter}
                          initial={reduce ? false : { y: "106%" }}
                          animate={{ y: "0%" }}
                          transition={{ duration: 1, ease: EASE, delay: 0.3 + (starts[wi] + ci) * 0.03 }}
                        >
                          {ch}
                        </motion.span>
                      ))}
                    </span>
                  ))}
                </h2>
                <dl className={d.meta}>
                  {[
                    ["Client", film.client],
                    ["Year", String(film.year)],
                    ["Category", label],
                    ["Runtime", film.duration],
                  ].map(([dt, dd], i) => (
                    <motion.div
                      key={dt}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : 0.6 + i * 0.07 }}
                    >
                      <dt>{dt}</dt>
                      <dd>{dd}</dd>
                    </motion.div>
                  ))}
                </dl>
              </div>
              <span className={d.cue} aria-hidden="true">
                Scroll
                <i />
              </span>
            </header>

            {/* ================= the statement ================= */}
            <section className={d.block}>
              <span className={d.label}>The film</span>
              <p className={d.statement}>
                {film.synopsis.split(" ").map((w, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: reduce ? 1 : 0.12 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ root: scrollRef, once: true, amount: 1 }}
                    transition={{ duration: 0.6, ease: EASE, delay: (i % 7) * 0.035 }}
                  >
                    {w}{" "}
                  </motion.span>
                ))}
              </p>
            </section>

            {/* ================= the screen ================= */}
            <section className={d.watch}>
              <div className={d.watchHead}>
                <span className={d.label}>Watch</span>
                <span className={d.label}>
                  {film.title} · {film.duration}
                </span>
              </div>
              <button type="button" className={d.screen} onClick={(e) => onPlay(film, e.currentTarget)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillFor(film.src)} alt="" />
                <span className={d.screenShade} aria-hidden="true" />
                <span className={d.seal} aria-hidden="true">
                  <svg className={d.sealRing} viewBox="0 0 120 120">
                    <defs>
                      <path id={`ring-${film.no}`} d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
                    </defs>
                    <text>
                      {/* spaced to run exactly once round the circle (2π × 46) */}
                      <textPath href={`#ring-${film.no}`} textLength="287" lengthAdjust="spacing">
                        Play the film · Play the film ·
                      </textPath>
                    </text>
                  </svg>
                  <svg className={d.sealPlay} viewBox="0 0 12 14">
                    <path d="M0 0L12 7L0 14Z" />
                  </svg>
                </span>
                <span className={d.srOnly}>Play {film.title}</span>
              </button>
            </section>

            {/* ================= the credits ================= */}
            <section className={d.block}>
              <span className={d.label}>Credits</span>
              <dl className={d.credits}>
                {[
                  ["Client", film.client],
                  ["Production", "16X9 — Dubai"],
                  ["Category", label],
                  ["Year", String(film.year)],
                  ["Runtime", film.duration],
                  ["Format", "16:9 · Colour · Stereo"],
                ].map(([dt, dd], i) => (
                  <motion.div
                    key={dt}
                    initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ root: scrollRef, once: true, amount: 0.6 }}
                    transition={{ duration: 0.7, ease: EASE, delay: i * 0.05 }}
                  >
                    <dt>{dt}</dt>
                    <dd>{dd}</dd>
                  </motion.div>
                ))}
              </dl>
            </section>

            {/* ================= the next film ================= */}
            <button type="button" className={d.next} onClick={() => onGo((k + 1) % n)}>
              <span className={d.label}>Next film</span>
              <span className={d.nextTitle}>
                <span>{next.title}</span>
                <span className={d.nextReel} style={{ backgroundImage: `url(${stillFor(next.src)})` }} aria-hidden="true" />
              </span>
              <span className={d.nextMeta}>
                {aFilmBy(next.client)} · {next.year} · {next.duration} <i aria-hidden="true">→</i>
              </span>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
