"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import { HOME_KEY } from "../work/_shared/chrome";
import { WALL_16X9 } from "../work/_shared/data";
import { type FormatKey } from "../hero13/formats";
import Chooser, { LOGO_T } from "../hero2/chooser";
import styles from "../hero2/hero2.module.css";
import own from "./hero7.module.css";

// ===========================================================================
// HERO 7 — hero 6 in white smoke: pointing at a format brings up its preview with a soft white
// cloud drifting in the middle behind the words (still in ink), at once — no edge anywhere. No
// line at the foot and no prompt under the words: the three words alone.
// (From hero 6: hero 5 with tall 9x16 cards and a refined Beyond board.)
// (From hero 5:) 16x9 & BEYOND: hero 2's white start, and each word leads straight to its work.
//
// 1. The mark enters on the white page; 16x9 / 9x16 / BEYOND rise in one line.
//    Pointing at a word opens it like a window onto a film in its format, and
//    each time it's a different film (drawn from the studio's films).
// 2. Clicking a word opens its film to the edges of the screen and goes
//    straight on to that format's work (/work?format=…), by its categories.
// ===========================================================================

const HEADLINE = "Stories beyond the frame";
// from here the page answers
const SETTLE_S = LOGO_T.names + 0.9;
// touch screens have no hover: on the index the formats take turns
const AUTO_MS = 3400;
const AUTO_SEQ: (FormatKey | null)[] = ["16x9", "9x16", "beyond", null];
// ms from the click to the work page: the film has opened to the edges by then
const GO_MS = 1050;

// The variant depends on the URL and today's date, so it's read on the client only.
const noopSubscribe = () => () => {};
export default function HeroSeven() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const variant = useMemo<HeroVariant | null>(
    () => (isClient ? resolveVariant(new Date(), new URLSearchParams(window.location.search).get("hero")) : null),
    [isClient]
  );
  if (!variant) return <section className={`${styles.page} ${own.brand}`} aria-hidden="true" />;
  return <Home key={variant.id} variant={variant} />;
}

function Home({ variant }: { variant: HeroVariant }) {
  const clips = variant.clips;
  // the films the words draw from as they open
  const pool = useMemo(() => clips.map((c) => c.src), [clips]);
  const reduce = !!useReducedMotion();
  const touch = useSyncExternalStore(noopSubscribe, () => !window.matchMedia("(hover: hover)").matches, () => false);

  // nothing answers until the words have risen in
  const [ready, setReady] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setReady(true), SETTLE_S * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // the word pointed at (or taking its turn on a touch screen), and the room that's open
  const [fmtHover, setFmtHover] = useState<FormatKey | null>(null);
  const [fmtAuto, setFmtAuto] = useState<FormatKey | null>(null);
  const [room, setRoom] = useState<FormatKey | null>(null);
  const [launch, setLaunch] = useState<FormatKey | null>(null);
  const indexFmt = room ? null : (fmtHover ?? fmtAuto);

  // touch screens: the formats take turns on the index
  useEffect(() => {
    if (!touch || !ready || reduce || room) return;
    let i = AUTO_SEQ.indexOf(null);
    const id = window.setInterval(() => {
      i = (i + 1) % AUTO_SEQ.length;
      setFmtAuto(AUTO_SEQ[i]);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [touch, ready, reduce, room]);

  const hover = useCallback((k: FormatKey | null) => setFmtHover(k), []);
  const router = useRouter();
  // the film opens to the edges, then the page goes on to that format's work
  const openRoom = useCallback(
    (k: FormatKey) => {
      if (!ready || room) return;
      setLaunch(k);
      setRoom(k);
      setFmtHover(null);
      setFmtAuto(null);
      router.prefetch(`/work?format=${k}`);
      try {
        sessionStorage.setItem(HOME_KEY, "/hero7");
      } catch {}
      window.setTimeout(() => router.push(`/work?format=${k}`), reduce ? 0 : GO_MS);
    },
    [ready, reduce, room, router]
  );

  return (
    <section
      className={`${styles.page} ${own.brand}`}
      aria-label="16x9 & Beyond"
      data-room={room ? "" : undefined}
      data-dark={room || indexFmt ? "" : undefined}
    >
      <h1 className={styles.sr}>16x9 &amp; Beyond. {HEADLINE}.</h1>

      {/* ================= the index ================= */}
      <Chooser
        open={room !== null}
        launch={launch}
        show={room === null}
        first
        reduce={reduce}
        ready={ready}
        active={indexFmt}
        onHover={hover}
        onOpen={openRoom}
        pool={pool}
        logo
        grid
        refined
        wall={WALL_16X9}
        band
      />

    </section>
  );
}
