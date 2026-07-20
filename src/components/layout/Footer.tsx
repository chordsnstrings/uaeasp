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
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="text-lg font-bold text-ink-900">{SITE_NAME}</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-600">
              {t("tagline")}
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-500 ring-1 ring-ink-200">
              <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
              {t("lastUpdated", {
                date: formatDirectoryDate(lastUpdated, locale),
              })}
            </p>
          </div>

          <nav aria-label={t("directory")}>
            <p className="text-sm font-semibold text-ink-900">{t("directory")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/providers" className="text-ink-600 hover:text-brand-800">
                  {t("allProviders")}
                </Link>
              </li>
              <li>
                <Link href="/registry" className="text-ink-600 hover:text-brand-800">
                  {t("registry")}
                </Link>
              </li>
              <li>
                <Link href="/get-matched" className="text-ink-600 hover:text-brand-800">
                  {t("getMatchedFree")}
                </Link>
              </li>
              <li>
                <Link href="/assessment" className="text-ink-600 hover:text-brand-800">
                  {t("readinessCheck")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-ink-600 hover:text-brand-800">
                  {t("faqTitle")}
                </Link>
              </li>
              <li>
                <Link href="/track" className="text-ink-600 hover:text-brand-800">
                  {t("trackRequest")}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t("legal")}>
            <p className="text-sm font-semibold text-ink-900">{t("legal")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-ink-600 hover:text-brand-800">
                  {t("aboutUs")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-ink-600 hover:text-brand-800">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="text-ink-600 hover:text-brand-800">
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
