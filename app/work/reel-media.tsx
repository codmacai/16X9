"use client";

import { useEffect, useRef, useState } from "react";
import { reelEmbed, stillFor, type Reel } from "./_shared/data";
import styles from "./reel-media.module.css";

// A reel's picture in a 9:16 box. A video we host shows its still (and plays while pointed at, if
// `live`); a reel on Instagram is Instagram's own embed, drawn at its natural width (326px), scaled
// to the box and cropped to the film (its header and footer are cut off). Clicks pass through.
const IG = { w: 326, head: 54, media: 580 };

export default function ReelMedia({ reel, live = false, play = false }: { reel: Reel; live?: boolean; play?: boolean }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [k, setK] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !reel.ig) return;
    const ro = new ResizeObserver(() => setK(el.clientWidth / IG.w));
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
        {k > 0 && (
          <iframe
            className={styles.ig}
            src={reelEmbed(reel.ig)}
            title="Instagram reel"
            loading="lazy"
            scrolling="no"
            allow="autoplay; encrypted-media"
            style={{ width: IG.w, height: IG.head + IG.media + 260, transform: `translateY(${-IG.head * k}px) scale(${k})` }}
          />
        )}
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
