"use client";

import { useState, useTransition } from "react";
import { refreshDirectoryNow, type RefreshState } from "@/app/admin/(dashboard)/scrapes/actions";

export function RefreshDirectoryButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RefreshState | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await refreshDirectoryNow());
      } catch {
        setResult({ ok: false, message: "The refresh timed out or failed unexpectedly — check the run history below." });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="press rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            Refreshing from the official list…
          </span>
        ) : (
          "Refresh now"
        )}
      </button>
      {result && (
        <p
          role="status"
          className={`max-w-md rounded-xl p-3 text-end text-xs font-medium ${
            result.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
