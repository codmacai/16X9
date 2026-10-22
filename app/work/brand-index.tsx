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
// BRAND FILMS — THE BRAND WALL. On black: the brands' logos in their own
// colours (the versions they use on dark), one to a tile, every tile the
// same size, three across. A soft light follows the pointer over the wall.
// The tile pointed at lights up in its brand's colour from where the pointer
// is, its edge catching the same light; it leans toward the pointer and its
// logo comes forward, both on springs; the other tiles fall back. Click it
// and the brand's colour opens from the tile to the whole screen, the logo
// carried to the middle — then every film the studio made for that brand
// rises out of the dark (file-view.tsx). Brands without a logo file yet stay
// off the wall; "All brand films" holds every one.
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

const tiles: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.94 },
  shown: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { ...ARRIVE, delay: 0.3 + (i % 3) * 0.08 + Math.floor(i / 3) * 0.1 } }),
  away: (i: number) => ({ opacity: 0, y: 0, scale: 0.97, transition: { duration: 0.3, ease: EASE, delay: i * 0.025 } }),
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
  const all = () => {
    if (!up) return;
    onCursor(null);
    setOpened({ label: drawer.label, no: drawer.no, films: drawer.films });
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

        <div className={s.body}>
          <motion.header
            className={s.top}
            initial={{ opacity: 0, y: 12 }}
            animate={up ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
            transition={up ? { ...ARRIVE, delay: 0.2 } : { duration: 0.25, ease: EASE }}
          >
            <h2 className={s.title}>Brands on film</h2>
            <button type="button" className={s.all} onClick={all} tabIndex={up ? 0 : -1}>
              All brand films <span>{pad2(drawer.films.length)}</span> <i aria-hidden="true">→</i>
            </button>
          </motion.header>

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
                    tabbable={up}
                    reduce={reduce}
                    onEnter={() => up && setHover(k)}
                    onLeave={() => setHover((h) => (h === k ? null : h))}
                    onOpen={(el) => enter(k, el)}
                  />
                </motion.li>
              ))}
            </ul>
          </div>
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
  tabbable,
  reduce,
  onEnter,
  onLeave,
  onOpen,
}: {
  brand: Brand;
  tabbable: boolean;
  reduce: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onOpen: (el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(rx, TILT);
  const rotateY = useSpring(ry, TILT);
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
    ry.set((px - 0.5) * 10);
    rx.set(-(py - 0.5) * 8);
    mx.set((px - 0.5) * 18);
    my.set((py - 0.5) * 14);
  };
  const leave = () => {
    rx.set(0);
    ry.set(0);
    mx.set(0);
    my.set(0);
    onLeave();
  };
  const n = brand.films.length;
  return (
    <motion.button
      ref={ref}
      type="button"
      className={s.tile}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.logo} src={brand.logo.dark} alt="" draggable={false} style={{ scale: String(OPTICAL[brand.logo.src] ?? 1) }} />
      </motion.span>
      <span className={s.count} aria-hidden="true">
        {pad2(n)} {n === 1 ? "film" : "films"} <i>→</i>
      </span>
    </motion.button>
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
