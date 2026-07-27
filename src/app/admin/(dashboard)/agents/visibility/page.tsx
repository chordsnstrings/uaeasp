import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { visibilityTargets } from "@/db/schema";
import { auth } from "@/lib/auth";
import { TargetStatusForm } from "@/components/admin/AgentConsole";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    kind: "citation" as const,
    title: "Citations",
    blurb: "Business listings to claim. Use identical name, address and phone on each.",
  },
  {
    kind: "mention" as const,
    title: "Mentions & link targets",
    blurb: "Pages writing about the mandate that could cite the directory.",
  },
  {
    kind: "link" as const,
    title: "Ranking competitors",
    blurb: "Who currently outranks us for the keywords we track.",
  },
];

export default async function VisibilityTargetsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const groups = await Promise.all(
    SECTIONS.map(async (section) => ({
      ...section,
      rows: await db
        .select()
        .from(visibilityTargets)
        .where(eq(visibilityTargets.kind, section.kind))
        .orderBy(desc(visibilityTargets.createdAt))
        .limit(40),
    })),
  );

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/agents" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
          ← Agents
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">Visibility targets</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Places worth being listed or cited. The agent finds and drafts; a human decides and
          posts — automated link dropping is what gets a domain penalised, so it does not do
          that.
        </p>
      </header>

      {groups.map((group) => (
        <section key={group.kind}>
          <h2 className="num text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            {group.title} ({group.rows.length})
          </h2>
          <p className="mt-1 text-xs text-ink-500">{group.blurb}</p>
          <div className="mt-4 space-y-3">
            {group.rows.length === 0 && (
              <p className="rounded-xl border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500">
                Nothing here yet.
              </p>
            )}
            {group.rows.map((target) => (
              <div key={target.id} className="rounded-xl border border-ink-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={target.url}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="font-medium text-ink-900 hover:text-brand-800"
                    >
                      {target.title || target.url}
                    </a>
                    <p className="num mt-0.5 truncate text-xs text-ink-400" dir="ltr">
                      {target.domain}
                    </p>
                    {target.snippet && (
                      <p className="mt-2 text-sm text-ink-600">{target.snippet}</p>
                    )}
                    {target.notes && (
                      <p className="mt-2 text-xs text-ink-500">{target.notes}</p>
                    )}
                  </div>
                  <TargetStatusForm targetId={target.id} status={target.status} />
                </div>
                {target.draft && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                      Drafted pitch
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-paper-dark p-3 text-xs text-ink-700">
                      {target.draft}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
