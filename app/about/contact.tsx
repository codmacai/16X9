"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "../work/_shared/chrome";
import s from "./contact.module.css";

// ===========================================================================
// CONTACT — the end of Who we are, and where the menu's Contact and every
// "Let's talk" lead (/about#contact). The brand bible's selling line, the
// ways to reach the studio, and the three formats to look at the work.
// Fill in the studio's details here: an empty one isn't shown.
// ===========================================================================
export const STUDIO = {
  email: "", // e.g. hello@yourstudio.com
  phone: "", // e.g. +971 50 000 0000
  city: "Dubai, UAE",
  instagram: "", // full link
  linkedin: "", // full link
};

const FORMATS = [
  { key: "16x9", label: "16x9", line: "Film campaigns, commercials and documentaries" },
  { key: "9x16", label: "9x16", line: "Social content, strategy and account management" },
  { key: "beyond", label: "Beyond", line: "Activations, immersive experiences, AR and VR" },
];

export default function Contact() {
  const reduce = !!useReducedMotion();
  const rise = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0, transition: { delay: d, duration: 0.9, ease: EASE } },
          viewport: { once: true, amount: 0.3 },
        };
  const ways = [
    STUDIO.email && { label: "Email", value: STUDIO.email, href: `mailto:${STUDIO.email}` },
    STUDIO.phone && { label: "Phone", value: STUDIO.phone, href: `tel:${STUDIO.phone.replace(/\s/g, "")}` },
    STUDIO.instagram && { label: "Instagram", value: "Instagram ↗", href: STUDIO.instagram },
    STUDIO.linkedin && { label: "LinkedIn", value: "LinkedIn ↗", href: STUDIO.linkedin },
    { label: "Studio", value: STUDIO.city },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  return (
    <section id="contact" className={s.contact} aria-label="Contact">
      <motion.p className={s.kicker} {...rise(0)}>
        Let&apos;s talk
      </motion.p>
      <motion.h2 className={s.head} {...rise(0.08)}>
        We find the story, shape the idea and bring it to life.
      </motion.h2>
      <motion.ul className={s.ways} {...rise(0.18)}>
        {ways.map((w) => (
          <li key={w.label}>
            <i>{w.label}</i>
            {w.href ? (
              <a href={w.href} target={w.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                {w.value}
              </a>
            ) : (
              <span>{w.value}</span>
            )}
          </li>
        ))}
      </motion.ul>
      <motion.nav className={s.formats} aria-label="See the work" {...rise(0.28)}>
        {FORMATS.map((f) => (
          <Link key={f.key} href={`/work?format=${f.key}`}>
            <b>{f.label}</b>
            <span>{f.line}</span>
            <i aria-hidden="true">→</i>
          </Link>
        ))}
      </motion.nav>
    </section>
  );
}
