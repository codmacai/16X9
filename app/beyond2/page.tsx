"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { EASE, EASE_CINE } from "../work/_shared/chrome";
import { stillFor } from "../work/_shared/data";
import { Card, FullCard, type Rect } from "../work/beyond-card";
import { BeyondShell, CATS, pad2 } from "../work/beyond-shell";
import { startMuted } from "../work/brand-shared";
import { useSmoothWheel } from "../work/smooth-wheel";
import s from "./beyond2.module.css";

// ===========================================================================
// BEYOND 2 — THE INDEX, on black. The categories as one column of large
// type, ruled between, each with its number and how many films it holds.
// Point along it and the others fall back while a film in Beyond's wide
// frame rides beside the pointer, playing that category's work (the next
// wiping up over the last as you move), with what the studio does in it. Click one
// and the column lifts away a line at a time; its name comes up at the head
// of the page and its films follow down it as cards (the card as Beyond's
// work page has it), each opening out as it scrolls in, the one on screen
// playing; Explore opens one to the whole screen. At the foot, on to the
// next category. Back (or Esc) returns to the index.
// ===========================================================================

const noop = () => () => {};

export default function BeyondTwo() {
  const reduce = !!useReducedMotion();
  const [open, setOpen] = useState<number | null>(null);
  const close = () => setOpen(null);
  useSmoothWheel(open !== null);

  return (
    <BeyondShell className={s.page} onBack={open !== null ? close : undefined}>
      <AnimatePresence mode="wait">
        {open === null ? (
          <Index key="index" reduce={reduce} onOpen={setOpen} />
        ) : (
          <Films key={`films-${open}`} cat={open} reduce={reduce} onBack={close} onNext={() => setOpen((open + 1) % CATS.length)} />
        )}
      </AnimatePresence>
    </BeyondShell>
  );
}

/** The categories as a column of large type, a film riding after the pointer. */
function Index({ reduce, onOpen }: { reduce: boolean; onOpen: (i: number) => void }) {
  const [on, setOn] = useState<number | null>(null);
  const fine = useSyncExternalStore(noop, () => window.matchMedia("(hover: hover) and (pointer: fine)").matches, () => false);
  // the film after the pointer, eased so it trails a little
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 150, damping: 20, mass: 0.6 });
  const y = useSpring(my, { stiffness: 150, damping: 20, mass: 0.6 });

  return (
    <motion.section
      className={s.index}
      aria-label="Beyond — the categories"
      exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.45 } }}
      onPointerMove={(e) => {
        mx.set(e.clientX);
        my.set(e.clientY);
      }}
      onPointerLeave={() => setOn(null)}
    >
      <motion.p className={s.kicker} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, delay: 0.15 }}>
        <span>03</span> Beyond — the work, by kind
      </motion.p>
      <ol className={s.list}>
        {CATS.map((c) => (
          <li key={c.name} className={s.li}>
            <button
              type="button"
              className={`${s.row} ${on === c.i ? s.rowOn : ""} ${on !== null && on !== c.i ? s.rowBack : ""}`}
              onPointerEnter={(e) => e.pointerType === "mouse" && setOn(c.i)}
              onFocus={() => setOn(c.i)}
              onClick={() => onOpen(c.i)}
              aria-label={`${c.name}: ${c.films.length} films`}
            >
              <span className={s.no}>{pad2(c.i + 1)}</span>
              <span className={s.mask}>
                <motion.span
                  className={s.name}
                  initial={reduce ? false : { y: "108%" }}
                  animate={{ y: "0%", transition: { duration: 1.1, ease: EASE, delay: 0.2 + c.i * 0.07 } }}
                  exit={{ y: "-108%", transition: { duration: 0.6, ease: EASE_CINE, delay: c.i * 0.05 } }}
                >
                  {c.name}
                </motion.span>
              </span>
              <span className={s.cnt}>
                {pad2(c.films.length)} <i>films</i>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* the film after the pointer */}
      {fine && !reduce && (
        <motion.div className={s.preview} style={{ x, y }} aria-hidden="true">
          <motion.div
            className={s.previewIn}
            initial={false}
            animate={{ scale: on !== null ? 1 : 0.4, opacity: on !== null ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
          >
            <AnimatePresence initial={false}>
              {on !== null && (
                <motion.div
                  key={on}
                  className={s.previewFilm}
                  initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
                  animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                  exit={{ opacity: 1, transition: { duration: 0.6 } }}
                  transition={{ duration: 0.6, ease: EASE_CINE }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stillFor(CATS[on].films[0].clip)} alt="" draggable={false} />
                  <video ref={startMuted} src={CATS[on].films[0].clip} muted autoPlay playsInline loop preload="auto" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          {/* under it: what the studio does in that category */}
          <motion.p className={s.previewCap} initial={false} animate={{ opacity: on !== null ? 1 : 0 }} transition={{ duration: 0.3 }}>
            {on !== null && CATS[on].did.join(" · ")}
          </motion.p>
        </motion.div>
      )}
    </motion.section>
  );
}

/** A category's films, down the page as cards. */
function Films({ cat, reduce, onBack, onNext }: { cat: number; reduce: boolean; onBack: () => void; onNext: () => void }) {
  const c = CATS[cat];
  const n = c.films.length;
  const next = CATS[(cat + 1) % CATS.length];
  const boxes = useRef<(HTMLDivElement | null)[]>([]);
  const [at, setAt] = useState(0);
  const [full, setFull] = useState<Rect | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    if (full) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [full, onBack]);
  // the card at the middle of the screen is the one playing
  useEffect(() => {
    const els = boxes.current.filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setAt(els.indexOf(e.target as HTMLElement));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <motion.section
      className={s.films}
      aria-label={`${c.name}: the films`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.5 } }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <header className={s.filmsHead}>
        <button type="button" className={s.back} onClick={onBack}>
          <i aria-hidden="true">←</i> Index
        </button>
        <p className={s.kicker}>
          <span>{pad2(cat + 1)}</span> Beyond
        </p>
        <h1 className={s.filmsName}>
          <span className={s.mask}>
            <motion.span initial={reduce ? false : { y: "108%" }} animate={{ y: "0%" }} transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}>
              {c.name}
            </motion.span>
          </span>
        </h1>
        <motion.p className={s.lede} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}>
          {pad2(n)} films <i aria-hidden="true" /> {c.did.join(" · ")}
        </motion.p>
      </header>

      <ol className={s.cards}>
        {c.films.map((f, k) => (
          <li key={f.clip} className={s.item}>
            <p className={s.itemNo}>
              <b>{pad2(k + 1)}</b> / {pad2(n)}
            </p>
            <motion.div
              ref={(el) => {
                boxes.current[k] = el;
              }}
              className={s.box}
              initial={reduce ? false : { clipPath: "inset(14% 8% 14% 8% round 14px)", scale: 1.04 }}
              whileInView={{ clipPath: "inset(0% 0% 0% 0% round 14px)", scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1.2, ease: EASE }}
            >
              <Card
                film={f}
                turn={k}
                dir={1}
                reduce={reduce}
                still={k !== at}
                onExplore={() => {
                  setAt(k);
                  const r = boxes.current[k]?.getBoundingClientRect();
                  if (r) setFull({ top: r.top, left: r.left, width: r.width, height: r.height });
                }}
              />
            </motion.div>
          </li>
        ))}
      </ol>

      {/* on to the next category */}
      <button type="button" className={s.next} onClick={onNext}>
        <span>Next</span>
        <b>
          {next.name} <i aria-hidden="true">→</i>
        </b>
      </button>

      <AnimatePresence>
        {full && (
          <FullCard
            key="full"
            from={full}
            film={c.films[at]}
            turn={at}
            dir={1}
            reduce={reduce}
            dark
            onClose={() => setFull(null)}
            onStep={(d) => setAt((a) => Math.max(0, Math.min(n - 1, a + d)))}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
