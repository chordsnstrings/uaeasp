"use client";

import { useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
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
  category: string | null;
}

const CATEGORIES = [
  "erp",
  "tax-tech",
  "consulting",
  "edi-network",
  "enterprise-software",
  "fintech",
] as const;

const PAGE_SIZE = 12;

export function ProvidersDirectory({ providers }: { providers: DirectoryProvider[] }) {
  const t = useTranslations("providers");
  const tc = useTranslations("common");
  // Defaults render on the server (full first page of cards in the HTML —
  // important for SEO); URL params are applied after mount.
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const searchExpanded = searchFocused || query.length > 0;
  const listTopRef = useRef<HTMLDivElement>(null);
  const skippedFirstWrite = useRef(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("q");
    if (q) setQuery(q);
    const c = sp.get("category");
    if (c) setCategory(c);
    const pg = Number(sp.get("page"));
    if (Number.isInteger(pg) && pg > 1) setPage(pg);
  }, []);

  // Keep search + filter + page shareable/bookmarkable: reflect them in the
  // address bar without triggering navigation. The very first run (default
  // state, before URL params are applied) is skipped so deep links survive.
  useEffect(() => {
    if (!skippedFirstWrite.current) {
      skippedFirstWrite.current = true;
      return;
    }
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    if (category) url.searchParams.set("category", category);
    else url.searchParams.delete("category");
    if (page > 1) url.searchParams.set("page", String(page));
    else url.searchParams.delete("page");
    window.history.replaceState(null, "", url.toString());
  }, [query, category, page]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return providers.filter((p) => {
      if (category && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.nameAr ?? "").includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [providers, deferredQuery, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function goToPage(next: number) {
    setPage(next);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const labels = {
    visitWebsite: t("visitWebsite"),
    viewProfile: t("viewProfile"),
    delistedBadge: t("delistedBadge"),
  };

  // Registry serials follow the full alphabetical list, not the filtered view.
  const serialById = useMemo(
    () => new Map(providers.map((p, i) => [p.id, i + 1])),
    [providers],
  );

  return (
    <div>
      {/* Search grows while you use it, shrinks back out of the way after */}
      <m.div
        className="relative"
        initial={false}
        animate={{ maxWidth: searchExpanded ? "42rem" : "28rem" }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        <svg
          className={`pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
            searchExpanded ? "text-brand-600" : "text-ink-400"
          }`}
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
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className={`w-full rounded-xl border bg-white py-3 pe-10 ps-10 text-sm shadow-sm transition-shadow placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 [&::-webkit-search-cancel-button]:hidden ${
            searchExpanded ? "border-brand-300 shadow-md" : "border-ink-200"
          }`}
        />
        <AnimatePresence>
          {query.length > 0 && (
            <m.button
              type="button"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => { setQuery(""); setPage(1); }}
              aria-label={t("clearSearch")}
              className="absolute end-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-ink-100 text-ink-500 hover:bg-brand-100 hover:text-brand-800"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </m.button>
          )}
        </AnimatePresence>
      </m.div>

      {/* Category chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setCategory(""); setPage(1); }}
          className={`press hover-lift rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
            !category
              ? "bg-ink-900 text-white ring-ink-900"
              : "bg-white text-ink-600 ring-ink-200 hover:ring-brand-300"
          }`}
          aria-pressed={!category}
        >
          {t("categoryAll")}
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { setCategory(category === cat ? "" : cat); setPage(1); }}
            className={`press hover-lift rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
              category === cat
                ? "bg-brand-700 text-white ring-brand-700"
                : "bg-white text-ink-600 ring-ink-200 hover:ring-brand-300"
            }`}
            aria-pressed={category === cat}
          >
            {tc(`categories.${cat}` as Parameters<typeof tc>[0])}
          </button>
        ))}
      </div>

      <div ref={listTopRef} className="scroll-mt-24" />

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
              onClick={() => { setQuery(""); setPage(1); }}
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
            {paged.map((p, i) => (
              <m.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3) }}
                className="relative min-w-0"
              >
                <ProviderCard provider={p} labels={labels} serial={serialById.get(p.id)} />
              </m.div>
            ))}
            {/* Get-matched card slots into the grid to keep the funnel present */}
            <m.div layout key="cta" className="relative">
              <div className="flex h-full flex-col justify-between grain relative overflow-hidden rounded-xl bg-brand-950 p-6 text-white shadow-lg">
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
                  className="press btn-shine hover-lift mt-5 inline-block rounded-lg bg-accent-500 px-4 py-2.5 text-center text-sm font-bold text-ink-950 hover:bg-accent-400"
                >
                  {t("getMatchedCard.button")}
                </Link>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <nav
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-between"
          aria-label="Pagination"
        >
          <p className="text-sm text-ink-500">
            {t("pagination.showing", {
              from: (safePage - 1) * PAGE_SIZE + 1,
              to: Math.min(safePage * PAGE_SIZE, filtered.length),
              count: filtered.length,
            })}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => goToPage(safePage - 1)}
              className="press rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("pagination.prev")}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => goToPage(n)}
                aria-current={n === safePage ? "page" : undefined}
                className={`press size-10 rounded-lg text-sm font-semibold transition-colors ${
                  n === safePage
                    ? "bg-brand-700 text-white"
                    : "border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-800"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => goToPage(safePage + 1)}
              className="press rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("pagination.next")}
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
