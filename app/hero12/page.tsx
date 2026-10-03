"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type TargetAndTransition,
} from "framer-motion";
import { Archivo, Inter_Tight } from "next/font/google";
import Link from "next/link";
import { resolveVariant, type Clip, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "../hero7/project-view";
import { liveBudget, posterFor, WallPlayback } from "../hero7/wall-playback";
import Drawer from "../hero11/drawer";
import styles from "./depthhero.module.css";


// ===========================================================================
// COPY
// ===========================================================================
const MARK_SUB = "& BEYOND"; // tiny tag on the same line as the mark, cut into the card
const HEADLINE = ["Bringing brands", "to life"];
const SUBHEAD = ["Turn target audience into", "visitors"]; // two lines, as set

// Inter Tight: a Swiss, International-Style grotesk. Loaded for hero 7 only (it
// overrides --font-sans inside this section), so the other heroes keep Archivo.
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// The heading and menu: Archivo at its widest and light, an extended grotesk.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });
const LOGO_SRC = "/logo.png"; // put your logo in /public and change this path

// ===========================================================================
// SEQUENCE, in seconds
// 1. OPENING: on black, the letterbox parts top and bottom. Behind it the
//    depth gallery is already rushing forward, and it brakes as the frame opens.
// 2. The 16X9 card opens out of a slit and its letters rise into it.
// 3. It holds, then the letters lift out and the card folds down to a white
//    line, and the heading and tagline rise out of that line.
// 4. The client strip fades in.
// After that the wall surges forward every few seconds like a dolly push.
// Scrolling (or dragging on a phone) pushes it faster, forwards or back, and
// it coasts back to its own pace. Hovering a tile holds the wall, tilts the
// tile toward the pointer and dims the rest; clicking it opens the film full
// screen (see project-view.tsx).
// ===========================================================================
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const T = {
  open: 0.3, // letterbox starts to part
  wall: 0.3, // depth gallery is rushing behind the letterbox
  card: 1.55, // the card opens out of a slit
  letters: 2.05, // its letters rise into it
  lines: 2.05, // top bar
  leave: 4.4, // the card leaves: letters lift out, it folds to a line
  clients: 2.8, // logo strip
};
// The card's exit, relative to T.leave
// The card's exit: it eases back and fades out; the heading fades in over it.
const LEAVE = { fade: 1.1, headAt: 0.35 };

// Speeds are in screen-heights per second.
const CRAWL = 0.3;
const SURGE = { first: T.leave + 1.6, every: 4.6, length: 1.8, peak: 1.8 };
// Drag to slide: how far the wall moves per pixel dragged, the cap on the glide
// it's thrown with (screen-heights per second), and how fast that glide settles.
const PUSH = { drag: 1.7, max: 9, decay: 2.4, threshold: 6 };
// How fast the wall runs while a tile is hovered (0 = stopped, 1 = full speed),
// and how quickly it eases between speeds.
const HOVER_SPEED = 0; // the wall stops under a film you're pointing at, so it never slides away
const SPEED_EASE = 3.2; // gentle: the wall brakes and pulls away, never snaps
// The wall only holds while the visitor is actively pointing. A resting mouse
// lets it run again, otherwise it would stall whenever the cursor sits on the page.
const HOLD_MS = 1800;
const ARRIVAL = { length: 2.6, peak: 2.4 };

const LANES_DESKTOP = 8;
const LANES_MOBILE = 4;
const PLANE = { width: 2.4, height: 2.5 }; // the tilted plane, in viewport widths / heights (see .plane)
const GAP = { desktop: 14, mobile: 9 }; // must match --gap

/** Just enough tiles per lane for one copy to cover the plane's height (the loop needs that). */
const tilesPerLane = (vw: number, vh: number, lanes: number, gap: number) =>
  Math.min(10, Math.max(5, Math.ceil((vh * PLANE.height) / ((vw * PLANE.width) / lanes + gap)) + 1));
// Hover feel: how far the film turns toward the pointer (deg), how far it comes
// forward, and how quickly it eases there (per second). Only a film you wait on
// for INTENT_MS starts loading its video.
const TILT = { x: 9, y: 11, scale: 1.06, ease: 9 };
const INTENT_MS = 160;
const pad2 = (n: number) => String(n).padStart(2, "0");

const RATIOS = ["3 / 4", "16 / 10", "4 / 5", "1 / 1", "2 / 3", "16 / 9", "5 / 6"];

// The mark
const COBALT = "#FFFFFF";
// The card (and the menu bars cut from it) keep the original face, Archivo at its
// normal width, so the card keeps its original proportions: its size is measured
// from this lettering. (--font-wide is the same Archivo, loaded in this file.)
const FONT = "var(--font-wide, 'Archivo'), 'Helvetica Neue', Arial, sans-serif";
const WIDE = { fontFamily: FONT } as const; // no width axis any more
const PAD_X = 4.5; // block geometry, in % of the block's width (cqw)
const PAD_TOP = 3.4;
const PAD_BOTTOM = 3.8;
const CAP = 0.727; // Inter Tight cap height, as a fraction of the font size
const TRACK = -0.03; // letter spacing, in em
const MARK_WEIGHT = 700;
// "& BEYOND" on the mark's line: its size and the space before it, as fractions of
// the 16X9 font size. The card keeps its original size; 16X9 shrinks to make room.
const SUB_SCALE = 0.17;
const SUB_GAP = 0.07;

// ===========================================================================
// MENU_T — the card's letters lift out when the menu opens, and settle back
// (at JOIN) after it closes. The menu itself is the hero 11 drawer.
// ===========================================================================
const MENU_T = { letters: 0.5, split: 0.46, spread: 0.85, words: 1.0, collapse: 0.6, collapseAt: 0.18, join: 0.8 };
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const surgeAt = (t: number) => {
  if (t < SURGE.first) return 0;
  const c = (t - SURGE.first) % SURGE.every;
  if (c > SURGE.length) return 0;
  const s = Math.sin((Math.PI * c) / SURGE.length);
  return s * s;
};

/** Full speed behind the letterbox, then brakes to a creep as the frame opens. */
const arrivalAt = (t: number) => {
  const r = t - T.wall;
  if (r < 0) return 1;
  if (r > ARRIVAL.length) return 0;
  const k = 1 - r / ARRIVAL.length;
  return k * k * k;
};

// ===========================================================================
// TILE — one film on the wall, printed like a frame on a contact sheet: a white
// hairline edge, its number and runtime in the corners, and its title, which
// rises in when you point at it. It always shows a still poster; WallPlayback
// lets only a few tiles at a time mount a live <video>, which fades in over the
// poster once it's playing. Hover is driven from DepthInner (one listener, one
// animation loop), so a tile has no hover handlers of its own.
// ===========================================================================
type TileProps = {
  id: string;
  clip: Clip;
  index: number;
  ratio: string;
  playback: WallPlayback;
  onOpen: (index: number, el: HTMLElement, time: number) => void;
};

const Tile = memo(function Tile({ id, clip, index, ratio, playback, onOpen }: TileProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [poster, setPoster] = useState(true);

  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;
    return playback.register(id, el, (on) => {
      setLive(on);
      if (!on) setPlaying(false);
    });
  }, [id, playback]);

  // iOS needs the muted attribute (not just the property) before it will autoplay.
  useEffect(() => {
    const v = videoRef.current;
    if (!live || !v) return;
    v.muted = true;
    v.setAttribute("muted", "");
    v.play().catch(() => {});
  }, [live]);

  return (
    <div
      ref={tileRef}
      className={styles.tile}
      style={{ aspectRatio: ratio }}
      data-index={index}
      onClick={(e) => onOpen(index, e.currentTarget, videoRef.current?.currentTime ?? 0)}
    >
      {poster && (
        // A tiny static still (~5 KB); next/image would add a request per tile size for no gain here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.tilePoster}
          src={posterFor(clip.src)}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setPoster(false)}
        />
      )}
      {live && (
        <video
          ref={videoRef}
          className={`${styles.tileVideo} ${playing ? styles.tileVideoOn : ""}`}
          src={clip.src}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          onPlaying={() => setPlaying(true)}
        />
      )}
      <span className={styles.tileGlare} aria-hidden="true" />
      <span className={styles.tileScrim} aria-hidden="true" />
      <span className={styles.tileMeta} aria-hidden="true">
        <span className={styles.tileTop}>
          <span>{pad2(index + 1)}</span>
          <span>{clip.duration}</span>
        </span>
        <span className={styles.tileTitleMask}>
          <span className={styles.tileTitle}>{clip.title}</span>
        </span>
      </span>
    </div>
  );
});

// ===========================================================================
// CURSOR — over a film the arrow becomes a thin paper ring with a small play
// mark. It eases in once and stays while you glide from film to film. State is
// set through a ref, so hovering never re-renders the wall, and the position
// lives in motion values, so following the pointer never re-renders anything.
// ===========================================================================
type CursorLabelHandle = { show: (clip: Clip | null) => void };

function CursorLabel({ ref }: { ref: Ref<CursorLabelHandle> }) {
  const [on, setOn] = useState(false);
  useImperativeHandle(ref, () => ({ show: (clip) => setOn(clip !== null) }), []);

  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 520, damping: 42, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 520, damping: 42, mass: 0.5 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);

  return (
    <motion.div className={styles.cursor} style={{ x: sx, y: sy }} aria-hidden="true">
      <AnimatePresence>
        {on && (
          <motion.div
            key="disc"
            className={styles.cursorDisc}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.45, ease: EASE } }}
            exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.25, ease: EASE } }}
          >
            <svg className={styles.cursorPlay} viewBox="0 0 12 14">
              <path d="M0 0L12 7L0 14Z" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ===========================================================================
// OPENING — black bars part top and bottom like a letterbox opening
// ===========================================================================
function Letterbox({ onDone }: { onDone: () => void }) {
  return (
    <div className={styles.bars} aria-hidden="true">
      <motion.div
        className={styles.barTop}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ delay: T.open, duration: 1.4, ease: EASE_CINE }}
      />
      <motion.div
        className={styles.barBottom}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ delay: T.open, duration: 1.4, ease: EASE_CINE }}
        onAnimationComplete={onDone}
      />
    </div>
  );
}

// ===========================================================================
// THE MARK — a block with 16X9 and © cut clean through it; the wall behind
// shows through the letters. It opens out of a slit at T.card and its letters
// rise in; once `gone`, the letters lift out and the block folds down to a
// line. The block stays in the layout either way: the menu grows out of it.
// ===========================================================================
type Box = {
  w: number;
  h: number;
  pl: number;
  pr: number;
  pt: number;
  pb: number;
  /** height of the lettering area: what 16X9 alone would fill, so the card never changes size */
  area: number;
  /** shared baseline for 16X9 and the tag, centred in that area */
  base: number;
  /** where the tag starts */
  subX: number;
};

function Mark({
  mark,
  reduce,
  gone,
  menuOpen,
  menuKey,
}: {
  mark: string;
  reduce: boolean;
  /** the card has made way for the heading */
  gone: boolean;
  menuOpen: boolean;
  /** changes every time the menu opens, so the wheel starts fresh on WORK */
  menuKey: number;
}) {
  const maskId = `dh-cut-${useId().replace(/:/g, "")}`;
  const blockRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const subProbeRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  // The card is sized as if 16X9 alone filled 90% of its inner width (its original
  // size). 16X9 + the tag then share that same 90%, sitting on one baseline,
  // centred in the card. Re-fit on resize and font load.
  useIsoLayoutEffect(() => {
    const block = blockRef.current;
    const probe = probeRef.current;
    const subProbe = subProbeRef.current;
    if (!block || !probe || !subProbe) return;
    const fit = () => {
      const cs = getComputedStyle(block);
      const pl = parseFloat(cs.paddingLeft);
      const pr = parseFloat(cs.paddingRight);
      const pt = parseFloat(cs.paddingTop);
      const pb = parseFloat(cs.paddingBottom);
      const w = block.clientWidth;
      const inner = w - pl - pr;
      const tw = probe.getBoundingClientRect().width; // 16X9 measured at 100px
      const ts = subProbe.getBoundingClientRect().width; // the tag measured at 100px
      if (tw > 0 && ts > 0 && inner > 0) {
        const original = (100 * inner * 0.9) / tw; // the font size 16X9 had on its own
        const area = original * CAP;
        const fs = (100 * inner * 0.9) / (tw + 100 * SUB_GAP + ts * SUB_SCALE);
        setFontSize(fs);
        setBox({
          w,
          h: pt + pb + area,
          pl,
          pr,
          pt,
          pb,
          area,
          base: pt + (area + fs * CAP) / 2,
          subX: pl + (fs * tw) / 100 + fs * SUB_GAP,
        });
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(block);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [mark]);

  return (
    <div className={styles.wm}>
      <div ref={blockRef} className={styles.wmBlock} style={{ padding: `${PAD_TOP}cqw ${PAD_X}cqw ${PAD_BOTTOM}cqw` }}>
        <span
          ref={probeRef}
          aria-hidden
          className={styles.wmProbe}
          style={{ ...WIDE, fontWeight: MARK_WEIGHT, fontSize: 100, letterSpacing: `${TRACK}em` }}
        >
          {mark}
        </span>
        <span
          ref={subProbeRef}
          aria-hidden
          className={styles.wmProbe}
          style={{ ...WIDE, fontWeight: MARK_WEIGHT, fontSize: 100, letterSpacing: `${TRACK}em` }}
        >
          {MARK_SUB}
        </span>

        <span aria-hidden className={styles.wmSpacer} style={{ height: box ? box.area : "12cqw" }} />

        {box && fontSize ? (
          // the card's face: opens out of a slit, and later eases back and fades away
          <motion.div
            className={styles.wmFace}
            initial={reduce ? { opacity: gone ? 0 : 1 } : { clipPath: "inset(50% 0% 50% 0%)", scale: 1, opacity: 1 }}
            animate={
              gone
                ? { scale: 0.96, opacity: 0, transition: { duration: reduce ? 0 : LEAVE.fade, ease: "easeInOut" } }
                : { clipPath: "inset(0% 0% 0% 0%)", scale: 1, opacity: 1, transition: { delay: T.card, duration: 0.95, ease: EASE_CINE } }
            }
          >
          <motion.svg
            aria-hidden
            className={styles.wmCut}
            viewBox={`0 0 ${box.w} ${box.h}`}
            preserveAspectRatio="none"
            initial={false}
            animate={{ opacity: menuOpen ? 0 : 1 }}
            transition={{ duration: 0, delay: reduce ? 0 : menuOpen ? MENU_T.split : MENU_T.join }}
          >
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={box.w} height={box.h}>
                <rect width={box.w} height={box.h} fill="#fff" />
                {/* the letters rise into the card, lift out when the menu opens, and
                    settle back when it closes (they stay put while the card fades) */}
                <motion.g
                  initial={reduce ? false : { y: box.h }}
                  animate={{ y: menuOpen ? -box.h : 0 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : menuOpen
                        ? { duration: MENU_T.letters, ease: EASE_CINE }
                        : { duration: 0.9, ease: EASE, delay: menuKey > 0 ? MENU_T.join : T.letters }
                  }
                >
                <text
                  x={box.pl}
                  y={box.base}
                  fill="#000"
                  style={{ ...WIDE, fontWeight: MARK_WEIGHT, fontSize, letterSpacing: `${TRACK}em` }}
                >
                  {mark}
                </text>
                {/* & BEYOND: tiny, on the same baseline, right after the mark */}
                <text
                  x={box.subX}
                  y={box.base}
                  fill="#000"
                  style={{ ...WIDE, fontWeight: MARK_WEIGHT, fontSize: fontSize * SUB_SCALE, letterSpacing: `${TRACK}em` }}
                >
                  {MARK_SUB}
                </text>
                <text
                  x={box.w - box.pr * 0.45}
                  y={box.h - box.pb}
                  textAnchor="end"
                  fill="#000"
                  style={{ fontFamily: FONT, fontWeight: 600, fontSize: Math.max(10, box.w * 0.022) }}
                >
                  ©
                </text>
                </motion.g>
              </mask>
            </defs>
            <rect width={box.w} height={box.h} fill={COBALT} mask={`url(#${maskId})`} />
          </motion.svg>
          </motion.div>
        ) : null}

      </div>
    </div>
  );
}

// ===========================================================================
// MENU — the hero 11 drawer, opened over the wall. It is wiped down from the
// top like a sheet being pulled over the screen, then plays its own entrance
// (band, paper, headline, folders). Closing lifts it back up.
// ===========================================================================
function Menu({ open, reduce, onClose }: { open: boolean; reduce: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="menu"
          className={styles.menuSheet}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={reduce ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)" }}
          animate={
            reduce
              ? { opacity: 1, transition: { duration: 0 } }
              : { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.9, ease: EASE_CINE } }
          }
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0 } }
              : { clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.75, ease: EASE_CINE } }
          }
        >
          <Drawer onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ===========================================================================
// HEADING — takes the card's place, centred on the screen. As the card eases
// back and fades, the heading fades in over it, and the line under it follows.
// ===========================================================================
function Heading({
  lines,
  tagline,
  show,
  first,
  reduce,
}: {
  lines: string[];
  tagline: string[];
  show: boolean;
  /** the first reveal crossfades with the card; later ones (after the menu) are quick */
  first: boolean;
  reduce: boolean;
}) {
  const base = reduce ? 0 : first ? LEAVE.headAt : 0;
  const out = { opacity: 0, transition: { duration: reduce ? 0 : 0.35, ease: EASE_CINE } };
  return (
    <div className={styles.head} aria-hidden="true">
      <motion.span
        className={styles.headShade}
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1, transition: { duration: 1.6, ease: EASE } } : out}
      />
      <motion.p
        className={styles.headTitle}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={show ? { opacity: 1, y: 0, transition: { delay: base, duration: 1.3, ease: EASE } } : out}
      >
        {lines.map((l) => (
          <span key={l} className={styles.headLine}>
            {l}
          </span>
        ))}
      </motion.p>
      <motion.p
        className={styles.headTag}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={show ? { opacity: 1, y: 0, transition: { delay: base + (reduce ? 0 : 0.3), duration: 1.2, ease: EASE } } : out}
      >
        {tagline.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </motion.p>
    </div>
  );
}

// ===========================================================================
// HERO — films and clients come from Hero-config (URL ?hero=, dates, default)
// ===========================================================================
// The variant depends on the URL and today's date, so it's read on the client only
// (the server renders an empty section), without a setState-in-effect round trip.
const noopSubscribe = () => () => {};
export default function DepthHero({ variantId }: { variantId?: string }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const variant = useMemo<HeroVariant | null>(
    () =>
      isClient
        ? resolveVariant(new Date(), variantId ?? new URLSearchParams(window.location.search).get("hero"))
        : null,
    [isClient, variantId]
  );

  if (!variant) return <section className={`${styles.page} ${interTight.variable} ${archivo.variable}`} aria-hidden="true" />;
  return <DepthInner key={variant.id} variant={variant} />;
}

function DepthInner({ variant }: { variant: HeroVariant }) {
  const clips = variant.clips;
  const mark = variant.wordmark ?? "16X9";
  const reduce = !!useReducedMotion();

  const [grid, setGrid] = useState({ lanes: LANES_DESKTOP, perLane: 7 });
  const laneCount = grid.lanes;
  const playback = useMemo(() => new WallPlayback(), []);
  const [opened, setOpened] = useState(false);
  const [project, setProject] = useState<OpenProject | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuKey, setMenuKey] = useState(0);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // the card holds, then makes way for the heading
  const [gone, setGone] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setGone(true), T.leave * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // Esc closes the menu
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  const labelRef = useRef<CursorLabelHandle>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Read by the camera loop: is a tile under the pointer, is a film open, when did the pointer last move.
  const hoverRef = useRef(false);
  const projectRef = useRef(false);
  const menuRef = useRef(false);
  const lastMoveRef = useRef(-Infinity);
  // Scroll / drag push on the wall (screen-heights per second), and whether the
  // last touch was a drag (so it doesn't also open the tile under the finger).
  const pushRef = useRef(0);
  const draggedRef = useRef(false);
  const draggingRef = useRef(false); // a drag is in progress: the wall follows it, hover is off
  const dragAccRef = useRef(0); // wall travel dragged since the last frame, in px
  const planeRef = useRef<HTMLDivElement>(null);
  const warpRef = useRef<HTMLDivElement>(null);
  const lampRef = useRef<HTMLDivElement>(null);
  // set by the hover controller below: drop whatever film is hovered
  const clearHoverRef = useRef<() => void>(() => {});
  useEffect(() => {
    menuRef.current = menuOpen;
  }, [menuOpen]);
  useEffect(() => {
    projectRef.current = project !== null;
  }, [project]);
    const closeProject = useCallback(() => setProject(null), []);
  const onOpen = useCallback((index: number, el: HTMLElement, time: number) => {
    if (draggedRef.current) return; // that was a drag through the wall, not a click
    const r = el.getBoundingClientRect();
    clearHoverRef.current();
    setProject({ index, rect: { top: r.top, left: r.left, width: r.width, height: r.height }, time });
  }, []);

  // Lanes and tiles per lane follow the screen, so the wall never builds more tiles than it shows.
  useEffect(() => {
    let raf = 0;
    const sync = () => {
      const small = window.innerWidth <= 760;
      const lanes = small ? LANES_MOBILE : LANES_DESKTOP;
      const perLane = tilesPerLane(window.innerWidth, window.innerHeight, lanes, small ? GAP.mobile : GAP.desktop);
      setGrid((g) => (g.lanes === lanes && g.perLane === perLane ? g : { lanes, perLane }));
    };
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Live video budget for this device; nothing plays while a film is open or the tab is hidden.
  useEffect(() => {
    playback.start(liveBudget());
    const onVis = () => playback.setPaused(document.hidden || projectRef.current);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      playback.stop();
    };
  }, [playback]);
  useEffect(() => {
    playback.setPaused(project !== null || document.hidden);
  }, [project, playback]);

  const lanes = useMemo(
    () =>
      Array.from({ length: laneCount }, (_, l) => ({
        speed: 0.86 + ((l * 5) % 7) * 0.05,
        items: Array.from({ length: grid.perLane }, (_, t) => ({
          index: (l * 3 + t * 7) % clips.length,
          ratio: RATIOS[(l * 2 + t) % RATIOS.length],
        })),
      })),
    [laneCount, grid.perLane, clips]
  );

  // ---- the camera: one loop drives every lane ----
  useEffect(() => {
    const n = laneCount;
    const tracks = trackRefs.current.slice(0, n);
    let heights: number[] = [];
    const measure = () => {
      heights = tracks.map((el) => (el ? el.offsetHeight / 2 : 0));
    };
    measure();
    const pos = tracks.map((_, l) => ((l * 0.37) % 1) * (heights[l] || 0));
    const place = (l: number) => {
      const el = tracks[l];
      const h = heights[l];
      if (el && h) el.style.transform = `translate3d(0, ${(pos[l] - h).toFixed(1)}px, 0)`;
    };
    const warp = warpRef.current;
    let warpShown = 0;
    tracks.forEach((_, l) => place(l));
    window.addEventListener("resize", measure);
    if (reduce) return () => window.removeEventListener("resize", measure);

    const start = performance.now();
    let last = start;
    let raf = 0;
    let speed = 1;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const vh = window.innerHeight;
      // 1 = running, HOVER_SPEED = held under an active pointer, 0 = a film is open.
      // Ease toward it so the wall glides to a hold and back, never snaps.
      const holding = hoverRef.current && now - lastMoveRef.current < HOLD_MS;
      // while dragged, the wall goes only where the pointer takes it
      const target = projectRef.current || draggingRef.current ? 0 : holding ? HOVER_SPEED : 1;
      const drag = dragAccRef.current;
      dragAccRef.current = 0;
      speed += (target - speed) * Math.min(1, dt * SPEED_EASE);
      // the push coasts back down; while it lasts the camera leans in a touch
      pushRef.current *= Math.exp(-PUSH.decay * dt);
      if (Math.abs(pushRef.current) < 0.001) pushRef.current = 0;
      const w = Math.min(1, Math.abs(pushRef.current) / 4);
      if (warp && Math.abs(w - warpShown) > 0.004) {
        warpShown = w;
        warp.style.transform = `scale(${(1 + w * 0.06).toFixed(4)})`;
      }
      if (speed < 0.0005 && target === 0 && !drag && !pushRef.current) {
        // frozen behind an open film: no work, no DOM writes
        raf = requestAnimationFrame(step);
        return;
      }
      for (let l = 0; l < n; l++) {
        const h = heights[l];
        if (!h) continue;
        const lag = Math.abs(l - (n - 1) / 2) * 0.09; // centre lanes push first
        const surge = variant.swap ? surgeAt(t - lag) * SURGE.peak : 0;
        const own = (CRAWL + surge + arrivalAt(t - lag) * ARRIVAL.peak) * speed;
        const v = (own + pushRef.current) * vh * lanes[l].speed;
        pos[l] = (((pos[l] + v * dt + drag * lanes[l].speed) % h) + h) % h; // runs either way
        place(l);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [laneCount, lanes, reduce, variant.swap]);

  // Drag to slide: grab the wall (mouse or finger) and it follows; let go and it
  // glides on with the throw, then settles back to its own pace. Hover is off
  // for the whole drag so tiles sliding under the pointer don't pop.
  useEffect(() => {
    if (reduce) return;
    const scene = sceneRef.current;
    if (!scene) return;
    let id = -1;
    let lastY = 0;
    let lastT = 0;
    let travel = 0;
    let vel = 0; // px per second, smoothed
    const begin = () => {
      draggingRef.current = true;
      draggedRef.current = true;
      scene.classList.add(styles.dragging);
      clearHoverRef.current();
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || menuRef.current || projectRef.current) return;
      id = e.pointerId;
      lastY = e.clientY;
      lastT = performance.now();
      travel = 0;
      vel = 0;
      draggedRef.current = false;
      pushRef.current = 0; // catching the wall stops its glide
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const now = performance.now();
      const dy = e.clientY - lastY;
      travel += Math.abs(dy);
      if (!draggingRef.current && travel > PUSH.threshold) begin();
      if (draggingRef.current) {
        dragAccRef.current += dy * PUSH.drag;
        const inst = (dy / Math.max(1, now - lastT)) * 1000;
        vel = vel * 0.55 + inst * 0.45;
      }
      lastY = e.clientY;
      lastT = now;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      if (!draggingRef.current) return;
      draggingRef.current = false;
      scene.classList.remove(styles.dragging);
      if (performance.now() - lastT > 90) vel = 0; // held still before letting go: no throw
      const throwV = (vel * PUSH.drag) / window.innerHeight;
      pushRef.current = Math.max(-PUSH.max, Math.min(PUSH.max, throwV));
    };
    scene.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      scene.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [reduce]);

  // ---- Hover and pointer motion: one listener, one animation loop ----
  // Hover follows the real mouse only: a film becomes "hovered" when the pointer
  // moves onto it, never because the wall carried it under a resting cursor, and
  // it lets go once the mouse has rested for HOLD_MS (the wall then runs on).
  // Everything that follows the pointer (the hovered film's tilt and glare, the
  // lamp, the wall's lean) is eased toward its target every frame and written
  // straight to the DOM: no CSS transitions restarting on every mouse move.
  useEffect(() => {
    const plane = planeRef.current;
    const lamp = lampRef.current;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    type Tilt = {
      glare: HTMLElement | null;
      on: boolean;
      rx: number; ry: number; s: number; gx: number; gy: number; // current
      trx: number; try: number; tgx: number; tgy: number; // target
    };
    const tilts = new Map<HTMLElement, Tilt>();
    let hovered: HTMLElement | null = null;
    let intent = 0;
    let lastMove = -Infinity;
    const p = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const lampAt = { ...p };
    const lean = { x: 0, y: 0 };
    let leanCss = "";

    const setHover = (el: HTMLElement | null) => {
      if (el === hovered) return;
      if (hovered) {
        hovered.classList.remove(styles.tileOn);
        const t = tilts.get(hovered);
        if (t) t.on = false;
      }
      hovered = el;
      window.clearTimeout(intent);
      if (!el) {
        hoverRef.current = false;
        playback.setHovered(null);
        labelRef.current?.show(null);
        return;
      }
      el.classList.add(styles.tileOn);
      const t = tilts.get(el);
      if (t) t.on = true;
      else
        tilts.set(el, {
          glare: el.querySelector<HTMLElement>(`.${styles.tileGlare}`),
          on: true,
          rx: 0, ry: 0, s: 1, gx: 0.5, gy: 0.5,
          trx: 0, try: 0, tgx: 0.5, tgy: 0.5,
        });
      hoverRef.current = true;
      labelRef.current?.show(clips[Number(el.dataset.index)] ?? null);
      const id = el.dataset.tile ?? null;
      intent = window.setTimeout(() => playback.setHovered(id), INTENT_MS);
    };
    clearHoverRef.current = () => setHover(null);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      lastMove = performance.now();
      lastMoveRef.current = lastMove;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!fine || draggingRef.current || menuRef.current || projectRef.current) return setHover(null);
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-tile]") ?? null;
      setHover(el);
      const t = el && tilts.get(el);
      if (!el || !t) return;
      const r = el.getBoundingClientRect();
      const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      t.trx = (0.5 - ny) * TILT.x;
      t.try = (nx - 0.5) * TILT.y;
      t.tgx = nx;
      t.tgy = ny;
    };
    const onLeave = () => setHover(null);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // a resting mouse lets go of the film, and the wall runs again
      if (hovered && now - lastMove > HOLD_MS) setHover(null);

      // the lamp trails the pointer
      if (lamp && fine) {
        const k = 1 - Math.exp(-dt * 6);
        const dx = p.x - lampAt.x;
        const dy = p.y - lampAt.y;
        if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
          lampAt.x += dx * k;
          lampAt.y += dy * k;
          lamp.style.setProperty("--lx", `${lampAt.x.toFixed(1)}px`);
          lamp.style.setProperty("--ly", `${lampAt.y.toFixed(1)}px`);
        }
      }

      // the wall leans a little toward the pointer, slowly
      if (plane && fine && !reduce) {
        const k = 1 - Math.exp(-dt * 2.2);
        lean.x += ((p.x / window.innerWidth) * 2 - 1 - lean.x) * k;
        lean.y += ((p.y / window.innerHeight) * 2 - 1 - lean.y) * k;
        const css = `translateX(${(-lean.x * 2.5).toFixed(3)}vw) rotateX(${(52 + lean.y * 2).toFixed(3)}deg)`;
        if (css !== leanCss) {
          plane.style.transform = css;
          leanCss = css;
        }
      }

      // the hovered film turns toward the pointer and comes forward; the one you
      // left settles back, then its inline transform is dropped
      const k = 1 - Math.exp(-dt * TILT.ease);
      tilts.forEach((t, el) => {
        const on = t.on && !reduce;
        t.rx += ((on ? t.trx : 0) - t.rx) * k;
        t.ry += ((on ? t.try : 0) - t.ry) * k;
        t.s += ((on ? TILT.scale : 1) - t.s) * k;
        t.gx += (t.tgx - t.gx) * k;
        t.gy += (t.tgy - t.gy) * k;
        if (!t.on && Math.abs(t.rx) < 0.01 && Math.abs(t.ry) < 0.01 && Math.abs(t.s - 1) < 0.0003) {
          el.style.transform = "";
          if (t.glare) t.glare.style.transform = "";
          tilts.delete(el);
          return;
        }
        el.style.transform = `perspective(900px) rotateX(${t.rx.toFixed(2)}deg) rotateY(${t.ry.toFixed(2)}deg) scale(${t.s.toFixed(4)})`;
        if (t.glare)
          t.glare.style.transform = `translate3d(${((t.gx - 0.5) * 62.5).toFixed(2)}%, ${((t.gy - 0.5) * 62.5).toFixed(2)}%, 0)`;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(intent);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      setHover(null);
    };
  }, [clips, playback, reduce]);

    const enter = (delay: number, from: TargetAndTransition, to: TargetAndTransition, duration = 1.1) =>
    reduce
      ? { initial: false as const }
      : { initial: from, animate: { ...to, transition: { delay, duration, ease: EASE } } };

  return (
    <section className={`${styles.page} ${interTight.variable} ${archivo.variable}`} aria-label={mark} style={menuOpen ? { touchAction: "none" } : undefined}>
      {/* ================= The depth gallery: rushing behind the letterbox ================= */}

      <motion.div
        ref={sceneRef}
        className={styles.scene}
        style={menuOpen ? { pointerEvents: "none", touchAction: "none" } : undefined}
        aria-hidden="true"
        {...enter(T.wall, { scale: 1.12 }, { scale: 1 }, 2.6)}
      >
        <div ref={warpRef} className={styles.warp}>
        <div ref={planeRef} className={styles.plane}>
          {lanes.map((lane, l) => (
            <div key={l} className={styles.lane}>
              <div
                ref={(el) => {
                  trackRefs.current[l] = el;
                }}
                className={styles.track}
              >
                {[0, 1].map((copy) =>
                  lane.items.map((it, t) => (
                    <Tile
                      key={`${copy}-${t}`}
                      id={`${l}-${copy}-${t}`}
                      clip={clips[it.index]}
                      index={it.index}
                      ratio={it.ratio}
                      playback={playback}
                      onOpen={onOpen}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
        </div>
      </motion.div>

      {/* one layer for the whole grade */}
      <div className={styles.grade} aria-hidden="true" />
      {/* the lamp: the wall rests in shadow and a soft pool of light follows the
          pointer, so the films near it come up. One full-screen layer. */}
      <motion.div
        className={styles.lamp}
        initial={{ opacity: 0 }}
        animate={{ opacity: gone && !menuOpen ? 1 : 0, transition: { duration: 1.6, ease: EASE } }}
        aria-hidden="true"
      >
        <div ref={lampRef} className={styles.lampLight} />
      </motion.div>

      {/* ================= Middle: the 16X9 card (cuts in after the opening) ================= */}
      <div className={styles.copy}>
        <h1 className={styles.sr}>
          {mark} {MARK_SUB}. {HEADLINE.join(" ")}. {SUBHEAD.join(" ")}.
        </h1>
        <Heading
          lines={HEADLINE}
          tagline={SUBHEAD}
          show={gone && !menuOpen}
          first={menuKey === 0}
          reduce={reduce}
        />
        <Mark mark={mark} reduce={reduce} gone={gone} menuOpen={menuOpen} menuKey={menuKey} />
      </div>

      {/* ================= Menu (no boxes: a veil over the wall and the links) ================= */}
      <Menu open={menuOpen} reduce={reduce} onClose={closeMenu} />

      {/* ================= Top bar: logo left, burger right ================= */}
      <motion.header
        className={styles.topbar}
        {...enter(T.lines, { opacity: 0, y: -12 }, { opacity: 1, y: 0 }, 1.0)}
      >
        <Link href="/" className={styles.logo} aria-label="Home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt={mark} className={styles.logoImg} />
        </Link>

        <button
          type="button"
          className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="hero12-menu"
          onClick={() => {
            if (!menuOpen) {
              setMenuKey((k) => k + 1);
              // the wall goes quiet under the menu: no hover, no hold
              clearHoverRef.current();
            }
            setMenuOpen(!menuOpen);
          }}
        >
          <span />
          <span />
          <span />
        </button>
      </motion.header>

      {/* ================= Logo strip ================= */}
      <motion.div
        className={styles.clients}
        aria-label="Clients"
        {...enter(T.clients, { opacity: 0 }, { opacity: 1 }, 1.4)}
      >
        <div className={styles.clientsTrack}>
          {[...variant.clients, ...variant.clients].map((c, i) => (
            <span key={i} aria-hidden={i >= variant.clients.length}>
              {c.name}
            </span>
          ))}
        </div>
      </motion.div>

      {/* ================= Hover label and the full-screen project ================= */}
      <CursorLabel ref={labelRef} />
      <AnimatePresence>
        {project && <ProjectView key="project" clips={clips} open={project} onClose={closeProject} />}
      </AnimatePresence>

      {/* ================= Opening ================= */}
      {!reduce && !opened && <Letterbox onDone={() => setOpened(true)} />}
    </section>
  );
}