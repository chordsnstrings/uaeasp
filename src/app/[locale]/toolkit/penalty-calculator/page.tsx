import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, type Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { FadeIn } from "@/components/motion";
import { PenaltyCalculator } from "@/components/toolkit/PenaltyCalculator";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "toolkit.calculator" });
  return pageMetadata({
    locale,
    path: "/toolkit/penalty-calculator",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function PenaltyCalculatorPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("toolkit.calculator");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: t("metaTitle"),
          description: t("metaDescription"),
          url: absoluteUrl(localePath(locale, "/toolkit/penalty-calculator")),
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "AED" },
        }}
      />
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {t("kicker")}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-ink-600">{t("subtitle")}</p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-10">
            <PenaltyCalculator />
          </div>
        </FadeIn>
      </div>
    </>
  );
}
