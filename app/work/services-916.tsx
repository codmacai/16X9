"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { SERVICES_9X16, stillFor, type Service } from "./_shared/data";
import { startMuted } from "./brand-shared";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services as frames in the
// accounts' language — a hairline in the dark, the work inside in black and
// white, the service's number at the head and its name at the foot. As the
// page scrolls each frame opens from a line across its middle, as the
// opening's frame does, the picture settling inside it and the name rising
// after it; once open it stays open. The pictures drift inside their frames
// and the columns at their own pace, as the accounts' do. Point at one (on a
// phone, scroll it to the middle of the screen) and its work wipes up from
// its foot in colour and plays, the hairline lit and a fine line running
// along the foot; click it to play it whole.
// ===========================================================================

const OPEN = { stiffness: 90, damping: 22, mass: 0.6 }; // the opening, eased
const DRIFT = { stiffness: 90, damping: 24, mass: 0.5 }; // the columns' drift, eased
const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Services916({ reduce, onOpen }: { reduce: boolean; onOpen: (index: number) => void }) {
  const [on, setOn] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // three to a row, two on a tablet or a phone: which column each frame is in
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1080px)");
    const set = () => setCols(mq.matches ? 2 : 3);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // each column drifting at its own pace as the page scrolls past
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start end", "end start"] });
  const drift = useSpring(scrollYProgress, DRIFT);
  const lanes = [useDrift(drift, 24, reduce), useDrift(drift, 72, reduce), useDrift(drift, 40, reduce)];

  // no pointer to point with: the frame in the middle of the screen plays
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
      { rootMargin: "-45% -20% -45% -20%" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className={s.services} aria-labelledby="services-title">
      <SectionLabel no="02" id="services-title" reduce={reduce}>
        Our services
      </SectionLabel>
      <ul ref={listRef} className={s.grid}>
        {SERVICES_9X16.map((sv, i) => (
          <Card
            key={sv.clip}
            sv={sv}
            i={i}
            col={i % cols}
            lane={lanes[i % cols]}
            on={on === i}
            reduce={reduce}
            onPoint={setOn}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}

function Card({
  sv,
  i,
  col,
  lane,
  on,
  reduce,
  onPoint,
  onOpen,
}: {
  sv: Service;
  i: number;
  col: number;
  lane: MotionValue<number>;
  on: boolean;
  reduce: boolean;
  onPoint: (fn: (cur: number | null) => number | null) => void;
  onOpen: (index: number) => void;
}) {
  // the opening, on the scroll: each column a beat after the one before; once open, it stays open
  const ref = useRef<HTMLLIElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.45"] });
  const eased = useSpring(scrollYProgress, OPEN);
  const k = col * 0.1;
  const reach = useTransform(eased, [k, k + 0.8], [0, 1]);
  const t = useMotionValue(0);
  useMotionValueEvent(reach, "change", (v) => v > t.get() && t.set(v));
  const shut = useTransform(t, [0, 0.75], [1, 0]); // the two covers over the frame, drawing back
  const settle = useTransform(t, [0, 1], [1.4, 1]);
  const rise = useTransform(t, [0.4, 1], ["110%", "0%"]);
  const fade = useTransform(t, [0.5, 1], [0, 1]);
  // the picture drifting inside the frame as the page scrolls past it
  const { scrollYProgress: past } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const pan = useTransform(past, [0, 1], ["-7%", "7%"]);

  return (
    <motion.li ref={ref} className={s.slot} style={reduce ? undefined : { y: lane }}>
      <motion.article
        className={`${s.card} ${on ? s.on : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`${pad2(i + 1)} ${sv.name.join(" ")}: play`}
        onPointerEnter={(e) => e.pointerType === "mouse" && onPoint(() => i)}
        onPointerLeave={(e) => e.pointerType === "mouse" && onPoint((cur) => (cur === i ? null : cur))}
        onClick={() => onOpen(i)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onOpen(i);
        }}
      >
        {/* the work in black and white, settling as the frame opens */}
        <span className={s.print} aria-hidden="true">
          <motion.span className={s.pan} style={reduce ? undefined : { y: pan }}>
            <motion.img src={stillFor(sv.clip)} alt="" loading="lazy" draggable={false} style={reduce ? undefined : { scale: settle }} />
          </motion.span>
        </span>
        {/* pointed at: the work in colour, wiping up from the foot */}
        <span className={s.screen} aria-hidden="true">
          <motion.span className={s.pan} style={reduce ? undefined : { y: pan }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stillFor(sv.clip)} alt="" loading="lazy" draggable={false} />
            {on && !reduce && <video ref={startMuted} src={sv.clip} muted autoPlay playsInline loop preload="auto" />}
          </motion.span>
        </span>

        <motion.span className={s.head} style={reduce ? undefined : { opacity: fade }} aria-hidden="true">
          <span>{pad2(i + 1)}</span>
          <span className={s.play}>
            <i /> Play
          </span>
        </motion.span>
        <span className={s.foot}>
          <h3 className={s.name}>
            {sv.name.map((line) => (
              <span key={line} className={s.mask}>
                <motion.span style={reduce ? undefined : { y: rise }}>{line}</motion.span>
              </span>
            ))}
          </h3>
          <motion.span className={s.tags} style={reduce ? undefined : { opacity: fade }}>
            {sv.tags.join("  ·  ")}
          </motion.span>
        </span>
        {/* playing: a fine line running along the foot */}
        <i className={s.progress} aria-hidden="true" />
        {/* shut, two covers in the page's dark meet across its middle; it opens as they draw back */}
        {!reduce && (
          <>
            <motion.i className={s.shutHead} style={{ scaleY: shut }} aria-hidden="true" />
            <motion.i className={s.shutFoot} style={{ scaleY: shut }} aria-hidden="true" />
          </>
        )}
      </motion.article>
    </motion.li>
  );
}

// a column's drift as the page scrolls past: from `px` below its place to `px` above it
function useDrift(progress: MotionValue<number>, px: number, reduce: boolean) {
  return useTransform(progress, [0, 1], reduce ? [0, 0] : [px, -px]);
}
