import { Oswald } from "next/font/google";

// The headline face: tall, condensed, cinema-poster capitals.
const display = Oswald({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display", display: "swap" });

export default function Hero22Layout({ children }: { children: React.ReactNode }) {
  return <div className={display.variable}>{children}</div>;
}
