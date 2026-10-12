"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { Band, EASE, EASE_CINE, EnterCursor, Info, rootClass, Still, usePlayer } from "./_shared/chrome";
import { CATEGORIES, PROJECTS, posterFor } from "./_shared/data";
import FileView, { type Drawer } from "./file-view";
import Accounts from "./accounts";
import RoomSwitch from "../hero3/room-switch";
import type { FormatKey } from "../hero3/format-hero";
import styles from "./cabinet.module.css";

// ===========================================================================
// WORK 01 — THE CABINET. The burger menu's drawer, in the dark: a folder for
// each category, stacked the way the menu stacks its three. Point at one and
// it's pulled up and comes into colour. Click it and you take it out of the
// drawer: the folder slides up, whole, until its tab meets the band; the
// folders in front of it drop away; its film fades into the dark and the
// films inside rise out of it as posters (file-view.tsx). Close, and they
// sink back in and the folder goes back down into its place.
// Once the cabinet is on screen the page stops scrolling; it's all here.
// ===========================================================================

const ORDER: Drawer[] = CATEGORIES.map((c, i) => ({
  no: String(i + 1).padStart(2, "0"),
  label: c.label,
  short: c.short,
  films: PROJECTS.filter((p) => p.category === c.id),
}));
// Opened from a format's room (/work?format=16x9), the cabinet holds that format's work: each
// category keeps the films made for that frame (and those not marked with one), and empty ones go.
// each format's page leads with its own line, not its name (the switch at the top names it)
const FORMAT_NAMES: Record<string, { name: string; head: [string, string]; line: string }> = {
  "16x9": { name: "16x9", head: ["Made for", "the big screen"], line: "Films for the big screen." },
  "9x16": { name: "9x16", head: ["Made for", "the scroll"], line: "Stories made for the scroll." },
  beyond: { name: "Beyond", head: ["Stories you", "step into"], line: "Stories you step into." },
};
const isFormat = (k: string | null): k is FormatKey => k === "16x9" || k === "9x16" || k === "beyond";

const orderFor = (fmt: string | null): Drawer[] =>
  fmt && FORMAT_NAMES[fmt]
    ? ORDER.map((d) => ({ ...d, films: d.films.filter((p) => !p.format || p.format === fmt) }))
        .filter((d) => d.films.length > 0)
        .map((d, i) => ({ ...d, no: String(i + 1).padStart(2, "0") }))
    : ORDER;
// black files on the paper sheet, as in the menu; each a breath deeper than the
// one behind it (out of the drawer, a folder goes to pure black)
const STOCK = ["#0a0a0a", "#080808", "#060606", "#030303", "#000"];
const INTRO_S = 0.45 + ORDER.length * 0.1 + 1.15;

// how the folders move
const PULL: Transition = { type: "spring", stiffness: 140, damping: 20, mass: 0.9 }; // pointed at
const RISE: Transition = { type: "spring", stiffness: 86, damping: 18, mass: 1 }; // taken out of the drawer
const SINK: Transition = { type: "spring", stiffness: 120, damping: 22, mass: 1 }; // put back
const drop = (k: number): Transition => ({ duration: 0.62, ease: [0.55, 0, 0.75, 0.15], delay: 0.03 * k }); // the ones in front fall away
const lift = (k: number): Transition => ({ type: "spring", stiffness: 110, damping: 20, delay: 0.1 + 0.05 * k }); // ...and come back

const onResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const useViewportHeight = () =>
  useSyncExternalStore(
    onResize,
    () => window.innerHeight,
    () => 0
  );

/** Once `ref` is fully on screen, the page stops scrolling (until it unmounts). */
function useScrollLock(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio < 0.98) return;
        window.scrollTo({ top: el.offsetTop });
        html.style.overflow = "hidden";
        html.style.overscrollBehavior = "none";
        io.disconnect();
      },
      { threshold: [0.98, 1] }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      html.style.overflow = "";
      html.style.overscrollBehavior = "";
    };
  }, [ref]);
}

/** The open folder: which, how far it rises to meet the band, and whether it's going back. */
type Open = { cat: number; rise: number; closing: boolean };

export default function WorkPage() {
  // useSearchParams needs a Suspense boundary on a static page
  return (
    <Suspense fallback={null}>
      <WorkByFormat />
    </Suspense>
  );
}

function WorkByFormat() {
  const q = useSearchParams().get("format");
  const fmt = isFormat(q) ? q : null;
  // 9x16's work is the Instagram accounts the studio runs; a new format remounts the page
  if (fmt === "9x16") return <Accounts key="9x16" />;
  return <WorkCabinet key={fmt ?? "all"} fmt={fmt} />;
}

function WorkCabinet({ fmt }: { fmt: FormatKey | null }) {
  const reduce = !!useReducedMotion();
  const router = useRouter();
  const named = fmt ? FORMAT_NAMES[fmt] : undefined;
  const order = useMemo(() => orderFor(fmt), [fmt]);
  const list = useMemo(() => order.flatMap((d) => d.films), [order]);
  const vh = useViewportHeight();
  const [pull, setPull] = useState<number | null>(null);
  const [settled, setSettled] = useState(false); // the stack has dealt itself in
  const [open, setOpen] = useState<Open | null>(null);
  const [shown, setShown] = useState<number[]>(() => order.map(() => 0)); // the film each folder shows
  const [cursor, setCursor] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const frontRef = useRef<HTMLElement>(null);
  const folderRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { play, player } = usePlayer(open ? order[open.cat].films : list);

  useScrollLock(sectionRef);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), reduce ? 0 : INTRO_S * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  const openFile = (c: number) => {
    const folder = folderRefs.current[c];
    const front = frontRef.current;
    if (open || !settled || !folder || !front) return;
    const band = document.querySelector<HTMLElement>("[data-band]")?.offsetHeight ?? 0;
    // where the folder sits in the stack (without any pull), and how far up the band is
    const top = front.getBoundingClientRect().top + folder.offsetTop;
    setCursor(null);
    setOpen({ cat: c, rise: band - top, closing: false });
  };

  // the posters have sunk back into the folder: it shows the film you left on, and goes down
  const openRef = useRef<number | null>(null);
  useEffect(() => {
    openRef.current = open?.cat ?? null;
  }, [open]);
  const filed = useCallback((index: number) => {
    setCursor(null);
    setOpen((o) => (o ? { ...o, closing: true } : o));
    setShown((s) => s.map((v, i) => (i === openRef.current ? index : v)));
  }, []);

  // ...and it's back in its place
  const putBack = (i: number) => {
    if (!open?.closing || i !== open.cat) return;
    setOpen(null);
    setPull(null);
    folderRefs.current[i]?.focus({ preventScroll: true });
  };

  const yFor = (i: number) => {
    if (open) {
      if (i === open.cat) return open.closing ? 0 : open.rise;
      if (i > open.cat) return open.closing ? 0 : vh;
      return 0;
    }
    if (pull === i) return -0.04 * vh;
    if (pull !== null && i > pull) return 0.016 * vh;
    return 0;
  };
  const moveFor = (i: number): Transition => {
    if (reduce) return { duration: 0 };
    if (!settled) return { delay: 0.45 + i * 0.1, duration: 1.15, ease: EASE_CINE };
    if (open && i === open.cat) return open.closing ? SINK : RISE;
    if (open && i > open.cat) return open.closing ? lift(i - open.cat) : drop(i - open.cat);
    return PULL;
  };
  const lifted = open ? open.cat : pull;

  return (
    <main className={`${rootClass} ${styles.page}`}>
      <Band
        crumb="Index"
        workHref={fmt ? `/work?format=${fmt}` : undefined}
        center={
          fmt ? (
            <RoomSwitch
              room={fmt}
              onSwitch={(k) => router.push(`/work?format=${k}`, { scroll: false })}
              onIndex={() => router.push("/hero3")}
              tone="light"
            />
          ) : undefined
        }
      />

      <section
        ref={sectionRef}
        className={`${styles.sheet} ${open && !open.closing ? styles.sheetOut : ""}`}
        aria-label="Work"
      >
        <Info left={named ? `16X9 — ${named.name} work` : "16X9 — Selected work"} />
        <div className={styles.lockup}>
          <h1 className={styles.headline}>
            {(named ? named.head : ["Selected", "work"]).map((line, i) => (
              <span key={line} className={styles.mask}>
                <motion.span
                  className={styles.line}
                  initial={{ y: "105%" }}
                  animate={{ y: 0, transition: reduce ? { duration: 0 } : { delay: 0.5 + i * 0.12, duration: 1.15, ease: EASE } }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className={styles.lede}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { delay: 1.1, duration: 1.1, ease: EASE } }}
          >
            {named
              ? `${named.line} Brand films, documentaries, music videos and TVCs in this frame.`
              : "Brand films, documentaries, music videos and TVCs for brands that want to be seen."}
          </motion.p>
        </div>

        {/* the cabinet: one folder per category */}
        <nav
          ref={frontRef}
          className={styles.front}
          aria-label="Categories"
          onPointerLeave={() => setPull(null)}
          style={open ? { pointerEvents: "none" } : undefined}
        >
          {order.map((d, i) => {
            const on = lifted === i;
            const out = open !== null && open.cat === i && !open.closing;
            return (
              <motion.button
                key={d.no}
                ref={(el) => {
                  folderRefs.current[i] = el;
                }}
                type="button"
                className={[
                  styles.folder,
                  on ? styles.folderOn : "",
                  lifted !== null && !on ? styles.folderAway : "",
                  out ? styles.folderOut : "",
                ].join(" ")}
                style={{ ["--c" as string]: i, ["--stock-c" as string]: STOCK[i] }}
                onClick={() => openFile(i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && settled && setPull(i)}
                // keyboard focus pulls a folder up like pointing at it; a tap's focus doesn't
                onFocus={(e) => e.currentTarget.matches(":focus-visible") && setPull(i)}
                onBlur={() => !open && setPull(null)}
                // the same first frame on the server and the client (reduced motion
                // only makes the intro instant), so hydration always matches
                initial={{ y: "110%" }}
                animate={{ y: yFor(i), transition: moveFor(i) }}
                onAnimationComplete={() => putBack(i)}
                aria-label={`Open ${d.label}, ${d.films.length} films`}
                aria-expanded={out}
              >
                <span className={styles.stock}>
                  <span className={styles.tab}>
                    <span className={styles.labelNo}>{d.no}</span>
                    <span className={styles.tabName}>
                      <span className={styles.long}>{d.label}</span>
                      <span className={styles.short}>{d.short}</span>
                    </span>
                    <span className={styles.labelNo}>{d.films.length}</span>
                  </span>
                  <span className={styles.window}>
                    <Still src={posterFor(d.films[shown[i]])} on={on} />
                    <span className={styles.shade} aria-hidden="true" />
                    <span className={styles.caption}>
                      <span className={styles.title}>{d.label}</span>
                      <span className={styles.meta}>
                        <span>{d.films.map((f) => f.title).join(" · ")}</span>
                        <span className={styles.enter}>
                          Open <span>→</span>
                        </span>
                      </span>
                    </span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </nav>
      </section>

      {open && !open.closing && (
        <FileView
          key={open.cat}
          drawer={order[open.cat]}
          start={shown[open.cat]}
          reduce={reduce}
          onPlay={play}
          onCursor={setCursor}
          onClosed={filed}
        />
      )}

      <EnterCursor label={open ? cursor : pull !== null ? order[pull].label : null} />
      <span className={styles.grain} aria-hidden="true" />
      {player}
    </main>
  );
}
