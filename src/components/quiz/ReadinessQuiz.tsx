"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { m, AnimatePresence } from "@/components/motion";
import { EMIRATES } from "@/db/schema";
import { leadSchema } from "@/lib/validation/lead";

const QUESTIONS = ["q1", "q2", "q3", "q4", "q5"] as const;
const ANSWER_SCORES: Record<string, number> = { a1: 20, a2: 10, a3: 0 };

type Phase = "intro" | "questions" | "gate" | "results";

export function ReadinessQuiz() {
  const t = useTranslations("quiz");
  const tf = useTranslations("leadForm");
  const te = useTranslations("common.emirates");
  const locale = useLocale() as "en" | "ar";
  const startedAt = useMemo(() => Date.now(), []);

  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [trackingToken, setTrackingToken] = useState<string | null>(null);

  const score = Object.values(answers).reduce(
    (sum, a) => sum + (ANSWER_SCORES[a] ?? 0),
    0,
  );
  const band = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const totalSteps = QUESTIONS.length + 1; // questions + contact gate

  function answer(q: string, a: string) {
    setAnswers((prev) => ({ ...prev, [q]: a }));
    if (step + 1 >= QUESTIONS.length) setPhase("gate");
    else setStep((s) => s + 1);
  }

  async function submitGate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGateError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      fullName: String(fd.get("fullName") ?? ""),
      companyName: String(fd.get("companyName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      emirate: String(fd.get("emirate") ?? ""),
      consent: fd.get("consent") === "on",
      locale,
      source: "quiz",
      quizAnswers: answers,
      quizScore: score,
      website: String(fd.get("website") ?? ""),
      renderedAt: startedAt,
    };

    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, boolean> = {};
      for (const field of Object.keys(parsed.error.flatten().fieldErrors)) {
        errs[field] = true;
      }
      setFieldErrors(errs);
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
        setGateError(tf("errors.rateLimited"));
        return;
      }
      if (!res.ok) {
        setGateError(tf("errors.generic"));
        return;
      }
      const data = (await res.json()) as { trackingToken?: string };
      setTrackingToken(data.trackingToken ?? null);
      setPhase("results");
    } catch {
      setGateError(tf("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: string) =>
    `h-12 w-full rounded-xl border bg-white px-4 text-base shadow-sm placeholder:text-ink-400 focus:ring-2 ${
      fieldErrors[field]
        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
        : "border-ink-200 focus:border-brand-400 focus:ring-brand-100"
    }`;

  const progress =
    phase === "gate"
      ? ((QUESTIONS.length + 0.5) / totalSteps) * 100
      : (step / totalSteps) * 100;

  return (
    <div className="mx-auto max-w-2xl">
      {phase === "intro" && (
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-card sm:p-12"
        >
          <p aria-hidden className="text-5xl">📋</p>
          <h2 className="mt-4 text-2xl font-bold text-ink-900">{t("title")}</h2>
          <p className="mx-auto mt-3 max-w-md text-ink-600">
            {t("subtitle", { total: QUESTIONS.length })}
          </p>
          <m.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setPhase("questions")}
            className="press mt-8 rounded-xl bg-brand-700 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800"
          >
            {t("start")}
          </m.button>
          <p className="mt-3 text-xs text-ink-400">{t("timeNote")}</p>
        </m.div>
      )}

      {(phase === "questions" || phase === "gate") && (
        <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-card sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {phase === "gate"
                ? t("gate.progressLabel")
                : t("questionProgress", { current: step + 1, total: QUESTIONS.length })}
            </p>
            {(step > 0 || phase === "gate") && (
              <button
                type="button"
                onClick={() => {
                  if (phase === "gate") {
                    setPhase("questions");
                    setStep(QUESTIONS.length - 1);
                  } else {
                    setStep((s) => s - 1);
                  }
                }}
                className="press text-xs font-medium text-ink-500 hover:text-brand-700"
              >
                ← {t("back")}
              </button>
            )}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <m.div
              className="h-full rounded-full bg-brand-600"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <AnimatePresence mode="wait">
            {phase === "questions" ? (
              <m.div
                key={`q-${step}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <h2 className="mt-8 text-xl font-bold text-ink-900">
                  {t(`questions.${QUESTIONS[step]}.text` as Parameters<typeof t>[0])}
                </h2>
                <div className="mt-6 space-y-3">
                  {(["a1", "a2", "a3"] as const).map((a) => (
                    <m.button
                      key={a}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => answer(QUESTIONS[step], a)}
                      className={`w-full rounded-xl border p-4 text-start text-sm font-medium transition-colors ${
                        answers[QUESTIONS[step]] === a
                          ? "border-brand-400 bg-brand-50 text-brand-900"
                          : "border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50/50"
                      }`}
                    >
                      {t(`questions.${QUESTIONS[step]}.${a}` as Parameters<typeof t>[0])}
                    </m.button>
                  ))}
                </div>
              </m.div>
            ) : (
              <m.form
                key="gate"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                onSubmit={submitGate}
                noValidate
              >
                {/* Honeypot */}
                <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
                  <label>
                    Website
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>

                <div className="mt-8 text-center">
                  <span aria-hidden className="text-4xl">🎯</span>
                  <h2 className="mt-2 text-xl font-bold text-ink-900">{t("gate.title")}</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
                    {t("gate.subtitle")}
                  </p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="quiz-fullName" className="mb-1.5 block text-sm font-semibold text-ink-800">
                      {tf("fullName")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="quiz-fullName"
                      name="fullName"
                      autoComplete="name"
                      placeholder={tf("fullNamePlaceholder")}
                      aria-invalid={!!fieldErrors.fullName}
                      className={inputClass("fullName")}
                      onFocus={() => setFieldErrors((f) => ({ ...f, fullName: false }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="quiz-companyName" className="mb-1.5 block text-sm font-semibold text-ink-800">
                      {tf("companyName")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="quiz-companyName"
                      name="companyName"
                      autoComplete="organization"
                      placeholder={tf("companyNamePlaceholder")}
                      aria-invalid={!!fieldErrors.companyName}
                      className={inputClass("companyName")}
                      onFocus={() => setFieldErrors((f) => ({ ...f, companyName: false }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="quiz-email" className="mb-1.5 block text-sm font-semibold text-ink-800">
                      {tf("email")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="quiz-email"
                      name="email"
                      type="email"
                      dir="ltr"
                      autoComplete="email"
                      placeholder={tf("emailPlaceholder")}
                      aria-invalid={!!fieldErrors.email}
                      className={inputClass("email")}
                      onFocus={() => setFieldErrors((f) => ({ ...f, email: false }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="quiz-phone" className="mb-1.5 block text-sm font-semibold text-ink-800">
                      {tf("phone")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="quiz-phone"
                      name="phone"
                      type="tel"
                      dir="ltr"
                      autoComplete="tel"
                      placeholder={tf("phonePlaceholder")}
                      aria-invalid={!!fieldErrors.phone}
                      className={inputClass("phone")}
                      onFocus={() => setFieldErrors((f) => ({ ...f, phone: false }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="quiz-emirate" className="mb-1.5 block text-sm font-semibold text-ink-800">
                      {tf("emirate")} <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="quiz-emirate"
                      name="emirate"
                      defaultValue=""
                      aria-invalid={!!fieldErrors.emirate}
                      className={inputClass("emirate")}
                      onFocus={() => setFieldErrors((f) => ({ ...f, emirate: false }))}
                    >
                      <option value="" disabled>
                        {tf("emiratePlaceholder")}
                      </option>
                      {EMIRATES.map((em) => (
                        <option key={em} value={em}>
                          {te(em)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label
                  className={`mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm ${
                    fieldErrors.consent ? "border-red-300 bg-red-50" : "border-ink-200 bg-ink-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="consent"
                    className="mt-0.5 size-4 accent-brand-700"
                    aria-invalid={!!fieldErrors.consent}
                    onChange={() => setFieldErrors((f) => ({ ...f, consent: false }))}
                  />
                  <span className="text-ink-600">
                    {tf("consentPrefix")}{" "}
                    <Link
                      href="/privacy"
                      className="font-medium text-brand-700 underline underline-offset-2"
                      target="_blank"
                    >
                      {tf("consentLinkText")}
                    </Link>
                    .
                  </span>
                </label>

                {gateError && (
                  <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
                    {gateError}
                  </p>
                )}

                <m.button
                  type="submit"
                  disabled={submitting}
                  whileTap={{ scale: 0.97 }}
                  className="mt-5 w-full rounded-xl bg-accent-500 px-6 py-4 text-base font-bold text-ink-950 shadow-lg shadow-accent-500/20 hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? tf("submitting") : t("gate.submit")}
                </m.button>
                <p className="mt-3 text-center text-xs text-ink-400">{t("gate.privacyNote")}</p>
              </m.form>
            )}
          </AnimatePresence>
        </div>
      )}

      {phase === "results" && (
        <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t("results.title")}
            </p>
            <div className="relative mx-auto mt-6 size-36">
              <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                <m.circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={band === "high" ? "#0d9488" : band === "medium" ? "#f59e0b" : "#f43f5e"}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - score / 100) }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <span className="text-4xl font-extrabold text-ink-900">{score}</span>
              </div>
            </div>
            <p className="mt-4 text-lg font-bold text-ink-900">
              {t(`results.${band}.label` as Parameters<typeof t>[0])}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
              {t(`results.${band}.body` as Parameters<typeof t>[0])}
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-brand-100 bg-brand-50 p-6 text-center sm:p-8">
            <h3 className="font-bold text-brand-900">{t("results.trackTitle")}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-800/80">
              {t("results.trackBody")}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {trackingToken && (
                <Link
                  href={`/track/${trackingToken}`}
                  className="press rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-800"
                >
                  {t("results.trackButton")}
                </Link>
              )}
              <Link
                href="/get-matched"
                className="press rounded-xl border border-brand-200 bg-white px-5 py-2.5 text-sm font-semibold text-brand-800 hover:border-brand-400"
              >
                {t("results.moreDetail")}
              </Link>
            </div>
          </div>
        </m.div>
      )}
    </div>
  );
}
