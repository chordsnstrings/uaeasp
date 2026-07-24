"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { m } from "@/components/motion";
import {
  MANDATE_PHASES,
  PHASE_LABELS,
  formatAed,
  formatMandateDate,
  type MandatePhase,
} from "@/content/mandate";

type PhaseKey = MandatePhase["key"];

function clampInt(v: string, max: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

export function PenaltyCalculator() {
  const t = useTranslations("toolkit.calculator");
  const locale = useLocale() as "en" | "ar";
  const [phase, setPhase] = useState<PhaseKey>("large");
  const [monthsNoAsp, setMonthsNoAsp] = useState(3);
  const [monthsNotLive, setMonthsNotLive] = useState(3);
  const [invoicesOutside, setInvoicesOutside] = useState(120);
  const [monthsOutside, setMonthsOutside] = useState(3);
  const [daysUnreported, setDaysUnreported] = useState(0);

  const phaseInfo = MANDATE_PHASES.find((p) => p.key === phase)!;
  const labels = PHASE_LABELS[locale][phase];

  const results = useMemo(() => {
    const appoint = 5000 * monthsNoAsp;
    const implement = 5000 * monthsNotLive;
    const perMonthInvoicePenalty = Math.min(100 * invoicesOutside, 5000);
    const outside = perMonthInvoicePenalty * monthsOutside;
    const data = 1000 * daysUnreported;
    return {
      appoint,
      implement,
      outside,
      invoiceCapHit: 100 * invoicesOutside > 5000,
      data,
      total: appoint + implement + outside + data,
    };
  }, [monthsNoAsp, monthsNotLive, invoicesOutside, monthsOutside, daysUnreported]);

  const inputClass =
    "h-12 w-full rounded-xl border border-ink-200 bg-white px-4 text-base shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  const rows = [
    { key: "appoint", amount: results.appoint, rule: t("rules.appoint") },
    { key: "implement", amount: results.implement, rule: t("rules.implement") },
    { key: "outside", amount: results.outside, rule: t("rules.outside") },
    { key: "data", amount: results.data, rule: t("rules.data") },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-card sm:p-8">
        <h2 className="text-lg font-bold text-ink-900">{t("inputsTitle")}</h2>

        <div className="mt-5 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-800">
              {t("phaseLabel")}
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {MANDATE_PHASES.map((p) => {
                const pl = PHASE_LABELS[locale][p.key];
                const active = phase === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPhase(p.key)}
                    aria-pressed={active}
                    className={`press rounded-xl border p-3 text-start text-xs transition-colors ${
                      active
                        ? "border-brand-400 bg-brand-50"
                        : "border-ink-200 bg-white hover:border-brand-300"
                    }`}
                  >
                    <span className="block font-bold text-ink-900">{pl.name}</span>
                    <span className="mt-0.5 block text-ink-500">{pl.detail}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-500">
              {t("phaseDates", {
                appoint: formatMandateDate(phaseInfo.appointDeadlineIso, locale),
                goLive: formatMandateDate(phaseInfo.goLiveIso, locale),
              })}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pc-noasp" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {t("monthsNoAsp")}
              </label>
              <input
                id="pc-noasp"
                type="number"
                min={0}
                max={24}
                value={monthsNoAsp}
                onChange={(e) => setMonthsNoAsp(clampInt(e.target.value, 24))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pc-notlive" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {t("monthsNotLive")}
              </label>
              <input
                id="pc-notlive"
                type="number"
                min={0}
                max={24}
                value={monthsNotLive}
                onChange={(e) => setMonthsNotLive(clampInt(e.target.value, 24))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pc-outside" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {t("invoicesOutside")}
              </label>
              <input
                id="pc-outside"
                type="number"
                min={0}
                max={1000000}
                value={invoicesOutside}
                onChange={(e) => setInvoicesOutside(clampInt(e.target.value, 1000000))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pc-outmonths" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {t("monthsOutside")}
              </label>
              <input
                id="pc-outmonths"
                type="number"
                min={0}
                max={24}
                value={monthsOutside}
                onChange={(e) => setMonthsOutside(clampInt(e.target.value, 24))}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pc-days" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {t("daysUnreported")}
              </label>
              <input
                id="pc-days"
                type="number"
                min={0}
                max={365}
                value={daysUnreported}
                onChange={(e) => setDaysUnreported(clampInt(e.target.value, 365))}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <m.div
          layout
          className="grain relative overflow-hidden rounded-xl bg-brand-950 p-6 text-white shadow-lg sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-200">
            {t("totalLabel", { phase: labels.name })}
          </p>
          <m.p
            key={results.total}
            initial={{ opacity: 0.4, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="mt-2 text-4xl font-extrabold tabular-nums sm:text-5xl"
            dir="ltr"
          >
            {formatAed(results.total, locale)}
          </m.p>
          <p className="mt-2 text-sm text-brand-200">{t("totalNote")}</p>

          <div className="mt-6 space-y-2.5">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-2.5 text-sm ring-1 ring-white/10"
              >
                <span className="text-brand-100">{row.rule}</span>
                <span className="font-bold tabular-nums" dir="ltr">
                  {formatAed(row.amount, locale)}
                </span>
              </div>
            ))}
          </div>
          {results.invoiceCapHit && (
            <p className="mt-3 text-xs text-brand-300">{t("capNote")}</p>
          )}
        </m.div>

        <div className="rounded-3xl border border-brand-100 bg-brand-50 p-6 text-center">
          <p className="font-bold text-brand-900">{t("ctaTitle")}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-brand-800/80">{t("ctaBody")}</p>
          <Link
            href="/get-matched"
            className="press btn-shine hover-lift mt-4 inline-block rounded-xl bg-brand-700 px-6 py-3 text-sm font-bold text-white hover:bg-brand-800"
          >
            {t("ctaButton")}
          </Link>
        </div>

        <p className="text-xs leading-relaxed text-ink-400">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
