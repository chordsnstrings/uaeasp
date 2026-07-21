"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { trackPageview } from "@/lib/analytics";

/** Fires a first-party pageview on load and on every client-side navigation. */
export function Analytics() {
  const pathname = usePathname();
  const locale = useLocale() as "en" | "ar";
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    trackPageview(pathname, locale);
  }, [pathname, locale]);

  return null;
}
