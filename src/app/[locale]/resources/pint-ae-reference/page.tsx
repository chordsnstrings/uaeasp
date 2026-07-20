import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, localePath, type Locale } from "@/lib/site";
import {
  DOC_TYPE_CODES,
  TRANSACTION_FLAGS,
  PINT_AE_VERSION,
} from "@/content/pint-ae";
import { JsonLd } from "@/components/seo/JsonLd";
import { FadeIn } from "@/components/motion";
import { PintFieldExplorer } from "@/components/toolkit/PintFieldExplorer";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "toolkit.pint" });
  return pageMetadata({
    locale,
    path: "/resources/pint-ae-reference",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function PintReferencePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("toolkit.pint");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: t("metaTitle"),
          description: t("metaDescription"),
          url: absoluteUrl(localePath(locale, "/resources/pint-ae-reference")),
          isBasedOn: "https://docs.peppol.eu/poac/pint/pint/",
          version: PINT_AE_VERSION,
        }}
      />
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {t("kicker")}
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-ink-600">{t("subtitle")}</p>
        </FadeIn>

        {/* Document type codes */}
        <FadeIn>
          <section className="mt-12">
            <h2 className="text-xl font-bold text-ink-900">{t("docTypesTitle")}</h2>
            <p className="mt-1 text-sm text-ink-500">{t("docTypesSubtitle")}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {DOC_TYPE_CODES.map((d) => (
                <article
                  key={d.code}
                  className="card-hover rounded-2xl border border-ink-100 bg-white p-5 transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-brand-700 font-mono text-sm font-extrabold text-white" dir="ltr">
                      {d.code}
                    </span>
                    <h3 className="font-bold text-ink-900">{d.name}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{d.description}</p>
                </article>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* Transaction type flags */}
        <FadeIn>
          <section className="mt-12">
            <h2 className="text-xl font-bold text-ink-900">{t("flagsTitle")}</h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">{t("flagsSubtitle")}</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3 text-start font-semibold">{t("flagName")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("flagValue")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("flagDescription")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {TRANSACTION_FLAGS.map((f) => (
                    <tr key={f.name} className="hover:bg-brand-50/30">
                      <td className="px-4 py-3 font-semibold text-ink-900">{f.name}</td>
                      <td className="px-4 py-3">
                        <code className="rounded-md bg-ink-900 px-2 py-0.5 font-mono text-xs font-bold text-white" dir="ltr">
                          {f.flags}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </FadeIn>

        {/* Field explorer */}
        <FadeIn>
          <section className="mt-12">
            <h2 className="text-xl font-bold text-ink-900">{t("fieldsTitle")}</h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">{t("fieldsSubtitle")}</p>
            <div className="mt-5">
              <PintFieldExplorer />
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <p className="mt-10 max-w-3xl text-xs leading-relaxed text-ink-400">
            {t("sourceNote", { version: PINT_AE_VERSION })}
          </p>
        </FadeIn>
      </div>
    </>
  );
}
