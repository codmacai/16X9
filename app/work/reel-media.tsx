"use client";

import { useEffect, useRef, useState } from "react";
import { reelEmbed, stillFor, type Reel } from "./_shared/data";
import styles from "./reel-media.module.css";

// A reel's picture in a 9:16 box. A video we host shows its still (and plays while pointed at, if
// `live`); a reel on Instagram is Instagram's own embed, drawn at its natural width (326px), scaled
// to the box and cropped to the film (its header and footer are cut off). Clicks pass through.
// The embed draws the film at its own shape (h / w: 1.25 for most reels, set `ar` on a reel that differs).
const IG = { w: 326, head: 54, foot: 140 };

export default function ReelMedia({ reel, live = false, play = false, interactive = false }: { reel: Reel; live?: boolean; play?: boolean; interactive?: boolean }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !reel.ig) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [reel.ig]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (play) v.play().catch(() => {});
    else v.pause();
  }, [play]);

  if (reel.ig)
    return (
      <span ref={boxRef} className={styles.box}>
        {box.w > 0 && (() => {
          // scaled so the film covers the box, centred; the header, the footer and the edges are cut off
          const mh = IG.w * (reel.ar ?? 1.25);
          const k = Math.max(box.w / IG.w, box.h / mh) * 1.02;
          const x = (box.w - IG.w * k) / 2;
          const y = -IG.head * k + (box.h - mh * k) / 2;
          return (
            <iframe
              className={styles.ig}
              src={reelEmbed(reel.ig!)}
              title="Instagram reel"
              loading="lazy"
              scrolling="no"
              allow="autoplay; encrypted-media"
              style={{ width: IG.w, height: IG.head + mh + IG.foot, transform: `translate(${x}px, ${y}px) scale(${k})`, pointerEvents: interactive ? "auto" : "none" }}
            />
          );
        })()}
      </span>
    );
  return (
    <span ref={boxRef} className={styles.box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.still} src={stillFor(reel.src ?? "")} alt="" draggable={false} loading="lazy" />
      {live && <video ref={videoRef} className={`${styles.still} ${play ? styles.on : styles.off}`} src={reel.src} muted loop playsInline preload="none" />}
    </span>
  );
}
