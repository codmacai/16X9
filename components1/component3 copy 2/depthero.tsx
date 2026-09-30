"use client";

import { CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
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
// 1. On black, the cobalt card wipes in from the left.
// 2. The 16|9 frame draws itself, cut clean through the card.
// 3. "16" rises inside the frame's corner and "9" just outside it, both cut
//    through the card; the © settles in the corner.
// 4. The lines settle in under the card.
// 5. The depth gallery arrives behind the card at full speed and brakes to a
//    creep: the film fills the frame line and the numerals.
// 6. The client strip fades in.
// After that the wall surges forward every few seconds like a dolly push.
// ===========================================================================
const EASE = [0.16, 1, 0.3, 1] as const;
const EASE_CINE = [0.76, 0, 0.24, 1] as const;

const T = {
  card: 0.25, // cobalt card wipes in
  frame: 0.85, // the frame draws itself through the card
  numerals: 1.45, // 16 and 9 rise through the card
  lines: 1.9, // left line and right lines
  wall: 2.5, // depth gallery arrives
  clients: 3.5, // logo strip
};
const FRAME_DRAW = 1.3; // seconds for the whole frame to draw

// Speeds are in screen-heights per second.
const CRAWL = 0.05;
const SURGE = { first: T.wall + 3.4, every: 6, length: 1.9, peak: 1.05 };
const ARRIVAL = { length: 3, peak: 1.9 };

const LANES_DESKTOP = 7;
const LANES_MOBILE = 4;
const TILES_DESKTOP = 7;
const TILES_MOBILE = 9;
const RATIOS = ["3 / 4", "16 / 10", "4 / 5", "1 / 1", "2 / 3", "16 / 9", "5 / 6"];

// ===========================================================================
// THE CARD — geometry in card units. The logo (frame + "16" inside + "9"
// outside) sits on a cobalt card with a margin all round, and is cut clean
// through it.
// ===========================================================================
const COBALT = "#2340FF";
const FONT = "var(--font-sans, 'Archivo'), 'Helvetica Neue', Arial, sans-serif";
const FRAME_W = 100;
const FRAME_H = 51; // the logo's frame is about 2 : 1 (56.25 would be exactly 16 : 9)
const STROKE = 3.2; // frame line thickness, as in the logo
const NUM_SIZE = 22; // numeral font size
const NUM_GAP = 1.4; // "16" to the frame's inner edge, and "9" to its outside
const LOGO_W = 116; // frame plus the "9" hanging outside it
const PAD_X = 7; // card margin, left and right
const PAD_TOP = 7;
const PAD_BOTTOM = 8;
const CARD_W = LOGO_W + PAD_X * 2;
const CARD_H = FRAME_H + PAD_TOP + PAD_BOTTOM;
const BASELINE = FRAME_H - STROKE - 0.6; // numerals sit on the inside of the bottom bar
/** The numerals in the logo's cut: a bold, normal-width grotesque. */
const NUM_TYPE = {
  fontFamily: FONT,
  fontWeight: 700,
  fontSize: NUM_SIZE,
  fontVariationSettings: "'wdth' 100",
  letterSpacing: "-0.03em",
} as const;

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

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
      { rootMargin: "-14% 0px -2% 0px" }
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
          onLoadedData={(e) => {
            e.currentTarget.dataset.ready = "true";
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// THE CARD — a cobalt card with the 16|9 logo cut clean through it. It has
// no footage of its own: the gallery behind shows through the frame line and
// the numerals.
// ===========================================================================
function LogoCard({ reduce }: { reduce: boolean }) {
  const uid = useId().replace(/:/g, "");
  const maskId = `dh-cut-${uid}`;
  const numId = `dh-num-${uid}`;
  const s = STROKE / 2;
  // the frame, one closed path drawn clockwise from the top-left corner
  const d = `M ${s} ${s} H ${FRAME_W - s} V ${FRAME_H - s} H ${s} Z`;

  const draw = reduce
    ? { initial: false as const }
    : {
        initial: { pathLength: 0 },
        animate: { pathLength: 1 },
        transition: { delay: T.frame, duration: FRAME_DRAW, ease: EASE_CINE },
      };

  const rise = (delay: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { y: NUM_SIZE },
          animate: { y: 0 },
          transition: { delay, duration: 1.2, ease: EASE },
        };

  return (
    <div className={styles.logo}>
      <motion.div
        className={styles.card}
        style={{ aspectRatio: `${CARD_W} / ${CARD_H}` } as CSSProperties}
        initial={reduce ? false : { clipPath: "inset(0% 100% 0% 0%)" }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
        transition={{ duration: 1.1, ease: EASE_CINE, delay: T.card }}
      >
        <svg aria-hidden className={styles.cardSvg} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
          <defs>
            {/* numerals rise from behind the frame's bottom bar */}
            <clipPath id={numId}>
              <rect x={-PAD_X} y={-PAD_TOP} width={CARD_W} height={PAD_TOP + BASELINE + 0.8} />
            </clipPath>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={CARD_W} height={CARD_H}>
              <rect width={CARD_W} height={CARD_H} fill="#fff" />
              <g transform={`translate(${PAD_X} ${PAD_TOP})`}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke="#000"
                  strokeWidth={STROKE}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  {...draw}
                />
                <g clipPath={`url(#${numId})`}>
                  <motion.text
                    x={FRAME_W - STROKE - NUM_GAP}
                    y={BASELINE}
                    textAnchor="end"
                    fill="#000"
                    style={NUM_TYPE}
                    {...rise(T.numerals)}
                  >
                    16
                  </motion.text>
                  <motion.text
                    x={FRAME_W + NUM_GAP}
                    y={BASELINE}
                    textAnchor="start"
                    fill="#000"
                    style={NUM_TYPE}
                    {...rise(T.numerals + 0.12)}
                  >
                    9
                  </motion.text>
                </g>
              </g>
              <motion.text
                x={CARD_W - PAD_X * 0.5}
                y={CARD_H - PAD_BOTTOM * 0.35}
                textAnchor="end"
                fill="#000"
                style={{ fontFamily: FONT, fontWeight: 700, fontSize: 2.6 }}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: T.numerals + 0.5, duration: 0.8, ease: EASE }}
              >
                ©
              </motion.text>
            </mask>
          </defs>
          <rect width={CARD_W} height={CARD_H} fill={COBALT} mask={`url(#${maskId})`} />
        </svg>
      </motion.div>

      {/* Under the card: one line left, two lines right */}
      <div className={styles.under}>
        <span className={styles.lineMask}>
          <motion.span
            className={styles.line}
            initial={reduce ? false : { y: "110%" }}
            animate={{ y: 0 }}
            transition={{ duration: 1.2, ease: EASE, delay: T.lines }}
          >
            {LEFT_LINE}
          </motion.span>
        </span>

        <p className={styles.right}>
          {RIGHT_LINES.map((l, i) => (
            <span key={l} className={styles.rightMask}>
              <motion.span
                className={styles.rightLine}
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
  const reduce = !!useReducedMotion();

  const [laneCount, setLaneCount] = useState(LANES_DESKTOP);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // phones and any portrait screen get fewer, longer lanes so the loop always covers the wall
    const mq = window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)");
    const sync = () => setLaneCount(mq.matches ? LANES_MOBILE : LANES_DESKTOP);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const lanes = useMemo(
    () =>
      Array.from({ length: laneCount }, (_, l) => ({
        speed: 0.86 + ((l * 5) % 7) * 0.05,
        items: Array.from({ length: laneCount === LANES_MOBILE ? TILES_MOBILE : TILES_DESKTOP }, (_, t) => ({
          clip: clips[(l * 3 + t * 7) % clips.length],
          ratio: RATIOS[(l * 2 + t) % RATIOS.length],
        })),
      })),
    [laneCount, clips]
  );

  // ---- the camera: one loop drives every lane and the pointer lean ----
  const planeRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const n = laneCount;
    const plane = planeRef.current;
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
    let running = true;
    const lean = { x: 0, y: 0 };
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;

      // ease toward the pointer
      const k = Math.min(1, dt * 2.2);
      lean.x += (pointer.current.x - lean.x) * k;
      lean.y += (pointer.current.y - lean.y) * k;
      if (plane) {
        plane.style.transform = `translate3d(${(-lean.x * 2.5).toFixed(3)}vw, 0, 0) rotateX(${(52 + lean.y * 2).toFixed(3)}deg)`;
      }

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
      if (running) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // pause the whole camera while the hero is scrolled out of view
    const section = plane?.closest("section");
    const io = section
      ? new IntersectionObserver(([e]) => {
          if (e.isIntersecting && !running) {
            running = true;
            last = performance.now();
            raf = requestAnimationFrame(step);
          } else if (!e.isIntersecting) {
            running = false;
            cancelAnimationFrame(raf);
          }
        })
      : null;
    if (section) io?.observe(section);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [laneCount, lanes, reduce, variant.swap]);

  // Record the pointer; the camera loop eases the lean toward it
  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce]);

  const enter = (delay: number, from: TargetAndTransition, to: TargetAndTransition, duration = 1.1) =>
    reduce
      ? { initial: false as const }
      : { initial: from, animate: { ...to, transition: { delay, duration, ease: EASE } } };

  return (
    <section className={styles.page} aria-label="16x9">
      {/* ================= The depth gallery (arrives after the card) ================= */}
      <motion.div
        className={styles.scene}
        aria-hidden="true"
        {...enter(T.wall, { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1 }, 2.6)}
      >
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
                    <Tile key={`${copy}-${t}`} clip={it.clip} ratio={it.ratio} reduce={reduce} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className={styles.dim} aria-hidden="true" />
      <div className={styles.fog} aria-hidden="true" />
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.grainWrap} aria-hidden="true">
        <div className={styles.grain} style={{ backgroundImage: GRAIN }} />
      </div>

      {/* ================= Middle: the cobalt card ================= */}
      <div className={styles.copy}>
        <h1 className={styles.sr}>
          16x9. {LEFT_LINE}. {RIGHT_LINES.join(" ")}.
        </h1>
        <LogoCard reduce={reduce} />
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