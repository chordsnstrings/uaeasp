import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { providers, scrapeChanges, scrapeRuns } from "@/db/schema";
import { formatDateTime } from "@/components/admin/status";
import { RefreshDirectoryButton } from "@/components/admin/RefreshDirectoryButton";
import {
  Badge,
  BarList,
  ButtonLink,
  Card,
  Cell,
  ColumnChart,
  DataTable,
  EmptyState,
  PageHeader,
  Row,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const RUN_TONE: Record<string, Tone> = {
  success: "positive",
  partial: "warning",
  rejected: "warning",
  failed: "danger",
};

const CHANGE_TONE: Record<string, Tone> = {
  added: "positive",
  updated: "info",
  missing: "warning",
  delisted: "danger",
  restored: "brand",
};

const STRATEGY_LABELS: Record<string, string> = {
  seed: "seed",
  scrape_html: "HTML",
  scrape_pdf: "PDF",
  manual: "manual",
};

/** Short axis label for a run — deduplicated so two runs a minute apart still key cleanly. */
function axisLabel(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Dubai",
  }).format(date);
}

function duration(started: Date | string, finished: Date | string | null): string | null {
  if (!finished) return null;
  const ms =
    (typeof finished === "string" ? new Date(finished) : finished).getTime() -
    (typeof started === "string" ? new Date(started) : started).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="size-3.5 shrink-0 -rotate-90 text-ink-400 transition-transform group-open:rotate-0 rtl:rotate-90 rtl:group-open:rotate-0"
    >
      <path
        d="m5 7.5 5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

  const latest = runs[0];
  const succeeded = runs.filter((r) => r.status === "success").length;
  const broken = runs.filter((r) => r.status === "failed" || r.status === "rejected").length;
  const moved = runs.reduce((sum, r) => sum + r.added + r.updated + r.missing, 0);

  // Oldest → newest, so the chart and the sparkline read left-to-right in time.
  const chronological = [...runs].reverse();
  const seenLabels = new Map<string, number>();
  const points = chronological.map((r) => {
    const base = axisLabel(r.startedAt);
    const n = (seenLabels.get(base) ?? 0) + 1;
    seenLabels.set(base, n);
    return { label: n > 1 ? `${base} (${n})` : base, value: r.providersFound };
  });

  const changeMix = new Map<string, number>();
  for (const list of changesByRun.values()) {
    for (const c of list) changeMix.set(c.changeType, (changeMix.get(c.changeType) ?? 0) + 1);
  }

  const runsWithChanges = runs
    .slice(0, 10)
    .map((run) => ({ run, changes: changesByRun.get(run.id) ?? [] }))
    .filter((entry) => entry.changes.length > 0);

  return (
    <>
      <PageHeader
        title="Data refreshes"
        count={runs.length}
        subtitle="Every automatic and manual reconciliation of the provider directory against the official Ministry of Finance list, newest first."
        actions={<RefreshDirectoryButton />}
      />

      {runs.length === 0 ? (
        <Card>
          <EmptyState
            title="No refreshes have run yet"
            body="The nightly workflow records every run here. You can also start one now and watch the result land."
            action={<ButtonLink href="/admin/settings">Check refresh settings</ButtonLink>}
          />
        </Card>
      ) : (
        <>
          <section>
            <SectionTitle hint={`Across the last ${runs.length} recorded runs.`}>
              Refresh health
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Latest run"
                value={latest?.status ?? "—"}
                tone={latest ? (RUN_TONE[latest.status] ?? "neutral") : "neutral"}
                hint={latest ? formatDateTime(latest.startedAt) : undefined}
              />
              <StatCard
                label="Providers found"
                value={latest?.providersFound ?? 0}
                spark={points.map((p) => p.value)}
                hint="On the official list in the latest run."
              />
              <StatCard
                label="Clean runs"
                value={`${succeeded}/${runs.length}`}
                tone={broken === 0 ? "positive" : "neutral"}
                hint={broken > 0 ? `${broken} failed or rejected` : "No failures in this window."}
              />
              <StatCard
                label="Records touched"
                value={moved}
                tone={moved > 0 ? "info" : "neutral"}
                hint="Added, updated and missing, summed over these runs."
              />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <SectionTitle hint="One column per run, oldest first. A sudden drop usually means the source page changed shape.">
                Providers found per run
              </SectionTitle>
              <ColumnChart points={points} tone="brand" />
            </Card>

            <Card>
              <SectionTitle hint="Recorded in the runs detailed below.">Change mix</SectionTitle>
              <BarList
                tone="info"
                items={[...changeMix.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, value]) => ({ label, value }))}
                emptyLabel="These runs changed nothing — the directory already matched the source."
              />
            </Card>
          </div>

          <section className="space-y-4">
            <SectionTitle hint="Counts are per run: found on the source, added here, updated here, and entries that had gone missing.">
              Run log
            </SectionTitle>
            <DataTable
              head={["Status", "Started", "Trigger", "Found", "Added", "Updated", "Missing", "Changes"]}
              minWidth="64rem"
            >
              {runs.map((run) => {
                const changes = changesByRun.get(run.id);
                const took = duration(run.startedAt, run.finishedAt);
                return (
                  <Row key={run.id}>
                    <Cell>
                      <Badge tone={RUN_TONE[run.status] ?? "neutral"}>{run.status}</Badge>
                      {run.error && (
                        <p className="mt-1.5 max-w-[22rem] text-xs leading-relaxed text-red-700">
                          {run.error}
                        </p>
                      )}
                    </Cell>
                    <Cell className="whitespace-nowrap">
                      <span className="num text-sm text-ink-800">
                        {formatDateTime(run.startedAt)}
                      </span>
                      {took && <p className="num mt-0.5 text-xs text-ink-400">took {took}</p>}
                    </Cell>
                    <Cell className="whitespace-nowrap text-xs text-ink-500">
                      {run.triggeredBy}
                      <span className="block text-ink-400">
                        via {run.strategy ? (STRATEGY_LABELS[run.strategy] ?? run.strategy) : "—"}
                      </span>
                    </Cell>
                    <Cell className="num text-sm font-semibold text-ink-900">
                      {run.providersFound}
                    </Cell>
                    <Cell
                      className={`num text-sm ${run.added > 0 ? "font-semibold text-emerald-700" : "text-ink-400"}`}
                    >
                      {run.added > 0 ? `+${run.added}` : "0"}
                    </Cell>
                    <Cell
                      className={`num text-sm ${run.updated > 0 ? "font-semibold text-sky-800" : "text-ink-400"}`}
                    >
                      {run.updated}
                    </Cell>
                    <Cell
                      className={`num text-sm ${run.missing > 0 ? "font-semibold text-amber-700" : "text-ink-400"}`}
                    >
                      {run.missing}
                    </Cell>
                    <Cell className="whitespace-nowrap">
                      {changes === undefined ? (
                        <span className="text-xs text-ink-400">not loaded</span>
                      ) : changes.length === 0 ? (
                        <span className="text-xs text-ink-400">none</span>
                      ) : (
                        <a
                          href={`#run-${run.id}`}
                          className="num text-xs font-semibold text-brand-700 hover:text-brand-900"
                        >
                          {changes.length} change{changes.length > 1 ? "s" : ""}
                        </a>
                      )}
                    </Cell>
                  </Row>
                );
              })}
            </DataTable>
          </section>

          <Card padded={false}>
            <div className="p-5 pb-4 sm:p-6 sm:pb-4">
              <SectionTitle hint="Field-by-field detail for the ten most recent runs. The newest is open.">
                What changed
              </SectionTitle>
            </div>
            {runsWithChanges.length === 0 ? (
              <div className="px-5 pb-6 sm:px-6">
                <EmptyState
                  title="Nothing changed in the recent runs"
                  body="The directory already matched the official list every time. Changes appear here the moment the source moves."
                />
              </div>
            ) : (
              <div className="divide-y divide-ink-100 border-t border-ink-100">
                {runsWithChanges.map(({ run, changes }, index) => (
                  <details key={run.id} id={`run-${run.id}`} open={index === 0} className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60 sm:px-6 [&::-webkit-details-marker]:hidden">
                      <ChevronIcon />
                      <Badge tone={RUN_TONE[run.status] ?? "neutral"}>{run.status}</Badge>
                      <span className="num text-sm font-semibold text-ink-900">
                        {formatDateTime(run.startedAt)}
                      </span>
                      <span className="num text-xs text-ink-500">
                        +{run.added} added · {run.updated} updated · {run.missing} missing
                      </span>
                      <span className="num ms-auto text-xs font-semibold text-ink-500">
                        {changes.length} record{changes.length > 1 ? "s" : ""}
                      </span>
                    </summary>
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                      <DataTable
                        head={["Change", "Provider", "Field", "Before", "After"]}
                        minWidth="46rem"
                      >
                        {changes.map((c, i) => (
                          <Row key={i}>
                            <Cell className="whitespace-nowrap">
                              <Badge tone={CHANGE_TONE[c.changeType] ?? "neutral"}>
                                {c.changeType}
                              </Badge>
                            </Cell>
                            <Cell className="text-sm font-medium text-ink-900">
                              {c.providerName ?? (
                                <span className="text-ink-400">new provider</span>
                              )}
                            </Cell>
                            <Cell className="text-xs text-ink-500">{c.field ?? "—"}</Cell>
                            <Cell className="max-w-[16rem] break-words text-xs text-ink-500 line-through">
                              {c.oldValue ?? "—"}
                            </Cell>
                            <Cell className="max-w-[16rem] break-words text-xs font-medium text-ink-900">
                              {c.newValue ?? "—"}
                            </Cell>
                          </Row>
                        ))}
                      </DataTable>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
