"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, usePresence, useSpring } from "framer-motion";
import Link from "next/link";
import styles from "./format-hero.module.css";

// ===========================================================================
// FORMATS — the three words on the landing: 16x9, 9x16 and Beyond. Pointing
// at one reshapes the wall's tiles to its frame (see page.tsx); clicking one
// opens its hero here: the word lifts out of its column and flies down to the
// corner on a spring, while a frame in that format opens out of a slit with
// its film. The tabs at the top morph the frame from one format to the next;
// closing flies the word back into its column.
// ===========================================================================

export type FormatKey = "16x9" | "9x16" | "beyond";
type Cut = { src: string; poster: string };
export type Format = {
  key: FormatKey;
  no: string;
  label: string;
  line: string;
  detail: string;
  cta: { label: string; href: string; external?: boolean };
  /** the desk cut, a lighter one for portrait screens, and the tiny blurred copy that lights the room */
  film: { desk: Cut; small: Cut; light: string };
  /** the frame's width / height; 0 = Beyond, past every edge of the screen */
  aspect: number;
  /** the wall's tiles while this word is pointed at */
  tile: string;
};

const F = "/hero14/films";
export const FORMATS: Format[] = [
  {
    key: "16x9",
    no: "01",
    label: "16x9",
    line: "Films for the big screen",
    detail: "TVCs · Brand films · Documentaries",
    cta: { label: "See the work", href: "/work" },
    film: {
      desk: { src: `${F}/wide-1080.mp4`, poster: `${F}/wide.webp` },
      small: { src: `${F}/wide-540.mp4`, poster: `${F}/wide-540.webp` },
      light: `${F}/wide-light.mp4`,
    },
    aspect: 16 / 9,
    tile: "16 / 9",
  },
  {
    key: "9x16",
    no: "02",
    label: "9x16",
    line: "Stories made for the scroll",
    detail: "Social · Branded content · Creators",
    cta: { label: "Visit 9x16.studio", href: "https://9x16.studio", external: true },
    film: {
      desk: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp` },
      small: { src: `${F}/vertical-m.mp4`, poster: `${F}/vertical-m.webp` },
      light: `${F}/vertical-light.mp4`,
    },
    aspect: 9 / 16,
    tile: "9 / 16",
  },
  {
    key: "beyond",
    no: "03",
    label: "Beyond",
    line: "Stories you step into",
    detail: "Immersive · Interactive · Experiential",
    cta: { label: "Start a project", href: "#contact" },
    film: {
      desk: { src: `${F}/beyond-1080.mp4`, poster: `${F}/beyond.webp` },
      small: { src: `${F}/beyond-m.mp4`, poster: `${F}/beyond-m.webp` },
      light: `${F}/beyond-light.mp4`,
    },
    aspect: 0,
    tile: "2.39 / 1", // scope: wider than the big screen
  },
];

const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
// the word's flight between its column and the corner
const FLY = { type: "spring", stiffness: 120, damping: 21, mass: 1 } as const;
// the frame morphing from one format to the next
const MORPH = { type: "spring", stiffness: 75, damping: 17, mass: 1 } as const;
const TILT = { x: 2.6, y: 3.6 }; // how far a framed film turns toward the pointer (deg)
const PAN = 0.03; // how far Beyond lets you look around, in screen widths
const LOGO_SRC = "/logo.png";

export type Rect = { left: number; top: number; width: number; height: number };

/** 16x9 set as type: the numbers, and a light lowercase x between them. */
export function Ratio({ text, className }: { text: string; className?: string }) {
  const [a, b] = text.split("x");
  if (b === undefined) return <>{text}</>;
  return (
    <>
      {a}
      <span className={className}>x</span>
      {b}
    </>
  );
}

/** A small outline of the format's frame; Beyond is only its corners: the frame has opened. */
export function FrameGlyph({ k, className }: { k: FormatKey; className?: string }) {
  if (k === "beyond")
    return (
      <svg className={className} viewBox="0 0 26 12" aria-hidden="true">
        <path d="M0.5 3.5V0.5H4.5M21.5 0.5H25.5V3.5M25.5 8.5V11.5H21.5M4.5 11.5H0.5V8.5" fill="none" stroke="currentColor" />
      </svg>
    );
  const wide = k === "16x9";
  return (
    <svg className={className} viewBox={wide ? "0 0 22 13" : "0 0 9 15"} aria-hidden="true">
      <rect x="0.5" y="0.5" width={wide ? 21 : 8} height={wide ? 12 : 14} fill="none" stroke="currentColor" />
    </svg>
  );
}

/** Where the frame sits for a format: framed formats float in the room, Beyond runs past the screen. */
function frameBox(f: Format, vw: number, vh: number): Rect {
  if (!f.aspect) {
    const w = vw * 1.1;
    const h = vh * 1.1;
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }
  // phones: the room between the tabs (under the bar) and the word at the foot
  if (vw <= 760) {
    const top = 112;
    const room = Math.max(160, vh - 280 - top);
    const w = f.aspect >= 1 ? Math.min(vw * 0.9, room * f.aspect) : Math.min(room * f.aspect, vw * 0.9);
    const h = w / f.aspect;
    return { left: (vw - w) / 2, top: top + (room - h) / 2, width: w, height: h };
  }
  if (f.aspect >= 1) {
    const w = Math.min(vw * 0.6, vh * 0.6 * f.aspect);
    const h = w / f.aspect;
    return { left: (vw - w) / 2, top: vh * 0.45 - h / 2, width: w, height: h };
  }
  const h = Math.min(vh * 0.74, (vw * 0.9) / f.aspect);
  const w = h * f.aspect;
  return { left: (vw - w) / 2, top: vh * 0.5 - h / 2, width: w, height: h };
}

const PORTRAIT_Q = "(max-aspect-ratio: 1/1)";

export default function FormatHero({
  start,
  from,
  reduce,
  wordRect,
  onSwitch,
  onClose,
  onLanded,
}: {
  start: FormatKey;
  /** the word's box in its column, where the title takes off from */
  from: Rect;
  reduce: boolean;
  /** the word's box in its column now, where the title lands on the way out */
  wordRect: (k: FormatKey) => Rect | null;
  onSwitch: (k: FormatKey) => void;
  onClose: () => void;
  /** the title is back in its column: the column can show its own word again */
  onLanded: () => void;
}) {
  const [isPresent, safeToRemove] = usePresence();
  const [idx, setIdx] = useState(() => Math.max(0, FORMATS.findIndex((f) => f.key === start)));
  const f = FORMATS[idx];
  const [view, setView] = useState(() => ({
    vw: window.innerWidth,
    vh: window.innerHeight,
    portrait: window.matchMedia(PORTRAIT_Q).matches,
  }));
  const box = frameBox(f, view.vw, view.vh);
  const cut = view.portrait ? f.film.small : f.film.desk;

  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  // the title's flight, as a FLIP: it is laid out in the corner and transformed back to the word
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const ts = useMotionValue(1);
  // the framed film leans toward the pointer; Beyond's film is looked around instead
  const rx = useSpring(0, { stiffness: 120, damping: 20 });
  const ry = useSpring(0, { stiffness: 120, damping: 20 });
  const px = useSpring(0, { stiffness: 60, damping: 20 });
  const py = useSpring(0, { stiffness: 60, damping: 20 });

  // where the title sits when it isn't transformed (its transform origin is its top left)
  const restRect = useCallback((): Rect | null => {
    const el = titleRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = ts.get() || 1;
    return { left: r.left - tx.get(), top: r.top - ty.get(), width: r.width / s, height: r.height / s };
  }, [tx, ty, ts]);

  // ---- open: the title starts exactly over the word and flies to the corner ----
  useLayoutEffect(() => {
    const el = titleRef.current;
    const rest = restRect();
    if (!el || !rest || !rest.width) return;
    const s = from.width / rest.width;
    const x = from.left - rest.left;
    const y = from.top - rest.top;
    tx.set(x);
    ty.set(y);
    ts.set(s);
    // written straight away too, so the first painted frame already has it in place
    el.style.transform = `translateX(${x}px) translateY(${y}px) scale(${s})`;
    if (reduce) {
      tx.set(0);
      ty.set(0);
      ts.set(1);
      el.style.transform = "none";
      return;
    }
    const a = [animate(tx, 0, FLY), animate(ty, 0, FLY), animate(ts, 1, FLY)];
    return () => a.forEach((c) => c.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  // ---- close: everything folds away and the title flies back into its column ----
  useEffect(() => {
    if (isPresent) return;
    const to = wordRect(f.key);
    const rest = restRect();
    if (!to || !rest || !rest.width || reduce) {
      onLanded();
      safeToRemove?.();
      return;
    }
    const fly = { ...FLY, delay: 0.12 };
    const a = [
      animate(tx, to.left - rest.left, fly),
      animate(ty, to.top - rest.top, fly),
      animate(ts, to.width / rest.width, fly),
    ];
    let done = false;
    Promise.all(a).then(() => {
      if (done) return;
      done = true;
      onLanded();
      safeToRemove?.();
    });
    return () => {
      done = true;
      a.forEach((c) => c.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when asked to leave
  }, [isPresent]);

  const select = useCallback(
    (i: number) => {
      const n = (i + FORMATS.length) % FORMATS.length;
      setIdx(n);
      onSwitch(FORMATS[n].key);
    },
    [onSwitch]
  );

  // Esc closes; the arrow keys step through the formats
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") select(idx + 1);
      if (e.key === "ArrowLeft") select(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, onClose, select]);

  useEffect(() => {
    const onResize = () =>
      setView({ vw: window.innerWidth, vh: window.innerHeight, portrait: window.matchMedia(PORTRAIT_Q).matches });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Beyond has no frame to lean, so the pointer looks around the film instead
  useEffect(() => {
    if (f.aspect) {
      px.set(0);
      py.set(0);
    } else {
      rx.set(0);
      ry.set(0);
    }
  }, [f.aspect, px, py, rx, ry]);

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || reduce || !isPresent) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    if (f.aspect) {
      ry.set(nx * TILT.y);
      rx.set(-ny * TILT.x);
    } else {
      px.set(-nx * PAN * window.innerWidth);
      py.set(-ny * PAN * 0.6 * window.innerHeight);
    }
  };

  // a sideways swipe on a phone changes the format
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    swipe.current = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) select(idx + (dx < 0 ? 1 : -1));
  };

  const fade = (delay: number) =>
    isPresent
      ? { opacity: 1, y: 0, transition: { delay: reduce ? 0 : delay, duration: 0.9, ease: EASE } }
      : { opacity: 0, y: 0, transition: { duration: reduce ? 0 : 0.25, ease: EASE } };

  return (
    <motion.div
      ref={rootRef}
      className={`${styles.fh} ${f.aspect ? "" : styles.fhBeyond}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${f.label} — ${f.line}`}
      tabIndex={-1}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* the room goes dark... */}
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={
          isPresent
            ? { opacity: 1, transition: { duration: reduce ? 0 : 0.6, ease: EASE } }
            : { opacity: 0, transition: { delay: reduce ? 0 : 0.3, duration: reduce ? 0 : 0.6, ease: EASE } }
        }
      />
      {/* ...and the film lights it: a tiny blurred copy stretched to the walls */}
      <motion.div
        className={styles.light}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={
          isPresent
            ? { opacity: 1, transition: { delay: reduce ? 0 : 0.5, duration: 1.4, ease: EASE } }
            : { opacity: 0, transition: { duration: reduce ? 0 : 0.4, ease: EASE } }
        }
      >
        <AnimatePresence initial={false}>
          <motion.video
            key={f.key}
            className={styles.lightFilm}
            src={f.film.light}
            muted
            loop
            playsInline
            autoPlay
            disablePictureInPicture
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 1, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 1, ease: EASE } }}
          />
        </AnimatePresence>
      </motion.div>

      {/* ================= the frame: opens out of a slit, then morphs between formats ================= */}
      <motion.div
        className={styles.frame}
        aria-hidden="true"
        initial={{ ...box, opacity: 1, clipPath: reduce ? "inset(0% 0% 0% 0%)" : "inset(50% 0% 50% 0%)" }}
        animate={{
          ...box,
          // closing: it shuts like a shutter and is gone before the room lights back up
          opacity: isPresent ? 1 : 0,
          clipPath: isPresent ? "inset(0% 0% 0% 0%)" : "inset(50% 0% 50% 0%)",
          transition: reduce
            ? { duration: 0 }
            : {
                default: MORPH,
                opacity: isPresent ? { duration: 0 } : { delay: 0.2, duration: 0.25, ease: "easeIn" },
                clipPath: isPresent
                  ? { delay: 0.18, duration: 1.05, ease: EASE_CINE }
                  : { duration: 0.5, ease: EASE_CINE },
              },
        }}
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 1400 }}
      >
        <motion.div className={styles.pan} style={{ x: px, y: py }}>
          <AnimatePresence initial={false}>
            <motion.div
              key={f.key}
              className={styles.film}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.7, ease: EASE } }}
              exit={{ opacity: 0, transition: { delay: reduce ? 0 : 0.15, duration: reduce ? 0 : 0.7, ease: EASE } }}
            >
              <motion.video
                className={styles.video}
                src={cut.src}
                poster={cut.poster}
                muted
                loop
                playsInline
                autoPlay
                preload="auto"
                disablePictureInPicture
                initial={reduce ? false : { scale: 1.14 }}
                animate={{ scale: 1, transition: { duration: 2.2, ease: EASE } }}
              />
            </motion.div>
          </AnimatePresence>
          <span className={styles.edge} />
        </motion.div>
      </motion.div>

      {/* a shade at the foot so the words read over the film */}
      <motion.div
        className={styles.shade}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: isPresent ? 1 : 0, transition: { duration: 0.8, ease: EASE } }}
      />

      {/* ================= top bar: logo, the three formats, close ================= */}
      <motion.header className={styles.bar} initial={reduce ? false : { opacity: 0, y: -10 }} animate={fade(0.45)}>
        <button type="button" className={styles.logo} onClick={onClose} aria-label="Back to home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" />
        </button>
        <nav className={styles.tabs} aria-label="Formats">
          {FORMATS.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tab} ${i === idx ? styles.tabOn : ""}`}
              aria-pressed={i === idx}
              onClick={() => select(i)}
            >
              <span className={styles.tabNo}>{t.no}</span>
              <span>
                <Ratio text={t.label} className={styles.x} />
              </span>
              {i === idx && (
                <motion.span layoutId="fh-tab-line" className={styles.tabLine} transition={{ type: "spring", stiffness: 380, damping: 32 }} />
              )}
            </button>
          ))}
        </nav>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <span />
          <span />
        </button>
      </motion.header>

      {/* ================= the foot: the word, and what the format is ================= */}
      <div className={styles.foot}>
        <motion.div ref={titleRef} className={styles.title} style={{ x: tx, y: ty, scale: ts, originX: 0, originY: 0 }}>
          <span className={styles.titleMask}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={f.key}
                className={styles.titleText}
                initial={{ y: "108%" }}
                animate={{ y: 0, transition: reduce ? { duration: 0 } : { type: "spring", stiffness: 130, damping: 20 } }}
                exit={{ y: "-108%", transition: { duration: reduce ? 0 : 0.45, ease: EASE_CINE } }}
              >
                <Ratio text={f.label} className={styles.x} />
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.div>

        <motion.div className={styles.info} initial={reduce ? false : { opacity: 0 }} animate={fade(0.5)}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={f.key}
              className={styles.infoInner}
              initial="out"
              animate="in"
              exit="gone"
              variants={{
                out: { opacity: 0 },
                in: { opacity: 1, transition: { staggerChildren: reduce ? 0 : 0.07, delayChildren: reduce ? 0 : 0.1 } },
                gone: { opacity: 0, transition: { duration: reduce ? 0 : 0.2 } },
              }}
            >
              <motion.p className={styles.no} variants={rise}>
                <FrameGlyph k={f.key} className={styles.glyph} />
                <span>{f.no}</span>
                <i>/ 0{FORMATS.length}</i>
              </motion.p>
              <motion.p className={styles.line} variants={rise}>
                {f.line}
              </motion.p>
              <motion.p className={styles.detail} variants={rise}>
                {f.detail}
              </motion.p>
              <motion.div variants={rise}>
                {f.cta.external ? (
                  <a href={f.cta.href} className={styles.cta} target="_blank" rel="noreferrer">
                    {f.cta.label}
                    <span className={styles.ctaArrow} aria-hidden="true">
                      ↗
                    </span>
                  </a>
                ) : (
                  <Link href={f.cta.href} className={styles.cta}>
                    {f.cta.label}
                    <span className={styles.ctaArrow} aria-hidden="true">
                      →
                    </span>
                  </Link>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

const rise = {
  out: { opacity: 0, y: 14 },
  in: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};
