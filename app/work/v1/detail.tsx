"use client";

import { useEffect, useRef } from "react";
import { motion, useScroll, useSpring, useTransform, type Transition } from "framer-motion";
import { EASE } from "../_shared/chrome";
import { stillFor, type Project } from "../_shared/data";
import d from "./detail.module.css";

// ===========================================================================
// A FILM'S PAGE — slides up over the open file, on paper. It scrolls on its
// own, and everything on it is tied to that scroll (smoothed by a spring, so
// even a notchy mouse wheel moves it like film through a gate):
//   · the still, full width — pinned while the paper slides up over it; as
//     it's covered it sinks, swells a touch and goes dark;
//   · on the paper, the category, the film's name (rising in letter by
//     letter) and a round cue that bobs, fades as you go, and takes you down;
//   · the screen: the film in an old television's curved glass, growing into
//     place as you reach it while the picture settles inside, and "Watch film"
//     to open it in the player.
// Back (or Esc) lets the page slide down again.
// ===========================================================================

const IN: Transition = { type: "spring", stiffness: 70, damping: 17, mass: 1 };
const OUT: Transition = { duration: 0.6, ease: [0.7, 0, 0.84, 0] };
const SMOOTH = { stiffness: 140, damping: 30, mass: 0.6 }; // how the scroll-tied motion follows the scroll

export default function Detail({
  films,
  k,
  label,
  band,
  reduce,
  onClose,
  onPlay,
}: {
  films: Project[];
  k: number;
  label: string;
  band: number;
  reduce: boolean;
  onClose: () => void;
  onPlay: (film: Project, el: HTMLElement) => void;
}) {
  const film = films[k];
  const still = stillFor(film.src);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  // the still: pinned, and covered by the paper as you scroll
  const { scrollYProgress: heroRaw } = useScroll({ container: scrollRef, target: heroRef, offset: ["start start", "end start"] });
  const hero = useSpring(heroRaw, SMOOTH);
  const heroY = useTransform(hero, [0, 1], ["0%", "24%"]);
  const heroScale = useTransform(hero, [0, 1], [1.02, 1.16]);
  const heroDim = useTransform(hero, [0, 1], [0, 0.7]);
  const cueFade = useTransform(hero, [0, 0.2], [1, 0]);
  const introY = useTransform(hero, [0, 1], ["0%", "-30%"]); // the name lifts a little faster than the page

  // the screen: grows into place as it comes up the page
  const { scrollYProgress: screenRaw } = useScroll({ container: scrollRef, target: screenRef, offset: ["start end", "center center"] });
  const screen = useSpring(screenRaw, SMOOTH);
  const screenScale = useTransform(screen, [0, 1], [0.76, 1]);
  const screenY = useTransform(screen, [0, 1], ["10%", "0%"]);
  const pictureScale = useTransform(screen, [0, 1], [1.4, 1.04]);
  const watchFade = useTransform(screen, [0.55, 1], [0, 1]);
  const watchScale = useTransform(screen, [0.55, 1], [0.7, 1]);

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
      {/* the old television's glass: a rounded rectangle that bulges a little on every side */}
      <svg className={d.defs} aria-hidden="true">
        <defs>
          <clipPath id="tv-glass" clipPathUnits="objectBoundingBox">
            <path d="M0.045 0.018 Q0.5 -0.018 0.955 0.018 Q0.997 0.022 0.99 0.09 Q1.01 0.5 0.99 0.91 Q0.997 0.978 0.955 0.982 Q0.5 1.018 0.045 0.982 Q0.003 0.978 0.01 0.91 Q-0.01 0.5 0.01 0.09 Q0.003 0.022 0.045 0.018 Z" />
          </clipPath>
        </defs>
      </svg>

      <div ref={scrollRef} className={d.scroll} tabIndex={-1}>
        {/* ================= the still ================= */}
        <header ref={heroRef} className={d.hero}>
          <motion.div className={d.heroMedia} style={reduce ? undefined : { y: heroY, scale: heroScale }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={still} alt="" draggable={false} />
          </motion.div>
          <motion.span className={d.heroDim} style={reduce ? undefined : { opacity: heroDim }} aria-hidden="true" />
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
        </header>

        {/* ================= the paper ================= */}
        <div className={d.paper}>
          <motion.div className={d.intro} style={reduce ? undefined : { y: introY }}>
            <motion.span
              className={d.kicker}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.35 }}
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
                      initial={reduce ? false : { y: "108%" }}
                      animate={{ y: "0%" }}
                      transition={{ duration: 1, ease: EASE, delay: 0.42 + (starts[wi] + ci) * 0.03 }}
                    >
                      {ch}
                    </motion.span>
                  ))}
                </span>
              ))}
            </h2>
            <motion.button
              type="button"
              className={d.cue}
              onClick={toScreen}
              style={reduce ? undefined : { opacity: cueFade }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18, delay: reduce ? 0 : 0.9 }}
              aria-label="Down to the film"
            >
              <span className={d.cueArrow} aria-hidden="true">
                ↓
              </span>
            </motion.button>
          </motion.div>

          {/* ================= the screen ================= */}
          <div ref={screenRef} className={d.screenWrap}>
            <motion.button
              type="button"
              className={d.screen}
              style={reduce ? undefined : { scale: screenScale, y: screenY }}
              onClick={(e) => onPlay(film, e.currentTarget)}
              aria-label={`Watch ${film.title}`}
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
                <span className={d.watchLabel}>Watch film</span>
              </motion.span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
