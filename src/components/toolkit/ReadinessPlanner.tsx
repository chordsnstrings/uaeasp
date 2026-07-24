"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { m } from "@/components/motion";
import {
  MANDATE_PHASES,
  PHASE_LABELS,
  formatMandateDate,
  type MandatePhase,
} from "@/content/mandate";

type PhaseKey = MandatePhase["key"];
type Volume = "low" | "medium" | "high";
type SystemKind = "cloud" | "erp" | "custom" | "manual";

interface Milestone {
  key: string;
  dateIso: string;
  isDeadline?: boolean;
}

function addWeeks(iso: string, weeks: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString();
}

/** Work backwards from the phase go-live to build a dated milestone plan.
 * Integration length scales with the system type. */
function buildPlan(phase: MandatePhase, system: SystemKind): Milestone[] {
  const integrationWeeks =
    system === "erp" ? 16 : system === "custom" ? 12 : system === "manual" ? 6 : 6;
  const goLive = phase.goLiveIso;
  const testingStart = addWeeks(goLive, -6);
  const integrationStart = addWeeks(testingStart, -integrationWeeks);
  const appointBy = phase.appointDeadlineIso;
  // Appoint well before the legal deadline when the plan needs the runway.
  const appointTarget =
    new Date(integrationStart) < new Date(appointBy) ? integrationStart : appointBy;
  const shortlistStart = addWeeks(appointTarget, -4);

  return [
    { key: "shortlist", dateIso: shortlistStart },
    { key: "appoint", dateIso: appointTarget },
    { key: "appointDeadline", dateIso: appointBy, isDeadline: true },
    { key: "integrate", dateIso: integrationStart },
    { key: "test", dateIso: testingStart },
    { key: "goLive", dateIso: goLive, isDeadline: true },
  ].sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime());
}

export function ReadinessPlanner() {
  const t = useTranslations("toolkit.planner");
  const locale = useLocale() as "en" | "ar";
  const [phase, setPhase] = useState<PhaseKey>("other");
  const [system, setSystem] = useState<SystemKind>("cloud");
  const [volume, setVolume] = useState<Volume>("low");

  const phaseInfo = MANDATE_PHASES.find((p) => p.key === phase)!;
  const plan = useMemo(() => buildPlan(phaseInfo, system), [phaseInfo, system]);
  const now = Date.now();

  const systems: SystemKind[] = ["cloud", "erp", "custom", "manual"];
  const volumes: Volume[] = ["low", "medium", "high"];

  return (
    <div>
      <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-card sm:p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-800">{t("phaseLabel")}</p>
            <div className="space-y-2">
              {MANDATE_PHASES.map((p) => {
                const pl = PHASE_LABELS[locale][p.key];
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPhase(p.key)}
                    aria-pressed={phase === p.key}
                    className={`press w-full rounded-xl border p-3 text-start text-xs transition-colors ${
                      phase === p.key
                        ? "border-brand-400 bg-brand-50"
                        : "border-ink-200 hover:border-brand-300"
                    }`}
                  >
                    <span className="block font-bold text-ink-900">{pl.name}</span>
                    <span className="mt-0.5 block text-ink-500">{pl.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-800">{t("systemLabel")}</p>
            <div className="space-y-2">
              {systems.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSystem(s)}
                  aria-pressed={system === s}
                  className={`press w-full rounded-xl border p-3 text-start text-xs font-semibold transition-colors ${
                    system === s
                      ? "border-brand-400 bg-brand-50 text-brand-900"
                      : "border-ink-200 text-ink-700 hover:border-brand-300"
                  }`}
                >
                  {t(`systems.${s}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-800">{t("volumeLabel")}</p>
            <div className="space-y-2">
              {volumes.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVolume(v)}
                  aria-pressed={volume === v}
                  className={`press w-full rounded-xl border p-3 text-start text-xs font-semibold transition-colors ${
                    volume === v
                      ? "border-brand-400 bg-brand-50 text-brand-900"
                      : "border-ink-200 text-ink-700 hover:border-brand-300"
                  }`}
                >
                  {t(`volumes.${v}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink-900">{t("planTitle")}</h2>
          <button
            type="button"
            onClick={() => window.print()}
            className="press hover-lift rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800 print:hidden"
          >
            {t("printButton")}
          </button>
        </div>

        <ol className="relative mt-6 space-y-0">
          {plan.map((mst, i) => {
            const past = new Date(mst.dateIso).getTime() < now;
            return (
              <m.li
                key={mst.key}
                initial={{ opacity: 0, x: locale === "ar" ? 16 : -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="relative flex gap-4 pb-8 last:pb-0"
              >
                {i < plan.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute start-[15px] top-8 h-full w-0.5 bg-ink-100"
                  />
                )}
                <span
                  aria-hidden
                  className={`relative z-10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    mst.isDeadline
                      ? "bg-accent-500 text-ink-950"
                      : past
                        ? "bg-ink-200 text-ink-500"
                        : "bg-brand-700 text-white"
                  }`}
                >
                  {mst.isDeadline ? "!" : i + 1}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold text-ink-900">
                      {t(`milestones.${mst.key}.title` as Parameters<typeof t>[0])}
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        mst.isDeadline ? "text-accent-600" : "text-brand-700"
                      }`}
                    >
                      {formatMandateDate(mst.dateIso, locale)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">
                    {t(`milestones.${mst.key}.body` as Parameters<typeof t>[0])}
                  </p>
                  {past && !mst.isDeadline && (
                    <p className="mt-2 inline-block rounded-full bg-accent-500/15 px-2.5 py-0.5 text-xs font-semibold text-accent-600">
                      {t("overdue")}
                    </p>
                  )}
                </div>
              </m.li>
            );
          })}
        </ol>

        {volume === "high" && (
          <p className="mt-4 rounded-2xl border border-ink-100 bg-ink-50 p-4 text-sm leading-relaxed text-ink-600">
            {t("highVolumeNote")}
          </p>
        )}

        <div className="mt-8 grain relative overflow-hidden rounded-xl bg-brand-950 p-6 text-center text-white sm:p-8 print:hidden">
          <h3 className="text-xl font-bold">{t("ctaTitle")}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-brand-100">{t("ctaBody")}</p>
          <Link
            href="/get-matched"
            className="press btn-shine hover-lift mt-5 inline-block rounded-xl bg-accent-500 px-6 py-3 font-bold text-ink-950 hover:bg-accent-400"
          >
            {t("ctaButton")}
          </Link>
        </div>
      </div>
    </div>
  );
}
