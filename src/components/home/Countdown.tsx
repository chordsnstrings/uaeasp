"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function diffParts(targetMs: number) {
  const delta = Math.max(0, targetMs - Date.now());
  return {
    days: Math.floor(delta / 86_400_000),
    hours: Math.floor(delta / 3_600_000) % 24,
    minutes: Math.floor(delta / 60_000) % 60,
    seconds: Math.floor(delta / 1000) % 60,
  };
}

/**
 * Live countdown to the e-invoicing mandate go-live. Values only render
 * after mount (placeholders during SSR) so server and client HTML match.
 */
export function Countdown({ targetIso }: { targetIso: string }) {
  const t = useTranslations("home.countdown");
  const targetMs = new Date(targetIso).getTime();
  const [parts, setParts] = useState<ReturnType<typeof diffParts> | null>(null);

  useEffect(() => {
    setParts(diffParts(targetMs));
    const id = setInterval(() => setParts(diffParts(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const tiles = [
    { key: "days", value: parts?.days },
    { key: "hours", value: parts?.hours },
    { key: "minutes", value: parts?.minutes },
    { key: "seconds", value: parts?.seconds },
  ] as const;

  return (
    <div className="mt-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-200">
        {t("title")}
      </p>
      <div dir="ltr" className="mt-3 flex gap-2.5 sm:gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="min-w-[68px] rounded-2xl bg-white/10 px-3 py-3 text-center ring-1 ring-white/20 backdrop-blur-sm sm:min-w-[84px] sm:px-4"
          >
            <span
              className={`block text-2xl font-extrabold tabular-nums sm:text-3xl ${
                tile.key === "seconds" ? "text-accent-400" : "text-white"
              }`}
              suppressHydrationWarning
            >
              {tile.value === undefined ? "–" : String(tile.value).padStart(2, "0")}
            </span>
            <span className="mt-0.5 block text-[11px] font-medium text-brand-200">
              {t(tile.key)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-xs text-brand-300">{t("note")}</p>
    </div>
  );
}
