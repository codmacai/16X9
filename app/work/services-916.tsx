"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SERVICES_9X16, type Service } from "./_shared/data";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services as our white
// cards, one above another, each told in full, so it reads as a page and not
// a menu. Each card is lit a warm white, in ink, as a museum's label is:
// "Service" and a small 9:16 frame — the shape we make for — at its head; its
// name large and light on the left; on the right a few sentences on what we
// do and, under a small label, everything it includes, as a list in two
// columns between fine rules. A card opens from a line across its middle as
// it comes into view, its words coming up after; pointed at, it lifts a
// little and the frame's corners close round it. On a phone the name sits
// over the words.
// ===========================================================================

export default function Services916({ reduce }: { reduce: boolean }) {
  return (
    <section className={s.services} aria-labelledby="services-title">
      <SectionLabel no="02" id="services-title" reduce={reduce}>
        Our services
      </SectionLabel>
      <div className={s.list}>
        {SERVICES_9X16.map((sv) => (
          <Card key={sv.name.join(" ")} sv={sv} reduce={reduce} />
        ))}
      </div>
    </section>
  );
}

function Card({ sv, reduce }: { sv: Service; reduce: boolean }) {
  // everything on the card goes once, as it comes into view (CSS, .on)
  const [seen, setSeen] = useState(false);
  return (
    <motion.article
      className={`${s.slot} ${seen || reduce ? s.on : ""}`}
      onViewportEnter={() => setSeen(true)}
      viewport={{ once: true, amount: 0.2 }}
    >
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
            {sv.name.map((line, i) => (
              <span key={line} className={s.mask}>
                <span className={s.rise} style={{ transitionDelay: `${0.55 + i * 0.08}s` }}>
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
    </motion.article>
  );
}
