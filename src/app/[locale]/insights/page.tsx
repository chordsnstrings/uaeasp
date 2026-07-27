import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPublishedArticles } from "@/lib/insights";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";

export const revalidate = 3600;

const COPY = {
  en: {
    title: "E-invoicing insights",
    subtitle:
      "Reference notes on the UAE e-invoicing mandate: deadlines, formats, provider selection and what each rule means in practice.",
    empty: "No articles published yet.",
    read: "Read",
  },
  ar: {
    title: "رؤى الفوترة الإلكترونية",
    subtitle:
      "ملاحظات مرجعية حول تفويض الفوترة الإلكترونية في الإمارات: المواعيد النهائية والصيغ واختيار المزود وما تعنيه كل قاعدة عملياً.",
    empty: "لم يتم نشر أي مقالات بعد.",
    read: "اقرأ",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = COPY[locale];
  return pageMetadata({
    locale,
    path: "/insights",
    // The root layout already appends the site name via its title template.
    title: copy.title,
    description: copy.subtitle,
  });
}

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const copy = COPY[locale];
  const articles = await getPublishedArticles(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <FadeIn>
        <p className="num flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-400">
          {locale === "ar" ? "مرجع" : "Reference"}
          <span aria-hidden className="h-px w-10 bg-ink-300" />
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-600">{copy.subtitle}</p>
      </FadeIn>

      {articles.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-ink-300 p-12 text-center text-ink-500">
          {copy.empty}
        </p>
      ) : (
        <StaggerGroup className="mt-10 space-y-4">
          {articles.map((article, i) => (
            <StaggerItem key={article.id}>
              <Link
                href={`/insights/${article.slug}`}
                className="card-hover group block rounded-xl border border-ink-200 bg-white p-6 transition-transform hover:border-ink-900"
              >
                <span className="num text-xs text-ink-400" dir="ltr">
                  № {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-2 text-xl font-semibold text-ink-900 group-hover:text-brand-800">
                  {article.title}
                </h2>
                {article.summary && (
                  <p className="mt-2 leading-relaxed text-ink-600">{article.summary}</p>
                )}
                <p className="num mt-4 border-t border-dashed border-ink-200 pt-3 text-sm font-medium text-brand-700">
                  {copy.read}{" "}
                  <span
                    aria-hidden
                    className="inline-block transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  >
                    →
                  </span>
                </p>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  );
}
