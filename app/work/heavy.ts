import { useEffect, type RefObject } from "react";

/**
 * Heavy scrolling for a scroll box: the wheel moves a target, and the page
 * eases after it every frame (a share of the distance left), so a flick
 * carries on and glides to rest like something with weight. Anything else
 * that moves the box (keys, a scrollTo, a snap) takes over, and the glide
 * picks up from wherever it left the page. Wheels already handled
 * (defaultPrevented) are left alone; touch keeps its own native momentum.
 */
export function useHeavyScroll(ref: RefObject<HTMLElement | null>, off: boolean, ease = 0.075) {
  useEffect(() => {
    const el = ref.current;
    if (!el || off) return;
    let target = el.scrollTop;
    let current = target;
    let raf = 0;

    const step = () => {
      if (Math.abs(el.scrollTop - current) > 1.5) {
        // something else moved the page: let it, and start again from there
        target = current = el.scrollTop;
        raf = 0;
        return;
      }
      current += (target - current) * ease;
      if (Math.abs(target - current) < 0.4) current = target;
      el.scrollTop = current;
      current = el.scrollTop; // clamped by the box
      raf = current === target || Math.abs(target - current) < 0.4 ? 0 : requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.defaultPrevented || e.ctrlKey) return;
      e.preventDefault();
      if (!raf) target = current = el.scrollTop;
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? el.clientHeight : 1;
      target = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, target + e.deltaY * unit));
      if (!raf) raf = requestAnimationFrame(step);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("wheel", onWheel);
    };
  }, [ref, off, ease]);
}

/**
 * The same weight for the page itself (window scroll): the wheel sets where
 * the page is going and it glides there. Pages built on window scroll (their
 * useScroll() reads window.scrollY) keep working: the glide is a real scroll.
 */
export function useHeavyWindowScroll(off: boolean, ease = 0.075) {
  useEffect(() => {
    if (off) return;
    const root = document.scrollingElement ?? document.documentElement;
    let target = root.scrollTop;
    let current = target;
    let raf = 0;
    const max = () => root.scrollHeight - window.innerHeight;

    const step = () => {
      if (Math.abs(root.scrollTop - current) > 1.5) {
        // something else moved the page (keys, a link, a scrollTo): let it
        target = current = root.scrollTop;
        raf = 0;
        return;
      }
      current += (target - current) * ease;
      if (Math.abs(target - current) < 0.4) current = target;
      window.scrollTo(0, current);
      current = root.scrollTop;
      raf = Math.abs(target - current) < 0.4 ? 0 : requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.defaultPrevented || e.ctrlKey) return;
      // anything that scrolls on its own (a menu, a dialog) keeps its wheel
      const t = e.target as Element | null;
      if (t?.closest?.("[role=dialog]") || document.body.style.overflow === "hidden") return;
      e.preventDefault();
      if (!raf) target = current = root.scrollTop;
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = Math.max(0, Math.min(max(), target + e.deltaY * unit));
      if (!raf) raf = requestAnimationFrame(step);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
    };
  }, [off, ease]);
}
