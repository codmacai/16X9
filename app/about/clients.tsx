"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useMotionTemplate, useReducedMotion, useSpring } from "framer-motion";
import { EASE } from "../work/_shared/chrome";
import s from "./clients.module.css";

// ===========================================================================
// CLIENTS — who has trusted us, shown like a wall in a dark room: black,
// one light hanging over it. As the room comes into view the light flickers
// on and the names come up out of the dark under it, row by row. The light
// follows the pointer along the wall (slowly, on a spring with no bounce),
// so whatever you look at is the one lit.
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

export default function Clients() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const on = useInView(ref, { once: true, amount: 0.35 });
  // where the light hangs, as a share of the width (0.5 = the middle)
  const x = useMotionValue(0.5);
  const lx = useSpring(x, { stiffness: 40, damping: 22, mass: 1 });
  const at = useMotionTemplate`${lx}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      x.set(Math.min(0.85, Math.max(0.15, (e.clientX - r.left) / r.width)));
    };
    const leave = () => x.set(0.5);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [reduce, x]);

  return (
    <motion.section
      ref={ref}
      id="clients"
      className={s.room}
      style={{ ["--lx" as string]: at }}
      aria-labelledby="clients-title"
    >
      {/* the light: a lamp at the top and the cone it throws */}
      <motion.div
        className={s.light}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={on ? { opacity: reduce ? 1 : [0, 0.7, 0.15, 0.9, 0.4, 1] } : { opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 1.4, times: [0, 0.12, 0.22, 0.34, 0.46, 1], ease: "easeOut" }}
      >
        <span className={s.lamp} />
        <span className={s.coneBlur}>
          <span className={s.cone} />
        </span>
        <span className={s.pool} />
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

      <ul className={s.wall}>
        {CLIENTS.map(([file, name], i) => (
          <motion.li
            key={file}
            className={s.client}
            initial={{ opacity: 0, y: 14 }}
            animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
            transition={reduce ? { duration: 0 } : { duration: 1, ease: EASE, delay: 1 + Math.floor(i / 5) * 0.12 + (i % 5) * 0.05 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/about/clients/${file}.webp`} alt={name} loading="lazy" decoding="async" draggable={false} />
          </motion.li>
        ))}
      </ul>
    </motion.section>
  );
}
