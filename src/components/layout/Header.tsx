"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { m, AnimatePresence } from "@/components/motion";
import { LogoMark } from "@/components/icons";
import { buttonClass } from "@/components/ui";

/**
 * The masthead.
 *
 * What changed, and why: the previous header announced the current section
 * with a filled pill and lifted its dropdowns on a wide drop shadow, which
 * are both app conventions. Here the active section is marked by a single
 * clay rule beneath the word — the way a section is marked in print — and
 * the whole bar is separated from the page by one hairline rather than by
 * a shadow that deepens as you scroll.
 *
 * The one exception to the no-shadow rule is the dropdown panel. A menu
 * floating over body text has to be legible above all else, and a hairline
 * alone does not separate white from white. It gets the faintest possible
 * cast, and nothing else on the site does.
 */

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

const EASE = [0.2, 0.6, 0.2, 1] as const;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="transition-transform duration-200"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path
        d="M2.5 4.5L6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-paper/92 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          href="/"
          className="group flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none"
          onClick={() => setOpen(false)}
        >
          <span aria-hidden className="shrink-0 text-brand-800">
            <LogoMark size={22} />
          </span>
          <span className="truncate text-[15px] font-medium tracking-tight text-ink-900 group-hover:text-brand-800 sm:text-base">
            {t("siteName")}
          </span>
        </Link>

        {/* Desktop nav. The active section is a rule, not a pill. */}
        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
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
                  className={`relative flex items-center gap-1.5 py-6 text-sm ${
                    active ? "text-ink-900" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  <span>{t(`nav.${g.navKey}`)}</span>
                  <span className="text-ink-500">
                    <Chevron open={isOpen} />
                  </span>
                  {active && (
                    <m.span
                      layoutId="nav-active"
                      className="absolute inset-x-0 bottom-0 h-px bg-accent-500"
                      transition={{ duration: 0.28, ease: EASE }}
                    />
                  )}
                </Link>

                <AnimatePresence>
                  {isOpen && (
                    <m.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 2 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      onMouseEnter={cancelClose}
                      onMouseLeave={armClose}
                      className="absolute start-0 top-full z-50"
                    >
                      <div className="min-w-64 max-w-xs border border-ink-200 bg-white p-1.5 shadow-[0_18px_40px_-32px_rgb(13_13_11/0.6)]">
                        {g.sections.map((section, si) => (
                          <div
                            key={si}
                            className={si > 0 ? "mt-1.5 border-t border-ink-100 pt-1.5" : ""}
                          >
                            {section.title && (
                              <p className="eyebrow px-3 pb-1.5 pt-2 text-ink-500">
                                {section.title}
                              </p>
                            )}
                            {section.links.map((l) => (
                              <Link
                                key={l.href}
                                href={l.href}
                                onClick={() => setOpenMenu(null)}
                                className={`group/item flex items-center justify-between gap-3 px-3 py-2 text-sm ${
                                  pathname.startsWith(l.href)
                                    ? "bg-ink-50 text-ink-900"
                                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                                }`}
                              >
                                <span className="min-w-0 truncate">{l.label}</span>
                                <span
                                  aria-hidden
                                  className="text-ink-300 opacity-0 transition-opacity group-hover/item:opacity-100 rtl:rotate-180"
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
                className={`relative py-6 text-sm ${
                  active ? "text-ink-900" : "text-ink-600 hover:text-ink-900"
                }`}
              >
                <span>{t(`nav.${item.key}`)}</span>
                {active && (
                  <m.span
                    layoutId="nav-active"
                    className="absolute inset-x-0 bottom-0 h-px bg-accent-500"
                    transition={{ duration: 0.28, ease: EASE }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href={pathname}
            locale={locale === "en" ? "ar" : "en"}
            className="eyebrow text-ink-500 hover:text-ink-900"
            aria-label={t("localeSwitcher.label")}
          >
            {locale === "en" ? t("localeSwitcher.ar") : t("localeSwitcher.en")}
          </Link>
          <Link href="/get-matched" className={buttonClass({ className: "hidden sm:inline-flex" })}>
            {t("nav.getMatched")}
          </Link>
          <button
            type="button"
            className="press -me-2 grid size-10 place-items-center text-ink-800 md:hidden"
            aria-expanded={open}
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              {open ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M3 6.5h14M3 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
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
            transition={{ duration: 0.28, ease: EASE }}
            className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-ink-200 bg-paper md:hidden"
            aria-label="Mobile"
          >
            <div className="px-5 py-2">
              {groups.map((g) => {
                const expanded = mobileSection === g.key;
                return (
                  <div key={g.key} className="border-b border-ink-100">
                    <div className="flex items-center">
                      <Link
                        href={g.href}
                        onClick={() => setOpen(false)}
                        className="min-w-0 flex-1 py-3.5 text-[15px] text-ink-800"
                      >
                        {t(`nav.${g.navKey}`)}
                      </Link>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${t(`nav.${g.navKey}`)} submenu`}
                        onClick={() => setMobileSection(expanded ? null : g.key)}
                        className="press grid size-10 shrink-0 place-items-center text-ink-500"
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
                          transition={{ duration: 0.24, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <div className="ms-1 border-s border-ink-200 ps-4 pb-3">
                            {g.sections
                              .flatMap((s) => s.links)
                              .map((l) => (
                                <Link
                                  key={l.href}
                                  href={l.href}
                                  onClick={() => setOpen(false)}
                                  className="block py-2 text-sm text-ink-600 hover:text-ink-900"
                                >
                                  {l.label}
                                </Link>
                              ))}
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              {plainItems.map((item) => (
                <div key={item.href} className="border-b border-ink-100">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block py-3.5 text-[15px] text-ink-800"
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                </div>
              ))}
              <Link
                href="/get-matched"
                onClick={() => setOpen(false)}
                className={buttonClass({ size: "lg", className: "my-4 w-full" })}
              >
                {t("nav.getMatched")}
              </Link>
            </div>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
