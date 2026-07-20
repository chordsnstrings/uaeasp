import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/site";

export const metadata: Metadata = { robots: { index: false } };

export default async function OfflinePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("offline");
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p aria-hidden className="text-6xl">📡</p>
      <h1 className="mt-4 text-2xl font-bold text-ink-900">{t("title")}</h1>
      <p className="mt-2 text-ink-600">{t("body")}</p>
    </div>
  );
}
