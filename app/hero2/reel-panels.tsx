"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { WallSurface } from "./beyond-panel";
import { screenAt } from "./framed-screen";
import styles from "./hero2.module.css";

// hero 9's 9x16: a row of reels, each its own panel in the wall. The room is the Beyond tile's —
// the same near-black matte tiles and fine seams (WallSurface) — but here its tiles are tall, 9:16,
// and across the middle row every one is a screen: a reel on each, its account's mark small at its
// foot, the wall's own seams between them; the rows above and below dark. The row sits in the
// middle, as tall as 16x9's screen, the wall above it and below it the same. The panels come on
// from a line across each, out from the middle; every reel rests low, and one at a time takes the
// light.

const LIT_MS = 2400;
const ACCOUNTS = ["/work/accounts/ded_cafe.webp", "/work/accounts/amerlounge.webp", "/work/accounts/businesslounge.webp", "/work/accounts/businessavenue.webp"];
const stillOf = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/stills/$1.webp");

/** the panels' size and the row's place — as the CSS sets it (.rp): as tall as 16x9's screen, so
    the wall above and below is the same moving between them */
export function reelPanelAt(w: number, h: number) {
  const { ph } = screenAt(w, h);
  return { cx: w / 2, cy: h / 2, pw: (ph * 9) / 16, ph };
}

const sub = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

/** iOS plays a film on its own only when it's muted as an attribute, not just the property */
const startMuted = (v: HTMLVideoElement | null) => {
  if (!v) return;
  v.muted = true;
  v.setAttribute("muted", "");
  v.play().catch(() => {});
};

export default function ReelPanels({ on, pool, turn, reduce }: { on: boolean; pool: string[]; turn: number; reduce: boolean }) {
  // as many panels either side of the middle one as it takes to reach the screen's edges
  const side = useSyncExternalStore(
    sub,
    () => {
      const { pw } = reelPanelAt(window.innerWidth, window.innerHeight);
      return Math.ceil((window.innerWidth / 2 - pw / 2) / pw);
    },
    () => 2
  );
  const ks = Array.from({ length: side * 2 + 1 }, (_, i) => i - side);

  // one at a time takes the light, out from the middle and back
  const [lit, setLit] = useState<number | null>(null);
  useEffect(() => {
    if (!on || reduce) return;
    const order = ks.slice().sort((a, b) => ((a * 37 + 11) % 7) - ((b * 37 + 11) % 7));
    let i = 0;
    const t = window.setTimeout(() => setLit(order[0]), 900);
    const id = window.setInterval(() => setLit(order[(i = (i + 1) % order.length)]), LIT_MS);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
      setLit(null);
    };
  }, [on, reduce, side]); // eslint-disable-line react-hooks/exhaustive-deps -- ks follows side

  return (
    <div className={`${styles.wall} ${on ? styles.rpOn : ""}`} aria-hidden="true">
      <WallSurface at={reelPanelAt} />
      {ks.map((k) => {
        const src = pool[(((k + side) * 7 + 2 + turn) % pool.length + pool.length) % pool.length];
        return (
          <span
            key={k}
            className={`${styles.rp} ${lit === k ? styles.lit : ""}`}
            style={{ "--k": k, "--open": `${(Math.abs(k) * 0.08).toFixed(2)}s` } as React.CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stillOf(src)} alt="" draggable={false} />
            {on && <video ref={startMuted} src={src} muted autoPlay loop playsInline preload="auto" disablePictureInPicture />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.rpMark} src={ACCOUNTS[(k + side) % ACCOUNTS.length]} alt="" draggable={false} />
            <i className={styles.tvGlass} />
          </span>
        );
      })}
    </div>
  );
}
