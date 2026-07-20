import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProviderBySlug, getPublicProviders } from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, type Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { FadeIn } from "@/components/motion";
import { ProviderCard } from "@/components/providers/ProviderCard";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const providers = await getPublicProviders();
  return providers.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const provider = await getProviderBySlug(slug);
  if (!provider) return {};
  const t = await getTranslations({ locale, namespace: "providerDetail" });
  const name = locale === "ar" && provider.nameAr ? provider.nameAr : provider.name;
  return pageMetadata({
    locale,
    path: `/providers/${slug}`,
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name }),
  });
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const provider = await getProviderBySlug(slug);
  if (!provider) notFound();

  const t = await getTranslations("providerDetail");
  const tp = await getTranslations("providers");
  const tc = await getTranslations("common");
  const name = locale === "ar" && provider.nameAr ? provider.nameAr : provider.name;
  const description =
    (locale === "ar" && provider.descriptionAr
      ? provider.descriptionAr
      : provider.description) ?? t("noDescription", { name });

  const others = (await getPublicProviders())
    .filter((p) => p.slug !== slug && p.status === "active")
    .slice(0, 3);

  const listedSince = new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    year: "numeric",
    month: "long",
  }).format(provider.firstSeenAt);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: provider.name,
          url: provider.website ?? undefined,
          description,
          areaServed: "AE",
          email: provider.contacts[0]?.emails[0],
          telephone: provider.contacts[0]?.phones[0],
          contactPoint: provider.contacts
            .filter((c) => c.emails.length > 0 || c.phones.length > 0)
            .map((c) => ({
              "@type": "ContactPoint",
              contactType: "sales",
              name: c.name,
              email: c.emails[0],
              telephone: c.phones[0],
              areaServed: "AE",
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
              name: t("breadcrumbHome"),
              item: absoluteUrl(localePath(locale, "/")),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: t("breadcrumbProviders"),
              item: absoluteUrl(localePath(locale, "/providers")),
            },
            {
              "@type": "ListItem",
              position: 3,
              name: provider.name,
              item: absoluteUrl(localePath(locale, `/providers/${slug}`)),
            },
          ],
        }}
      />

      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <FadeIn>
          <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-brand-800">
                  {t("breadcrumbHome")}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/providers" className="hover:text-brand-800">
                  {t("breadcrumbProviders")}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-ink-800">{name}</li>
            </ol>
          </nav>

          <div className="mt-8 flex items-start gap-4">
            <span
              aria-hidden
              className="grid size-16 shrink-0 place-items-center rounded-2xl bg-brand-700 text-2xl font-bold text-white"
            >
              {provider.name.charAt(0)}
            </span>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                {name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    provider.status === "active"
                      ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200"
                      : "bg-ink-100 text-ink-600 ring-1 ring-ink-200"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${provider.status === "active" ? "bg-brand-500" : "bg-ink-400"}`}
                    aria-hidden
                  />
                  {provider.status === "active" ? t("statusActive") : t("statusDelisted")}
                </span>
                {provider.category && (
                  <span className="inline-flex rounded-full bg-accent-500/10 px-3 py-1 text-xs font-semibold text-accent-600 ring-1 ring-accent-500/30">
                    {tc(`categories.${provider.category}` as Parameters<typeof tc>[0])}
                  </span>
                )}
              </div>
            </div>
          </div>

          <section className="mt-10">
            <h2 className="text-xl font-bold text-ink-900">{t("about", { name })}</h2>
            <p className="mt-3 leading-relaxed text-ink-700">{description}</p>
          </section>

          <dl className="mt-8 grid gap-4 rounded-2xl border border-ink-100 bg-ink-50 p-6 sm:grid-cols-2">
            {provider.website && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {t("website")}
                </dt>
                <dd className="mt-1">
                  <a
                    href={provider.website}
                    rel="nofollow noopener"
                    target="_blank"
                    dir="ltr"
                    className="break-all font-medium text-brand-700 underline-offset-2 hover:underline"
                  >
                    {provider.website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {t("listedSince")}
              </dt>
              <dd className="mt-1 font-medium text-ink-800">{listedSince}</dd>
            </div>
            {provider.category && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {t("categoryLabel")}
                </dt>
                <dd className="mt-1 font-medium text-ink-800">
                  {tc(`categories.${provider.category}` as Parameters<typeof tc>[0])}
                </dd>
              </div>
            )}
          </dl>

          {/* Official contact details from the MOF list */}
          {provider.contacts.length > 0 && (
            <section className="mt-8 rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ink-900">{t("officialContacts")}</h2>
              <p className="mt-1 text-xs text-ink-400">{t("officialContactsNote")}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {provider.contacts.map((contact, i) => (
                  <div key={i} className="rounded-xl bg-ink-50 p-4">
                    {contact.name && (
                      <p className="font-semibold text-ink-900">{contact.name}</p>
                    )}
                    <div className="mt-1.5 space-y-1 text-sm">
                      {contact.emails.map((email) => (
                        <a
                          key={email}
                          href={`mailto:${email}`}
                          dir="ltr"
                          className="block break-all text-brand-700 underline-offset-2 hover:underline"
                        >
                          {email}
                        </a>
                      ))}
                      {contact.phones.map((phone) => (
                        <a
                          key={phone}
                          href={`tel:${phone}`}
                          dir="ltr"
                          className="block text-brand-700 underline-offset-2 hover:underline"
                        >
                          {phone}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Lead funnel CTA */}
          <section className="mt-10 rounded-3xl bg-gradient-to-br from-brand-800 to-brand-950 p-8 text-white sm:p-10">
            <h2 className="text-2xl font-bold">{t("compareCta.title", { name })}</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-brand-100">
              {t("compareCta.body", { name })}
            </p>
            <Link
              href={{
                pathname: "/get-matched",
                query: { ref: `provider:${slug}` },
              }}
              className="press mt-6 inline-block rounded-xl bg-accent-500 px-6 py-3.5 font-bold text-ink-950 shadow-lg shadow-accent-500/20 hover:bg-accent-400"
            >
              {t("compareCta.button")}
            </Link>
          </section>

          {others.length > 0 && (
            <section className="mt-14">
              <h2 className="text-xl font-bold text-ink-900">{t("othersTitle")}</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                {others.map((p) => (
                  <div key={p.id} className="relative">
                    <ProviderCard
                      provider={p}
                      labels={{
                        visitWebsite: tp("visitWebsite"),
                        viewProfile: tp("viewProfile"),
                        delistedBadge: tp("delistedBadge"),
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </FadeIn>
      </div>
    </>
  );
}
