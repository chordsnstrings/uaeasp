import { absoluteUrl } from "@/lib/site";

/**
 * Open and click tracking for outreach.
 *
 * What each signal is actually worth is worth stating plainly, because acting
 * on the wrong one wastes effort. An open is weak evidence: Gmail proxies and
 * pre-fetches images, plenty of clients block them outright, and a security
 * scanner will happily fetch every URL in a message. A click is strong
 * evidence — someone chose to go somewhere. Treat opens as a floor on
 * deliverability and clicks as the measure of interest.
 */

/** Only our own pages may be redirected to. Anything else is an open redirect. */
export function safeRedirectPath(raw: string): string | null {
  if (!raw) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  // Protocol-relative ("//evil.com") and absolute URLs both leave the site.
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // A backslash is treated as a slash by some parsers — reject rather than
  // normalise, since a legitimate path of ours never contains one.
  if (value.includes("\\") || value.includes("\n") || value.includes("\r")) return null;
  return value;
}

export function openPixelUrl(trackToken: string): string {
  return absoluteUrl(`/api/outreach/open?t=${trackToken}`);
}

export function clickUrl(trackToken: string, path: string): string {
  return absoluteUrl(`/api/outreach/click?t=${trackToken}&u=${encodeURIComponent(path)}`);
}

/**
 * Rewrite our own links in an HTML body so clicks are attributable.
 *
 * Deliberately narrow: only absolute links to our own site are rewritten.
 * The unsubscribe link is left alone — routing a one-click opt-out through a
 * tracker adds a hop that can fail, and an opt-out must never be the thing
 * that breaks.
 */
export function trackLinksInHtml(html: string, trackToken: string, siteOrigin: string): string {
  return html.replace(/href="([^"]+)"/g, (whole, href: string) => {
    if (!href.startsWith(siteOrigin)) return whole;
    const path = href.slice(siteOrigin.length) || "/";
    if (path.startsWith("/api/outreach/unsubscribe")) return whole;
    return `href="${clickUrl(trackToken, path)}"`;
  });
}

/** A 1x1 transparent GIF, the smallest thing a mail client will fetch. */
export const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);
