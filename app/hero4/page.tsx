"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";

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

// Full-screen background film (short muted loop; H.264 yuv420p so Safari plays it)
const BG_VIDEO = { src: "/clips/clip-02.mp4", poster: "" };

// Showreel (opens full screen)
const REEL = { src: "/showreel.mp4", length: "01:32" };

// Clients strip. Replace with your real clients. Give an entry a `logo`
// (an SVG/PNG in /public) and it shows the logo in white; otherwise the name
// is set as a wordmark.
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
// COLOUR & TYPE — black, white, cobalt
// ===========================================================================
const COBALT = "#2340FF";
const LINE = "rgba(35, 64, 255, 0.55)";
const FONT = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
const WIDE = { fontFamily: FONT, fontVariationSettings: "'wdth' 125" } as const;
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

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
@media (prefers-reduced-motion: reduce) { .hx-grain, .hx-scroll, .hx-marquee { animation: none; } }
`;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// iOS/Safari autoplay needs real muted + playsinline attributes
const prepVideo = (v: HTMLVideoElement | null) => {
  if (!v) return;
  v.muted = true;
  v.defaultMuted = true;
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  v.play().catch(() => {});
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
type Box = { w: number; h: number; pl: number; pt: number; pb: number; pr: number };

export default function Hero16x9() {
  const reduce = !!useReducedMotion();
  const maskId = `hx-cut-${useId().replace(/:/g, "")}`;
  const blockRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [reelOpen, setReelOpen] = useState(false);

  // Fit the wordmark to the block and record the block's size in px, so the
  // letters can be cut out of it as a mask.
  useIsoLayoutEffect(() => {
    const block = blockRef.current;
    const probe = probeRef.current;
    if (!block || !probe) return;
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
        setFontSize(fs);
        setBox({ w, h: pt + pb + fs * CAP, pl, pt, pb, pr });
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(block);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, []);

  const fade = (delay: number, y = 0) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.2, ease: EASE, delay } };

  const small = "text-[10px] font-semibold uppercase leading-none tracking-[0.22em] sm:text-[11px]";

  return (
    <section
      aria-label={WORDMARK}
      className="relative h-screen w-full overflow-hidden bg-black text-white antialiased supports-[height:100svh]:h-[100svh]"
      style={{ fontFamily: FONT }}
    >
      <style>{CSS}</style>
      <h1 className="sr-only">
        {WORDMARK}. {LEFT_LINE}. {RIGHT_LINES.join(" ")}.
      </h1>

      <BackgroundVideo reduce={reduce} />

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
                the film behind shows inside the letters. */}
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
// BACKGROUND FILM — full bleed, muted, looping, graded down so the cobalt,
// the grid and the white type stay the loudest things on screen.
// ===========================================================================
function BackgroundVideo({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    prepVideo(v);
    const kick = () => v.play().catch(() => {});
    window.addEventListener("touchstart", kick, { once: true, passive: true });
    window.addEventListener("pointerdown", kick, { once: true });
    const onVis = () => (document.hidden ? v.pause() : v.play().catch(() => {}));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("touchstart", kick);
      window.removeEventListener("pointerdown", kick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <>
      <motion.video
        ref={ref}
        src={BG_VIDEO.src}
        poster={BG_VIDEO.poster || undefined}
        muted
        loop
        autoPlay={!reduce}
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ filter: "grayscale(0.35) contrast(1.08) brightness(0.9)" }}
        initial={reduce ? false : { opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2.4, ease: EASE, delay: 0.2 }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/50" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%), linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 22%, transparent 75%, rgba(0,0,0,0.7))",
        }}
      />
    </>
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