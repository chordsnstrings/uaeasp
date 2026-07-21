import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/providers", label: "Providers" },
  { href: "/admin/scrapes", label: "Data refreshes" },
  { href: "/admin/users", label: "Team", adminOnly: true },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const { user } = session;

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-e border-ink-100 bg-white lg:flex">
        <Link href="/admin" className="flex items-center gap-2 px-5 py-5">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-lg bg-brand-700 text-sm font-black text-white"
          >
            ⚡
          </span>
          <span className="text-sm font-bold text-ink-900">Team CRM</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.filter((n) => !n.adminOnly || user.role === "admin").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="press block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-ink-100 p-4">
          <p className="truncate text-sm font-semibold text-ink-800">{user.name}</p>
          <p className="truncate text-xs text-ink-500">
            {user.email} · {user.role}
          </p>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="press w-full rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 hover:border-red-200 hover:text-red-600"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-ink-100 bg-white px-3 py-2 lg:hidden">
          {NAV.filter((n) => !n.adminOnly || user.role === "admin").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="press shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-50"
            >
              {item.label}
            </Link>
          ))}
          <form action={logoutAction} className="ms-auto shrink-0">
            <button type="submit" className="press rounded-lg px-3 py-2 text-xs font-semibold text-ink-400">
              Sign out
            </button>
          </form>
        </div>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
