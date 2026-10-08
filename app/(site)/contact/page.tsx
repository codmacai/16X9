import type { Metadata } from "next";
import { STUDIO } from "@/components/site/content";
import ContactForm from "@/components/site/contact-form";
import LocalTime from "@/components/site/local-time";
import sx from "@/components/site/sections.module.css";

export const metadata: Metadata = {
  title: "Contact — 16x9 & Beyond",
  description: "Start a project with 16x9 & Beyond, a film studio for brands in Dubai. Tell us about your brand, your idea and your deadline.",
};

export default function ContactPage() {
  return (
    <>
      <header className={sx.intro}>
        <p className={sx.eyebrow}>
          <b>(05)</b> Start a project
        </p>
        <h1 className={sx.display}>
          Let&apos;s <em>talk</em>
        </h1>
      </header>

      <section className={sx.contact} aria-label="Project brief">
        <ContactForm />
        <aside className={sx.details} aria-label="Studio details">
          <div>
            <p className={sx.eyebrow}>Email</p>
            <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a>
          </div>
          <div>
            <p className={sx.eyebrow}>Studio</p>
            <span>{STUDIO.place}</span>
            <span>
              Local time <LocalTime timeZone={STUDIO.timeZone} />
            </span>
          </div>
          <div>
            <p className={sx.eyebrow}>Follow</p>
            {STUDIO.socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}
