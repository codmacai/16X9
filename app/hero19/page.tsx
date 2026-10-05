"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Archivo } from "next/font/google";
import styles from "./hero19.module.css";

// ===========================================================================
// HERO 19 — "The Darkroom".
//
// A photographer's darkroom under a red safelight. A wire runs across the
// room, sagging a little, and three prints hang from it on wooden pegs:
// Work, About, Services, each with its name pencilled on the border. At rest
// they're undeveloped, pale and washed out. Point at one and it develops:
// the image comes up out of the paper, the print swings on its peg, and the
// others fall back into the dark. On touch screens the prints develop one
// after another on their own.
//
// Opening: the wire draws across the room, then the prints drop onto it one
// by one and swing into place.
//
// Smooth: developing is one overlay's opacity; the swing and sway are
// transforms; nothing is filtered or blurred per frame.
// ===========================================================================

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });

const LOGO_SRC = "/logo.png";

const PRINTS = [
  { no: "01", label: "Work", line: "Films · Campaigns · Content", href: "#work", image: "/hero11/work.webp", x: 22, tilt: -2.2 },
  { no: "02", label: "About", line: "The studio · The people", href: "#about", image: "/hero11/about.webp", x: 50, tilt: 1.4 },
  { no: "03", label: "Services", line: "Production · Post · Strategy", href: "#services", image: "/hero11/services.webp", x: 78, tilt: -1 },
] as const;

/** how far below the wire's ends a peg at x% hangs, as a share of the sag
 *  (the wire is a quadratic curve: deepest in the middle) */
const sagAt = (x: number) => 4 * (x / 100) * (1 - x / 100);

const T = { wire: 0.35, wireDur: 1.4, drop: 1.25, dropStep: 0.16, ui: 0.9, ready: 2.4 };
const CYCLE = 3.2; // touch screens: seconds per print
const EASE = [0.16, 1, 0.3, 1] as const;

const subscribeHover = (cb: () => void) => {
  const mq = window.matchMedia("(hover: hover)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const dubaiTime = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
    new Date()
  );

export default function Hero19() {
  const reduce = !!useReducedMotion();
  const canHover = useSyncExternalStore(subscribeHover, () => window.matchMedia("(hover: hover)").matches, () => true);
  const [active, setActive] = useState<number | null>(null);
  const [ready, setReady] = useState(reduce);
  const [time, setTime] = useState("");

  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setReady(true), T.ready * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    const tick = () => setTime(dubaiTime());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  // touch screens: develop the prints one after another
  useEffect(() => {
    if (canHover || !ready) return;
    const id = window.setInterval(() => setActive((a) => (a === null ? 0 : (a + 1) % PRINTS.length)), CYCLE * 1000);
    return () => window.clearInterval(id);
  }, [canHover, ready]);

  const fade = (delay: number, y = 10) =>
    reduce
      ? { initial: false as const }
      : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0, transition: { delay, duration: 1.1, ease: EASE } } };

  const on = active === null ? null : PRINTS[active];

  return (
    <section className={`${styles.root} ${wide.variable}`} aria-label="16x9 — Bringing brands to life">
      {/* the safelight, and the dark it leaves */}
      <div className={styles.safelight} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      {/* ================= top bar ================= */}
      <motion.header className={styles.bar} {...fade(T.ui, -8)}>
        <a href="#top" className={styles.logo} aria-label="16x9 home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="16x9" />
        </a>
        <p className={styles.room}>
          <i aria-hidden="true" /> Darkroom · Dubai
        </p>
        <a href="#contact" className={styles.talk}>
          Let&apos;s talk <span aria-hidden="true">↗</span>
        </a>
      </motion.header>

      {/* ================= the line ================= */}
      <div className={styles.head}>
        <motion.p className={styles.kicker} {...fade(T.ui + 0.05)}>
          16x9 — Video production studio
        </motion.p>
        <h1 className={styles.title}>
          <span className={styles.mask}>
            <motion.span
              className={styles.titleLine}
              {...(reduce ? {} : { initial: { y: "110%" }, animate: { y: 0, transition: { delay: 0.2, duration: 1.2, ease: EASE } } })}
            >
              Bringing brands
            </motion.span>
          </span>
          <span className={styles.mask}>
            <motion.span
              className={styles.titleLine}
              {...(reduce ? {} : { initial: { y: "110%" }, animate: { y: 0, transition: { delay: 0.32, duration: 1.2, ease: EASE } } })}
            >
              to light<em>.</em>
            </motion.span>
          </span>
        </h1>
        <motion.p className={styles.lede} {...fade(T.ui + 0.15)}>
          Films, campaigns and content, developed with care. Pick a print.
        </motion.p>
      </div>

      {/* ================= the wire ================= */}
      {/* drawn across the room by a clip, so the line stays one clean stroke */}
      <motion.svg
        className={styles.wire}
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        aria-hidden="true"
        {...(reduce
          ? {}
          : {
              initial: { clipPath: "inset(-50% 100% -50% 0%)" },
              animate: { clipPath: "inset(-50% 0% -50% 0%)", transition: { delay: T.wire, duration: T.wireDur, ease: [0.76, 0, 0.24, 1] } },
            })}
      >
        <path d="M0 0 Q50 20 100 0" vectorEffect="non-scaling-stroke" />
      </motion.svg>

      {/* ================= the prints ================= */}
      <nav className={styles.prints} aria-label="Main" onPointerLeave={() => canHover && setActive(null)}>
        {PRINTS.map((p, i) => {
          const isOn = active === i;
          const isAway = active !== null && !isOn;
          return (
            <motion.a
              key={p.label}
              href={p.href}
              className={`${styles.print} ${isOn ? styles.printOn : ""} ${isAway ? styles.printAway : ""}`}
              style={{ ["--x" as string]: `${p.x}%`, ["--sag-at" as string]: sagAt(p.x), ["--tilt" as string]: `${p.tilt}deg`, ["--i" as string]: i }}
              aria-label={`${p.no} ${p.label} — ${p.line}`}
              onPointerEnter={(e) => e.pointerType === "mouse" && ready && setActive(i)}
              onClick={(e) => {
                // touch: the first tap develops the print, the second goes in
                if (!canHover && active !== i) {
                  e.preventDefault();
                  setActive(i);
                }
              }}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              {...(reduce
                ? {}
                : {
                    initial: { y: "-140%", opacity: 0 },
                    animate: { y: 0, opacity: 1, transition: { delay: T.drop + i * T.dropStep, type: "spring", stiffness: 120, damping: 14 } },
                  })}
            >
              {/* the peg */}
              <span className={styles.peg} aria-hidden="true">
                <i />
                <i />
              </span>
              {/* the print: it swings on the peg */}
              <span className={styles.swing}>
                <span className={styles.paper}>
                  <span className={styles.image}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt="" draggable={false} />
                    {/* undeveloped: the paper still shows through; developing lifts it */}
                    <span className={styles.undeveloped} aria-hidden="true" />
                  </span>
                  <span className={styles.pencil}>
                    <span>{p.no}</span>
                    {p.label}
                  </span>
                </span>
              </span>
            </motion.a>
          );
        })}
      </nav>

      {/* ================= the foot ================= */}
      <motion.footer className={styles.foot} {...fade(T.ui + 0.25, 6)}>
        <p className={styles.status} aria-live="polite">
          <span key={on?.label ?? "idle"} className={styles.statusText}>
            {on ? (
              <>
                Developing <b>{on.label}</b> — {on.line}
              </>
            ) : canHover ? (
              "Point at a print to develop it"
            ) : (
              "Tap a print to develop it"
            )}
          </span>
        </p>
        <p className={styles.clock}>
          Dubai <span suppressHydrationWarning>{time || "--:--:--"}</span>
        </p>
      </motion.footer>
    </section>
  );
}
