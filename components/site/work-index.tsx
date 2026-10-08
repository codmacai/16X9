"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, type Category, type Work } from "./content";
import FilmGrid from "./films";
import sx from "./sections.module.css";

// The work, filtered by kind of film. Changing the filter rebuilds the grid, so
// the cards rise in again.
export default function WorkIndex({ work }: { work: Work[] }) {
  const [filter, setFilter] = useState<Category | "All">("All");
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    work.forEach((w) => c.set(w.category, (c.get(w.category) ?? 0) + 1));
    return c;
  }, [work]);
  const shown = filter === "All" ? work : work.filter((w) => w.category === filter);
  const options = ["All" as const, ...CATEGORIES.filter((c) => counts.has(c))];

  return (
    <>
      <div className={sx.filters} role="group" aria-label="Filter by kind of film">
        {options.map((o) => (
          <button key={o} type="button" className={sx.filter} aria-pressed={filter === o} onClick={() => setFilter(o)}>
            {o}
            <sup>{o === "All" ? work.length : counts.get(o)}</sup>
          </button>
        ))}
      </div>
      <FilmGrid key={filter} films={shown} layout="index" />
    </>
  );
}
