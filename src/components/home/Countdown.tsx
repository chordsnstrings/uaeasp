"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "motion/react";
import { m, AnimatePresence } from "@/components/motion";

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
  const reduced = useReducedMotion();
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
              className={`relative block h-8 overflow-hidden text-2xl font-extrabold leading-8 tabular-nums sm:h-9 sm:text-3xl sm:leading-9 ${
                tile.key === "seconds" ? "text-accent-400" : "text-white"
              }`}
              suppressHydrationWarning
            >
              {/* Old value slides out the bottom while the new one drops in. */}
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={tile.value ?? "placeholder"}
                  className="block"
                  initial={reduced ? false : { y: "-100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduced ? undefined : { y: "100%", opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {tile.value === undefined ? "–" : String(tile.value).padStart(2, "0")}
                </m.span>
              </AnimatePresence>
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
