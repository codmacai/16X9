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
import { resolveVariant, type Clip, type HeroVariant } from "@/components/Hero-config";
import ProjectView, { type OpenProject } from "./project-view";
import { liveBudget, posterFor, WallPlayback } from "./wall-playback";
import styles from "./depthhero.module.css";


// ===========================================================================
// COPY
// ===========================================================================
const LEFT_LINE = "BRINGING BRANDS TO LIFE";
const MARK_SUB = "& BEYOND"; // tiny tag on the same line as the mark, cut into the card
const RIGHT_LINES = ["Turn target audience", "into your viewers"];
const LOGO_SRC = "/logo.png"; // put your logo in /public and change this path

// ===========================================================================
// SEQUENCE, in seconds
// 1. OPENING: on black, the letterbox parts top and bottom. Behind it the
//    depth gallery is already rushing forward, and it brakes as the frame opens.
// 2. The 16X9 card appears on a hard cut, like an edit. No animation.
// 3. The lines settle in under the card.
// 4. The client strip fades in.
// After that the wall surges forward every few seconds like a dolly push.
// Hovering a tile holds the wall still and lifts the tile; clicking it opens
// the film full screen (see project-view.tsx).
// ===========================================================================
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const T = {
  open: 0.3, // letterbox starts to part
  wall: 0.3, // depth gallery is rushing behind the letterbox
  card: 1.9, // the card cuts in
  lines: 2.05, // left line and right lines
  clients: 2.8, // logo strip
};

// Speeds are in screen-heights per second.
const CRAWL = 0.13;
const SURGE = { first: T.card + 3.4, every: 5.8, length: 1.7, peak: 1.5 };
// How fast the wall runs while a tile is hovered (0 = stopped, 1 = full speed),
// and how quickly it eases between speeds.
const HOVER_SPEED = 0.06;
const SPEED_EASE = 5;
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
const RATIOS = ["3 / 4", "16 / 10", "4 / 5", "1 / 1", "2 / 3", "16 / 9", "5 / 6"];

// The mark
const COBALT = "#FFFFFF";
// Inter Tight: bold, tight grotesque (normal width) to match the FEVER COAST reference
const FONT = "var(--font-sans, 'Inter Tight'), 'Helvetica Neue', Arial, sans-serif";
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
// MENU — the 16X9 card becomes the navigation. Timeline, in seconds:
//   open:  the card's letters rise out (0 → LETTERS) · at SPLIT the card is
//          swapped for three white bars that tile it exactly, which spread
//          into a stack · the words rise into the bars (from WORDS)
//   close: the words drop · the bars close back into the card · at JOIN the
//          card returns and its letters settle back down
// ===========================================================================
const MENU = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
] as const;
const MENU_T = { letters: 0.5, split: 0.46, spread: 0.85, words: 1.0, collapse: 0.6, collapseAt: 0.18, join: 0.8 };
const BAR_H = 0.15; // each bar's height, as a fraction of the card's width
const BAR_GAP = 0.018; // gap between bars, same unit
// The wheel: neighbours' scale and opacity, how long a turn takes, and what counts as a turn.
const WHEEL = { side: 0.62, fade: 0.38, turnS: 0.7, cooldown: 420, wheelStep: 40, swipe: 36 };

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
// TILE — one film on the wall. It always shows a still poster; WallPlayback
// lets only a few tiles at a time mount a live <video>, which fades in over
// the poster once it is actually playing. Hover lifts it (CSS); click opens it.
// ===========================================================================
type TileProps = {
  id: string;
  clip: Clip;
  index: number;
  ratio: string;
  playback: WallPlayback;
  onHover: (id: string | null, index: number | null) => void;
  onOpen: (index: number, el: HTMLElement, time: number) => void;
};

const Tile = memo(function Tile({ id, clip, index, ratio, playback, onHover, onOpen }: TileProps) {
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
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(id, index)}
      onPointerLeave={() => onHover(null, null)}
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
    </div>
  );
});

// ===========================================================================
// CURSOR LABEL — a small white block, cut like the 16X9 mark, that trails the
// pointer over a tile with the film's name and length.
// It owns its own state (set through a ref), so hovering never re-renders the
// wall; the pointer position lives in motion values, so following it never
// re-renders anything at all.
// ===========================================================================
type CursorLabelHandle = { show: (clip: Clip | null) => void };

function CursorLabel({ ref }: { ref: Ref<CursorLabelHandle> }) {
  const [clip, setClip] = useState<Clip | null>(null);
  useImperativeHandle(ref, () => ({ show: setClip }), []);

  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 900, damping: 60, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 900, damping: 60, mass: 0.4 });

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
        {clip && (
          <motion.svg
            key="play"
            className={styles.cursorPlay}
            viewBox="0 0 12 14"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0, transition: { duration: 0.4, ease: EASE } }}
            exit={{ scale: 0, transition: { duration: 0.2 } }}
          >
            <path d="M0 0L12 7L0 14Z" />
          </motion.svg>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {clip && (
          <motion.div
            key="label"
            className={styles.cursorTag}
            // an edit-style wipe: in from the left, off to the right
            initial={{ clipPath: "inset(0% 100% 0% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.42, ease: EASE_CINE } }}
            exit={{ clipPath: "inset(0% 0% 0% 100%)", transition: { duration: 0.28, ease: EASE_CINE } }}
          >
            <span className={styles.cursorTitle}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={clip.title}
                  initial={{ y: "105%" }}
                  animate={{ y: 0, transition: { duration: 0.45, ease: EASE } }}
                  exit={{ y: "-105%", transition: { duration: 0.3, ease: EASE } }}
                >
                  {clip.title}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className={styles.cursorDur}>{clip.duration}</span>
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
// THE MARK — a block with 16X9 and © cut clean through it. No animation of
// its own: it cuts in whole at T.card. The wall behind shows through the letters.
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

/** Width of a word at 100px in the mark's face, letter-spacing included. */
function wordWidth100(word: string, family: string) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return word.length * 62;
  ctx.font = `${MARK_WEIGHT} 100px ${family}`;
  return ctx.measureText(word.toUpperCase()).width + (word.length - 1) * TRACK * 100;
}

function Mark({
  mark,
  reduce,
  menuOpen,
  menuKey,
  onNavigate,
}: {
  mark: string;
  reduce: boolean;
  menuOpen: boolean;
  /** changes every time the menu opens, so the wheel starts fresh on WORK */
  menuKey: number;
  onNavigate: () => void;
}) {
  const [menuFs, setMenuFs] = useState(0);
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
        // the menu words: as big as the bars allow, the longest still fitting the card
        const family = getComputedStyle(probe).fontFamily;
        const widest = Math.max(...MENU.map((m) => wordWidth100(m.label, family)));
        const barH = w * BAR_H;
        setMenuFs(Math.min((barH * 0.56) / CAP, (inner * 0.86 * 100) / widest));
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
      {/* hard cut: hidden, then on, with no transition */}
      <motion.div
        ref={blockRef}
        className={styles.wmBlock}
        style={{ padding: `${PAD_TOP}cqw ${PAD_X}cqw ${PAD_BOTTOM}cqw` }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: T.card, duration: 0 }}
      >
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
                {/* the letters rise out of the card when the menu opens, and settle back on close */}
                <motion.g
                  initial={false}
                  animate={{ y: menuOpen ? -box.h : 0 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : menuOpen
                        ? { duration: MENU_T.letters, ease: EASE_CINE }
                        : { duration: 0.75, ease: EASE, delay: MENU_T.join }
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
        ) : null}

        {box && menuFs > 0 ? (
          <Menu key={menuKey} box={box} fs={menuFs} open={menuOpen} reduce={reduce} onNavigate={onNavigate} />
        ) : null}
      </motion.div>

      {/* Under the block: the line on the left, two lines on the right (all uppercase via CSS) */}
      <motion.div
        className={styles.wmUnder}
        initial={false}
        animate={{ opacity: menuOpen ? 0 : 1, y: menuOpen ? 14 : 0 }}
        transition={
          reduce
            ? { duration: 0 }
            : menuOpen
              ? { duration: 0.4, ease: EASE_CINE }
              : { duration: 0.8, ease: EASE, delay: MENU_T.join + 0.15 }
        }
      >
        <span className={styles.wmLineMask}>
          <motion.span
            className={styles.wmLine}
            initial={reduce ? false : { y: "110%" }}
            animate={{ y: 0 }}
            transition={{ duration: 1.2, ease: EASE, delay: T.lines }}
          >
            {LEFT_LINE}
          </motion.span>
        </span>

        <p className={styles.wmRight}>
          {RIGHT_LINES.map((l, i) => (
            <span key={l} className={styles.wmRightMask}>
              <motion.span
                className={styles.wmRightLine}
                initial={reduce ? false : { y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.1, ease: EASE, delay: T.lines + 0.2 + i * 0.1 }}
              >
                {l}
              </motion.span>
            </span>
          ))}
        </p>
      </motion.div>
    </div>
  );
}

// ===========================================================================
// MENU WHEEL — the card becomes a wheel of white bars. The active link sits in
// the middle at full size with its words cut through the white like the mark;
// the ones before and after sit above and below, smaller and faded. Scroll,
// swipe or ↑/↓ turn the wheel (it loops); click a faded bar to bring it to the
// middle; click the middle one to go there.
//
// The wheel is drawn as a window of slots k = cursor-3 … cursor+3. A slot's
// key is k itself, so turning the wheel only shifts each slot's offset and
// framer animates the move; slots that leave the window are already invisible.
// ===========================================================================
const mod = (a: number, n: number) => ((a % n) + n) % n;

function Menu({
  box,
  fs,
  open,
  reduce,
  onNavigate,
}: {
  box: Box;
  fs: number;
  open: boolean;
  reduce: boolean;
  onNavigate: () => void;
}) {
  const uid = useId().replace(/:/g, "");
  const [cursor, setCursor] = useState(0); // unbounded; the active item is MENU[mod(cursor)]
  const [turned, setTurned] = useState(false); // once the wheel has turned, moves are quick (no open choreography)
  const wheelAcc = useRef(0);
  const lastTurn = useRef(0);
  const swipe = useRef<{ y: number; moved: boolean } | null>(null);

  const n = MENU.length;
  const barH = box.w * BAR_H;
  const gap = box.w * BAR_GAP;
  const centerTop = (box.h - barH) / 2; // the active bar sits where the card's middle was
  const step = barH * (0.5 + WHEEL.side / 2) + gap; // centre-to-centre distance to a neighbour
  const base = (barH + fs * CAP) / 2;
  const indexSize = Math.max(10, box.w * 0.022);

  const turn = useCallback((dir: number) => {
    const now = performance.now();
    if (now - lastTurn.current < WHEEL.cooldown) return;
    lastTurn.current = now;
    setTurned(true);
    setCursor((c) => c + dir);
  }, []);

  // keyboard: ↑ / ↓ turn the wheel while the menu is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        turn(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        turn(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, turn]);

  // Scroll and swipe anywhere on the screen turn the wheel while the menu is open.
  // The wheel listener is non-passive so the page never scrolls underneath.
  useEffect(() => {
    if (!open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelAcc.current += e.deltaY;
      if (Math.abs(wheelAcc.current) >= WHEEL.wheelStep) {
        turn(Math.sign(wheelAcc.current));
        wheelAcc.current = 0;
      }
    };
    // a swipe: touch events on phones (pointer events get cancelled by the browser's
    // own gesture handling), a mouse drag on desktop
    const start = (y: number) => {
      swipe.current = { y, moved: false };
    };
    const end = (y: number) => {
      const s = swipe.current;
      if (!s) return;
      const dy = y - s.y;
      if (Math.abs(dy) > WHEEL.swipe) {
        s.moved = true;
        turn(dy < 0 ? 1 : -1); // swipe up = next
      }
    };
    const onTouchStart = (e: TouchEvent) => start(e.touches[0].clientY);
    const onTouchEnd = (e: TouchEvent) => end(e.changedTouches[0].clientY);
    const onMouseDown = (e: PointerEvent) => e.pointerType === "mouse" && start(e.clientY);
    const onMouseUp = (e: PointerEvent) => e.pointerType === "mouse" && end(e.clientY);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("pointerdown", onMouseDown);
    window.addEventListener("pointerup", onMouseUp);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("pointerdown", onMouseDown);
      window.removeEventListener("pointerup", onMouseUp);
    };
  }, [open, turn]);

  const slots = [];
  for (let k = cursor - 3; k <= cursor + 3; k++) slots.push(k);

  return (
    <nav
      id="hero7-menu"
      className={styles.menu}
      aria-label="Main"
      aria-hidden={!open}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      {slots.map((k) => {
        const o = k - cursor; // -3 … 3, 0 = active
        const i = mod(k, n);
        const item = MENU[i];
        const far = Math.abs(o) >= 2;
        const s = o === 0 ? 1 : WHEEL.side * (far ? 0.85 : 1);
        const maskId = `m-${uid}-${k}`;

        // open: placed on the wheel. closed: the active bar covers the card, the rest fold into it.
        const opened = {
          y: o === 0 ? 0 : Math.sign(o) * (step + (far ? (Math.abs(o) - 1) * step * WHEEL.side : 0)),
          scaleX: s,
          scaleY: s,
          opacity: o === 0 ? 1 : far ? 0 : WHEEL.fade,
        };
        const closed =
          o === 0
            ? { y: 0, scaleX: 1, scaleY: box.h / barH, opacity: 0 }
            : { y: 0, scaleX: s, scaleY: 0, opacity: 0 };

        const openTransition = reduce
          ? { duration: 0 }
          : turned
            ? { duration: WHEEL.turnS, ease: EASE }
            : {
                opacity: { duration: o === 0 ? 0 : 0.5, delay: o === 0 ? MENU_T.split : MENU_T.split + 0.25 },
                default: { duration: MENU_T.spread, ease: EASE_CINE, delay: MENU_T.split },
              };
        const closeTransition = reduce
          ? { duration: 0 }
          : {
              opacity: { duration: o === 0 ? 0 : 0.3, delay: o === 0 ? MENU_T.join : 0 },
              default: { duration: MENU_T.collapse, ease: EASE_CINE, delay: MENU_T.collapseAt },
            };
        const wordIn = reduce
          ? { duration: 0 }
          : open
            ? { duration: 0.8, ease: EASE, delay: turned ? 0 : MENU_T.words }
            : { duration: 0.3, ease: EASE_CINE };

        return (
          <motion.div
            key={k}
            className={styles.bar}
            style={{ top: centerTop, height: barH, transformOrigin: "50% 50%", zIndex: 10 - Math.abs(o) }}
            initial={closed}
            animate={open ? { ...opened, transition: openTransition } : { ...closed, transition: closeTransition }}
          >
            <a
              href={item.href}
              className={`${styles.barLink} ${o === 0 ? styles.barActive : ""}`}
              aria-label={item.label}
              aria-current={o === 0 ? "page" : undefined}
              tabIndex={open && o === 0 ? 0 : -1}
              onClick={(e) => {
                if (swipe.current?.moved) {
                  e.preventDefault(); // that was a swipe, not a tap
                  swipe.current = null;
                  return;
                }
                if (o !== 0) {
                  e.preventDefault(); // a faded bar comes to the middle first
                  setTurned(true);
                  lastTurn.current = performance.now();
                  setCursor((c) => c + o);
                  return;
                }
                onNavigate();
              }}
            >
              <svg aria-hidden viewBox={`0 0 ${box.w} ${barH}`} preserveAspectRatio="none">
                <defs>
                  <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={box.w} height={barH}>
                    <rect width={box.w} height={barH} fill="#fff" />
                    <motion.text
                      x={box.pl}
                      y={base}
                      fill="#000"
                      style={{ ...WIDE, fontWeight: MARK_WEIGHT, fontSize: fs, letterSpacing: `${TRACK}em` }}
                      initial={{ y: barH }}
                      animate={{ y: open ? 0 : barH }}
                      transition={wordIn}
                    >
                      {item.label.toUpperCase()}
                    </motion.text>
                    <motion.text
                      x={box.w - box.pr * 0.45}
                      y={barH - box.pb * 0.9}
                      textAnchor="end"
                      fill="#000"
                      style={{ fontFamily: FONT, fontWeight: 600, fontSize: indexSize }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: open ? 1 : 0 }}
                      transition={wordIn}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </motion.text>
                  </mask>
                </defs>
                <rect width={box.w} height={barH} fill={COBALT} mask={`url(#${maskId})`} />
              </svg>
            </a>
          </motion.div>
        );
      })}

      {/* a quiet hint under the wheel */}
      <motion.p
        className={styles.wheelHint}
        style={{ top: centerTop + barH / 2 + step + (barH * WHEEL.side) / 2 + gap * 1.6 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0, transition: { duration: 0.5, delay: open && !turned ? MENU_T.words + 0.3 : 0 } }}
        aria-hidden="true"
      >
        Scroll or swipe
      </motion.p>
    </nav>
  );
}

// ===========================================================================
// HERO — films and clients come from Hero-config (URL ?hero=, dates, default)
// ===========================================================================
export default function DepthHero({ variantId }: { variantId?: string }) {
  const [variant, setVariant] = useState<HeroVariant | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("hero");
    setVariant(resolveVariant(new Date(), variantId ?? q));
  }, [variantId]);

  if (!variant) return <section className={styles.page} aria-hidden="true" />;
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
  const lastMoveRef = useRef(-Infinity);
  useEffect(() => {
    projectRef.current = project !== null;
  }, [project]);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") lastMoveRef.current = performance.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Hover never touches DepthInner state: it flips a ref for the camera loop
  // and hands the clip to the cursor label, so the wall itself never re-renders.
  const onHover = useCallback(
    (id: string | null, index: number | null) => {
      hoverRef.current = index !== null;
      playback.setHovered(id);
      labelRef.current?.show(index === null ? null : clips[index]);
    },
    [clips, playback]
  );
  const closeProject = useCallback(() => setProject(null), []);
  const onOpen = useCallback((index: number, el: HTMLElement, time: number) => {
    const r = el.getBoundingClientRect();
    hoverRef.current = false;
    playback.setHovered(null);
    labelRef.current?.show(null);
    setProject({ index, rect: { top: r.top, left: r.left, width: r.width, height: r.height }, time });
  }, [playback]);

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
      const target = projectRef.current ? 0 : holding ? HOVER_SPEED : 1;
      speed += (target - speed) * Math.min(1, dt * SPEED_EASE);
      if (speed < 0.0005 && target === 0) {
        // frozen behind an open film: no work, no DOM writes
        raf = requestAnimationFrame(step);
        return;
      }
      for (let l = 0; l < n; l++) {
        const h = heights[l];
        if (!h) continue;
        const lag = Math.abs(l - (n - 1) / 2) * 0.09; // centre lanes push first
        const surge = variant.swap ? surgeAt(t - lag) * SURGE.peak : 0;
        const v = (CRAWL + surge + arrivalAt(t - lag) * ARRIVAL.peak) * vh * lanes[l].speed * speed;
        pos[l] = (pos[l] + v * dt) % h;
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

  // The wall leans a little toward the pointer
  useEffect(() => {
    if (reduce) return;
    const el = sceneRef.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", `${(-nx * 2.5).toFixed(2)}vw`);
        el.style.setProperty("--py", `${(ny * 2).toFixed(2)}deg`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduce]);

  const enter = (delay: number, from: TargetAndTransition, to: TargetAndTransition, duration = 1.1) =>
    reduce
      ? { initial: false as const }
      : { initial: from, animate: { ...to, transition: { delay, duration, ease: EASE } } };

  return (
    <section className={styles.page} aria-label={mark} style={menuOpen ? { touchAction: "none" } : undefined}>
      {/* ================= The depth gallery: rushing behind the letterbox ================= */}

      <motion.div
        ref={sceneRef}
        className={styles.scene}
        style={menuOpen ? { pointerEvents: "none", touchAction: "none" } : undefined}
        aria-hidden="true"
        {...enter(T.wall, { scale: 1.12 }, { scale: 1 }, 2.6)}
      >
        <div className={styles.plane}>
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
                      onHover={onHover}
                      onOpen={onOpen}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* one layer for the whole grade */}
      <div className={styles.grade} aria-hidden="true" />

      {/* ================= Middle: the 16X9 card (cuts in after the opening) ================= */}
      <div className={styles.copy}>
        <h1 className={styles.sr}>
          {mark} {MARK_SUB}. {LEFT_LINE}. {RIGHT_LINES.join(" ")}.
        </h1>
        <Mark mark={mark} reduce={reduce} menuOpen={menuOpen} menuKey={menuKey} onNavigate={closeMenu} />
      </div>

      {/* ================= Top bar: logo left, burger right ================= */}
      <motion.header
        className={styles.topbar}
        {...enter(T.lines, { opacity: 0, y: -12 }, { opacity: 1, y: 0 }, 1.0)}
      >
        <a href="/" className={styles.logo} aria-label="Home">
          <img src={LOGO_SRC} alt={mark} className={styles.logoImg} />
        </a>

        <button
          type="button"
          className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="hero7-menu"
          onClick={() => {
            if (!menuOpen) {
              setMenuKey((k) => k + 1);
              // the wall goes quiet under the menu: no hover label, no hold
              hoverRef.current = false;
              playback.setHovered(null);
              labelRef.current?.show(null);
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