"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import Curve from "./curve";
import s from "./team.module.css";

// ===========================================================================
// THE TEAM — the people behind the frame, as one clean wall of portraits. The
// black rises over the opening by its arched edge (curve.tsx); on it, the team
// in black and white, five across and three down, each with rounded corners and a
// fine gap between them, on a wall that bends only gently round the viewer
// (a shallow cylinder: its rows stay level, its sides turning a little away).
// As the section comes into view the portraits come up into place from the
// middle out; after that it only leans a touch after the pointer. Each portrait
// is placed once, in CSS (--x, --z and --yaw, in radii of the wall).
// ===========================================================================

// the team, in black and white, each once (stand-ins cut from the old site's
// About page: replace each with the full-size original)
const PEOPLE = Array.from({ length: 15 }, (_, i) => `/about/team/team-${String(i + 1).padStart(2, "0")}.webp`);
const COLS = 5;
const ROWS = 3; // five by three: everyone once
const STEP = 13; // degrees round the wall between columns
const ROW = 0.278; // the distance between rows, in radii of the wall
const LEAN = { x: 2, y: 3 }; // how far it leans after the pointer, in degrees

const rad = (deg: number) => (deg * Math.PI) / 180;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

// every place on the wall, and who's there
const TILES = Array.from({ length: COLS * ROWS }, (_, n) => {
  const c = n % COLS;
  const r = Math.floor(n / COLS);
  const lon = (c - (COLS - 1) / 2) * STEP;
  return {
    x: r4(Math.sin(rad(lon))),
    y: r4((r - (ROWS - 1) / 2) * ROW),
    z: r4(Math.cos(rad(lon))),
    yaw: r4(lon),
    src: PEOPLE[n % PEOPLE.length],
    // they come up from the middle out
    delay: r4(Math.abs(c - (COLS - 1) / 2) * 0.06 + r * 0.05),
  };
});

export default function Team() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  // in view: the portraits come up into place, once
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the wall leans a touch after the pointer
  useEffect(() => {
    const wall = wallRef.current;
    const view = viewRef.current;
    if (!wall || !view || reduce || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    let lean = { x: 0, y: 0 };
    const aim = { x: 0, y: 0 };
    const move = (e: PointerEvent) => {
      const r = view.getBoundingClientRect();
      aim.x = ((e.clientY - r.top) / r.height - 0.5) * -LEAN.x * 2;
      aim.y = ((e.clientX - r.left) / r.width - 0.5) * LEAN.y * 2;
    };
    const leave = () => {
      aim.x = 0;
      aim.y = 0;
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const nx = lean.x + (aim.x - lean.x) * 0.06;
      const ny = lean.y + (aim.y - lean.y) * 0.06;
      if (Math.abs(nx - lean.x) < 0.0005 && Math.abs(ny - lean.y) < 0.0005) return;
      lean = { x: nx, y: ny };
      wall.style.transform = `translateZ(calc(var(--r) * -1)) rotateX(${nx.toFixed(3)}deg) rotateY(${ny.toFixed(3)}deg)`;
    };
    view.addEventListener("pointermove", move);
    view.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      view.removeEventListener("pointermove", move);
      view.removeEventListener("pointerleave", leave);
    };
  }, [reduce]);

  return (
    <section ref={ref} id="team" className={`${s.section} ${on || reduce ? s.on : ""}`} aria-label="The team">
      <Curve target={ref} color="#000" />
      <div className={s.stage}>
        <p className={s.label}>The team</p>
        <div ref={viewRef} className={s.view} aria-hidden="true">
          <div ref={wallRef} className={s.wall}>
            {TILES.map((t, n) => (
              <span
                key={n}
                className={s.tile}
                style={
                  {
                    "--x": t.x,
                    "--y": t.y,
                    "--z": t.z,
                    "--yaw": `${t.yaw}deg`,
                    "--delay": `${t.delay}s`,
                  } as React.CSSProperties
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.src} alt="" draggable={false} decoding="async" loading="lazy" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
