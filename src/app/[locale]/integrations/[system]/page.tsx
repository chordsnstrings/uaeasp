import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  INTEGRATION_PAGE_KEYS,
  INTEGRATION_SYSTEMS,
  INTEGRATION_COPY,
  integrationPageCopy,
} from "@/content/integrations";
import { MandateFactsTable } from "@/components/seo/MandateFactsTable";
import { getPublicProviders } from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, type Locale } from "@/lib/site";
import { routing } from "@/i18n/routing";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";

/**
 * One page per accounting system.
 *
 * The hub at /integrations puts all twelve systems on a single URL, which is
 * why it ranks for none of them — the same failure /providers has against
 * generic phrases, and the same one the /lists pages were built to fix. Search
 * Console shows 143 impressions in 28 days for NetSuite integration queries
 * alone, at position 62-80, against no page targeting them.
 *
 * A page that answers one question ranks: every provider profile on this site
 * sits at position 5-8 for its own name on the same domain authority.
 */

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    INTEGRATION_PAGE_KEYS.map((system) => ({ locale, system })),
  );
}

function systemFor(key: string) {
  return INTEGRATION_SYSTEMS.find((s) => s.key === key) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; system: string }>;
}): Promise<Metadata> {
  const { locale, system } = await params;
  const copy = integrationPageCopy(locale, system);
  if (!copy) return {};
  return pageMetadata({
    locale,
    path: `/integrations/${system}`,
    title: copy.metaTitle,
    description: copy.metaDescription,
  });
}

export default async function IntegrationSystemPage({
  params,
}: {
  params: Promise<{ locale: Locale; system: string }>;
}) {
  const { locale, system } = await params;
  setRequestLocale(locale);

  const copy = integrationPageCopy(locale, system);
  const sys = systemFor(system);
  if (!copy || !sys) notFound();

  const t = await getTranslations("integrations");
  const tp = await getTranslations("providers");
  const detail = INTEGRATION_COPY[locale][system] ?? INTEGRATION_COPY.en[system];
  const providers = await getPublicProviders();

  // Providers that name this system in their own description. Nothing here
  // claims support on a provider's behalf — it reports what they published and
  // links to the profile so the reader can check. An invented integration
  // claim would be worse for a directory than an empty list.
  const naming = providers.filter((p) => {
    if (p.status !== "active") return false;
    const haystack = `${p.description ?? ""} ${p.descriptionAr ?? ""}`.toLowerCase();
    return copy.match.some((term) => haystack.includes(term));
  });

  const siblings = INTEGRATION_PAGE_KEYS.filter((k) => k !== system);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
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
              name: t("title"),
              item: absoluteUrl(localePath(locale, "/integrations")),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: copy.h1,
              item: absoluteUrl(localePath(locale, `/integrations/${system}`)),
            },
          ],
        }}
      />

      <FadeIn>
        <nav className="text-xs text-ink-500">
          <Link href="/integrations" className="hover:text-brand-700">
            {t("title")}
          </Link>
          <span className="mx-1.5 text-ink-300">/</span>
          <span className="text-ink-700">{sys.name}</span>
        </nav>
        <h1 className="mt-3 max-w-3xl font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          {copy.h1}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-600">{copy.intro}</p>
      </FadeIn>

      <FadeIn>
        <dl className="mt-8 grid gap-4 rounded-2xl border border-ink-100 bg-white p-6 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              {t("routeLabel")}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-ink-700">{detail.route}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              {t("timelineLabel")}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-ink-700">{detail.timeline}</dd>
          </div>
          <div className="sm:col-span-2">
            <dd className="text-sm leading-relaxed text-ink-600">{detail.blurb}</dd>
          </div>
        </dl>
      </FadeIn>

      <section className="mt-12">
        <FadeIn>
          <h2 className="font-display text-2xl font-bold text-ink-900">
            Accredited providers that mention {sys.name}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
            {naming.length > 0 ? (
              <>
                {naming.length} of the accredited providers name {sys.name} in their own
                published description. That is their claim, not ours — open a profile and
                check it against your own version and customisations before shortlisting.
              </>
            ) : (
              <>
                No accredited provider currently names {sys.name} in its published
                description. That does not mean none support it — most publish very little
                detail — so ask directly, or tell us your setup and we will ask for you.
              </>
            )}
          </p>
        </FadeIn>

        {naming.length > 0 && (
          <StaggerGroup className="mt-6 grid gap-4 sm:grid-cols-2">
            {naming.map((p, i) => (
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
        )}

        <FadeIn>
          <div className="mt-8 rounded-2xl border border-brand-200 bg-brand-50/60 p-6">
            <p className="font-display text-lg font-bold text-ink-900">
              Not sure which one fits your {sys.name} setup?
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
              Tell us your version, invoice volume and timeline. We will come back with a
              short list of accredited providers that have done it before. Free, and we are
              not one of them.
            </p>
            <Link
              href="/get-matched"
              className="press mt-4 inline-flex rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
            >
              Get matched free
            </Link>
          </div>
        </FadeIn>
      </section>

      <section className="mt-12">
        <FadeIn>
          <h2 className="font-display text-2xl font-bold text-ink-900">The mandate, in short</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
            The dates below decide when {sys.name} has to be connected, not the integration
            itself. Appointing a provider is the deadline that comes first.
          </p>
        </FadeIn>
        <div className="mt-5">
          <MandateFactsTable locale={locale} />
        </div>
      </section>

      <section className="mt-12">
        <FadeIn>
          <h2 className="font-display text-2xl font-bold text-ink-900">Common questions</h2>
        </FadeIn>
        <dl className="mt-5 space-y-5">
          {copy.faq.map((f) => (
            <div key={f.q} className="rounded-2xl border border-ink-100 bg-white p-5">
              <dt className="font-semibold text-ink-900">{f.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-600">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {siblings.length > 0 && (
        <section className="mt-12 border-t border-ink-100 pt-8">
          <h2 className="font-display text-lg font-bold text-ink-900">Other systems</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {siblings.map((key) => {
              const other = systemFor(key);
              if (!other) return null;
              return (
                <li key={key}>
                  <Link
                    href={`/integrations/${key}`}
                    className="press inline-flex rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800"
                  >
                    {other.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
