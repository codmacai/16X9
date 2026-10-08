import type { Metadata } from "next";
import DepthHero from "./hero13/page";

const title = "16x9 & Beyond — Bringing brands to life";
const description =
  "16x9 & Beyond is a film studio for brands: campaigns, brand films and social. Step into the wall of work and watch the films.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/clips/stills/clip-01.webp", width: 1280, height: 720, alt: "A still from the 16x9 & Beyond showreel" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/clips/stills/clip-01.webp"] },
};

// The homepage is hero 13, the depth gallery. It still lives at /hero13 as well.
export default function Home() {
  return <DepthHero />;
}
