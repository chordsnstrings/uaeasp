import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { INTEGRATION_SYSTEMS, INTEGRATION_COPY } from "@/content/integrations";
import { getActiveProviderCount } from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "integrations" });
  const count = await getActiveProviderCount();
  return pageMetadata({
    locale,
    path: "/integrations",
    title: t("metaTitle", { count }),
    description: t("metaDescription", { count }),
  });
}

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("integrations");
  const count = await getActiveProviderCount();
  const copy = INTEGRATION_COPY[locale];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <FadeIn>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-600">{t("subtitle", { count })}</p>
      </FadeIn>

      <StaggerGroup className="mt-10 grid gap-5 md:grid-cols-2">
        {INTEGRATION_SYSTEMS.map((sys) => {
          const c = copy[sys.key];
          return (
            <StaggerItem key={sys.key}>
              <article className="card-hover flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-6 transition-transform">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-ink-900">{sys.name}</h2>
                  <span className="shrink-0 rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-500 ring-1 ring-ink-100">
                    {t(`tiers.${sys.tier}` as Parameters<typeof t>[0])}
                  </span>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-600">{c.blurb}</p>
                <dl className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-ink-800">{t("routeLabel")}</dt>
                    <dd className="text-ink-600">{c.route}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-ink-800">{t("timelineLabel")}</dt>
                    <dd className="text-ink-600">{c.timeline}</dd>
                  </div>
                </dl>
              </article>
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      <FadeIn>
        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-ink-400">{t("disclaimer")}</p>
      </FadeIn>

      <FadeIn>
        <div className="mt-10 flex flex-col items-start justify-between gap-6 grain relative overflow-hidden rounded-xl bg-brand-950 p-8 text-white sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-bold">{t("ctaTitle")}</h2>
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
  );
}
