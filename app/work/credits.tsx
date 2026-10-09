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
import type { Project } from "./_shared/data";
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
//   · It's one screen tall, and it takes the screen: the first scroll that
//     brings it in carries it the rest of the way up until it fills the
//     view, and the credits roll there, fast. The next scroll carries on to
//     the next section, finished or not (the roll pauses while it's off
//     screen, and plays again from the top if you come back after it ends).
// ===========================================================================

const SPEED = 420; // px a second: a quick roll
const SNAP_S = 1.1; // how long it takes to come up and fill the screen
const HOLD_MS = 650; // after it lands, the rest of that scroll gesture is spent
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

  useSnap(container, sectionRef, reduce);

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
    const run: AnimationPlaybackControls = animate(y, g.end, {
      duration: (y.get() - g.end) / SPEED,
      ease: "linear",
    });
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

/**
 * The first scroll down into the section carries it up to fill the screen and
 * holds it there; the scroll that comes after that goes on as normal.
 */
function useSnap(
  container: RefObject<HTMLDivElement | null>,
  sectionRef: RefObject<HTMLElement | null>,
  reduce: boolean
) {
  useEffect(() => {
    const box = container.current;
    const el = sectionRef.current;
    if (!box || !el || reduce) return;
    let armed = true; // until it has taken the screen, once per pass
    let busy = false; // carrying it up, or spending the rest of that gesture
    let lastWheel = 0;
    let holdUntil = 0;
    let run: AnimationPlaybackControls | null = null;
    const top = () => el.getBoundingClientRect().top - box.getBoundingClientRect().top;

    const snap = () => {
      armed = false;
      busy = true;
      box.style.overflowY = "hidden"; // stops a touch fling where it is
      run = animate(box.scrollTop, box.scrollTop + top(), {
        duration: SNAP_S,
        ease: [0.22, 1, 0.36, 1], // leaves at the scroll's own pace and glides in: no jolt
        onUpdate: (v) => (box.scrollTop = v),
        onComplete: () => {
          box.style.overflowY = "";
          holdUntil = performance.now() + HOLD_MS;
          busy = false;
        },
      });
    };

    const onScroll = () => {
      const t = top();
      if (t >= box.clientHeight) armed = true; // back above it: it can take the screen again
      if (armed && !busy && t > 2 && t < box.clientHeight * 0.92) snap();
    };
    // the wheel: while it's coming up, and for the tail of the same gesture, no scrolling
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      const gap = now - lastWheel;
      lastWheel = now;
      if (busy || (now < holdUntil && gap < 180)) {
        e.preventDefault();
        if (!busy) holdUntil = now + 120; // the inertia's still coming: keep spending it
      }
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      run?.stop();
      box.style.overflowY = "";
      box.removeEventListener("scroll", onScroll);
      box.removeEventListener("wheel", onWheel);
    };
  }, [container, sectionRef, reduce]);
}
