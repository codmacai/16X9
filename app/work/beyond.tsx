"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import RoomSwitch from "../hero4/room-switch";
import { Band, EASE, EASE_CINE, rootClass } from "./_shared/chrome";
import { BEYOND_CATEGORIES, BEYOND_FILMS, stillFor } from "./_shared/data";
import { startMuted } from "./brand-shared";
import s from "./beyond.module.css";

// ===========================================================================
// WORK, BEYOND — the screening room, in the dark. Across the head, the
// categories set as the landing's index line ("Brand activations / Immersive
// / …"), each with its count; Beyond's four corners stand round the one on
// show and spring across to the one you pick. Under it, one big screen in
// Beyond's wide frame (2.39:1): the project on show, each opening over the
// last from a line across its middle, its colour thrown faintly on the room.
// Under the screen, a fine bar for each of the category's projects, the one
// on show filling as it plays; at its end the next opens — and after a
// category's last, the corners move on to the next category: the room runs
// as one reel. Beside the bars, its place, its name rolling in, what kind of
// work it was and what the studio did. The wheel, the arrows or a swipe move
// along; pointing at the screen holds it; clicking it opens it to the whole
// screen, its corners going out to the screen's.
// ===========================================================================

const N = BEYOND_FILMS.length;
const HOLD = 8; // seconds a project holds the screen before the next opens
const pad2 = (n: number) => String(n).padStart(2, "0");
const firstOf = (cat: number) => BEYOND_FILMS.findIndex((f) => f.cat === cat);
const countOf = (cat: number) => BEYOND_FILMS.filter((f) => f.cat === cat).length;

// the next opens over the last from a line across its middle, as the frames on the site do
const CUT = { duration: 1.1, ease: EASE_CINE };
const OPEN: Variants = {
  shut: { clipPath: "inset(50% 0% 50% 0%)" },
  open: { clipPath: "inset(0% 0% 0% 0%)", transition: CUT },
  gone: { opacity: 1, transition: { duration: CUT.duration } },
};
// the name rolls over to the next (back: the other way)
const ROLL: Variants = {
  below: (d: number) => ({ y: d > 0 ? "105%" : "-105%" }),
  in: { y: "0%", transition: { duration: 0.9, ease: EASE_CINE } },
  gone: (d: number) => ({ y: d > 0 ? "-105%" : "105%", transition: { duration: 0.9, ease: EASE_CINE } }),
};

type Show = { at: number; turn: number; dir: number };
type Rect = { top: number; left: number; width: number; height: number };

export default function Beyond() {
  const reduce = !!useReducedMotion();
  const router = useRouter();
  const [show, setShow] = useState<Show>({ at: 0, turn: 0, dir: 1 });
  const { at, turn, dir } = show;
  const film = BEYOND_FILMS[at];
  const cat = BEYOND_CATEGORIES[film.cat];
  const mine = BEYOND_FILMS.filter((f) => f.cat === film.cat);
  const place = mine.indexOf(film);
  // the reel runs on round: past the last project, the first
  const go = useCallback((to: number, d?: number) => setShow((v) => (to === v.at ? v : { at: (to + N) % N, turn: v.turn + 1, dir: d ?? (to > v.at ? 1 : -1) })), []);
  const step = useCallback((d: 1 | -1) => setShow((v) => ({ at: (v.at + d + N) % N, turn: v.turn + 1, dir: d })), []);

  // pointing at the screen holds it; opened to the whole screen, the room waits
  const [hold, setHold] = useState(false);
  const [full, setFull] = useState<Rect | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const expand = () => {
    const r = screenRef.current?.getBoundingClientRect();
    if (r) setFull({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  // the wheel and the arrows, a project a turn (a trackpad's long glide counts once)
  useEffect(() => {
    let last = 0;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 4) return;
      e.preventDefault();
      const now = performance.now();
      const quiet = now - last > 260;
      last = now;
      if (quiet) step(d > 0 ? 1 : -1);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") step(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step(-1);
      else if (e.key === "Escape") setFull(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
    };
  }, [step]);

  // a swipe across the screen
  const swipe = useRef<number | null>(null);

  // on a phone the line runs across: the category on show kept in view (the line alone scrolls)
  const catsRef = useRef<HTMLElement>(null);
  const catOn = film.cat;
  useEffect(() => {
    const row = catsRef.current;
    if (!row || row.scrollWidth <= row.clientWidth + 1) return;
    const el = row.querySelector<HTMLElement>("[aria-current]")?.parentElement;
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
                <motion.span className={s.slash} aria-hidden="true" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 + i * 0.06 }}>
                  /
                </motion.span>
              )}
              <span className={s.catMask}>
                <motion.button
                  type="button"
                  className={`${s.cat} ${i === film.cat ? s.catOn : ""}`}
                  onClick={() => i !== film.cat && go(firstOf(i), i > film.cat ? 1 : -1)}
                  aria-current={i === film.cat || undefined}
                  aria-label={`${c.name}, ${countOf(i)} projects`}
                  initial={reduce ? false : { y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ type: "spring", visualDuration: 0.9, bounce: 0.18, delay: 0.15 + i * 0.07 }}
                >
                  {c.short}
                  <sup>{pad2(countOf(i))}</sup>
                  {/* Beyond's four corners, round the one on show */}
                  {i === film.cat && (
                    <motion.span layoutId="beyond-finder" className={s.finder} transition={{ type: "spring", visualDuration: 0.55, bounce: 0.22 }} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </motion.span>
                  )}
                </motion.button>
              </span>
            </Fragment>
          ))}
        </nav>

        {/* the screen, its colour thrown on the room */}
        <div className={s.stage}>
          <span className={s.light} aria-hidden="true">
            <AnimatePresence initial={false}>
              <motion.img
                key={film.clip}
                src={stillFor(film.clip)}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 1.4, delay: 0.3 } }}
                exit={{ opacity: 0, transition: { duration: 1.2 } }}
              />
            </AnimatePresence>
          </span>
          <div
            ref={screenRef}
            className={s.screen}
            role="button"
            tabIndex={0}
            aria-label={`Play ${film.title}, ${cat.name}`}
            style={{ visibility: full ? "hidden" : undefined }}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHold(true)}
            onPointerLeave={() => setHold(false)}
            onPointerDown={(e) => (swipe.current = e.clientX)}
            onPointerUp={(e) => {
              const x0 = swipe.current;
              swipe.current = null;
              if (x0 === null) return;
              const dx = e.clientX - x0;
              if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
              else expand();
            }}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), expand())}
          >
            <Shots film={film} turn={turn} reduce={reduce} />
            <span className={s.play} aria-hidden="true">
              <i /> Play
            </span>
          </div>
          <span className={s.corners} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>

        {/* under the screen: the category's projects as bars, and the one on show */}
        <div className={s.foot}>
          <div className={s.bars} aria-hidden="true">
            {mine.map((f, k) => (
              <button key={f.clip} type="button" tabIndex={-1} className={k < place ? s.barDone : undefined} onClick={() => go(at - place + k)}>
                <i>
                  {k === place && !reduce && (
                    <b
                      key={turn}
                      style={{ animationDuration: `${HOLD}s`, animationPlayState: hold || full ? "paused" : "running" }}
                      onAnimationEnd={() => step(1)}
                    />
                  )}
                </i>
              </button>
            ))}
          </div>
          <div className={s.caption}>
            <p className={s.count} aria-live="polite">
              <b>{pad2(place + 1)}</b> <i>/ {pad2(mine.length)}</i>
            </p>
            <div className={s.nameMask}>
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.h1 key={turn} className={s.name} custom={dir} variants={ROLL} initial="below" animate="in" exit="gone">
                  {film.title}
                </motion.h1>
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={turn}
                className={s.meta}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay: 0.2 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <p>
                  {cat.name} <i aria-hidden="true">·</i> {film.year}
                  {film.demo && (
                    <>
                      {" "}
                      <i aria-hidden="true">·</i> Demo
                    </>
                  )}
                </p>
                <p className={s.did}>{cat.did.join("  ·  ")}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* the screen opened to the whole screen */}
      <AnimatePresence>
        {full && <Full key="full" from={full} reduce={reduce} film={film} turn={turn} dir={dir} place={place} of={mine.length} catName={cat.name} onClose={() => setFull(null)} />}
      </AnimatePresence>
    </main>
  );
}

/** The project on show: each opening over the last from a line across its middle. */
function Shots({ film, turn, reduce }: { film: (typeof BEYOND_FILMS)[number]; turn: number; reduce: boolean }) {
  return (
    <AnimatePresence initial={!reduce}>
      <motion.div key={turn} className={s.shot} style={{ zIndex: turn }} variants={OPEN} initial="shut" animate="open" exit="gone">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stillFor(film.clip)} alt="" draggable={false} />
        {!reduce && <video ref={startMuted} src={film.clip} muted autoPlay playsInline loop preload="auto" />}
      </motion.div>
    </AnimatePresence>
  );
}

/** The screen opened to the whole screen, from where it stood; its corners go out to the screen's. */
function Full({
  from,
  reduce,
  film,
  turn,
  dir,
  place,
  of,
  catName,
  onClose,
}: {
  from: Rect;
  reduce: boolean;
  film: (typeof BEYOND_FILMS)[number];
  turn: number;
  dir: number;
  place: number;
  of: number;
  catName: string;
  onClose: () => void;
}) {
  const [to] = useState(() => ({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }));
  const move = reduce ? { duration: 0 } : { duration: 0.9, ease: EASE_CINE };
  return (
    <motion.div
      className={s.full}
      role="dialog"
      aria-modal="true"
      aria-label={film.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.35 } }}
    >
      <motion.div className={s.fullBox} initial={from} animate={to} exit={{ ...from, transition: move }} transition={move}>
        <Shots film={film} turn={turn} reduce={reduce} />
        <i className={s.fullShade} aria-hidden="true" />
        <span className={`${s.corners} ${s.cornersFull}`} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <motion.div className={s.fullWords} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.6, duration: 0.6 } }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          <p className={s.count}>
            <b>{pad2(place + 1)}</b> <i>/ {pad2(of)}</i> <span>{catName}</span>
          </p>
          <div className={s.nameMask}>
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.p key={turn} className={s.name} custom={dir} variants={ROLL} initial="below" animate="in" exit="gone">
                {film.title}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className={s.line}>{film.line}</p>
        </motion.div>
        <motion.button
          type="button"
          className={s.close}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.6 } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          Close <i aria-hidden="true">×</i>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
