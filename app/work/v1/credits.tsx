"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import type { Project } from "../_shared/data";
import d from "./detail.module.css";

// ===========================================================================
// SIGN-OFF — the film's end credits, on an old 4:3 television, the way a
// channel used to close the night. All of it is tied to the page's scroll:
//   · as the section comes up, the lights go down: the paper fades to black
//     around the set;
//   · pinned, the set switches on like a tube does — a bright line opening
//     into a picture, with a flash — and its power light comes up red;
//   · the credits roll up the curved glass with the scroll, in glowing paper
//     type, a faint "16×9" channel mark in the corner;
//   · at the end it switches off the old way: the picture collapses to a
//     line, the line to a dot, and the dot goes dark.
// ===========================================================================

const SMOOTH = { stiffness: 120, damping: 28, mass: 0.6 };
const PAPER = "#f7f2ee";
const ROLL = { from: 0.08, to: 0.9 }; // the stretch of the scroll the credits roll over

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function Credits({
  film,
  label,
  container,
  reduce,
}: {
  film: Project;
  label: string;
  container: RefObject<HTMLDivElement | null>;
  reduce: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<HTMLDivElement>(null);
  const size = useRef({ glass: 400, roll: 1600 });

  // the lights go down as the section comes up
  const { scrollYProgress: lightsRaw } = useScroll({ container, target: ref, offset: ["start end", "start start"] });
  const room = useTransform(lightsRaw, [0.2, 0.9], [PAPER, "#000000"]);
  const kicker = useTransform(lightsRaw, [0.75, 1], [0, 1]);

  // pinned: on, the roll, off
  const { scrollYProgress: rollRaw } = useScroll({ container, target: ref, offset: ["start start", "end end"] });
  const p = useSpring(rollRaw, SMOOTH);
  const tubeY = useTransform(p, [0, 0.05, 0.93, 0.965], [0.004, 1, 1, 0.004]);
  const tubeX = useTransform(p, [0.965, 0.995], [1, 0]);
  const flash = useTransform(p, [0, 0.035, 0.09, 0.925, 0.955, 0.99], [0, 0.85, 0, 0, 0.85, 0]);
  const led = useTransform(p, [0, 0.03, 0.97, 1], [0.2, 1, 1, 0.2]);
  const y = useTransform(p, (v) => {
    const t = clamp((v - ROLL.from) / (ROLL.to - ROLL.from), 0, 1);
    return size.current.glass + (-size.current.roll - size.current.glass) * t; // from under the glass to clear above it
  });

  // the roll's distance depends on the glass and the credits' own height
  useEffect(() => {
    const g = glassRef.current;
    const r = rollRef.current;
    if (!g || !r) return;
    // (the roll picks the new size up on the next scroll; until the set is
    // switched on it's out of sight anyway)
    const measure = () => {
      size.current = { glass: g.offsetHeight, roll: r.offsetHeight };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(g);
    ro.observe(r);
    return () => ro.disconnect();
  }, []);

  const groups = film.credits ?? [];

  return (
    <motion.section ref={ref} className={d.signoff} style={{ backgroundColor: room }} aria-label={`End credits: ${film.title}`}>
      <div className={d.signoffStage}>
        <motion.span className={d.signoffKicker} style={{ opacity: kicker }} aria-hidden="true">
          End credits
        </motion.span>

        <div className={d.set}>
          <div ref={glassRef} className={d.tvGlass}>
            <motion.div className={d.tube} style={reduce ? undefined : { scaleX: tubeX, scaleY: tubeY }}>
              <motion.div ref={rollRef} className={d.roll} style={{ y }}>
                <div className={d.rollOpen}>
                  <span className={d.rollKicker}>{label}</span>
                  <span className={d.rollTitle}>{film.title}</span>
                  <span className={d.rollFor}>A 16×9 film for {film.client}</span>
                </div>
                {groups.map((g) => (
                  <div key={g.heading} className={d.group}>
                    <span className={d.groupHead}>{g.heading}</span>
                    {g.rows.map((r, i) =>
                      r.role ? (
                        <div key={i} className={d.credit}>
                          <span className={d.role}>{r.role}</span>
                          <span className={d.names}>
                            {r.names.map((n) => (
                              <span key={n}>{n}</span>
                            ))}
                          </span>
                        </div>
                      ) : (
                        <div key={i} className={d.creditSolo}>
                          {r.names.map((n) => (
                            <span key={n}>{n}</span>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                ))}
                <div className={d.rollEnd}>
                  <span className={d.rollMark}>16×9</span>
                  <span className={d.rollYear}>{film.year}</span>
                </div>
              </motion.div>
              <span className={d.bug} aria-hidden="true">
                16×9
              </span>
              <span className={d.scan} aria-hidden="true" />
              {!reduce && <motion.span className={d.flash} style={{ opacity: flash }} aria-hidden="true" />}
            </motion.div>
            <span className={d.tvVignette} aria-hidden="true" />
            <span className={d.tvSheen} aria-hidden="true" />
          </div>
          <div className={d.setFoot} aria-hidden="true">
            <span className={d.setBadge}>16×9</span>
            <motion.i className={d.led} style={{ opacity: led }} />
          </div>
        </div>
      </div>
    </motion.section>
  );
}
