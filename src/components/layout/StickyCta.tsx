"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { m, AnimatePresence } from "@/components/motion";
import { buttonClass } from "@/components/ui";

/**
 * Mobile-only sticky bar that appears after scrolling, guiding users to the
 * lead form from anywhere on the public site. Hidden on the form pages.
 */
export function StickyCta() {
  const t = useTranslations("common.cta");
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const suppressed =
    pathname.startsWith("/get-matched") || pathname.startsWith("/thank-you");

  return (
    <AnimatePresence>
      {visible && !suppressed && (
        <m.div
          initial={{ y: 96 }}
          animate={{ y: 0 }}
          exit={{ y: 96 }}
          transition={{ duration: 0.3, ease: [0.2, 0.6, 0.2, 1] }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-paper/95 p-3 backdrop-blur-md sm:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-xs text-ink-600">
              {t("stickyText")}
            </p>
            <Link
              href="/get-matched"
              className={buttonClass({ className: "shrink-0" })}
            >
              {t("stickyButton")}
            </Link>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
