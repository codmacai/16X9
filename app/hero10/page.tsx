"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { resolveVariant, type HeroVariant } from "@/components/Hero-config";
import { HOME_KEY } from "../work/_shared/chrome";
import { WALL_16X9 } from "../work/_shared/data";
import { leaveDoor } from "../work/_shared/door";
import { type FormatKey } from "../hero13/formats";
import Chooser, { LOGO_T } from "../hero2/chooser";
import styles from "../hero2/hero2.module.css";
import own from "../hero7/hero7.module.css";

// ===========================================================================
// HERO 10 — hero 9 on a white wall. Everything as hero 9 — 16x9's wide screen
// in the wall, 9x16's three displays mounted on it, Beyond's lit tile — but
// the wall is white: the same matte tiles and fine seams, their grain
// stronger, their seams grey, the light pooling soft from above
// (WallSurface, light). The line of words and the logo are drawn in paper,
// differenced against what's behind them, so they read as ink on the wall
// and as paper on the screens (CSS, .stageLight).
//
// Only Beyond goes on to a page of its own (its tile grows to the whole
// screen, /work?format=beyond); 16x9 and 9x16 are seen on their screens
// here, and clicking them does nothing.
// ===========================================================================

const HEADLINE = "Stories beyond the frame";
// from here the page answers
const SETTLE_S = LOGO_T.names + 0.9;
// touch screens have no hover: on the index the formats take turns
const AUTO_MS = 3400;
const AUTO_SEQ: (FormatKey | null)[] = ["16x9", "9x16", "beyond", null];
// ms from the click to Beyond's page, once its panel has grown to the whole screen (its page comes
// out from under it)
const GO_BEYOND_MS = 1000;

// The variant depends on the URL and today's date, so it's read on the client only.
const noopSubscribe = () => () => {};
export default function HeroTen() {
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
  // only Beyond has a page of its own here: its tile grows to the whole screen and its page comes
  // out from under it; 16x9 and 9x16 are seen on their screens and stay where they are
  const openRoom = useCallback(
    (k: FormatKey) => {
      if (!ready || room || k !== "beyond") return;
      setLaunch(k);
      setRoom(k);
      setFmtHover(null);
      setFmtAuto(null);
      router.prefetch(`/work?format=${k}`);
      try {
        sessionStorage.setItem(HOME_KEY, "/hero10");
      } catch {}
      leaveDoor("panel");
      window.setTimeout(() => router.push(`/work?format=${k}`), reduce ? 0 : GO_BEYOND_MS);
    },
    [ready, reduce, room, router]
  );

  return (
    <section
      className={`${styles.page} ${own.brand}`}
      aria-label="16x9 & Beyond"
      data-room={room ? "" : undefined}
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
        panelBeyond
        curved
        poster
        luxe
        light
      />
    </section>
  );
}
