import { Archivo, Inter_Tight } from "next/font/google";

// The hero's two typefaces, for the whole site: Archivo set slightly wide for
// headings and the small spaced capitals, Inter Tight for reading.
export const siteWide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });
export const siteSans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
