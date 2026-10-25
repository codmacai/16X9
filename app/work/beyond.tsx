"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import RoomSwitch from "../hero4/room-switch";
import { Band, EASE, EASE_CINE, rootClass } from "./_shared/chrome";
import { BEYOND_CATEGORIES, BEYOND_FILMS, stillFor, type BeyondFilm } from "./_shared/data";
import { takeDoor, type Entry } from "./_shared/door";
import { startMuted } from "./brand-shared";
import s from "./beyond.module.css";

// ===========================================================================
// WORK, BEYOND — the studio's top service, a project at a time, each a
// video card the size of the room: the film the whole card, in a dark gate
// with a little grain, and on it only its eyebrow (the category), its name,
// large, and Explore, which opens the film to the whole screen. All of it in
// the site's own type: Arial, upper case, the eyebrow tracked wide, the name
// set large and light.
//
// The cards stand in a deck: scroll (the wheel, the arrows, a swipe) and
// the deck springs to the next, the card leaving falling back as the next
// settles, its film easing in and its words rising in once it's there. Across the head, the
// categories as the landing's index line, each with its count, a fine line
// under the one on show sliding to the one you pick: picking one springs
// the deck to its first project.
//
// Come in through hero 8's door and the page arrives as the door's own dark,
// its hairline of light down the middle, then the dark parts from the line
// like a door onto the page — its words rising as it opens. Come in from hero
// 9's panel and it arrives as that panel, filling the screen, which lifts away
// off the top onto the page.
// ===========================================================================

const N = BEYOND_FILMS.length;
const GAP = 28; // px between one card and the next in the deck
const DECK: Transition = { type: "spring", stiffness: 80, damping: 13, mass: 1 }; // the deck, springing on: a touch past, then settling
const pad2 = (n: number) => String(n).padStart(2, "0");
// through the door or out of the light (ms from arriving): the words start to rise as it opens,
// and it's gone (the door's halves part over 1.2s from 0.15s, the panel lifts over 1s from
// 0.15s; beyond.module.css)
const DOOR = { words: 450, gone: 1450 };
const firstOf = (cat: number) => BEYOND_FILMS.findIndex((f) => f.cat === cat);
const filmsOf = (cat: number) => BEYOND_FILMS.filter((f) => f.cat === cat);

// a card's words rise in once it has settled, one after another
const WORDS: Variants = { out: {}, in: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } } };
const RISE: Variants = { out: { opacity: 0, y: 18 }, in: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } } };
const LINE: Variants = { out: { y: "108%" }, in: { y: "0%", transition: { duration: 1.1, ease: EASE } } };

type Rect = { top: number; left: number; width: number; height: number };

export default function Beyond() {
  const reduce = !!useReducedMotion();
  const router = useRouter();
  const [at, setAt] = useState(0);
  const film = BEYOND_FILMS[at];
  const go = useCallback((to: number) => setAt(Math.max(0, Math.min(N - 1, to))), []);
  const [full, setFull] = useState<Rect | null>(null);

  // come in from the home: through hero 8's door (the dark, parting from its line onto the page)
  // or from hero 9's panel (filling the screen, lifting away onto the page); the card's words wait for it.
  // A fixed run, on timers: it always clears, whatever the browser does.
  const [door, setDoor] = useState<"shut" | "opening" | null>(null);
  const [entry, setEntry] = useState<Entry>("door");
  useLayoutEffect(() => {
    const e = takeDoor();
    if (!e || reduce) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the home's note is only in the browser; read before the first paint
    setEntry(e);
    setDoor("shut");
  }, [reduce]);
  useEffect(() => {
    if (door !== "shut") return;
    const a = window.setTimeout(() => setDoor("opening"), DOOR.words);
    return () => window.clearTimeout(a);
  }, [door]);
  useEffect(() => {
    if (door !== "opening") return;
    const b = window.setTimeout(() => setDoor(null), DOOR.gone - DOOR.words);
    return () => window.clearTimeout(b);
  }, [door]);

  // the deck's height, so it can spring a card's height at a time
  const deckRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the wheel and the arrows: a card a turn (a trackpad's long glide counts once)
  const atRef = useRef(at);
  useEffect(() => {
    atRef.current = at;
  }, [at]);
  useEffect(() => {
    if (full || door) return;
    let last = 0;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 4) return;
      e.preventDefault();
      const now = performance.now();
      const quiet = now - last > 300;
      last = now;
      if (quiet) go(atRef.current + (d > 0 ? 1 : -1));
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown") go(atRef.current + 1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") go(atRef.current - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
    };
  }, [full, door, go]);

  // a swipe up or down the card
  const swipe = useRef<{ x: number; y: number } | null>(null);

  // on a phone the line runs across: the category on show kept in view (the line alone scrolls)
  const catsRef = useRef<HTMLElement>(null);
  const catOn = film.cat;
  useEffect(() => {
    const row = catsRef.current;
    if (!row || row.scrollWidth <= row.clientWidth + 1) return;
    const el = row.querySelector<HTMLElement>("[aria-current]");
    if (el) row.scrollTo({ left: el.offsetLeft - 12, behavior: reduce ? "auto" : "smooth" });
  }, [catOn, reduce]);

  return (
    <main className={`${rootClass} ${s.page}`}>
      <Band
        crumb="Index"
        workHref="/work?format=beyond"
        center={<RoomSwitch room="beyond" onSwitch={(k) => router.replace(`/work?format=${k}`, { scroll: false })} tone="light" />}
      />

      <div className={s.room}>
        {/* across the head: the categories, as the landing's index line */}
        <nav ref={catsRef} className={s.cats} aria-label="Categories">
          {BEYOND_CATEGORIES.map((c, i) => (
            <Fragment key={c.name}>
              {i > 0 && (
                <span className={s.slash} aria-hidden="true">
                  /
                </span>
              )}
              <span className={s.catMask}>
                <motion.button
                  type="button"
                  className={`${s.cat} ${i === film.cat ? s.catOn : ""}`}
                  onClick={() => go(firstOf(i))}
                  aria-current={i === film.cat || undefined}
                  aria-label={`${c.name}, ${filmsOf(i).length} projects`}
                  initial={reduce ? false : { y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ type: "spring", visualDuration: 0.9, bounce: 0.18, delay: 0.15 + i * 0.07 }}
                >
                  {c.short}
                  <sup>{pad2(filmsOf(i).length)}</sup>
                  {i === film.cat && <motion.i layoutId="beyond-line" className={s.catLine} transition={{ type: "spring", stiffness: 380, damping: 32 }} aria-hidden="true" />}
                </motion.button>
              </span>
            </Fragment>
          ))}
        </nav>

        {/* the deck: the card on show, the others above and below it, a spring away */}
        <div
          ref={deckRef}
          className={s.deck}
          onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const s0 = swipe.current;
            swipe.current = null;
            if (!s0) return;
            const dy = e.clientY - s0.y;
            const dx = e.clientX - s0.x;
            const d = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
            if (Math.abs(d) > 50) go(at + (d < 0 ? 1 : -1));
          }}
        >
          <motion.div className={s.track} initial={false} animate={{ y: -at * (h + GAP) }} transition={reduce ? { duration: 0 } : DECK}>
            {BEYOND_FILMS.map((f, k) => (
              <div key={f.clip} className={s.slot} style={{ top: k * (h + GAP), height: h }} aria-hidden={k !== at}>
                <motion.div
                  className={s.slotIn}
                  initial={false}
                  animate={{ scale: k === at ? 1 : 0.9, opacity: Math.abs(k - at) > 1 ? 0 : k === at ? 1 : 0.35 }}
                  transition={reduce ? { duration: 0 } : DECK}
                  style={{ visibility: full && k === at ? "hidden" : undefined }}
                >
                  {Math.abs(k - at) <= 1 && (
                    <Feature
                      film={f}
                      on={k === at}
                      hold={door === "shut"}
                      reduce={reduce}
                      onExplore={(r) => setFull(r)}
                    />
                  )}
                </motion.div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* through the door: the dark parting from its line; or from the panel, lifting away */}
      {door && entry === "door" && (
        <div className={s.doorIn} aria-hidden="true">
          <i className={s.doorHalf} />
          <i className={s.doorHalf} />
          <i className={s.doorSeam} />
        </div>
      )}
      {door && entry === "panel" && <div className={s.panelIn} aria-hidden="true" />}

      {/* the film opened to the whole screen */}
      <AnimatePresence>{full && <Full key="full" from={full} film={film} reduce={reduce} onClose={() => setFull(null)} />}</AnimatePresence>
    </main>
  );
}

/** A project as a feature card, in the site's type. Its words rise in once it's on show. */
function Feature({
  film: f,
  on,
  hold = false,
  reduce,
  onExplore,
}: {
  film: BeyondFilm;
  on: boolean;
  /** the page coming in through the door: its words wait for the door to open */
  hold?: boolean;
  reduce: boolean;
  onExplore: (r: Rect) => void;
}) {
  const c = BEYOND_CATEGORIES[f.cat];
  const ref = useRef<HTMLElement>(null);
  return (
    <article ref={ref} className={`${s.card} ${on ? s.cardOn : ""}`} aria-label={`${f.title} — ${c.name}`}>
      {/* the film, the whole card, settling slowly as the card arrives */}
      <div className={s.film} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stillFor(f.clip)} alt="" draggable={false} />
        {on && !reduce && <video ref={startMuted} src={f.clip} muted autoPlay playsInline loop preload="auto" />}
      </div>
      <i className={s.grade} aria-hidden="true" />

      <motion.div className={s.words} variants={WORDS} initial={reduce ? false : "out"} animate={(on && !hold) || reduce ? "in" : "out"}>
        {/* the eyebrow, over the name */}
        <div className={s.foot}>
          <motion.p className={s.label} variants={RISE}>
            <span>{pad2(f.cat + 1)}</span> {c.name}
          </motion.p>
          <h2 className={s.title}>
            {f.title.split(" ").map((w, i) => (
              <span key={i} className={s.mask}>
                <motion.span variants={LINE}>{w}</motion.span>
              </span>
            ))}
          </h2>
        </div>

        {/* Explore: the film, the whole screen */}
        <motion.button
          type="button"
          className={s.act}
          variants={RISE}
          tabIndex={on ? 0 : -1}
          onClick={() => {
            const r = ref.current?.getBoundingClientRect();
            if (r) onExplore({ top: r.top, left: r.left, width: r.width, height: r.height });
          }}
        >
          <span>Explore</span>
          <i aria-hidden="true">→</i>
        </motion.button>
      </motion.div>
    </article>
  );
}

/** The film opened to the whole screen, from where its card stood. */
function Full({ from, film, reduce, onClose }: { from: Rect; film: BeyondFilm; reduce: boolean; onClose: () => void }) {
  const [to] = useState(() => ({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }));
  const move = reduce ? { duration: 0 } : { duration: 0.9, ease: EASE_CINE };
  const c = BEYOND_CATEGORIES[film.cat];
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <motion.div className={s.full} role="dialog" aria-modal="true" aria-label={film.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.35 } }}>
      <motion.div className={s.fullBox} initial={{ ...from, borderRadius: 28 }} animate={{ ...to, borderRadius: 0 }} exit={{ ...from, borderRadius: 28, transition: move }} transition={move}>
        <div className={s.film}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stillFor(film.clip)} alt="" draggable={false} />
          {!reduce && <video ref={startMuted} src={film.clip} muted autoPlay playsInline loop preload="auto" />}
        </div>
        <i className={s.fullShade} aria-hidden="true" />
        <motion.div className={s.fullWords} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.6, duration: 0.7, ease: EASE } }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          <p className={s.label}>
            <span>{pad2(film.cat + 1)}</span> {c.name} · {film.year}
          </p>
          <p className={s.fullTitle}>{film.title}</p>
          <p className={s.fullLine}>{film.line}</p>
        </motion.div>
        <motion.button type="button" className={s.close} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.6 } }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          Close <i aria-hidden="true">×</i>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
