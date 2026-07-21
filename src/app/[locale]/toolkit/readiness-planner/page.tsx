import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, type Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { FadeIn } from "@/components/motion";
import { ReadinessPlanner } from "@/components/toolkit/ReadinessPlanner";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "toolkit.planner" });
  return pageMetadata({
    locale,
    path: "/toolkit/readiness-planner",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function ReadinessPlannerPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("toolkit.planner");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Toolkit", item: absoluteUrl(localePath(locale, "/toolkit")) },
            { "@type": "ListItem", position: 2, name: t("title"), item: absoluteUrl(localePath(locale, "/toolkit/readiness-planner")) },
          ],
        }}
      />
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <FadeIn>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {t("kicker")}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-lg text-ink-600">{t("subtitle")}</p>
      </FadeIn>
      <FadeIn delay={0.1}>
        <div className="mt-10">
          <ReadinessPlanner />
        </div>
      </FadeIn>
    </div>
    </>
  );
}
