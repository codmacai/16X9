"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import type { Project } from "../_shared/data";
import d from "./detail.module.css";

// ===========================================================================
// SIGN-OFF — the film's end credits, set the way the menu sets its words:
// light, wide capitals on black. All of it is tied to the page's scroll
// (smoothed by a spring), one to one, so it reads at the pace you read:
//   · as the section comes up, the lights go down: the paper fades to black;
//   · then the credits roll up through the screen in one centred column —
//     the film's title first, then each role over its names — and only the
//     line passing the middle of the screen is lit; the rest wait in the
//     dark, so it reads one credit at a time (the focus pull of the line of
//     films, in type);
//   · it ends on the 16X9 mark, settling in the middle as the last credits
//     clear.
// ===========================================================================

const SMOOTH = { stiffness: 110, damping: 26, mass: 0.6 };
const PAPER = "#f7f2ee";
const LOGO_SRC = "/logo.png";
const FOCUS = 0.34; // how far from the middle (a share of the screen's height) a line still catches light

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
  const stageRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const lines = useRef<HTMLElement[]>([]);
  const geo = useRef({
    stage: 800,
    run: 1600,
    tops: [] as number[],
    hs: [] as number[],
  });
  const [length, setLength] = useState<number | null>(null); // the section: the roll's distance, plus a screen

  // the lights go down as the section comes up
  const { scrollYProgress: lightsRaw } = useScroll({
    container,
    target: ref,
    offset: ["start end", "start start"],
  });
  const room = useTransform(lightsRaw, [0.2, 0.9], [PAPER, "#000000"]);
  const kicker = useTransform(lightsRaw, [0.8, 1], [0, 1]);

  // the roll: from the column's top at the foot of the screen, to the mark in the middle
  const { scrollYProgress: rollRaw } = useScroll({
    container,
    target: ref,
    offset: ["start start", "end end"],
  });
  const smooth = useSpring(rollRaw, SMOOTH);
  const p = reduce ? rollRaw : smooth;
  const y = useTransform(p, (v) => geo.current.stage - v * geo.current.run);

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
    light(y.get());
    return y.on("change", light);
  }, [y, light]);

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
      const run = stageH / 2 + last.offsetTop + last.offsetHeight / 2;
      lines.current = els;
      geo.current = {
        stage: stageH,
        run,
        tops: els.map((e) => e.offsetTop),
        hs: els.map((e) => e.offsetHeight),
      };
      setLength(run + stageH);
      light(stageH - p.get() * run);
    });
    ro.observe(stage);
    ro.observe(col);
    return () => ro.disconnect();
  }, [light, p]);

  const groups = film.credits ?? [];

  return (
    <motion.section
      ref={ref}
      className={d.signoff}
      style={{ backgroundColor: room, ...(length ? { height: length } : {}) }}
      aria-label={`End credits: ${film.title}`}
    >
      <div ref={stageRef} className={d.signoffStage}>
        <motion.span
          className={d.signoffKicker}
          style={{ opacity: kicker }}
          aria-hidden="true"
        >
          End credits
        </motion.span>

        {/* the roll comes out of the dark at the foot and goes back into it at the top */}
        <div className={d.rollWindow}>
          <motion.div ref={colRef} className={d.roll} style={{ y }}>
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
                  <div
                    key={i}
                    data-line
                    className={r.role ? d.credit : d.creditSolo}
                  >
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
      </div>
    </motion.section>
  );
}
