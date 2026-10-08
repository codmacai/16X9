import type { Metadata } from "next";
import { CallToAction, Clients, SectionHead } from "@/components/site/blocks";
import { BELIEFS, STUDIO } from "@/components/site/content";
import FrameMorph from "@/components/site/frame-morph";
import { LitText, Reveal } from "@/components/site/motion";
import sx from "@/components/site/sections.module.css";

export const metadata: Metadata = {
  title: "About — 16x9 & Beyond",
  description: "16x9 & Beyond is a film studio in Dubai: a small senior team making films for brands, in every frame they live in.",
};

export default function AboutPage() {
  return (
    <>
      <header className={sx.intro}>
        <p className={sx.eyebrow}>
          <b>(01)</b> The studio · The people
        </p>
        <h1 className={sx.display}>About</h1>
      </header>

      <section className={sx.section} style={{ paddingTop: 0 }} aria-label="Who we are">
        <LitText text={STUDIO.statement} className={sx.statement} />
        <div className={sx.split}>
          <Reveal>
            <p className={sx.lede}>{STUDIO.intro}</p>
          </Reveal>
        </div>
      </section>

      <section className={`${sx.section} ${sx.sectionRule}`} aria-labelledby="beyond-title">
        <div className={sx.frames}>
          <Reveal>
            <p className={sx.eyebrow}>
              <b>(02)</b> Why “& Beyond”
            </p>
            <h2 className={sx.display} id="beyond-title" style={{ margin: "22px 0 28px", fontSize: "clamp(40px, 5.6vw, 96px)" }}>
              Every <em>frame</em>
            </h2>
            <p className={sx.lede}>
              16:9 is the frame we grew up in: cinema, TV, the big screen. But brands now live everywhere, 9:16 on the phone, 1:1 and 4:5
              in the feed, screens in malls and stadiums. “& Beyond” is our promise that the idea holds in every one of them.
            </p>
          </Reveal>
          <FrameMorph clip="/clips/clip-06.mp4" />
        </div>
      </section>

      <section className={`${sx.section} ${sx.sectionRule}`} aria-labelledby="beliefs-title">
        <SectionHead no="03" label="What we believe" title={<span id="beliefs-title">How we <em>think</em></span>} />
        <ul className={sx.beliefs}>
          {BELIEFS.map((b, i) => (
            <li key={b.title}>
              <Reveal delay={(i % 2) * 0.1}>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${sx.section} ${sx.sectionRule}`} aria-labelledby="people-title">
        <SectionHead no="04" label="The people" title={<span id="people-title">Who makes <em>it</em></span>} />
        <div className={sx.split} style={{ marginTop: 0 }}>
          <Reveal>
            <p className={sx.lede}>
              Directors, producers, cinematographers, editors, colourists and motion designers: a core team in Dubai and a trusted crew across
              the region. The people you meet in the first call are the people on set and in the edit.
            </p>
          </Reveal>
        </div>
      </section>

      <Clients no="05" />
      <CallToAction />
    </>
  );
}
