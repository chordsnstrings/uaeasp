import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  articles,
  leads,
  outreachMessages,
  outreachThreads,
  prospects,
  scrapeRuns,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { LogoMark } from "@/components/icons";
import { AdminNav, type NavCounts } from "@/components/admin/AdminNav";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Counts that decide where attention goes.
 *
 * Resolved once in the shell so every screen's badge agrees and no page has to
 * fetch its own. A failure here must never take the admin down, so it degrades
 * to zeroes rather than throwing.
 */
async function navCounts(): Promise<NavCounts> {
  try {
    const dayAgo = new Date(Date.now() - 86_400_000);
    const [approvals, drafts, newLeads, contactable, failedScrapes, replies] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(outreachMessages)
        .where(eq(outreachMessages.status, "pending_approval")),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(articles)
        .where(eq(articles.status, "draft")),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(eq(leads.status, "new"), gte(leads.createdAt, dayAgo))),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(prospects)
        .where(eq(prospects.status, "contactable")),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(scrapeRuns)
        .where(
          and(
            inArray(scrapeRuns.status, ["failed", "rejected"]),
            gte(scrapeRuns.startedAt, dayAgo),
          ),
        ),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(outreachThreads)
        .where(eq(outreachThreads.status, "replied")),
    ]);
    return {
      approvals: approvals[0]?.n ?? 0,
      drafts: drafts[0]?.n ?? 0,
      newLeads: newLeads[0]?.n ?? 0,
      contactable: contactable[0]?.n ?? 0,
      failedScrapes: failedScrapes[0]?.n ?? 0,
      replies: replies[0]?.n ?? 0,
    };
  } catch {
    return {};
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const { user } = session;
  const counts = await navCounts();

  return (
    <div className="flex min-h-dvh bg-paper">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-ink-200/70 bg-white lg:flex">
        <Link href="/admin" className="flex items-center gap-2.5 px-5 py-5">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-xl bg-brand-950 text-white"
          >
            <LogoMark size={17} />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-bold leading-tight text-ink-900">
              UAE ASP
            </span>
            <span className="block text-[11px] leading-tight text-ink-500">Operations console</span>
          </span>
        </Link>

        <AdminNav role={user.role} counts={counts} />

        <div className="border-t border-ink-200/70 p-4">
          <p className="truncate text-sm font-semibold text-ink-800">{user.name}</p>
          <p className="truncate text-xs text-ink-500">
            {user.email} · {user.role}
          </p>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="press w-full rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-ink-200/70 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
          <AdminNav role={user.role} counts={counts} variant="mobile" />
          <form action={logoutAction} className="ms-auto shrink-0">
            <button
              type="submit"
              className="press rounded-lg px-3 py-2 text-xs font-semibold text-ink-400"
            >
              Sign out
            </button>
          </form>
        </div>
        <main className="mx-auto max-w-[1400px] space-y-8 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
