"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { posterFor } from "@/app/hero7/wall-playback";
import sx from "./sections.module.css";

// ===========================================================================
// EVERY FRAME — "& Beyond", shown: one film reshaping itself from 16:9 to
// 9:16, 1:1 and 4:5, over faint outlines of every frame it can take.
// Widths are a share of a 16:9 stage at full height.
// ===========================================================================
const RATIOS = [
  { label: "16:9", width: 100 },
  { label: "9:16", width: 31.64 },
  { label: "1:1", width: 56.25 },
  { label: "4:5", width: 45 },
];
const HOLD_MS = 2600;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

export default function FrameMorph({ clip }: { clip: string }) {
  const reduce = !!useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % RATIOS.length), HOLD_MS);
    return () => window.clearInterval(t);
  }, [reduce]);
  const r = RATIOS[i];

  return (
    <div className={sx.frameStage} aria-label="One film in every frame: 16:9, 9:16, 1:1 and 4:5" role="img">
      {RATIOS.map((g) => (
        <span key={g.label} className={sx.frameGuide} style={{ width: `${g.width}%` }} aria-hidden="true" />
      ))}
      <motion.div
        className={sx.frameLive}
        initial={false}
        animate={{ width: `${r.width}%` }}
        transition={{ duration: 1.1, ease: EASE_CINE }}
      >
        <video src={clip} poster={posterFor(clip)} muted loop playsInline autoPlay={!reduce} preload="metadata" aria-hidden="true" />
        <span className={sx.frameRatio}>{r.label}</span>
      </motion.div>
    </div>
  );
}
