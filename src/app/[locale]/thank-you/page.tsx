import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";
import { EnrichForm } from "@/components/lead-form/EnrichForm";
import { IconSeal } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "thankYou" });
  return {
    ...pageMetadata({
      locale,
      path: "/thank-you",
      title: t("metaTitle"),
      description: t("body"),
    }),
    robots: { index: false },
  };
}

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("thankYou");
  const { t: trackingToken } = await searchParams;
  const validToken =
    trackingToken &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackingToken)
      ? trackingToken
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <FadeIn>
        <span
          aria-hidden
          className="mx-auto grid size-16 animate-pop-in place-items-center rounded-full border border-brand-300 bg-brand-50 text-brand-800 ring-8 ring-brand-50/50"
        >
          <IconSeal size={34} />
        </span>
        <h1 className="mt-6 text-3xl font-medium tracking-tight text-ink-900 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-ink-600">
          {t("body")}
        </p>
      </FadeIn>

      <StaggerGroup className="mx-auto mt-10 max-w-md space-y-3 text-start">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-500">
          {t("whatNext")}
        </p>
        {[t("step1"), t("step2"), t("step3")].map((step, i) => (
          <StaggerItem key={step}>
            <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-4">
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-medium text-paper"
              >
                {i + 1}
              </span>
              <p className="text-sm font-medium text-ink-700">{step}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerGroup>

      {validToken && (
        <FadeIn>
          <div className="mx-auto mt-10 max-w-xl">
            <EnrichForm trackingToken={validToken} />
          </div>
        </FadeIn>
      )}

      {validToken && (
        <FadeIn>
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-brand-100 bg-brand-50 p-6 text-center">
            <p className="font-medium text-brand-900">{t("trackTitle")}</p>
            <p className="mt-1 text-sm text-brand-800/80">{t("trackBody")}</p>
            <Link
              href={`/track/${validToken}`}
              className="press mt-4 inline-block rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink-900"
            >
              {t("trackButton")}
            </Link>
          </div>
        </FadeIn>
      )}

      <FadeIn>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/providers"
            className="press rounded-xl bg-ink-900 px-5 py-3 font-medium text-paper hover:bg-ink-900"
          >
            {t("backHome")}
          </Link>
          <Link
            href="/faq"
            className="press rounded-xl border border-ink-200 px-5 py-3 font-medium text-ink-700 hover:border-brand-300 hover:text-brand-800"
          >
            {t("readFaq")}
          </Link>
        </div>
      </FadeIn>
    </div>
  );
}
