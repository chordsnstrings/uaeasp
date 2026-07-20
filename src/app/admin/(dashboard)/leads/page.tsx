import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { leads, users } from "@/db/schema";
import {
  EMIRATE_LABELS,
  LEAD_STATUSES,
  STATUS_META,
  VOLUME_LABELS,
  formatDateTime,
} from "@/components/admin/status";
import type { Lead } from "@/db/schema";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

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

  const conditions: SQL[] = [];
  if (status && LEAD_STATUSES.includes(status)) conditions.push(eq(leads.status, status));
  if (emirate && EMIRATE_LABELS[emirate]) conditions.push(eq(leads.emirate, emirate));
  if (assigned === "none") {
    conditions.push(sql`${leads.assignedTo} is null`);
  } else if (assigned) {
    conditions.push(eq(leads.assignedTo, assigned));
  }
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(leads.companyName, pattern),
        ilike(leads.fullName, pattern),
        ilike(leads.email, pattern),
        ilike(leads.phone, pattern),
      )!,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, countRow, team] = await Promise.all([
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
  ]);

  const totalCount = countRow[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-900">
          Leads <span className="text-base font-medium text-ink-400">({totalCount})</span>
        </h1>
        <a
          href={`/api/admin/leads/export?${exportQuery.toString()}`}
          className="press rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800"
        >
          Export CSV
        </a>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={filterHref({ status: undefined })}
          className={`press rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${
            !status ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-400"
          }`}
        >
          All
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={filterHref({ status: s })}
            className={`press rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${
              status === s ? "bg-ink-900 text-white ring-ink-900" : `${STATUS_META[s].badge} hover:opacity-80`
            }`}
          >
            {STATUS_META[s].label}
          </Link>
        ))}
      </div>

      {/* Search + secondary filters */}
      <form method="get" className="flex flex-wrap gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search company, contact, email, phone…"
          className="w-full max-w-xs rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <select
          name="emirate"
          defaultValue={emirate ?? ""}
          className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm"
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
          className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm"
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
          className="press rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-start text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3 text-start font-semibold">Company / contact</th>
              <th className="px-4 py-3 text-start font-semibold">Emirate</th>
              <th className="px-4 py-3 text-start font-semibold">Volume</th>
              <th className="px-4 py-3 text-start font-semibold">Status</th>
              <th className="px-4 py-3 text-start font-semibold">Assigned</th>
              <th className="px-4 py-3 text-start font-semibold">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-400">
                  No leads match these filters.
                </td>
              </tr>
            )}
            {rows.map(({ lead, assigneeName }) => {
              const meta = STATUS_META[lead.status];
              return (
                <tr key={lead.id} className="group relative hover:bg-ink-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-ink-900 after:absolute after:inset-0 group-hover:text-brand-800">
                      {lead.companyName}
                    </Link>
                    {lead.flaggedDuplicate && (
                      <span className="ms-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 ring-1 ring-amber-200">
                        dup?
                      </span>
                    )}
                    <p className="text-xs text-ink-500">
                      {lead.fullName} · {lead.email}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {EMIRATE_LABELS[lead.emirate] ?? lead.emirate}
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {lead.invoiceVolume ? VOLUME_LABELS[lead.invoiceVolume] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
                      <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{assigneeName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-ink-500">
                    {formatDateTime(lead.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={filterHref({ page: String(page - 1) })} className="press rounded-lg border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700">
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={filterHref({ page: String(page + 1) })} className="press rounded-lg border border-ink-200 bg-white px-4 py-2 font-semibold text-ink-700">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
