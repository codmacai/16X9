"use client";

import { useEffect } from "react";

// The page's wheel, eased. On a mouse or a trackpad, a turn of the wheel sets
// where the page is heading and the page glides there, a little more each
// frame, instead of jumping by the notch. Touch screens keep their own
// momentum, which is smooth already. Keys, the scrollbar and links scroll as
// they always do; the glide picks up from wherever they leave the page.
// Anything inside the page that scrolls on its own keeps its own wheel, and
// so does pinch-zoom. Off while `on` is false (an overlay is open).

const TAU = 120; // ms: how quickly the page closes on where it's heading

/** whether something under the pointer, short of the page, can scroll this way itself */
function scrollsItself(from: EventTarget | null, dy: number) {
  for (let el = from instanceof Element ? from : null; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY !== "auto" && overflowY !== "scroll") continue;
    if (el.scrollHeight <= el.clientHeight) continue;
    if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
  }
  return false;
}

export function useSmoothWheel(on: boolean) {
  useEffect(() => {
    if (!on) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const page = document.scrollingElement ?? document.documentElement;
    let target = window.scrollY;
    let y = target;
    let raf = 0;
    let last = 0;

    const step = (t: number) => {
      const dt = last ? Math.min(64, t - last) : 16;
      last = t;
      y += (target - y) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(target - y) < 0.5) {
        y = target;
        raf = 0;
        last = 0;
      } else raf = requestAnimationFrame(step);
      window.scrollTo(0, y);
    };

    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.defaultPrevented) return; // pinch-zoom, or someone else's
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // sideways: the page doesn't go that way
      if (scrollsItself(e.target, e.deltaY)) return;
      e.preventDefault();
      // still: start from where the page is now (a key or the scrollbar may have moved it)
      if (!raf) target = y = window.scrollY;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = Math.max(0, Math.min(page.scrollHeight - window.innerHeight, target + e.deltaY * unit));
      if (!raf) raf = requestAnimationFrame(step);
    };

    window.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", wheel);
      cancelAnimationFrame(raf);
    };
  }, [on]);
}
