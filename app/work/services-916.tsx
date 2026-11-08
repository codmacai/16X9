"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { SERVICES_9X16, type Service } from "./_shared/data";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services as our white
// cards, each told in full. Each card is lit a warm white, in ink, as a
// museum's label is: "Service" and a small 9:16 frame — the shape we make
// for — at its head; its name large and light; a few sentences on what we do
// and, under a small label, everything it includes, as a list between fine
// rules. A card opens from a line across its middle as it comes into view,
// its words coming up after; pointed at, it lifts a little and the frame's
// corners close round it. In one of two layouts:
//
// Stacked (the default): one above another, the full width, its name on the
// left and its words on the right. As the page scrolls each card holds near
// the top of the screen and the next slides up over it, the ones beneath
// settling back a little, so they stack like a deck. (On a phone, or a screen
// too short for a card, they simply follow one another.)
//
// In a row (?services=row): three across, two rows, each card its name over
// its words.
// ===========================================================================

const N = SERVICES_9X16.length;
const SETTLE = 0.035; // how far a card settles back for each card stacked over it

export default function Services916({ reduce }: { reduce: boolean }) {
  const row = useSearchParams().get("services") === "row";
  const listRef = useRef<HTMLDivElement>(null);
  // the stack's progress: 0 as the first card holds, 1 as the last arrives over it
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 0.15", "end 0.95"] });

  return (
    <section className={s.services} aria-labelledby="services-title">
      <SectionLabel no="02" id="services-title" reduce={reduce}>
        Our services
      </SectionLabel>
      <div ref={listRef} className={row ? s.row3 : s.stack}>
        {SERVICES_9X16.map((sv, i) => (
          <Card key={sv.name.join(" ")} sv={sv} i={i} stacked={!row && !reduce} progress={scrollYProgress} reduce={reduce} />
        ))}
      </div>
    </section>
  );
}

function Card({
  sv,
  i,
  stacked,
  progress,
  reduce,
}: {
  sv: Service;
  i: number;
  stacked: boolean;
  progress: MotionValue<number>;
  reduce: boolean;
}) {
  // everything on the card goes once, as it comes into view (CSS, .on)
  const [seen, setSeen] = useState(false);
  // stacked: it settles back a little for every card that has come over it
  const scale = useTransform(progress, (p) => {
    const over = Math.min(N - 1 - i, Math.max(0, p * (N - 1) - i));
    return 1 - over * SETTLE;
  });

  return (
    <motion.article
      className={`${s.slot} ${seen || reduce ? s.on : ""}`}
      style={{ "--i": i } as React.CSSProperties}
      onViewportEnter={() => setSeen(true)}
      viewport={{ once: true, amount: 0.2 }}
    >
      <motion.div className={s.hold} style={stacked ? { scale } : undefined}>
        {/* the frame's corners, closing round the card as it's pointed at */}
        <i className={s.corners} aria-hidden="true">
          <b />
          <b />
          <b />
          <b />
        </i>
        <div className={s.card}>
          <div className={s.side}>
            <header className={s.head}>
              <span>Service</span>
              <i className={s.glyph} aria-hidden="true" />
            </header>
            <h3 className={s.name}>
              {sv.name.map((line, k) => (
                <span key={line} className={s.mask}>
                  <span className={s.rise} style={{ transitionDelay: `${0.55 + k * 0.08}s` }}>
                    {line}
                  </span>
                </span>
              ))}
            </h3>
          </div>
          <div className={s.body}>
            <p className={s.about}>{sv.about}</p>
            <p className={s.lab}>What&apos;s included</p>
            <ul className={s.includes}>
              {sv.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
}
