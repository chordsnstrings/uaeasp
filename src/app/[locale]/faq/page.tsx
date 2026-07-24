import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { faqContent } from "@/content/faq";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faqPage" });
  return pageMetadata({
    locale,
    path: "/faq",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faqPage");
  const items = faqContent[locale];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <FadeIn>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-lg text-ink-600">{t("subtitle")}</p>
        </FadeIn>

        <StaggerGroup className="mt-10 space-y-3">
          {items.map((item) => (
            <StaggerItem key={item.q}>
              <details className="group rounded-2xl border border-ink-100 bg-white transition-shadow hover:border-ink-200 hover:shadow-sm open:border-brand-200 open:shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                  <h2 className="text-base font-semibold">{item.q}</h2>
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-50 text-ink-500 transition-transform duration-200 group-open:rotate-45 group-open:bg-brand-50 group-open:text-brand-700"
                  >
                    +
                  </span>
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-ink-600">{item.a}</p>
              </details>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <FadeIn>
          <div className="mt-12 grain relative overflow-hidden rounded-xl bg-brand-950 p-8 text-center text-white">
            <h2 className="text-2xl font-bold">{t("stillQuestions")}</h2>
            <p className="mx-auto mt-2 max-w-md text-brand-100">
              {t("stillQuestionsBody")}
            </p>
            <Link
              href="/get-matched"
              className="press btn-shine hover-lift mt-6 inline-block rounded-xl bg-accent-500 px-6 py-3 font-bold text-ink-950 hover:bg-accent-400"
            >
              {t("stillQuestionsButton")}
            </Link>
          </div>
        </FadeIn>
      </div>
    </>
  );
}
