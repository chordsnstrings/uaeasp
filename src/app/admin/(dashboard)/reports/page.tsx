import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { agentReports } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  Badge,
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
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Only the two headline numbers are read here — the detail page renders the rest. */
type ListMetrics = {
  current?: { funnel?: { leads?: number }; traffic?: { visitors?: number } };
};

/** period_start / period_end are date columns, so they arrive as plain ISO days. */
function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export default async function ReportsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const reports = await db
    .select()
    .from(agentReports)
    .orderBy(desc(agentReports.periodStart))
    .limit(30);

  const rows = reports.map((report) => {
    const metrics = report.metrics as ListMetrics;
    return {
      report,
      leads: metrics.current?.funnel?.leads ?? 0,
      visitors: metrics.current?.traffic?.visitors ?? 0,
    };
  });

  const latest = rows[0];
  const previous = rows[1];
  const emailed = rows.filter((r) => r.report.emailedAt).length;

  // Oldest first, so the chart reads left-to-right in time.
  const chronological = [...rows].reverse();
  const seenLabels = new Map<string, number>();
  const points = chronological.map((r) => {
    const base = formatDay(r.report.periodStart);
    const n = (seenLabels.get(base) ?? 0) + 1;
    seenLabels.set(base, n);
    return { label: n > 1 ? `${base} (${n})` : base, value: r.leads };
  });

  return (
    <>
      <PageHeader
        title="Weekly reports"
        count={rows.length}
        subtitle="The Analyst compares each week with the one before, explains what moved and names the next actions."
        actions={<ButtonLink href="/admin/agents">Agent console</ButtonLink>}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No reports yet"
            body="Enable the Analyst and queue “Analyst — generate the weekly report”. Each run lands here and is emailed to the admin address."
            action={<ButtonLink href="/admin/agents">Open the agent console</ButtonLink>}
          />
        </Card>
      ) : (
        <>
          <section>
            <SectionTitle hint="The most recent period, against the one before it.">
              Latest week
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Leads"
                value={latest?.leads ?? 0}
                tone="brand"
                delta={previous ? delta(latest?.leads ?? 0, previous.leads) : undefined}
                spark={points.map((p) => p.value)}
                hint={latest ? `Week of ${formatDay(latest.report.periodStart)}` : undefined}
              />
              <StatCard
                label="Visitors"
                value={latest?.visitors ?? 0}
                delta={previous ? delta(latest?.visitors ?? 0, previous.visitors) : undefined}
                spark={chronological.map((r) => r.visitors)}
                hint="Unique visitors in that week."
              />
              <StatCard
                label="Reports stored"
                value={rows.length}
                hint="Most recent 30 periods."
              />
              <StatCard
                label="Emailed"
                value={`${emailed}/${rows.length}`}
                tone={emailed === rows.length ? "positive" : "warning"}
                hint={
                  emailed === rows.length
                    ? "Every report reached the admin inbox."
                    : "Some reports were never sent — check the SMTP settings."
                }
              />
            </div>
          </section>

          <Card>
            <SectionTitle hint="Leads captured in each reported week, oldest first.">
              Leads per week
            </SectionTitle>
            <ColumnChart points={points} tone="brand" />
          </Card>

          <section className="space-y-4">
            <SectionTitle hint="Newest period first. Open a report for the narrative and the recommendations.">
              All reports
            </SectionTitle>
            <DataTable head={["Period", "Leads", "Visitors", "Email", ""]} minWidth="46rem">
              {rows.map(({ report, leads, visitors }) => (
                <Row key={report.id}>
                  <Cell>
                    <Link
                      href={`/admin/reports/${report.id}`}
                      className="num text-sm font-semibold text-ink-900 hover:text-brand-700"
                    >
                      {formatDay(report.periodStart)} → {formatDay(report.periodEnd)}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {report.kind}
                      {report.narrativeMd ? "" : " · no narrative"}
                    </p>
                  </Cell>
                  <Cell className="num text-sm font-semibold text-ink-900">{leads}</Cell>
                  <Cell className="num text-sm text-ink-700">{visitors}</Cell>
                  <Cell>
                    <Badge tone={report.emailedAt ? "positive" : "neutral"}>
                      {report.emailedAt ? "emailed" : "not emailed"}
                    </Badge>
                  </Cell>
                  <Cell>
                    <div className="flex justify-end">
                      <ButtonLink href={`/admin/reports/${report.id}`}>Open</ButtonLink>
                    </div>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </section>
        </>
      )}
    </>
  );
}
