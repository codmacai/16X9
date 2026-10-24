// ===========================================================================
// FORMATS — the three words on the index: 16x9, 9x16 and Beyond. Pointing
// at one shows the wall with its tiles in that word's frame; clicking one
// opens the wall in it (see page.tsx).
// ===========================================================================

export type FormatKey = "16x9" | "9x16" | "beyond";
export type Format = {
  key: FormatKey;
  no: string;
  label: string;
  line: string;
  /** every tile on the wall while this format is shown */
  tile: string;
};

export const FORMATS: Format[] = [
  { key: "16x9", no: "01", label: "16x9", line: "Film campaigns, commercials & documentaries", tile: "16 / 9" },
  { key: "9x16", no: "02", label: "9x16", line: "Social content, strategy & accounts", tile: "9 / 16" },
  // scope: wider than the big screen, and the frames are gone
  { key: "beyond", no: "03", label: "Beyond", line: "Activations, immersive, AR & VR", tile: "2.39 / 1" },
];

/** 16x9 set as type: the numbers, and a light lowercase x between them. */
export function Ratio({ text, className }: { text: string; className?: string }) {
  const [a, b] = text.split("x");
  if (b === undefined) return <>{text}</>;
  return (
    <>
      {a}
      {/* the figure after the x, so the x can be set close to it (a 1 sits far into its slot) */}
      <span className={className} data-next={b[0]}>
        x
      </span>
      {b}
    </>
  );
}

/** A small outline of the format's frame; Beyond is only its corners: the frame has opened. */
export function FrameGlyph({ k, className }: { k: FormatKey; className?: string }) {
  if (k === "beyond")
    return (
      <svg className={className} viewBox="0 0 26 12" aria-hidden="true">
        <path d="M0.5 3.5V0.5H4.5M21.5 0.5H25.5V3.5M25.5 8.5V11.5H21.5M4.5 11.5H0.5V8.5" fill="none" stroke="currentColor" />
      </svg>
    );
  const wide = k === "16x9";
  return (
    <svg className={className} viewBox={wide ? "0 0 22 13" : "0 0 9 15"} aria-hidden="true">
      <rect x="0.5" y="0.5" width={wide ? 21 : 8} height={wide ? 12 : 14} fill="none" stroke="currentColor" />
    </svg>
  );
}
