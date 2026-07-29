import Link from "next/link";
import { and, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { leads, users } from "@/db/schema";
import {
  EMIRATE_LABELS,
  LEAD_STATUSES,
  STATUS_META,
  VOLUME_LABELS,
  dubaiDay,
  formatDateTime,
} from "@/components/admin/status";
import {
  Badge,
  BarList,
  Card,
  Cell,
  ColumnChart,
  DataTable,
  Dot,
  EmptyState,
  PageHeader,
  Row,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/admin/ui";
import type { Lead } from "@/db/schema";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const DAY = 86_400_000;

/**
 * Pipeline stage → badge tone.
 *
 * STATUS_META still owns the label and the raw colour classes used by the
 * client-side controls; here the stage is expressed through the shared Badge
 * so the leads table matches every other admin screen.
 */
const STATUS_TONE: Record<Lead["status"], Tone> = {
  new: "info",
  contacted: "brand",
  qualified: "brand",
  matched: "warning",
  closed_won: "positive",
  closed_lost: "danger",
};

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const status = params.status as Lead["status"] | undefined;
  const emirate = params.emirate;
  const assigned = params.assigned;
  const q = params.q?.trim();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  // Everything except the stage pill. Kept separate so the stage breakdown can
  // stay honest while one stage is selected — otherwise picking "Qualified"
  // would collapse the chart to a single bar and hide the pipeline.
  const filters: SQL[] = [];
  if (emirate && EMIRATE_LABELS[emirate]) filters.push(eq(leads.emirate, emirate));
  if (assigned === "none") {
    filters.push(sql`${leads.assignedTo} is null`);
  } else if (assigned) {
    filters.push(eq(leads.assignedTo, assigned));
  }
  if (q) {
    const pattern = `%${q}%`;
    filters.push(
      or(
        ilike(leads.companyName, pattern),
        ilike(leads.fullName, pattern),
        ilike(leads.email, pattern),
        ilike(leads.phone, pattern),
      )!,
    );
  }

  const statusFilter =
    status && LEAD_STATUSES.includes(status) ? eq(leads.status, status) : undefined;
  const conditions: SQL[] = statusFilter ? [statusFilter, ...filters] : filters;

  const where = conditions.length ? and(...conditions) : undefined;
  const whereSansStatus = filters.length ? and(...filters) : undefined;

  const now = Date.now();
  const since14 = new Date(now - 14 * DAY);

  const [rows, countRow, team, statusRows, unassignedRow, dailyRows] = await Promise.all([
    db
      .select({
        lead: leads,
        assigneeName: users.name,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedTo, users.id))
      .where(where)
      .orderBy(desc(leads.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(leads).where(where),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)),
    // Stage breakdown across the current search/emirate/owner filters.
    db
      .select({ status: leads.status, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(whereSansStatus)
      .groupBy(leads.status),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...conditions, sql`${leads.assignedTo} is null`)),
    // Daily buckets for the trend and the "new this week" figure — one query
    // instead of two, both read off the same series.
    db
      .select({
        day: sql<string>`to_char(${leads.createdAt} AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(and(...conditions, gte(leads.createdAt, since14)))
      .groupBy(sql`to_char(${leads.createdAt} AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD')`),
  ]);

  const totalCount = countRow[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.count])) as Record<
    string,
    number | undefined
  >;
  const scopeTotal = statusRows.reduce((sum, r) => sum + r.count, 0);
  const won = byStatus["closed_won"] ?? 0;
  const lost = byStatus["closed_lost"] ?? 0;
  const closed = won + lost;
  const winRate = closed > 0 ? Math.round((won / closed) * 100) : null;

  // A continuous 14-day series, so a quiet day reads as a zero column rather
  // than vanishing and silently compressing the axis.
  const byDay = new Map(dailyRows.map((r) => [r.day, r.count]));
  const series: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const { key, label } = dubaiDay(now - i * DAY);
    series.push({ label, value: byDay.get(key) ?? 0 });
  }
  const newThisWeek = series.slice(-7).reduce((sum, p) => sum + p.value, 0);
  const unassigned = unassignedRow[0]?.count ?? 0;

  const hasFilters = Boolean(status || emirate || assigned || q);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + rows.length;

  const exportQuery = new URLSearchParams();
  for (const [key, value] of Object.entries({ status, emirate, assigned, q })) {
    if (value) exportQuery.set(key, value);
  }

  const filterHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ status, emirate, assigned, q, ...patch })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return `/admin/leads${qs ? `?${qs}` : ""}`;
  };

  const inputClass =
    "rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <>
      <PageHeader
        title="Leads"
        count={totalCount}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Showing <span className="num">{rangeStart.toLocaleString()}</span>–
              <span className="num">{rangeEnd.toLocaleString()}</span>, newest first
            </span>
            {hasFilters && (
              <>
                <span className="text-ink-300">·</span>
                <Link href="/admin/leads" className="font-semibold text-brand-700 hover:underline">
                  Clear filters
                </Link>
              </>
            )}
          </span>
        }
        actions={
          <a
            href={`/api/admin/leads/export?${exportQuery.toString()}`}
            className="press inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800"
          >
            Export CSV
          </a>
        }
      />

      <section>
        <SectionTitle
          hint={
            hasFilters
              ? "Every figure below respects the filters you have applied."
              : "Across every lead on record."
          }
        >
          At a glance
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Matching leads"
            value={totalCount.toLocaleString()}
            hint={hasFilters ? "With the current filters" : "All time"}
            tone="brand"
          />
          <StatCard
            label="New this week"
            value={newThisWeek.toLocaleString()}
            spark={series.map((s) => s.value)}
            hint="Last 7 days, daily trend over 14"
          />
          <StatCard
            label="Unassigned"
            value={unassigned.toLocaleString()}
            tone={unassigned > 0 ? "warning" : "neutral"}
            hint={unassigned > 0 ? "Nobody owns these yet" : "Every lead has an owner"}
            href={filterHref({ assigned: "none" })}
          />
          <StatCard
            label="Win rate"
            value={winRate === null ? "—" : `${winRate}%`}
            hint={closed ? `of ${closed} closed leads` : "No closed leads yet"}
            tone={winRate !== null && winRate >= 50 ? "positive" : "neutral"}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle hint="Daily, last 14 days. Hover a column for the exact count.">
            Arrival rate
          </SectionTitle>
          <ColumnChart points={series} tone="brand" />
        </Card>

        <Card>
          <SectionTitle hint="Ignores the stage pill so the whole pipeline stays visible.">
            By stage
          </SectionTitle>
          <BarList
            items={LEAD_STATUSES.map((s) => ({
              label: STATUS_META[s].label,
              value: byStatus[s] ?? 0,
              href: filterHref({ status: s }),
              hint: scopeTotal ? `${Math.round(((byStatus[s] ?? 0) / scopeTotal) * 100)}%` : undefined,
            }))}
            emptyLabel="No leads match these filters."
          />
        </Card>
      </div>

      <Card>
        {/* Stage pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={filterHref({ status: undefined })}
            className={`press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
              !status
                ? "bg-ink-900 text-white ring-ink-900"
                : "bg-white text-ink-600 ring-ink-200 hover:text-brand-800 hover:ring-brand-300"
            }`}
          >
            All
            <span className={`num ${!status ? "text-white/70" : "text-ink-400"}`}>
              {scopeTotal.toLocaleString()}
            </span>
          </Link>
          {LEAD_STATUSES.map((s) => {
            const active = status === s;
            return (
              <Link
                key={s}
                href={filterHref({ status: s })}
                className={`press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                  active
                    ? "bg-ink-900 text-white ring-ink-900"
                    : "bg-white text-ink-600 ring-ink-200 hover:text-brand-800 hover:ring-brand-300"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {!active && <Dot tone={STATUS_TONE[s]} />}
                {STATUS_META[s].label}
                <span className={`num ${active ? "text-white/70" : "text-ink-400"}`}>
                  {(byStatus[s] ?? 0).toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Search + secondary filters */}
        <form method="get" className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search company, contact, email, phone…"
            aria-label="Search leads"
            className={`w-full max-w-xs ${inputClass}`}
          />
          <select
            name="emirate"
            defaultValue={emirate ?? ""}
            aria-label="Filter by emirate"
            className={inputClass}
          >
            <option value="">All emirates</option>
            {Object.entries(EMIRATE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="assigned"
            defaultValue={assigned ?? ""}
            aria-label="Filter by owner"
            className={inputClass}
          >
            <option value="">Anyone</option>
            <option value="none">Unassigned</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="press rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
          >
            Filter
          </button>
        </form>
      </Card>

      <DataTable
        head={["Company / contact", "Emirate", "Volume", "Stage", "Owner", "Received"]}
        minWidth="56rem"
      >
        {rows.length === 0 && (
          <EmptyState
            colSpan={6}
            title="No leads match these filters"
            body="Widen the search, or clear the filters to see every lead on record."
            action={
              <Link
                href="/admin/leads"
                className="press inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
              >
                Clear filters
              </Link>
            }
          />
        )}
        {rows.map(({ lead, assigneeName }) => (
          <Row key={lead.id}>
            <Cell className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/leads/${lead.id}`}
                  className="font-semibold text-ink-900 transition-colors after:absolute after:inset-0 hover:text-brand-800"
                >
                  {lead.companyName}
                </Link>
                {lead.flaggedDuplicate && <Badge tone="warning">dup?</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-ink-500">
                {lead.fullName}
                {lead.email && (
                  <>
                    {" · "}
                    <span className="num">{lead.email}</span>
                  </>
                )}
              </p>
            </Cell>
            <Cell className="whitespace-nowrap text-ink-600">
              {lead.emirate ? (EMIRATE_LABELS[lead.emirate] ?? lead.emirate) : "—"}
            </Cell>
            <Cell className="num whitespace-nowrap text-ink-600">
              {lead.invoiceVolume ? (VOLUME_LABELS[lead.invoiceVolume] ?? lead.invoiceVolume) : "—"}
            </Cell>
            <Cell>
              <Badge tone={STATUS_TONE[lead.status]}>{STATUS_META[lead.status].label}</Badge>
            </Cell>
            <Cell className="whitespace-nowrap text-ink-600">
              {assigneeName ?? <span className="text-ink-400">Unassigned</span>}
            </Cell>
            <Cell className="num whitespace-nowrap text-xs text-ink-500">
              {formatDateTime(lead.createdAt)}
            </Cell>
          </Row>
        ))}
      </DataTable>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-ink-500">
            Page <span className="num">{page}</span> of <span className="num">{totalPages}</span>
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={filterHref({ page: String(page - 1) })}
                className="press rounded-xl border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={filterHref({ page: String(page + 1) })}
                className="press rounded-xl border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
