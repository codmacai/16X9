"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import { Band, EASE, EASE_CINE, EnterCursor, rootClass, Still, usePlayer } from "../_shared/chrome";
import { CATEGORIES, PROJECTS, categoryOf, stillFor, type CategoryId } from "../_shared/data";
import styles from "./v3.module.css";

// ===========================================================================
// WORK 03 — THE FLIP. Looking down into the open drawer: the films stand on
// end, one behind the next, each with its tab, and the tabs climb away into
// the dark. Scroll, swipe or use the arrow keys and the front file tips
// forward out of the way; the next one comes up into the light and starts to
// play. Tabs sit in their category's column, so you can read what's coming
// from the backs of the files. The category tabs along the foot jump there.
// ===========================================================================

const LIST = CATEGORIES.flatMap((c) => PROJECTS.filter((p) => p.category === c.id));
const COL = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i])) as Record<CategoryId, number>;
const SHOWN = 7; // how many files behind the front one are drawn
const STEP = { lift: 0.052, depth: 120 }; // per file back: up (in screen heights), away (px)
const WHEEL = { threshold: 70, lock: 420 };

export default function WorkFlip() {
  const reduce = !!useReducedMotion();
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const pos = useSpring(0, reduce ? { duration: 0 } : { stiffness: 120, damping: 22, mass: 0.9 });
  const refs = useRef<(HTMLElement | null)[]>([]);
  const { play, player, playing } = usePlayer(LIST);

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(LIST.length - 1, i))), []);

  // every frame of the spring: place each file from how far it is from the front
  useEffect(() => {
    pos.set(index);
  }, [index, pos]);

  useEffect(() => {
    const place = (v: number) => {
      const vh = window.innerHeight;
      const lift = window.innerWidth < 760 ? STEP.lift * 0.6 : STEP.lift; // a tighter stack on phones
      refs.current.forEach((el, i) => {
        if (!el) return;
        const d = i - v;
        if (d < -1.2 || d > SHOWN) {
          el.style.visibility = "hidden";
          return;
        }
        el.style.visibility = "visible";
        if (d >= 0) {
          el.style.transform = `translate3d(-50%, ${-d * lift * vh}px, ${-d * STEP.depth}px)`;
          el.style.opacity = d > SHOWN - 1 ? String(SHOWN - d) : "1";
          el.style.setProperty("--dim", String(Math.min(0.86, d * 0.2)));
        } else {
          // tipping forward off its bottom edge and out of the way
          el.style.transform = `translate3d(-50%, ${-d * 0.32 * vh}px, 0) rotateX(${d * 62}deg)`;
          el.style.opacity = String(Math.max(0, 1 + d * 1.5));
          el.style.setProperty("--dim", "0");
        }
        el.style.zIndex = String(100 - i);
      });
    };
    place(pos.get());
    const off = pos.on("change", place);
    const onResize = () => place(pos.get());
    window.addEventListener("resize", onResize);
    return () => {
      off();
      window.removeEventListener("resize", onResize);
    };
  }, [pos]);

  // wheel, keys and swipes flip one file at a time (not while the menu or a
  // film is open over the drawer: both lock the body)
  useEffect(() => {
    const blocked = () => document.body.style.overflow === "hidden";
    let acc = 0;
    let lockedUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (blocked()) return;
      e.preventDefault();
      const now = performance.now();
      if (now < lockedUntil) return;
      acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(acc) > WHEEL.threshold) {
        setIndex((i) => Math.max(0, Math.min(LIST.length - 1, i + Math.sign(acc))));
        acc = 0;
        lockedUntil = now + WHEEL.lock;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (blocked()) return;
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.min(LIST.length - 1, i + 1));
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    let startY: number | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !blocked()) startY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (startY === null) return;
      const dy = startY - e.clientY;
      startY = null;
      if (Math.abs(dy) > 40) setIndex((i) => Math.max(0, Math.min(LIST.length - 1, i + Math.sign(dy))));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const front = LIST[index];
  const frontCat = front.category;

  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band crumb="03 The flip" />

      {/* ================= the readout, top left ================= */}
      <motion.div
        className={styles.readout}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 1.2, duration: 1 } }}
        aria-live="polite"
      >
        <span className={styles.readoutNo}>
          {String(index + 1).padStart(2, "0")}
          <i>/{String(LIST.length).padStart(2, "0")}</i>
        </span>
        <span className={styles.readoutCat}>{categoryOf(frontCat).label}</span>
        <span className={styles.hint}>Scroll to flip · Click to play</span>
      </motion.div>

      {/* ================= the drawer ================= */}
      <motion.div
        className={styles.stage}
        initial={reduce ? false : { opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.5, duration: 1.4, ease: EASE } }}
      >
        {LIST.map((p, i) => {
          const isFront = i === index;
          return (
            <article
              key={p.no}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className={`${styles.file} ${isFront ? styles.fileFront : ""}`}
              style={{ ["--c" as string]: COL[p.category] }}
              aria-hidden={!isFront}
            >
              <span className={styles.stock}>
                <button
                  type="button"
                  className={styles.tab}
                  tabIndex={isFront ? 0 : -1}
                  onClick={() => (isFront ? undefined : go(i))}
                  aria-label={isFront ? p.title : `Flip to ${p.title}`}
                >
                  <span className={styles.tabNo}>{p.no}</span>
                  <span className={styles.tabName}>{p.title}</span>
                </button>
                <button
                  type="button"
                  className={styles.window}
                  tabIndex={isFront ? 0 : -1}
                  onClick={(e) => (isFront ? play(p, e.currentTarget) : go(i))}
                  onPointerEnter={(e) => isFront && e.pointerType === "mouse" && setHover(true)}
                  onPointerLeave={() => setHover(false)}
                  aria-label={isFront ? `Play ${p.title}` : `Flip to ${p.title}`}
                >
                  {Math.abs(i - index) <= SHOWN && <Still src={stillFor(p.src)} on={isFront} />}
                  {isFront && !reduce && (
                    <video key={p.src} className={styles.video} src={p.src} muted loop playsInline autoPlay preload="auto" />
                  )}
                  <span className={styles.shade} aria-hidden="true" />
                  <span className={styles.caption}>
                    <span className={styles.title}>{p.title}</span>
                    <span className={styles.meta}>
                      <span>{p.client}</span>
                      <span>
                        {p.year} · {p.duration}
                      </span>
                      <span className={styles.enter}>
                        Play <span>→</span>
                      </span>
                    </span>
                  </span>
                  <span className={styles.line}>{p.line}</span>
                </button>
                <span className={styles.dim} aria-hidden="true" />
              </span>
            </article>
          );
        })}
      </motion.div>

      {/* ================= the dividers, along the foot ================= */}
      <nav className={styles.foot} aria-label="Categories">
        {CATEGORIES.map((c, ci) => {
          const first = LIST.findIndex((p) => p.category === c.id);
          const on = c.id === frontCat;
          return (
            <motion.button
              key={c.id}
              type="button"
              className={`${styles.footTab} ${on ? styles.footTabOn : ""}`}
              onClick={() => go(first)}
              initial={reduce ? false : { y: "100%" }}
              animate={{ y: 0, transition: { delay: 0.9 + ci * 0.08, duration: 1, ease: EASE_CINE } }}
            >
              <span className={styles.tabNo}>{String(ci + 1).padStart(2, "0")}</span>
              <span className={styles.footName}>
                <span className={styles.long}>{c.label}</span>
                <span className={styles.short}>{c.short}</span>
              </span>
              <span className={styles.tabNo}>{PROJECTS.filter((p) => p.category === c.id).length}</span>
            </motion.button>
          );
        })}
      </nav>

      <EnterCursor label={hover && !playing ? front.title : null} />
      {player}
    </main>
  );
}
