import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, type Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { FadeIn } from "@/components/motion";
import { ComplianceChecklist } from "@/components/toolkit/ComplianceChecklist";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "toolkit.checklist" });
  return pageMetadata({
    locale,
    path: "/toolkit/checklist",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("toolkit.checklist");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: t("metaTitle"),
          description: t("metaDescription"),
          url: absoluteUrl(localePath(locale, "/toolkit/checklist")),
          step: ["scope", "select", "data", "integrate", "live"].map((key, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: t(`groups.${key}.title` as Parameters<typeof t>[0]),
            text: t(`groups.${key}.subtitle` as Parameters<typeof t>[0]),
          })),
        }}
      />
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {t("kicker")}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-lg text-ink-600">{t("subtitle")}</p>
        </FadeIn>
        <div className="mt-8">
          <ComplianceChecklist />
        </div>
      </div>
    </>
  );
}
