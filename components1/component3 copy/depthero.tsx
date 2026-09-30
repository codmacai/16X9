"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import { resolveVariant, type Clip, type HeroVariant } from "@/components/Hero-config";
import styles from "./depthhero.module.css";

// ===========================================================================
// COPY
// ===========================================================================
const LEFT_LINE = "Bringing Brands to Life";
const RIGHT_LINES = ["Turn target audience", "into your viewers"];

// ===========================================================================
// SEQUENCE, in seconds
// 1. The cobalt block wipes in on black and 16X9 rises, cut through it.
// 2. The lines settle in under the block.
// 3. The depth gallery arrives behind it at full speed and brakes to a
//    creep, filling the letters with film.
// 4. The client strip fades in.
// After that the wall surges forward every few seconds like a dolly push.
// ===========================================================================
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const T = {
  block: 0.25, // cobalt block wipes in
  letters: 0.7, // 16X9 rises through it
  lines: 1.35, // left line and right lines
  wall: 2.0, // depth gallery arrives
  clients: 3.1, // logo strip
};

// Speeds are in screen-heights per second.
const CRAWL = 0.05;
const SURGE = { first: T.wall + 3.2, every: 5.4, length: 1.5, peak: 1.3 };
const ARRIVAL = { length: 2.4, peak: 2.4 };

const LANES_DESKTOP = 8;
const LANES_MOBILE = 4;
const TILES_PER_LANE = 9;
const RATIOS = ["3 / 4", "16 / 10", "4 / 5", "1 / 1", "2 / 3", "16 / 9", "5 / 6"];

// The mark
const COBALT = "#2340FF";
const FONT = "var(--font-sans, 'Archivo'), 'Helvetica Neue', Arial, sans-serif";
const WIDE = { fontFamily: FONT, fontVariationSettings: "'wdth' 125" } as const;
const PAD_X = 4.5; // block geometry, in % of the block's width (cqw)
const PAD_TOP = 3.4;
const PAD_BOTTOM = 3.8;
const CAP = 0.715; // Archivo cap height, as a fraction of the font size
const TRACK = -0.045; // letter spacing, in em

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const surgeAt = (t: number) => {
  if (t < SURGE.first) return 0;
  const c = (t - SURGE.first) % SURGE.every;
  if (c > SURGE.length) return 0;
  const s = Math.sin((Math.PI * c) / SURGE.length);
  return s * s;
};

/** Full speed until the wall appears, then brakes to a creep. */
const arrivalAt = (t: number) => {
  const r = t - T.wall;
  if (r < 0) return 1;
  if (r > ARRIVAL.length) return 0;
  const k = 1 - r / ARRIVAL.length;
  return k * k * k;
};

// ===========================================================================
// TILE — just the film. Loads when it comes on screen, pauses when it leaves.
// ===========================================================================
function Tile({ clip, ratio, reduce }: { clip: Clip; ratio: string; reduce: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || failed) return;
    v.muted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!v.getAttribute("src")) v.src = clip.src;
          if (!reduce) v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { rootMargin: "-6% 0px 0px 0px" }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [clip.src, reduce, failed]);

  return (
    <div className={styles.tile} style={{ aspectRatio: ratio }}>
      {!failed && (
        <video
          ref={ref}
          className={styles.tileVideo}
          muted
          loop
          playsInline
          preload={reduce ? "metadata" : "none"}
          disablePictureInPicture
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// THE MARK — a cobalt block with 16X9 and © cut clean through it.
// It has no footage of its own: the wall behind shows through the letters.
// ===========================================================================
type Box = { w: number; h: number; pl: number; pr: number; pt: number; pb: number };

function Mark({ mark, reduce }: { mark: string; reduce: boolean }) {
  const maskId = `dh-cut-${useId().replace(/:/g, "")}`;
  const blockRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  // Fit the letters to 90% of the block's inner width; re-fit on resize and font load.
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
        setBox({ w, h: pt + pb + fs * CAP, pl, pr, pt, pb });
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
      <motion.div
        ref={blockRef}
        className={styles.wmBlock}
        style={{ padding: `${PAD_TOP}cqw ${PAD_X}cqw ${PAD_BOTTOM}cqw` }}
        initial={reduce ? false : { clipPath: "inset(0% 100% 0% 0%)" }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
        transition={{ duration: 1.1, ease: EASE_CINE, delay: T.block }}
      >
        <span
          ref={probeRef}
          aria-hidden
          className={styles.wmProbe}
          style={{ ...WIDE, fontWeight: 900, fontSize: 100, letterSpacing: `${TRACK}em` }}
        >
          {mark}
        </span>

        <span aria-hidden className={styles.wmSpacer} style={{ height: fontSize ? fontSize * CAP : "12cqw" }} />

        {box && fontSize ? (
          <svg aria-hidden className={styles.wmCut} viewBox={`0 0 ${box.w} ${box.h}`} preserveAspectRatio="none">
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={box.w} height={box.h}>
                <rect width={box.w} height={box.h} fill="#fff" />
                <motion.g
                  initial={reduce ? false : { y: box.h }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1.2, ease: EASE, delay: T.letters }}
                >
                  <text
                    x={box.pl}
                    y={box.pt + fontSize * CAP}
                    fill="#000"
                    style={{ ...WIDE, fontWeight: 900, fontSize, letterSpacing: `${TRACK}em` }}
                  >
                    {mark}
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

      {/* Under the block: the line on the left, two lines on the right */}
      <div className={styles.wmUnder}>
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
      </div>
    </div>
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

  const [laneCount, setLaneCount] = useState(LANES_DESKTOP);
  const sceneRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const sync = () => setLaneCount(mq.matches ? LANES_MOBILE : LANES_DESKTOP);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const lanes = useMemo(
    () =>
      Array.from({ length: laneCount }, (_, l) => ({
        speed: 0.86 + ((l * 5) % 7) * 0.05,
        items: Array.from({ length: TILES_PER_LANE }, (_, t) => ({
          clip: clips[(l * 3 + t * 7) % clips.length],
          ratio: RATIOS[(l * 2 + t) % RATIOS.length],
        })),
      })),
    [laneCount, clips]
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
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const vh = window.innerHeight;
      for (let l = 0; l < n; l++) {
        const h = heights[l];
        if (!h) continue;
        const lag = Math.abs(l - (n - 1) / 2) * 0.09; // centre lanes push first
        const surge = variant.swap ? surgeAt(t - lag) * SURGE.peak : 0;
        const v = (CRAWL + surge + arrivalAt(t - lag) * ARRIVAL.peak) * vh * lanes[l].speed;
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
    <section className={styles.page} aria-label={mark}>
      {/* ================= The depth gallery (arrives after the mark) ================= */}
      <motion.div
        ref={sceneRef}
        className={styles.scene}
        aria-hidden="true"
        {...enter(T.wall, { opacity: 0, scale: 1.14 }, { opacity: 1, scale: 1 }, 2.2)}
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
                    <Tile key={`${copy}-${t}`} clip={it.clip} ratio={it.ratio} reduce={reduce} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className={styles.fog} aria-hidden="true" />
      <div className={styles.spot} aria-hidden="true" />
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.grainWrap} aria-hidden="true">
        <div className={styles.grain} style={{ backgroundImage: GRAIN }} />
      </div>

      {/* ================= Middle: the 16X9 mark ================= */}
      <div className={styles.copy}>
        <h1 className={styles.sr}>
          {mark}. {LEFT_LINE}. {RIGHT_LINES.join(" ")}.
        </h1>
        <Mark mark={mark} reduce={reduce} />
      </div>

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
    </section>
  );
}