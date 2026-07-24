import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { glossaryContent } from "@/content/glossary";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, type Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "glossary" });
  return pageMetadata({
    locale,
    path: "/resources/glossary",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function GlossaryPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("glossary");
  const terms = glossaryContent[locale];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: t("title"),
          description: t("metaDescription"),
          url: absoluteUrl(localePath(locale, "/resources/glossary")),
          hasDefinedTerm: terms.map((item) => ({
            "@type": "DefinedTerm",
            name: item.term,
            description: item.def,
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

        <StaggerGroup className="mt-10 space-y-4">
          {terms.map((item) => (
            <StaggerItem key={item.term}>
              <dl className="card-hover rounded-2xl border border-ink-100 bg-white p-5 transition-transform sm:p-6">
                <dt className="font-bold text-ink-900">{item.term}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-600">{item.def}</dd>
              </dl>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <FadeIn>
          <div className="mt-12 grain relative overflow-hidden rounded-xl bg-brand-950 p-8 text-center text-white">
            <h2 className="text-2xl font-bold">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-2 max-w-md text-brand-100">{t("ctaBody")}</p>
            <Link
              href="/get-matched"
              className="press btn-shine hover-lift mt-6 inline-block rounded-xl bg-accent-500 px-6 py-3 font-bold text-ink-950 hover:bg-accent-400"
            >
              {t("ctaButton")}
            </Link>
          </div>
        </FadeIn>
      </div>
    </>
  );
}
