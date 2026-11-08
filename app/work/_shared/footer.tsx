"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { STUDIO } from "./studio";
import s from "./footer.module.css";

// ===========================================================================
// FOOTER — the foot of every page that scrolls (who we are, 9x16's accounts,
// a film's page), on the black: the studio's mark, drawn the width of the
// page. Its frame is a hairline, open at the foot on the right, where 16X9
// stands in the corner breaking out of it, & BEYOND tiny under it — stories
// beyond the frame. As it comes into view the frame draws itself round, from
// the corner, and the name rises in after it. Inside the frame, as on a
// screen: the line, "Let's talk", and where we are. Under it, tiny, the rights
// and the way back to the top. Fill in the studio's details in
// studio.ts (STUDIO): an empty one isn't shown. On the About page it is the
// contact section itself: every "Let's talk" (/about#contact) lands here.
// ===========================================================================

export default function Footer() {
  // in view: the frame draws and the name rises, once
  const [seen, setSeen] = useState(false);
  const reach = [
    STUDIO.email && { value: STUDIO.email, href: `mailto:${STUDIO.email}` },
    STUDIO.phone && { value: STUDIO.phone, href: `tel:${STUDIO.phone.replace(/\s/g, "")}` },
    STUDIO.instagram && { value: "Instagram ↗", href: STUDIO.instagram },
    STUDIO.linkedin && { value: "LinkedIn ↗", href: STUDIO.linkedin },
    { value: STUDIO.city },
  ].filter(Boolean) as { value: string; href?: string }[];

  return (
    <motion.footer
      id="contact"
      className={`${s.footer} ${seen ? s.seen : ""}`}
      onViewportEnter={() => setSeen(true)}
      viewport={{ once: true, amount: 0.3 }}
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
          <div className={s.say}>
            <p className={s.lab}>Start a project</p>
            <p className={s.line}>We find the story, shape the idea and bring it to life.</p>
            <Link className={s.talk} href={STUDIO.email ? `mailto:${STUDIO.email}` : "/about#contact"}>
              <span>Let&apos;s talk</span>
              <i aria-hidden="true">↗</i>
            </Link>
          </div>
          <ul className={s.reach}>
            {reach.map((r) => (
              <li key={r.value}>{r.href ? <a href={r.href}>{r.value}</a> : r.value}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className={s.bar}>
        <span>© 16x9 &amp; Beyond</span>
        <span className={s.tag}>Stories beyond the frame</span>
        <button type="button" className={s.top} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Back to top <i aria-hidden="true">↑</i>
        </button>
      </div>
    </motion.footer>
  );
}
