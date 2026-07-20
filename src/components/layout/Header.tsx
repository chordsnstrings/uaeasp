"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { m, AnimatePresence } from "@/components/motion";

const NAV_ITEMS = [
  { href: "/providers", key: "providers" },
  { href: "/registry", key: "registry" },
  { href: "/assessment", key: "assessment" },
  { href: "/faq", key: "faq" },
  { href: "/track", key: "track" },
] as const;

export function Header() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink-900 hover:opacity-80"
          onClick={() => setOpen(false)}
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-lg bg-brand-700 text-sm font-black text-white"
          >
            ⚡
          </span>
          <span>{t("siteName")}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`press rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-brand-50 text-brand-800"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                }`}
              >
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={pathname}
            locale={locale === "en" ? "ar" : "en"}
            className="press rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 hover:border-brand-300 hover:text-brand-800"
            aria-label={t("localeSwitcher.label")}
          >
            {locale === "en" ? t("localeSwitcher.ar") : t("localeSwitcher.en")}
          </Link>
          <Link
            href="/get-matched"
            className="press hidden rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 sm:block"
          >
            {t("nav.getMatched")}
          </Link>
          <button
            type="button"
            className="press grid size-10 place-items-center rounded-lg text-ink-700 hover:bg-ink-50 md:hidden"
            aria-expanded={open}
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              {open ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <m.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden border-t border-ink-100 bg-white md:hidden"
            aria-label="Mobile"
          >
            <div className="space-y-1 px-4 py-3">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="press block rounded-lg px-3 py-2.5 text-base font-medium text-ink-700 hover:bg-ink-50"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              ))}
              <Link
                href="/get-matched"
                onClick={() => setOpen(false)}
                className="press block rounded-lg bg-brand-700 px-3 py-2.5 text-center text-base font-semibold text-white"
              >
                {t("nav.getMatched")}
              </Link>
            </div>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
