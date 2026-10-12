"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useSpring, useTransform, type MotionValue } from "framer-motion";
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
// THE INDEX — three frames on the white page, each name inside its own:
// 16x9 in a 16:9 frame, 9x16 in a 9:16 frame, Beyond in four corners only
// (a frame that has already opened). They trace themselves in after the
// mark, and float a little at different depths with the pointer.
//
// Pointing at one fills its frame with its film, playing, and turns its
// name to paper over it; the other two step back. Beyond's film bleeds out
// past its corners. Clicking one opens its frame out to the whole screen,
// the film filling it, and the room comes up underneath as the page goes.
// ===========================================================================
type Rect = { left: number; top: number; width: number; height: number };
type IndexFilm = { desk: string; small: string; poster: string; smallPoster: string };
const F = "/hero14/films";
const INDEX_FILMS: Record<FormatKey, IndexFilm> = {
  "16x9": { desk: `${F}/wide-1080.mp4`, small: `${F}/wide-540.mp4`, poster: `${F}/wide.webp`, smallPoster: `${F}/wide-540.webp` },
  "9x16": { desk: `${F}/vertical-m.mp4`, small: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp`, smallPoster: `${F}/vertical-m.webp` },
  beyond: { desk: `${F}/beyond-1080.mp4`, small: `${F}/beyond-m.mp4`, poster: `${F}/beyond.webp`, smallPoster: `${F}/beyond-m.webp` },
};
const FADE_MS = 500; // a film's fade, matches .frameFilm in the CSS
const DEPTH = [16, 26, 12]; // how far each frame floats with the pointer, px
const LAUNCH = { open: 0.85, room: 0.55 }; // the frame opens out (s); the room is asked for this far in
const subscribePortrait = (cb: () => void) => {
  const mq = window.matchMedia("(max-aspect-ratio: 1/1)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

function Frame({
  k,
  i,
  on,
  dim,
  show,
  base,
  reduce,
  ready,
  film,
  portrait,
  mx,
  my,
  videoRef,
  onHover,
  onLaunch,
}: {
  k: FormatKey;
  i: number;
  on: boolean;
  dim: boolean;
  show: boolean;
  base: number;
  reduce: boolean;
  ready: boolean;
  film: IndexFilm;
  portrait: boolean;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  videoRef: (el: HTMLVideoElement | null) => void;
  onHover: (k: FormatKey) => void;
  onLaunch: (k: FormatKey, el: HTMLElement) => void;
}) {
  const f = FORMATS.find((x) => x.key === k) ?? FORMATS[0];
  const x = useTransform(mx, (v) => (v - 0.5) * DEPTH[i]);
  const y = useTransform(my, (v) => (v - 0.5) * DEPTH[i] * 0.7);
  const draw = (d: number) =>
    show ? { delay: base + i * 0.16 + d * 0.12, duration: 0.45, ease: EASE_CINE } : { duration: 0.3 };
  return (
    <motion.div
      className={styles.cell}
      style={{ x, y }}
      initial={false}
      animate={{ opacity: !show ? 0 : dim ? 0.28 : 1 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <button
        type="button"
        className={`${styles.frame} ${styles[`frame_${k.replace("x", "by")}`]} ${on ? styles.frameOn : ""}`}
        data-fmt={k}
        aria-label={`${f.label}: ${f.line}`}
        disabled={!ready || !show}
        style={{ pointerEvents: show ? "auto" : "none" }}
        onPointerEnter={(e) => e.pointerType === "mouse" && onHover(k)}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && onHover(k)}
        onClick={(e) => onLaunch(k, e.currentTarget)}
      >
        {/* the film, under the frame's line */}
        <span className={styles.frameFilm} aria-hidden="true">
          <video
            ref={videoRef}
            src={portrait ? film.small : film.desk}
            poster={portrait ? film.smallPoster : film.poster}
            muted
            loop
            playsInline
            preload={ready ? "auto" : "metadata"}
            disablePictureInPicture
          />
        </span>
        {/* the frame: four hairlines traced round, or, for Beyond, four corners */}
        {k !== "beyond"
          ? EDGES.map((side, d) => {
              const across = side === "top" || side === "bottom";
              return (
                <motion.span
                  key={side}
                  className={`${styles.introEdge} ${styles[`introEdge_${side}`]} ${styles.frameEdge}`}
                  initial={reduce ? false : across ? { scaleX: 0 } : { scaleY: 0 }}
                  animate={across ? { scaleX: show ? 1 : 0 } : { scaleY: show ? 1 : 0 }}
                  transition={draw(d)}
                />
              );
            })
          : (["tl", "tr", "bl", "br"] as const).map((c, d) => (
              <motion.span
                key={c}
                className={`${styles.corner} ${styles[`corner_${c}`]} ${styles.frameEdge}`}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: show ? 1 : 0 }}
                transition={draw(d)}
              />
            ))}
        {/* the name, rising into its frame */}
        <span className={styles.frameMask}>
          <motion.span
            className={styles.frameWord}
            initial={reduce ? false : { y: "112%" }}
            animate={show ? { y: "0%", transition: { delay: base + i * 0.16 + 0.45, duration: 0.9, ease: EASE } } : undefined}
          >
            <Ratio text={f.label} className={styles.fmtX} />
          </motion.span>
        </span>
      </button>
      <motion.span
        className={styles.frameCap}
        initial={reduce ? false : { opacity: 0 }}
        animate={show ? { opacity: on ? 1 : 0.55, transition: { delay: on ? 0 : base + i * 0.16 + 0.7, duration: 0.6 } } : { opacity: 0 }}
      >
        <i>{f.no}</i>
        {f.line}
      </motion.span>
    </motion.div>
  );
}

export default function IndexStage({
  open,
  show,
  first,
  reduce,
  ready,
  active,
  onHover,
  onOpen,
}: {
  /** a room is open: the index steps aside */
  open: boolean;
  /** the frames are up (not under the menu, not in a room) */
  show: boolean;
  /** the first time, the frames wait for the mark to leave */
  first: boolean;
  reduce: boolean;
  ready: boolean;
  /** the format pointed at (or, on touch, the one taking its turn) */
  active: FormatKey | null;
  onHover: (k: FormatKey | null) => void;
  onOpen: (k: FormatKey) => void;
}) {
  const portrait = useSyncExternalStore(subscribePortrait, () => window.matchMedia("(max-aspect-ratio: 1/1)").matches, () => false);
  const base = reduce ? 0 : first ? INTRO.names : 0.1;
  const videoRefs = useRef<Partial<Record<FormatKey, HTMLVideoElement | null>>>({});
  const [launch, setLaunch] = useState<{ key: FormatKey; rect: Rect } | null>(null);
  const shown = launch ? launch.key : open ? null : active;

  // the mark leaves the page once its entrance has played
  const [intro, setIntro] = useState(!reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setIntro(false), (INTRO.names + 0.3) * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // the frames float a little with the pointer, each at its own depth
  const mx = useSpring(0.5, { stiffness: 60, damping: 20 });
  const my = useSpring(0.5, { stiffness: 60, damping: 20 });
  useEffect(() => {
    if (reduce) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mx.set(e.clientX / window.innerWidth);
      my.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [mx, my, reduce]);

  // the film of the frame pointed at plays; the others stop once they've faded
  useEffect(() => {
    const v = shown ? videoRefs.current[shown] : null;
    if (v) {
      v.muted = true;
      v.setAttribute("muted", "");
      v.play().catch(() => {});
    }
    const t = window.setTimeout(() => {
      (Object.keys(INDEX_FILMS) as FormatKey[]).forEach((key) => {
        if (key !== shown) videoRefs.current[key]?.pause();
      });
    }, FADE_MS + 50);
    return () => window.clearTimeout(t);
  }, [shown]);

  // the pointer leaving the frames (not just one) lets the film go
  const leave = useRef(0);
  const point = (k: FormatKey | null) => {
    window.clearTimeout(leave.current);
    if (k) onHover(k);
    else leave.current = window.setTimeout(() => onHover(null), 140);
  };
  useEffect(() => () => window.clearTimeout(leave.current), []);

  // Clicking a frame opens it out to the whole screen, its film filling it;
  // the room is asked for part way, and the page fades over it.
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const launchFrom = (k: FormatKey, el: HTMLElement) => {
    if (!ready || launch) return;
    const r = el.getBoundingClientRect();
    setLaunch({ key: k, rect: { left: r.left, top: r.top, width: r.width, height: r.height } });
    timers.current.push(window.setTimeout(() => onOpen(k), (reduce ? 0 : LAUNCH.room) * 1000));
    // once the page has gone, the launch is over
    timers.current.push(window.setTimeout(() => setLaunch(null), (reduce ? 0.1 : LAUNCH.room + 1.0) * 1000));
  };

  const lf = launch ? INDEX_FILMS[launch.key] : null;
  return (
    <motion.div
      className={styles.stage}
      initial={false}
      animate={{ opacity: open ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
      style={{ pointerEvents: open ? "none" : "auto" }}
    >
      <div className={styles.frames} onPointerLeave={() => point(null)}>
        {FORMATS.map((f, i) => (
          <Frame
            key={f.key}
            k={f.key}
            i={i}
            on={shown === f.key}
            dim={shown !== null && shown !== f.key}
            show={show}
            base={base}
            reduce={reduce}
            ready={ready}
            film={INDEX_FILMS[f.key]}
            portrait={portrait}
            mx={mx}
            my={my}
            videoRef={(el) => {
              videoRefs.current[f.key] = el;
            }}
            onHover={(k) => point(k)}
            onLaunch={launchFrom}
          />
        ))}
      </div>

      {/* the frame clicked, opening out to the whole screen */}
      {launch && lf && (
        <motion.div
          className={styles.launch}
          initial={{
            clipPath: `inset(${launch.rect.top}px ${window.innerWidth - launch.rect.left - launch.rect.width}px ${
              window.innerHeight - launch.rect.top - launch.rect.height
            }px ${launch.rect.left}px)`,
          }}
          animate={{ clipPath: "inset(0px 0px 0px 0px)" }}
          transition={{ duration: reduce ? 0 : LAUNCH.open, ease: EASE_CINE }}
        >
          <video
            src={portrait ? lf.small : lf.desk}
            poster={portrait ? lf.smallPoster : lf.poster}
            muted
            loop
            playsInline
            autoPlay
            disablePictureInPicture
          />
        </motion.div>
      )}

      {intro && <IntroMark />}
    </motion.div>
  );
}
