"use client";

import { useReducedMotion } from "framer-motion";
import { Band, rootClass } from "../work/_shared/chrome";
import { useHeavyWindowScroll } from "../work/heavy";
import Opening from "./opening";
import Manifesto from "./manifesto";
import Practice from "./practice";
import Clients from "./clients";
import Contact from "./contact";
import s from "./page.module.css";

// ===========================================================================
// WHO WE ARE — the studio, told as one long scroll in four movements:
//   1. Opening    — who we are: the line, with films set into it (paper)
//   2. Manifesto  — "Story always comes first": the films gather round it (black)
//   3. Practice   — the promise, then how we work: Making, Partnership (paper)
//   4. Clients    — who trusted us: a dark room, one light over the names
//   5. Contact    — the selling line, how to reach us, the three formats (#contact)
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
      <Clients />
      <Contact />
    </main>
  );
}
