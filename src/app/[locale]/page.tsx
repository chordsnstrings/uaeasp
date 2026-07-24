import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getPublicProviders,
  getActiveProviderCount,
  getDirectoryLastUpdated,
  formatDirectoryDate,
} from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, MANDATE_GO_LIVE_ISO, type Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { Countdown } from "@/components/home/Countdown";
import { QuickLeadForm } from "@/components/lead-form/QuickLeadForm";
import { ProviderCard } from "@/components/providers/ProviderCard";
import {
  FadeIn,
  StaggerGroup,
  StaggerItem,
  AnimatedNumber,
  Highlight,
} from "@/components/motion";
import { IconCalculator, IconCalendar, IconChecklist } from "@/components/icons";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const count = await getActiveProviderCount();
  const year = new Date().getFullYear();
  return pageMetadata({
    locale,
    path: "/",
    title: t("metaTitle", { count, year }),
    description: t("metaDescription", { count, year }),
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tp = await getTranslations("providers");
  const th = await getTranslations("toolkit.hub");
  const [providers, count, lastUpdated] = await Promise.all([
    getPublicProviders(),
    getActiveProviderCount(),
    getDirectoryLastUpdated(),
  ]);
  const preview = providers.filter((p) => p.status === "active").slice(0, 8);
  const date = formatDirectoryDate(lastUpdated, locale);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("directoryPreview.title"),
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

      {/* Hero — flat ink with grain, laid out like a document masthead */}
      <section className="grain relative overflow-hidden bg-brand-950 text-white">
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <FadeIn>
            <p className="num flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
              <span className="inline-block size-1.5 animate-pulse-soft rounded-full bg-accent-400" aria-hidden />
              {t("hero.badge", { date })}
              <span aria-hidden className="hidden h-px flex-1 bg-white/15 sm:block" />
            </p>
          </FadeIn>

          <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <FadeIn delay={0.06}>
                <h1 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                  {t.rich("hero.title", {
                    hl: (chunks) => <span className="hero-em">{chunks}</span>,
                  })}
                </h1>
              </FadeIn>
              <FadeIn delay={0.12}>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-100">
                  {t("hero.subtitle", { count })}
                </p>
              </FadeIn>
              <FadeIn delay={0.18}>
                <div className="mt-8">
                  <QuickLeadForm source="hero" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/providers"
                    className="press hover-lift rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white hover:border-white/60 hover:bg-white/5"
                  >
                    {t("hero.browseButton", { count })}
                  </Link>
                  <Link
                    href="/get-matched"
                    className="press px-2 py-2.5 text-sm font-medium text-brand-300 underline-offset-4 hover:text-white hover:underline"
                  >
                    {t("hero.matchButton")}
                  </Link>
                </div>
              </FadeIn>
            </div>

            {/* The deadline as a wall calendar — the hero's graphic element */}
            <FadeIn delay={0.14}>
              <div className="rounded-xl border border-white/15 p-5 sm:p-6">
                <Countdown targetIso={MANDATE_GO_LIVE_ISO} />
                <ul className="perforated mt-6 space-y-2.5 pt-5 text-sm text-brand-200">
                  {[t("hero.trust1"), t("hero.trust2"), t("hero.trust3")].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <svg className="mt-1 shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Stats band — a totals row off a summary sheet */}
      <section className="border-b border-ink-200 bg-paper-dark">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-ink-200 px-4 sm:px-6 rtl:divide-x-reverse">
          {[
            { value: count, label: t("stats.providers"), isNumber: true },
            { value: 7, label: t("stats.emirates"), isNumber: true },
            { value: t("stats.costValue"), label: t("stats.cost"), isNumber: false },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-8 text-center">
              <p className="num text-3xl font-semibold text-ink-900 sm:text-4xl">
                {stat.isNumber ? (
                  <AnimatedNumber value={stat.value as number} />
                ) : (
                  stat.value
                )}
              </p>
              <p className="num mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500 sm:text-xs">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <FadeIn>
          <p className="num flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400" aria-hidden>
            01 <span className="h-px w-10 bg-ink-300" />
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            {t.rich("why.title", { hl: (chunks) => <Highlight>{chunks}</Highlight> })}
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-600">
            {t("why.subtitle")}
          </p>
        </FadeIn>
        <StaggerGroup className="mt-12 grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <StaggerItem key={i}>
              <div className="card-hover group h-full rounded-xl border border-ink-200 bg-white p-6 transition-transform hover:border-ink-900">
                <span aria-hidden className="num text-sm font-semibold text-brand-700">
                  {String(i).padStart(2, "0")}
                </span>
                <div aria-hidden className="mt-3 h-px w-8 bg-ink-200 transition-all duration-300 group-hover:w-14 group-hover:bg-brand-400" />
                <h3 className="mt-4 text-lg font-semibold text-ink-900">
                  {t(`why.point${i}Title` as Parameters<typeof t>[0])}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  {t(`why.point${i}Body` as Parameters<typeof t>[0])}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* Directory preview */}
      <section className="border-y border-ink-200 bg-paper-dark py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="num flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400" aria-hidden>
                  02 <span className="h-px w-10 bg-ink-300" />
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
                  {t("directoryPreview.title")}
                </h2>
                <p className="mt-2 text-ink-600">{t("directoryPreview.subtitle")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/providers"
                  className="press hover-lift rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 hover:border-brand-300 hover:text-brand-800 hover:shadow-sm"
                >
                  {t("directoryPreview.viewAll")}
                </Link>
                <Link
                  href="/registry"
                  className="press hover-lift rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 hover:border-brand-300 hover:text-brand-800 hover:shadow-sm"
                >
                  {t("directoryPreview.registryButton")}
                </Link>
              </div>
            </div>
          </FadeIn>
          <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {preview.map((p, i) => (
              <StaggerItem key={p.id} className="relative min-w-0">
                <ProviderCard
                  provider={p}
                  serial={i + 1}
                  labels={{
                    visitWebsite: tp("visitWebsite"),
                    viewProfile: tp("viewProfile"),
                    delistedBadge: tp("delistedBadge"),
                  }}
                />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* Free tools teaser */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <FadeIn>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="num flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400" aria-hidden>
                03 <span className="h-px w-10 bg-ink-300" />
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
                {t("toolsTeaser.title")}
              </h2>
              <p className="mt-2 max-w-2xl text-ink-600">{t("toolsTeaser.subtitle")}</p>
            </div>
            <Link
              href="/toolkit"
              className="press hover-lift rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 hover:border-brand-300 hover:text-brand-800 hover:shadow-sm"
            >
              {t("toolsTeaser.viewAll")}
            </Link>
          </div>
        </FadeIn>
        <StaggerGroup className="mt-8 grid gap-5 sm:grid-cols-3">
          {(
            [
              { key: "calculator", href: "/toolkit/penalty-calculator", Icon: IconCalculator },
              { key: "planner", href: "/toolkit/readiness-planner", Icon: IconCalendar },
              { key: "checklist", href: "/toolkit/checklist", Icon: IconChecklist },
            ] as const
          ).map((tool) => (
            <StaggerItem key={tool.key}>
              <Link
                href={tool.href}
                className="card-hover group flex h-full flex-col rounded-xl border border-ink-200 bg-white p-6 transition-transform hover:border-ink-900"
              >
                <span
                  aria-hidden
                  className="grid size-11 place-items-center rounded-lg border border-ink-200 text-brand-800 transition-colors duration-300 group-hover:border-brand-400 group-hover:bg-brand-50"
                >
                  <tool.Icon size={22} />
                </span>
                <h3 className="mt-4 font-bold text-ink-900 group-hover:text-brand-800">
                  {th(`tools.${tool.key}.title` as Parameters<typeof th>[0])}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                  {th(`tools.${tool.key}.body` as Parameters<typeof th>[0])}
                </p>
                <span className="mt-4 text-sm font-semibold text-brand-700">
                  {th("open")}{" "}
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
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <FadeIn>
          <p className="num flex items-center justify-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400" aria-hidden>
            <span className="h-px w-10 bg-ink-300" /> 04 <span className="h-px w-10 bg-ink-300" />
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            {t("how.title")}
          </h2>
        </FadeIn>
        <StaggerGroup className="mt-12 grid gap-8 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <StaggerItem key={i}>
              <div className="relative text-center">
                <span
                  aria-hidden
                  className="num mx-auto grid size-14 place-items-center rounded-full border border-ink-900 bg-white text-lg font-semibold text-ink-900 transition-all duration-300 hover:-translate-y-1 hover:bg-ink-900 hover:text-white"
                >
                  {String(i).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink-900">
                  {t(`how.step${i}Title` as Parameters<typeof t>[0])}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-600">
                  {t(`how.step${i}Body` as Parameters<typeof t>[0])}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* FAQ teaser */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <FadeIn>
          <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-ink-200 bg-paper-dark p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-bold text-ink-900">{t("faqTeaser.title")}</h2>
              <p className="mt-2 max-w-xl text-ink-600">{t("faqTeaser.subtitle")}</p>
            </div>
            <Link
              href="/faq"
              className="press btn-shine hover-lift shrink-0 rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800"
            >
              {t("faqTeaser.button")}
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* Final CTA — flat ink with grain, bookending the hero */}
      <section className="grain relative overflow-hidden bg-brand-950 py-20 text-white">
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <FadeIn>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t.rich("finalCta.title", {
                hl: (chunks) => <span className="hero-em">{chunks}</span>,
              })}
            </h2>
            <p className="mt-4 text-lg text-brand-100">{t("finalCta.subtitle")}</p>
            <Link
              href="/get-matched"
              className="press btn-shine hover-lift mt-8 inline-block rounded-lg bg-accent-500 px-8 py-4 text-lg font-bold text-ink-950 shadow-[0_3px_0_rgb(2_6_23/0.4)] hover:bg-accent-400"
            >
              {t("finalCta.button")}
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
