"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { m, AnimatePresence } from "@/components/motion";
import { ProviderCard } from "./ProviderCard";

export interface DirectoryProvider {
  id: string;
  slug: string;
  name: string;
  nameAr: string | null;
  website: string | null;
  description: string | null;
  descriptionAr: string | null;
  status: "active" | "delisted" | "hidden";
}

export function ProvidersDirectory({ providers }: { providers: DirectoryProvider[] }) {
  const t = useTranslations("providers");
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const deferredQuery = useDeferredValue(query);

  // Keep the search shareable/bookmarkable: reflect it in the address bar
  // without triggering navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
  }, [query]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameAr ?? "").includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [providers, deferredQuery]);

  const labels = {
    visitWebsite: t("visitWebsite"),
    viewProfile: t("viewProfile"),
    delistedBadge: t("delistedBadge"),
  };

  return (
    <div>
      <div className="relative max-w-md">
        <svg
          className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-full rounded-xl border border-ink-200 bg-white py-3 pe-4 ps-10 text-sm shadow-sm placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <m.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-12 rounded-2xl border border-dashed border-ink-200 p-12 text-center"
          >
            <p className="text-ink-500">{t("noResults")}</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="press mt-4 rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:border-brand-300 hover:text-brand-800"
            >
              {t("clearSearch")}
            </button>
          </m.div>
        ) : (
          <m.div
            key="grid"
            layout
            className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((p, i) => (
              <m.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3) }}
                className="relative"
              >
                <ProviderCard provider={p} labels={labels} />
              </m.div>
            ))}
            {/* Get-matched card slots into the grid to keep the funnel present */}
            <m.div layout key="cta" className="relative">
              <div className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-6 text-white shadow-lg">
                <div>
                  <h3 className="text-lg font-bold">
                    {t("getMatchedCard.title", { count: providers.length })}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-100">
                    {t("getMatchedCard.body")}
                  </p>
                </div>
                <Link
                  href="/get-matched"
                  className="press mt-5 inline-block rounded-lg bg-accent-500 px-4 py-2.5 text-center text-sm font-bold text-ink-950 hover:bg-accent-400"
                >
                  {t("getMatchedCard.button")}
                </Link>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
