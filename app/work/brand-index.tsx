"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, type Transition, type Variants } from "framer-motion";
import { EASE } from "./_shared/chrome";
import { brandOf, logoOf, type Logo, type Project } from "./_shared/data";
import FileView from "./file-view";
import type { Drawer } from "./file-view";
import f from "./file.module.css";
import s from "./brand.module.css";

// ===========================================================================
// BRAND FILMS — THE BRAND WALL. The room itself is the wall: on black, six
// equal tiles from edge to edge of the screen, joined with no line between
// them, each holding a brand's logo in its own colours (the versions it
// wears on dark). The tiles come in one by one, the logos rising into place.
// A soft light follows the pointer over the wall. The tile pointed at lights
// up in its brand's colour from where the pointer is, its edges catching the
// same light, and its logo comes forward and leans toward the pointer on a
// spring while the other logos fall back. Click it
// and the brand's colour opens from the tile to the whole screen, the logo
// carried to the middle — then every film the studio made for that brand
// rises out of the dark (file-view.tsx). Brands without a logo file yet stay
// off the wall until one comes in.
// ===========================================================================

type Brand = { name: string; films: Project[]; logo: Logo };
type Opened = { label: string; no: string; films: Project[] };

const ARRIVE: Transition = { type: "spring", stiffness: 80, damping: 15, mass: 1 }; // a tile coming in
const TILT = { stiffness: 150, damping: 15, mass: 0.5 };
const LIGHT = { stiffness: 120, damping: 22, mass: 0.6 }; // the light after the pointer
const OPEN: Transition = { type: "spring", stiffness: 58, damping: 17, mass: 1 }; // a tile to the whole screen
const OPEN_MS = 760;
const LEAVE_MS = 420;
const pad2 = (n: number) => String(n).padStart(2, "0");
const maskOf = (src: string) => ({ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` });

// each logo's optical size, so they sit at one weight: a wordmark in a square file reads small,
// a solid square heavy
const OPTICAL: Record<string, number> = {
  "/brands/etihad-airways.svg": 1.35,
  "/brands/what3words.svg": 0.72,
  "/brands/bmw.svg": 0.9,
  "/brands/rolls-royce.svg": 0.86,
};
// the light a tile takes on: its brand's colour, lifted where that colour is too deep to glow on black
const GLOW: Record<string, string> = {
  "/brands/rolls-royce.svg": "#8e74c4",
  "/brands/masdar.png": "#4f8fd0",
};

const delayOf = (i: number) => 0.25 + (i % 3) * 0.09 + Math.floor(i / 3) * 0.12;
const tiles: Variants = {
  hidden: { opacity: 0 },
  shown: (i: number) => ({ opacity: 1, transition: { duration: 0.9, ease: EASE, delay: delayOf(i) } }),
  away: (i: number) => ({ opacity: 0, transition: { duration: 0.3, ease: EASE, delay: i * 0.025 } }),
};
// the logo rising into its tile, after the tile
const marks: Variants = {
  hidden: { opacity: 0, scale: 0.86, y: 26 },
  shown: (i: number) => ({ opacity: 1, scale: 1, y: 0, transition: { ...ARRIVE, delay: delayOf(i) + 0.15 } }),
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
  // the brands with a logo, most films first; each with all its work in this format, brand films leading
  const brands = useMemo<Brand[]>(() => {
    const names = [...new Set(pool.map(brandOf).filter(Boolean))];
    return names
      .map((name) => {
        const all = pool.filter((p) => brandOf(p) === name);
        const films = [...all.filter((p) => drawer.films.includes(p)), ...all.filter((p) => !drawer.films.includes(p))];
        return { name, films, logo: films.map(logoOf).find(Boolean)! };
      })
      .filter((b) => b.logo?.dark)
      .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
  }, [drawer, pool]);

  const [hover, setHover] = useState<number | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [opening, setOpening] = useState<{ brand: Brand; rect: DOMRect } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const up = opened === null && opening === null && !leaving;
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

  // into the brand: its colour opens from the tile to the whole screen
  const enter = (k: number, el: HTMLElement) => {
    if (!up) return;
    const b = brands[k];
    const open = () => setOpened({ label: b.name, no: pad2(k + 1), films: b.films });
    onCursor(null);
    if (reduce) return open();
    setOpening({ brand: b, rect: el.getBoundingClientRect() });
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
          className={f.head}
          style={{ top: "var(--band)" }}
          initial={{ opacity: 0, y: -8 }}
          animate={up ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.5 : 0, ease: EASE }}
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
            {/* a soft light after the pointer, over the wall */}
            <motion.span className={`${s.light} ${lit && up ? s.lightOn : ""}`} style={{ x: lightX, y: lightY }} aria-hidden="true" />
            <ul className={`${s.wall} ${hover !== null ? s.wallFocus : ""}`} onPointerLeave={() => setHover(null)}>
              {brands.map((b, k) => (
                <motion.li
                  key={b.name}
                  custom={k}
                  variants={tiles}
                  initial={reduce ? false : "hidden"}
                  animate={state}
                  className={hover === k ? s.on : undefined}
                  style={{ ["--glow" as string]: GLOW[b.logo.src] ?? b.logo.hex } as CSSProperties}
                >
                  <Tile
                    brand={b}
                    k={k}
                    tabbable={up}
                    reduce={reduce}
                    onEnter={() => up && setHover(k)}
                    onLeave={() => setHover((h) => (h === k ? null : h))}
                    onOpen={(el) => enter(k, el)}
                  />
                </motion.li>
              ))}
            </ul>
          <span className={s.vignette} aria-hidden="true" />
        </div>
      </div>

      {/* into the brand: the tile opens to the whole screen in its colour */}
      <AnimatePresence>{opening && <Opening key="opening" brand={opening.brand} rect={opening.rect} />}</AnimatePresence>

      {/* the brand's films (or all of Brand Films), as the folders' line */}
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
// one tile: the logo in its colours on the dark; pointed at, it lights up in
// the brand's colour from where the pointer is, leans toward it, and the
// logo comes forward
// ---------------------------------------------------------------------------
function Tile({
  brand,
  k,
  tabbable,
  reduce,
  onEnter,
  onLeave,
  onOpen,
}: {
  brand: Brand;
  k: number;
  tabbable: boolean;
  reduce: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onOpen: (el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, TILT);
  const y = useSpring(my, TILT);

  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    // where the light sits on the tile
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
  const n = brand.films.length;
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
      onClick={() => ref.current && onOpen(ref.current)}
      aria-label={`${brand.name}: ${n} ${n === 1 ? "film" : "films"}`}
    >
      <motion.span className={s.logoBox} data-wide={brand.logo.wide || undefined} style={{ x, y }} aria-hidden="true">
        <motion.span className={s.rise} variants={marks} custom={k}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.logo} src={brand.logo.dark} alt="" draggable={false} style={{ scale: String(OPTICAL[brand.logo.src] ?? 1) }} />
        </motion.span>
      </motion.span>
      <span className={s.count} aria-hidden="true">
        {pad2(n)} {n === 1 ? "film" : "films"} <i>→</i>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// the tile opens to the whole screen in the brand's colour (a clip, so
// nothing stretches), its logo carried to the middle in white, larger
// ---------------------------------------------------------------------------
function Opening({ brand, rect }: { brand: Brand; rect: DOMRect }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 0;
  const from = `inset(${rect.top}px ${vw - rect.right}px ${vh - rect.bottom}px ${rect.left}px round 0px)`;
  const to = `inset(${band}px 0px 0px 0px round 0px)`;
  const midY = band + (vh - band) / 2;
  const optical = OPTICAL[brand.logo.src] ?? 1;
  return (
    <motion.div
      className={s.opening}
      style={{ background: brand.logo.hex }}
      initial={{ clipPath: from }}
      animate={{ clipPath: to }}
      exit={{ opacity: 0, transition: { duration: 0.55, delay: 0.15, ease: EASE } }}
      transition={OPEN}
      aria-hidden="true"
    >
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
