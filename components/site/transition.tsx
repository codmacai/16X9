"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./site.module.css";

// ===========================================================================
// THE CUT — moving between pages is a cut between scenes. Two black bars close
// over the page (the letterbox the hero opens with), a hairline is drawn where
// they meet, the next page loads behind them, and they part again.
// ===========================================================================

const EASE_CINE = [0.76, 0, 0.24, 1] as const;
const CLOSE_S = 0.6;
const OPEN_S = 0.85;
const STUCK_MS = 6000; // if a page takes this long, open anyway

type Navigate = (href: string) => void;
const NavContext = createContext<Navigate | null>(null);

type Cut = { phase: "idle" | "closing" | "covered"; from: string; to: string };

const pathOf = (href: string) => href.split(/[?#]/)[0] || "/";

export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = !!useReducedMotion();
  const [cut, setCut] = useState<Cut>({ phase: "idle", from: "", to: "" });

  // the new page is in: the bars can part
  const arrived = cut.phase === "covered" && pathname !== cut.from;
  const shut = (cut.phase === "closing" || cut.phase === "covered") && !arrived;
  // the homepage opens on its own letterbox, so the bars just get out of its way
  const instant = arrived && pathOf(cut.to) === "/";

  const navigate = useCallback<Navigate>(
    (href) => {
      if (pathOf(href) === pathname) {
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        return;
      }
      if (reduce) {
        router.push(href);
        return;
      }
      setCut((c) => (c.phase === "idle" ? { phase: "closing", from: pathname, to: href } : c));
    },
    [pathname, reduce, router]
  );

  // a slow page never leaves the screen black
  useEffect(() => {
    if (cut.phase !== "covered" || arrived) return;
    const t = window.setTimeout(() => setCut((c) => ({ ...c, phase: "idle" })), STUCK_MS);
    return () => window.clearTimeout(t);
  }, [cut.phase, arrived]);

  const onBarDone = () => {
    if (shut && cut.phase === "closing") {
      // fully covered: change the page underneath
      router.push(cut.to);
      setCut((c) => ({ ...c, phase: "covered" }));
    } else if (!shut && cut.phase !== "idle") {
      setCut((c) => ({ ...c, phase: "idle" }));
    }
  };

  const duration = shut ? CLOSE_S : instant ? 0 : OPEN_S;

  return (
    <NavContext.Provider value={navigate}>
      {children}
      <div className={styles.cut} data-active={cut.phase !== "idle"} aria-hidden="true">
        <motion.div
          className={styles.cutTop}
          initial={false}
          animate={{ y: shut ? "0%" : "-101%" }}
          transition={{ duration, ease: EASE_CINE }}
          onAnimationComplete={onBarDone}
        />
        <motion.div
          className={styles.cutBottom}
          initial={false}
          animate={{ y: shut ? "0%" : "101%" }}
          transition={{ duration, ease: EASE_CINE }}
        />
        <motion.div
          className={styles.cutLine}
          initial={false}
          animate={{ scaleX: shut ? 1 : 0, opacity: shut ? 1 : 0 }}
          transition={{ duration: shut ? 0.5 : 0.25, delay: shut ? CLOSE_S * 0.6 : 0, ease: EASE_CINE }}
        />
      </div>
    </NavContext.Provider>
  );
}

/** For plain <a> elements: returns a click handler that runs the cut inside the site
 *  and does nothing (a normal link) outside it. */
export function useNavClick() {
  const navigate = useContext(NavContext);
  return useCallback(
    (e: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!navigate || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab or window
      if (/^(https?:|mailto:|tel:)/.test(href)) return;
      e.preventDefault();
      navigate(href);
    },
    [navigate]
  );
}

/** next/link with the cut. */
export function SiteLink({ href, onNavigate, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const navigate = useContext(NavContext);
  return (
    <Link
      href={href}
      {...rest}
      onNavigate={(e) => {
        onNavigate?.(e);
        if (!navigate) return;
        e.preventDefault();
        navigate(href);
      }}
    />
  );
}
