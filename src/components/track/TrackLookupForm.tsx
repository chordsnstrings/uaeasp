"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { m } from "@/components/motion";

export function TrackLookupForm() {
  const t = useTranslations("track");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const res = await fetch("/api/track/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") ?? ""),
          phone: String(fd.get("phone") ?? ""),
        }),
      });
      if (res.status === 429) {
        setError(t("rateLimited"));
        return;
      }
      if (!res.ok) {
        setError(t("notFound"));
        return;
      }
      const data = (await res.json()) as { token: string };
      router.push(`/track/${data.token}`);
    } catch {
      setError(t("notFound"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-ink-100 bg-white p-6 shadow-card sm:p-8"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="track-email" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("email")}
          </label>
          <input
            id="track-email"
            name="email"
            type="email"
            required
            dir="ltr"
            className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label htmlFor="track-phone" className="mb-1.5 block text-sm font-semibold text-ink-800">
            {t("phone")}
          </label>
          <input
            id="track-phone"
            name="phone"
            type="tel"
            required
            dir="ltr"
            className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {error && (
          <m.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 rounded-xl bg-amber-50 p-3.5"
            role="alert"
          >
            <p className="text-sm font-medium text-amber-800">{error}</p>
            <Link href="/get-matched" className="inline-block text-sm font-bold text-brand-700 underline underline-offset-2">
              {t("newRequest")}
            </Link>
          </m.div>
        )}
        <m.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.97 }}
          className="w-full rounded-xl bg-brand-700 py-3.5 font-bold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {pending ? t("searching") : t("submit")}
        </m.button>
      </div>
    </form>
  );
}
