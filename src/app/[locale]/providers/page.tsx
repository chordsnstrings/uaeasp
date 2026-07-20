import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { EMIRATES, PROVIDER_CATEGORIES } from "@/db/schema";
import { emirateContent } from "@/content/emirates";
import {
  getPublicProviders,
  getActiveProviderCount,
  getDirectoryLastUpdated,
  formatDirectoryDate,
} from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, type Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProvidersDirectory } from "@/components/providers/ProvidersDirectory";
import { FadeIn } from "@/components/motion";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "providers" });
  const count = await getActiveProviderCount();
  const year = new Date().getFullYear();
  return pageMetadata({
    locale,
    path: "/providers",
    title: t("metaTitle", { count, year }),
    description: t("metaDescription", { count, year }),
  });
}

export default async function ProvidersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("providers");
  const tl = await getTranslations("landing");
  const tc = await getTranslations("common");
  const [providers, count, lastUpdated] = await Promise.all([
    getPublicProviders(),
    getActiveProviderCount(),
    getDirectoryLastUpdated(),
  ]);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("title"),
          numberOfItems: count,
          itemListElement: providers
            .filter((p) => p.status === "active")
            .map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: absoluteUrl(localePath(locale, `/providers/${p.slug}`)),
              name: p.name,
            })),
        }}
      />
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <FadeIn>
          <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-600">
            {t("subtitle", {
              count,
              date: formatDirectoryDate(lastUpdated, locale),
            })}
          </p>
        </FadeIn>
        <div className="mt-10">
          <ProvidersDirectory
              providers={providers.map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                nameAr: p.nameAr,
                website: p.website,
                description:
                  locale === "ar" && p.descriptionAr ? p.descriptionAr : p.description,
                descriptionAr: p.descriptionAr,
                status: p.status,
                category: p.category,
              }))}
            />
        </div>

        {/* Crawlable category + emirate cross-links (the chips above are
            client-side filters; these are real pages) */}
        <div className="mt-14 space-y-8 border-t border-ink-100 pt-10">
          <nav aria-label={tl("browseByCategory")}>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              {tl("browseByCategory")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PROVIDER_CATEGORIES.map((c) => (
                <Link
                  key={c}
                  href={`/providers/category/${c}`}
                  className="press hover-lift rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300"
                >
                  {tc(`categories.${c}` as Parameters<typeof tc>[0])}
                </Link>
              ))}
            </div>
          </nav>
          <nav aria-label={tl("browseByEmirate")}>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              {tl("browseByEmirate")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EMIRATES.map((e) => (
                <Link
                  key={e}
                  href={`/e-invoicing/${e}`}
                  className="press hover-lift rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300"
                >
                  {emirateContent[locale][e].name}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
