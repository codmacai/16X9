"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { EASE } from "../work/_shared/chrome";
import s from "./clients.module.css";

// ===========================================================================
// CLIENTS — who has trusted us, shown like a wall in a dark room. One light
// hangs at the top in the middle and throws a soft beam down over the wall,
// like a torch: the names in the beam are lit, the rest wait in the dark.
// The light stays where it is; its beam turns after the pointer, heavily,
// and settles back to the middle when the pointer leaves (on a phone it
// sweeps across as you scroll). As the room comes into view the light
// flickers on and the names come up, row by row.
//
// Nothing here repaints as the beam turns. The beam is drawn once and turned
// as one layer; each name has a lit copy laid over its dark one, and as the
// beam turns each copy's opacity follows how squarely the beam falls on it:
// a rotation and twenty small fades, all of which the compositor does alone.
// ===========================================================================

const CLIENTS = [
  ["zarina", "Zarina"],
  ["dm", "DM"],
  ["24print", "24print"],
  ["gms", "GMS"],
  ["fedoriv", "Fedoriv"],
  ["watsons", "Watsons"],
  ["softserve", "SoftServe"],
  ["readdle", "Readdle"],
  ["macpaw", "MacPaw"],
  ["ajax", "Ajax"],
  ["nova-poshta", "Nova Poshta"],
  ["oschadbank", "Oschadbank"],
  ["olx", "OLX"],
  ["google", "Google"],
  ["coca-cola", "Coca-Cola"],
  ["pg", "P&G"],
  ["avon", "Avon"],
  ["gsk", "GSK"],
  ["yodezeen", "YODEZEEN"],
  ["colgate", "Colgate"],
] as const;

const REACH = 46; // how far the beam turns either way, degrees
const TURN = { stiffness: 48, damping: 19, mass: 1.1 }; // how the beam follows the pointer: heavy, over-damped, no bounce
const CORE = 9; // degrees either side of the beam's middle where a name is fully lit
const EDGE = 22; // ...and where the light runs out
const FLICKER = { duration: 1.4, times: [0, 0.12, 0.22, 0.34, 0.46, 1], ease: "easeOut" as const };

/** The names, laid out on the wall: each one in the dark, with its lit copy over it. */
function Names({ on, reduce }: { on: boolean; reduce: boolean }) {
  return (
    <ul className={s.names}>
      {CLIENTS.map(([file, name], i) => (
        <motion.li
          key={file}
          className={s.name}
          initial={{ opacity: 0, y: 14 }}
          animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          transition={reduce ? { duration: 0 } : { duration: 1, ease: EASE, delay: 1 + Math.floor(i / 5) * 0.12 + (i % 5) * 0.05 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.dark} src={`/about/clients/${file}.webp`} alt={name} loading="lazy" decoding="async" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.lit} data-lit="" src={`/about/clients/${file}.webp`} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false} />
        </motion.li>
      ))}
    </ul>
  );
}

export default function Clients() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { once: true, amount: 0.35 });

  // the beam's turn, in degrees (0 = straight down; + turns it towards the left)
  const aim = useMotionValue(0);
  const turn = useSpring(aim, TURN);
  // on a phone it sweeps across the wall as you scroll by
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // each name: which way it lies from the light, and how far; lit as the beam
  // falls on it (fully within CORE of the beam's middle, fading out by EDGE,
  // and a little less the further it is from the light)
  useEffect(() => {
    const room = ref.current;
    const wall = wallRef.current;
    const beam = beamRef.current;
    if (!room || !wall || !beam) return;
    let spots: { el: HTMLElement; a: number; r: number }[] = [];
    const light = (t: number) => {
      for (const sp of spots) {
        const off = Math.abs(sp.a + t); // the beam points at -t
        const e = Math.min(1, Math.max(0, (EDGE - off) / (EDGE - CORE)));
        const far = Math.min(1, Math.max(0.5, 1 - (sp.r - 600) / 1100));
        sp.el.style.opacity = (e * e * (3 - 2 * e) * far).toFixed(3);
      }
    };
    const place = () => {
      const ox = room.clientWidth / 2;
      const oy = beam.offsetTop;
      spots = [...wall.querySelectorAll<HTMLElement>("[data-lit]")].map((el) => {
        const li = el.parentElement as HTMLElement;
        const dx = wall.offsetLeft + li.offsetLeft + li.offsetWidth / 2 - ox;
        const dy = wall.offsetTop + li.offsetTop + li.offsetHeight / 2 - oy;
        return { el, a: (Math.atan2(dx, dy) * 180) / Math.PI, r: Math.hypot(dx, dy) };
      });
      light(turn.get());
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(room);
    ro.observe(wall);
    const off = turn.on("change", light);
    return () => {
      ro.disconnect();
      off();
    };
  }, [turn]);

  // the pointer: the beam turns towards it, from where the light hangs
  useEffect(() => {
    const room = ref.current;
    const beam = beamRef.current;
    if (!room || !beam || reduce) return;
    if (!window.matchMedia("(hover: hover)").matches) {
      return scrollYProgress.on("change", (v) => aim.set(Math.max(-1, Math.min(1, (0.5 - v) * 3.2)) * 24));
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const box = room.getBoundingClientRect(); // cheap here: nothing under it has moved since the last frame
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = Math.max(60, e.clientY - (box.top + beam.offsetTop));
      aim.set(Math.max(-REACH, Math.min(REACH, (-Math.atan2(dx, dy) * 180) / Math.PI)));
    };
    const leave = () => aim.set(0);
    room.addEventListener("pointermove", move, { passive: true });
    room.addEventListener("pointerleave", leave);
    return () => {
      room.removeEventListener("pointermove", move);
      room.removeEventListener("pointerleave", leave);
    };
  }, [reduce, aim, scrollYProgress]);

  return (
    <section ref={ref} id="clients" className={s.room} aria-labelledby="clients-title">
      {/* the light at the top, and its beam in the air: drawn once, turned */}
      <motion.div
        className={s.light}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={on ? { opacity: reduce ? 1 : [0, 0.7, 0.15, 0.9, 0.4, 1] } : { opacity: 0 }}
        transition={reduce ? { duration: 0 } : FLICKER}
      >
        <motion.div ref={beamRef} className={s.beam} style={{ rotate: turn }} />
        <span className={s.glow} />
        <span className={s.lamp} />
      </motion.div>

      <div className={s.head}>
        <motion.p
          className={s.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: on ? 0.6 : 0 }}
          transition={{ duration: reduce ? 0 : 1, delay: reduce ? 0 : 0.6 }}
        >
          Clients
        </motion.p>
        <h2 id="clients-title" className={s.title}>
          <span className={s.mask}>
            <motion.span
              className={s.titleIn}
              initial={{ y: "105%" }}
              animate={{ y: on ? 0 : "105%" }}
              transition={reduce ? { duration: 0 } : { duration: 1.2, ease: EASE, delay: 0.7 }}
            >
              Who trusted us
            </motion.span>
          </span>
        </h2>
      </div>

      <div ref={wallRef} className={s.wall}>
        <Names on={on} reduce={reduce} />
      </div>

      <span className={s.grain} aria-hidden="true" />
    </section>
  );
}
