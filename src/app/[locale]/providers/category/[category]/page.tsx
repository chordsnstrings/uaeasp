import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PROVIDER_CATEGORIES, type ProviderCategory } from "@/db/schema";
import { categoryContent } from "@/content/categories";
import { getPublicProviders } from "@/lib/data";
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
    PROVIDER_CATEGORIES.map((category) => ({ locale, category })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  const copy = categoryContent[locale][category as ProviderCategory];
  if (!copy) return {};
  return pageMetadata({
    locale,
    path: `/providers/category/${category}`,
    title: copy.metaTitle,
    description: copy.metaDescription,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: Locale; category: string }>;
}) {
  const { locale, category } = await params;
  setRequestLocale(locale);
  const copy = categoryContent[locale][category as ProviderCategory];
  if (!copy) notFound();
  const t = await getTranslations("landing");
  const tp = await getTranslations("providers");
  const tc = await getTranslations("common");

  const providers = (await getPublicProviders()).filter(
    (p) => p.status === "active" && p.category === category,
  );

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: copy.title,
          numberOfItems: providers.length,
          itemListElement: providers.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(localePath(locale, `/providers/${p.slug}`)),
            name: p.name,
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: tp("title"), item: absoluteUrl(localePath(locale, "/providers")) },
            { "@type": "ListItem", position: 2, name: copy.title, item: absoluteUrl(localePath(locale, `/providers/category/${category}`)) },
          ],
        }}
      />
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <FadeIn>
          <nav aria-label="Breadcrumb" className="text-sm">
            <Link href="/providers" className="link-slide font-medium text-brand-700">
              ← {t("backToDirectory")}
            </Link>
          </nav>
          <h1 className="mt-6 max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-600">{copy.intro}</p>
          <p className="mt-3 max-w-3xl rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm leading-relaxed text-brand-900">
            {copy.pick}
          </p>
        </FadeIn>

        <FadeIn>
          <p className="mt-10 text-sm font-semibold uppercase tracking-wide text-ink-500">
            {t("providersInCategory", { count: providers.length })}
          </p>
        </FadeIn>
        <StaggerGroup className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <StaggerItem key={p.id} className="relative">
              <ProviderCard
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

        {/* Other categories — crawlable cross-links */}
        <FadeIn>
          <div className="mt-12">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              {t("otherCategories")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PROVIDER_CATEGORIES.filter((c) => c !== category).map((c) => (
                <Link
                  key={c}
                  href={`/providers/category/${c}`}
                  className="press hover-lift rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300"
                >
                  {tc(`categories.${c}` as Parameters<typeof tc>[0])}
                </Link>
              ))}
              <Link
                href="/providers"
                className="press hover-lift rounded-full bg-ink-900 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-ink-900"
              >
                {t("allProvidersChip")}
              </Link>
            </div>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-br from-brand-800 to-brand-950 p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-bold">{t("ctaTitle")}</h2>
              <p className="mt-2 max-w-xl text-brand-100">{t("ctaBody")}</p>
            </div>
            <Link
              href="/get-matched"
              className="press btn-shine hover-lift shrink-0 rounded-xl bg-accent-500 px-6 py-3.5 font-bold text-ink-950 hover:bg-accent-400"
            >
              {t("ctaButton")}
            </Link>
          </div>
        </FadeIn>
      </div>
    </>
  );
}
