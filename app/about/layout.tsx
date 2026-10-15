import type { Metadata } from "next";

const title = "Who we are — 16x9 & Beyond";
const description =
  "16x9 & Beyond brings concept development, creative strategy and production together: TVCs, brand films, cinematic documentaries, social and branded content, and immersive, interactive experiences.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", images: [{ url: "/work/posters/poster-1.webp" }] },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
