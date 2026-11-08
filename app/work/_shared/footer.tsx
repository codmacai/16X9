"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { OFFICES, STUDIO } from "./studio";
import s from "./footer.module.css";

// ===========================================================================
// FOOTER — the foot of every page that scrolls (who we are, 9x16's accounts,
// a film's page): a screen of black that closes the page, built on the
// studio's mark. The mark is drawn the width of the page — its frame a
// hairline, open at the foot on the right, where 16X9 stands in the corner
// breaking out of it, & BEYOND tiny under it: stories beyond the frame — and
// everything sits inside it, as on a screen. At its head, the line set large
// and "Let's talk"; at its foot, the two partnership headquarters, each with
// its e-mail, address and phone. As it comes into view the frame draws itself
// round from the corner, the name rises in, and what's inside comes up after.
// Under it all, tiny, the rights and the way back to the top. The details
// live in studio.ts. On the About page it is the contact section itself:
// every "Let's talk" (/about#contact) lands here.
// ===========================================================================

export default function Footer() {
  // in view: the frame draws, the name rises, what's inside comes up — once
  const [seen, setSeen] = useState(false);

  return (
    <motion.footer
      id="contact"
      className={`${s.footer} ${seen ? s.seen : ""}`}
      onViewportEnter={() => setSeen(true)}
      viewport={{ once: true, amount: 0.25 }}
    >
      <div className={s.stage}>
        {/* the mark, the width of the page: its frame a hairline, 16X9 in its open corner */}
        <div className={s.markBox}>
          <svg className={s.mark} viewBox="0 0 1244 600" aria-hidden="true">
            <path className={s.frame} d="M 735 492 H 8 V 8 H 1040 V 292" pathLength={1} />
            <text className={s.name} x="732" y="500" textLength="503" lengthAdjust="spacingAndGlyphs">
              16X9
            </text>
          </svg>
          <span className={s.beyond} aria-hidden="true">
            &amp; Beyond
          </span>
          <span className={s.sr}>16x9 &amp; Beyond</span>
        </div>

        {/* inside the frame, as on a screen */}
        <div className={s.inside}>
          <div className={s.top}>
            <div className={s.say}>
              <p className={s.lab}>Start a project</p>
              <p className={s.line}>Have a story? We find it, shape the idea and bring it to life.</p>
            </div>
            <a className={s.talk} href={`mailto:${STUDIO.email}`}>
              <span>Let&apos;s talk</span>
              <i aria-hidden="true">↗</i>
            </a>
          </div>

          <div className={s.offices}>
            {OFFICES.map((o) => (
              <address key={o.name} className={s.office}>
                <p className={s.officeName}>{o.name}</p>
                <dl>
                  <div>
                    <dt>E-mail</dt>
                    <dd>
                      <a href={`mailto:${o.email}`}>{o.email}</a>
                    </dd>
                  </div>
                  <div>
                    <dt>Address{o.note && <i> ({o.note})</i>}</dt>
                    <dd>{o.address}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>
                      <a href={`tel:${o.tel}`}>{o.phone}</a>
                    </dd>
                  </div>
                </dl>
              </address>
            ))}
          </div>
        </div>
      </div>

      <div className={s.bar}>
        <span>© 16x9 &amp; Beyond</span>
        <span className={s.tag}>Stories beyond the frame</span>
        <button type="button" className={s.up} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Back to top <i aria-hidden="true">↑</i>
        </button>
      </div>
    </motion.footer>
  );
}
