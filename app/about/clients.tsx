"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { EASE } from "../work/_shared/chrome";
import s from "./clients.module.css";

// ===========================================================================
// CLIENTS — who has trusted us, shown like a wall in a dark room. One lamp
// hangs over the middle and stays there: the names under it are lit, the
// rest wait in the dark. The pointer is a torch: a soft pool of light follows
// it and brings up the names it passes over. As the room comes into view the
// lamp flickers on and the names come up out of the dark, row by row.
//
// Nothing here repaints as the pointer moves. The lamp and its cone are drawn
// once; the torch is a round window (a soft mask) that slides over the wall
// with a second, lit copy of the names inside it sliding the other way, so the
// copy stays in register — two transforms the compositor moves on its own.
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

const TORCH = 340; // the torch's pool, px across
const FOLLOW = { stiffness: 140, damping: 26, mass: 0.8 }; // how the torch trails the pointer (no bounce)

/** The names, laid out on the wall (rendered three times: dim, lit by the lamp, lit by the torch). */
function Names({ rise, on, reduce, alt = false }: { rise?: boolean; on: boolean; reduce: boolean; alt?: boolean }) {
  return (
    <ul className={s.names} aria-hidden={alt || undefined}>
      {CLIENTS.map(([file, name], i) => (
        <motion.li
          key={file}
          className={s.name}
          initial={rise ? { opacity: 0, y: 14 } : false}
          animate={rise ? (on ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }) : undefined}
          transition={reduce ? { duration: 0 } : { duration: 1, ease: EASE, delay: 1 + Math.floor(i / 5) * 0.12 + (i % 5) * 0.05 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/about/clients/${file}.webp`} alt={alt ? "" : name} loading="lazy" decoding="async" draggable={false} />
        </motion.li>
      ))}
    </ul>
  );
}

export default function Clients() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { once: true, amount: 0.35 });

  // the torch: where it is over the wall (px from the wall's corner), trailing the pointer
  const tx = useMotionValue(-9999);
  const ty = useMotionValue(-9999);
  const sx = useSpring(tx, FOLLOW);
  const sy = useSpring(ty, FOLLOW);
  const torchOn = useMotionValue(0);
  const glow = useSpring(torchOn, { stiffness: 90, damping: 24 });
  // the window slides with the torch; the lit copy inside slides back, so it stays in register
  const winX = useTransform(sx, (v) => v - TORCH / 2);
  const winY = useTransform(sy, (v) => v - TORCH / 2);
  const inX = useTransform(winX, (v) => -v);
  const inY = useTransform(winY, (v) => -v);

  useEffect(() => {
    const el = ref.current;
    const wall = wallRef.current;
    if (!el || !wall || reduce || !window.matchMedia("(hover: hover)").matches) return;
    let box = wall.getBoundingClientRect();
    const measure = () => (box = wall.getBoundingClientRect());
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      measure(); // cheap here: the wall doesn't move under the pointer
      tx.set(e.clientX - box.left);
      ty.set(e.clientY - box.top);
      torchOn.set(1);
    };
    const leave = () => torchOn.set(0);
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("resize", measure);
    };
  }, [reduce, tx, ty, torchOn]);

  return (
    <section ref={ref} id="clients" className={s.room} aria-labelledby="clients-title">
      {/* the lamp over the middle, and the cone it throws: drawn once */}
      <motion.div
        className={s.light}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={on ? { opacity: reduce ? 1 : [0, 0.7, 0.15, 0.9, 0.4, 1] } : { opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 1.4, times: [0, 0.12, 0.22, 0.34, 0.46, 1], ease: "easeOut" }}
      >
        <span className={s.lamp} />
        <span className={s.cone} />
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
        {/* the names in the dark */}
        <div className={s.dim}>
          <Names rise on={on} reduce={reduce} />
        </div>
        {/* ...lit where the lamp falls (a fixed soft mask, never redrawn) */}
        <motion.div
          className={s.lampLit}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: on ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 1.2, delay: reduce ? 0 : 1.2, ease: EASE }}
        >
          <Names on={on} reduce={reduce} alt />
        </motion.div>
        {/* ...and where the torch is: a soft round window over a lit copy */}
        <motion.div className={s.torch} style={{ x: winX, y: winY, opacity: glow, width: TORCH, height: TORCH }} aria-hidden="true">
          <motion.div className={s.torchIn} style={{ x: inX, y: inY }}>
            <Names on={on} reduce={reduce} alt />
          </motion.div>
        </motion.div>
      </div>

      <span className={s.grain} aria-hidden="true" />
    </section>
  );
}
