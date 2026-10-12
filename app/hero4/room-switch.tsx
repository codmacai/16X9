"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FORMATS, FrameGlyph, Ratio, type FormatKey } from "../hero3/format-hero";
import styles from "./room-switch.module.css";

// ===========================================================================
// THE ROOM SWITCH — at the top, in the middle, in every room and on every
// format's work page: the room you're in (its frame and its name) and a
// small caret. Click it and a narrow sheet unrolls under it: the three rooms,
// each with its number, frame and line (the one you're in marked), and the
// way back to the index. The sheet closes on a choice, a click outside or Esc.
// ===========================================================================

const EASE = [0.16, 1, 0.3, 1] as const;

export default function RoomSwitch({
  room,
  onSwitch,
  onIndex,
  tone = "dark",
}: {
  room: FormatKey;
  onSwitch: (k: FormatKey) => void;
  onIndex: () => void;
  /** "light": ink on a paper page */
  tone?: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const f = FORMATS.find((x) => x.key === room) ?? FORMATS[0];

  // a click outside or Esc closes it (Esc goes no further while it's open)
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);

  return (
    <motion.div
      ref={rootRef}
      className={`${styles.root} ${tone === "light" ? styles.light : ""}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.6, ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <button
        type="button"
        className={styles.current}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={room}
            className={styles.currentIn}
            initial={{ y: "110%" }}
            animate={{ y: "0%", transition: { duration: 0.5, ease: EASE } }}
            exit={{ y: "-110%", transition: { duration: 0.3, ease: EASE } }}
          >
            <FrameGlyph k={room} className={styles.glyph} />
            <Ratio text={f.label} className={styles.x} />
          </motion.span>
        </AnimatePresence>
        <svg className={`${styles.caret} ${open ? styles.caretOpen : ""}`} viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.sheet}
            role="menu"
            initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.5, ease: EASE } }}
            exit={{ clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.32, ease: [0.7, 0, 0.84, 0] } }}
          >
            {FORMATS.map((x, i) => (
              <motion.button
                key={x.key}
                type="button"
                role="menuitemradio"
                aria-checked={x.key === room}
                className={`${styles.item} ${x.key === room ? styles.itemOn : ""}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.06 + i * 0.05, duration: 0.45, ease: EASE } }}
                onClick={() => {
                  setOpen(false);
                  if (x.key !== room) onSwitch(x.key);
                }}
              >
                <i className={styles.no}>{x.no}</i>
                <FrameGlyph k={x.key} className={styles.glyph} />
                <span className={styles.label}>
                  <span>
                    <Ratio text={x.label} className={styles.x} />
                  </span>
                  <small>{x.line}</small>
                </span>
                <span className={styles.dot} aria-hidden="true" />
              </motion.button>
            ))}
            <motion.button
              type="button"
              role="menuitem"
              className={styles.index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.22, duration: 0.45 } }}
              onClick={() => {
                setOpen(false);
                onIndex();
              }}
            >
              <span aria-hidden="true">←</span> Index
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
