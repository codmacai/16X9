"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Band, EASE, EASE_CINE, EnterCursor, Info, rootClass, Still, usePlayer } from "../_shared/chrome";
import { CATEGORIES, PROJECTS, stillFor } from "../_shared/data";
import FileView, { type Drawer, type Origin } from "./file-view";
import styles from "./v1.module.css";

// ===========================================================================
// WORK 01 — THE CABINET. The burger menu's drawer, in the dark: a folder for
// each category, stacked the way the menu stacks its three. Point at one and
// it's pulled up out of the stack and comes into colour. Click it and it opens
// right where it is — no scrolling anywhere: the folder's body grows into the
// room, its film becomes the card in front, its tab hangs in the corner as a
// ticket (see file-view.tsx). Close it and it folds back into its place.
// Once the cabinet is on screen the page stops scrolling; it's all here.
// ===========================================================================

const ORDER: Drawer[] = CATEGORIES.map((c, i) => ({
  no: String(i + 1).padStart(2, "0"),
  label: c.label,
  short: c.short,
  films: PROJECTS.filter((p) => p.category === c.id),
}));
const LIST = ORDER.flatMap((d) => d.films);
// each folder a shade lighter than the one behind it, so the stack reads in the dark
const STOCK = ["#151413", "#191817", "#1d1c1a", "#21201e", "#252321"];
const INTRO_S = 0.55 + ORDER.length * 0.1 + 1.15;

const rectOf = (r: DOMRect) => ({ top: r.top, left: r.left, width: r.width, height: r.height });

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

type Open = { cat: number; origin: Origin };

export default function WorkCabinet() {
  const reduce = !!useReducedMotion();
  const [pull, setPull] = useState<number | null>(null);
  const [settled, setSettled] = useState(false); // the stack has dealt itself in
  const [open, setOpen] = useState<Open | null>(null);
  const [shown, setShown] = useState<number[]>(() => ORDER.map(() => 0)); // the film each folder shows
  const [cursor, setCursor] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const frontRef = useRef<HTMLElement>(null);
  const folderRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { play, player, playing } = usePlayer(open ? ORDER[open.cat].films : LIST);

  useScrollLock(sectionRef);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), reduce ? 0 : INTRO_S * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // While a file is open its folder stays exactly as it was clicked, so the
  // file has the same place to fold back into.
  const lifted = open ? (open.origin.lifted ? open.cat : null) : pull;

  const measure = useCallback((c: number, isLifted: boolean): Origin | null => {
    const folder = folderRefs.current[c];
    const front = frontRef.current;
    const win = folder?.querySelector<HTMLElement>(`.${styles.window}`)?.getBoundingClientRect();
    const tab = folder?.querySelector<HTMLElement>(`.${styles.tab}`)?.getBoundingClientRect();
    if (!front || !win || !tab) return null;
    const next = folderRefs.current[c + 1]?.getBoundingClientRect();
    return {
      win: rectOf(win),
      tab: rectOf(tab),
      bodyTop: tab.bottom,
      visBottom: Math.min(front.getBoundingClientRect().bottom, next ? next.top : Infinity),
      stock: STOCK[c],
      lifted: isLifted,
    };
  }, []);

  const openFile = (c: number) => {
    if (open || !settled) return;
    const origin = measure(c, pull === c);
    if (!origin) return;
    setCursor(null);
    setOpen({ cat: c, origin });
  };

  const remeasure = useCallback(() => (open ? measure(open.cat, open.origin.lifted) : null), [open, measure]);
  const leave = useCallback(
    (index: number) => open && setShown((s) => s.map((v, i) => (i === open.cat ? index : v))),
    [open]
  );
  const closed = useCallback(() => {
    const c = open?.cat;
    setOpen(null);
    setPull(null); // it settles back into the stack (and out of colour) from here
    if (c !== undefined) folderRefs.current[c]?.focus({ preventScroll: true });
  }, [open]);

  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band crumb="01 The cabinet" />

      <section ref={sectionRef} className={styles.sheet} aria-label="Work">
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
            Commercials, brand films, fashion, social and documentary. Pull a folder to open it where it sits.
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
            return (
              <motion.button
                key={d.no}
                ref={(el) => {
                  folderRefs.current[i] = el;
                }}
                type="button"
                className={`${styles.folder} ${on ? styles.folderOn : ""} ${lifted !== null && !on ? styles.folderAway : ""}`}
                style={{ ["--c" as string]: i, ["--stock-c" as string]: STOCK[i] }}
                onClick={() => openFile(i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && settled && setPull(i)}
                // keyboard focus pulls a folder up like pointing at it; a tap's focus doesn't
                onFocus={(e) => e.currentTarget.matches(":focus-visible") && setPull(i)}
                onBlur={() => !open && setPull(null)}
                // the same first frame on the server and the client (reduced motion
                // only makes the intro instant), so hydration always matches
                initial={{ y: "110%" }}
                animate={{
                  y: on ? "-4vh" : lifted !== null && i > lifted ? "1.6vh" : 0,
                  transition: settled
                    ? { type: "spring", stiffness: 140, damping: 20, mass: 0.9 }
                    : reduce
                      ? { duration: 0 }
                      : { delay: 0.45 + i * 0.1, duration: 1.15, ease: EASE_CINE },
                }}
                aria-label={`Open ${d.label}, ${d.films.length} films`}
                aria-expanded={open?.cat === i}
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

      {open && (
        <FileView
          key={open.cat}
          drawer={ORDER[open.cat]}
          origin={open.origin}
          start={shown[open.cat]}
          reduce={reduce}
          playing={playing}
          measure={remeasure}
          onPlay={play}
          onCursor={setCursor}
          onLeave={leave}
          onClosed={closed}
        />
      )}

      <EnterCursor label={open ? cursor : pull !== null ? ORDER[pull].label : null} />
      <span className={styles.grain} aria-hidden="true" />
      {player}
    </main>
  );
}
