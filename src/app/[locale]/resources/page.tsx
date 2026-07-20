import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resourcesContent } from "@/content/resources";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "resources" });
  return pageMetadata({
    locale,
    path: "/resources",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("resources");
  const groups = resourcesContent[locale];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <FadeIn>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-600">{t("subtitle")}</p>
      </FadeIn>

      <div className="mt-10 space-y-12">
        {groups.map((group) => (
          <section key={group.title}>
            <FadeIn>
              <h2 className="text-xl font-bold text-ink-900">{group.title}</h2>
            </FadeIn>
            <StaggerGroup className="mt-4 grid gap-4 sm:grid-cols-2">
              {group.items.map((item) => (
                <StaggerItem key={item.title}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener"
                      className="card-hover group flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-5 transition-transform"
                    >
                      <p className="font-semibold text-ink-900 group-hover:text-brand-800">
                        {item.title}{" "}
                        <span aria-hidden className="text-ink-300 transition-colors group-hover:text-brand-500">
                          ↗
                        </span>
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                        {item.description}
                      </p>
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="card-hover group flex h-full flex-col rounded-2xl border border-ink-100 bg-white p-5 transition-transform"
                    >
                      <p className="font-semibold text-ink-900 group-hover:text-brand-800">
                        {item.title}{" "}
                        <span
                          aria-hidden
                          className="inline-block text-brand-500 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                        >
                          →
                        </span>
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                        {item.description}
                      </p>
                    </Link>
                  )}
                </StaggerItem>
              ))}
            </StaggerGroup>
          </section>
        ))}
      </div>

      <FadeIn>
        <p className="mt-12 max-w-3xl text-xs leading-relaxed text-ink-400">{t("note")}</p>
      </FadeIn>
    </div>
  );
}
