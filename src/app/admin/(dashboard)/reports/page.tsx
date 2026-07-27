import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { agentReports } from "@/db/schema";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const reports = await db
    .select()
    .from(agentReports)
    .orderBy(desc(agentReports.periodStart))
    .limit(30);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Weekly reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          The Analyst compares each week with the one before, explains what moved and names
          the next actions.
        </p>
      </header>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 p-12 text-center">
          <p className="text-sm text-ink-500">
            No reports yet. Enable the Analyst and queue “Analyst — generate the weekly
            report”.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
          {reports.map((report) => {
            const metrics = report.metrics as {
              current?: { funnel?: { leads?: number }; traffic?: { visitors?: number } };
            };
            return (
              <li key={report.id}>
                <Link
                  href={`/admin/reports/${report.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-paper-dark"
                >
                  <span className="num text-sm font-semibold text-ink-900">
                    {report.periodStart} → {report.periodEnd}
                  </span>
                  <span className="num text-xs text-ink-500">
                    {metrics.current?.funnel?.leads ?? 0} leads ·{" "}
                    {metrics.current?.traffic?.visitors ?? 0} visitors
                  </span>
                  <span className="num ms-auto text-xs text-ink-400">
                    {report.emailedAt ? "emailed" : "not emailed"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
