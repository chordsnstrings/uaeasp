import type { Locale } from "@/lib/site";

/**
 * Shared regulatory facts for the UAE e-invoicing mandate. Single source of
 * truth for the penalty calculator, readiness planner, guides and countdown.
 *
 * Sources: Ministerial Decision No. 243 of 2025 (Electronic Invoicing System)
 * and No. 244 of 2025 (phased implementation), as amended (the Phase 1 ASP
 * appointment deadline was extended to 30 October 2026); Cabinet Decision
 * No. 106 of 2025 (administrative penalties). Amounts and dates should be
 * re-verified against official MoF/FTA publications before relying on them.
 */

export interface MandatePhase {
  key: "large" | "other" | "government";
  appointDeadlineIso: string;
  goLiveIso: string;
}

export const MANDATE_PHASES: MandatePhase[] = [
  {
    key: "large",
    appointDeadlineIso: "2026-10-30T23:59:59+04:00",
    goLiveIso: "2027-01-01T00:00:00+04:00",
  },
  {
    key: "other",
    appointDeadlineIso: "2027-03-31T23:59:59+04:00",
    goLiveIso: "2027-07-01T00:00:00+04:00",
  },
  {
    key: "government",
    appointDeadlineIso: "2027-03-31T23:59:59+04:00",
    goLiveIso: "2027-10-01T00:00:00+04:00",
  },
];

export const VOLUNTARY_START_ISO = "2026-07-01T00:00:00+04:00";

export const PHASE_LABELS: Record<Locale, Record<MandatePhase["key"], { name: string; detail: string }>> = {
  en: {
    large: {
      name: "Phase 1 — Large businesses",
      detail: "Annual revenue of AED 50 million or more",
    },
    other: {
      name: "Phase 2 — All other businesses",
      detail: "Annual revenue below AED 50 million",
    },
    government: {
      name: "Phase 3 — Government entities",
      detail: "Federal and local government entities",
    },
  },
  ar: {
    large: {
      name: "المرحلة الأولى — الشركات الكبيرة",
      detail: "الإيرادات السنوية 50 مليون درهم أو أكثر",
    },
    other: {
      name: "المرحلة الثانية — باقي الشركات",
      detail: "الإيرادات السنوية أقل من 50 مليون درهم",
    },
    government: {
      name: "المرحلة الثالثة — الجهات الحكومية",
      detail: "الجهات الحكومية الاتحادية والمحلية",
    },
  },
};

/** Administrative penalties under Cabinet Decision No. 106 of 2025. */
export interface PenaltyRule {
  key: "appoint" | "implement" | "outsideSystem" | "dataChanges";
  /** AED amount per unit. */
  amount: number;
  /** Unit the amount applies to. */
  unit: "month" | "invoice" | "day";
  /** Monthly cap in AED, when the rule is capped. */
  monthlyCap?: number;
}

export const PENALTY_RULES: PenaltyRule[] = [
  { key: "appoint", amount: 5000, unit: "month" },
  { key: "implement", amount: 5000, unit: "month" },
  { key: "outsideSystem", amount: 100, unit: "invoice", monthlyCap: 5000 },
  { key: "dataChanges", amount: 1000, unit: "day" },
];

export function formatAed(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMandateDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(iso));
}
