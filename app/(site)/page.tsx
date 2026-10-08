import type { Metadata } from "next";
import { CallToAction, Clients, Process, Quote, SectionHead } from "@/components/site/blocks";
import { FEATURED, SERVICES, STUDIO } from "@/components/site/content";
import FilmGrid from "@/components/site/films";
import HomeHero from "@/components/site/home-hero";
import { LitText, Reveal } from "@/components/site/motion";
import ServiceList from "@/components/site/service-list";
import { SiteLink } from "@/components/site/transition";
import sx from "@/components/site/sections.module.css";

const title = "16x9 & Beyond — Bringing brands to life";
const description =
  "16x9 & Beyond is a film studio in Dubai for brands: brand films, campaigns, commercials and social content, from the idea to the final frame.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/clips/stills/clip-01.webp", width: 1280, height: 720, alt: "A still from the 16x9 & Beyond showreel" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/clips/stills/clip-01.webp"] },
};

// The homepage: hero 13, then the studio, the work, what we do, who for, how,
// a client's words and the way in.
export default function Home() {
  return (
    <>
      <HomeHero />

      <section id="studio" className={sx.section} aria-label="The studio">
        <p className={sx.eyebrow} style={{ marginBottom: "clamp(36px, 6vh, 64px)" }}>
          <b>(01)</b> The studio · {STUDIO.place}
        </p>
        <LitText text={STUDIO.statement} className={sx.statement} />
        <div className={sx.split}>
          <Reveal>
            <p className={sx.lede}>{STUDIO.intro}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <SiteLink href="/about" className={sx.arrowLink}>
              About the studio <span aria-hidden="true">↗</span>
            </SiteLink>
          </Reveal>
        </div>
      </section>

      <section className={`${sx.section} ${sx.sectionRule}`} aria-labelledby="work-title">
        <SectionHead
          no="02"
          label="Selected work"
          title={<span id="work-title">Work</span>}
          link={{ href: "/work", label: "All work" }}
        />
        <FilmGrid films={FEATURED} layout="featured" />
      </section>

      <section className={`${sx.section} ${sx.sectionRule}`} aria-labelledby="services-title">
        <SectionHead
          no="03"
          label="What we do"
          title={<span id="services-title">Services</span>}
          link={{ href: "/services", label: "All services" }}
        />
        <ServiceList services={SERVICES} />
      </section>

      <Clients no="04" />
      <Process no="05" />
      <Quote />
      <CallToAction />
    </>
  );
}
