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
 *
 * The digits are the graphic element of the whole home page, which is why
 * they are given a rule and some air rather than four bordered tiles: at
 * this size the numerals are already the loudest thing on the screen, and
 * boxing each one only competes with them.
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
    <div>
      <p className="eyebrow text-brand-300">{t("title")}</p>
      {/* No tiles. Four numbers on a rule, separated by hairlines — the
          digits are already the loudest thing here, and boxing each one
          only competes with them. */}
      <div dir="ltr" className="mt-5 flex border-t border-white/15">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="flex-1 border-e border-white/12 py-5 pe-4 last:border-e-0 first:ps-0"
          >
            <span
              className={`num relative block h-10 overflow-hidden text-3xl font-normal leading-10 tracking-tight sm:text-4xl ${
                tile.key === "seconds" ? "text-accent-300" : "text-white"
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
                  transition={{ duration: 0.32, ease: [0.2, 0.6, 0.2, 1] }}
                >
                  {tile.value === undefined ? "–" : String(tile.value).padStart(2, "0")}
                </m.span>
              </AnimatePresence>
            </span>
            <span className="eyebrow mt-2 block text-[10px] text-brand-300">
              {t(tile.key)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-brand-300">{t("note")}</p>
    </div>
  );
}
