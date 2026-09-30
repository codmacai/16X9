"use client";

import {
  CSSProperties,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import styles from "./CRTScreen.module.css";

export type CRTScreenProps = {
  /** Foreground content. When a backdrop is set, this sits above the scanlines, unbent, so text stays crisp. */
  children?: ReactNode;
  /** Optional background layer (colour field, image, video). It bends with the tube and gets the scanlines. */
  backdrop?: ReactNode;
  /** Barrel distortion strength. 0 = flat glass, 0.06–0.14 = believable tube. */
  curvature?: number;
  /** Distance between scanlines in px (one dark band + one gap). */
  scanlineSize?: number;
  /** 0–1. How dark the horizontal bands are. */
  scanlineOpacity?: number;
  /** Colour of the bands. Black is classic; a deep brand tone reads as "tinted phosphor". */
  scanlineColor?: string;
  /** 0–1. Darkening towards the corners of the tube. */
  vignette?: number;
  /** Red/blue channel split in px at the edges of the glyphs. 0 disables. */
  aberration?: number;
  /** 0–1. Vertical RGB phosphor stripes. Subtle is best. */
  phosphor?: number;
  /** 0–1. Film-grain noise on the glass. */
  grain?: number;
  /** Slow bright band that rolls down the tube, like a camera filming a monitor. */
  rollingBar?: boolean;
  /** Barely-there brightness flicker. */
  flicker?: boolean;
  /** Soft reflection on the glass. */
  glare?: boolean;
  /** CSS border-radius of the tube. Two values make the classic pillow shape. */
  radius?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Builds a displacement map for an SVG <feDisplacementMap>.
 * Each output pixel u samples the source at u * (1 + k * r²) / (1 + k), the same
 * maths a CRT fragment shader uses. Dividing by (1 + k) pins the middle of each
 * edge to the frame, so the picture fills the tube and only the corners fall away.
 * R encodes the x offset, G the y offset, normalised to the full 0–255 range so
 * the curve stays smooth with no stepping.
 */
function barrelScale(k: number) {
  return k / (1 + k);
}

function buildBarrelMap(k: number, size = 512): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(size, size);
  const range = barrelScale(k); // must match the filter's `scale`
  for (let j = 0; j < size; j++) {
    const y = ((j + 0.5) / size) * 2 - 1;
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size) * 2 - 1;
      const f = (k * (x * x + y * y - 1)) / (1 + k);
      // offsets in bounding-box units (the -1..1 space is 2 units wide, hence / 2)
      const dx = (x * f) / 2;
      const dy = (y * f) / 2;
      const p = (j * size + i) * 4;
      img.data[p] = Math.round((0.5 + dx / range) * 255);
      img.data[p + 1] = Math.round((0.5 + dy / range) * 255);
      img.data[p + 2] = 128;
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/** WebKit (Safari, and every browser on iOS) can't reliably run SVG filters on HTML. */
function supportsHtmlSvgFilters(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const webkitOnly =
    /AppleWebKit/.test(ua) && !/(Chrome|Chromium|Edg|OPR)\//.test(ua);
  return !webkitOnly;
}

/* ---------- curved-glass fallback for Safari / iOS ----------
   WebKit can't bend HTML with SVG filters, so there we fake the tube:
   the picture is masked to the exact outline the real distortion produces,
   and grid lines are drawn along the same curves. Same maths as the map above. */

type Mode = "pending" | "filter" | "fallback";

const CRTContext = createContext<{ mode: Mode; curvature: number }>({
  mode: "pending",
  curvature: 0,
});

/** Tells content inside the screen whether the real bend or the fallback is active. */
export function useCRT() {
  return useContext(CRTContext);
}

/** Screen position (-1..1) that shows source position `a`, along one axis. */
function solveAxis(a: number, other: number, k: number) {
  let u = a;
  for (let n = 0; n < 12; n++) {
    const g = (1 + k * (u * u + other * other)) / (1 + k);
    const f = u * g - a;
    const df = g + (2 * k * u * u) / (1 + k);
    u -= f / df;
  }
  return u;
}

const toPct = (v: number) => ((v + 1) * 50).toFixed(3);

/** Outline of the bent picture, as an SVG path in a 0..100 box. */
function tubeOutline(k: number, steps = 160) {
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const dx = Math.cos(t);
    const dy = Math.sin(t);
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    const target = (1 + k) / m; // solve rho * (1 + k rho^2) = target
    let rho = 1;
    for (let n = 0; n < 12; n++) {
      rho -= (rho + k * rho ** 3 - target) / (1 + 3 * k * rho * rho);
    }
    const x = Math.max(-1, Math.min(1, rho * dx));
    const y = Math.max(-1, Math.min(1, rho * dy));
    pts.push(`${toPct(x)} ${toPct(y)}`);
  }
  return `M${pts.join("L")}Z`;
}

/**
 * Grid lines that follow the tube's curve. Only drawn in the Safari/iOS
 * fallback; with the real filter the grid bends on its own.
 */
export function CurvedGrid({
  cols,
  rows,
  width = 5,
  color = "#070001",
}: {
  cols: number;
  rows: number;
  width?: number;
  color?: string;
}) {
  const { mode, curvature: k } = useCRT();
  const d = useMemo(() => {
    const lines: string[] = [];
    const samples = 40;
    const line = (a: number, vertical: boolean) => {
      const pts: string[] = [];
      for (let j = 0; j <= samples; j++) {
        const o = (j / samples) * 2 - 1;
        const u = solveAxis(a, o, k);
        pts.push(vertical ? `${toPct(u)} ${toPct(o)}` : `${toPct(o)} ${toPct(u)}`);
      }
      lines.push(`M${pts.join("L")}`);
    };
    for (let i = 1; i < cols; i++) line((i / cols) * 2 - 1, true);
    for (let i = 1; i < rows; i++) line((i / rows) * 2 - 1, false);
    return lines.join(" ");
  }, [cols, rows, k]);

  if (mode !== "fallback") return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <path d={d} fill="none" stroke={color} strokeWidth={width} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function CRTScreen({
  children,
  backdrop,
  curvature = 0.1,
  scanlineSize = 3,
  scanlineOpacity = 0.32,
  scanlineColor = "#000000",
  vignette = 0.7,
  aberration = 0,
  phosphor = 0.2,
  grain = 0.08,
  rollingBar = true,
  flicker = true,
  glare = true,
  radius = "3% / 5%",
  className,
  style,
}: CRTScreenProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const barrelId = `crt-barrel-${id}`;
  const rgbId = `crt-rgb-${id}`;

  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [filtersOk, setFiltersOk] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setFiltersOk(supportsHtmlSvgFilters());
    setChecked(true);
  }, []);

  const mode: Mode = !checked || curvature <= 0 ? "pending" : filtersOk ? "filter" : "fallback";

  // Safari / iOS: clip the picture to the curved outline instead of bending it.
  const outlineMask = useMemo(() => {
    if (mode !== "fallback") return undefined;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${tubeOutline(curvature)}' fill='black'/></svg>`;
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    return {
      WebkitMaskImage: url,
      maskImage: url,
      WebkitMaskSize: "100% 100%",
      maskSize: "100% 100%",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
    } as CSSProperties;
  }, [mode, curvature]);

  useEffect(() => {
    if (!filtersOk || curvature <= 0) {
      setMapUrl(null);
      return;
    }
    setMapUrl(buildBarrelMap(curvature));
  }, [curvature, filtersOk]);

  const filter = useMemo(() => {
    if (!filtersOk) return undefined;
    const parts: string[] = [];
    if (mapUrl) parts.push(`url(#${barrelId})`);
    if (aberration > 0) parts.push(`url(#${rgbId})`);
    return parts.length ? parts.join(" ") : undefined;
  }, [filtersOk, mapUrl, aberration, barrelId, rgbId]);

  const vars = {
    "--crt-radius": radius,
    "--crt-scan-size": `${scanlineSize}px`,
    "--crt-scan-opacity": scanlineOpacity,
    "--crt-scan-color": scanlineColor,
    "--crt-vignette": vignette,
    "--crt-phosphor": phosphor,
    "--crt-grain": grain,
  } as CSSProperties;

  return (
    <CRTContext.Provider value={{ mode, curvature }}>
    <div
      className={[styles.tube, className].filter(Boolean).join(" ")}
      style={{ ...vars, ...style }}
    >
      <svg className={styles.defs} aria-hidden="true" focusable="false">
        <defs>
          {mapUrl && (
            <filter
              id={barrelId}
              x="0"
              y="0"
              width="1"
              height="1"
              filterUnits="objectBoundingBox"
              primitiveUnits="objectBoundingBox"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={mapUrl}
                x="0"
                y="0"
                width="1"
                height="1"
                preserveAspectRatio="none"
                result="map"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={barrelScale(curvature)}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          )}
          {aberration > 0 && (
            <filter
              id={rgbId}
              x="0"
              y="0"
              width="1"
              height="1"
              colorInterpolationFilters="sRGB"
            >
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                result="r"
              />
              <feOffset in="r" dx={-aberration} dy="0" result="rShift" />
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
                result="g"
              />
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
                result="b"
              />
              <feOffset in="b" dx={aberration} dy="0" result="bShift" />
              <feBlend in="rShift" in2="g" mode="screen" result="rg" />
              <feBlend in="rg" in2="bShift" mode="screen" />
            </filter>
          )}
        </defs>
      </svg>

      {/* Phosphor layer: backdrop, scanlines and content. Everything here bends with the glass. */}
      <div className={styles.phosphor} style={{ filter, ...outlineMask }}>
        {backdrop ? (
          <>
            <div className={styles.content}>{backdrop}</div>
            <div className={styles.scanlines} aria-hidden="true" />
            {phosphor > 0 && <div className={styles.mask} aria-hidden="true" />}
          </>
        ) : (
          <>
            <div className={styles.content}>{children}</div>
            <div className={styles.scanlines} aria-hidden="true" />
            {phosphor > 0 && <div className={styles.mask} aria-hidden="true" />}
          </>
        )}
      </div>

      {/* With a backdrop, content sits on its own flat layer so text stays razor sharp. */}
      {backdrop && <div className={styles.foreground}>{children}</div>}

      {/* Glass layer: sits in front of the tube and doesn't distort. */}
      {rollingBar && <div className={styles.roll} aria-hidden="true" />}
      {flicker && <div className={styles.flicker} aria-hidden="true" />}
      {grain > 0 && (
        <div className={styles.grainWrap} aria-hidden="true">
          <div className={styles.grain} />
        </div>
      )}
      <div className={styles.vignette} aria-hidden="true" />
      {glare && <div className={styles.glare} aria-hidden="true" />}
      <div className={styles.edge} aria-hidden="true" />
    </div>
    </CRTContext.Provider>
  );
}
