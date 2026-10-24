"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue, type Transition } from "framer-motion";
import { useRouter } from "next/navigation";
import RoomSwitch from "../hero4/room-switch";
import { Band, rootClass } from "./_shared/chrome";
import { BEYOND_PROJECTS, stillFor, type BeyondProject } from "./_shared/data";
import { startMuted } from "./brand-shared";
import { useSmoothWheel } from "./smooth-wheel";
import s from "./beyond.module.css";

// ===========================================================================
// WORK, BEYOND — the studio's top service, project by project. It opens in
// the white room the landing's Beyond leads into (hero 8): a bright white
// wall with daylight drifting across it, the four corners opened out to the
// screen's, "Stories you step into" and what Beyond covers. Then each project
// takes the whole screen in turn, rising over the last as a sheet while the
// one before falls back: its film in Beyond's wide frame (2.39:1), playing
// while it's on screen, its name large, a line on it and what kind of work it
// was. Down the side, the projects by number — the one on screen lit; click
// one to go to it.
// ===========================================================================

const RISE: Transition = { type: "spring", stiffness: 70, damping: 18, mass: 1 };
const WHAT = ["Brand activations", "Immersive experiences", "Projection mapping", "AR & VR", "Experiential events"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const N = BEYOND_PROJECTS.length;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// where the projects lie: the top of their stack, a sheet's height, from one sheet to the next (its
// height and the hold before the next comes up), the band they stop under, the screen's height
type Geo = { top: number; h: number; step: number; band: number; vh: number };

export default function Beyond() {
  const reduce = !!useReducedMotion();
  const router = useRouter();
  useSmoothWheel(true);
  // the sheets stick as they rise, so where they are is read off the stack they're in (which
  // doesn't), once and on resize
  const stackRef = useRef<HTMLDivElement>(null);
  const geo = useMotionValue<Geo>({ top: 0, h: 1, step: 1, band: 0, vh: 1 });
  useEffect(() => {
    const measure = () => {
      const st = stackRef.current;
      const first = st?.firstElementChild as HTMLElement | null;
      const second = first?.nextElementSibling as HTMLElement | null;
      if (!st || !first) return;
      const h = first.offsetHeight;
      const hold = second ? parseFloat(getComputedStyle(second).marginTop) || 0 : 0;
      geo.set({ top: st.offsetTop, h, step: h + hold, band: parseFloat(getComputedStyle(first).top) || 0, vh: window.innerHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [geo]);
  const { scrollY } = useScroll();

  // the project on screen (-1: still in the room): one counts once it's half risen
  const [at, setAt] = useState(-1);
  useMotionValueEvent(scrollY, "change", (y) => {
    const g = geo.get();
    const k = Math.max(-1, Math.min(N - 1, Math.floor((y + g.band - g.top + g.h / 2) / g.step)));
    if (k !== at) setAt(k);
  });

  // to a project: where its sheet has fully risen, at the start of its hold
  const goTo = (i: number) => {
    const g = geo.get();
    window.scrollTo({ top: g.top + i * g.step - g.band, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <main className={`${rootClass} ${s.page}`}>
      <Band
        crumb="Index"
        workHref="/work?format=beyond"
        center={<RoomSwitch room="beyond" onSwitch={(k) => router.replace(`/work?format=${k}`, { scroll: false })} tone="light" />}
      />

      {/* ================= the white room ================= */}
      <section className={s.room} aria-labelledby="beyond-title">
        <span className={s.sun} aria-hidden="true" />
        <span className={s.daylight} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className={s.corners} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <div className={s.roomIn}>
          <motion.p className={s.kicker} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...RISE, delay: 0.2 }}>
            <span>03</span> Beyond
          </motion.p>
          <h1 id="beyond-title" className={s.title}>
            {["Stories you", "step into."].map((line, i) => (
              <span key={line} className={s.mask}>
                <motion.span initial={reduce ? false : { y: "105%" }} animate={{ y: 0 }} transition={{ ...RISE, delay: 0.3 + i * 0.1 }}>
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.ol className={s.what} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.8 }}>
            {WHAT.map((w, i) => (
              <li key={w}>
                <b>{pad2(i + 1)}</b>
                {w}
              </li>
            ))}
          </motion.ol>
        </div>
        <motion.button
          type="button"
          className={s.cue}
          onClick={() => goTo(0)}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 1.2 }}
        >
          The projects <i aria-hidden="true" />
        </motion.button>
      </section>

      {/* ================= the projects, a screen each ================= */}
      <div ref={stackRef} className={s.stack}>
        {BEYOND_PROJECTS.map((p, i) => (
          <Sheet key={p.title} p={p} i={i} last={i === N - 1} on={at === i} reduce={reduce} scrollY={scrollY} geo={geo} />
        ))}
      </div>

      {/* down the side: the projects by number, the one on screen lit */}
      <nav className={`${s.index} ${at >= 0 ? s.indexOn : ""}`} aria-label="Projects">
        {BEYOND_PROJECTS.map((p, i) => (
          <button key={p.title} type="button" className={at === i ? s.indexAt : undefined} onClick={() => goTo(i)} aria-label={`${pad2(i + 1)} ${p.title}`}>
            {pad2(i + 1)}
          </button>
        ))}
      </nav>
    </main>
  );
}

/** One project, the whole screen: it rises over the last and, as the next rises over it, falls back. */
function Sheet({
  p,
  i,
  last,
  on,
  reduce,
  scrollY,
  geo,
}: {
  p: BeyondProject;
  i: number;
  last: boolean;
  on: boolean;
  reduce: boolean;
  scrollY: MotionValue<number>;
  geo: MotionValue<Geo>;
}) {
  // covered: from when the next comes up into the screen to when it has risen over it
  const covered = useTransform(() => {
    const g = geo.get();
    return clamp01((scrollY.get() - (g.top + (i + 1) * g.step - g.vh)) / g.h);
  });
  const back = useTransform(covered, [0, 1], [1, 0.93]);
  const veil = useTransform(covered, [0, 1], [0, 0.14]);
  // its film plays once it has come on screen, and keeps its place after
  const [seen, setSeen] = useState(false);
  if (on && !seen) setSeen(true);

  return (
    <section className={s.sheet} aria-label={`${pad2(i + 1)} — ${p.title}`}>
      <motion.div className={s.sheetIn} style={reduce || last ? undefined : { scale: back }}>
        <div className={s.head}>
          <span>
            <b>{pad2(i + 1)}</b> {p.kind}
          </span>
          {p.demo && <span className={s.demo}>Demo project</span>}
        </div>
        <div className={s.screen}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stillFor(p.clip)} alt="" loading="lazy" draggable={false} />
          {seen && !reduce && <video ref={startMuted} src={p.clip} muted autoPlay playsInline loop preload="auto" />}
        </div>
        <div className={s.foot}>
          <h2 className={s.name}>{p.title}</h2>
          <p className={s.line}>{p.line}</p>
        </div>
      </motion.div>
      {!reduce && !last && <motion.i className={s.veil} style={{ opacity: veil }} aria-hidden="true" />}
    </section>
  );
}
