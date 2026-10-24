"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import RoomSwitch from "../hero4/room-switch";
import { Band, rootClass } from "./_shared/chrome";
import { BEYOND_CATEGORIES, BEYOND_FILMS } from "./_shared/data";

// What Beyond's variants (/beyond1–3) share: the band over a black page, the categories with their
// films, and the wheel and the arrow keys as steps.

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const CATS = BEYOND_CATEGORIES.map((c, i) => ({ ...c, i, films: BEYOND_FILMS.filter((f) => f.cat === i) }));

export function BeyondShell({ className, onBack, children }: { className?: string; onBack?: () => void; children: ReactNode }) {
  const router = useRouter();
  return (
    <main className={`${rootClass} ${className ?? ""}`}>
      <Band
        crumb="Index"
        workHref="/work?format=beyond"
        onBack={onBack}
        center={<RoomSwitch room="beyond" onSwitch={(k) => router.push(`/work?format=${k}`)} tone="light" />}
      />
      {children}
    </main>
  );
}

/** The wheel and the arrow keys, as steps: a turn of the wheel is one step, however long a
 *  trackpad's glide runs on. Off while `on` is false. */
export function useSteps(on: boolean, step: (d: 1 | -1) => void) {
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  useEffect(() => {
    if (!on) return;
    let last = 0;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 4) return;
      e.preventDefault();
      const now = performance.now();
      const quiet = now - last > 240;
      last = now;
      if (quiet) stepRef.current(d > 0 ? 1 : -1);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") stepRef.current(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") stepRef.current(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
    };
  }, [on]);
}
