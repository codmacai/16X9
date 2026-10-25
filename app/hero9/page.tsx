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
// HERO 9 — hero 8, with Beyond as a lit panel in a wall instead of a door. 16x9
// and 9x16 as in hero 8: their walls of films in a black room, the still
// ribbon of smoke under the words. Beyond, the studio's top service, shows no
// film: the screen becomes a wall of dark matte panels, drawn as a real lit
// surface, and the one in the middle — 16:9, our frame — comes on from a line
// across it: a white light panel. On it, Beyond's categories in heavy black
// type, one after another, each arriving close and huge, cropped by the
// panel's edges, and drawing back until it sits whole; the line of words sits
// on it in ink (hero2/beyond-panel.tsx). Click BEYOND and the panel grows to
// the whole screen, and Beyond's page comes out from under it
// (work/beyond.tsx).
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
// ...and for Beyond, once its panel has grown to the whole screen (its page comes out from under it)
const GO_BEYOND_MS = 1000;

// The variant depends on the URL and today's date, so it's read on the client only.
const noopSubscribe = () => () => {};
export default function HeroNine() {
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
        sessionStorage.setItem(HOME_KEY, "/hero9");
      } catch {}
      if (k === "beyond") leaveDoor("panel");
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
        panelBeyond
        luxe
      />
    </section>
  );
}
