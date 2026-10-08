"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import ProjectView, { type OpenProject } from "@/app/hero7/project-view";
import { posterFor } from "@/app/hero7/wall-playback";
import type { Work } from "./content";
import { Reveal } from "./motion";
import sx from "./sections.module.css";

const grayFor = (src: string) => src.replace(/\/([^/]+)\.mp4$/i, "/posters-gray/$1.webp");

// ===========================================================================
// FILMS — a grid of film cards. Each rests in black and white; point at one
// and it comes into colour and plays (muted). Click and it opens in the hero's
// full-screen player, which flies out of the card.
// ===========================================================================
export default function FilmGrid({ films, layout }: { films: Work[]; layout: "featured" | "index" }) {
  const [project, setProject] = useState<OpenProject | null>(null);
  const close = useCallback(() => setProject(null), []);

  const open = useCallback((index: number, frame: HTMLElement, time: number) => {
    const r = frame.getBoundingClientRect();
    setProject({ index, rect: { top: r.top, left: r.left, width: r.width, height: r.height }, time });
  }, []);

  return (
    <>
      <ul className={layout === "featured" ? sx.featured : sx.index}>
        {films.map((film, i) => (
          <li key={film.src}>
            <Reveal delay={layout === "index" ? (i % 3) * 0.08 : 0}>
              <FilmCard film={film} index={i} onOpen={open} />
            </Reveal>
          </li>
        ))}
      </ul>
      <div className={sx.playerFont}>
        <AnimatePresence>{project && <ProjectView key="project" clips={films} open={project} onClose={close} />}</AnimatePresence>
      </div>
    </>
  );
}

function FilmCard({
  film,
  index,
  onOpen,
}: {
  film: Work;
  index: number;
  onOpen: (index: number, frame: HTMLElement, time: number) => void;
}) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);

  const play = () => {
    const v = videoRef.current;
    if (!v) return;
    setLive(true);
    v.play().catch(() => setLive(false));
  };
  const stop = () => {
    setLive(false);
    videoRef.current?.pause();
  };

  return (
    <button
      type="button"
      className={sx.card}
      data-live={live}
      onPointerEnter={(e) => e.pointerType === "mouse" && play()}
      onPointerLeave={stop}
      onFocus={play}
      onBlur={stop}
      onClick={() => frameRef.current && onOpen(index, frameRef.current, videoRef.current?.currentTime ?? 0)}
      aria-label={`Play ${film.title}, ${film.category.toLowerCase()} for ${film.client}`}
    >
      <span ref={frameRef} className={sx.cardFrame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={sx.cardPoster} src={grayFor(film.src)} alt="" loading="lazy" decoding="async" />
        <video
          ref={videoRef}
          className={sx.cardVideo}
          src={film.src}
          poster={posterFor(film.src)}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        />
        <span className={sx.cardPlay} aria-hidden="true">
          <i /> Play
        </span>
      </span>
      <span className={sx.cardMeta}>
        <span className={sx.cardTitle}>{film.title}</span>
        <span className={sx.cardTime}>{film.duration}</span>
      </span>
      <span className={sx.cardSub}>
        {film.client} · {film.category} · {film.year}
      </span>
    </button>
  );
}
