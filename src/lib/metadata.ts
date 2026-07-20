import type { Metadata } from "next";
import { absoluteUrl, localePath, type Locale } from "./site";

export function pageMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
}): Metadata {
  const canonical = absoluteUrl(localePath(locale, path));
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: absoluteUrl(localePath("en", path)),
        ar: absoluteUrl(localePath("ar", path)),
        "x-default": absoluteUrl(localePath("en", path)),
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "UAE E-Invoicing Providers",
      locale: locale === "ar" ? "ar_AE" : "en_AE",
      type: "website",
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(title)}&locale=${locale}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
