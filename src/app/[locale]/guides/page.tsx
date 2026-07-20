import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { guidesContent } from "@/content/guides";
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
  const t = await getTranslations({ locale, namespace: "guides" });
  return pageMetadata({
    locale,
    path: "/guides",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function GuidesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("guides");
  const guides = guidesContent[locale];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("title"),
          numberOfItems: guides.length,
          itemListElement: guides.map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(localePath(locale, `/guides/${g.slug}`)),
            name: g.title,
          })),
        }}
      />
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <FadeIn>
          <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-600">{t("subtitle")}</p>
        </FadeIn>

        <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <StaggerItem key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="card-hover group flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-6 transition-transform"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {t("readingTime", { minutes: g.readingMinutes })}
                </p>
                <h2 className="mt-2 text-lg font-bold leading-snug text-ink-900 group-hover:text-brand-800">
                  {g.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 line-clamp-3">
                  {g.intro}
                </p>
                <span className="mt-4 text-sm font-semibold text-brand-700">
                  {t("readGuide")}{" "}
                  <span
                    aria-hidden
                    className="inline-block transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  >
                    →
                  </span>
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <FadeIn>
          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl border border-brand-100 bg-brand-50 p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-bold text-ink-900">{t("ctaTitle")}</h2>
              <p className="mt-2 max-w-xl text-ink-600">{t("ctaBody")}</p>
            </div>
            <Link
              href="/get-matched"
              className="press btn-shine hover-lift shrink-0 rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800"
            >
              {t("ctaButton")}
            </Link>
          </div>
        </FadeIn>
      </div>
    </>
  );
}
