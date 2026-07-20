"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { m, AnimatePresence } from "@/components/motion";

/** Floating button that appears after scrolling; desktop and tablet only so it
 * never fights the mobile sticky CTA bar. */
export function BackToTop() {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 900);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <m.button
          type="button"
          initial={{ opacity: 0, scale: 0.6, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 12 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={t("backToTop")}
          className="fixed bottom-6 z-40 hidden size-11 place-items-center rounded-full bg-ink-900/90 text-white shadow-lg backdrop-blur-sm hover:bg-brand-800 sm:grid ltr:right-6 rtl:left-6"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M10 15V5M5.5 9.5L10 5l4.5 4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </m.button>
      )}
    </AnimatePresence>
  );
}
