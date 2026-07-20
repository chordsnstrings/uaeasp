"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { m } from "@/components/motion";
import { EMIRATES } from "@/db/schema";
import {
  BUDGETS,
  INVOICE_VOLUMES,
  TIMELINES,
  leadSchema,
} from "@/lib/validation/lead";
import { Link } from "@/i18n/navigation";

type FieldErrors = Partial<Record<string, string>>;

export function LeadForm({
  source = "form",
  quizAnswers,
  quizScore,
}: {
  source?: string;
  quizAnswers?: Record<string, string>;
  quizScore?: number;
}) {
  const t = useTranslations("leadForm");
  const locale = useLocale() as "en" | "ar";
  const te = useTranslations("common.emirates");
  const router = useRouter();
  const searchParams = useSearchParams();
  const renderedAt = useMemo(() => Date.now(), []);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [shake, setShake] = useState(0);

  const refSource = searchParams.get("ref");
  const effectiveSource = refSource ? `${source}:${refSource}` : source;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGlobalError(null);
    const fd = new FormData(e.currentTarget);

    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const v = searchParams.get(key);
      if (v) utm[key] = v;
    }

    const payload = {
      fullName: String(fd.get("fullName") ?? ""),
      companyName: String(fd.get("companyName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      emirate: String(fd.get("emirate") ?? ""),
      invoiceVolume: (fd.get("invoiceVolume") as string) || undefined,
      accountingSoftware: String(fd.get("accountingSoftware") ?? ""),
      budgetRange: (fd.get("budgetRange") as string) || undefined,
      timeline: (fd.get("timeline") as string) || undefined,
      message: String(fd.get("message") ?? ""),
      consent: fd.get("consent") === "on",
      locale,
      source: effectiveSource,
      quizAnswers,
      quizScore,
      utm: Object.keys(utm).length ? utm : undefined,
      referrer: document.referrer || undefined,
      website: String(fd.get("website") ?? ""),
      renderedAt,
    };

    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (msgs?.length) fieldErrors[field] = field;
      }
      setErrors(fieldErrors);
      setShake((s) => s + 1);
      const firstError = formRef.current?.querySelector("[aria-invalid='true']");
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 429) {
        setGlobalError(t("errors.rateLimited"));
        return;
      }
      if (!res.ok) {
        setGlobalError(t("errors.generic"));
        return;
      }
      const data = (await res.json()) as { trackingToken?: string };
      router.push(
        data.trackingToken
          ? `/thank-you?t=${encodeURIComponent(data.trackingToken)}`
          : "/thank-you",
      );
    } catch {
      setGlobalError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const errorKeyMap: Record<string, string> = {
    fullName: "errors.fullName",
    companyName: "errors.companyName",
    email: "errors.email",
    phone: "errors.phone",
    emirate: "errors.emirate",
    consent: "errors.consent",
  };

  const inputClass = (field: string) =>
    `w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-sm placeholder:text-ink-400 focus:ring-2 ${
      errors[field]
        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
        : "border-ink-200 focus:border-brand-400 focus:ring-brand-100"
    }`;

  const fieldError = (field: string) =>
    errors[field] && errorKeyMap[field] ? (
      <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
        {t(errorKeyMap[field] as Parameters<typeof t>[0])}
      </p>
    ) : null;

  return (
    <m.form
      ref={formRef}
      key={shake}
      animate={shake > 0 ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
      transition={{ duration: 0.4 }}
      onSubmit={onSubmit}
      noValidate
      className="space-y-5"
    >
      {/* Honeypot — hidden from humans, tempting for bots */}
      <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="lead-fullName" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("fullName")} <span className="text-red-500">*</span>
          </label>
          <input
            id="lead-fullName"
            name="fullName"
            autoComplete="name"
            placeholder={t("fullNamePlaceholder")}
            aria-invalid={!!errors.fullName}
            className={inputClass("fullName")}
            onFocus={() => setErrors((e) => ({ ...e, fullName: undefined }))}
          />
          {fieldError("fullName")}
        </div>
        <div>
          <label htmlFor="lead-companyName" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("companyName")} <span className="text-red-500">*</span>
          </label>
          <input
            id="lead-companyName"
            name="companyName"
            autoComplete="organization"
            placeholder={t("companyNamePlaceholder")}
            aria-invalid={!!errors.companyName}
            className={inputClass("companyName")}
            onFocus={() => setErrors((e) => ({ ...e, companyName: undefined }))}
          />
          {fieldError("companyName")}
        </div>
        <div>
          <label htmlFor="lead-email" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("email")} <span className="text-red-500">*</span>
          </label>
          <input
            id="lead-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            aria-invalid={!!errors.email}
            className={inputClass("email")}
            onFocus={() => setErrors((e) => ({ ...e, email: undefined }))}
          />
          {fieldError("email")}
        </div>
        <div>
          <label htmlFor="lead-phone" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("phone")} <span className="text-red-500">*</span>
          </label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            aria-invalid={!!errors.phone}
            className={inputClass("phone")}
            onFocus={() => setErrors((e) => ({ ...e, phone: undefined }))}
          />
          {fieldError("phone")}
        </div>
      </div>

      <div>
        <label htmlFor="lead-emirate" className="mb-1.5 block text-sm font-semibold text-ink-800">
          {t("emirate")} <span className="text-red-500">*</span>
        </label>
        <select
          id="lead-emirate"
          name="emirate"
          defaultValue=""
          aria-invalid={!!errors.emirate}
          className={inputClass("emirate")}
          onFocus={() => setErrors((e) => ({ ...e, emirate: undefined }))}
        >
          <option value="" disabled>
            {t("emiratePlaceholder")}
          </option>
          {EMIRATES.map((e) => (
            <option key={e} value={e}>
              {te(e)}
            </option>
          ))}
        </select>
        {fieldError("emirate")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="lead-invoiceVolume" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("invoiceVolume")}
          </label>
          <select id="lead-invoiceVolume" name="invoiceVolume" defaultValue="" className={inputClass("invoiceVolume")}>
            <option value="">{t("invoiceVolumePlaceholder")}</option>
            {INVOICE_VOLUMES.map((v) => (
              <option key={v} value={v}>
                {t(`invoiceVolumes.${v}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lead-budgetRange" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("budgetRange")}
          </label>
          <select id="lead-budgetRange" name="budgetRange" defaultValue="" className={inputClass("budgetRange")}>
            <option value="">{t("budgetRangePlaceholder")}</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {t(`budgets.${b}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lead-software" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("accountingSoftware")}
          </label>
          <input
            id="lead-software"
            name="accountingSoftware"
            placeholder={t("accountingSoftwarePlaceholder")}
            className={inputClass("accountingSoftware")}
          />
        </div>
        <div>
          <label htmlFor="lead-timeline" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("timeline")}
          </label>
          <select id="lead-timeline" name="timeline" defaultValue="" className={inputClass("timeline")}>
            <option value="">{t("timelinePlaceholder")}</option>
            {TIMELINES.map((tl) => (
              <option key={tl} value={tl}>
                {t(`timelines.${tl}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="lead-message" className="mb-1.5 block text-sm font-semibold text-ink-800">
          {t("message")}
        </label>
        <textarea
          id="lead-message"
          name="message"
          rows={3}
          placeholder={t("messagePlaceholder")}
          className={inputClass("message")}
        />
      </div>

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm ${
          errors.consent ? "border-red-300 bg-red-50" : "border-ink-200 bg-ink-50"
        }`}
      >
        <input
          type="checkbox"
          name="consent"
          className="mt-0.5 size-4 accent-brand-700"
          aria-invalid={!!errors.consent}
          onChange={() => setErrors((e) => ({ ...e, consent: undefined }))}
        />
        <span className="text-ink-600">
          {t("consent")}{" "}
          <Link href="/privacy" className="font-medium text-brand-700 underline underline-offset-2" target="_blank">
            →
          </Link>
        </span>
      </label>
      {fieldError("consent")}

      {globalError && (
        <m.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {globalError}
        </m.p>
      )}

      <m.button
        type="submit"
        disabled={submitting}
        whileTap={{ scale: 0.97 }}
        className="w-full rounded-xl bg-accent-500 px-6 py-4 text-base font-bold text-ink-950 shadow-lg shadow-accent-500/20 hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            {t("submitting")}
          </span>
        ) : (
          t("submit")
        )}
      </m.button>
    </m.form>
  );
}
