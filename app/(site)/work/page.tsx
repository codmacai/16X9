import type { Metadata } from "next";
import { CallToAction } from "@/components/site/blocks";
import { WORK } from "@/components/site/content";
import WorkIndex from "@/components/site/work-index";
import sx from "@/components/site/sections.module.css";

export const metadata: Metadata = {
  title: "Work — 16x9 & Beyond",
  description: "Brand films, campaigns, commercials, social content and documentaries made by 16x9 & Beyond in Dubai.",
};

export default function WorkPage() {
  return (
    <>
      <header className={sx.intro}>
        <p className={sx.eyebrow}>
          <b>({String(WORK.length).padStart(2, "0")})</b> Films · Campaigns · Content
        </p>
        <h1 className={sx.display}>Work</h1>
      </header>
      <section className={sx.section} style={{ paddingTop: 0 }} aria-label="All work">
        <WorkIndex work={WORK} />
      </section>
      <CallToAction />
    </>
  );
}
