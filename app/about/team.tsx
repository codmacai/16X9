"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion, useScroll } from "framer-motion";
import Curve from "./curve";
import s from "./team.module.css";

// ===========================================================================
// THE TEAM — the people behind the frame, as one wall of portraits. The black
// rises over the opening by its arched edge (curve.tsx); on it, the team in
// black and white, four rows of portraits laid edge to edge on a curved wall
// that fills the screen and runs on past its sides — the ones in the middle
// facing you, the wall bending gently away towards its sides, its top and its
// foot, as if seen through a wide lens. It doesn't turn: it's a wall. As the section comes into view the
// portraits fall in onto it from the middle out; then it leans a little after
// the pointer, and settles a touch as you scroll past. Each portrait is placed
// once, in CSS, on the wall's curve (an ellipsoid, wider than it is tall).
// ===========================================================================

// the team, in black and white (stand-ins cut from the old site's About page:
// replace each with the full-size original)
const PEOPLE = Array.from({ length: 15 }, (_, i) => `/about/team/team-${String(i + 1).padStart(2, "0")}.webp`);
const COLS = 11;
const ROWS = 4;
const LON = 16; // degrees between columns
const LAT = 24; // degrees between rows
const WIDE = 1.5; // the wall is this much wider than it is deep or tall
const LEAN = { x: 4, y: 6 }; // how far it leans after the pointer, in degrees
const SETTLE = 6; // degrees it tips as the section is scrolled past

const rad = (deg: number) => (deg * Math.PI) / 180;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

// every place on the wall: where it is (in radii) and which way it faces, and who's there (no two
// neighbours the same)
const TILES = Array.from({ length: COLS * ROWS }, (_, n) => {
  const c = Math.floor(n / ROWS);
  const r = n % ROWS;
  const lon = rad((c - (COLS - 1) / 2) * LON);
  const lat = rad(((ROWS - 1) / 2 - r) * LAT); // the top row first
  // on the ellipsoid: x wide, y up (negative down the screen), z towards us
  const x = WIDE * Math.sin(lon) * Math.cos(lat);
  const y = -Math.sin(lat);
  const z = Math.cos(lon) * Math.cos(lat);
  // facing out along the surface's normal
  const nx = x / (WIDE * WIDE);
  const ny = y;
  const nz = z;
  const len = Math.hypot(nx, ny, nz);
  const yaw = Math.atan2(nx, nz);
  const pitch = Math.asin(-ny / len); // up is positive
  return {
    x: r4(x),
    y: r4(y),
    z: r4(z),
    yaw: r4((yaw * 180) / Math.PI),
    pitch: r4((pitch * 180) / Math.PI),
    src: PEOPLE[(n * 7 + 3) % PEOPLE.length],
    // they fall in from the middle out
    delay: r4(Math.abs(c - (COLS - 1) / 2) * 0.08 + Math.abs(r - (ROWS - 1) / 2) * 0.06),
  };
});

export default function Team() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  // in view: the portraits fall in, once
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // the wall's lean: after the pointer, and tipping a touch with the scroll
  useEffect(() => {
    const wall = wallRef.current;
    const view = viewRef.current;
    if (!wall || !view || reduce) return;
    let raf = 0;
    let seen = false;
    let lean = { x: 0, y: 0 };
    const aim = { x: 0, y: 0 };
    const io = new IntersectionObserver(([e]) => (seen = e.isIntersecting), { rootMargin: "10% 0px" });
    io.observe(view);
    const fine = window.matchMedia("(pointer: fine)").matches;
    const move = (e: PointerEvent) => {
      const r = view.getBoundingClientRect();
      aim.x = ((e.clientY - r.top) / r.height - 0.5) * -LEAN.x * 2;
      aim.y = ((e.clientX - r.left) / r.width - 0.5) * LEAN.y * 2;
    };
    const leave = () => {
      aim.x = 0;
      aim.y = 0;
    };
    if (fine) {
      view.addEventListener("pointermove", move);
      view.addEventListener("pointerleave", leave);
    }
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!seen) return;
      lean = { x: lean.x + (aim.x - lean.x) * 0.06, y: lean.y + (aim.y - lean.y) * 0.06 };
      const tip = (scrollYProgress.get() - 0.5) * -SETTLE;
      wall.style.transform = `translateZ(calc(var(--r) * -1)) rotateX(${(lean.x + tip).toFixed(3)}deg) rotateY(${lean.y.toFixed(3)}deg)`;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      view.removeEventListener("pointermove", move);
      view.removeEventListener("pointerleave", leave);
    };
  }, [reduce, scrollYProgress]);

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
                    "--pitch": `${t.pitch}deg`,
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
