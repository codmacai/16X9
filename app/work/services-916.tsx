"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring, useTransform, type MotionValue, type Transition } from "framer-motion";
import { EASE_CINE } from "./_shared/chrome";
import { SERVICES_9X16, stillFor, type Service } from "./_shared/data";
import { startMuted } from "./brand-shared";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services set as one
// passage of type, a small vertical frame before each name — a letter tall —
// with that kind of work in it. Scroll, and the passage lights a word at a
// time as you'd read it, each frame opening from a line across its middle as
// the reading reaches it. The frames take turns to play, the one playing in
// colour and the rest grey, and under the passage what it covers rolls in.
// Point at a service and its frame plays and grows, the others fall back;
// click it to play it whole.
// ===========================================================================

const RISE: Transition = { type: "spring", stiffness: 80, damping: 17, mass: 1 };
const READ = { stiffness: 140, damping: 30, mass: 0.4 }; // the reading, eased
const TURN = 3800; // ms each frame plays in turn
const N = SERVICES_9X16.length;
const pad2 = (n: number) => String(n).padStart(2, "0");

// the passage in reading order — each service's frame, then its words — and where each falls in it
const WORDS = SERVICES_9X16.map((sv) => sv.name.join(" ").split(" "));
const START = WORDS.map((_, i) => WORDS.slice(0, i).reduce((n, w) => n + 1 + w.length, 0));
const LENGTH = START[N - 1] + 1 + WORDS[N - 1].length;

export default function Services916({ reduce, onOpen }: { reduce: boolean; onOpen: (index: number) => void }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.92", "end 0.8"] /* reached before the page ends */ });
  const read = useSpring(scrollYProgress, READ);

  // the frames take turns while the passage is on screen; pointing at one holds it
  const [turn, setTurn] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen || hover !== null || reduce) return;
    const t = setInterval(() => setTurn((n) => (n + 1) % N), TURN);
    return () => clearInterval(t);
  }, [seen, hover, reduce]);
  const playing = hover ?? turn;

  return (
    <section className={s.services} aria-labelledby="services-title">
      <motion.h2
        id="services-title"
        className={s.index}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={RISE}
      >
        <span>02</span> Our services
      </motion.h2>

      <p ref={ref} className={s.passage}>
        {SERVICES_9X16.map((sv, i) => (
          <span
            key={sv.clip}
            role="button"
            tabIndex={0}
            className={`${s.svc} ${hover === i ? s.svcOn : hover !== null ? s.svcBack : ""}`}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
            onPointerLeave={() => {
              if (hover === i) setTurn(i);
              setHover(null);
            }}
            onClick={() => onOpen(i)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              onOpen(i);
            }}
            aria-label={`Play ${sv.name.join(" ")}`}
          >
            {/* the frame never parts from the name's first word, nor the number from its last */}
            <span className={s.keep}>
              <Frame sv={sv} at={START[i]} read={read} on={playing === i} reduce={reduce} />
              <Word at={START[i] + 1} read={read} reduce={reduce}>
                {WORDS[i][0]}
              </Word>
              {WORDS[i].length === 1 && <sup className={s.no}>{pad2(i + 1)}</sup>}
            </span>
            {WORDS[i].slice(1).map((w, k, rest) => (
              <Fragment key={k}>
                {" "}
                {k < rest.length - 1 ? (
                  <Word at={START[i] + 2 + k} read={read} reduce={reduce}>
                    {w}
                  </Word>
                ) : (
                  <span className={s.keep}>
                    <Word at={START[i] + 2 + k} read={read} reduce={reduce}>
                      {w}
                    </Word>
                    <sup className={s.no}>{pad2(i + 1)}</sup>
                  </span>
                )}
              </Fragment>
            ))}{" "}
          </span>
        ))}
      </p>

      {/* under the passage: the service playing, and what it covers */}
      <motion.div
        className={s.caption}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 1 }}
        transition={{ ...RISE, delay: 0.2 }}
        aria-hidden="true"
      >
        <span className={s.count}>
          {pad2(playing + 1)} <i>/ {pad2(N)}</i>
        </span>
        <span className={s.capMask}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={playing}
              className={s.capText}
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              exit={{ y: "-110%" }}
              transition={{ duration: 0.8, ease: EASE_CINE }}
            >
              {SERVICES_9X16[playing].tags.join("   ·   ")}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.div>
    </section>
  );
}

/** A word of the passage, lit as the reading reaches it. */
function Word({ read, at, reduce, children }: { read: MotionValue<number>; at: number; reduce: boolean; children: string }) {
  const opacity = useTransform(read, [at / LENGTH, (at + 1) / LENGTH], [0.14, 1]);
  return (
    <motion.span className={s.word} style={reduce ? undefined : { opacity }}>
      {children}
    </motion.span>
  );
}

/** A service's frame, a letter tall: shut to a line until the reading reaches it, then open; in
 *  colour and playing on its turn, grey and still otherwise. */
function Frame({ sv, read, at, on, reduce }: { sv: Service; read: MotionValue<number>; at: number; on: boolean; reduce: boolean }) {
  const shut = useTransform(read, [at / LENGTH, (at + 1.5) / LENGTH], [50, 0]);
  const clipPath = useTransform(shut, (v) => `inset(${v}% 0 ${v}% 0 round 0.09em)`);
  return (
    <span className={`${s.frame} ${on ? s.frameOn : ""}`} aria-hidden="true">
      <motion.span className={s.screen} style={reduce ? undefined : { clipPath }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stillFor(sv.clip)} alt="" loading="lazy" draggable={false} />
        {on && !reduce && <video ref={startMuted} src={sv.clip} muted autoPlay playsInline loop preload="auto" />}
      </motion.span>
    </span>
  );
}
