"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { m, AnimatePresence } from "@/components/motion";
import { EMIRATES } from "@/db/schema";
import { BUDGETS, INVOICE_VOLUMES, TIMELINES } from "@/lib/validation/lead";

/** Post-conversion enrichment: optional details submitted against the lead's
 * tracking token. Every field is optional; skipping is fine. */
export function EnrichForm({ trackingToken }: { trackingToken: string }) {
  const t = useTranslations("enrich");
  const tf = useTranslations("leadForm");
  const te = useTranslations("common.emirates");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = { trackingToken };
    for (const key of ["email", "emirate", "invoiceVolume", "budgetRange", "timeline", "accountingSoftware", "message"]) {
      const v = String(fd.get(key) ?? "").trim();
      if (v) body[key] = v;
    }
    if (Object.keys(body).length === 1) {
      setState("done");
      return;
    }
    setState("saving");
    try {
      const res = await fetch("/api/leads/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-ink-200 bg-white px-4 text-base shadow-sm placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <AnimatePresence mode="wait">
      {state === "done" ? (
        <m.div
          key="done"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"
        >
          <p className="font-bold text-emerald-800">{t("doneTitle")}</p>
          <p className="mt-1 text-sm text-emerald-700">{t("doneBody")}</p>
        </m.div>
      ) : (
        <m.form
          key="form"
          exit={{ opacity: 0, y: -8 }}
          onSubmit={onSubmit}
          className="rounded-2xl border border-ink-100 bg-white p-6 text-start shadow-card"
        >
          <p className="font-bold text-ink-900">{t("title")}</p>
          <p className="mt-1 text-sm text-ink-500">{t("subtitle")}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col justify-end">
              <label htmlFor="en-email" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {tf("email")}
              </label>
              <input id="en-email" name="email" type="email" dir="ltr" autoComplete="email" placeholder={tf("emailPlaceholder")} className={inputClass} />
            </div>
            <div className="flex flex-col justify-end">
              <label htmlFor="en-emirate" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {tf("emirate")}
              </label>
              <select id="en-emirate" name="emirate" defaultValue="" className={inputClass}>
                <option value="">{tf("emiratePlaceholder")}</option>
                {EMIRATES.map((em) => (
                  <option key={em} value={em}>
                    {te(em)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label htmlFor="en-volume" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {tf("invoiceVolume")}
              </label>
              <select id="en-volume" name="invoiceVolume" defaultValue="" className={inputClass}>
                <option value="">{tf("invoiceVolumePlaceholder")}</option>
                {INVOICE_VOLUMES.map((v) => (
                  <option key={v} value={v}>
                    {tf(`invoiceVolumes.${v}` as Parameters<typeof tf>[0])}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label htmlFor="en-budget" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {tf("budgetRange")}
              </label>
              <select id="en-budget" name="budgetRange" defaultValue="" className={inputClass}>
                <option value="">{tf("budgetRangePlaceholder")}</option>
                {BUDGETS.map((b) => (
                  <option key={b} value={b}>
                    {tf(`budgets.${b}` as Parameters<typeof tf>[0])}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label htmlFor="en-timeline" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {tf("timeline")}
              </label>
              <select id="en-timeline" name="timeline" defaultValue="" className={inputClass}>
                <option value="">{tf("timelinePlaceholder")}</option>
                {TIMELINES.map((tl) => (
                  <option key={tl} value={tl}>
                    {tf(`timelines.${tl}` as Parameters<typeof tf>[0])}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label htmlFor="en-software" className="mb-1.5 block text-sm font-semibold text-ink-800">
                {tf("accountingSoftware")}
              </label>
              <input id="en-software" name="accountingSoftware" placeholder={tf("accountingSoftwarePlaceholder")} className={inputClass} />
            </div>
          </div>
          {state === "error" && (
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
              {tf("errors.generic")}
            </p>
          )}
          <m.button
            type="submit"
            disabled={state === "saving"}
            whileTap={{ scale: 0.97 }}
            className="press mt-5 w-full rounded-xl bg-brand-700 px-6 py-3 font-bold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {state === "saving" ? tf("submitting") : t("submit")}
          </m.button>
          <p className="mt-2 text-center text-xs text-ink-400">{t("skipNote")}</p>
        </m.form>
      )}
    </AnimatePresence>
  );
}
