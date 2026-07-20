import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { ReadinessQuiz } from "@/components/quiz/ReadinessQuiz";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quiz" });
  return pageMetadata({
    locale,
    path: "/assessment",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <Suspense>
        <ReadinessQuiz />
      </Suspense>
    </div>
  );
}
