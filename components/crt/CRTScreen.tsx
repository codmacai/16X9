"use client";

import {
  CSSProperties,
  ReactNode,
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

function barrelScale(k: number) {
  return k / (1 + k);
}

function buildBarrelMap(k: number, size = 512): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(size, size);
  const range = barrelScale(k);
  for (let j = 0; j < size; j++) {
    const y = ((j + 0.5) / size) * 2 - 1;
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size) * 2 - 1;
      const f = (k * (x * x + y * y - 1)) / (1 + k);
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

function supportsHtmlSvgFilters(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const webkitOnly =
    /AppleWebKit/.test(ua) && !/(Chrome|Chromium|Edg|OPR)\//.test(ua);
  return !webkitOnly;
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

  useEffect(() => {
    setFiltersOk(supportsHtmlSvgFilters());
  }, []);

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

      <div className={styles.phosphor} style={{ filter }}>
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

      {backdrop && <div className={styles.foreground}>{children}</div>}

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
  );
}
