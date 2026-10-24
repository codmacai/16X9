"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import RoomSwitch from "../hero4/room-switch";
import { Band, EASE, rootClass } from "./_shared/chrome";
import { BEYOND_CATEGORIES, BEYOND_FILMS, stillFor, type BeyondFilm } from "./_shared/data";
import { Card, FullCard, type Rect } from "./beyond-card";
import s from "./beyond.module.css";

// ===========================================================================
// WORK, BEYOND — the studio's top service, as a viewing room on the white.
// One screen. Down the left, its categories, each with how many films it
// holds; in the middle, inside Beyond's four corners, the film on show as a
// card — the film the whole card, its year and kind at the head, a fine row
// of tags, its name large at the foot over a table of what it was, and what
// the studio did down its side; down the right, every film as a strip, the
// one on show ringed, its place in its category beside it. The films run as
// one reel, the categories its chapters: a category clicked goes to its
// first film, and running on past a category's last film moves the left on
// to the next. The wheel, the arrows or a film in the strip move along it.
// "Explore" opens the card to the whole screen.
// ===========================================================================

const N = BEYOND_FILMS.length;
const pad2 = (n: number) => String(n).padStart(2, "0");
// a category's films, and a film's place among them
const inCat = (f: BeyondFilm) => BEYOND_FILMS.filter((x) => x.cat === f.cat);
const firstOf = (cat: number) => BEYOND_FILMS.findIndex((x) => x.cat === cat);


export default function Beyond() {
  const reduce = !!useReducedMotion();
  const router = useRouter();
  // the film on show, every move counted (each a layer over the last), and which way it went
  const [show, setShow] = useState({ at: 0, turn: 0, dir: 1 });
  const { at, turn, dir } = show;
  const film = BEYOND_FILMS[at];
  const go = useCallback((to: number) => setShow((v) => (to === v.at || to < 0 || to >= N ? v : { at: to, turn: v.turn + 1, dir: to > v.at ? 1 : -1 })), []);
  // the card opened to the whole screen: from where it stood
  const [full, setFull] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const catsRef = useRef<HTMLOListElement>(null);
  const explore = () => {
    const r = cardRef.current?.getBoundingClientRect();
    if (r) setFull({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  // the wheel and the arrows move along the reel, a film a turn (a trackpad's long glide counts once)
  const atRef = useRef(at);
  useEffect(() => {
    atRef.current = at;
  }, [at]);
  useEffect(() => {
    if (full) return;
    let last = 0;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX) || Math.abs(e.deltaY) < 4) return;
      if ((e.target as Element | null)?.closest?.("[data-own-scroll]")) return;
      e.preventDefault();
      const now = performance.now();
      const quiet = now - last > 240;
      last = now;
      if (quiet) go(atRef.current + (e.deltaY > 0 ? 1 : -1));
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") go(atRef.current + 1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") go(atRef.current - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
    };
  }, [full, go]);

  // the strip keeps the film on show in its middle (the strip alone scrolls, never the page)
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.children[at] as HTMLElement | undefined;
    if (!strip || !el) return;
    const across = strip.scrollWidth > strip.clientWidth + 1;
    strip.scrollTo({
      top: across ? 0 : el.offsetTop - (strip.clientHeight - el.offsetHeight) / 2,
      left: across ? el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2 : 0,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [at, reduce]);

  // on a phone the categories run across: the one on show kept in view
  const cat = film.cat;
  useEffect(() => {
    const row = catsRef.current;
    const el = row?.children[cat] as HTMLElement | undefined;
    if (!row || !el || row.scrollWidth <= row.clientWidth + 1) return;
    row.scrollTo({ left: el.offsetLeft - 16, behavior: reduce ? "auto" : "smooth" });
  }, [cat, reduce]);

  const mine = inCat(film);
  const place = mine.indexOf(film);

  return (
    <main className={`${rootClass} ${s.page}`}>
      <Band
        crumb="Index"
        workHref="/work?format=beyond"
        center={<RoomSwitch room="beyond" onSwitch={(k) => router.replace(`/work?format=${k}`, { scroll: false })} tone="light" />}
      />

      <div className={s.room}>
        {/* down the left: the categories, each with its count */}
        <nav className={s.cats} aria-label="Categories">
          <motion.p className={s.kicker} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
            <span>03</span> Beyond
          </motion.p>
          <ol ref={catsRef}>
            {BEYOND_CATEGORIES.map((c, i) => (
              <motion.li
                key={c.name}
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.06 }}
              >
                <button type="button" className={film.cat === i ? s.catOn : undefined} onClick={() => go(firstOf(i))} aria-current={film.cat === i || undefined}>
                  {c.name}
                  <i>{BEYOND_FILMS.filter((f) => f.cat === i).length}</i>
                </button>
              </motion.li>
            ))}
          </ol>
        </nav>

        {/* in the middle: the film on show, inside Beyond's four corners */}
        <motion.div
          className={s.stage}
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}
        >
          <span className={s.corners} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div ref={cardRef} className={s.cardBox} style={{ visibility: full ? "hidden" : undefined }}>
            <Card film={film} turn={turn} dir={dir} reduce={reduce} onExplore={explore} />
          </div>
        </motion.div>

        {/* down the right: its place in its category, and every film as a strip */}
        <div className={s.side}>
          <p className={s.count} aria-live="polite">
            <b>{pad2(place + 1)}</b>
            <i aria-hidden="true" />
            {pad2(mine.length)}
          </p>
          <ol ref={stripRef} className={s.strip} data-own-scroll aria-label="Films">
            {BEYOND_FILMS.map((f, i) => (
              <li key={f.clip} className={i > 0 && BEYOND_FILMS[i - 1].cat !== f.cat ? s.chapter : undefined}>
                <button type="button" className={i === at ? s.thumbOn : undefined} onClick={() => go(i)} aria-label={`${f.title}, ${BEYOND_CATEGORIES[f.cat].name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stillFor(f.clip)} alt="" loading="lazy" draggable={false} />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* the card, opened to the whole screen */}
      <AnimatePresence>
        {full && (
          <FullCard key="full" from={full} film={film} turn={turn} dir={dir} reduce={reduce} onClose={() => setFull(null)} onStep={(d) => go(at + d)} />
        )}
      </AnimatePresence>
    </main>
  );
}
