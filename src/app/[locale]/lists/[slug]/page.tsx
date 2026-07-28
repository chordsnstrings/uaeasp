import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LANDING_SLUGS, landingContent, type LandingSlug } from "@/content/landings";
import { MandateFactsTable } from "@/components/seo/MandateFactsTable";
import {
  formatDirectoryDate,
  getActiveProviderCount,
  getDirectoryLastUpdated,
  getPublicProviders,
} from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, type Locale } from "@/lib/site";
import { routing } from "@/i18n/routing";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    LANDING_SLUGS.map((slug) => ({ locale, slug })),
  );
}

function copyFor(locale: Locale, slug: string) {
  if (!(LANDING_SLUGS as readonly string[]).includes(slug)) return null;
  return landingContent[locale]?.[slug as LandingSlug] ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const copy = copyFor(locale, slug);
  if (!copy) return {};
  return pageMetadata({
    locale,
    path: `/lists/${slug}`,
    title: copy.metaTitle,
    description: copy.metaDescription,
  });
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const copy = copyFor(locale, slug);
  if (!copy) notFound();

  const tp = await getTranslations("providers");
  const [providers, count, lastUpdated] = await Promise.all([
    getPublicProviders(),
    getActiveProviderCount(),
    getDirectoryLastUpdated(),
  ]);
  const active = providers.filter((p) => p.status === "active");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: copy.h1,
          numberOfItems: count,
          itemListElement: active.slice(0, 42).map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: p.name,
            url: absoluteUrl(localePath(locale, `/providers/${p.slug}`)),
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: copy.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: absoluteUrl(localePath(locale, "/")),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: copy.h1,
              item: absoluteUrl(localePath(locale, `/lists/${slug}`)),
            },
          ],
        }}
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <FadeIn>
          <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {copy.h1}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-600">{copy.intro}</p>
          {lastUpdated && (
            <p className="num mt-3 text-xs text-ink-400">
              {formatDirectoryDate(lastUpdated, locale)}
            </p>
          )}
        </FadeIn>

        <FadeIn>
          <div className="mt-10">
            <MandateFactsTable locale={locale} />
          </div>
        </FadeIn>

        <FadeIn>
          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">{copy.listHeading}</h2>
            <p className="mt-2 max-w-3xl text-ink-600">{copy.listIntro}</p>
          </div>
        </FadeIn>
        <StaggerGroup className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((p, i) => (
            <StaggerItem key={p.id} className="min-w-0">
              <ProviderCard
                serial={i + 1}
                provider={{
                  ...p,
                  description:
                    locale === "ar" && p.descriptionAr ? p.descriptionAr : p.description,
                }}
                labels={{
                  visitWebsite: tp("visitWebsite"),
                  viewProfile: tp("viewProfile"),
                  delistedBadge: tp("delistedBadge"),
                }}
              />
            </StaggerItem>
          ))}
        </StaggerGroup>

        <FadeIn>
          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">
              {locale === "ar" ? "أسئلة شائعة" : "Common questions"}
            </h2>
            <div className="mt-5 space-y-3">
              {copy.faq.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-2xl border border-ink-100 bg-white transition-shadow hover:border-ink-200 hover:shadow-sm open:border-brand-200 open:shadow-card"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                    <h3 className="text-base font-semibold">{f.q}</h3>
                    <span
                      aria-hidden
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-500 transition-transform duration-200 group-open:rotate-45 group-open:bg-brand-50 group-open:text-brand-700"
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-5 leading-relaxed text-ink-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Cross-links, so the cluster reads as a set rather than as duplicates. */}
        <FadeIn>
          <nav className="mt-12 flex flex-wrap gap-3 border-t border-ink-100 pt-8">
            {copy.related.map((rel) => {
              const target = landingContent[locale][rel as LandingSlug];
              return target ? (
                <Link
                  key={rel}
                  href={`/lists/${rel}`}
                  className="press rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800"
                >
                  {target.h1}
                </Link>
              ) : null;
            })}
            <Link
              href="/registry"
              className="press rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800"
            >
              {locale === "ar" ? "سجل المزودين الكامل" : "Full contact registry"}
            </Link>
            <Link
              href="/get-matched"
              className="press rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {locale === "ar" ? "احصل على قائمة مختصرة مجاناً" : "Get a free shortlist"}
            </Link>
          </nav>
        </FadeIn>
      </div>
    </>
  );
}
