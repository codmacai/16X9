"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, type Transition, type Variants } from "framer-motion";
import { EASE, EASE_CINE } from "./_shared/chrome";
import type { Project } from "./_shared/data";
import { brandsFrom, OPTICAL, pad2, reelOf, startMuted, type Brand } from "./brand-shared";
import FileView, { frontPicture } from "./file-view";
import type { Drawer } from "./file-view";
import f from "./file.module.css";
import s from "./brand.module.css";

// ===========================================================================
// BRAND FILMS — THE BRAND WALL. Six brands, each on its own black card, as
// the 9x16 accounts are: a dark lit surface, its edge catching the light, a
// frame inset in it playing the brand's own films under its logo in its own
// colours, and at the card's foot the brand's name and its count.
// A brand with several films cuts from one to the next on its own beat, a
// fine bar under its name counting them through.
//
// The cards come up into place on a spring, one after another, their logos
// rising after them. Point at one and it takes the light: the card lifts and
// its edge lights in the brand's colour, its film pushes in, the colour glows
// from where the pointer is and its logo leans toward the pointer on a spring
// — while the rest of the wall falls back into the dark. On a touch screen the light moves from
// brand to brand on its own. Click, and the tile flies, film and all, straight
// into the frame at the front of the brand's line of films, its logo going as
// it comes; it lands exactly where that film stands, and the brand's other
// films rise into the line round it (file-view.tsx) — one move, no cut.
// ===========================================================================

type Opened = { label: string; no: string; films: Project[]; at: number };

const LEAN = { stiffness: 150, damping: 15, mass: 0.5 }; // the logo after the pointer
const LIGHT = { stiffness: 120, damping: 22, mass: 0.6 }; // the light after the pointer
const RISE: Transition = { type: "spring", stiffness: 80, damping: 15, mass: 1 };
const FLY: Transition = { duration: 0.95, ease: EASE_CINE }; // a tile into the front of its line
const LIVE_MS = 1100; // the films start once the wall has come in
const CUT_MS = 3800; // a brand with several films cuts to the next this often...
const CUT_STEP_MS = 650; // ...each tile on its own beat
const FEATURE_MS = 3400; // on a touch screen, the light moves on this often
const OPEN_MS = 950; // the tile has landed: the line comes up round it...
const LAND_MS = 420; // ...and the flown tile gives way to the film in front underneath
const LEAVE_MS = 420;
const maskOf = (src: string) => ({ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` });
// the light a tile takes on: its brand's colour, lifted where that colour is too deep to glow on black
const GLOW: Record<string, string> = {
  "/brands/rolls-royce.svg": "#8e74c4",
  "/brands/masdar.png": "#4f8fd0",
};

const noop = () => () => {};
const useFine = () => useSyncExternalStore(noop, () => window.matchMedia("(hover: hover) and (pointer: fine)").matches, () => true);
// a phone short of power or on saved data plays only the brand in the light
const useLowPower = () =>
  useSyncExternalStore(
    noop,
    () => {
      const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
      return !!nav.connection?.saveData || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
    },
    () => false
  );

// the cards come up into place on a spring, one after another, their logos rising after them
const delayOf = (i: number) => 0.15 + (i % 3) * 0.08 + Math.floor(i / 3) * 0.12;
const tiles: Variants = {
  hidden: { opacity: 0, y: 70, scale: 0.96 },
  shown: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { ...RISE, delay: delayOf(i) } }),
  away: (i: number) => ({ opacity: 0, transition: { duration: 0.3, ease: EASE, delay: i * 0.025 } }),
};
const marks: Variants = {
  hidden: { opacity: 0, scale: 0.88, y: 30 },
  shown: (i: number) => ({ opacity: 1, scale: 1, y: 0, transition: { ...RISE, delay: delayOf(i) + 0.45 } }),
  away: { opacity: 0, scale: 0.96, transition: { duration: 0.25, ease: EASE } },
};

export default function BrandIndex({
  drawer,
  pool,
  start,
  reduce,
  onPlay,
  onCursor,
  onClosed,
}: {
  /** the Brand Films drawer */
  drawer: Drawer;
  /** every film in this format: a brand's other work (its TVCs) comes from here */
  pool: Project[];
  start: number;
  reduce: boolean;
  onPlay: (film: Project, el: HTMLElement) => void;
  onCursor: (label: string | null) => void;
  onClosed: (index: number) => void;
}) {
  const brands = useMemo(() => brandsFrom(drawer.films, pool), [drawer, pool]);
  const n = brands.length;
  const fine = useFine();
  const lowPower = useLowPower();

  const [hover, setHover] = useState<number | null>(null);
  const [feature, setFeature] = useState<number | null>(null); // the brand in the light on a touch screen
  const [opened, setOpened] = useState<Opened | null>(null);
  const [opening, setOpening] = useState<{ brand: Brand; at: number; rect: DOMRect; landed: boolean } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const up = opened === null && opening === null && !leaving;

  // the films play once the wall is up, and stop while a brand's films are out over it
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setStarted(true), LIVE_MS);
    return () => window.clearTimeout(t);
  }, [reduce]);
  const playing = started && up;
  // the tile in the light: the one pointed at; on a touch screen, the one the light has moved to
  const spot = up ? (hover ?? (!fine && started ? (feature ?? 0) : null)) : null;

  // on a touch screen, the light moves from brand to brand on its own
  useEffect(() => {
    if (fine || !playing || n < 2) return;
    const id = window.setInterval(() => setFeature((k) => (k === null ? 0 : (k + 1) % n)), FEATURE_MS);
    return () => window.clearInterval(id);
  }, [fine, playing, n]);

  const live = useRef({ busy: false, leaving: false });
  useEffect(() => {
    live.current.busy = !up;
    live.current.leaving = leaving;
  }, [up, leaving]);

  const leave = useCallback(() => {
    if (live.current.leaving) return;
    live.current.leaving = true;
    setLeaving(true);
    setHover(null);
    onCursor(null);
    window.setTimeout(() => onClosed(start), reduce ? 0 : LEAVE_MS);
  }, [onClosed, onCursor, reduce, start, setHover]);

  // Esc (and the band's Back) closes the wall — unless a brand is open: its line takes that one
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || live.current.busy || document.body.style.overflow === "hidden") return;
      leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave]);

  // the light over the wall, after the pointer
  const lx = useMotionValue(-600);
  const ly = useMotionValue(-600);
  const lightX = useSpring(lx, LIGHT);
  const lightY = useSpring(ly, LIGHT);
  const [lit, setLit] = useState(false);
  const follow = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    lx.set(e.clientX - r.left);
    ly.set(e.clientY - r.top);
    if (!lit) setLit(true);
  };

  // into the brand: the tile flies, on the film it's showing, into the front of the brand's line;
  // once it's there the line comes up round it, and then it gives way to the film in front
  const enter = (k: number, at: number, el: HTMLElement) => {
    if (!up) return;
    const b = brands[k];
    const open = () => setOpened({ label: b.name, no: pad2(k + 1), films: b.films, at });
    onCursor(null);
    if (reduce) return open();
    setOpening({ brand: b, at, rect: el.getBoundingClientRect(), landed: false });
    window.setTimeout(() => {
      open();
      setOpening((o) => (o ? { ...o, landed: true } : o));
      setHover(null);
    }, OPEN_MS);
    window.setTimeout(() => setOpening(null), OPEN_MS + LAND_MS);
  };

  const state = up ? "shown" : "away";
  return (
    <>
      <div className={`${f.view} ${s.view} ${leaving ? s.viewLeave : ""}`} role="dialog" aria-modal="true" aria-label={`${drawer.label}: the brands`}>
        {/* the drawer (the way back is the band's Back, or Esc) */}
        <motion.div
          className={`${f.head} ${s.head}`}
          style={{ top: "var(--band)" }}
          initial={{ opacity: 0, y: -8 }}
          animate={up ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.9 : 0, ease: EASE }}
        >
          <span className={f.drawer}>
            <i>{drawer.no}</i> {drawer.label}
          </span>
        </motion.div>

        <div className={s.stage} onPointerMove={follow} onPointerLeave={() => setLit(false)}>
          <ul className={`${s.wall} ${spot !== null ? s.wallFocus : ""}`} onPointerLeave={() => setHover(null)}>
            {brands.map((b, k) => (
              <motion.li
                key={b.name}
                custom={k}
                variants={tiles}
                initial={reduce ? false : "hidden"}
                animate={state}
                className={spot === k ? s.on : undefined}
                style={{ ["--glow" as string]: GLOW[b.logo.src] ?? b.logo.hex } as CSSProperties}
              >
                <Tile
                  brand={b}
                  k={k}
                  // every brand's films run; a phone short of power runs only the one in the light
                  playing={playing && (fine || !lowPower || spot === k)}
                  tabbable={up}
                  reduce={reduce}
                  onEnter={() => up && setHover(k)}
                  onLeave={() => setHover((h) => (h === k ? null : h))}
                  onOpen={(at, el) => enter(k, at, el)}
                />
              </motion.li>
            ))}
          </ul>
          {/* a soft light after the pointer, over the wall */}
          <motion.span className={`${s.light} ${lit && up ? s.lightOn : ""}`} style={{ x: lightX, y: lightY }} aria-hidden="true" />
          <span className={s.vignette} aria-hidden="true" />
        </div>
      </div>

      {/* into the brand: the tile flies into the front of its line */}
      <AnimatePresence>
        {opening && <Opening key="opening" brand={opening.brand} at={opening.at} rect={opening.rect} landed={opening.landed} />}
      </AnimatePresence>

      {/* the brand's films, as the folders' line */}
      {opened && (
        <FileView
          key={opened.label}
          drawer={{ no: opened.no, label: opened.label, short: opened.label, films: opened.films, cat: drawer.cat }}
          start={opened.at}
          arrive={!reduce}
          reduce={reduce}
          onPlay={onPlay}
          onCursor={onCursor}
          onClosed={() => setOpened(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// one tile: its brand's films, cut on its own beat, under its logo; in the
// light, the film lifts and the logo leans toward the pointer, and its name,
// the film showing and its count come up at its foot
// ---------------------------------------------------------------------------
function Tile({
  brand,
  k,
  playing,
  tabbable,
  reduce,
  onEnter,
  onLeave,
  onOpen,
}: {
  brand: Brand;
  k: number;
  /** its films are running */
  playing: boolean;
  tabbable: boolean;
  reduce: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onOpen: (at: number, el: HTMLElement) => void;
}) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const reels = useMemo(() => brand.films.map(reelOf), [brand]);
  const n = reels.length;

  // the film showing: a brand with several cuts from one to the next on its own beat
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (!playing || n < 2) return;
    let id = 0;
    const t = window.setTimeout(() => {
      setAt((i) => (i + 1) % n);
      id = window.setInterval(() => setAt((i) => (i + 1) % n), CUT_MS);
    }, CUT_MS + k * CUT_STEP_MS);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [playing, n, k]);
  // the one showing, and the next already running out of sight, so a cut lands on a playing film
  // (keyed by file: the next becomes the one showing without reloading)
  const shown = [at, (at + 1) % n].filter((j, i, a) => a.indexOf(j) === i);

  // the logo leans toward the pointer
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, LEAN);
  const y = useSpring(my, LEAN);
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    // where the brand's colour glows from
    e.currentTarget.style.setProperty("--x", `${(px * 100).toFixed(1)}%`);
    e.currentTarget.style.setProperty("--y", `${(py * 100).toFixed(1)}%`);
    if (reduce) return;
    mx.set((px - 0.5) * Math.min(r.width * 0.07, 34));
    my.set((py - 0.5) * Math.min(r.height * 0.07, 26));
  };
  const leave = () => {
    mx.set(0);
    my.set(0);
    onLeave();
  };

  return (
    <button
      type="button"
      className={s.tile}
      tabIndex={tabbable ? 0 : -1}
      onPointerEnter={(e) => {
        move(e);
        if (e.pointerType === "mouse") onEnter();
      }}
      onPointerMove={move}
      onPointerLeave={leave}
      onFocus={(e) => e.currentTarget.matches(":focus-visible") && onEnter()}
      onBlur={onLeave}
      onClick={() => frameRef.current && onOpen(at, frameRef.current)}
      aria-label={`${brand.name}: ${n} ${n === 1 ? "film" : "films"}`}
    >
      {/* the frame, inset in the card: its films, behind the logo */}
      <span ref={frameRef} className={s.frame}>
        {/* its films, behind the logo */}
        <span className={s.media} aria-hidden="true">
          {reels[at].still && (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={reels[at].still} className={s.still} src={reels[at].still} alt="" draggable={false} decoding="async" />
          )}
          {playing &&
            shown.map((j, i) => (
              <video
                key={reels[j].clip}
                ref={startMuted}
                className={`${s.film} ${i === 0 ? s.filmOn : ""}`}
                src={reels[j].clip}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
              />
            ))}
        </span>
        <span className={s.shade} aria-hidden="true" />

        <motion.span className={s.logoBox} data-wide={brand.logo.wide || undefined} style={{ x, y }} aria-hidden="true">
          <motion.span className={s.rise} variants={marks} custom={k}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={s.logo} src={brand.logo.dark} alt="" draggable={false} style={{ scale: String(OPTICAL[brand.logo.src] ?? 1) }} />
          </motion.span>
        </motion.span>
      </span>

      {/* at the card's foot: its name, the film showing, and its count */}
      <span className={s.caption} aria-hidden="true">
        <span className={s.capName}>
          {/* a brand with several films: a fine bar for each, the one showing filling */}
          {n > 1 && (
            <span className={s.bars}>
              {reels.map((r, i) => (
                <i key={r.clip} className={i < at ? s.barDone : undefined}>
                  {i === at && playing && <b key={at} style={{ animationDuration: `${CUT_MS}ms` }} />}
                </i>
              ))}
            </span>
          )}
          <b>{brand.name}</b>
          <span key={at} className={s.capFilm}>
            {brand.films[at].title}
          </span>
        </span>
        <span className={s.capCount}>
          {pad2(n)} {n === 1 ? "film" : "films"} <i>→</i>
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// the tile flies, film and all, into the frame at the front of the brand's
// line: from where it stood to exactly where that film's picture stands, its
// corners rounding as the card's are, the picture cropped as the card crops
// it all the way; its logo goes as it comes. Once it has landed the film
// itself gives way to its still (the card in front shows the still), and it
// fades over the card underneath.
// ---------------------------------------------------------------------------
function Opening({ brand, at, rect, landed }: { brand: Brand; at: number; rect: DOMRect; landed: boolean }) {
  const to = frontPicture();
  const reel = reelOf(brand.films[at]);
  const optical = OPTICAL[brand.logo.src] ?? 1;
  return (
    <motion.div
      className={s.fly}
      initial={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: 3 }}
      animate={{ left: to.left, top: to.top, width: to.width, height: to.height, borderRadius: 14 }}
      exit={{ opacity: 0, transition: { duration: 0.3, ease: EASE } }}
      transition={FLY}
      aria-hidden="true"
    >
      <span className={s.flyArt}>
        {reel.still && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={s.flyStill} src={reel.still} alt="" draggable={false} />
        )}
        <motion.video
          ref={startMuted}
          className={s.flyStill}
          src={reel.clip}
          autoPlay
          muted
          loop
          playsInline
          animate={{ opacity: landed ? 0 : 1 }}
          transition={{ duration: 0.3, ease: EASE }}
        />
      </span>
      {/* the card's own shade, coming up as it lands */}
      <motion.span className={s.flyShade} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.45, ease: EASE }} />
      {/* its logo, going as it comes */}
      <motion.span
        className={s.flyMark}
        data-wide={brand.logo.wide || undefined}
        style={maskOf(brand.logo.src)}
        initial={{ opacity: 1, scale: optical }}
        animate={{ opacity: 0, scale: optical * 0.82 }}
        transition={{ duration: 0.45, ease: EASE }}
      />
    </motion.div>
  );
}
