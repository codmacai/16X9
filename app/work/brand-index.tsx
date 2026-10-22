"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, type Transition, type Variants } from "framer-motion";
import { EASE, EASE_CINE } from "./_shared/chrome";
import type { Project } from "./_shared/data";
import { brandsFrom, OPTICAL, pad2, reelOf, startMuted, type Brand } from "./brand-shared";
import FileView from "./file-view";
import type { Drawer } from "./file-view";
import f from "./file.module.css";
import s from "./brand.module.css";

// ===========================================================================
// BRAND FILMS — THE BRAND WALL. The room itself is the wall: six equal tiles
// from edge to edge of the screen, joined with no line between them, each
// playing its brand's own films under the brand's logo in its own colours.
// A brand with several films cuts from one to the next on its own beat, a
// fine bar under its name counting them through.
//
// The wall comes in like a sequence being cut together: each tile wipes up
// into place, its logo rising after it. Point at one and it takes the light:
// its film lifts and pushes in, its brand's colour glows from where the
// pointer is, its logo leans toward the pointer on a spring, and its name,
// the film now showing and its count come up at its foot — while the rest of
// the wall falls back into the dark. On a touch screen the light moves from
// brand to brand on its own. Click, and the tile opens to the whole screen,
// its film washed in the brand's colour as the logo is carried to the middle
// — then every film made for that brand rises out of the dark (file-view.tsx).
// ===========================================================================

type Opened = { label: string; no: string; films: Project[] };

const LEAN = { stiffness: 150, damping: 15, mass: 0.5 }; // the logo after the pointer
const LIGHT = { stiffness: 120, damping: 22, mass: 0.6 }; // the light after the pointer
const RISE: Transition = { type: "spring", stiffness: 80, damping: 15, mass: 1 };
const OPEN: Transition = { type: "spring", stiffness: 58, damping: 17, mass: 1 }; // a tile to the whole screen
const LIVE_MS = 1100; // the films start once the wall has come in
const CUT_MS = 3800; // a brand with several films cuts to the next this often...
const CUT_STEP_MS = 650; // ...each tile on its own beat
const FEATURE_MS = 3400; // on a touch screen, the light moves on this often
const OPEN_MS = 820;
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

// the wall cut together: each tile wipes up into place, its logo rising after it
const delayOf = (i: number) => 0.2 + (i % 3) * 0.1 + Math.floor(i / 3) * 0.14;
const tiles: Variants = {
  hidden: { clipPath: "inset(100% 0% 0% 0%)" },
  shown: (i: number) => ({ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 1.1, ease: EASE_CINE, delay: delayOf(i) } }),
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
  const [opening, setOpening] = useState<{ brand: Brand; at: number; rect: DOMRect } | null>(null);
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

  // into the brand: the tile opens to the whole screen on the film it's showing
  const enter = (k: number, at: number, el: HTMLElement) => {
    if (!up) return;
    const b = brands[k];
    const open = () => setOpened({ label: b.name, no: pad2(k + 1), films: b.films });
    onCursor(null);
    if (reduce) return open();
    setOpening({ brand: b, at, rect: el.getBoundingClientRect() });
    window.setTimeout(() => {
      open();
      setOpening(null);
      setHover(null);
    }, OPEN_MS);
  };

  const state = up ? "shown" : "away";
  return (
    <>
      <div className={`${f.view} ${s.view} ${leaving ? s.viewLeave : ""}`} role="dialog" aria-modal="true" aria-label={`${drawer.label}: the brands`}>
        {/* the drawer, and the way back */}
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
          <button type="button" className={f.close} onClick={leave} tabIndex={up ? 0 : -1}>
            <span className={f.closeRoll}>
              <span>Close</span>
              <span aria-hidden="true">Close</span>
            </span>
            <span className={f.closeX} aria-hidden="true" />
          </button>
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

      {/* into the brand: the tile opens to the whole screen, washed in its colour */}
      <AnimatePresence>
        {opening && <Opening key="opening" brand={opening.brand} at={opening.at} rect={opening.rect} />}
      </AnimatePresence>

      {/* the brand's films, as the folders' line */}
      {opened && (
        <FileView
          key={opened.label}
          drawer={{ no: opened.no, label: opened.label, short: opened.label, films: opened.films, cat: drawer.cat }}
          start={0}
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
  const ref = useRef<HTMLButtonElement>(null);
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
      ref={ref}
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
      onClick={() => ref.current && onOpen(at, ref.current)}
      aria-label={`${brand.name}: ${n} ${n === 1 ? "film" : "films"}`}
    >
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

      {/* in the light: its name, the film showing, and its count */}
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
// the tile opens to the whole screen (a clip, so nothing stretches) on the
// film it was showing, washed in the brand's colour as it opens, the logo
// carried to the middle in white
// ---------------------------------------------------------------------------
function Opening({ brand, at, rect }: { brand: Brand; at: number; rect: DOMRect }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 0;
  const from = `inset(${rect.top}px ${vw - rect.right}px ${vh - rect.bottom}px ${rect.left}px)`;
  const to = `inset(${band}px 0px 0px 0px)`;
  const midY = band + (vh - band) / 2;
  const optical = OPTICAL[brand.logo.src] ?? 1;
  const reel = reelOf(brand.films[at]);
  return (
    <motion.div
      className={s.opening}
      initial={{ clipPath: from }}
      animate={{ clipPath: to }}
      exit={{ opacity: 0, transition: { duration: 0.55, delay: 0.15, ease: EASE } }}
      transition={OPEN}
      aria-hidden="true"
    >
      <span className={s.openingFilm}>
        {reel.still && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={s.still} src={reel.still} alt="" draggable={false} />
        )}
        <video ref={startMuted} className={`${s.film} ${s.filmOn}`} src={reel.clip} autoPlay muted loop playsInline />
      </span>
      {/* the brand's colour washes over its film */}
      <motion.span
        className={s.openingWash}
        style={{ background: brand.logo.hex }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.88 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
      />
      <motion.span
        className={s.openingMark}
        data-wide={brand.logo.wide || undefined}
        style={{ ...maskOf(brand.logo.src), top: midY }}
        initial={{ x: rect.left + rect.width / 2 - vw / 2, y: rect.top + rect.height / 2 - midY, scale: 0.5 * optical }}
        animate={{ x: 0, y: 0, scale: optical }}
        transition={OPEN}
      />
    </motion.div>
  );
}
