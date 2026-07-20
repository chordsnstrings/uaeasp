/**
 * Single place for site identity. The final production domain is not decided
 * yet — set NEXT_PUBLIC_SITE_URL (and optionally NEXT_PUBLIC_SITE_NAME) in the
 * environment and every canonical URL, sitemap entry, JSON-LD block and email
 * link follows.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME =
  process.env.NEXT_PUBLIC_SITE_NAME ?? "UAE E-Invoicing Providers";

export const SITE_TAGLINE_EN =
  "The complete directory of UAE Ministry of Finance pre-approved e-invoicing service providers";
export const SITE_TAGLINE_AR =
  "الدليل الكامل لمزودي خدمات الفوترة الإلكترونية المعتمدين مبدئياً من وزارة المالية الإماراتية";

export const MOF_SOURCE_URL =
  "https://mof.gov.ae/en/about-us/initiatives/einvoicing/pre-approved-einvoicing-service-providers/";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Public path for a locale ("" prefix for en, "/ar" for ar). */
export function localePath(locale: Locale, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return locale === "en" ? p : `/ar${p === "/" ? "" : p}`;
}
