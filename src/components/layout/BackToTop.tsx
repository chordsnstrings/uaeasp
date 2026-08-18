"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { m, AnimatePresence } from "@/components/motion";

/** A small square mark that appears after scrolling; desktop and tablet only,
 * so it never fights the mobile sticky CTA bar. Bordered rather than filled:
 * a floating black pill is the one piece of app furniture this design has no
 * room for. */
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.24, ease: [0.2, 0.6, 0.2, 1] }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={t("backToTop")}
          className="press fixed bottom-8 z-40 hidden size-11 place-items-center rounded-md border border-ink-300 bg-paper/90 text-ink-700 backdrop-blur-sm hover:border-ink-900 hover:text-ink-900 sm:grid ltr:right-8 rtl:left-8"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M10 15V5M5.5 9.5L10 5l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </m.button>
      )}
    </AnimatePresence>
  );
}
