import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { EMIRATES, type Emirate } from "@/db/schema";
import { emirateContent } from "@/content/emirates";
import { MANDATE_PHASES, PHASE_LABELS, formatMandateDate } from "@/content/mandate";
import { getActiveProviderCount, getPublicProviders } from "@/lib/data";
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
    EMIRATES.map((emirate) => ({ locale, emirate })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; emirate: string }>;
}): Promise<Metadata> {
  const { locale, emirate } = await params;
  const copy = emirateContent[locale][emirate as Emirate];
  if (!copy) return {};
  return pageMetadata({
    locale,
    path: `/e-invoicing/${emirate}`,
    title: copy.metaTitle,
    description: copy.metaDescription,
  });
}

export default async function EmiratePage({
  params,
}: {
  params: Promise<{ locale: Locale; emirate: string }>;
}) {
  const { locale, emirate } = await params;
  setRequestLocale(locale);
  const copy = emirateContent[locale][emirate as Emirate];
  if (!copy) notFound();
  const t = await getTranslations("landing");
  const tp = await getTranslations("providers");
  const [providers, count] = await Promise.all([
    getPublicProviders(),
    getActiveProviderCount(),
  ]);
  const preview = providers.filter((p) => p.status === "active").slice(0, 6);

  return (
    <>
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
            { "@type": "ListItem", position: 1, name: t("emiratesHubName"), item: absoluteUrl(localePath(locale, "/")) },
            { "@type": "ListItem", position: 2, name: copy.metaTitle, item: absoluteUrl(localePath(locale, `/e-invoicing/${emirate}`)) },
          ],
        }}
      />
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {t("emirateKicker")}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t("emirateTitle", { name: copy.name, count })}
          </h1>
          {copy.intro.map((p, i) => (
            <p key={i} className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-600">
              {p}
            </p>
          ))}
        </FadeIn>

        {/* Deadlines table — the facts searchers want, server-rendered */}
        <FadeIn>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 text-start font-semibold">{t("phaseCol")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("appointCol")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("goLiveCol")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {MANDATE_PHASES.map((p) => {
                  const pl = PHASE_LABELS[locale][p.key];
                  return (
                    <tr key={p.key} className="hover:bg-brand-50/30">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-ink-900">{pl.name}</span>
                        <span className="block text-xs text-ink-500">{pl.detail}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-700">
                        {formatMandateDate(p.appointDeadlineIso, locale)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-brand-800">
                        {formatMandateDate(p.goLiveIso, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FadeIn>

        {/* Local FAQ */}
        <FadeIn>
          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">{t("faqTitle")}</h2>
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

        {/* Provider preview */}
        <FadeIn>
          <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">
              {t("providersHeading", { name: copy.name })}
            </h2>
            <Link
              href="/providers"
              className="press hover-lift rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 hover:border-brand-300 hover:text-brand-800"
            >
              {t("viewAllProviders", { count })}
            </Link>
          </div>
        </FadeIn>
        <StaggerGroup className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((p) => (
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

        {/* Other emirates */}
        <FadeIn>
          <div className="mt-12">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              {t("otherEmirates")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EMIRATES.filter((e) => e !== emirate).map((e) => (
                <Link
                  key={e}
                  href={`/e-invoicing/${e}`}
                  className="press hover-lift rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300"
                >
                  {emirateContent[locale][e].name}
                </Link>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-br from-brand-800 to-brand-950 p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-bold">{t("emirateCtaTitle", { name: copy.name })}</h2>
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
