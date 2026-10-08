"use client";

import { useCallback, useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import DepthHero from "@/app/hero13/page";
import sx from "./sections.module.css";

// ===========================================================================
// HOME HERO — hero 13, held in place while you scroll the first stretch of the
// page. As you scroll, the letterbox it opened with closes back over it, a
// hairline is drawn where the bars meet, and the page cuts to the studio.
// ===========================================================================
export default function HomeHero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = !!useReducedMotion();
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ["start start", "end end"] });
  const bars = useTransform(scrollYProgress, [0.08, 0.86], [0, 1]);
  const line = useTransform(scrollYProgress, [0.74, 0.96], [0, 1]);
  const shade = useTransform(scrollYProgress, [0, 0.86], [0, 0.55]);

  const toStudio = useCallback(() => {
    document.getElementById("studio")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }, [reduce]);

  return (
    <div id="home-hero" ref={wrapRef} className={sx.heroWrap}>
      <div className={sx.heroPin}>
        <DepthHero inPage onCue={toStudio} />
        <motion.div className={sx.heroShade} style={{ opacity: shade }} aria-hidden="true" />
        <motion.div className={sx.heroBarTop} style={{ scaleY: bars }} aria-hidden="true" />
        <motion.div className={sx.heroBarBottom} style={{ scaleY: bars }} aria-hidden="true" />
        <motion.div className={sx.heroLine} style={{ scaleX: line, opacity: line }} aria-hidden="true" />
      </div>
    </div>
  );
}
