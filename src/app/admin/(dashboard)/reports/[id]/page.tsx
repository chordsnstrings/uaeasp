import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentReports } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { WeeklyMetrics, Recommendation } from "@/lib/agents/analyst";
import { formatDateTime } from "@/components/admin/status";
import {
  Badge,
  BarList,
  ButtonLink,
  Card,
  Dot,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatCard,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** period_start / period_end are date columns, so they arrive as plain ISO days. */
function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Percentage change, or null when there is no baseline to compare against. */
function delta(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return ((now - before) / before) * 100;
}

/** Minimal markdown rendering: headings, bullets, ordered lists, paragraphs. */
function renderMarkdown(md: string): React.ReactNode {
  const blocks = md.split("\n");
  return blocks.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={i} className="mt-6 font-display text-lg font-bold text-ink-900 first:mt-0">
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (/^[-*] /.test(trimmed)) {
      return (
        <p key={i} className="mt-1.5 ps-5 text-sm leading-relaxed text-ink-700">
          <span className="text-brand-600">—</span> {trimmed.slice(2)}
        </p>
      );
    }
    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <p key={i} className="num mt-1.5 ps-5 text-sm leading-relaxed text-ink-700">
          {trimmed}
        </p>
      );
    }
    return (
      <p key={i} className="mt-2 text-sm leading-relaxed text-ink-700">
        {trimmed.replace(/^_|_$/g, "")}
      </p>
    );
  });
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");
  const { id } = await params;

  const [report] = await db
    .select()
    .from(agentReports)
    .where(eq(agentReports.id, id))
    .limit(1);
  if (!report) notFound();

  const metrics = report.metrics as { current: WeeklyMetrics; previous: WeeklyMetrics };
  const recommendations = (report.recommendations ?? []) as Recommendation[];
  const { current, previous } = metrics;

  const stats: { label: string; now: number; before: number; hint?: string }[] = [
    { label: "Leads", now: current.funnel.leads, before: previous.funnel.leads },
    { label: "Visitors", now: current.traffic.visitors, before: previous.traffic.visitors },
    { label: "Pageviews", now: current.traffic.pageviews, before: previous.traffic.pageviews },
    { label: "Emails sent", now: current.outreach.sent, before: previous.outreach.sent },
    { label: "Replies", now: current.outreach.replies, before: previous.outreach.replies },
    {
      label: "Prospects found",
      now: current.prospecting.discovered,
      before: previous.prospecting.discovered,
    },
    { label: "Keywords top 10", now: current.seo.keywordsTop10, before: previous.seo.keywordsTop10 },
    {
      label: "Unsubscribes",
      now: current.outreach.unsubscribes,
      before: previous.outreach.unsubscribes,
      hint: "Lower is better.",
    },
  ];

  // Older stored reports may predate these fields, so never trust the shape.
  const topPages = Array.isArray(current.topPages) ? current.topPages : [];
  const agentActivity = Array.isArray(current.agentActivity) ? current.agentActivity : [];

  return (
    <>
      <PageHeader
        title={`${formatDay(report.periodStart)} → ${formatDay(report.periodEnd)}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Dot tone={report.emailedAt ? "positive" : "neutral"} />
            <span>{report.kind} report</span>
            <span className="text-ink-300">·</span>
            <span className="num">generated {formatDateTime(report.createdAt)}</span>
            <span className="text-ink-300">·</span>
            <span>
              {report.emailedAt ? (
                <span className="num">emailed {formatDateTime(report.emailedAt)}</span>
              ) : (
                "not emailed"
              )}
            </span>
          </span>
        }
        actions={<ButtonLink href="/admin/reports">All reports</ButtonLink>}
      />

      <section>
        <SectionTitle hint="This period against the seven days before it.">
          Week over week
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.now}
              delta={delta(stat.now, stat.before)}
              hint={
                stat.hint
                  ? `${stat.before} the week before · ${stat.hint}`
                  : stat.before === 0 && stat.now > 0
                    ? "New — nothing the week before."
                    : `${stat.before} the week before`
              }
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle hint="Written by the Analyst from the numbers above.">
            What happened
          </SectionTitle>
          {report.narrativeMd ? (
            <div>{renderMarkdown(report.narrativeMd)}</div>
          ) : (
            <EmptyState
              title="No narrative for this period"
              body="The metrics were stored, but the model did not return a written summary. Re-queue the Analyst to try again."
              action={<ButtonLink href="/admin/agents">Agent console</ButtonLink>}
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle hint="Most viewed pages in this period.">Top pages</SectionTitle>
            <BarList
              tone="info"
              items={topPages.map((page) => ({ label: page.path, value: page.views }))}
              emptyLabel="No page data was recorded for this period."
            />
          </Card>

          <Card>
            <SectionTitle hint="Runs completed by each agent.">Agent activity</SectionTitle>
            <BarList
              tone="brand"
              items={agentActivity.map((a) => ({
                label: a.agent,
                value: a.runs,
                hint: a.failures > 0 ? `${a.failures} failed` : undefined,
              }))}
              emptyLabel="No agent runs in this period."
            />
          </Card>
        </div>
      </div>

      {recommendations.length > 0 && (
        <section>
          <SectionTitle hint="What the Analyst suggests doing next, and which agent should do it.">
            Recommendations
          </SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            {recommendations.map((rec, i) => (
              <Card key={i}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{rec.agent}</Badge>
                  <p className="font-display text-base font-bold tracking-tight text-ink-900">
                    {rec.title}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{rec.why}</p>
                <p className="mt-3 border-s-2 border-brand-300 ps-3 text-sm leading-relaxed text-ink-900">
                  {rec.action}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
