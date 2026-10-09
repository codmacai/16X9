"use client";

import { useReducedMotion } from "framer-motion";
import { Band, rootClass } from "../work/_shared/chrome";
import { useHeavyWindowScroll } from "../work/heavy";
import Opening from "./opening";
import Manifesto from "./manifesto";
import Practice from "./practice";
import Frames from "./frames";
import Closing from "./closing";
import s from "./page.module.css";

// ===========================================================================
// WHO WE ARE — the studio, told as one long scroll in five movements:
//   1. Opening    — who we are: the line, with films set into it (paper)
//   2. Manifesto  — "Story always comes first": the films gather round it (black)
//   3. Practice   — the promise, then how we work: Making, Partnership (paper)
//   4. Frames     — our three frames, one picture turning 16x9 → 9x16 → Beyond (black)
//   5. Closing    — stories beyond the frame, and the way to reach us
// The page has weight: the wheel sets where it's going and it glides there.
// ===========================================================================

export default function About() {
  const reduce = !!useReducedMotion();
  useHeavyWindowScroll(reduce);
  return (
    <main className={`${rootClass} ${s.page}`}>
      <Band section="About" crumb="Who we are" />
      <Opening />
      <Manifesto />
      <Practice />
      <Frames />
      <Closing />
    </main>
  );
}
