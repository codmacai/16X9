"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { useInView } from "framer-motion";
import type { Project } from "./_shared/data";
import d from "./detail.module.css";
import s from "./credits.module.css";

// ===========================================================================
// SIGN-OFF — the film's credits, set as a clapperboard the width of the screen.
//   · It follows the page above as you scroll: no edge dragging it up.
//   · It's a screen tall (and grows rather than cut anything, given more
//     credits than a screen holds), edge to edge. Across its head the clapper
//     stick: black, its white arrows running the full width, drawing across as
//     it comes into view. Below it the board is the page's own paper, ruled in
//     black, so it reads as part of the page: the production (the film's
//     title), its client and year across the top; then every credit in its own
//     cell, its role over its names, the cells sharing out the room left; and
//     at the foot the mark. Only the credits: no addresses, no numbers.
// ===========================================================================

const LOGO_SRC = "/logo-16x9.svg";

type Cell = { label: string; names: string[] };

/** the credits as cells: each role over its names (a group's names without a role go under the
 *  group's own name); the client, already across the top, isn't repeated */
function cellsOf(film: Project): Cell[] {
  const out: Cell[] = [];
  for (const g of film.credits ?? []) {
    for (const r of g.rows) {
      if (r.role === "Client") continue;
      out.push({ label: r.role ?? g.heading, names: r.names });
    }
  }
  return out;
}

/** how many cells to a row: as few rows as sit well, fewer columns on a phone */
function colsFor(n: number, phone: boolean) {
  if (phone) return n <= 1 ? 1 : 2;
  if (n <= 4) return Math.max(1, n);
  if (n <= 8) return Math.ceil(n / 2);
  if (n <= 15) return 5;
  return 6;
}

const subPhone = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 640px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export default function Credits({
  film,
  label,
  container,
  sectionRef,
  reduce,
}: {
  film: Project;
  label: string;
  container: RefObject<HTMLDivElement | null>;
  sectionRef: RefObject<HTMLElement | null>;
  reduce: boolean;
}) {
  const inView = useInView(sectionRef, { root: container, amount: 0.6 });
  const phone = useSyncExternalStore(subPhone, () => window.matchMedia("(max-width: 640px)").matches, () => false);

  // in view, the stick draws across (once)
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(() => setSeen(true), 0);
    return () => window.clearTimeout(t);
  }, [inView]);

  const cells = cellsOf(film);
  const cols = colsFor(cells.length, phone);
  const rows = Math.max(1, Math.ceil(cells.length / cols));
  // blank cells to finish the last row, so the ruling runs on unbroken
  const blanks = rows * cols - cells.length;

  return (
    <section ref={sectionRef} className={`${d.signoff} ${s.signoff}`} aria-label={`End credits: ${film.title}`}>
      <div className={`${s.stage} ${seen || reduce ? s.seen : ""}`}>
        {/* the clapper stick, edge to edge: white arrows on black */}
        <span className={s.stick} aria-hidden="true" />

        {/* the board: the page's own paper, ruled in black, filling the rest of the screen */}
        <div className={s.board}>
          <div className={s.head}>
            <div className={`${s.cell} ${s.prod}`}>
              <span className={s.lab}>Production</span>
              <span className={s.title}>{film.title}</span>
            </div>
            <div className={s.cell}>
              <span className={s.lab}>Client</span>
              <span className={s.val}>{film.client}</span>
            </div>
            <div className={s.cell}>
              <span className={s.lab}>{film.year ? "Year" : "Format"}</span>
              <span className={s.val}>{film.year || label}</span>
            </div>
          </div>

          <div className={s.cells} style={{ "--cols": cols, "--rows": rows } as React.CSSProperties}>
            {cells.map((c, i) => (
              <div key={i} className={s.cell}>
                <span className={s.lab}>{c.label}</span>
                <span className={s.val}>
                  {c.names.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </span>
              </div>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <div key={`b${i}`} className={s.cell} aria-hidden="true" />
            ))}
          </div>

          <div className={s.foot}>
            <span>End credits</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="16x9" />
            <span>A 16×9 film{film.client ? ` for ${film.client}` : ""}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
