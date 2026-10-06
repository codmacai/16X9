import type { Metadata } from "next";

const title = "16x9 & Beyond — Stories beyond the frame";
const description = "16x9 & Beyond is a film studio for brands: campaigns, brand films and social. Step into the gallery and watch the work.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/hero19/centre.webp", width: 960, height: 540, alt: "A still from the 16x9 showreel" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/hero19/centre.webp"] },
};

export default function Hero19Layout({ children }: { children: React.ReactNode }) {
  return children;
}
