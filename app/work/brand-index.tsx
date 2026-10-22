"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, type Transition, type Variants } from "framer-motion";
import { EASE, FilmStill } from "./_shared/chrome";
import { brandOf, clipFor, logoOf, posterFor, type Project } from "./_shared/data";
import FileView, { type Drawer } from "./file-view";
import f from "./file.module.css";
import s from "./brand.module.css";

// ===========================================================================
// BRAND FILMS, BY BRAND — every logo is a window onto the work.
//
// The Brand Films folder opens onto a wall of its brands' logos on the dark:
// the brand with the most films takes the large tile, the others sit beside
// it; the logos rest in paper, a slow light passing over each in turn. Point
// at one and its tile opens like an iris from where the pointer came in, onto
// the brand's own film playing behind the logo; the tile leans toward the
// pointer on a spring, the other logos fall back, and the room takes on a
// faint wash of that film's light. Click it and the tile opens to the whole
// screen — through the logo, into the brand — and every film the studio made
// for it rises over that as the folders' line (file-view.tsx): its brand
// films and its TVCs together. Close steps back a level at a time.
// A brand without a logo file yet shows its name, set as a mark.
// ===========================================================================

type Brand = { name: string; films: Project[]; lead: Project; clip?: string; logo?: { src: string; wide: boolean } };

const ASSEMBLE: Transition = { type: "spring", stiffness: 90, damping: 16, mass: 1 }; // the wall putting itself up
const TILT = { stiffness: 160, damping: 18, mass: 0.5 };
const OPEN: Transition = { type: "spring", stiffness: 60, damping: 17, mass: 1 }; // the tile to the whole screen
const OPEN_MS = 720; // by then the screen is the brand's: its films rise
const LEAVE_MS = 420; // the wall comes down, then the folder goes back
const pad2 = (n: number) => String(n).padStart(2, "0");

const tiles: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 44 },
  shown: (i: number) => ({ opacity: 1, scale: 1, y: 0, transition: { ...ASSEMBLE, delay: 0.32 + i * 0.08 } }),
  away: (i: number) => ({ opacity: 0, scale: 0.96, y: 0, transition: { duration: 0.34, ease: EASE, delay: i * 0.03 } }),
};

const noop = () => () => {};
const usePointerFine = () => useSyncExternalStore(noop, () => window.matchMedia("(hover: hover) and (pointer: fine)").matches, () => true);

const maskOf = (src: string) => ({ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` });

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
  // the brands in the drawer, most films first; each with all its work in this format, its brand films leading
  const brands = useMemo<Brand[]>(() => {
    const names = [...new Set(drawer.films.map(brandOf).filter(Boolean))];
    return names
      .map((name) => {
        const own = drawer.films.filter((p) => brandOf(p) === name);
        const films = [...own, ...pool.filter((p) => brandOf(p) === name && !own.includes(p))];
        const lead = films.find((p) => posterFor(p)) ?? films[0];
        return { name, films, lead, clip: clipFor(lead), logo: films.map(logoOf).find(Boolean) };
      })
      .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
  }, [drawer, pool]);
  const total = brands.reduce((n, b) => n + b.films.length, 0);

  const fine = usePointerFine();
  const [hover, setHover] = useState<number | null>(null);
  const [opening, setOpening] = useState<{ i: number; rect: DOMRect } | null>(null);
  const [brand, setBrand] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const live = useRef({ busy: false, leaving: false });
  useEffect(() => {
    live.current.busy = brand !== null || opening !== null;
    live.current.leaving = leaving;
  }, [brand, opening, leaving]);

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

  // through the logo, into the brand
  const openBrand = (i: number, el: HTMLElement) => {
    if (leaving || opening || brand !== null) return;
    setHover(null);
    onCursor(null);
    if (reduce) return setBrand(i);
    setOpening({ i, rect: el.getBoundingClientRect() });
    // the films rise over the brand's screen as it fades to the dark they sit on
    window.setTimeout(() => {
      setBrand(i);
      setOpening(null);
    }, OPEN_MS);
  };
  const closeBrand = () => {
    setBrand(null);
    setOpening(null);
  };

  const up = brand === null && opening === null && !leaving;
  const b = brand !== null ? brands[brand] : null;
  return (
    <>
      <div className={`${f.view} ${s.view}`} role="dialog" aria-modal="true" aria-label={`${drawer.label}, by brand`}>
        {/* the room takes on a faint wash of the film pointed at */}
        {fine && (
          <div className={s.ambient} aria-hidden="true">
            {brands.map((br, i) => {
              const shot = posterFor(br.lead);
              return shot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={br.name} className={`${s.amb} ${hover === i && up ? s.ambOn : ""}`} src={shot} alt="" draggable={false} decoding="async" />
              ) : null;
            })}
          </div>
        )}

        {/* the drawer, and the way back */}
        <motion.div
          className={f.head}
          style={{ top: "var(--band)" }}
          initial={{ opacity: 0, y: -8 }}
          animate={up ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.55 : 0, ease: EASE }}
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

        <div className={s.body}>
          <motion.p
            className={s.top}
            initial={{ opacity: 0 }}
            animate={{ opacity: up ? 1 : 0 }}
            transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.45 : 0, ease: EASE }}
          >
            <span>The brands</span>
            <span>
              {pad2(brands.length)} brands · {pad2(total)} films
            </span>
          </motion.p>
          <ul className={s.wall}>
            {brands.map((br, i) => (
              <motion.li key={br.name} custom={i} variants={tiles} initial={reduce ? false : "hidden"} animate={up ? "shown" : "away"}>
                <Tile
                  brand={br}
                  i={i}
                  fine={fine}
                  reduce={reduce}
                  on={hover === i && up}
                  dim={hover !== null && hover !== i && up}
                  tabbable={up}
                  onEnter={() => up && setHover(i)}
                  onLeave={() => setHover((h) => (h === i ? null : h))}
                  onOpen={(el) => openBrand(i, el)}
                />
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* the tile opening to the whole screen, the logo carried to its middle */}
      <AnimatePresence>
        {opening && (
          <Opening key="opening" brand={brands[opening.i]} rect={opening.rect} />
        )}
      </AnimatePresence>

      {/* a brand open: all its work, as the folders' line */}
      {b && brand !== null && (
        <FileView
          key={b.name}
          drawer={{ no: pad2(brand + 1), label: b.name, short: b.name, films: b.films, cat: drawer.cat }}
          start={0}
          reduce={reduce}
          onPlay={onPlay}
          onCursor={onCursor}
          onClosed={closeBrand}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// one brand's tile: its logo (or its name, set as a mark) on the dark; pointed
// at, an iris opens from where the pointer came in onto its film, playing
// ---------------------------------------------------------------------------
function Tile({
  brand,
  i,
  fine,
  reduce,
  on,
  dim,
  tabbable,
  onEnter,
  onLeave,
  onOpen,
}: {
  brand: Brand;
  i: number;
  fine: boolean;
  reduce: boolean;
  on: boolean;
  dim: boolean;
  tabbable: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onOpen: (el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, TILT);
  const rotateY = useSpring(ry, TILT);

  // where the pointer is on the tile, 0..1
  const at = (e: ReactPointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const enter = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    const [x, y] = at(e);
    // the iris opens from the edge the pointer crossed
    e.currentTarget.style.setProperty("--x", `${(x * 100).toFixed(1)}%`);
    e.currentTarget.style.setProperty("--y", `${(y * 100).toFixed(1)}%`);
    onEnter();
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse" || reduce) return;
    const [x, y] = at(e);
    ry.set((x - 0.5) * 7);
    rx.set(-(y - 0.5) * 6);
  };
  const leave = () => {
    rx.set(0);
    ry.set(0);
    onLeave();
  };

  const n = brand.films.length;
  return (
    <motion.button
      ref={ref}
      type="button"
      className={`${s.tile} ${on ? s.tileOn : ""} ${dim ? s.tileDim : ""}`}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
      tabIndex={tabbable ? 0 : -1}
      onPointerEnter={enter}
      onPointerMove={move}
      onPointerLeave={leave}
      onFocus={(e) => e.currentTarget.matches(":focus-visible") && onEnter()}
      onBlur={onLeave}
      onClick={() => ref.current && onOpen(ref.current)}
      aria-label={`${brand.name}: ${n} ${n === 1 ? "film" : "films"}`}
    >
      {/* its film, behind the logo: opened by the iris (on a touch screen, always faintly there) */}
      <span className={s.film} aria-hidden="true">
        <FilmStill film={brand.lead} className={s.still} />
        {on && fine && brand.clip && <video className={s.still} src={brand.clip} autoPlay muted loop playsInline />}
        <span className={s.shade} />
      </span>

      {brand.logo ? (
        <span className={s.logo} data-wide={brand.logo.wide || undefined} style={{ ...maskOf(brand.logo.src), ["--i" as string]: i }} aria-hidden="true" />
      ) : (
        <span className={s.word} aria-hidden="true">
          {brand.name}
        </span>
      )}

      <span className={s.no} aria-hidden="true">
        {pad2(i + 1)}
      </span>
      <span className={s.meta} aria-hidden="true">
        <span className={s.mName}>{brand.name}</span>
        <span className={s.mCount}>
          {pad2(n)} {n === 1 ? "film" : "films"} <i>→</i>
        </span>
      </span>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// the tile opens to the whole screen: its film widens out from the tile's
// place (a clip, not a stretch: the picture never distorts) and the logo is
// carried to the middle of the screen, larger, then the films rise over it
// ---------------------------------------------------------------------------
function Opening({ brand, rect }: { brand: Brand; rect: DOMRect }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 0;
  const inset = (t: number, r: number, b: number, l: number, round: number) => `inset(${t}px ${r}px ${b}px ${l}px round ${round}px)`;
  const from = inset(rect.top, vw - rect.right, vh - rect.bottom, rect.left, 4);
  const to = inset(band, 0, 0, 0, 0);
  // the logo: from the tile's middle to the screen's
  const cx = rect.left + rect.width / 2 - vw / 2;
  const cy = rect.top + rect.height / 2 - (band + (vh - band) / 2);
  return (
    <motion.div
      className={s.opening}
      initial={{ clipPath: from }}
      animate={{ clipPath: to }}
      exit={{ opacity: 0, transition: { duration: 0.6, delay: 0.25, ease: EASE } }}
      transition={OPEN}
      aria-hidden="true"
    >
      <span className={s.openingFilm}>
        <FilmStill film={brand.lead} className={s.still} />
        {brand.clip && <video className={s.still} src={brand.clip} autoPlay muted loop playsInline />}
        <span className={s.shade} />
      </span>
      {brand.logo ? (
        <motion.span
          className={s.openingLogo}
          data-wide={brand.logo.wide || undefined}
          style={{ ...maskOf(brand.logo.src), top: `calc(${band}px + (100% - ${band}px) / 2)` }}
          initial={{ x: cx, y: cy, scale: 0.42 }}
          animate={{ x: 0, y: 0, scale: 1 }}
          transition={OPEN}
        />
      ) : (
        <motion.span
          className={s.openingWord}
          style={{ top: `calc(${band}px + (100% - ${band}px) / 2)` }}
          initial={{ x: cx, y: cy, scale: 0.6 }}
          animate={{ x: 0, y: 0, scale: 1 }}
          transition={OPEN}
        >
          {brand.name}
        </motion.span>
      )}
    </motion.div>
  );
}
