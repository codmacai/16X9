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
import own from "../hero7/hero7.module.css";

// ===========================================================================
// HERO 8 — hero 7, in Beyond's dark. 16x9 and 9x16 open on their walls of
// films in a black room: each tile (or column of reels) opens from a hairline
// across its middle, out from the centre, as the wall settles in, and every
// film rests low while one at a time takes the light. Through the middle, under
// the words, a still ribbon of smoke (smoke-ribbon.tsx) fades in with them.
// Every preview, Beyond's door too, comes in the same way — the room fades to
// black over the one before, then it opens — so moving between them is never a cut.
// Beyond, the studio's top service, is an entrance: the screen goes black,
// the other words fall away and BEYOND turns to paper, and a single hairline
// of light — its film, seen through the gap — draws down the middle of the
// dark like a door left ajar onto a lit room. Click BEYOND and the door
// opens: the line reaches the full height, light pours through the widening
// gap and settles into the film, and on into Beyond's work.
//
// Clicking a word goes on to that format's work (/work?format=…), as in hero 7.
// ===========================================================================

const HEADLINE = "Stories beyond the frame";
// from here the page answers
const SETTLE_S = LOGO_T.names + 0.9;
// touch screens have no hover: on the index the formats take turns
const AUTO_MS = 3400;
const AUTO_SEQ: (FormatKey | null)[] = ["16x9", "9x16", "beyond", null];
// ms from the click to the work page: the preview has filled the screen by then
const GO_MS = 1050;
// ...and for Beyond, once its door has opened onto the film and it has held a moment
const GO_BEYOND_MS = 1650;

// The variant depends on the URL and today's date, so it's read on the client only.
const noopSubscribe = () => () => {};
export default function HeroEight() {
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
  // the page goes dark under every format's films
  const dark = (room ?? indexFmt) !== null;

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
  // the preview fills the screen, then the page goes on to that format's work
  const openRoom = useCallback(
    (k: FormatKey) => {
      if (!ready || room) return;
      setLaunch(k);
      setRoom(k);
      setFmtHover(null);
      setFmtAuto(null);
      router.prefetch(`/work?format=${k}`);
      try {
        sessionStorage.setItem(HOME_KEY, "/hero8");
      } catch {}
      window.setTimeout(() => router.push(`/work?format=${k}`), reduce ? 0 : k === "beyond" ? GO_BEYOND_MS : GO_MS);
    },
    [ready, reduce, room, router]
  );

  return (
    <section
      className={`${styles.page} ${own.brand}`}
      aria-label="16x9 & Beyond"
      data-room={room ? "" : undefined}
      data-dark={dark ? "" : undefined}
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
        plainBeyond
        doorBeyond
        luxe
      />
    </section>
  );
}
