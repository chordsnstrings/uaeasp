"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { m } from "@/components/motion";
import { track } from "@/lib/analytics";
import { leadSchema } from "@/lib/validation/lead";

/** The 10-second lead form: name, phone, company. Everything else is
 * optional and collected after conversion. Used in the hero and on
 * landing-page CTAs. */
export function QuickLeadForm({ source = "hero" }: { source?: string }) {
  const t = useTranslations("quickForm");
  const tf = useTranslations("leadForm");
  const locale = useLocale() as "en" | "ar";
  const router = useRouter();
  const renderedAt = useMemo(() => Date.now(), []);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGlobalError(null);
    const fd = new FormData(e.currentTarget);

    const sp = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const v = sp.get(key);
      if (v) utm[key] = v;
    }

    const payload = {
      fullName: String(fd.get("fullName") ?? ""),
      companyName: String(fd.get("companyName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      locale,
      source,
      utm: Object.keys(utm).length ? utm : undefined,
      referrer: document.referrer || undefined,
      website: String(fd.get("website") ?? ""),
      renderedAt,
    };

    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, boolean> = {};
      for (const field of Object.keys(parsed.error.flatten().fieldErrors)) errs[field] = true;
      setErrors(errs);
      setShake((s) => s + 1);
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
        setGlobalError(tf("errors.rateLimited"));
        return;
      }
      if (!res.ok) {
        setGlobalError(tf("errors.generic"));
        return;
      }
      const data = (await res.json()) as { trackingToken?: string };
      track("lead_submitted");
      router.push(
        data.trackingToken
          ? `/thank-you?t=${encodeURIComponent(data.trackingToken)}`
          : "/thank-you",
      );
    } catch {
      setGlobalError(tf("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: string) =>
    `h-12 w-full rounded-lg border bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:ring-2 ${
      errors[field]
        ? "border-red-400 focus:border-red-400 focus:ring-red-200"
        : "border-ink-200 focus:border-brand-500 focus:ring-brand-100"
    }`;

  return (
    <m.form
      key={shake}
      animate={shake > 0 ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
      transition={{ duration: 0.4 }}
      onSubmit={onSubmit}
      noValidate
      className="rounded-xl border border-white/15 bg-paper p-4 shadow-[0_3px_0_rgb(2_6_23/0.35)] sm:p-5"
    >
      {/* Honeypot */}
      <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p className="font-display text-base font-bold text-ink-900">{t("title")}</p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        <input
          name="fullName"
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          aria-label={t("namePlaceholder")}
          aria-invalid={!!errors.fullName}
          className={inputClass("fullName")}
          onFocus={() => setErrors((e) => ({ ...e, fullName: false }))}
        />
        <input
          name="phone"
          type="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          aria-label={t("phonePlaceholder")}
          aria-invalid={!!errors.phone}
          className={inputClass("phone")}
          onFocus={() => setErrors((e) => ({ ...e, phone: false }))}
        />
        <input
          name="companyName"
          autoComplete="organization"
          placeholder={t("companyPlaceholder")}
          aria-label={t("companyPlaceholder")}
          aria-invalid={!!errors.companyName}
          className={inputClass("companyName")}
          onFocus={() => setErrors((e) => ({ ...e, companyName: false }))}
        />
      </div>

      {globalError && (
        <p className="mt-2 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-100" role="alert">
          {globalError}
        </p>
      )}

      <m.button
        type="submit"
        disabled={submitting}
        whileTap={{ scale: 0.97 }}
        className="btn-shine mt-3 w-full rounded-lg bg-accent-500 px-6 py-3.5 text-base font-bold text-ink-950 shadow-lg shadow-accent-500/25 hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            {tf("submitting")}
          </span>
        ) : (
          t("submit")
        )}
      </m.button>
      <p className="mt-2.5 text-center text-[11px] leading-relaxed text-ink-500">
        {t("note")}{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink-900" target="_blank">
          {tf("consentLinkText")}
        </Link>
      </p>
    </m.form>
  );
}
