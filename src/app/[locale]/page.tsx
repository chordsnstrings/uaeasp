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
import { ProviderCard } from "@/components/providers/ProviderCard";
import {
  FadeIn,
  StaggerGroup,
  StaggerItem,
  AnimatedNumber,
  Highlight,
} from "@/components/motion";

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

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(45,212,191,.4) 0, transparent 40%), radial-gradient(circle at 80% 0%, rgba(251,191,36,.25) 0, transparent 45%)",
          }}
        />
        {/* Slow-drifting glow blobs give the hero gentle life */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 start-1/4 size-96 animate-float-slow rounded-full bg-brand-400/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 end-1/4 size-80 animate-float-slower rounded-full bg-accent-400/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <FadeIn>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/20">
              <span className="size-1.5 animate-pulse-soft rounded-full bg-brand-300" aria-hidden />
              {t("hero.badge", { date })}
            </span>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {t.rich("hero.title", {
                hl: (chunks) => <span className="hero-em">{chunks}</span>,
              })}
            </h1>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-100">
              {t("hero.subtitle", { count })}
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <Countdown targetIso={MANDATE_GO_LIVE_ISO} />
          </FadeIn>
          <FadeIn delay={0.24}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/get-matched"
                className="press btn-shine hover-lift rounded-xl bg-accent-500 px-6 py-3.5 text-base font-bold text-ink-950 shadow-lg shadow-accent-500/25 hover:bg-accent-400 hover:shadow-xl hover:shadow-accent-500/30"
              >
                {t("hero.matchButton")}
              </Link>
              <Link
                href="/providers"
                className="press hover-lift rounded-xl bg-white/10 px-6 py-3.5 text-base font-semibold text-white ring-1 ring-white/25 hover:bg-white/15 hover:ring-white/40"
              >
                {t("hero.browseButton", { count })}
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.32}>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-200">
              {[t("hero.trust1"), t("hero.trust2"), t("hero.trust3")].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-b border-ink-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-ink-100 px-4 sm:px-6 rtl:divide-x-reverse">
          {[
            { value: count, label: t("stats.providers"), isNumber: true },
            { value: 7, label: t("stats.emirates"), isNumber: true },
            { value: t("stats.costValue"), label: t("stats.cost"), isNumber: false },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-8 text-center">
              <p className="text-3xl font-extrabold text-brand-800 sm:text-4xl">
                {stat.isNumber ? (
                  <AnimatedNumber value={stat.value as number} />
                ) : (
                  stat.value
                )}
              </p>
              <p className="mt-1 text-xs font-medium text-ink-500 sm:text-sm">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <FadeIn>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            {t.rich("why.title", { hl: (chunks) => <Highlight>{chunks}</Highlight> })}
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-600">
            {t("why.subtitle")}
          </p>
        </FadeIn>
        <StaggerGroup className="mt-12 grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <StaggerItem key={i}>
              <div className="card-hover group h-full rounded-2xl border border-ink-100 bg-white p-6 transition-transform">
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-xl bg-brand-50 text-lg font-bold text-brand-800 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
                >
                  {i}
                </span>
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
      <section className="bg-ink-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-ink-900">
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
            {preview.map((p) => (
              <StaggerItem key={p.id} className="relative">
                <ProviderCard
                  provider={p}
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
              <h2 className="text-3xl font-bold tracking-tight text-ink-900">
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
              { key: "calculator", href: "/toolkit/penalty-calculator", emoji: "🧮" },
              { key: "planner", href: "/toolkit/readiness-planner", emoji: "🗓️" },
              { key: "checklist", href: "/toolkit/checklist", emoji: "✅" },
            ] as const
          ).map((tool) => (
            <StaggerItem key={tool.key}>
              <Link
                href={tool.href}
                className="card-hover group flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-6 transition-transform"
              >
                <span
                  aria-hidden
                  className="grid size-11 place-items-center rounded-xl bg-brand-50 text-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
                >
                  {tool.emoji}
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
          <h2 className="text-center text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            {t("how.title")}
          </h2>
        </FadeIn>
        <StaggerGroup className="mt-12 grid gap-8 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <StaggerItem key={i}>
              <div className="relative text-center">
                <span
                  aria-hidden
                  className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-700 text-xl font-extrabold text-white shadow-lg shadow-brand-700/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-700/30"
                >
                  {i}
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
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-brand-100 bg-brand-50 p-8 sm:flex-row sm:items-center sm:p-10">
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

      {/* Final CTA */}
      <section className="bg-gradient-to-b from-brand-900 to-brand-950 py-20 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <FadeIn>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t.rich("finalCta.title", {
                hl: (chunks) => <span className="hero-em">{chunks}</span>,
              })}
            </h2>
            <p className="mt-4 text-lg text-brand-100">{t("finalCta.subtitle")}</p>
            <Link
              href="/get-matched"
              className="press btn-shine hover-lift mt-8 inline-block rounded-xl bg-accent-500 px-8 py-4 text-lg font-bold text-ink-950 shadow-lg shadow-accent-500/25 hover:bg-accent-400 hover:shadow-xl hover:shadow-accent-500/30"
            >
              {t("finalCta.button")}
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
