import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { providers, scrapeChanges, scrapeRuns } from "@/db/schema";
import { formatDateTime } from "@/components/admin/status";

export const dynamic = "force-dynamic";

const RUN_BADGE: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  partial: "bg-amber-50 text-amber-700 ring-amber-200",
  rejected: "bg-orange-50 text-orange-700 ring-orange-200",
  failed: "bg-rose-50 text-rose-600 ring-rose-200",
};

export default async function AdminScrapesPage() {
  const runs = await db
    .select()
    .from(scrapeRuns)
    .orderBy(desc(scrapeRuns.startedAt))
    .limit(30);

  const changesByRun = new Map<
    string,
    { changeType: string; field: string | null; oldValue: string | null; newValue: string | null; providerName: string | null }[]
  >();
  for (const run of runs.slice(0, 10)) {
    const changes = await db
      .select({
        changeType: scrapeChanges.changeType,
        field: scrapeChanges.field,
        oldValue: scrapeChanges.oldValue,
        newValue: scrapeChanges.newValue,
        providerName: providers.name,
      })
      .from(scrapeChanges)
      .leftJoin(providers, eq(scrapeChanges.providerId, providers.id))
      .where(eq(scrapeChanges.runId, run.id))
      .limit(100);
    changesByRun.set(run.id, changes);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Data refreshes</h1>
        <p className="mt-1 text-sm text-ink-500">
          History of automatic and manual refreshes of the provider directory against the
          official Ministry of Finance list.
        </p>
      </div>

      {runs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink-200 p-10 text-center text-sm text-ink-400">
          No refresh runs yet. The weekly refresh will appear here, or trigger one manually
          from the GitHub Actions workflow.
        </div>
      )}

      <ul className="space-y-4">
        {runs.map((run) => {
          const changes = changesByRun.get(run.id) ?? [];
          return (
            <li key={run.id} className="rounded-2xl border border-ink-100 bg-white p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ring-1 ${RUN_BADGE[run.status] ?? RUN_BADGE.failed}`}>
                  {run.status}
                </span>
                <span className="text-sm font-semibold text-ink-800">
                  {formatDateTime(run.startedAt)}
                </span>
                <span className="text-xs text-ink-500">
                  via {run.strategy ?? "—"} · triggered by {run.triggeredBy}
                </span>
                <span className="ms-auto text-xs font-medium text-ink-500">
                  {run.providersFound} found · +{run.added} added · {run.updated} updated ·{" "}
                  {run.missing} missing
                </span>
              </div>
              {run.error && (
                <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                  {run.error}
                </p>
              )}
              {changes.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                    {changes.length} change{changes.length > 1 ? "s" : ""}
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-ink-600">
                    {changes.map((c, i) => (
                      <li key={i} className="rounded-lg bg-ink-50 px-3 py-1.5">
                        <span className="font-semibold uppercase text-ink-500">{c.changeType}</span>{" "}
                        {c.providerName ?? "(new provider)"}
                        {c.field && (
                          <>
                            {" "}
                            · {c.field}: <span className="text-rose-600 line-through">{c.oldValue ?? "—"}</span>{" "}
                            → <span className="text-emerald-700">{c.newValue ?? "—"}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
