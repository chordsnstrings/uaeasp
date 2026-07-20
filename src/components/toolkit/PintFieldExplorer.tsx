"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { useTranslations } from "next-intl";
import { m, AnimatePresence } from "@/components/motion";
import {
  PINT_FIELDS,
  PINT_FIELD_GROUPS,
  type Obligation,
} from "@/content/pint-ae";

const OBLIGATIONS: Obligation[] = ["Mandatory", "Conditional", "Optional"];

const OBLIGATION_STYLES: Record<Obligation, string> = {
  Mandatory: "bg-brand-50 text-brand-800 ring-brand-200",
  Conditional: "bg-accent-500/10 text-accent-600 ring-accent-500/30",
  Optional: "bg-ink-50 text-ink-500 ring-ink-200",
};

export function PintFieldExplorer() {
  const t = useTranslations("toolkit.pint");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [uaeOnly, setUaeOnly] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return PINT_FIELDS.filter((f) => {
      if (uaeOnly && !f.uae) return false;
      if (group && f.group !== group) return false;
      if (!q) return true;
      return (
        f.id.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q)
      );
    });
  }, [deferredQuery, group, uaeOnly]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
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
            dir="ltr"
            className="h-12 w-full rounded-xl border border-ink-200 bg-white pe-4 ps-10 text-base shadow-sm placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-700">
          <input
            type="checkbox"
            checked={uaeOnly}
            onChange={() => setUaeOnly((v) => !v)}
            className="size-4 accent-brand-700"
          />
          {t("uaeOnly")}
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setGroup("")}
          aria-pressed={!group}
          className={`press hover-lift rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
            !group
              ? "bg-ink-900 text-white ring-ink-900"
              : "bg-white text-ink-600 ring-ink-200 hover:ring-brand-300"
          }`}
        >
          {t("allGroups")}
        </button>
        {PINT_FIELD_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(group === g ? "" : g)}
            aria-pressed={group === g}
            className={`press hover-lift rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
              group === g
                ? "bg-brand-700 text-white ring-brand-700"
                : "bg-white text-ink-600 ring-ink-200 hover:ring-brand-300"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink-500">
        {t("showing", { count: filtered.length, total: PINT_FIELDS.length })}
      </p>

      <div className="mt-4 space-y-2.5">
        <AnimatePresence initial={false}>
          {filtered.map((f) => (
            <m.article
              key={f.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-card sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-ink-900 px-2 py-0.5 font-mono text-xs font-bold text-white" dir="ltr">
                  {f.id}
                </span>
                <h3 className="font-semibold text-ink-900">{f.name}</h3>
                {f.uae && (
                  <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-bold text-white">
                    {t("uaeBadge")}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${OBLIGATION_STYLES[f.obligation]}`}
                >
                  {f.obligation}
                </span>
                <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-500 ring-1 ring-ink-100">
                  {f.group}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.description}</p>
              <p
                className="mt-2 overflow-x-auto whitespace-nowrap rounded-lg bg-ink-50 px-3 py-1.5 font-mono text-xs text-ink-500"
                dir="ltr"
              >
                {f.path}
              </p>
            </m.article>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-200 p-10 text-center text-ink-500">
            {t("noResults")}
          </div>
        )}
      </div>
    </div>
  );
}
