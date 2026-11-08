"use client";

import { type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useSpring, type Transition, type Variants } from "framer-motion";
import { OFFICES, STUDIO } from "./studio";
import s from "./footer.module.css";

// ===========================================================================
// FOOTER — the foot of every page that scrolls (who we are, 9x16's accounts,
// a film's page): a screen of black that closes the page, with room to
// breathe. At its head the question, set large — HAVE A STORY? — and the line
// under it; beside it "Let's talk", a large circle that leans after the
// pointer on a spring and mails the studio. Under them the two partnership
// headquarters, each on its own warm-white card (our cards), its e-mail,
// address and phone in rows. Along the foot, a hairline, then the mark, the
// rights, the line and the way back to the top. Everything comes in on a
// spring as it comes into view, one after another. The details live in
// studio.ts. On the About page it is the contact section itself: every
// "Let's talk" (/about#contact) lands here.
// ===========================================================================

const SPRING: Transition = { type: "spring", stiffness: 70, damping: 15, mass: 1 };
const PULL = { stiffness: 160, damping: 14, mass: 0.6 }; // the circle after the pointer

// each part comes in on the spring, a beat after the one before
const IN: Variants = {
  out: { opacity: 0, y: 60 },
  in: (k: number) => ({ opacity: 1, y: 0, transition: { ...SPRING, delay: 0.08 + k * 0.1 } }),
};
const WORD: Variants = {
  out: { y: "110%" },
  in: (k: number) => ({ y: "0%", transition: { ...SPRING, delay: 0.05 + k * 0.08 } }),
};
const CIRCLE: Variants = {
  out: { opacity: 0, scale: 0.6 },
  in: { opacity: 1, scale: 1, transition: { ...SPRING, delay: 0.35 } },
};

export default function Footer() {
  // the circle leans after the pointer, on a spring
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, PULL);
  const y = useSpring(my, PULL);
  const lean = (e: ReactPointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left - r.width / 2) * 0.28);
    my.set((e.clientY - r.top - r.height / 2) * 0.28);
  };
  const rest = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.footer id="contact" className={s.footer} initial="out" whileInView="in" viewport={{ once: true, amount: 0.3 }}>
      <div className={s.head}>
        <div className={s.ask}>
          <motion.p className={s.lab} variants={IN} custom={0}>
            Start a project
          </motion.p>
          <h2 className={s.big}>
            {["Have a", "story?"].map((w, k) => (
              <span key={w} className={s.mask}>
                <motion.span className={s.word} variants={WORD} custom={k}>
                  {w}
                </motion.span>
              </span>
            ))}
          </h2>
          <motion.p className={s.line} variants={IN} custom={2}>
            We find it, shape the idea and bring it to life.
          </motion.p>
        </div>

        <motion.a
          className={s.talk}
          href={`mailto:${STUDIO.email}`}
          variants={CIRCLE}
          style={{ x, y }}
          onPointerMove={lean}
          onPointerLeave={rest}
        >
          <span className={s.talkIn}>
            Let&apos;s talk <i aria-hidden="true">↗</i>
          </span>
        </motion.a>
      </div>

      {/* the two headquarters, a card each */}
      <div className={s.offices}>
        {OFFICES.map((o, k) => (
          <motion.address key={o.name} className={s.office} variants={IN} custom={3 + k}>
            <p className={s.officeName}>{o.name}</p>
            <dl>
              <div>
                <dt>E-mail</dt>
                <dd>
                  <a href={`mailto:${o.email}`}>{o.email}</a>
                </dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>
                  {o.address}
                  {o.note && <i>{o.note}</i>}
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${o.tel}`}>{o.phone}</a>
                </dd>
              </div>
            </dl>
          </motion.address>
        ))}
      </div>

      <motion.div className={s.bar} variants={IN} custom={5}>
        <span className={s.mark} role="img" aria-label="16x9 & Beyond" />
        <span>© 16x9 &amp; Beyond</span>
        <span className={s.tag}>Stories beyond the frame</span>
        <button type="button" className={s.up} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Back to top <i aria-hidden="true">↑</i>
        </button>
      </motion.div>
    </motion.footer>
  );
}
