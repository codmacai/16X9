"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, type Transition, type Variants } from "framer-motion";
import { EASE, EASE_CINE } from "./_shared/chrome";
import { brandOf, logoOf, type Logo, type Project } from "./_shared/data";
import FileView from "./file-view";
import type { Drawer } from "./file-view";
import f from "./file.module.css";
import s from "./brand.module.css";

// ===========================================================================
// BRAND FILMS — THE BRAND WALL. The brands' logos, each in its own colours,
// on a white wall: one plaque each, three across, hairlines between. Point
// at one and its plaque takes a breath of the brand's colour, the logo comes
// forward, a line in that colour draws along its foot and its films are
// counted; the others quieten. Click it and the brand's colour floods out
// from the logo over the wall, the logo carried to the middle in white —
// then every film the studio made for that brand rises out of the dark
// (file-view.tsx). Brands without a logo file yet stay off the wall; "All
// brand films" holds every one.
// ===========================================================================

type Brand = { name: string; films: Project[]; logo: Logo };
type Opened = { label: string; no: string; films: Project[] };

const PLAQUE: Transition = { type: "spring", stiffness: 90, damping: 16, mass: 1 }; // the wall putting itself up
const FLOOD_MS = 780; // the colour has filled the screen: the films rise
const LEAVE_MS = 420;
const pad2 = (n: number) => String(n).padStart(2, "0");

// each logo's optical size, so they hang at one weight: a wordmark in a square file reads small,
// a solid square heavy
const OPTICAL: Record<string, number> = {
  "/brands/etihad-airways.svg": 1.35,
  "/brands/what3words.svg": 0.72,
  "/brands/bmw.svg": 0.9,
  "/brands/masdar.png": 1,
};

const plaques: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  shown: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { ...PLAQUE, delay: 0.3 + (i % 3) * 0.07 + Math.floor(i / 3) * 0.12 } }),
  away: (i: number) => ({ opacity: 0, y: 0, scale: 0.98, transition: { duration: 0.3, ease: EASE, delay: i * 0.025 } }),
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
      .filter((b) => b.logo?.colour)
      .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
  }, [drawer, pool]);
  const total = brands.reduce((n, b) => n + b.films.length, 0);

  const [hover, setHover] = useState<number | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [flood, setFlood] = useState<{ brand: Brand; x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const up = opened === null && flood === null && !leaving;
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

  // into the brand: its colour floods out from the logo
  const enter = (k: number, el: HTMLElement) => {
    if (!up) return;
    const b = brands[k];
    const open = () => setOpened({ label: b.name, no: pad2(k + 1), films: b.films });
    setHover(null);
    onCursor(null);
    if (reduce) return open();
    const r = (el.querySelector(`.${s.logo}`) ?? el).getBoundingClientRect();
    setFlood({ brand: b, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    window.setTimeout(() => {
      open();
      setFlood(null);
    }, FLOOD_MS);
  };
  const all = () => {
    if (!up) return;
    onCursor(null);
    setOpened({ label: drawer.label, no: drawer.no, films: drawer.films });
  };

  return (
    <>
      {/* the wall; dark while a brand's films are out over it */}
      <div className={`${f.view} ${s.view} ${opened || flood ? s.viewOut : ""} ${leaving ? s.viewLeave : ""}`} role="dialog" aria-modal="true" aria-label={`${drawer.label}: the brands`}>
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

          <ul className={`${s.wall} ${hover !== null ? s.wallFocus : ""}`} onPointerLeave={() => setHover(null)}>
            {brands.map((b, k) => {
              const n = b.films.length;
              return (
                <motion.li
                  key={b.name}
                  custom={k}
                  variants={plaques}
                  initial={reduce ? false : "hidden"}
                  animate={up ? "shown" : "away"}
                  className={hover === k ? s.on : undefined}
                  style={{ ["--hex" as string]: b.logo.hex } as CSSProperties}
                >
                  <button
                    type="button"
                    className={s.plaque}
                    tabIndex={up ? 0 : -1}
                    onPointerEnter={(e) => e.pointerType === "mouse" && up && setHover(k)}
                    onFocus={(e) => e.currentTarget.matches(":focus-visible") && setHover(k)}
                    onBlur={() => setHover(null)}
                    onClick={(e) => enter(k, e.currentTarget)}
                    aria-label={`${b.name}: ${n} ${n === 1 ? "film" : "films"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={s.logo}
                      data-wide={b.logo.wide || undefined}
                      src={b.logo.colour}
                      alt=""
                      draggable={false}
                      style={{ scale: String(OPTICAL[b.logo.src] ?? 1) }}
                    />
                    <span className={s.no} aria-hidden="true">
                      {pad2(k + 1)}
                    </span>
                    <span className={s.count} aria-hidden="true">
                      {pad2(n)} {n === 1 ? "film" : "films"} <i>→</i>
                    </span>
                    <span className={s.rule} aria-hidden="true" />
                  </button>
                </motion.li>
              );
            })}
          </ul>

          <motion.button
            type="button"
            className={s.all}
            onClick={all}
            tabIndex={up ? 0 : -1}
            initial={{ opacity: 0 }}
            animate={{ opacity: up ? 1 : 0 }}
            transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.8 : 0, ease: EASE }}
          >
            All brand films <span>{pad2(drawer.films.length)}</span> <i aria-hidden="true">→</i>
          </motion.button>
        </div>
      </div>

      {/* into the brand: its colour floods out from the logo, the logo carried to the middle in white */}
      <AnimatePresence>{flood && <Flood key="flood" brand={flood.brand} x={flood.x} y={flood.y} />}</AnimatePresence>

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

function Flood({ brand, x, y }: { brand: Brand; x: number; y: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 0;
  const r = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
  const midY = band + (vh - band) / 2;
  const mask = { maskImage: `url(${brand.logo.src})`, WebkitMaskImage: `url(${brand.logo.src})` };
  return (
    <motion.div
      className={s.flood}
      style={{ background: brand.logo.hex }}
      initial={{ clipPath: `circle(0px at ${x}px ${y}px)` }}
      animate={{ clipPath: `circle(${r}px at ${x}px ${y}px)` }}
      exit={{ opacity: 0, transition: { duration: 0.55, delay: 0.15, ease: EASE } }}
      transition={{ duration: 0.85, ease: EASE_CINE }}
      aria-hidden="true"
    >
      <motion.span
        className={s.floodMark}
        data-wide={brand.logo.wide || undefined}
        style={{ ...mask, top: midY }}
        initial={{ x: x - vw / 2, y: y - midY, scale: 0.6 }}
        animate={{ x: 0, y: 0, scale: OPTICAL[brand.logo.src] ?? 1 }}
        transition={{ type: "spring", stiffness: 55, damping: 16 }}
      />
    </motion.div>
  );
}
