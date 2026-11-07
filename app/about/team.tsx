"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion, useScroll } from "framer-motion";
import Curve from "./curve";
import s from "./team.module.css";

// ===========================================================================
// THE TEAM — the people behind the frame, as a wall of portraits bent round a
// globe. The black rises over the opening by its arched edge (curve.tsx); on
// it, the team in black and white, four rows of portraits laid edge to edge
// round a sphere — the ones in the middle facing you, those towards its edges
// turning away, as if the wall were curved round a lens. As the section comes
// into view the portraits fall in from far out onto the globe; then it turns,
// slowly on its own and further as you scroll past, tilts a little after the
// pointer, and can be dragged round (swiped, on a phone). One transform on the
// globe moves it all, a frame at a time; each portrait is placed once, in CSS.
// ===========================================================================

// the team, in black and white (stand-ins cut from the old site's About page:
// replace each with the full-size original)
const PEOPLE = Array.from({ length: 15 }, (_, i) => `/about/team/team-${String(i + 1).padStart(2, "0")}.webp`);
const COLS = 16; // round the globe: enough that it can turn all the way round
const ROWS = 4;
const LAT = 24; // degrees between rows
const AUTO = 3.2; // degrees a second it turns on its own
const SCROLLED = 110; // degrees it turns as the section is scrolled past
const TILT = { x: 7, y: 12 }; // how far it leans after the pointer, in degrees

// every place on the globe: its longitude and latitude, and who's there (no
// two neighbours the same)
const TILES = Array.from({ length: COLS * ROWS }, (_, n) => {
  const c = Math.floor(n / ROWS);
  const r = n % ROWS;
  return {
    lon: c * (360 / COLS),
    lat: (r - (ROWS - 1) / 2) * LAT,
    src: PEOPLE[(n * 7 + 3) % PEOPLE.length],
    // they fall in from the middle out
    delay: Math.min(c, COLS - c) * 0.07 + Math.abs(r - 1.5) * 0.05,
  };
});

export default function Team() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const globeRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [dragged, setDragged] = useState(false);

  // in view: the portraits fall in (once), and the globe turns while it's on screen
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // the globe's turn: on its own, with the scroll, after the pointer, and by hand
  useEffect(() => {
    const globe = globeRef.current;
    const view = viewRef.current;
    if (!globe || !view) return;
    let raf = 0;
    let last = performance.now();
    let spin = 0; // its own turning, and what the hand has added
    let fling = 0; // the hand's throw, dying away
    let lean = { x: 0, y: 0 };
    const aim = { x: 0, y: 0 };
    let drag: { x: number; at: number; t: number } | null = null;
    let seen = false;
    const io = new IntersectionObserver(([e]) => (seen = e.isIntersecting), { rootMargin: "10% 0px" });
    io.observe(view);

    const fine = window.matchMedia("(pointer: fine)").matches;
    const move = (e: PointerEvent) => {
      if (fine) {
        const r = view.getBoundingClientRect();
        aim.x = ((e.clientY - r.top) / r.height - 0.5) * -TILT.x * 2;
        aim.y = ((e.clientX - r.left) / r.width - 0.5) * TILT.y * 2;
      }
      if (drag) {
        const dx = e.clientX - drag.x;
        const now = performance.now();
        const step = dx * 0.25;
        spin += step;
        fling = (step / Math.max(1, now - drag.t)) * 16;
        drag = { x: e.clientX, at: drag.at, t: now };
      }
    };
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, at: e.clientX, t: performance.now() };
      fling = 0;
      view.setPointerCapture(e.pointerId);
    };
    const up = () => {
      if (drag) setDragged(true);
      drag = null;
    };
    view.addEventListener("pointermove", move);
    view.addEventListener("pointerdown", down);
    view.addEventListener("pointerup", up);
    view.addEventListener("pointercancel", up);
    view.addEventListener("pointerleave", () => {
      aim.x = 0;
      aim.y = 0;
    });

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!seen) return;
      if (!reduce && !drag) spin += AUTO * dt + fling;
      fling *= 0.94;
      lean = { x: lean.x + (aim.x - lean.x) * 0.06, y: lean.y + (aim.y - lean.y) * 0.06 };
      const turn = spin + (reduce ? 0 : scrollYProgress.get() * SCROLLED) + lean.y;
      globe.style.transform = `translateZ(calc(var(--r) * -1)) rotateX(${lean.x.toFixed(3)}deg) rotateY(${(-turn).toFixed(3)}deg)`;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      view.removeEventListener("pointermove", move);
      view.removeEventListener("pointerdown", down);
      view.removeEventListener("pointerup", up);
      view.removeEventListener("pointercancel", up);
    };
  }, [reduce, scrollYProgress]);

  return (
    <section ref={ref} id="team" className={`${s.section} ${on || reduce ? s.on : ""}`} aria-label="The team">
      <Curve target={ref} color="#000" />
      <div className={s.stage}>
        <p className={s.label}>The team</p>
        <div ref={viewRef} className={s.view} aria-hidden="true">
          <div ref={globeRef} className={s.globe}>
            {TILES.map((t, n) => (
              <span
                key={n}
                className={s.tile}
                style={{ "--lon": `${t.lon}deg`, "--lat": `${-t.lat}deg`, "--delay": `${t.delay.toFixed(2)}s` } as React.CSSProperties}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.src} alt="" draggable={false} decoding="async" loading="lazy" />
              </span>
            ))}
          </div>
        </div>
        <p className={`${s.hint} ${dragged ? s.hintGone : ""}`}>Drag to turn</p>
      </div>
    </section>
  );
}
