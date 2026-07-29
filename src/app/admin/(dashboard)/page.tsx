import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agentRuns,
  articles,
  leads,
  outreachMessages,
  prospects,
  providers,
  scrapeRuns,
} from "@/db/schema";
import {
  EMIRATE_LABELS,
  LEAD_STATUSES,
  STATUS_META,
  dubaiDay,
  formatDateTime,
} from "@/components/admin/status";
import {
  Badge,
  BarList,
  ButtonLink,
  Card,
  ColumnChart,
  Dot,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatCard,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

/** Percentage change, guarding the divide-by-zero that would render NaN%. */
function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export default async function AdminDashboard() {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const since60 = new Date(now - 60 * DAY);

  const [
    statusRows,
    sourceRows,
    dailyRows,
    recentLeads,
    providerCount,
    lastRun,
    last30,
    prev30,
    pendingApprovals,
    draftArticles,
    contactableProspects,
    failedRuns,
    emirateRows,
  ] = await Promise.all([
    db
      .select({ status: leads.status, count: sql<number>`count(*)::int` })
      .from(leads)
      .groupBy(leads.status),
    db
      .select({
        source: sql<string>`split_part(${leads.source}, ':', 1)`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .groupBy(sql`split_part(${leads.source}, ':', 1)`),
    // Daily buckets give the trend real resolution; weekly hid every movement.
    db
      .select({
        day: sql<string>`to_char(${leads.createdAt} AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(gte(leads.createdAt, since30))
      .groupBy(sql`to_char(${leads.createdAt} AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD')`),
    db.select().from(leads).orderBy(desc(leads.createdAt)).limit(6),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(providers)
      .where(eq(providers.status, "active")),
    db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.startedAt)).limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(gte(leads.createdAt, since30)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(gte(leads.createdAt, since60), sql`${leads.createdAt} < ${since30}`)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(outreachMessages)
      .where(eq(outreachMessages.status, "pending_approval")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(articles)
      .where(eq(articles.status, "draft")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(prospects)
      .where(eq(prospects.status, "contactable")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(and(eq(agentRuns.status, "failed"), gte(agentRuns.startedAt, new Date(now - DAY)))),
    db
      .select({ emirate: leads.emirate, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(gte(leads.createdAt, since30), sql`${leads.emirate} is not null`))
      .groupBy(leads.emirate),
  ]);

  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.count]));
  const total = statusRows.reduce((s, r) => s + r.count, 0);
  const won = byStatus["closed_won"] ?? 0;
  const lost = byStatus["closed_lost"] ?? 0;
  const closed = won + lost;
  const inPipeline = total - closed;
  const conversion = closed > 0 ? Math.round((won / closed) * 100) : null;

  const leads30 = last30[0]?.count ?? 0;
  const leadsPrev30 = prev30[0]?.count ?? 0;

  // A continuous 14-day series, so a quiet day reads as a zero column rather
  // than vanishing and silently compressing the axis.
  const byDay = new Map(dailyRows.map((r) => [r.day, r.count]));
  const series: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const { key, label } = dubaiDay(now - i * DAY);
    series.push({ label, value: byDay.get(key) ?? 0 });
  }

  const approvals = pendingApprovals[0]?.count ?? 0;
  const drafts = draftArticles[0]?.count ?? 0;
  const contactable = contactableProspects[0]?.count ?? 0;
  const errors = failedRuns[0]?.count ?? 0;
  const run = lastRun[0];

  const attention = [
    approvals > 0 && {
      href: "/admin/agents/approvals",
      label: "Emails awaiting approval",
      value: approvals as number | string,
      tone: "warning" as const,
      hint: "Nothing sends until you review these.",
    },
    drafts > 0 && {
      href: "/admin/agents/content",
      label: "Article drafts to review",
      value: drafts as number | string,
      tone: "info" as const,
      hint: "Written by the Visibility agent, unpublished.",
    },
    errors > 0 && {
      href: "/admin/agents",
      label: "Agent jobs failed (24h)",
      value: errors as number | string,
      tone: "danger" as const,
      hint: "Check the run log for the error.",
    },
    run &&
      ["failed", "rejected"].includes(run.status) && {
        href: "/admin/scrapes",
        label: "Last refresh failed",
        value: run.status as number | string,
        tone: "danger" as const,
        hint: "The provider list may be going stale.",
      },
  ].filter(Boolean) as {
    href: string;
    label: string;
    value: number | string;
    tone: "warning" | "info" | "danger";
    hint: string;
  }[];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Dot tone={run?.status === "success" ? "positive" : run ? "danger" : "neutral"} />
            <span className="num">{providerCount[0]?.count ?? 0}</span> active providers
            {run && (
              <>
                <span className="text-ink-300">·</span>
                <span>
                  refreshed {formatDateTime(run.startedAt)} ({run.status})
                </span>
              </>
            )}
          </span>
        }
        actions={
          <ButtonLink href="/admin/leads" variant="primary">
            Open leads
          </ButtonLink>
        }
      />

      {/* Needs you — a dashboard's job is to shorten the path to the work. */}
      {attention.length > 0 && (
        <section>
          <SectionTitle hint="Everything here is waiting on a person.">Needs you</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {attention.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="press rounded-2xl border border-ink-200/70 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
              >
                <div className="flex items-center gap-2">
                  <Dot tone={a.tone} />
                  <p className="text-xs font-semibold text-ink-600">{a.label}</p>
                </div>
                <p className="num mt-2 text-2xl font-bold text-ink-900">{a.value}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{a.hint}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle hint="Last 30 days, compared with the 30 before.">Headline</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Leads (30d)"
            value={leads30}
            delta={delta(leads30, leadsPrev30)}
            spark={series.map((s) => s.value)}
            hint={`${total} all time`}
            tone="brand"
          />
          <StatCard
            label="In pipeline"
            value={inPipeline}
            hint="Open, not yet closed"
            href="/admin/leads"
          />
          <StatCard label="Closed won" value={won} tone="positive" hint={`${lost} lost`} />
          <StatCard
            label="Win rate"
            value={conversion === null ? "—" : `${conversion}%`}
            hint={closed ? `of ${closed} closed` : "no closed leads yet"}
            tone={conversion !== null && conversion >= 50 ? "positive" : "neutral"}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle hint="Daily, last 14 days. Hover a column for the exact count.">
            Lead volume
          </SectionTitle>
          <ColumnChart points={series} tone="brand" />
        </Card>

        <Card>
          <SectionTitle hint="Which route brought them in.">Sources</SectionTitle>
          <BarList
            items={sourceRows
              .sort((a, b) => b.count - a.count)
              .slice(0, 6)
              .map((r) => ({ label: r.source || "direct", value: r.count }))}
            emptyLabel="No leads yet."
          />
        </Card>
      </div>

      <section>
        <SectionTitle
          hint="Click a stage to filter the leads table."
          action={<ButtonLink href="/admin/leads">All leads</ButtonLink>}
        >
          Pipeline by stage
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {LEAD_STATUSES.map((status) => {
            const meta = STATUS_META[status];
            const count = byStatus[status] ?? 0;
            const share = total ? Math.round((count / total) * 100) : 0;
            return (
              <Link
                key={status}
                href={`/admin/leads?status=${status}`}
                className="press rounded-2xl border border-ink-200/70 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
              >
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.badge}`}
                >
                  <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
                  {meta.label}
                </span>
                <p className="num mt-3 text-2xl font-bold text-ink-900">{count}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-ink-400"
                    style={{ width: `${share}%` }}
                    aria-hidden
                  />
                </div>
                <p className="num mt-1 text-[10px] text-ink-400">{share}%</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" padded={false}>
          <div className="p-5 pb-4 sm:p-6 sm:pb-4">
            <SectionTitle
              hint="Newest first."
              action={<ButtonLink href="/admin/leads">View all</ButtonLink>}
            >
              Latest leads
            </SectionTitle>
          </div>
          {recentLeads.length === 0 ? (
            <div className="px-5 pb-6 sm:px-6">
              <EmptyState
                title="No leads yet"
                body="They appear here the moment someone submits the form."
              />
            </div>
          ) : (
            <ul className="divide-y divide-ink-100 border-t border-ink-100">
              {recentLeads.map((lead) => {
                const meta = STATUS_META[lead.status];
                return (
                  <li key={lead.id}>
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-paper/70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {lead.companyName}
                          {lead.flaggedDuplicate && (
                            <Badge tone="warning" className="ms-2">
                              dup?
                            </Badge>
                          )}
                        </p>
                        <p className="truncate text-xs text-ink-500">
                          {lead.fullName}
                          {lead.emirate
                            ? ` · ${EMIRATE_LABELS[lead.emirate] ?? lead.emirate}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge tone="neutral">{meta.label}</Badge>
                        <span className="num hidden text-[11px] text-ink-400 sm:inline">
                          {formatDateTime(lead.createdAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle hint="Leads in the last 30 days.">By emirate</SectionTitle>
            <BarList
              tone="info"
              items={emirateRows
                .sort((a, b) => b.count - a.count)
                .slice(0, 7)
                .map((r) => ({
                  label: EMIRATE_LABELS[r.emirate ?? ""] ?? r.emirate ?? "unknown",
                  value: r.count,
                }))}
              emptyLabel="No location data yet."
            />
          </Card>

          <Card>
            <SectionTitle hint="Pipeline the agents have built.">Growth engine</SectionTitle>
            <BarList
              tone="brand"
              items={[
                {
                  label: "Prospects ready to contact",
                  value: contactable,
                  href: "/admin/agents/prospects?status=contactable",
                },
                {
                  label: "Emails awaiting approval",
                  value: approvals,
                  href: "/admin/agents/approvals",
                },
                { label: "Article drafts", value: drafts, href: "/admin/agents/content" },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
