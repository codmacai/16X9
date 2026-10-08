"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import type { Project } from "../_shared/data";
import Edge from "./edge";
import d from "./detail.module.css";

// ===========================================================================
// SIGN-OFF — the film's end credits, set the way the menu sets its words:
// light, wide capitals on black.
//   · The black rises over the page above it by a dragged edge (edge.tsx):
//     the middle leads, the sides trail, stretching with the speed of the
//     scroll; the page above sinks back as it's covered (detail.tsx).
//   · Once it's on screen the credits roll by themselves, at a cinema's
//     pace — the film's title first, then each role over its names — and
//     only the line passing the middle is lit; the rest wait in the dark.
//     It ends on the 16X9 mark, settling in the middle, and holds there.
//   · It's one screen tall: scrolling just carries on to the next section
//     (the roll pauses while it's off screen, and plays again from the top
//     if you come back after it has finished).
// ===========================================================================

const SPEED = 70; // px a second: the pace of a cinema's roll
const LOGO_SRC = "/logo.png";
const FOCUS = 0.34; // how far from the middle (a share of the screen's height) a line still catches light

export default function Credits({
  film,
  label,
  container,
  sectionRef,
  drag,
  recede,
  reduce,
}: {
  film: Project;
  label: string;
  container: RefObject<HTMLDivElement | null>;
  sectionRef: RefObject<HTMLElement | null>;
  /** the speed of the scroll, for the edge */
  drag: MotionValue<number>;
  /** how it steps back as the next section rises over it */
  recede: { scale: MotionValue<number>; y: MotionValue<string>; opacity: MotionValue<number> };
  reduce: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const lines = useRef<HTMLElement[]>([]);
  const geo = useRef({ stage: 800, end: 0, tops: [] as number[], hs: [] as number[] });
  const started = useRef(false);
  const y = useMotionValue(4000); // below the screen until it's measured
  const inView = useInView(sectionRef, { root: container, amount: 0.55 });

  // light the line passing the middle; the rest wait in the dark
  const light = useCallback((at: number) => {
    const g = geo.current;
    const mid = g.stage / 2;
    const reach = g.stage * FOCUS;
    lines.current.forEach((el, i) => {
      const centre = at + g.tops[i] + g.hs[i] / 2;
      const e = Math.max(0, 1 - Math.abs(centre - mid) / reach);
      el.style.opacity = (0.12 + 0.88 * e * e).toFixed(3);
    });
  }, []);
  useEffect(() => {
    if (reduce) return;
    light(y.get());
    return y.on("change", light);
  }, [light, reduce, y]);

  // measure the column (on mount, and whenever it or the screen changes size)
  useEffect(() => {
    const stage = stageRef.current;
    const col = colRef.current;
    if (!stage || !col) return;
    const ro = new ResizeObserver(() => {
      const els = Array.from(col.querySelectorAll<HTMLElement>("[data-line]"));
      const last = els[els.length - 1];
      if (!last) return;
      const stageH = stage.offsetHeight;
      lines.current = els;
      geo.current = {
        stage: stageH,
        end: stageH / 2 - (last.offsetTop + last.offsetHeight / 2), // the mark in the middle
        tops: els.map((e) => e.offsetTop),
        hs: els.map((e) => e.offsetHeight),
      };
      if (!started.current) y.set(stageH); // the column waits just under the screen
      light(y.get());
    });
    ro.observe(stage);
    ro.observe(col);
    return () => ro.disconnect();
  }, [light, y]);

  // roll while it's on screen; hold the mark at the end
  useEffect(() => {
    if (reduce || !inView) return;
    const g = geo.current;
    if (y.get() <= g.end + 1) y.set(g.stage); // it had finished: from the top again
    started.current = true;
    const run: AnimationPlaybackControls = animate(y, g.end, { duration: (y.get() - g.end) / SPEED, ease: "linear" });
    return () => run.stop();
  }, [inView, reduce, y]);

  const groups = film.credits ?? [];

  return (
    <section
      ref={sectionRef}
      className={`${d.signoff} ${reduce ? d.signoffStill : ""}`}
      aria-label={`End credits: ${film.title}`}
    >
      <Edge drag={drag} color="#000" />
      <motion.div
        ref={stageRef}
        className={d.signoffStage}
        style={reduce ? undefined : { scale: recede.scale, y: recede.y, opacity: recede.opacity }}
      >
        <span className={d.signoffKicker} aria-hidden="true">
          End credits
        </span>

        {/* the roll comes out of the dark at the foot and goes back into it at the top */}
        <div className={d.rollWindow}>
          <motion.div ref={colRef} className={d.roll} style={reduce ? undefined : { y }}>
            <span data-line className={d.rollKicker}>
              {label}
            </span>
            <span data-line className={d.rollTitle}>
              {film.title}
            </span>
            <span data-line className={d.rollFor}>
              A 16×9 film for {film.client}
            </span>

            {groups.map((g) => (
              <div key={g.heading} className={d.group}>
                <span data-line className={d.groupHead}>
                  {g.heading}
                </span>
                {g.rows.map((r, i) => (
                  <div key={i} data-line className={r.role ? d.credit : d.creditSolo}>
                    {r.role && <span className={d.role}>{r.role}</span>}
                    <span className={d.names}>
                      {r.names.map((n) => (
                        <span key={n}>{n}</span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            <div data-line className={d.rollEnd}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_SRC} alt="16x9" />
              <span>{film.year}</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
