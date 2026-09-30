"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

// ===========================================================================
// CONTENT — replace with your own
// ===========================================================================
const NAV = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Work", href: "/work" },
  { label: "Contact", href: "/contact" },
];
const WORDMARK = "16X9";
const LEFT_LINE = "Bringing brands to life";
const RIGHT_LINES = ["Turn target audience", "into your viewers"];

// The film. It is never shown as wallpaper: the page is black, and this one
// clip is only visible through the cut-out letters and the cursor viewfinder.
// Both are windows onto the SAME full-screen frame, so they line up.
// (short muted loop; H.264 yuv420p so Safari plays it)
const FILM = { src: "/clips/clip-02.mp4", poster: "" };
const FPS = 25; // timecode frame rate shown in the viewfinder

// Showreel (opens full screen)
const REEL = { src: "/showreel.mp4", length: "01:32" };

// Clients strip. Give an entry a `logo` (SVG/PNG in /public) to show it in white.
const CLIENTS: { name: string; logo?: string }[] = [
  { name: "Cleveland Clinic" },
  { name: "Nike" },
  { name: "Emirates" },
  { name: "Samsung" },
  { name: "Red Bull" },
  { name: "Adidas" },
  { name: "Mercedes-Benz" },
  { name: "Spotify" },
];

// ===========================================================================
// COLOUR & TYPE — black, white, cobalt (and one red REC dot)
// ===========================================================================
const COBALT = "#2340FF";
const REC = "#FF2A2A";
const LINE = "rgba(35, 64, 255, 0.55)";
const FONT = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
const WIDE = { fontFamily: FONT, fontVariationSettings: "'wdth' 125" } as const;
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const FILM_GRADE = "grayscale(0.2) contrast(1.1) brightness(1)";

// Block geometry, in % of the block's width (cqw)
const PAD_X = 4.5;
const PAD_TOP = 3.4;
const PAD_BOTTOM = 3.8;
const CAP = 0.715; // Archivo cap height, as a fraction of the font size
const TRACK = -0.045; // wordmark letter spacing, in em

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap');
@keyframes hx-grain {
  0%,100% { transform: translate(0,0) } 25% { transform: translate(-4%,3%) }
  50% { transform: translate(3%,-4%) } 75% { transform: translate(-2%,-3%) }
}
.hx-grain { animation: hx-grain 0.8s steps(4) infinite; }
@keyframes hx-scroll { 0% { transform: scaleY(0); transform-origin: top } 45% { transform: scaleY(1); transform-origin: top }
  55% { transform: scaleY(1); transform-origin: bottom } 100% { transform: scaleY(0); transform-origin: bottom } }
.hx-scroll { animation: hx-scroll 2.2s cubic-bezier(0.76,0,0.24,1) infinite; }
@keyframes hx-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
.hx-marquee { animation: hx-marquee 48s linear infinite; }
.hx-strip:hover .hx-marquee { animation-play-state: paused; }
@keyframes hx-rec { 0%,55% { opacity: 1 } 56%,100% { opacity: 0.15 } }
.hx-rec { animation: hx-rec 1.2s steps(1) infinite; }
@media (prefers-reduced-motion: reduce) { .hx-grain, .hx-scroll, .hx-marquee, .hx-rec { animation: none; } }
`;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// iOS/Safari autoplay needs real muted + playsinline attributes
const prepVideo = (v: HTMLVideoElement | null, play = true) => {
  if (!v) return;
  v.muted = true;
  v.defaultMuted = true;
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  if (play) v.play().catch(() => {});
};

// ===========================================================================
// Construction lines
// ===========================================================================
function VLine({ at, delay, reduce }: { at: string; delay: number; reduce: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute w-px origin-center"
      style={{ left: at, top: "-100vh", height: "calc(100% + 200vh)", background: LINE }}
      initial={reduce ? false : { scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: 1.6, ease: EASE_CINE, delay }}
    />
  );
}

function HLine({ top, bottom, delay, reduce }: { top?: string; bottom?: string; delay: number; reduce: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute h-px origin-center"
      style={{ top, bottom, left: "-100vw", width: "calc(100% + 200vw)", background: LINE }}
      initial={reduce ? false : { scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 1.6, ease: EASE_CINE, delay }}
    />
  );
}

function GridLabel({ children, style, delay, reduce }: { children: string; style: React.CSSProperties; delay: number; reduce: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute whitespace-nowrap text-[10px] font-medium uppercase leading-none tracking-[0.18em]"
      style={{ color: COBALT, ...style }}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, ease: EASE, delay }}
    >
      {children}
    </motion.span>
  );
}

// ===========================================================================
// HERO
// ===========================================================================
type Box = {
  w: number; h: number; pl: number; pt: number; pb: number; pr: number;
  ox: number; oy: number; // block's top-left inside the section
  sw: number; sh: number; // section size
};

export default function Hero16x9() {
  const reduce = !!useReducedMotion();
  const maskId = `hx-cut-${useId().replace(/:/g, "")}`;
  const sectionRef = useRef<HTMLElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const filmRef = useRef<HTMLVideoElement | null>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [reelOpen, setReelOpen] = useState(false);

  // Fit the wordmark to the block, and record where the block sits inside the
  // section, so the film behind the letters lines up with the full-screen frame.
  useIsoLayoutEffect(() => {
    const section = sectionRef.current;
    const block = blockRef.current;
    const probe = probeRef.current;
    if (!section || !block || !probe) return;
    const fit = () => {
      const cs = getComputedStyle(block);
      const pl = parseFloat(cs.paddingLeft);
      const pr = parseFloat(cs.paddingRight);
      const pt = parseFloat(cs.paddingTop);
      const pb = parseFloat(cs.paddingBottom);
      const w = block.clientWidth;
      const inner = w - pl - pr;
      const tw = probe.getBoundingClientRect().width; // measured at 100px
      if (tw > 0 && inner > 0) {
        const fs = (100 * inner * 0.9) / tw;
        const sr = section.getBoundingClientRect();
        const br = block.getBoundingClientRect();
        setFontSize(fs);
        setBox({
          w, h: pt + pb + fs * CAP, pl, pt, pb, pr,
          ox: br.left - sr.left, oy: br.top - sr.top,
          sw: sr.width, sh: sr.height,
        });
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(block);
    ro.observe(section);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    prepVideo(filmRef.current, !reduce);
    const v = filmRef.current;
    if (!v) return;
    const onVis = () => (document.hidden ? v.pause() : !reduce && v.play().catch(() => {}));
    const kick = () => !reduce && v.play().catch(() => {});
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("touchstart", kick, { once: true, passive: true });
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("touchstart", kick);
    };
  }, [reduce]);

  const fade = (delay: number, y = 0) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.2, ease: EASE, delay } };

  const small = "text-[10px] font-semibold uppercase leading-none tracking-[0.22em] sm:text-[11px]";

  return (
    <section
      ref={sectionRef}
      aria-label={WORDMARK}
      className="relative h-screen w-full overflow-hidden bg-black text-white antialiased supports-[height:100svh]:h-[100svh]"
      style={{ fontFamily: FONT }}
    >
      <style>{CSS}</style>
      <h1 className="sr-only">
        {WORDMARK}. {LEFT_LINE}. {RIGHT_LINES.join(" ")}.
      </h1>

      {/* ================= The mark on its grid ================= */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative w-[88vw] sm:w-[min(62vw,980px)]" style={{ containerType: "inline-size" }}>
          <motion.div
            ref={blockRef}
            className="relative"
            style={{ padding: `${PAD_TOP}cqw ${PAD_X}cqw ${PAD_BOTTOM}cqw` }}
            initial={reduce ? false : { clipPath: "inset(0% 100% 0% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            transition={{ duration: 1.2, ease: EASE_CINE, delay: 0.9 }}
          >
            {/* The film, placed as if it were a full-screen frame behind the
                whole hero. Only what the cut-out letters expose is ever seen. */}
            {box ? (
              <video
                ref={filmRef}
                src={FILM.src}
                poster={FILM.poster || undefined}
                muted
                loop
                autoPlay={!reduce}
                playsInline
                preload="auto"
                disablePictureInPicture
                aria-hidden
                className="pointer-events-none absolute max-w-none object-cover"
                style={{
                  left: -box.ox,
                  top: -box.oy,
                  width: box.sw,
                  height: box.sh,
                  filter: FILM_GRADE,
                }}
              />
            ) : null}

            {/* hidden probe: measures the wordmark at 100px */}
            <span
              ref={probeRef}
              aria-hidden
              className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap"
              style={{ ...WIDE, fontWeight: 900, fontSize: 100, letterSpacing: `${TRACK}em` }}
            >
              {WORDMARK}
            </span>

            {/* spacer: gives the block the wordmark's cap height */}
            <span aria-hidden className="block" style={{ height: fontSize ? fontSize * CAP : "12cqw" }} />

            {/* The cobalt block with 16X9 and © cut clean through it:
                the film behind shows only inside the letters. */}
            {box && fontSize ? (
              <svg
                aria-hidden
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${box.w} ${box.h}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={box.w} height={box.h}>
                    <rect width={box.w} height={box.h} fill="#fff" />
                    <motion.g
                      initial={reduce ? false : { y: box.h }}
                      animate={{ y: 0 }}
                      transition={{ duration: 1.2, ease: EASE, delay: 1.35 }}
                    >
                      <text
                        x={box.pl}
                        y={box.pt + fontSize * CAP}
                        fill="#000"
                        style={{ ...WIDE, fontWeight: 900, fontSize, letterSpacing: `${TRACK}em` }}
                      >
                        {WORDMARK}
                      </text>
                    </motion.g>
                    <text
                      x={box.w - box.pr * 0.45}
                      y={box.h - box.pb}
                      textAnchor="end"
                      fill="#000"
                      style={{ fontFamily: FONT, fontWeight: 700, fontSize: Math.max(10, box.w * 0.022) }}
                    >
                      ©
                    </text>
                  </mask>
                </defs>
                <rect width={box.w} height={box.h} fill={COBALT} mask={`url(#${maskId})`} />
              </svg>
            ) : null}
          </motion.div>

          {/* Grid: outer edges, inner margins, cap line and baseline */}
          <VLine at="0" delay={0.05} reduce={reduce} />
          <VLine at={`${PAD_X}cqw`} delay={0.15} reduce={reduce} />
          <VLine at={`calc(100% - ${PAD_X}cqw - 1px)`} delay={0.2} reduce={reduce} />
          <VLine at="calc(100% - 1px)" delay={0.1} reduce={reduce} />
          <HLine top="0" delay={0.25} reduce={reduce} />
          <HLine top={`${PAD_TOP}cqw`} delay={0.35} reduce={reduce} />
          <HLine bottom={`${PAD_BOTTOM}cqw`} delay={0.45} reduce={reduce} />
          <HLine bottom="0" delay={0.3} reduce={reduce} />

          <GridLabel style={{ left: "0.8cqw", top: -18 }} delay={2.0} reduce={reduce}>
            16 : 9
          </GridLabel>
          <GridLabel style={{ left: `calc(${PAD_X}cqw + 1.2cqw)`, top: -18, marginLeft: 40 }} delay={2.1} reduce={reduce}>
            wdth 125 / wght 900
          </GridLabel>
          <GridLabel style={{ right: "0.8cqw", top: -18 }} delay={2.2} reduce={reduce}>
            fig. 01
          </GridLabel>

          {/* Under the block: the line on the left, showreel off the right corner */}
          <div className="absolute inset-x-0 top-[calc(100%+1px)] z-20 flex flex-col-reverse items-start gap-4 md:flex-row md:items-start md:justify-between">
            <span className="block overflow-hidden pt-1 md:pt-[1.6cqw]">
              <motion.span
                className="block whitespace-nowrap text-[5.2cqw] uppercase leading-none md:text-[3.4cqw]"
                style={{ ...WIDE, fontWeight: 800, letterSpacing: "-0.01em" }}
                initial={reduce ? false : { y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1.2, ease: EASE, delay: 1.75 }}
              >
                {LEFT_LINE}
              </motion.span>
            </span>

            <motion.button
              type="button"
              onClick={() => setReelOpen(true)}
              className="group flex shrink-0 items-center gap-3 bg-white py-2.5 pl-3 pr-4 text-black transition-colors duration-300 hover:bg-[#2340FF] hover:text-white"
              {...fade(2.0, 6)}
            >
              <span aria-hidden className="block h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-current" />
              <span className={small}>Play showreel</span>
              <span className="text-[10px] font-medium tabular-nums opacity-50 sm:text-[11px]">{REEL.length}</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* ================= Cursor viewfinder: a second window into the film ================= */}
      {box ? <Viewfinder sw={box.sw} sh={box.sh} reduce={reduce} filmRef={filmRef} /> : null}

      {/* ================= Top: floating nav ================= */}
      <motion.div className="absolute inset-x-0 top-5 z-40 flex justify-center px-4 sm:top-7" {...fade(2.1, -10)}>
        <FloatingNav reduce={reduce} />
      </motion.div>

      {/* ================= Bottom: clients, then copy + scroll cue ================= */}
      <motion.div className="absolute inset-x-0 bottom-[84px] z-20 px-5 sm:bottom-[96px] sm:px-10" {...fade(2.6)}>
        <ClientStrip />
      </motion.div>

      <motion.div
        className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-6 px-5 pb-6 sm:px-10 sm:pb-8"
        {...fade(2.25)}
      >
        <p className={`${small} text-white/50`}>
          © {new Date().getFullYear()} {WORDMARK}
        </p>

        <span aria-hidden className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2.5 sm:bottom-8 sm:flex">
          <span className={`${small} text-white/70`}>Scroll</span>
          <span className="relative block h-9 w-px bg-white/20">
            <span className="hx-scroll absolute inset-0 block" style={{ background: COBALT }} />
          </span>
        </span>

        <p
          className="text-right text-[clamp(11px,0.95vw,14px)] uppercase leading-[1.3] tracking-[0.04em] text-white/70"
          style={{ ...WIDE, fontWeight: 400 }}
        >
          {RIGHT_LINES.map((l) => (
            <span key={l} className="block">
              {l}
            </span>
          ))}
        </p>
      </motion.div>

      {/* Grain */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[35] overflow-hidden opacity-[0.12]">
        <div className="hx-grain absolute -inset-[50%]" style={{ backgroundImage: GRAIN }} />
      </div>

      <Showreel open={reelOpen} onClose={() => setReelOpen(false)} />
    </section>
  );
}

// ===========================================================================
// VIEWFINDER — a small 16:9 frame that follows the mouse. Inside it, the same
// film the letters show, positioned as a full-screen frame, so moving the
// frame over a letter makes the two windows line up. Corner brackets, a REC
// dot and a running timecode. With no mouse (touch devices, or before the
// first move) the frame drifts slowly on its own. It steps aside over links
// and buttons so it never gets in the way of a click.
// ===========================================================================
function Viewfinder({
  sw, sh, reduce, filmRef,
}: {
  sw: number;
  sh: number;
  reduce: boolean;
  filmRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const fw = sw < 640 ? 168 : 264;
  const fh = (fw * 9) / 16;

  const vidRef = useRef<HTMLVideoElement | null>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const target = useRef<{ x: number; y: number; seen: boolean }>({ x: 0, y: 0, seen: false });
  const dims = useRef({ sw, sh, fw, fh });
  dims.current = { sw, sh, fw, fh };

  const x = useMotionValue(sw / 2 - fw / 2);
  const y = useMotionValue(sh * 0.38 - fh / 2);
  const spring = reduce ? { stiffness: 1000, damping: 100 } : { stiffness: 170, damping: 24, mass: 0.6 };
  const sx = useSpring(x, spring);
  const sy = useSpring(y, spring);
  const nx = useTransform(sx, (v) => -v); // counter-move so the film stays put
  const ny = useTransform(sy, (v) => -v);

  const [ready, setReady] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), reduce ? 0 : 2600);
    return () => window.clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    prepVideo(vidRef.current, !reduce);
  }, [reduce]);

  // Mouse / pen only. Touch keeps the frame drifting.
  useEffect(() => {
    const host = vidRef.current?.closest("section");
    if (!host) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = host.getBoundingClientRect();
      target.current = { x: e.clientX - r.left, y: e.clientY - r.top, seen: true };
      const el = e.target as Element | null;
      setOver(!!el?.closest("a, button, [role='dialog']"));
    };
    const onLeave = () => setOver(true);
    window.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // One loop: position, timecode, and keeping the two videos in step.
  useEffect(() => {
    let raf = 0;
    const pad = (n: number, l = 2) => String(n).padStart(l, "0");
    const tick = (now: number) => {
      const { sw: W, sh: H, fw: FW, fh: FH } = dims.current;
      const p = target.current;
      let tx: number;
      let ty: number;
      if (p.seen) {
        tx = p.x - FW / 2;
        ty = p.y - FH / 2;
      } else if (reduce) {
        tx = (W - FW) / 2;
        ty = H * 0.38 - FH / 2;
      } else {
        tx = W * 0.5 - FW / 2 + Math.sin(now / 2600) * W * 0.26;
        ty = H * 0.38 - FH / 2 + Math.sin(now / 3300 + 1) * H * 0.18;
      }
      x.set(Math.min(Math.max(tx, 8), W - FW - 8));
      y.set(Math.min(Math.max(ty, 8), H - FH - 8));

      const v = vidRef.current;
      const f = filmRef.current;
      if (v && f) {
        const t = f.currentTime || 0;
        const d = f.duration || 0;
        const off = Math.abs(v.currentTime - t);
        if (off > 0.25 && (!d || off < d - 0.25)) v.currentTime = t;
        if (tcRef.current) {
          const fr = Math.floor((t % 1) * FPS);
          tcRef.current.textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(fr)}`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, filmRef, x, y]);

  const show = ready && !over;
  const corner = "absolute block h-3 w-3 border-white";

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-30"
      style={{ x: sx, y: sy, width: fw, height: fh }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.92 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <div className="absolute inset-0 overflow-hidden bg-black outline outline-1 outline-white/25">
        <motion.video
          ref={vidRef}
          src={FILM.src}
          poster={FILM.poster || undefined}
          muted
          loop
          autoPlay={!reduce}
          playsInline
          preload="auto"
          disablePictureInPicture
          className="absolute left-0 top-0 max-w-none object-cover"
          style={{ x: nx, y: ny, width: sw, height: sh, filter: FILM_GRADE }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
      </div>

      <span className={`${corner} -left-1 -top-1 border-l-2 border-t-2`} />
      <span className={`${corner} -right-1 -top-1 border-r-2 border-t-2`} />
      <span className={`${corner} -bottom-1 -left-1 border-b-2 border-l-2`} />
      <span className={`${corner} -bottom-1 -right-1 border-b-2 border-r-2`} />

      <span className="absolute left-1/2 top-1/2 block h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-white/70" />
      <span className="absolute left-1/2 top-1/2 block h-px w-2.5 -translate-x-1/2 -translate-y-1/2 bg-white/70" />

      <span className="absolute left-2.5 top-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase leading-none tracking-[0.2em] text-white">
        <span className="hx-rec block h-1.5 w-1.5 rounded-full" style={{ background: REC }} />
        Rec
      </span>
      <span
        ref={tcRef}
        className="absolute bottom-2 right-2.5 text-[9px] font-medium leading-none tabular-nums tracking-[0.08em] text-white"
      >
        00:00:00:00
      </span>
    </motion.div>
  );
}

// ===========================================================================
// FLOATING NAV — one small smoked-glass bar. A cobalt highlight slides under
// whichever link you point at; the page you are on keeps a cobalt dot.
// ===========================================================================
function FloatingNav({ reduce }: { reduce: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const i = NAV.findIndex((n) => path === n.href || path.startsWith(n.href + "/"));
    setCurrent(i >= 0 ? i : null);
  }, []);

  return (
    <nav
      aria-label="Main"
      className="flex items-center gap-1 border border-white/10 bg-black/35 p-1 backdrop-blur-md"
      style={{ WebkitBackdropFilter: "blur(12px)" }}
      onMouseLeave={() => setHover(null)}
    >
      <a href="/" aria-label={`${WORDMARK}, home`} className="mr-1 flex h-8 items-center px-2.5 sm:mr-2" style={{ background: COBALT }}>
        <span className="text-[11px] leading-none text-black" style={{ ...WIDE, fontWeight: 900, letterSpacing: "-0.03em" }}>
          {WORDMARK}
        </span>
      </a>

      <LayoutGroup id="hx-nav">
        {NAV.map((n, i) => {
          const on = hover === i;
          return (
            <a
              key={n.label}
              href={n.href}
              aria-current={current === i ? "page" : undefined}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="relative flex h-8 items-center px-2.5 outline-none sm:px-4"
            >
              {on ? (
                <motion.span
                  layoutId="hx-nav-hl"
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: COBALT }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                />
              ) : null}
              <span
                className={`relative text-[10px] font-semibold uppercase leading-none tracking-[0.2em] transition-colors duration-200 sm:text-[11px] ${
                  on ? "text-white" : "text-white/75"
                }`}
              >
                {n.label}
              </span>
              {current === i && !on ? (
                <span aria-hidden className="absolute bottom-1 left-1/2 block h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: COBALT }} />
              ) : null}
            </a>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}

// ===========================================================================
// CLIENT STRIP — a credits bar. Hairlines above and below, a fixed label,
// and the clients drifting slowly past, fading out at both ends. Hover
// pauses the reel of names and lifts the one you point at to full white.
// ===========================================================================
function ClientStrip() {
  const row = [...CLIENTS, ...CLIENTS];
  const fadeMask = "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)";

  return (
    <div className="hx-strip flex items-stretch border-y border-white/10">
      <p className="hidden shrink-0 items-center gap-3 border-r border-white/10 pr-6 text-[10px] font-semibold uppercase leading-none tracking-[0.22em] text-white/75 sm:flex sm:text-[11px]">
        <span className="block h-1.5 w-1.5" style={{ background: COBALT }} />
        Selected clients
      </p>

      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}
      >
        <ul className="hx-marquee flex w-max items-center">
          {[0, 1].map((copy) =>
            row.map((c, i) => (
              <li
                key={`${copy}-${i}`}
                aria-hidden={copy === 1 || i >= CLIENTS.length ? true : undefined}
                className="group flex items-center"
              >
                <span className="flex h-14 items-center px-7 sm:h-16 sm:px-10">
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.logo}
                      alt={c.name}
                      className="h-5 w-auto opacity-55 transition-opacity duration-500 group-hover:opacity-100 sm:h-6"
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                  ) : (
                    <span
                      className="whitespace-nowrap text-[12px] uppercase leading-none text-white/55 transition-colors duration-500 group-hover:text-white sm:text-[14px]"
                      style={{ ...WIDE, fontWeight: 700, letterSpacing: "0.02em" }}
                    >
                      {c.name}
                    </span>
                  )}
                </span>
                <span aria-hidden className="block h-2.5 w-px" style={{ background: LINE }} />
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

// ===========================================================================
// SHOWREEL — full screen, with sound and controls
// ===========================================================================
function Showreel({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Showreel"
          className="fixed inset-0 z-[60] flex flex-col bg-black"
          initial={{ clipPath: "inset(0% 100% 0% 0%)" }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
          exit={{ clipPath: "inset(0% 0% 0% 100%)" }}
          transition={{ duration: 0.8, ease: EASE_CINE }}
          onClick={onClose}
        >
          <div className="flex items-center justify-between px-5 pt-6 sm:px-10 sm:pt-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
              {WORDMARK} <span style={{ color: COBALT }}>Showreel</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:text-[#2340FF]"
            >
              Close
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4 sm:p-10">
            <video
              src={REEL.src}
              controls
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                v.play().catch(() => {
                  v.muted = true;
                  v.play().catch(() => {});
                });
              }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full w-full max-w-[min(100%,160vh)] bg-black"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}