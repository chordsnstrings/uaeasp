import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "../globals.css";

/**
 * Root layout for personalised outreach pages.
 *
 * These live outside the /[locale] tree on purpose: they are one-to-one, keyed
 * by a thread token, and must never be indexed or offered in two languages.
 * That also means they cannot inherit the public site's layout, so the fonts
 * and the shell are declared here — the same Ledger typography, minus the
 * header, footer, sticky CTA and analytics that belong to the public site.
 *
 * Deliberately no site navigation. The page has exactly one job, and every
 * extra link is a way to leave without doing it.
 */

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-latin",
  display: "swap",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans-latin",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function OutreachRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-paper">
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
