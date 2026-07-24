"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { m } from "@/components/motion";

const STORAGE_KEY = "uae-einv-checklist-v1";

/** Groups and item counts; the copy lives in messages under toolkit.checklist. */
export const CHECKLIST_GROUPS: { key: string; items: number }[] = [
  { key: "scope", items: 4 },
  { key: "select", items: 5 },
  { key: "data", items: 5 },
  { key: "integrate", items: 5 },
  { key: "live", items: 4 },
];

const TOTAL = CHECKLIST_GROUPS.reduce((sum, g) => sum + g.items, 0);

export function ComplianceChecklist() {
  const t = useTranslations("toolkit.checklist");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDone(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      // Ignore corrupted storage.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch {
      // Storage full/blocked — checklist still works in memory.
    }
  }, [done, loaded]);

  const doneCount = useMemo(() => Object.values(done).filter(Boolean).length, [done]);
  const pct = Math.round((doneCount / TOTAL) * 100);

  return (
    <div>
      <div className="sticky top-16 z-10 -mx-4 border-b border-ink-100 bg-white/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-5 print:hidden">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-ink-800">
            {t("progress", { done: doneCount, total: TOTAL })}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="press text-xs font-semibold text-ink-500 hover:text-brand-700"
            >
              {t("printButton")}
            </button>
            <button
              type="button"
              onClick={() => setDone({})}
              className="press text-xs font-semibold text-ink-500 hover:text-red-600"
            >
              {t("resetButton")}
            </button>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
          <m.div
            className="h-full rounded-full bg-brand-600"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {CHECKLIST_GROUPS.map((group, gi) => (
          <section key={group.key}>
            <h2 className="flex items-center gap-3 text-lg font-bold text-ink-900">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-lg bg-brand-50 text-sm font-extrabold text-brand-800"
              >
                {gi + 1}
              </span>
              {t(`groups.${group.key}.title` as Parameters<typeof t>[0])}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {t(`groups.${group.key}.subtitle` as Parameters<typeof t>[0])}
            </p>
            <ul className="mt-4 space-y-2.5">
              {Array.from({ length: group.items }, (_, i) => {
                const id = `${group.key}-${i + 1}`;
                const checked = !!done[id];
                return (
                  <li key={id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                        checked
                          ? "border-brand-200 bg-brand-50/60"
                          : "border-ink-100 bg-white hover:border-brand-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setDone((d) => ({ ...d, [id]: !d[id] }))}
                        className="mt-0.5 size-5 shrink-0 accent-brand-700"
                      />
                      <span
                        className={`text-sm leading-relaxed ${
                          checked ? "text-ink-400 line-through" : "text-ink-700"
                        }`}
                      >
                        {t(`groups.${group.key}.i${i + 1}` as Parameters<typeof t>[0])}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-3xl border border-brand-100 bg-brand-50 p-6 text-center sm:p-8 print:hidden">
        <h3 className="font-bold text-brand-900">{t("ctaTitle")}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-800/80">{t("ctaBody")}</p>
        <Link
          href="/get-matched"
          className="press btn-shine hover-lift mt-4 inline-block rounded-xl bg-brand-700 px-6 py-3 text-sm font-bold text-white hover:bg-brand-800"
        >
          {t("ctaButton")}
        </Link>
      </div>
    </div>
  );
}
