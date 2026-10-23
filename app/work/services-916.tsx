"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { motion, useScroll, useSpring, useTransform, type Variants } from "framer-motion";
import { EASE } from "./_shared/chrome";
import { SERVICES_9X16, stillFor, type Service } from "./_shared/data";
import { startMuted } from "./brand-shared";
import label from "./label.module.css";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services as tickets.
// Paper, upright like the frame, notched where a perforation runs above the
// stub ("16x9 & Beyond · Admit one · Nº 001"), the service's number at the
// head and its name at the foot. As the page scrolls each is dealt in —
// rising from below, turning as it comes, settling square. Point at one and
// it tips toward the pointer, a sheen crossing the paper, and the ticket
// becomes a screen: the service's work wipes up from the perforation and
// plays, its name turning to paper over it. Click it to play it whole.
// Three to a row (two on a tablet); on a phone they run in a row you swipe,
// the one in the middle of the screen playing.
// ===========================================================================

const DEAL = { stiffness: 110, damping: 22, mass: 0.6 }; // the deal, eased
// the section's label, its stub wiping in
const STUB: Variants = {
  out: { clipPath: "inset(0 100% 0 0)", y: 10 },
  in: { clipPath: "inset(0 0% 0 0)", y: 0, transition: { duration: 1.1, ease: EASE } },
};
const TURN = [-7, 5, -4, 6, -6, 4]; // how far each is turned as it comes up, degrees
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export default function Services916({ reduce, onOpen }: { reduce: boolean; onOpen: (index: number) => void }) {
  const [on, setOn] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // no pointer to point with: the ticket in the middle of the screen plays
  useEffect(() => {
    const list = listRef.current;
    if (!list || !window.matchMedia("(hover: none)").matches) return;
    const items = [...list.children];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = items.indexOf(e.target);
          setOn((cur) => (e.isIntersecting ? i : cur === i ? null : cur));
        }
      },
      { rootMargin: "-40% -30% -40% -30%" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className={s.services} aria-labelledby="services-title">
      <motion.h2 id="services-title" className={label.label} initial={reduce ? false : "out"} whileInView="in" viewport={{ once: true, amount: 0.6 }}>
        <motion.span className={label.stub} variants={STUB}>
          <span>02</span>
          <span>Our services</span>
        </motion.span>
      </motion.h2>
      <ul ref={listRef} className={s.grid}>
        {SERVICES_9X16.map((sv, i) => (
          <Ticket key={sv.clip} sv={sv} i={i} on={on === i} reduce={reduce} onPoint={setOn} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

function Ticket({
  sv,
  i,
  on,
  reduce,
  onPoint,
  onOpen,
}: {
  sv: Service;
  i: number;
  on: boolean;
  reduce: boolean;
  onPoint: (fn: (cur: number | null) => number | null) => void;
  onOpen: (index: number) => void;
}) {
  // dealt in as it scrolls up: from below, turned, to its place, square; each in a row a beat after the last
  const ref = useRef<HTMLLIElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.55"] });
  const deal = useSpring(scrollYProgress, DEAL);
  const k = (i % 3) * 0.12;
  const t = useTransform(deal, [k, k + 0.76], [0, 1]);
  const y = useTransform(t, [0, 1], [200, 0]);
  const rotate = useTransform(t, [0, 1], [TURN[i % TURN.length], 0]);
  const opacity = useTransform(t, [0, 0.3], [0, 1]);

  // the tip toward the pointer, and the sheen where it is
  const tip = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(px - 0.5) * 10}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 8}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  };
  const name = sv.name.join(" ");

  return (
    <motion.li ref={ref} className={s.slot} style={reduce ? undefined : { y, rotate, opacity }}>
      <article
        className={`${s.ticket} ${on ? s.on : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`Service ${pad(i + 1)}: ${name}. Play`}
        onPointerEnter={(e) => e.pointerType === "mouse" && onPoint(() => i)}
        onPointerMove={tip}
        onPointerLeave={(e) => {
          e.currentTarget.style.setProperty("--rx", "0deg");
          e.currentTarget.style.setProperty("--ry", "0deg");
          if (e.pointerType === "mouse") onPoint((cur) => (cur === i ? null : cur));
        }}
        onClick={() => onOpen(i)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onOpen(i);
        }}
      >
        <div className={s.body}>
          {/* the work, printed faintly on the paper */}
          <span className={s.print} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stillFor(sv.clip)} alt="" loading="lazy" draggable={false} />
          </span>
          {/* the screen the ticket becomes: wiping up from the perforation */}
          <span className={s.screen} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stillFor(sv.clip)} alt="" loading="lazy" draggable={false} />
            {on && !reduce && <video ref={startMuted} src={sv.clip} muted autoPlay playsInline loop preload="auto" />}
          </span>
          <span className={s.head} aria-hidden="true">
            <span>Service</span>
            <span>{pad(i + 1)}</span>
          </span>
          <span className={s.foot}>
            <h3 className={s.name}>
              {sv.name.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h3>
            <span className={s.tags}>{sv.tags.join("  ·  ")}</span>
          </span>
        </div>
        {/* the stub, under the perforation */}
        <span className={s.stub} aria-hidden="true">
          <span>16x9 &amp; Beyond</span>
          <span>Admit one</span>
          <span>Nº {pad(i + 1, 3)}</span>
        </span>
        <i className={s.sheen} aria-hidden="true" />
      </article>
    </motion.li>
  );
}
