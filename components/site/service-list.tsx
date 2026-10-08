"use client";

import { useRef, useState } from "react";
import { posterFor } from "@/app/hero7/wall-playback";
import type { Service } from "./content";
import { SiteLink } from "./transition";
import sx from "./sections.module.css";

// ===========================================================================
// SERVICES, AT A GLANCE — four rows. Point at one and it opens a little: its
// line comes up and a preview plays beside it, in a wide frame, or a tall one
// for social, the "& Beyond" of the name.
// ===========================================================================
export default function ServiceList({ services }: { services: Service[] }) {
  const [on, setOn] = useState<number | null>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  const enter = (i: number) => {
    setOn(i);
    videos.current.forEach((v, j) => {
      if (!v) return;
      if (j === i) v.play().catch(() => {});
      else v.pause();
    });
  };
  const leave = () => {
    setOn(null);
    videos.current.forEach((v) => v?.pause());
  };

  return (
    <ul className={sx.svcList} onPointerLeave={leave}>
      {services.map((s, i) => (
        <li key={s.slug} className={sx.svcItem} data-on={on === i} data-dim={on !== null && on !== i}>
          <SiteLink
            href={`/services#${s.slug}`}
            className={sx.svcRow}
            onPointerEnter={(e) => e.pointerType === "mouse" && enter(i)}
            onFocus={() => enter(i)}
            onBlur={leave}
          >
            <span className={sx.svcNo}>{s.no}</span>
            <span className={sx.svcTitle}>{s.title}</span>
            {/* the preview's own slot, between the title and the line */}
            <span className={sx.svcSlot} aria-hidden="true">
              <span className={`${sx.svcPreview} ${s.frame === "tall" ? sx.svcPreviewTall : ""}`}>
                <video
                  ref={(el) => {
                    videos.current[i] = el;
                  }}
                  src={s.clip}
                  poster={posterFor(s.clip)}
                  muted
                  loop
                  playsInline
                  preload="none"
                />
              </span>
            </span>
            <span className={sx.svcLine}>{s.line}</span>
            <span className={sx.svcArrow} aria-hidden="true">
              ↗
            </span>
          </SiteLink>
        </li>
      ))}
    </ul>
  );
}
