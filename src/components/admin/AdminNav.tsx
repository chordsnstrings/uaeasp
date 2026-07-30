"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Admin navigation.
 *
 * Two things the old sidebar did not do. It never marked the current page —
 * eleven identical links with no active state, so the shell gave you no idea
 * where you were. And it never showed where the work was, so finding out
 * whether anything needed approving meant opening the page to look.
 *
 * Counts are resolved on the server and passed in, so a badge here is a real
 * number rather than a fetch on every navigation.
 */

export interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
  exact?: boolean;
  /** Key into the counts map; a non-zero value renders as a badge. */
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", exact: true }],
  },
  {
    title: "Pipeline",
    items: [
      { href: "/admin/leads", label: "Leads", badge: "newLeads" },
      { href: "/admin/analytics", label: "Analytics" },
    ],
  },
  {
    title: "Directory",
    items: [
      { href: "/admin/providers", label: "Providers" },
      { href: "/admin/scrapes", label: "Data refreshes", badge: "failedScrapes" },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/admin/inbox", label: "Inbox", adminOnly: true, badge: "replies" },
      { href: "/admin/agents", label: "Agents", adminOnly: true, exact: true },
      { href: "/admin/agents/approvals", label: "Approvals", adminOnly: true, badge: "approvals" },
      { href: "/admin/agents/prospects", label: "Prospects", adminOnly: true, badge: "contactable" },
      { href: "/admin/agents/content", label: "Content", adminOnly: true, badge: "drafts" },
      { href: "/admin/agents/visibility", label: "Visibility", adminOnly: true },
      { href: "/admin/reports", label: "Reports", adminOnly: true },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/users", label: "Team", adminOnly: true },
      { href: "/admin/settings", label: "Settings", adminOnly: true },
    ],
  },
];

export type NavCounts = Partial<Record<string, number>>;

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Badge({ value, urgent }: { value: number; urgent?: boolean }) {
  return (
    <span
      className={`num ms-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-4 ${
        urgent ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"
      }`}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function AdminNav({
  role,
  counts,
  variant = "sidebar",
}: {
  role: string;
  counts: NavCounts;
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.adminOnly || role === "admin"),
  })).filter((g) => g.items.length);

  if (variant === "mobile") {
    return (
      <div className="flex items-center gap-1 overflow-x-auto">
        {groups.flatMap((g) =>
          g.items.map((item) => {
            const active = isActive(pathname, item);
            const n = counts[item.badge ?? ""] ?? 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`press flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"
                }`}
              >
                {item.label}
                {n > 0 && (
                  <span
                    className={`num rounded-full px-1 text-[10px] ${
                      active ? "bg-white/20" : "bg-brand-600 text-white"
                    }`}
                  >
                    {n > 99 ? "99+" : n}
                  </span>
                )}
              </Link>
            );
          }),
        )}
      </div>
    );
  }

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const n = counts[item.badge ?? ""] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`press relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-ink-900 text-white shadow-sm"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  {item.label}
                  {n > 0 && <Badge value={n} urgent={!active && item.badge === "approvals"} />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
