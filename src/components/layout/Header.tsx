"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { m, AnimatePresence } from "@/components/motion";

export interface HeaderMenuData {
  guides: { slug: string; title: string }[];
  categories: string[];
}

interface MenuLink {
  href: string;
  label: string;
}

interface MenuGroup {
  key: string;
  href: string;
  navKey: "providers" | "toolkit" | "guides";
  sections: { title?: string; links: MenuLink[] }[];
}

const menuItemVariants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0 },
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="transition-transform duration-200"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Header({ menu }: { menu: HeaderMenuData }) {
  const t = useTranslations("common");
  const tf = useTranslations("common.footer");
  const tc = useTranslations("common.categories");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus on navigation.
  useEffect(() => {
    setOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  const groups: MenuGroup[] = [
    {
      key: "providers",
      href: "/providers",
      navKey: "providers",
      sections: [
        {
          links: [
            { href: "/providers", label: tf("allProviders") },
            { href: "/registry", label: tf("registry") },
          ],
        },
        {
          title: tf("menuBrowse"),
          links: menu.categories.map((c) => ({
            href: `/providers/category/${c}`,
            label: tc(c as Parameters<typeof tc>[0]),
          })),
        },
      ],
    },
    {
      key: "toolkit",
      href: "/toolkit",
      navKey: "toolkit",
      sections: [
        {
          title: tf("menuTools"),
          links: [
            { href: "/toolkit/penalty-calculator", label: tf("penaltyCalculator") },
            { href: "/toolkit/readiness-planner", label: tf("readinessPlanner") },
            { href: "/toolkit/checklist", label: tf("checklist") },
            { href: "/assessment", label: tf("readinessCheck") },
            { href: "/resources/pint-ae-reference", label: tf("pintReference") },
          ],
        },
      ],
    },
    {
      key: "guides",
      href: "/guides",
      navKey: "guides",
      sections: [
        {
          title: tf("menuLearn"),
          links: [
            ...menu.guides.map((g) => ({ href: `/guides/${g.slug}`, label: g.title })),
            { href: "/resources/glossary", label: tf("glossaryLabel") },
            { href: "/integrations", label: tf("integrations") },
            { href: "/resources", label: tf("resources") },
          ],
        },
      ],
    },
  ];

  const plainItems = [
    { href: "/faq", key: "faq" },
    { href: "/track", key: "track" },
  ] as const;

  function armClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 160);
  }
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  const activeGroup = (g: MenuGroup) =>
    g.sections.some((s) => s.links.some((l) => pathname.startsWith(l.href))) ||
    pathname.startsWith(g.href);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/85 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? "border-ink-100 shadow-[0_4px_20px_-8px_rgb(2_6_23/0.12)]" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 text-lg font-bold tracking-tight text-ink-900"
          onClick={() => setOpen(false)}
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-lg bg-brand-700 text-sm font-black text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
          >
            ⚡
          </span>
          <span className="transition-colors group-hover:text-brand-800">{t("siteName")}</span>
        </Link>

        {/* Desktop nav with dropdowns */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {groups.map((g) => {
            const active = activeGroup(g);
            const isOpen = openMenu === g.key;
            return (
              <div
                key={g.key}
                className="relative"
                onMouseEnter={() => {
                  cancelClose();
                  setOpenMenu(g.key);
                }}
                onMouseLeave={armClose}
              >
                <Link
                  href={g.href}
                  aria-expanded={isOpen}
                  onFocus={() => setOpenMenu(g.key)}
                  className={`press relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                    active ? "text-brand-800" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  {active && (
                    <m.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-brand-50"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{t(`nav.${g.navKey}`)}</span>
                  <span className="relative text-ink-400">
                    <Chevron open={isOpen} />
                  </span>
                </Link>

                <AnimatePresence>
                  {isOpen && (
                    <m.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      onMouseEnter={cancelClose}
                      onMouseLeave={armClose}
                      className="absolute start-0 top-full z-50 pt-2"
                    >
                      <div className="min-w-64 max-w-xs rounded-2xl border border-ink-100 bg-white p-2 shadow-[0_16px_50px_-12px_rgb(2_6_23/0.25)]">
                        {g.sections.map((section, si) => (
                          <div key={si} className={si > 0 ? "mt-1 border-t border-ink-50 pt-1" : ""}>
                            {section.title && (
                              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                                {section.title}
                              </p>
                            )}
                            {section.links.map((l) => (
                              <Link
                                key={l.href}
                                href={l.href}
                                onClick={() => setOpenMenu(null)}
                                className={`group/item flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                                  pathname.startsWith(l.href)
                                    ? "bg-brand-50 font-semibold text-brand-800"
                                    : "text-ink-700 hover:bg-ink-50 hover:text-brand-800"
                                }`}
                              >
                                <span className="min-w-0 truncate">{l.label}</span>
                                <span
                                  aria-hidden
                                  className="text-ink-300 opacity-0 transition-all group-hover/item:translate-x-0.5 group-hover/item:opacity-100 rtl:rotate-180 rtl:group-hover/item:-translate-x-0.5"
                                >
                                  →
                                </span>
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {plainItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`press relative rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "text-brand-800" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                }`}
              >
                {active && (
                  <m.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-brand-50"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{t(`nav.${item.key}`)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={pathname}
            locale={locale === "en" ? "ar" : "en"}
            className="press hover-lift rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 hover:border-brand-300 hover:text-brand-800"
            aria-label={t("localeSwitcher.label")}
          >
            {locale === "en" ? t("localeSwitcher.ar") : t("localeSwitcher.en")}
          </Link>
          <Link
            href="/get-matched"
            className="press btn-shine hover-lift hidden rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 hover:shadow-md sm:block"
          >
            {t("nav.getMatched")}
          </Link>
          <button
            type="button"
            className="press grid size-10 place-items-center rounded-lg text-ink-700 hover:bg-ink-50 md:hidden"
            aria-expanded={open}
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <m.span
              className="grid place-items-center"
              initial={false}
              animate={{ rotate: open ? 90 : 0, scale: open ? 1.05 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                {open ? (
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </m.span>
          </button>
        </div>
      </div>

      {/* Mobile menu: groups expand in place for direct access */}
      <AnimatePresence>
        {open && (
          <m.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-ink-100 bg-white md:hidden"
            aria-label="Mobile"
          >
            <m.div
              className="space-y-1 px-4 py-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04 } } }}
            >
              {groups.map((g) => {
                const expanded = mobileSection === g.key;
                return (
                  <m.div key={g.key} variants={menuItemVariants}>
                    <div className="flex items-center rounded-lg hover:bg-ink-50">
                      <Link
                        href={g.href}
                        onClick={() => setOpen(false)}
                        className="press min-w-0 flex-1 px-3 py-2.5 text-base font-medium text-ink-700"
                      >
                        {t(`nav.${g.navKey}`)}
                      </Link>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${t(`nav.${g.navKey}`)} submenu`}
                        onClick={() => setMobileSection(expanded ? null : g.key)}
                        className="press grid size-10 shrink-0 place-items-center rounded-lg text-ink-500"
                      >
                        <Chevron open={expanded} />
                      </button>
                    </div>
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <m.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="ms-3 space-y-0.5 border-s-2 border-brand-100 ps-3 pb-1">
                            {g.sections.flatMap((s) => s.links).map((l) => (
                              <Link
                                key={l.href}
                                href={l.href}
                                onClick={() => setOpen(false)}
                                className="press block rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-50 hover:text-brand-800"
                              >
                                {l.label}
                              </Link>
                            ))}
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </m.div>
                );
              })}
              {plainItems.map((item) => (
                <m.div key={item.href} variants={menuItemVariants}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="press block rounded-lg px-3 py-2.5 text-base font-medium text-ink-700 hover:bg-ink-50"
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                </m.div>
              ))}
              <m.div variants={menuItemVariants}>
                <Link
                  href="/get-matched"
                  onClick={() => setOpen(false)}
                  className="press btn-shine block rounded-lg bg-brand-700 px-3 py-2.5 text-center text-base font-semibold text-white"
                >
                  {t("nav.getMatched")}
                </Link>
              </m.div>
            </m.div>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
