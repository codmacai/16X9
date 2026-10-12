import type { Metadata } from "next";

const title = "Work — 16x9 & Beyond";
const description = "Brand films, documentaries, music videos and TVCs from 16x9, a film studio for brands in Dubai.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", images: [{ url: "/clips/stills/clip-06.webp", width: 1280, height: 720 }] },
};

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
