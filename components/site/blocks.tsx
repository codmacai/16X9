import { CLIENTS, PROCESS, STUDIO, TESTIMONIAL } from "./content";
import { Reveal } from "./motion";
import { SiteLink } from "./transition";
import sx from "./sections.module.css";

// Blocks used on more than one page.

export function SectionHead({ no, label, title, link }: { no: string; label: string; title: React.ReactNode; link?: { href: string; label: string } }) {
  return (
    <div className={sx.sectionHead}>
      <div>
        <p className={sx.eyebrow}>
          <b>({no})</b> {label}
        </p>
        <h2 className={sx.display}>{title}</h2>
      </div>
      {link && (
        <SiteLink href={link.href} className={sx.arrowLink}>
          {link.label} <span aria-hidden="true">↗</span>
        </SiteLink>
      )}
    </div>
  );
}

export function Process({ no }: { no: string }) {
  return (
    <section className={`${sx.section} ${sx.sectionRule}`} aria-labelledby="process-title">
      <SectionHead no={no} label="How we work" title={<span id="process-title">From brief <em>to</em> final frame</span>} />
      <ol className={sx.process}>
        {PROCESS.map((p, i) => (
          <li key={p.title}>
            <Reveal delay={i * 0.1}>
              <span className={sx.processTc}>TC {p.tc}</span>
              <h3 className={sx.processTitle}>{p.title}</h3>
              <p className={sx.processBody}>{p.body}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Clients({ no }: { no: string }) {
  const row = [...CLIENTS, ...CLIENTS];
  return (
    <section className={`${sx.section} ${sx.sectionRule}`} aria-labelledby="clients-title">
      <p className={sx.eyebrow} id="clients-title" style={{ marginBottom: "clamp(36px, 6vh, 64px)" }}>
        <b>({no})</b> Brands we&apos;ve brought to life
      </p>
      <div className={sx.marquee} aria-label={CLIENTS.join(", ")} role="img">
        {[0, 1].map((r) => (
          <div key={r} className={sx.marqueeRow} aria-hidden="true">
            {(r ? [...row].reverse() : row).map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Quote() {
  return (
    <section className={`${sx.section} ${sx.sectionRule}`}>
      <Reveal>
        <figure className={sx.quote}>
          <p className={sx.eyebrow} style={{ justifyContent: "center" }}>
            Client words
          </p>
          <blockquote>“{TESTIMONIAL.quote}”</blockquote>
          <figcaption className={sx.eyebrow}>
            <b>{TESTIMONIAL.name}</b> · {TESTIMONIAL.company}
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}

export function CallToAction() {
  return (
    <section className={`${sx.section} ${sx.sectionRule}`} aria-labelledby="cta-title">
      <div className={sx.cta}>
        <p className={sx.eyebrow}>Your film starts here</p>
        <h2 className={sx.ctaTitle} id="cta-title">
          Let&apos;s make <span>something.</span>
        </h2>
        <div className={sx.ctaRow}>
          <p className={sx.lede}>Tell us about your brand, your idea and your deadline. We reply within one working day.</p>
          <div className={sx.ctaButtons}>
            <SiteLink href="/contact" className={sx.button}>
              Start a project <span aria-hidden="true">↗</span>
            </SiteLink>
            <a href={`mailto:${STUDIO.email}`} className={`${sx.button} ${sx.buttonGhost}`}>
              {STUDIO.email}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
