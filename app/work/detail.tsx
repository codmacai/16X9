"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform, useVelocity, type Transition, type Variants } from "framer-motion";
import { EASE } from "./_shared/chrome";
import { posterFor, type Project } from "./_shared/data";
import Credits from "./credits";
import Edge from "./edge";
import { useHeavyScroll } from "./heavy";
import d from "./detail.module.css";

// ===========================================================================
// A FILM'S PAGE — slides up over the open file. It scrolls on its own, and
// everything on it is tied to that scroll (smoothed by a spring, so even a
// notchy mouse wheel moves it like film through a gate):
//   · the cover: black above, paper below, and the film's card standing in
//     the middle across the two — its still for a cover, its category and
//     name set on it. Behind it on the black, the film's words in big faint
//     rows that slide apart as you scroll; along the paper, a slow ticker.
//     The card lifts and settles back a touch as you go;
//   · a round cue that bobs, fades as you go, and takes you down;
//   · the screen: the film in an old television's curved glass, growing into
//     place as you reach it while the picture settles inside, and "Watch
//     behind the scenes" to open it in the player;
//   · the sign-off: black rises over the page by a dragged edge (edge.tsx) —
//     the middle leads, the sides trail, stretching with the scroll's speed —
//     while the page above sinks back; then the end credits roll by
//     themselves (credits.tsx);
//   · the next film in the drawer, rising over the credits the same way;
//     click it and its page slides up over this one.
// Opened from the line, the page doesn't slide up: the card stays exactly
// where it was and the page is built around it — the line falls away into
// the black, the paper rises from the foot of the screen to the card's
// waist, the words come up behind. The card never moves or changes size. Opened from "Next film", it slides up over the last.
// Back (or Esc) lets the page slide down again.
// ===========================================================================

const IN: Transition = { type: "spring", stiffness: 70, damping: 17, mass: 1 };
const OUT: Transition = { duration: 0.6, ease: [0.7, 0, 0.84, 0] };
const SMOOTH = { stiffness: 140, damping: 30, mass: 0.6 }; // how the scroll-tied motion follows the scroll
const ROWS = 5; // rows of words behind the card
const DRAG = { per: 34, max: 50, spring: { stiffness: 170, damping: 14, mass: 0.7 } }; // px/s of scroll per unit of bulge; the most it bulges

/** How the sheet leaves: down out of sight when closed; held in place while
    the next film's page slides up over it. */
const SHEET: Variants = {
  hidden: { y: "100%" },
  shown: { y: 0, transition: IN },
  gone: (mode: "close" | "next") => (mode === "next" ? { y: 0, transition: { duration: 1.2 } } : { y: "100%", transition: OUT }),
};

export default function Detail({
  films,
  k,
  label,
  band,
  layer,
  rect,
  fromLine,
  reduce,
  onClose,
  onNext,
  onPlay,
}: {
  films: Project[];
  k: number;
  label: string;
  band: number;
  /** stacking: each new page slides up over the last */
  layer: number;
  /** the front card's picture on screen: the cover card takes exactly its size and place */
  rect: DOMRect | null;
  /** opened from the line (the page builds around the card), or from "Next film" (it slides up) */
  fromLine: boolean;
  reduce: boolean;
  onClose: () => void;
  onNext: () => void;
  onPlay: (film: Project, el: HTMLElement) => void;
}) {
  const film = films[k];
  const next = films[(k + 1) % films.length];
  const still = posterFor(film);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLElement>(null);

  // the drag: how fast the page is scrolling down, sprung, for the rising edges
  const { scrollY } = useScroll({ container: scrollRef });
  const speed = useVelocity(scrollY);
  const pull = useTransform(speed, (v) => (reduce ? 0 : Math.min(DRAG.max, Math.max(0, v / DRAG.per))));
  const drag = useSpring(pull, DRAG.spring);
  // the credits rise on a calmer drag: an over-damped spring on a softly capped
  // speed, so their edge swells and eases flat as they fill the screen, never wobbling
  const calmPull = useTransform(speed, (v) => (reduce ? 0 : 34 * Math.tanh(Math.max(0, v) / 1600)));
  const calmDrag = useSpring(calmPull, { stiffness: 70, damping: 24, mass: 1, restDelta: 0.01 });

  // the page above each rising section sinks back as it's covered
  const { scrollYProgress: creditsIn } = useScroll({ container: scrollRef, target: creditsRef, offset: ["start end", "start start"] });
  const paperScale = useTransform(creditsIn, [0, 1], [1, 0.9]);
  const paperY = useTransform(creditsIn, [0, 1], ["0%", "14%"]);
  const paperFade = useTransform(creditsIn, [0, 1], [1, 0.35]);
  const { scrollYProgress: nextIn } = useScroll({ container: scrollRef, target: nextRef, offset: ["start end", "start start"] });
  const creditsRecede = {
    scale: useTransform(nextIn, [0, 1], [1, 0.9]),
    y: useTransform(nextIn, [0, 1], ["0%", "14%"]),
    opacity: useTransform(nextIn, [0, 1], [1, 0.35]),
  };

  // the cover: the rows slide apart, the card lifts and settles back
  const { scrollYProgress: heroRaw } = useScroll({ container: scrollRef, target: heroRef, offset: ["start start", "end start"] });
  const hero = useSpring(heroRaw, SMOOTH);
  const rowLeft = useTransform(hero, [0, 1], ["0%", "-22%"]);
  const rowRight = useTransform(hero, [0, 1], ["-12%", "10%"]);
  const cardY = useTransform(hero, [0, 1], ["0%", "-16%"]);
  const cueFade = useTransform(hero, [0, 0.15], [1, 0]);

  // the screen: grows into place as it comes up the page
  const { scrollYProgress: screenRaw } = useScroll({ container: scrollRef, target: screenRef, offset: ["start end", "center center"] });
  const screen = useSpring(screenRaw, SMOOTH);
  const screenScale = useTransform(screen, [0, 1], [0.76, 1]);
  const screenY = useTransform(screen, [0, 1], ["10%", "0%"]);
  const pictureScale = useTransform(screen, [0, 1], [1.4, 1.04]);
  const watchFade = useTransform(screen, [0.55, 1], [0, 1]);
  const watchScale = useTransform(screen, [0.55, 1], [0.7, 1]);

  // the cover card is the clicked card: same size, same place, never resized
  const anchored = fromLine && !!rect && !reduce;
  const [box] = useState(() => rect); // the card's rect at the moment of the click, kept
  const coverBox = box
    ? { left: box.left, top: box.top - band, width: box.width, height: box.height, marginLeft: 0 }
    : undefined;

  // the page has weight: the wheel sets where it's going, it glides there
  useHeavyScroll(scrollRef, reduce);

  // keyboard scrolling lands on the page
  useEffect(() => {
    scrollRef.current?.focus({ preventScroll: true });
  }, []);

  const toScreen = () => {
    const box = scrollRef.current;
    const el = screenRef.current;
    if (!box || !el) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: top - (box.clientHeight - el.offsetHeight) / 2, behavior: reduce ? "auto" : "smooth" });
  };

  const words = film.title.toUpperCase().split(" ");
  const starts = words.map((_, i) => words.slice(0, i).join("").length);
  const phrase = `${label}. ${film.client}. ${film.title}. ${film.year}. `;
  const tick = `New film · ${film.title} · ${film.client} · ${label} · ${film.year} · ${film.duration} · `;

  return (
    <motion.section
      className={`${d.sheet} ${anchored ? d.anchored : ""}`}
      style={{ top: band, zIndex: 5 + layer }}
      role="dialog"
      aria-label={film.title}
      variants={SHEET}
      initial={reduce || anchored ? false : "hidden"}
      animate="shown"
      exit="gone"
    >
      {/* the old television's glass: a rounded rectangle that bulges a little on every side */}
      <svg className={d.defs} aria-hidden="true">
        <defs>
          <clipPath id="tv-glass" clipPathUnits="objectBoundingBox">
            <path d="M0.045 0.018 Q0.5 -0.018 0.955 0.018 Q0.997 0.022 0.99 0.09 Q1.01 0.5 0.99 0.91 Q0.997 0.978 0.955 0.982 Q0.5 1.018 0.045 0.982 Q0.003 0.978 0.01 0.91 Q-0.01 0.5 0.01 0.09 Q0.003 0.022 0.045 0.018 Z" />
          </clipPath>
        </defs>
      </svg>

      <div ref={scrollRef} className={d.scroll} tabIndex={-1}>
        {/* ================= the cover ================= */}
        <header ref={heroRef} className={d.hero}>
          {/* black above, with the film's words in faint rows behind the card */}
          <motion.div
            className={d.night}
            initial={{ opacity: anchored ? 0 : 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            aria-hidden="true"
          >
            {Array.from({ length: ROWS }, (_, i) => (
              <motion.div
                key={i}
                className={d.row}
                style={{ marginLeft: `${-((i * 17) % 40)}%`, ...(reduce ? {} : { x: i % 2 ? rowRight : rowLeft }) }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.4, ease: EASE, delay: reduce ? 0 : 0.35 + i * 0.07 }}
              >
                {phrase.repeat(4)}
              </motion.div>
            ))}
          </motion.div>

          {/* the paper half of the cover: rises from the foot of the screen to the card's waist */}
          <motion.div
            className={d.dawn}
            initial={{ y: anchored ? "100%" : "0%" }}
            animate={{ y: "0%" }}
            transition={{ type: "spring", stiffness: 60, damping: 16, mass: 1, delay: 0.15 }}
            aria-hidden="true"
          />

          {/* along the top of the paper, a slow ticker */}
          <motion.div
            className={d.ticker}
            initial={{ opacity: anchored ? 0 : 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.8 }}
            aria-hidden="true"
          >
            <div className={d.tickerTrack}>
              <span>{tick.repeat(4)}</span>
              <span>{tick.repeat(4)}</span>
            </div>
          </motion.div>

          <motion.button
            type="button"
            className={d.back}
            onClick={onClose}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : 0.5 }}
          >
            <span className={d.backDisc} aria-hidden="true">
              ←
            </span>
            <span>All films</span>
          </motion.button>

          {/* the card, across the two */}
          <motion.div className={d.coverWrap} style={reduce ? coverBox : { ...coverBox, y: cardY }}>
            <motion.div
              className={d.cover}
              initial={reduce || anchored ? false : { y: 90, opacity: 0, rotate: -1.5 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.25 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={d.coverImg} src={still} alt="" draggable={false} />
              <span className={d.coverShade} aria-hidden="true" />
              <span className={d.coverType}>
                <motion.span
                  className={d.kicker}
                  initial={anchored ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.7 }}
                >
                  {label}
                </motion.span>
                <h2 className={d.title} aria-label={film.title}>
                  {words.map((w, wi) => (
                    <span key={wi} className={d.word} aria-hidden="true">
                      {[...w].map((ch, ci) => (
                        <motion.span
                          key={ci}
                          className={d.letter}
                          initial={reduce || anchored ? false : { y: "108%" }}
                          animate={{ y: "0%" }}
                          transition={{ duration: 1, ease: EASE, delay: 0.75 + (starts[wi] + ci) * 0.03 }}
                        >
                          {ch}
                        </motion.span>
                      ))}
                    </span>
                  ))}
                </h2>
              </span>
            </motion.div>
          </motion.div>

          <motion.button
            type="button"
            className={d.cue}
            onClick={toScreen}
            style={reduce ? undefined : { opacity: cueFade }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18, delay: reduce ? 0 : 1.1 }}
            aria-label="Down to the film"
          >
            <span className={d.cueArrow} aria-hidden="true">
              ↓
            </span>
          </motion.button>
        </header>

        {/* ================= the screen ================= */}
        <motion.div className={d.paper} style={reduce ? undefined : { scale: paperScale, y: paperY, opacity: paperFade }}>
          <div ref={screenRef} className={d.screenWrap}>
            <motion.button
              type="button"
              className={d.screen}
              style={reduce ? undefined : { scale: screenScale, y: screenY }}
              onClick={(e) => onPlay(film, e.currentTarget)}
              aria-label={`Watch behind the scenes: ${film.title}`}
            >
              <span className={d.glass}>
                <motion.span className={d.picture} style={reduce ? undefined : { scale: pictureScale }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={still} alt="" draggable={false} />
                </motion.span>
                <span className={d.vignette} aria-hidden="true" />
                <span className={d.sheen} aria-hidden="true" />
              </span>
              {/* in the brand's own colours: a paper disc, an ink play mark, paper type,
                  and the live dot from the band's clock */}
              <motion.span className={d.watch} style={reduce ? undefined : { opacity: watchFade, scale: watchScale }} aria-hidden="true">
                <span className={d.playDisc}>
                  <svg className={d.play} viewBox="0 0 24 28">
                    <path d="M3 2.2 Q3 0.6 4.4 1.4 L22 12.4 Q23.4 14 22 15.6 L4.4 26.6 Q3 27.4 3 25.8 Z" />
                  </svg>
                </span>
                <span className={d.action}>
                  <i className={d.dot} /> Action
                </span>
                <span className={d.watchLabel}>Watch behind the scenes</span>
              </motion.span>
            </motion.button>
          </div>
        </motion.div>

        {/* ================= the end credits ================= */}
        <Credits
          film={film}
          label={label}
          container={scrollRef}
          sectionRef={creditsRef}
          drag={calmDrag}
          recede={creditsRecede}
          reduce={reduce}
        />

        {/* ================= the next film ================= */}
        <section ref={nextRef} className={d.next} aria-label="Next film">
          <Edge drag={drag} color="#f7f2ee" />
          <span className={d.nextKicker}>Next film · {label}</span>
          <button type="button" className={d.nextLink} onClick={onNext}>
            <span className={d.nextTitle}>
              <span className={d.nextName}>{next.title}</span>
              <span className={d.nextReel} style={{ backgroundImage: `url(${posterFor(next)})` }} aria-hidden="true" />
            </span>
            <span className={d.nextMeta}>
              {next.client} · {next.year} · {next.duration} <i aria-hidden="true">→</i>
            </span>
          </button>
        </section>
      </div>
    </motion.section>
  );
}
