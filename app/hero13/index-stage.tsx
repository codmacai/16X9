"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { motion } from "framer-motion";
import { FORMATS, Ratio, type FormatKey } from "./formats";
import styles from "./home.module.css";

export const EASE = [0.16, 1, 0.3, 1] as const;
export const EASE_CINE = [0.76, 0, 0.24, 1] as const;
// The entrance, in seconds: the outline frame traces round, the mark rises
// into it, lifts out as the frame un-traces; the names rise.
export const INTRO = { draw: 0.2, letters: 0.95, leave: 2.5, names: 3.1 };

// ===========================================================================
// INTRO — the mark, on the white, in outline. A hairline frame traces itself
// round (top, right, bottom, left); 1, 6, X, 9 rise into it in ink and
// & BEYOND follows; then the letters lift out and the frame un-traces. No
// fill, no zoom, nothing behind it.
// ===========================================================================
const MARK_CHARS = ["1", "6", "X", "9"];
const EDGES = ["top", "right", "bottom", "left"] as const;

function IntroMark() {
  // 0 in, 1 out
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOut(true), INTRO.leave * 1000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className={styles.intro} aria-hidden="true">
      {EDGES.map((side, i) => {
        const across = side === "top" || side === "bottom";
        return (
          <motion.span
            key={side}
            className={`${styles.introEdge} ${styles[`introEdge_${side}`]}`}
            initial={across ? { scaleX: 0 } : { scaleY: 0 }}
            animate={across ? { scaleX: out ? 0 : 1 } : { scaleY: out ? 0 : 1 }}
            transition={
              out
                ? { delay: 0.25 + (3 - i) * 0.08, duration: 0.45, ease: EASE_CINE }
                : { delay: INTRO.draw + i * 0.2, duration: 0.4, ease: EASE_CINE }
            }
          />
        );
      })}
      <span className={styles.introMark}>
        {MARK_CHARS.map((c, i) => (
          <span key={i} className={styles.introMask}>
            <motion.span
              className={styles.introChar}
              initial={{ y: "112%" }}
              animate={{ y: out ? "-112%" : "0%" }}
              transition={
                out
                  ? { delay: i * 0.04, duration: 0.5, ease: EASE_CINE }
                  : { delay: INTRO.letters + i * 0.07, duration: 0.8, ease: EASE }
              }
            >
              {c}
            </motion.span>
          </span>
        ))}
        <span className={`${styles.introMask} ${styles.introSub}`}>
          <motion.span
            className={styles.introChar}
            initial={{ y: "112%" }}
            animate={{ y: out ? "-112%" : "0%" }}
            transition={
              out ? { delay: 0.16, duration: 0.5, ease: EASE_CINE } : { delay: INTRO.letters + 0.4, duration: 0.8, ease: EASE }
            }
          >
            &amp; BEYOND
          </motion.span>
        </span>
      </span>
    </div>
  );
}

// ===========================================================================
// THE INDEX — the white page, with 16x9 / 9x16 / BEYOND set as one quiet
// line at its centre. Pointing at a word fades in a film in that word's
// format behind the line: a 16:9 frame, a 9:16 frame, or, for Beyond, the
// whole screen. The words are ink on the paper and paper on the film: a
// second, paper-coloured copy of the line is clipped to the frame showing.
// Only opacity and a clip change, so it stays smooth; the wall behind isn't
// drawn at all while the index is up. Clicking a word opens the wall.
// ===========================================================================
type IndexFilm = { key: FormatKey; desk: string; small: string; poster: string; smallPoster: string };
const INDEX_FILMS: IndexFilm[] = [
  { key: "16x9", desk: "/hero14/films/wide-1080.mp4", small: "/hero14/films/wide-540.mp4", poster: "/hero14/films/wide.webp", smallPoster: "/hero14/films/wide-540.webp" },
  { key: "9x16", desk: "/hero14/films/vertical-m.mp4", small: "/hero14/films/vertical-m.mp4", poster: "/hero14/films/vertical-m.webp", smallPoster: "/hero14/films/vertical-m.webp" },
  { key: "beyond", desk: "/hero14/films/beyond-1080.mp4", small: "/hero14/films/beyond-m.mp4", poster: "/hero14/films/beyond.webp", smallPoster: "/hero14/films/beyond-m.webp" },
];
const FADE_MS = 450; // the films' crossfade, matches .film in the CSS
const subscribePortrait = (cb: () => void) => {
  const mq = window.matchMedia("(max-aspect-ratio: 1/1)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** The line of words. `ink` is the real, interactive one; the other is its paper-coloured twin. */
function Names({
  ink,
  show,
  base,
  reduce,
  ready,
  active,
  wordRefs,
  onHover,
  onOpen,
}: {
  ink: boolean;
  show: boolean;
  base: number;
  reduce: boolean;
  ready: boolean;
  active: FormatKey | null;
  wordRefs?: RefObject<Partial<Record<FormatKey, HTMLSpanElement | null>>>;
  onHover?: (k: FormatKey) => void;
  onOpen?: (k: FormatKey) => void;
}) {
  const rise = (delay: number) => (show ? { y: "0%", transition: { duration: 0.9, ease: EASE, delay } } : undefined);
  return (
    <div className={`${styles.names} ${ink ? "" : styles.namesPaper}`} aria-hidden={ink ? undefined : true}>
      {FORMATS.map((f, i) => {
        const on = active === f.key;
        const fade = { opacity: !show ? 0 : active && !on ? 0.25 : 1 };
        const word = (
          <span className={styles.nameMask}>
            <motion.span
              ref={
                ink && wordRefs
                  ? (el: HTMLSpanElement | null) => {
                      wordRefs.current[f.key] = el;
                    }
                  : undefined
              }
              className={styles.nameWord}
              initial={ink && !reduce ? { y: "112%" } : false}
              animate={ink ? rise(base + i * 0.08) : undefined}
            >
              <Ratio text={f.label} className={styles.fmtX} />
            </motion.span>
          </span>
        );
        const corners = (["tl", "tr", "bl", "br"] as const).map((c) => (
          <motion.span
            key={c}
            className={`${styles.finder} ${styles[`finder_${c}`]}`}
            aria-hidden="true"
            initial={false}
            animate={{ opacity: on ? 1 : 0, x: on ? 0 : c.includes("l") ? -6 : 6, y: on ? 0 : c.includes("t") ? -6 : 6 }}
            transition={{ duration: 0.45, ease: EASE }}
          />
        ));
        return (
          <Fragment key={f.key}>
            {i > 0 && (
              <span className={styles.slashMask} aria-hidden="true">
                <motion.span
                  className={styles.slash}
                  initial={ink && !reduce ? { y: "112%" } : false}
                  animate={{ ...(ink ? rise(base + 0.2 + i * 0.06) : {}), opacity: !show ? 0 : active ? 0.25 : 1 }}
                  transition={{ opacity: { duration: 0.45 } }}
                >
                  /
                </motion.span>
              </span>
            )}
            {ink ? (
              <motion.button
                type="button"
                className={styles.name}
                data-fmt={f.key}
                aria-label={`${f.label}: ${f.line}`}
                disabled={!ready || !show}
                style={{ pointerEvents: show ? "auto" : "none" }}
                initial={false}
                animate={fade}
                transition={{ duration: 0.45, ease: EASE }}
                onPointerEnter={(e) => e.pointerType === "mouse" && onHover?.(f.key)}
                onFocus={(e) => e.currentTarget.matches(":focus-visible") && onHover?.(f.key)}
                onClick={() => onOpen?.(f.key)}
              >
                {word}
                {corners}
              </motion.button>
            ) : (
              <motion.span className={styles.name} initial={false} animate={fade} transition={{ duration: 0.45, ease: EASE }}>
                {word}
                {corners}
              </motion.span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

export default function IndexStage({
  open,
  show,
  first,
  reduce,
  ready,
  active,
  wordRefs,
  onHover,
  onOpen,
}: {
  /** the wall is open: the index steps aside */
  open: boolean;
  /** the words are up (not under the menu, not on the open wall) */
  show: boolean;
  /** the first time, the words wait for the mark to leave */
  first: boolean;
  reduce: boolean;
  ready: boolean;
  /** the format pointed at (or, on touch, the one taking its turn) */
  active: FormatKey | null;
  wordRefs: RefObject<Partial<Record<FormatKey, HTMLSpanElement | null>>>;
  onHover: (k: FormatKey | null) => void;
  onOpen: (k: FormatKey) => void;
}) {
  const portrait = useSyncExternalStore(subscribePortrait, () => window.matchMedia("(max-aspect-ratio: 1/1)").matches, () => false);
  const base = reduce ? 0 : first ? INTRO.names : 0.1;
  const frameRefs = useRef<Partial<Record<FormatKey, HTMLDivElement | null>>>({});
  const videoRefs = useRef<Partial<Record<FormatKey, HTMLVideoElement | null>>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const twinRef = useRef<HTMLDivElement>(null);

  // the mark leaves the page once its entrance has played
  const [intro, setIntro] = useState(!reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setIntro(false), (INTRO.names + 0.3) * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // the film of the word pointed at plays; the others stop once they've faded out
  useEffect(() => {
    const v = active ? videoRefs.current[active] : null;
    if (v) {
      v.muted = true;
      v.setAttribute("muted", "");
      v.play().catch(() => {});
    }
    const t = window.setTimeout(() => {
      INDEX_FILMS.forEach(({ key }) => {
        if (key !== active) videoRefs.current[key]?.pause();
      });
    }, FADE_MS + 50);
    return () => window.clearTimeout(t);
  }, [active]);

  // the paper-coloured twin of the line is clipped to the frame that's showing
  useEffect(() => {
    const sync = () => {
      const stage = stageRef.current?.getBoundingClientRect();
      const frame = active ? frameRefs.current[active]?.getBoundingClientRect() : null;
      const twin = twinRef.current;
      if (!stage || !twin || !frame) return;
      twin.style.clipPath = `inset(${frame.top - stage.top}px ${stage.right - frame.right}px ${stage.bottom - frame.bottom}px ${frame.left - stage.left}px)`;
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [active]);

  // the pointer leaving the line (not just a word) lets the film go
  const leave = useRef(0);
  const point = (k: FormatKey | null) => {
    window.clearTimeout(leave.current);
    if (k) onHover(k);
    else leave.current = window.setTimeout(() => onHover(null), 140);
  };
  useEffect(() => () => window.clearTimeout(leave.current), []);

  const shown = active && !open;
  return (
    <motion.div
      ref={stageRef}
      className={styles.stage}
      initial={false}
      animate={{ opacity: open ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
      style={{ pointerEvents: open ? "none" : "auto" }}
    >
      {/* the films, one frame per format, crossfading */}
      {INDEX_FILMS.map((f) => (
        <div
          key={f.key}
          ref={(el) => {
            frameRefs.current[f.key] = el;
          }}
          className={`${styles.film} ${styles[`film_${f.key.replace("x", "by")}`]} ${shown && active === f.key ? styles.filmOn : ""}`}
          aria-hidden="true"
        >
          <video
            ref={(el) => {
              videoRefs.current[f.key] = el;
            }}
            src={portrait ? f.small : f.desk}
            poster={portrait ? f.smallPoster : f.poster}
            muted
            loop
            playsInline
            preload={ready ? "auto" : "metadata"}
            disablePictureInPicture
          />
        </div>
      ))}

      {/* the line, in ink on the paper... */}
      <div className={styles.namesWrap} onPointerLeave={() => point(null)}>
        <Names
          ink
          show={show}
          base={base}
          reduce={reduce}
          ready={ready}
          active={shown ? active : null}
          wordRefs={wordRefs}
          onHover={(k) => point(k)}
          onOpen={onOpen}
        />
      </div>
      {/* ...and in paper on the film */}
      <div ref={twinRef} className={`${styles.namesWrap} ${styles.twin} ${shown ? styles.twinOn : ""}`}>
        <Names ink={false} show={show} base={base} reduce={reduce} ready={ready} active={shown ? active : null} />
      </div>

      {intro && <IntroMark />}
    </motion.div>
  );
}
