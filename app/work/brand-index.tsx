"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useSpring, type Transition, type Variants } from "framer-motion";
import { EASE, FilmStill } from "./_shared/chrome";
import { brandOf, CATEGORIES, logoOf, posterFor, type Project } from "./_shared/data";
import FileView, { type Drawer } from "./file-view";
import f from "./file.module.css";
import s from "./brand.module.css";

// ===========================================================================
// BRAND FILMS, BY BRAND — the Brand Films folder opens onto the brands it
// holds, set large as an index on the dark. Point at one and a picture of its
// film follows the pointer on a spring, its logo on it; the other names fall
// back. Click it and every film the studio made for that brand rises out as
// the folders' line (file-view.tsx) — its brand films and its TVCs together.
// Close the brand and the index comes back; close the index and the folder
// goes back down.
// ===========================================================================

type Brand = { name: string; films: Project[]; lead: Project; logo?: { src: string; wide: boolean }; kinds: string[] };

const ROW: Transition = { type: "spring", stiffness: 110, damping: 19, mass: 0.9 }; // a name rising in
const FOLLOW = { stiffness: 240, damping: 26, mass: 0.6 }; // the picture after the pointer
const LEAVE_MS = 420; // the names fall away, then the folder goes back down
const PREVIEW_W = 0.26; // the picture's width, of the screen's (clamped in the CSS)
const pad2 = (n: number) => String(n).padStart(2, "0");
const KIND = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

const rows: Variants = {
  hidden: { opacity: 0, y: 48 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { ...ROW, delay: 0.42 + i * 0.07 } }),
  away: (i: number) => ({ opacity: 0, y: -28, transition: { duration: 0.32, ease: EASE, delay: i * 0.03 } }),
};

const noop = () => () => {};
const usePointerFine = () => useSyncExternalStore(noop, () => window.matchMedia("(hover: hover) and (pointer: fine)").matches, () => true);

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
        return {
          name,
          films,
          lead: films.find((p) => posterFor(p)) ?? films[0],
          logo: films.map(logoOf).find(Boolean),
          kinds: [...new Set(films.map((p) => KIND[p.category]))],
        };
      })
      .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name));
  }, [drawer, pool]);
  const total = brands.reduce((n, b) => n + b.films.length, 0);

  const fine = usePointerFine();
  const [brand, setBrand] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const live = useRef({ brand: null as number | null, leaving: false });
  useEffect(() => {
    live.current.brand = brand;
    live.current.leaving = leaving;
  }, [brand, leaving]);

  const leave = useCallback(() => {
    if (live.current.leaving) return;
    live.current.leaving = true;
    setLeaving(true);
    setHover(null);
    onCursor(null);
    window.setTimeout(() => onClosed(start), reduce ? 0 : LEAVE_MS);
  }, [onClosed, onCursor, reduce, start, setHover]);

  // Esc (and the band's Back) closes the index — unless a brand is open: its line takes that one
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || live.current.brand !== null || document.body.style.overflow === "hidden") return;
      leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave]);

  // the picture follows the pointer, on a spring; kept clear of the screen's right edge
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const px = useSpring(x, FOLLOW);
  const py = useSpring(y, FOLLOW);
  const follow = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const w = Math.min(420, Math.max(260, window.innerWidth * PREVIEW_W));
    x.set(Math.min(e.clientX, window.innerWidth - w - 56));
    y.set(e.clientY);
  };

  const openBrand = (i: number) => {
    if (leaving) return;
    setHover(null);
    onCursor(null);
    setBrand(i);
  };

  const up = brand === null && !leaving;
  const b = brand !== null ? brands[brand] : null;
  return (
    <>
      <div className={`${f.view} ${s.view}`} role="dialog" aria-modal="true" aria-label={`${drawer.label}, by brand`}>
        {/* the drawer, and the way back */}
        <motion.div
          className={f.head}
          style={{ top: "var(--band)" }}
          initial={{ opacity: 0, y: -8 }}
          animate={up ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.6 : 0, ease: EASE }}
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

        <div className={s.body} onPointerMove={follow}>
          <motion.p
            className={s.top}
            initial={{ opacity: 0 }}
            animate={{ opacity: up ? 1 : 0 }}
            transition={{ duration: up ? 0.9 : 0.25, delay: up ? 0.5 : 0, ease: EASE }}
          >
            <span>By brand</span>
            <span>
              {pad2(brands.length)} brands · {pad2(total)} films
            </span>
          </motion.p>
          <ol className={`${s.list} ${hover !== null ? s.listFocus : ""}`} onPointerLeave={() => setHover(null)}>
            {brands.map((br, i) => (
              <motion.li
                key={br.name}
                custom={i}
                variants={rows}
                initial={reduce ? false : "hidden"}
                animate={up ? "shown" : "away"}
                className={hover === i ? s.rowOn : undefined}
              >
                <button
                  type="button"
                  className={s.row}
                  tabIndex={up ? 0 : -1}
                  onPointerEnter={(e) => e.pointerType === "mouse" && up && setHover(i)}
                  onFocus={(e) => e.currentTarget.matches(":focus-visible") && setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => openBrand(i)}
                  aria-label={`${br.name}: ${br.films.length} ${br.films.length === 1 ? "film" : "films"}`}
                >
                  <span className={s.no}>{pad2(i + 1)}</span>
                  <span className={s.name}>{br.name}</span>
                  <span className={s.kinds}>{br.kinds.join(" · ")}</span>
                  <span className={s.count}>
                    {pad2(br.films.length)} {br.films.length === 1 ? "film" : "films"}
                  </span>
                  <span className={s.arrow} aria-hidden="true">
                    →
                  </span>
                  {/* on a touch screen there's no pointing: each brand carries its picture */}
                  {!fine && (
                    <span className={s.thumb} aria-hidden="true">
                      <FilmStill film={br.lead} className={s.thumbImg} />
                    </span>
                  )}
                </button>
              </motion.li>
            ))}
          </ol>
        </div>

        {/* the picture after the pointer: one per brand, stacked, the one pointed at shown */}
        {fine && (
          <motion.div className={s.preview} style={{ x: px, y: py }} aria-hidden="true">
            <motion.div
              className={s.pvBox}
              initial={false}
              animate={hover !== null && up ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.86, rotate: -2 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 22, mass: 0.7 }}
            >
              {brands.map((br, i) => (
                <span key={br.name} className={`${s.pv} ${hover === i ? s.pvOn : ""}`}>
                  <FilmStill film={br.lead} className={s.pvImg} />
                  <span className={s.pvShade} />
                  {br.logo && (
                    <span
                      className={s.pvLogo}
                      data-wide={br.logo.wide || undefined}
                      style={{ maskImage: `url(${br.logo.src})`, WebkitMaskImage: `url(${br.logo.src})` }}
                    />
                  )}
                </span>
              ))}
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* a brand open: all its work, as the folders' line */}
      {b && brand !== null && (
        <FileView
          key={b.name}
          drawer={{ no: pad2(brand + 1), label: b.name, short: b.name, films: b.films, cat: drawer.cat }}
          start={0}
          reduce={reduce}
          onPlay={onPlay}
          onCursor={onCursor}
          onClosed={() => setBrand(null)}
        />
      )}
    </>
  );
}
