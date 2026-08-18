import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "../globals.css";

/**
 * Root layout for personalised outreach pages.
 *
 * These live outside the /[locale] tree on purpose: they are one-to-one, keyed
 * by a thread token, and must never be indexed or offered in two languages.
 * That also means they cannot inherit the public site's layout, so the fonts
 * and the shell are declared here — the same typography as the public site,
 * minus the
 * header, footer, sticky CTA and analytics that belong to it.
 *
 * Deliberately no site navigation. The page has exactly one job, and every
 * extra link is a way to leave without doing it.
 */

const sans = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-latin",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif-latin",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-latin",
  display: "swap",
});

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#131d19",
  width: "device-width",
  initialScale: 1,
};

export default function OutreachRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-paper">
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
