import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDirectoryLastUpdated, formatDirectoryDate } from "@/lib/data";
import { Container } from "@/components/ui";
import { LogoMark } from "@/components/icons";
import { SITE_NAME } from "@/lib/site";

/**
 * The colophon.
 *
 * Read as a whole this is the least important part of the page, and the old
 * footer did not behave that way: four columns of links each set at the same
 * weight as body copy, under a heavy double rule. Here the links drop to
 * thirteen pixels and the columns are separated by hairlines, so the eye
 * reads it as an index of the site rather than as more content.
 *
 * The freshness line stays prominent, because on a directory it is the one
 * fact that decides whether anything above it can be trusted.
 */

interface FooterLink {
  href: string;
  label: string;
}

function LinkColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <nav aria-label={title}>
      <p className="eyebrow text-ink-400">{title}</p>
      <ul className="mt-5 space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="link-slide text-[13px] text-ink-600 hover:text-ink-900"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export async function Footer() {
  const t = await getTranslations("common.footer");
  const locale = (await getLocale()) as "en" | "ar";
  const lastUpdated = await getDirectoryLastUpdated();

  const directory: FooterLink[] = [
    { href: "/providers", label: t("allProviders") },
    { href: "/registry", label: t("registry") },
    { href: "/get-matched", label: t("getMatchedFree") },
    { href: "/assessment", label: t("readinessCheck") },
    { href: "/faq", label: t("faqTitle") },
    { href: "/track", label: t("trackRequest") },
  ];

  const tools: FooterLink[] = [
    { href: "/toolkit", label: t("toolkit") },
    { href: "/toolkit/penalty-calculator", label: t("penaltyCalculator") },
    { href: "/toolkit/readiness-planner", label: t("readinessPlanner") },
    { href: "/toolkit/checklist", label: t("checklist") },
    { href: "/guides", label: t("guides") },
    { href: "/integrations", label: t("integrations") },
    { href: "/resources", label: t("resources") },
  ];

  const legal: FooterLink[] = [
    { href: "/about", label: t("aboutUs") },
    { href: "/privacy", label: t("privacy") },
    { href: "/disclaimer", label: t("disclaimer") },
  ];

  return (
    <footer className="border-t border-ink-200 bg-paper-dark">
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-2">
            <p className="flex items-center gap-2.5 text-base font-medium tracking-tight text-ink-900">
              <span aria-hidden className="text-brand-800">
                <LogoMark size={20} />
              </span>
              {SITE_NAME}
            </p>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-ink-600">
              {t("tagline")}
            </p>
            <p className="num mt-6 inline-flex items-center gap-2.5 border-t border-ink-300 pt-3 text-[11px] tracking-wide text-ink-600">
              <span
                className="size-1.5 animate-pulse-soft rounded-full bg-brand-500"
                aria-hidden
              />
              {t("lastUpdated", { date: formatDirectoryDate(lastUpdated, locale) })}
            </p>
          </div>

          <LinkColumn title={t("directory")} links={directory} />
          <LinkColumn title={t("toolsGuides")} links={tools} />
          <LinkColumn title={t("legal")} links={legal} />
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-ink-200 pt-6 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="max-w-2xl text-[11px] leading-relaxed text-ink-500">
            {t("notAffiliated")}
          </p>
          <p className="num shrink-0 text-[11px] text-ink-400">
            © {new Date().getFullYear()} {SITE_NAME}. {t("rights")}
          </p>
        </div>
      </Container>
    </footer>
  );
}
