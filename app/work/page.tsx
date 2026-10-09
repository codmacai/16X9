"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { Band, EASE, EASE_CINE, EnterCursor, Info, rootClass, Still, usePlayer } from "./_shared/chrome";
import { CATEGORIES, PROJECTS, stillFor } from "./_shared/data";
import FileView, { type Drawer } from "./file-view";
import styles from "./cabinet.module.css";

// ===========================================================================
// WORK 01 — THE CABINET. The burger menu's drawer, in the dark: a folder for
// each category, stacked the way the menu stacks its three. Point at one and
// it's pulled up and comes into colour. Click it and you take it out of the
// drawer: the folder slides up, whole, until its tab meets the band; the
// folders in front of it drop away; its film fades into the dark and the
// films inside rise out of it as posters (file-view.tsx). Close, and they
// sink back in and the folder goes back down into its place.
// Once the cabinet is on screen the page stops scrolling; it's all here.
// ===========================================================================

const ORDER: Drawer[] = CATEGORIES.map((c, i) => ({
  no: String(i + 1).padStart(2, "0"),
  label: c.label,
  short: c.short,
  films: PROJECTS.filter((p) => p.category === c.id),
}));
const LIST = ORDER.flatMap((d) => d.films);
// black files on the paper sheet, as in the menu; each a breath deeper than the
// one behind it (out of the drawer, a folder goes to pure black)
const STOCK = ["#0a0a0a", "#080808", "#060606", "#030303", "#000"];
const INTRO_S = 0.45 + ORDER.length * 0.1 + 1.15;

// how the folders move
const PULL: Transition = { type: "spring", stiffness: 140, damping: 20, mass: 0.9 }; // pointed at
const RISE: Transition = { type: "spring", stiffness: 86, damping: 18, mass: 1 }; // taken out of the drawer
const SINK: Transition = { type: "spring", stiffness: 120, damping: 22, mass: 1 }; // put back
const drop = (k: number): Transition => ({ duration: 0.62, ease: [0.55, 0, 0.75, 0.15], delay: 0.03 * k }); // the ones in front fall away
const lift = (k: number): Transition => ({ type: "spring", stiffness: 110, damping: 20, delay: 0.1 + 0.05 * k }); // ...and come back

const onResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const useViewportHeight = () =>
  useSyncExternalStore(
    onResize,
    () => window.innerHeight,
    () => 0
  );

/** Once `ref` is fully on screen, the page stops scrolling (until it unmounts). */
function useScrollLock(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio < 0.98) return;
        window.scrollTo({ top: el.offsetTop });
        html.style.overflow = "hidden";
        html.style.overscrollBehavior = "none";
        io.disconnect();
      },
      { threshold: [0.98, 1] }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      html.style.overflow = "";
      html.style.overscrollBehavior = "";
    };
  }, [ref]);
}

/** The open folder: which, how far it rises to meet the band, and whether it's going back. */
type Open = { cat: number; rise: number; closing: boolean };

export default function WorkCabinet() {
  const reduce = !!useReducedMotion();
  const vh = useViewportHeight();
  const [pull, setPull] = useState<number | null>(null);
  const [settled, setSettled] = useState(false); // the stack has dealt itself in
  const [open, setOpen] = useState<Open | null>(null);
  const [shown, setShown] = useState<number[]>(() => ORDER.map(() => 0)); // the film each folder shows
  const [cursor, setCursor] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const frontRef = useRef<HTMLElement>(null);
  const folderRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { play, player } = usePlayer(open ? ORDER[open.cat].films : LIST);

  useScrollLock(sectionRef);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), reduce ? 0 : INTRO_S * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  const openFile = (c: number) => {
    const folder = folderRefs.current[c];
    const front = frontRef.current;
    if (open || !settled || !folder || !front) return;
    const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 0;
    // where the folder sits in the stack (without any pull), and how far up the band is
    const top = front.getBoundingClientRect().top + folder.offsetTop;
    setCursor(null);
    setOpen({ cat: c, rise: band - top, closing: false });
  };

  // the posters have sunk back into the folder: it shows the film you left on, and goes down
  const openRef = useRef<number | null>(null);
  useEffect(() => {
    openRef.current = open?.cat ?? null;
  }, [open]);
  const filed = useCallback((index: number) => {
    setCursor(null);
    setOpen((o) => (o ? { ...o, closing: true } : o));
    setShown((s) => s.map((v, i) => (i === openRef.current ? index : v)));
  }, []);

  // ...and it's back in its place
  const putBack = (i: number) => {
    if (!open?.closing || i !== open.cat) return;
    setOpen(null);
    setPull(null);
    folderRefs.current[i]?.focus({ preventScroll: true });
  };

  const yFor = (i: number) => {
    if (open) {
      if (i === open.cat) return open.closing ? 0 : open.rise;
      if (i > open.cat) return open.closing ? 0 : vh;
      return 0;
    }
    if (pull === i) return -0.04 * vh;
    if (pull !== null && i > pull) return 0.016 * vh;
    return 0;
  };
  const moveFor = (i: number): Transition => {
    if (reduce) return { duration: 0 };
    if (!settled) return { delay: 0.45 + i * 0.1, duration: 1.15, ease: EASE_CINE };
    if (open && i === open.cat) return open.closing ? SINK : RISE;
    if (open && i > open.cat) return open.closing ? lift(i - open.cat) : drop(i - open.cat);
    return PULL;
  };
  const lifted = open ? open.cat : pull;

  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band crumb="Index" />
      <Arrival reduce={reduce} />

      <section
        ref={sectionRef}
        className={`${styles.sheet} ${open && !open.closing ? styles.sheetOut : ""}`}
        aria-label="Work"
      >
        <Info left="16X9 — Selected work" centre={`${LIST.length} films · ${ORDER.length} drawers`} />
        <div className={styles.lockup}>
          <h1 className={styles.headline}>
            {["The work,", "on file"].map((line, i) => (
              <span key={line} className={styles.mask}>
                <motion.span
                  className={styles.line}
                  initial={{ y: "105%" }}
                  animate={{ y: 0, transition: reduce ? { duration: 0 } : { delay: 0.5 + i * 0.12, duration: 1.15, ease: EASE } }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className={styles.lede}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { delay: 1.1, duration: 1.1, ease: EASE } }}
          >
            Commercials, brand films, fashion, social and documentary. Take a folder out of the drawer to see what&apos;s
            in it.
          </motion.p>
        </div>

        {/* the cabinet: one folder per category */}
        <nav
          ref={frontRef}
          className={styles.front}
          aria-label="Categories"
          onPointerLeave={() => setPull(null)}
          style={open ? { pointerEvents: "none" } : undefined}
        >
          {ORDER.map((d, i) => {
            const on = lifted === i;
            const out = open !== null && open.cat === i && !open.closing;
            return (
              <motion.button
                key={d.no}
                ref={(el) => {
                  folderRefs.current[i] = el;
                }}
                type="button"
                className={[
                  styles.folder,
                  on ? styles.folderOn : "",
                  lifted !== null && !on ? styles.folderAway : "",
                  out ? styles.folderOut : "",
                ].join(" ")}
                style={{ ["--c" as string]: i, ["--stock-c" as string]: STOCK[i] }}
                onClick={() => openFile(i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && settled && setPull(i)}
                // keyboard focus pulls a folder up like pointing at it; a tap's focus doesn't
                onFocus={(e) => e.currentTarget.matches(":focus-visible") && setPull(i)}
                onBlur={() => !open && setPull(null)}
                // the same first frame on the server and the client (reduced motion
                // only makes the intro instant), so hydration always matches
                initial={{ y: "110%" }}
                animate={{ y: yFor(i), transition: moveFor(i) }}
                onAnimationComplete={() => putBack(i)}
                aria-label={`Open ${d.label}, ${d.films.length} films`}
                aria-expanded={out}
              >
                <span className={styles.stock}>
                  <span className={styles.tab}>
                    <span className={styles.labelNo}>{d.no}</span>
                    <span className={styles.tabName}>
                      <span className={styles.long}>{d.label}</span>
                      <span className={styles.short}>{d.short}</span>
                    </span>
                    <span className={styles.labelNo}>{d.films.length}</span>
                  </span>
                  <span className={styles.window}>
                    <Still src={stillFor(d.films[shown[i]].src)} on={on} />
                    <span className={styles.shade} aria-hidden="true" />
                    <span className={styles.caption}>
                      <span className={styles.title}>{d.label}</span>
                      <span className={styles.meta}>
                        <span>{d.films.map((f) => f.title).join(" · ")}</span>
                        <span className={styles.enter}>
                          Open <span>→</span>
                        </span>
                      </span>
                    </span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </nav>
      </section>

      {open && !open.closing && (
        <FileView
          key={open.cat}
          drawer={ORDER[open.cat]}
          start={shown[open.cat]}
          reduce={reduce}
          onPlay={play}
          onCursor={setCursor}
          onClosed={filed}
        />
      )}

      <EnterCursor label={open ? cursor : pull !== null ? ORDER[pull].label : null} />
      <span className={styles.grain} aria-hidden="true" />
      {player}
    </main>
  );
}

/** The menu's Work folder fills the screen in black before the page changes;
 *  here that black lifts away, up past the band, and the cabinet is underneath. */
function Arrival({ reduce }: { reduce: boolean }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <motion.div
      className={styles.arrival}
      initial={{ y: 0 }}
      animate={{ y: "-100%", transition: reduce ? { duration: 0 } : { delay: 0.1, duration: 1.05, ease: EASE_CINE } }}
      onAnimationComplete={() => setDone(true)}
      aria-hidden="true"
    />
  );
}
