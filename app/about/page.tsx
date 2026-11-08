"use client";

import { useReducedMotion } from "framer-motion";
import { Band, rootClass } from "../work/_shared/chrome";
import { useHeavyWindowScroll } from "../work/heavy";
import Opening from "./opening";
import Team from "./team";
import Practice from "./practice";
import Clients from "./clients";
import Footer from "../work/_shared/footer";
import s from "./page.module.css";

// ===========================================================================
// WHO WE ARE — the studio, told as one long scroll in four movements:
//   1. Opening    — who we are: the line, with films set into it (paper)
//   2. Team       — the people: their portraits round a turning globe (black)
//   3. Practice   — how we work: Making, Partnership (paper)
//   4. Clients    — who trusted us: a dark room, one light over the names
//   then the footer, as on every page that scrolls (work/_shared/footer.tsx):
//   the selling line, Let's talk and how to reach us (#contact)
// The page has weight: the wheel sets where it's going and it glides there.
// ===========================================================================

export default function About() {
  const reduce = !!useReducedMotion();
  useHeavyWindowScroll(reduce);
  return (
    <main className={`${rootClass} ${s.page}`}>
      <Band section="About" crumb="Who we are" />
      <Opening />
      <Team />
      <Practice />
      <Clients />
      <Footer />
    </main>
  );
}
