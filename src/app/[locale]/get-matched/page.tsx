import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { LeadForm } from "@/components/lead-form/LeadForm";
import { FadeIn } from "@/components/motion";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "getMatched" });
  return pageMetadata({
    locale,
    path: "/get-matched",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function GetMatchedPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("getMatched");
  const tf = await getTranslations("leadForm");

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
        <FadeIn>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">{t("subtitle")}</p>
          <ul className="mt-8 space-y-5">
            {([1, 2, 3] as const).map((i) => (
              <li key={i} className="flex gap-4">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-800"
                >
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-ink-900">
                    {t(`benefit${i}` as Parameters<typeof t>[0])}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">
                    {t(`benefit${i}Body` as Parameters<typeof t>[0])}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div id="lead-form" className="rounded-3xl border border-ink-100 bg-white p-6 shadow-card sm:p-8">
            <h2 className="text-xl font-bold text-ink-900">{tf("title")}</h2>
            <p className="mt-1 text-sm text-ink-500">{tf("subtitle")}</p>
            <div className="mt-6">
              <Suspense>
                <LeadForm source="form" />
              </Suspense>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
