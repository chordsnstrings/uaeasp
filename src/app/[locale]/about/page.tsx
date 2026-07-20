import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { FadeIn } from "@/components/motion";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMetadata({
    locale,
    path: "/about",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const tc = await getTranslations("common");

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <FadeIn>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          {t("title")}
        </h1>
        <div className="mt-6 space-y-5 leading-relaxed text-ink-700">
          <p>{t("body1")}</p>
          <p>{t("body2")}</p>
          <p>{t("body3")}</p>
        </div>
        <h2 className="mt-10 text-xl font-bold text-ink-900">{t("howWeKeepCurrent")}</h2>
        <p className="mt-3 leading-relaxed text-ink-700">{t("howWeKeepCurrentBody")}</p>
        <div className="mt-10">
          <Link
            href="/get-matched"
            className="press btn-shine hover-lift inline-block rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800"
          >
            {tc("nav.getMatched")}
          </Link>
        </div>
      </FadeIn>
    </div>
  );
}
