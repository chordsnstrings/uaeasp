import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getGuide, guidesContent, GUIDE_SLUGS, GUIDE_UPDATED_ISO } from "@/content/guides";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, SITE_NAME, type Locale } from "@/lib/site";
import { routing } from "@/i18n/routing";
import { JsonLd } from "@/components/seo/JsonLd";
import { MandateFactsTable } from "@/components/seo/MandateFactsTable";
import { FadeIn } from "@/components/motion";

/** Guides whose topic warrants the phase/deadline facts table up top. */
const FACTS_TABLE_SLUGS = new Set([
  "uae-e-invoicing-timeline",
  "uae-e-invoicing-penalties",
  "what-is-uae-e-invoicing",
]);

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    GUIDE_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = getGuide(locale, slug);
  if (!guide) return {};
  return pageMetadata({
    locale,
    path: `/guides/${slug}`,
    title: guide.metaTitle,
    description: guide.metaDescription,
  });
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const guide = getGuide(locale, slug);
  if (!guide) notFound();
  const t = await getTranslations("guides");
  const related = guide.related
    .map((r) => guidesContent[locale].find((g) => g.slug === r))
    .filter(Boolean);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.metaDescription,
          dateModified: GUIDE_UPDATED_ISO,
          inLanguage: locale === "ar" ? "ar-AE" : "en-AE",
          mainEntityOfPage: absoluteUrl(localePath(locale, `/guides/${slug}`)),
          author: { "@type": "Organization", name: SITE_NAME },
          publisher: { "@type": "Organization", name: SITE_NAME },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: t("title"), item: absoluteUrl(localePath(locale, "/guides")) },
            { "@type": "ListItem", position: 2, name: guide.title, item: absoluteUrl(localePath(locale, `/guides/${slug}`)) },
          ],
        }}
      />
      <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <FadeIn>
          <nav aria-label="Breadcrumb" className="text-sm">
            <Link href="/guides" className="link-slide font-medium text-brand-700">
              ← {t("backToGuides")}
            </Link>
          </nav>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-700">
            {t("readingTime", { minutes: guide.readingMinutes })}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
            {guide.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-600">{guide.intro}</p>
        </FadeIn>

        {FACTS_TABLE_SLUGS.has(slug) && (
          <FadeIn>
            <div className="mt-8">
              <MandateFactsTable locale={locale} />
            </div>
          </FadeIn>
        )}

        <div className="mt-10 space-y-10">
          {guide.sections.map((section) => (
            <FadeIn key={section.h} as="section">
              <h2 className="text-2xl font-bold tracking-tight text-ink-900">{section.h}</h2>
              {section.body.map((p, i) => (
                <p key={i} className="mt-4 leading-relaxed text-ink-700">
                  {p}
                </p>
              ))}
              {section.list && (
                <ul className="mt-4 space-y-2.5">
                  {section.list.map((item) => (
                    <li key={item} className="flex gap-3">
                      <svg
                        className="mt-1 shrink-0 text-brand-600"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden
                      >
                        <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="leading-relaxed text-ink-700">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <div className="mt-12 grain relative overflow-hidden rounded-xl bg-brand-950 p-8 text-center text-white">
            <h2 className="text-2xl font-bold">{t("articleCtaTitle")}</h2>
            <p className="mx-auto mt-2 max-w-md text-brand-100">{t("articleCtaBody")}</p>
            <Link
              href="/get-matched"
              className="press btn-shine hover-lift mt-6 inline-block rounded-xl bg-accent-500 px-6 py-3 font-bold text-ink-950 hover:bg-accent-400"
            >
              {t("articleCtaButton")}
            </Link>
          </div>
        </FadeIn>

        {related.length > 0 && (
          <FadeIn>
            <div className="mt-12">
              <h2 className="text-lg font-bold text-ink-900">{t("relatedTitle")}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r!.slug}
                    href={`/guides/${r!.slug}`}
                    className="card-hover group rounded-2xl border border-ink-100 bg-white p-4 transition-transform"
                  >
                    <p className="text-sm font-bold leading-snug text-ink-900 group-hover:text-brand-800">
                      {r!.title}
                    </p>
                    <p className="mt-2 text-xs text-brand-700">
                      {t("readGuide")} <span aria-hidden className="rtl:hidden">→</span>
                      <span aria-hidden className="hidden rtl:inline">←</span>
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </FadeIn>
        )}
      </article>
    </>
  );
}
