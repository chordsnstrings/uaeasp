import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { FadeIn } from "@/components/motion";
import { TrackLookupForm } from "@/components/track/TrackLookupForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "track" });
  return {
    ...pageMetadata({
      locale,
      path: "/track",
      title: t("metaTitle"),
      description: t("subtitle"),
    }),
    robots: { index: false },
  };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("track");

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <FadeIn>
        <h1 className="text-center text-3xl font-extrabold tracking-tight text-ink-900">
          {t("title")}
        </h1>
        <p className="mt-3 text-center text-ink-600">{t("subtitle")}</p>
        <div className="mt-8">
          <TrackLookupForm />
        </div>
      </FadeIn>
    </div>
  );
}
