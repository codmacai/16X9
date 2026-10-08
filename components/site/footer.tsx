import { NAV, STUDIO } from "./content";
import LocalTime from "./local-time";
import { SiteLink } from "./transition";
import styles from "./site.module.css";

// ===========================================================================
// FOOTER — the end credits: the links, the studio's details and the name,
// set across the full width like a title card.
// ===========================================================================
export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div className={styles.footerLead}>
          <p className={styles.label}>Have a film in mind?</p>
          <SiteLink href="/contact" className={styles.footerCta}>
            Start a project <span aria-hidden="true">↗</span>
          </SiteLink>
        </div>

        <nav className={styles.footerCol} aria-label="Footer">
          <p className={styles.label}>Pages</p>
          {NAV.map((n) => (
            <SiteLink key={n.href} href={n.href}>
              {n.label}
            </SiteLink>
          ))}
        </nav>

        <div className={styles.footerCol}>
          <p className={styles.label}>Studio</p>
          <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a>
          <span>{STUDIO.place}</span>
          <span>
            Local time <LocalTime timeZone={STUDIO.timeZone} />
          </span>
        </div>

        <div className={styles.footerCol}>
          <p className={styles.label}>Follow</p>
          {STUDIO.socials.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          ))}
        </div>
      </div>

      <p className={styles.footerName} aria-hidden="true">
        16X9 <span>&amp; Beyond</span>
      </p>

      <div className={styles.footerBase}>
        <span>© {new Date().getFullYear()} {STUDIO.name}</span>
        <span>{STUDIO.tagline}</span>
      </div>
    </footer>
  );
}
