import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";
import {
  IconCalculator,
  IconCalendar,
  IconChecklist,
  IconGauge,
  IconMagnifier,
} from "@/components/icons";

export const revalidate = 86400;

const TOOLS = [
  { key: "calculator", href: "/toolkit/penalty-calculator", Icon: IconCalculator },
  { key: "planner", href: "/toolkit/readiness-planner", Icon: IconCalendar },
  { key: "checklist", href: "/toolkit/checklist", Icon: IconChecklist },
  { key: "assessment", href: "/assessment", Icon: IconGauge },
  { key: "pint", href: "/resources/pint-ae-reference", Icon: IconMagnifier },
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
              className="card-hover group flex h-full flex-col rounded-xl border border-ink-200 bg-white p-6 transition-transform hover:border-ink-900"
            >
              <span
                aria-hidden
                className="grid size-12 place-items-center rounded-lg border border-ink-200 text-brand-800 transition-colors duration-300 group-hover:border-brand-400 group-hover:bg-brand-50"
              >
                <tool.Icon size={24} />
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
        <div className="mt-12 flex flex-col items-start justify-between gap-6 grain relative overflow-hidden rounded-xl bg-brand-950 p-8 text-white sm:flex-row sm:items-center sm:p-10">
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
