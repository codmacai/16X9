"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { EASE, Still } from "../_shared/chrome";
import { stillFor, type Project } from "../_shared/data";
import styles from "./v1.module.css";

// ===========================================================================
// THE OPEN FILE — a folder from the cabinet, opened where it sits. One spring
// (p, 0 → 1) carries the whole move, so every part travels together and the
// way back is the same path reversed:
//   · the folder's body grows out of its place into the dark room,
//   · its film window becomes the centre card: laid out at the card's size
//     at the end, the box is interpolated from the window's (never scaled, so
//     the film is never squashed) and cropped to what the stack let you see,
//   · its tab slides up to the corner and becomes the ticket.
// The other films come in either side, set back in the dark and out of focus;
// their titles, the facts and the guide line settle in on a short stagger.
// Point, click, swipe, scroll or use the arrow keys to bring one forward;
// click the one in front to play it.
// ===========================================================================

export type Rect = { top: number; left: number; width: number; height: number };

/** Where a folder sits on screen: what the file grows out of and folds back into. */
export type Origin = {
  /** the folder's film window, its whole box (the stack hides the lower part) */
  win: Rect;
  tab: Rect;
  /** the folder's body runs from under its tab to where the next folder covers it */
  bodyTop: number;
  visBottom: number;
  /** the folder's colour */
  stock: string;
  /** it was pulled up (pointed at) when it was clicked, so it's in colour */
  lifted: boolean;
};

export type Drawer = { no: string; label: string; short: string; films: Project[] };

type Geo = {
  vw: number;
  vh: number;
  w: number;
  h: number;
  step: number;
  left: number;
  top: number;
  small: boolean;
  ticket: Rect;
};

const BG = "#0b0b0a";
const PAPER = "#f7f2ee";
const RATIO = 1.17; // card height / width, as in the reference
const RADIUS = { from: 3, to: 14 }; // the window's corners, the card's
const CROP = { from: 16, to: 21 }; // % of the picture run past the top and bottom: the window's, the card's
const FOCUS = "blur(0px) brightness(1) saturate(1)";
const IDLE = "blur(9px) brightness(0.5) saturate(0.35)";
const GONE = "blur(24px) brightness(0.35) saturate(0.2)";
const OPEN = { type: "spring", duration: 1.05, bounce: 0.1 } as const;
const CLOSE = { type: "spring", duration: 0.9, bounce: 0 } as const;
const SLIDE = { type: "spring", stiffness: 120, damping: 22, mass: 1 } as const;
const LEAVE_MS = 280; // the extras clear before the file folds back
const EXTRAS_MS = 380; // ...and arrive this far into the opening

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pad2 = (n: number) => String(n).padStart(2, "0");

function geometry(): Geo {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 70;
  const small = vw < 760;
  const ui = Math.min(40, Math.max(18, vw * 0.026));
  const facts = small ? 70 : 84; // the table under a card, with the gap above it
  const th = small ? 40 : 44; // ticket height
  const room = vh - band - facts - (small ? th + 36 : 64);
  let w = small ? vw * 0.72 : vw * 0.31;
  let h = w * RATIO;
  if (h > room) {
    h = room;
    w = h / RATIO;
  }
  const gap = small ? 14 : Math.max(24, vw * 0.03);
  const free = vh - band - h - facts;
  const top = small ? band + th + Math.max(14, (free - th) / 2) : band + Math.max(28, free / 2);
  const tw = small ? vw - ui * 2 : Math.min(520, vw * 0.38);
  return {
    vw,
    vh,
    w,
    h,
    step: w + gap,
    left: (vw - w) / 2,
    top,
    small,
    ticket: { left: vw - ui - tw, top: band, width: tw, height: th },
  };
}

type Morph = {
  left: MotionValue<number>;
  top: MotionValue<number>;
  width: MotionValue<number>;
  height: MotionValue<number>;
  clip: MotionValue<string>;
  radius: MotionValue<number>;
  shade: MotionValue<number>;
  crop: MotionValue<number>;
};

export default function FileView({
  drawer,
  origin: first,
  start,
  reduce,
  playing,
  measure,
  onPlay,
  onCursor,
  onLeave,
  onClosed,
}: {
  drawer: Drawer;
  origin: Origin;
  /** the film the folder was showing */
  start: number;
  reduce: boolean;
  /** the player is open over the file */
  playing: boolean;
  /** where the folder is now (measured again for the way back) */
  measure: () => Origin | null;
  onPlay: (film: Project, el: HTMLElement) => void;
  onCursor: (label: string | null) => void;
  /** the file is closing on this film: the folder should show it */
  onLeave: (index: number) => void;
  onClosed: () => void;
}) {
  const n = drawer.films.length;
  const [a, setA] = useState(start);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const [extras, setExtras] = useState(false);
  const [geo, setGeo] = useState(geometry);
  const [origin, setOrigin] = useState(first);
  const rootRef = useRef<HTMLDivElement>(null);

  // the spring, and everything it drives (refs: read on every frame, not in render)
  const p = useMotionValue(0);
  const o = useRef(first);
  const g = useRef(geo);
  useEffect(() => {
    g.current = geo;
  }, [geo]);

  const box = (v: number) => {
    const w = o.current.win;
    const c = g.current;
    return { left: lerp(w.left, c.left, v), top: lerp(w.top, c.top, v), width: lerp(w.width, c.w, v), height: lerp(w.height, c.h, v) };
  };
  const morph: Morph = {
    left: useTransform(p, (v) => box(v).left),
    top: useTransform(p, (v) => box(v).top),
    width: useTransform(p, (v) => box(v).width),
    height: useTransform(p, (v) => box(v).height),
    // crop to what the stack showed of the window; opens to the whole card
    clip: useTransform(p, (v) => {
      const w = o.current.win;
      return `inset(0px 0px ${Math.max(0, lerp(w.top + w.height - o.current.visBottom, 0, v))}px 0px)`;
    }),
    radius: useTransform(p, (v) => Math.max(0, lerp(RADIUS.from, RADIUS.to, v))),
    shade: useTransform(p, [0, 0.35], [1, 0]),
    // how far the picture runs past the top and bottom (to lose the letterbox
    // bars): the wide window needs 16%, the tall card 21%
    crop: useTransform(p, [0, 1], [CROP.from, CROP.to]),
  };
  const roomClip = useTransform(p, (v) => {
    const top = Math.max(0, lerp(o.current.bodyTop, 0, v));
    const bottom = Math.max(0, lerp(g.current.vh - o.current.visBottom, 0, v));
    return `inset(${top}px 0px ${bottom}px 0px)`;
  });
  const roomColour = useTransform(p, [0, 1], [first.stock, BG]);
  const ghost = useTransform(p, [0, 0.22], [1, 0]);
  // the tab becomes the ticket
  const tab = (v: number) => {
    const t = o.current.tab;
    const k = g.current.ticket;
    return { left: lerp(t.left, k.left, v), top: lerp(t.top, k.top, v), width: lerp(t.width, k.width, v), height: lerp(t.height, k.height, v) };
  };
  const ticket = {
    left: useTransform(p, (v) => tab(v).left),
    top: useTransform(p, (v) => tab(v).top),
    width: useTransform(p, (v) => tab(v).width),
    height: useTransform(p, (v) => tab(v).height),
    clip: useTransform(p, (v) => {
      const s = Math.max(0, lerp(16, 0, v));
      return `polygon(0 100%, ${s}px 0, calc(100% - ${s}px) 0, 100% 100%)`;
    }),
    colour: useTransform(p, [0, 1], [first.stock, PAPER]),
    label: useTransform(p, [0, 0.3], [1, 0]),
    cells: useTransform(p, [0.42, 0.9], [0, 1]),
  };

  // ---- open: the spring out; the extras come in partway ----
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    const t = window.setTimeout(() => setExtras(true), reduce ? 0 : EXTRAS_MS);
    const run = animate(p, 1, reduce ? { duration: 0 } : OPEN);
    run.then(() => setPhase((ph) => (ph === "opening" ? "open" : ph)));
    return () => {
      window.clearTimeout(t);
      run.stop();
    };
  }, [p, reduce]);

  // ---- close: the extras clear, then the same spring back into the folder ----
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    onCursor(null);
    onLeave(a);
    setPhase("closing");
    setExtras(false);
    window.setTimeout(
      () => {
        const m = measure(); // the folder may have moved (a resize) while it was open
        if (m) {
          o.current = m;
          setOrigin(m);
        }
        animate(p, 0, reduce ? { duration: 0 } : CLOSE).then(onClosed);
      },
      reduce ? 0 : LEAVE_MS
    );
  }, [a, measure, onClosed, onCursor, onLeave, p, reduce]);

  // ---- resize, keys, wheel ----
  useEffect(() => {
    const onResize = () => setGeo(geometry());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (phase !== "open" || playing) return;
    // the menu or the player locks the body; while either is up, it has the keys
    const blocked = () => document.body.style.overflow === "hidden";
    const step = (d: number) => setA((i) => Math.max(0, Math.min(n - 1, i + d)));
    const onKey = (e: KeyboardEvent) => {
      if (blocked()) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    let acc = 0;
    let until = 0;
    const onWheel = (e: WheelEvent) => {
      if (blocked()) return;
      e.preventDefault();
      const now = performance.now();
      if (now < until) return;
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(acc) > 60) {
        step(Math.sign(acc));
        acc = 0;
        until = now + 520;
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [phase, playing, close, n]);

  // ---- swipe (a drag that travels isn't also a click) ----
  const down = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const onPointerDown = (e: ReactPointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
    dragged.current = false;
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d || phase !== "open") return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 8) dragged.current = true;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - d.y)) setA((i) => Math.max(0, Math.min(n - 1, i - Math.sign(dx))));
  };

  const live = phase === "open"; // settled: plain values, and it follows a resize
  const film = drawer.films[a];

  return (
    <div
      ref={rootRef}
      className={styles.view}
      style={{ ["--cw" as string]: `${geo.w}px` }}
      role="dialog"
      aria-modal="true"
      aria-label={`${drawer.label}, ${n} films`}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={(e) => {
        if (e.target === e.currentTarget && live && !dragged.current) close();
      }}
    >
      {/* the room: the folder's body, opened out */}
      <motion.div
        className={styles.room}
        style={live ? { clipPath: "inset(0px 0px 0px 0px)", backgroundColor: BG } : { clipPath: roomClip, backgroundColor: roomColour }}
        aria-hidden="true"
      />

      {/* the folder's caption, standing in for it until the card is clear of the stack */}
      {!live && (
        <motion.span
          className={`${styles.ghost} ${origin.lifted ? styles.folderOn : ""}`}
          style={{ left: origin.win.left, top: origin.win.top, width: origin.win.width, opacity: ghost }}
          aria-hidden="true"
        >
          <span className={styles.caption}>
            <span className={styles.title}>{drawer.label}</span>
            <span className={styles.meta}>
              <span>{drawer.films.map((f) => f.title).join(" · ")}</span>
              <span className={styles.enter}>
                Open <span>→</span>
              </span>
            </span>
          </span>
        </motion.span>
      )}

      {/* the guide down the middle */}
      <motion.span
        className={styles.guide}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={extras ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 1 }}
        transition={{ duration: extras ? 1.2 : 0.25, ease: EASE, delay: extras ? 0.1 : 0 }}
        aria-hidden="true"
      />

      {/* the films */}
      {drawer.films.map((f, k) => (
        <Card
          key={f.no}
          film={f}
          kicker={drawer.label}
          k={k}
          a={a}
          geo={geo}
          extras={extras}
          morph={k === a && !live ? morph : null}
          stillOn={k === a && (live || origin.lifted)}
          video={k === a && live && !playing && !reduce}
          onSelect={() => !dragged.current && live && setA(k)}
          onPlay={(el) => !dragged.current && live && onPlay(f, el)}
          onCursor={onCursor}
        />
      ))}

      {/* the ticket: the folder's tab, hung in the corner */}
      <motion.div
        className={styles.ticket}
        style={
          live
            ? { ...geo.ticket, clipPath: "polygon(0 100%, 0px 0, 100% 0, 100% 100%)", backgroundColor: PAPER }
            : {
                left: ticket.left,
                top: ticket.top,
                width: ticket.width,
                height: ticket.height,
                clipPath: ticket.clip,
                backgroundColor: ticket.colour,
              }
        }
      >
        {!live && (
          <motion.span className={styles.ticketLabel} style={{ width: origin.tab.width, opacity: ticket.label }} aria-hidden="true">
            <span className={styles.labelNo}>{drawer.no}</span>
            <span className={styles.tabName}>
              <span className={styles.long}>{drawer.label}</span>
              <span className={styles.short}>{drawer.short}</span>
            </span>
            <span className={styles.labelNo}>{n}</span>
          </motion.span>
        )}
        <motion.span className={styles.ticketCells} style={live ? { opacity: 1 } : { opacity: ticket.cells }}>
          <span>
            <i>{drawer.no}</i> {drawer.label}
          </span>
          <span className={styles.ticketCount}>
            {pad2(a + 1)} / {pad2(n)}
          </span>
          <span className={styles.ticketRun}>{film.duration}</span>
          <button type="button" className={styles.ticketClose} onClick={close} aria-label="Close file">
            Close <i aria-hidden="true">✕</i>
          </button>
          {/* the punched notches along the foot, as on the reference ticket */}
          <i className={styles.notch} style={{ left: 0 }} aria-hidden="true" />
          <i className={styles.notch} style={{ left: "100%" }} aria-hidden="true" />
        </motion.span>
      </motion.div>
    </div>
  );
}

// ===========================================================================
// CARD — one film: the picture with its title set over the foot, and the
// facts under it. The one in front is sharp and in colour and plays; the rest
// wait either side, dimmed and out of focus.
// ===========================================================================
function Card({
  film,
  kicker,
  k,
  a,
  geo,
  extras,
  morph,
  stillOn,
  video,
  onSelect,
  onPlay,
  onCursor,
}: {
  film: Project;
  kicker: string;
  k: number;
  a: number;
  geo: Geo;
  extras: boolean;
  /** the card in front, while it travels to or from the folder */
  morph: Morph | null;
  stillOn: boolean;
  video: boolean;
  onSelect: () => void;
  onPlay: (el: HTMLElement) => void;
  onCursor: (label: string | null) => void;
}) {
  const front = k === a;
  const side = Math.sign(k - a);
  const x = (k - a) * geo.step;
  const shown = front || extras; // the card itself: the one in front is always there
  const dressed = extras; // its title, shade and facts: only once the file is open, so nothing reflows in flight
  const mediaRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      className={`${styles.card} ${front ? styles.cardFront : ""}`}
      style={morph ? { left: morph.left, top: morph.top, width: morph.width } : { left: geo.left, top: geo.top, width: geo.w }}
      initial={front ? { x: 0, opacity: 1, filter: "none" } : { x: x + side * 90, opacity: 0, filter: GONE }}
      animate={{
        x: shown ? x : x + side * 90,
        opacity: shown ? 1 : 0,
        filter: front ? FOCUS : shown ? IDLE : GONE,
        // in front, drop the filter once it's sharp: a resting identity filter
        // would still be re-run on every frame the card grows or shrinks
        transitionEnd: front ? { filter: "none" } : undefined,
      }}
      transition={{
        x: SLIDE,
        opacity: { duration: shown ? 0.8 : 0.3, ease: EASE, delay: shown && !front ? 0.06 * Math.abs(k - a) : 0 },
        filter: { duration: 0.8, ease: EASE },
      }}
      onClick={() => (front ? mediaRef.current && onPlay(mediaRef.current) : onSelect())}
      onPointerEnter={(e) => front && e.pointerType === "mouse" && onCursor("Play")}
      onPointerLeave={() => front && onCursor(null)}
      aria-label={front ? `Play ${film.title}` : `Show ${film.title}`}
      role="button"
      tabIndex={extras ? 0 : -1}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (front) {
            if (mediaRef.current) onPlay(mediaRef.current);
          } else onSelect();
        }
      }}
    >
      <motion.div
        ref={mediaRef}
        className={styles.media}
        style={
          morph
            ? { height: morph.height, clipPath: morph.clip, borderRadius: morph.radius, ["--crop" as string]: morph.crop }
            : { height: geo.h, borderRadius: RADIUS.to, ["--crop" as string]: CROP.to }
        }
      >
        <Still src={stillFor(film.src)} on={stillOn} />
        <AnimatePresence>
          {video && (
            <motion.video
              key={film.src}
              className={styles.cardVideo}
              src={film.src}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.9, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: 0.22, ease: EASE } }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
        {/* the folder window's shade, fading as it becomes a card */}
        {morph && <motion.span className={styles.cardShade} style={{ opacity: morph.shade }} aria-hidden="true" />}
        <motion.span
          className={styles.cardFoot}
          initial={false}
          animate={{ opacity: dressed ? 1 : 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          aria-hidden="true"
        />
        <span className={styles.cardTitle}>
          <motion.span
            className={styles.kicker}
            initial={false}
            animate={dressed ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 10, filter: "blur(6px)" }}
            transition={{ duration: dressed ? 0.7 : 0.2, ease: EASE, delay: dressed ? 0.16 : 0 }}
          >
            {kicker}
          </motion.span>
          <motion.span
            className={styles.name}
            initial={false}
            animate={dressed ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 16, filter: "blur(8px)" }}
            transition={{ duration: dressed ? 0.8 : 0.2, ease: EASE, delay: dressed ? 0.22 : 0 }}
          >
            {film.title}
          </motion.span>
        </span>
      </motion.div>

      <dl className={styles.facts}>
        {[
          ["Year", String(film.year)],
          ["Client", film.client],
          ["Runtime", film.duration],
        ].map(([label, value], i) => (
          <motion.div
            key={label}
            className={styles.fact}
            initial={false}
            animate={dressed ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: dressed ? 0.6 : 0.2, ease: EASE, delay: dressed ? 0.3 + i * 0.06 : 0 }}
          >
            <dt>{label}</dt>
            <dd>{value}</dd>
          </motion.div>
        ))}
      </dl>
    </motion.div>
  );
}
