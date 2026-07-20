import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  formatDirectoryDate,
  getActiveProviderCount,
  getDirectoryLastUpdated,
  getPublicProviders,
} from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, MOF_SOURCE_URL, type Locale } from "@/lib/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { FadeIn } from "@/components/motion";
import type { ProviderContact } from "@/db/schema";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "registry" });
  const [count, lastUpdated] = await Promise.all([
    getActiveProviderCount(),
    getDirectoryLastUpdated(),
  ]);
  const year = new Date().getFullYear();
  return pageMetadata({
    locale,
    path: "/registry",
    title: t("metaTitle", { count, year }),
    description: t("metaDescription", {
      count,
      date: formatDirectoryDate(lastUpdated, locale),
    }),
  });
}

function ContactCell({ contacts, field }: { contacts: ProviderContact[]; field: "name" | "email" | "phone" }) {
  const lines: { text: string; href?: string }[] = [];
  for (const contact of contacts) {
    if (field === "name" && contact.name) lines.push({ text: contact.name });
    if (field === "email") {
      for (const email of contact.emails) lines.push({ text: email, href: `mailto:${email}` });
    }
    if (field === "phone") {
      for (const phone of contact.phones) lines.push({ text: phone, href: `tel:${phone}` });
    }
  }
  if (lines.length === 0) return <span className="text-ink-300">—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {lines.map((line, i) =>
        line.href ? (
          <a key={i} href={line.href} dir="ltr" className="text-brand-700 underline-offset-2 hover:underline">
            {line.text}
          </a>
        ) : (
          <span key={i}>{line.text}</span>
        ),
      )}
    </span>
  );
}

export default async function RegistryPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("registry");
  const [providers, count, lastUpdated] = await Promise.all([
    getPublicProviders(),
    getActiveProviderCount(),
    getDirectoryLastUpdated(),
  ]);
  const active = providers.filter((p) => p.status === "active");
  const date = formatDirectoryDate(lastUpdated, locale);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: t("title"),
          description: t("metaDescription", { count, date }),
          url: absoluteUrl(localePath(locale, "/registry")),
          dateModified: new Date(await getDirectoryLastUpdated()).toISOString(),
          isBasedOn: MOF_SOURCE_URL,
          license: "https://creativecommons.org/licenses/by/4.0/",
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("title"),
          numberOfItems: active.length,
          itemListElement: active.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: p.name,
            url: absoluteUrl(localePath(locale, `/providers/${p.slug}`)),
          })),
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <FadeIn>
          <h1 className="max-w-4xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-ink-600">
            {t("subtitle", { count, date })}
          </p>
          <div className="mt-6 max-w-3xl space-y-3 rounded-2xl border border-ink-100 bg-ink-50 p-5 text-sm leading-relaxed text-ink-600">
            <p>{t("intro1")}</p>
            <p>{t("intro2")}</p>
          </div>
        </FadeIn>

        {/* Desktop table */}
        <FadeIn>
          <div className="mt-10 hidden overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm print:block md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 text-start font-semibold">{t("th.num")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("th.company")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("th.website")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("th.contact")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("th.email")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("th.phone")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {active.map((p, i) => (
                  <tr key={p.id} className="align-top hover:bg-brand-50/30">
                    <td className="px-4 py-3.5 text-ink-400">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/providers/${p.slug}`}
                        className="font-semibold text-ink-900 hover:text-brand-800"
                      >
                        {locale === "ar" && p.nameAr ? p.nameAr : p.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-400">
                        <Link href={`/providers/${p.slug}`} className="group hover:text-brand-700">
                          {t("viewProfile")}{" "}
                          <span
                            aria-hidden
                            className="inline-block transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                          >
                            →
                          </span>
                        </Link>
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      {p.website ? (
                        <a
                          href={p.website}
                          rel="nofollow noopener"
                          target="_blank"
                          dir="ltr"
                          className="break-all text-brand-700 underline-offset-2 hover:underline"
                        >
                          {p.website.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-ink-700">
                      <ContactCell contacts={p.contacts} field="name" />
                    </td>
                    <td className="px-4 py-3.5">
                      <ContactCell contacts={p.contacts} field="email" />
                    </td>
                    <td className="px-4 py-3.5">
                      <ContactCell contacts={p.contacts} field="phone" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>

        {/* Mobile cards */}
        <div className="mt-8 space-y-4 md:hidden print:hidden">
          {active.map((p, i) => (
            <article key={p.id} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-ink-400">#{i + 1}</p>
              <h2 className="mt-1 font-bold text-ink-900">
                <Link href={`/providers/${p.slug}`} className="hover:text-brand-800">
                  {locale === "ar" && p.nameAr ? p.nameAr : p.name}
                </Link>
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                {p.website && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">
                      {t("th.website")}
                    </dt>
                    <dd>
                      <a href={p.website} rel="nofollow noopener" target="_blank" dir="ltr" className="break-all text-brand-700">
                        {p.website.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    </dd>
                  </div>
                )}
                {p.contacts.length > 0 && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">
                      {t("th.contact")}
                    </dt>
                    <dd className="space-y-1.5">
                      {p.contacts.map((c, j) => (
                        <div key={j}>
                          {c.name && <p className="font-medium text-ink-800">{c.name}</p>}
                          {c.emails.map((e) => (
                            <a key={e} href={`mailto:${e}`} dir="ltr" className="block break-all text-brand-700">
                              {e}
                            </a>
                          ))}
                          {c.phones.map((ph) => (
                            <a key={ph} href={`tel:${ph}`} dir="ltr" className="block text-brand-700">
                              {ph}
                            </a>
                          ))}
                        </div>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
              <Link
                href={`/providers/${p.slug}`}
                className="press mt-4 inline-block rounded-lg border border-ink-200 px-3.5 py-2 text-xs font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800"
              >
                {t("viewProfile")} →
              </Link>
            </article>
          ))}
        </div>

        {/* Funnel CTA */}
        <FadeIn>
          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-br from-brand-800 to-brand-950 p-8 text-white sm:flex-row sm:items-center sm:p-10 print:hidden">
            <div>
              <h2 className="text-2xl font-bold">{t("matchCta.title", { count })}</h2>
              <p className="mt-2 max-w-xl text-brand-100">{t("matchCta.body")}</p>
            </div>
            <Link
              href="/get-matched"
              className="press btn-shine hover-lift shrink-0 rounded-xl bg-accent-500 px-6 py-3.5 font-bold text-ink-950 shadow-lg shadow-accent-500/20 hover:bg-accent-400"
            >
              {t("matchCta.button")}
            </Link>
          </div>
        </FadeIn>
      </div>
    </>
  );
}
