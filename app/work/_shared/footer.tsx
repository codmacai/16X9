"use client";

import Link from "next/link";
import { STUDIO } from "../../about/contact";
import s from "./footer.module.css";

// ===========================================================================
// FOOTER — the foot of every page that scrolls (who we are, 9x16's accounts,
// a film's page), on the black, in the site's own hand: light wide capitals,
// hairlines, small tracked labels. Across the top, the three formats as an
// index between full-width hairlines — each its number, its name large and
// light, what it covers — a way into its work; pointed at, the name turns to a
// hairline outline, the frame's corners close round it and the others step
// back. Under them three columns: the selling line and "Let's talk", the
// sitemap, and how to reach us. Along the foot, a hairline, then the mark,
// where we are, the rights and the line. Fill in the studio's details in
// about/contact.tsx (STUDIO): an empty one isn't shown.
// ===========================================================================

const FORMATS = [
  { key: "16x9", label: "16x9", line: "Film campaigns, commercials and documentaries" },
  { key: "9x16", label: "9x16", line: "Social content, strategy and account management" },
  { key: "beyond", label: "Beyond", line: "Activations, immersive experiences, AR and VR" },
];

const SITEMAP = [
  { label: "Home", href: "/" },
  { label: "Work", href: "/work?format=16x9" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/about#contact" },
];

export default function Footer() {
  const follow = [
    STUDIO.instagram && { label: "Instagram", href: STUDIO.instagram },
    STUDIO.linkedin && { label: "LinkedIn", href: STUDIO.linkedin },
  ].filter(Boolean) as { label: string; href: string }[];
  const reach = [
    STUDIO.email && { label: "Inquiries", value: STUDIO.email, href: `mailto:${STUDIO.email}` },
    STUDIO.phone && { label: "Phone", value: STUDIO.phone, href: `tel:${STUDIO.phone.replace(/\s/g, "")}` },
    { label: "Studio", value: STUDIO.city },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  return (
    <footer className={s.footer}>
      {/* the three formats, large, between hairlines */}
      <nav className={s.formats} aria-label="The work, by format">
        {FORMATS.map((f, i) => (
          <Link key={f.key} className={s.format} href={`/work?format=${f.key}`}>
            <span className={s.no}>{String(i + 1).padStart(2, "0")}</span>
            <span className={s.word}>
              {f.label}
              {/* the frame's corners, closing round the word pointed at */}
              <i className={s.corners} aria-hidden="true">
                <b />
                <b />
                <b />
                <b />
              </i>
            </span>
            <span className={s.line}>
              {f.line} <i aria-hidden="true">↗</i>
            </span>
          </Link>
        ))}
      </nav>

      <div className={s.cols}>
        <div className={s.col}>
          <p className={s.lab}>Start a project</p>
          <p className={s.say}>We find the story, shape the idea and bring it to life.</p>
          <Link className={s.talk} href={STUDIO.email ? `mailto:${STUDIO.email}` : "/about#contact"}>
            <span>Let&apos;s talk</span>
            <i aria-hidden="true">↗</i>
          </Link>
        </div>

        <nav className={s.col} aria-label="Sitemap">
          <p className={s.lab}>Sitemap</p>
          <ul className={s.map}>
            {SITEMAP.map((m) => (
              <li key={m.label}>
                <Link href={m.href}>{m.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={s.col}>
          <p className={s.lab}>Contact us</p>
          <ul className={s.reach}>
            {reach.map((r) => (
              <li key={r.label}>
                <i>{r.label}</i>
                {r.href ? <a href={r.href}>{r.value}</a> : <span>{r.value}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={s.bar}>
        <span className={s.mark} role="img" aria-label="16x9 & Beyond" />
        <span className={s.follow}>
          {follow.length ? (
            <>
              Follow us —
              {follow.map((f) => (
                <a key={f.label} href={f.href} target="_blank" rel="noopener noreferrer">
                  {f.label}
                </a>
              ))}
            </>
          ) : (
            STUDIO.city
          )}
        </span>
        <span>© 16x9 &amp; Beyond. All rights reserved</span>
        <span className={s.end}>Stories beyond the frame</span>
      </div>
    </footer>
  );
}
