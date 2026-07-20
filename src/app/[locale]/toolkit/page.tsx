import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";

export const revalidate = 86400;

const TOOLS = [
  { key: "calculator", href: "/toolkit/penalty-calculator", emoji: "🧮" },
  { key: "planner", href: "/toolkit/readiness-planner", emoji: "🗓️" },
  { key: "checklist", href: "/toolkit/checklist", emoji: "✅" },
  { key: "assessment", href: "/assessment", emoji: "📋" },
  { key: "pint", href: "/resources/pint-ae-reference", emoji: "🔎" },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "toolkit.hub" });
  return pageMetadata({
    locale,
    path: "/toolkit",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function ToolkitPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("toolkit.hub");

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <FadeIn>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-600">{t("subtitle")}</p>
      </FadeIn>

      <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <StaggerItem key={tool.key}>
            <Link
              href={tool.href}
              className="card-hover group flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-6 transition-transform"
            >
              <span
                aria-hidden
                className="grid size-12 place-items-center rounded-xl bg-brand-50 text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
              >
                {tool.emoji}
              </span>
              <h2 className="mt-4 text-lg font-bold text-ink-900 group-hover:text-brand-800">
                {t(`tools.${tool.key}.title` as Parameters<typeof t>[0])}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                {t(`tools.${tool.key}.body` as Parameters<typeof t>[0])}
              </p>
              <span className="mt-4 text-sm font-semibold text-brand-700">
                {t("open")}{" "}
                <span
                  aria-hidden
                  className="inline-block transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                >
                  →
                </span>
              </span>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <FadeIn>
        <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-br from-brand-800 to-brand-950 p-8 text-white sm:flex-row sm:items-center sm:p-10">
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
