"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SERVICES_9X16, type Service } from "./_shared/data";
import SectionLabel from "./section-label";
import s from "./services.module.css";

// ===========================================================================
// WORK, 9x16 — what we do, under the accounts: the services one above
// another, each told in full, so it reads as a page and not a menu. A row
// for each, between hairlines that draw across as it comes into view: on the
// left its name, large and light; on the right a few sentences on what we do
// and, under a small label, everything it includes, set as a list in two
// columns between fine rules. The name rises out of its line, the words and
// the list come up after it. On a phone the name sits over the words.
// ===========================================================================

export default function Services916({ reduce }: { reduce: boolean }) {
  return (
    <section className={s.services} aria-labelledby="services-title">
      <SectionLabel no="02" id="services-title" reduce={reduce}>
        Our services
      </SectionLabel>
      <div className={s.list}>
        {SERVICES_9X16.map((sv) => (
          <Row key={sv.name.join(" ")} sv={sv} reduce={reduce} />
        ))}
      </div>
    </section>
  );
}

function Row({ sv, reduce }: { sv: Service; reduce: boolean }) {
  // everything in the row goes once, as it comes into view (CSS, .on)
  const [seen, setSeen] = useState(false);
  return (
    <motion.article
      className={`${s.row} ${seen || reduce ? s.on : ""}`}
      onViewportEnter={() => setSeen(true)}
      viewport={{ once: true, amount: 0.25 }}
    >
      <i className={s.rule} aria-hidden="true" />
      <h3 className={s.name}>
        {sv.name.map((line, i) => (
          <span key={line} className={s.mask}>
            <span className={s.rise} style={{ transitionDelay: `${0.12 + i * 0.08}s` }}>
              {line}
            </span>
          </span>
        ))}
      </h3>
      <div className={s.body}>
        <p className={s.about}>{sv.about}</p>
        <p className={s.lab}>What&apos;s included</p>
        <ul className={s.includes}>
          {sv.includes.map((item, i) => (
            <li key={item} style={{ "--i": i } as React.CSSProperties}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </motion.article>
  );
}
