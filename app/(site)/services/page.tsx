import type { Metadata } from "next";
import { posterFor } from "@/app/hero7/wall-playback";
import { CallToAction, Process } from "@/components/site/blocks";
import { SERVICES } from "@/components/site/content";
import { AutoVideo, Reveal } from "@/components/site/motion";
import sx from "@/components/site/sections.module.css";

export const metadata: Metadata = {
  title: "Services — 16x9 & Beyond",
  description:
    "Strategy and creative, production, post-production and social content: everything a brand film needs, from one studio in Dubai.",
};

export default function ServicesPage() {
  return (
    <>
      <header className={sx.intro}>
        <p className={sx.eyebrow}>
          <b>(03)</b> Production · Post · Strategy
        </p>
        <h1 className={sx.display}>Services</h1>
        <div className={sx.split}>
          <p className={sx.lede}>
            One studio from the first idea to the last export. Take the whole journey with us, or just the part you need.
          </p>
        </div>
      </header>

      {SERVICES.map((s) => (
        <section key={s.slug} id={s.slug} className={sx.svcBlock} aria-labelledby={`${s.slug}-title`}>
          <Reveal className={sx.svcText}>
            <p className={sx.eyebrow}>
              <b>{s.no}</b> {s.line}
            </p>
            <h2 id={`${s.slug}-title`}>{s.title}</h2>
            <p className={sx.lede}>{s.body}</p>
            <ul className={sx.deliverables}>
              {s.deliverables.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal className={`${sx.svcMedia} ${s.frame === "tall" ? sx.svcMediaTall : ""}`} delay={0.1}>
            <AutoVideo src={s.clip} poster={posterFor(s.clip)} />
            <span className={sx.svcMediaTag}>{s.frame === "tall" ? "9:16" : "16:9"}</span>
          </Reveal>
        </section>
      ))}

      <Process no="05" />
      <CallToAction />
    </>
  );
}
