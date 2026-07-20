import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getDirectoryLastUpdated,
  formatDirectoryDate,
} from "@/lib/data";
import { SITE_NAME } from "@/lib/site";

export async function Footer() {
  const t = await getTranslations("common.footer");
  const locale = (await getLocale()) as "en" | "ar";
  const lastUpdated = await getDirectoryLastUpdated();

  return (
    <footer className="border-t border-ink-100 bg-ink-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-lg font-bold text-ink-900">{SITE_NAME}</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-600">
              {t("tagline")}
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-500 ring-1 ring-ink-200">
              <span className="size-1.5 animate-pulse-soft rounded-full bg-brand-500" aria-hidden />
              {t("lastUpdated", {
                date: formatDirectoryDate(lastUpdated, locale),
              })}
            </p>
          </div>

          <nav aria-label={t("directory")}>
            <p className="text-sm font-semibold text-ink-900">{t("directory")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/providers" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("allProviders")}
                </Link>
              </li>
              <li>
                <Link href="/registry" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("registry")}
                </Link>
              </li>
              <li>
                <Link href="/get-matched" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("getMatchedFree")}
                </Link>
              </li>
              <li>
                <Link href="/assessment" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("readinessCheck")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("faqTitle")}
                </Link>
              </li>
              <li>
                <Link href="/track" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("trackRequest")}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t("toolsGuides")}>
            <p className="text-sm font-semibold text-ink-900">{t("toolsGuides")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/toolkit" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("toolkit")}
                </Link>
              </li>
              <li>
                <Link href="/toolkit/penalty-calculator" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("penaltyCalculator")}
                </Link>
              </li>
              <li>
                <Link href="/toolkit/readiness-planner" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("readinessPlanner")}
                </Link>
              </li>
              <li>
                <Link href="/toolkit/checklist" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("checklist")}
                </Link>
              </li>
              <li>
                <Link href="/guides" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("guides")}
                </Link>
              </li>
              <li>
                <Link href="/integrations" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("integrations")}
                </Link>
              </li>
              <li>
                <Link href="/resources" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("resources")}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t("legal")}>
            <p className="text-sm font-semibold text-ink-900">{t("legal")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/about" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("aboutUs")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="link-slide inline-block text-ink-600 hover:text-brand-800 hover:translate-x-0.5 rtl:hover:-translate-x-0.5">
                  {t("disclaimer")}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t border-ink-200 pt-6">
          <p className="text-xs leading-relaxed text-ink-500">{t("notAffiliated")}</p>
          <p className="mt-2 text-xs text-ink-400">
            © {new Date().getFullYear()} {SITE_NAME}. {t("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
