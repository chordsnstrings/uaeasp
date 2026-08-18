import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getArticle } from "@/lib/insights";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, SITE_NAME, type Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { Markdown } from "@/components/content/Markdown";
import { FadeIn } from "@/components/motion";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getArticle(slug, locale);
  if (!article) return {};
  return pageMetadata({
    locale,
    path: `/insights/${slug}`,
    title: article.title,
    description: article.summary ?? article.title,
  });
}

export default async function InsightPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = await getArticle(slug, locale);
  if (!article) notFound();

  const published = article.publishedAt ?? article.createdAt;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.summary ?? undefined,
          datePublished: new Date(published).toISOString(),
          dateModified: new Date(article.updatedAt).toISOString(),
          inLanguage: locale,
          isAccessibleForFree: true,
          publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
          mainEntityOfPage: absoluteUrl(localePath(locale, `/insights/${slug}`)),
          keywords: article.keywords.join(", "),
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
              name: locale === "ar" ? "رؤى" : "Insights",
              item: absoluteUrl(localePath(locale, "/insights")),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: article.title,
              item: absoluteUrl(localePath(locale, `/insights/${slug}`)),
            },
          ],
        }}
      />

      <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <FadeIn>
          <nav aria-label="Breadcrumb" className="text-sm">
            <Link href="/insights" className="link-slide font-medium text-brand-700">
              ← {locale === "ar" ? "الرؤى" : "Insights"}
            </Link>
          </nav>
          <h1 className="mt-6 display-serif text-4xl text-ink-900 sm:text-5xl">
            {article.title}
          </h1>
          <p className="num mt-4 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-ink-400">
            {new Date(published).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Asia/Dubai",
            })}
            <span aria-hidden className="h-px flex-1 bg-ink-200" />
          </p>
          {article.summary && (
            <p className="mt-6 border-s-2 border-brand-400 ps-4 text-lg leading-relaxed text-ink-600">
              {article.summary}
            </p>
          )}
        </FadeIn>

        <div className="mt-8">
          <Markdown source={article.bodyMd} />
        </div>

        <FadeIn>
          <div className="grain relative mt-12 overflow-hidden rounded-xl bg-brand-950 p-8 text-white">
            <h2 className="text-xl font-medium">
              {locale === "ar"
                ? "احصل على قائمة مختصرة مجاناً"
                : "Get a free provider shortlist"}
            </h2>
            <p className="mt-2 text-brand-100">
              {locale === "ar"
                ? "أخبرنا بمتطلباتك وسنرشح لك المزودين المعتمدين الأنسب."
                : "Tell us your requirements and we will shortlist the accredited providers that fit."}
            </p>
            <Link
              href="/get-matched"
              className="press mt-5 inline-block rounded-lg bg-paper px-6 py-3 font-medium text-ink-900 hover:bg-white"
            >
              {locale === "ar" ? "احصل على ترشيح مجاني" : "Get matched free"}
            </Link>
          </div>
        </FadeIn>
      </article>
    </>
  );
}
