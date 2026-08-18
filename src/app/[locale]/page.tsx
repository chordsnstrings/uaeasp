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
import { Arrow, Container, Eyebrow, Section, buttonClass } from "@/components/ui";

/**
 * The home page, laid out as the opening spread of a reference work.
 *
 * The version this replaces was a landing page: a badge, a headline, three
 * feature cards, three step circles, a banded CTA and a second banded CTA.
 * Every section shouted at the same volume, so none of them carried.
 *
 * Here the page has one large voice — the serif masthead over the spruce
 * block — and everything below it is set quietly and numbered. Sections 01
 * through 04 are an index, not a pitch deck: the reader is choosing what to
 * look at, which is what someone comparing accredited providers is actually
 * doing.
 */

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

  const tools = [
    { key: "calculator", href: "/toolkit/penalty-calculator", Icon: IconCalculator },
    { key: "planner", href: "/toolkit/readiness-planner", Icon: IconCalendar },
    { key: "checklist", href: "/toolkit/checklist", Icon: IconChecklist },
  ] as const;

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

      {/* Masthead. One serif line across the full measure, then the two
          things a visitor came for: a way to ask, and the date. */}
      <Section tone="dark">
        <Container className="py-16 sm:py-24 lg:py-28">
          <FadeIn>
            <Eyebrow tone="light">
              <span
                className="inline-block size-1.5 animate-pulse-soft rounded-full bg-accent-400"
                aria-hidden
              />
              {t("hero.badge", { date })}
            </Eyebrow>
          </FadeIn>

          <FadeIn delay={0.06}>
            <h1 className="display-serif mt-10 max-w-4xl text-[2.75rem] text-white sm:text-6xl lg:text-7xl">
              {t.rich("hero.title", {
                hl: (chunks) => <span className="hero-em">{chunks}</span>,
              })}
            </h1>
          </FadeIn>

          <div className="mt-14 grid items-start gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <FadeIn delay={0.1}>
                <p className="max-w-xl text-lg leading-relaxed text-brand-200">
                  {t("hero.subtitle", { count })}
                </p>
                <div className="mt-8">
                  <QuickLeadForm source="hero" />
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                  <Link href="/providers" className="group text-white hover:text-accent-300">
                    {t("hero.browseButton", { count })} <Arrow />
                  </Link>
                  <Link
                    href="/get-matched"
                    className="text-brand-300 underline-offset-4 hover:text-white hover:underline"
                  >
                    {t("hero.matchButton")}
                  </Link>
                </div>
              </FadeIn>
            </div>

            <FadeIn delay={0.14}>
              <Countdown targetIso={MANDATE_GO_LIVE_ISO} />
              <ul className="mt-8 space-y-3 border-t border-white/15 pt-6 text-sm text-brand-200">
                {[t("hero.trust1"), t("hero.trust2"), t("hero.trust3")].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg
                      className="mt-1.5 shrink-0 text-accent-400"
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M3 8.5L6.5 12L13 4.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </FadeIn>
          </div>
        </Container>
      </Section>

      {/* The totals. Left-aligned and hairline-divided: a summary row, not
          three centred trophies. */}
      <Section tone="sunken" bordered>
        <Container>
          <dl className="grid grid-cols-1 divide-y divide-ink-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
            {[
              { value: count, label: t("stats.providers"), isNumber: true },
              { value: 7, label: t("stats.emirates"), isNumber: true },
              { value: t("stats.costValue"), label: t("stats.cost"), isNumber: false },
            ].map((stat, i) => (
              <div key={stat.label} className={`py-10 ${i > 0 ? "sm:ps-10" : ""} sm:pe-10`}>
                <dd className="num text-4xl font-normal tracking-tight text-ink-900 sm:text-5xl">
                  {stat.isNumber ? (
                    <AnimatedNumber value={stat.value as number} />
                  ) : (
                    stat.value
                  )}
                </dd>
                <dt className="eyebrow mt-3 text-ink-500">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      {/* 01 — Why. Three numbered entries on hairlines rather than three
          bordered boxes: a list reads as reasoning, a row of cards reads as
          a feature comparison. */}
      <Container className="py-20 sm:py-28">
        <FadeIn>
          <Eyebrow index={1} />
          <h2 className="mt-8 max-w-2xl text-3xl font-medium tracking-tight text-ink-900 sm:text-4xl">
            {t.rich("why.title", { hl: (chunks) => <Highlight>{chunks}</Highlight> })}
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">
            {t("why.subtitle")}
          </p>
        </FadeIn>
        <StaggerGroup className="mt-14 grid gap-px border-t border-ink-200 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <StaggerItem key={i} className="border-b border-ink-200 md:border-b-0">
              <div className="py-8 md:pe-10">
                <span aria-hidden className="num text-[11px] text-ink-400">
                  {String(i).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-lg font-medium tracking-tight text-ink-900">
                  {t(`why.point${i}Title` as Parameters<typeof t>[0])}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-600">
                  {t(`why.point${i}Body` as Parameters<typeof t>[0])}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </Container>

      {/* 02 — The register itself */}
      <Section tone="sunken" bordered>
        <Container className="py-20 sm:py-28">
          <FadeIn>
            <Eyebrow index={2} />
            <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl font-medium tracking-tight text-ink-900 sm:text-4xl">
                  {t("directoryPreview.title")}
                </h2>
                <p className="mt-3 max-w-xl text-ink-600">
                  {t("directoryPreview.subtitle")}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/providers" className={buttonClass({ variant: "outline" })}>
                  {t("directoryPreview.viewAll")}
                </Link>
                <Link href="/registry" className={buttonClass({ variant: "outline" })}>
                  {t("directoryPreview.registryButton")}
                </Link>
              </div>
            </div>
          </FadeIn>
          <StaggerGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </Container>
      </Section>

      {/* 03 — The free tools, as an index of three lines */}
      <Container className="py-20 sm:py-28">
        <FadeIn>
          <Eyebrow index={3} />
          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="text-3xl font-medium tracking-tight text-ink-900 sm:text-4xl">
                {t("toolsTeaser.title")}
              </h2>
              <p className="mt-3 max-w-2xl text-ink-600">{t("toolsTeaser.subtitle")}</p>
            </div>
            <Link href="/toolkit" className={buttonClass({ variant: "outline" })}>
              {t("toolsTeaser.viewAll")}
            </Link>
          </div>
        </FadeIn>
        <StaggerGroup className="mt-12 border-t border-ink-200">
          {tools.map((tool) => (
            <StaggerItem key={tool.key}>
              <Link
                href={tool.href}
                className="group flex items-start gap-5 border-b border-ink-200 py-7 hover:bg-ink-50/60 sm:gap-8 sm:px-2"
              >
                <span aria-hidden className="mt-0.5 shrink-0 text-brand-700">
                  <tool.Icon size={22} />
                </span>
                <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-8">
                  <span className="block text-lg font-medium tracking-tight text-ink-900 group-hover:text-brand-800 sm:w-64 sm:shrink-0">
                    {th(`tools.${tool.key}.title` as Parameters<typeof th>[0])}
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-ink-600 sm:mt-0">
                    {th(`tools.${tool.key}.body` as Parameters<typeof th>[0])}
                  </span>
                </span>
                <span className="shrink-0 self-center text-sm text-ink-400 group-hover:text-brand-700">
                  <Arrow />
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </Container>

      {/* 04 — How it works */}
      <Section tone="sunken" bordered>
        <Container className="py-20 sm:py-28">
          <FadeIn>
            <Eyebrow index={4} />
            <h2 className="mt-8 max-w-2xl text-3xl font-medium tracking-tight text-ink-900 sm:text-4xl">
              {t("how.title")}
            </h2>
          </FadeIn>
          <StaggerGroup className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {[1, 2, 3].map((i) => (
              <StaggerItem key={i}>
                <div className="border-t border-ink-300 pt-6 md:pe-8">
                  <span aria-hidden className="num text-3xl font-normal text-ink-300">
                    {String(i).padStart(2, "0")}
                  </span>
                  <h3 className="mt-5 text-lg font-medium tracking-tight text-ink-900">
                    {t(`how.step${i}Title` as Parameters<typeof t>[0])}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-600">
                    {t(`how.step${i}Body` as Parameters<typeof t>[0])}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Container>
      </Section>

      {/* The questions, and then the one ask */}
      <Container className="py-20 sm:py-24">
        <FadeIn>
          <div className="flex flex-col items-start justify-between gap-6 border border-ink-200 bg-white p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-medium tracking-tight text-ink-900">
                {t("faqTeaser.title")}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600">
                {t("faqTeaser.subtitle")}
              </p>
            </div>
            <Link
              href="/faq"
              className={buttonClass({ variant: "outline", className: "shrink-0" })}
            >
              {t("faqTeaser.button")}
            </Link>
          </div>
        </FadeIn>
      </Container>

      <Section tone="dark">
        <Container className="py-20 sm:py-28">
          <FadeIn>
            <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
              <div>
                <h2 className="display-serif max-w-2xl text-4xl text-white sm:text-5xl">
                  {t.rich("finalCta.title", {
                    hl: (chunks) => <span className="hero-em">{chunks}</span>,
                  })}
                </h2>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-200">
                  {t("finalCta.subtitle")}
                </p>
              </div>
              <div className="lg:text-end">
                <Link
                  href="/get-matched"
                  className={buttonClass({ variant: "light", size: "lg" })}
                >
                  {t("finalCta.button")}
                </Link>
              </div>
            </div>
          </FadeIn>
        </Container>
      </Section>
    </>
  );
}
