import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Alexandria,
  Familjen_Grotesk,
  IBM_Plex_Mono,
  Fraunces,
} from "next/font/google";
import { routing } from "@/i18n/routing";
import { MotionProvider } from "@/components/motion";
import { Header } from "@/components/layout/Header";
import { guidesContent } from "@/content/guides";
import { PROVIDER_CATEGORIES } from "@/db/schema";
import { Footer } from "@/components/layout/Footer";
import { StickyCta } from "@/components/layout/StickyCta";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { BackToTop } from "@/components/layout/BackToTop";
import { Analytics } from "@/components/layout/Analytics";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_NAME, SITE_URL, absoluteUrl, localePath } from "@/lib/site";
import "../globals.css";

// One Swedish grotesk carries the whole interface; a single high-contrast
// serif is allowed out only at display sizes, where one line of it does more
// for a page than any amount of colour. Mono is reserved for figures, because
// on this site the figures are the content.
const sans = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-latin",
  display: "swap",
});

const serif = Fraunces({
  subsets: ["latin"],
  // Fraunces is variable on three axes beyond weight, and shipping them is
  // the point: opsz lets the browser take the display drawing for the
  // masthead and the text drawing everywhere else from one file, which is
  // exactly what the face it replaces could not do — a single drawing set
  // at 72px thins out to hairlines on a dark ground. SOFT and WONK are left
  // at their defaults; the warmth is already in the drawing.
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-serif-latin",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-latin",
  display: "swap",
});

const arabic = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-sans-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("siteName"),
      template: `%s | ${t("siteName")}`,
    },
    applicationName: SITE_NAME,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: SITE_NAME },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#131d19",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dir = locale === "ar" ? "rtl" : "ltr";
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${sans.variable} ${serif.variable} ${mono.variable} ${arabic.variable}`}
    >
      <head>
        {plausibleDomain && (
          <script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
          />
        )}
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
              }}
            />
          </>
        )}
      </head>
      <body className="min-h-dvh">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            url: SITE_URL,
            inLanguage: ["en", "ar"],
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${absoluteUrl(localePath(locale as "en" | "ar", "/providers"))}?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL,
            logo: absoluteUrl("/icons/icon-512.png"),
          }}
        />
        <NextIntlClientProvider>
          <MotionProvider>
            <Analytics />
            <ScrollProgress />
            <Header
              menu={{
                guides: guidesContent[locale as "en" | "ar"].map((g) => ({
                  slug: g.slug,
                  title: g.title,
                })),
                categories: [...PROVIDER_CATEGORIES],
              }}
            />
            <main id="main">{children}</main>
            <Footer />
            <StickyCta />
            <BackToTop />
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
