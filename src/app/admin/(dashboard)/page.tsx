import Link from "next/link";
import { desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, providers, scrapeRuns } from "@/db/schema";
import {
  EMIRATE_LABELS,
  LEAD_STATUSES,
  STATUS_META,
  formatDateTime,
} from "@/components/admin/status";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [statusRows, sourceRows, weeklyRows, recentLeads, providerCount, lastRun] =
    await Promise.all([
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
      db
        .select({
          week: sql<string>`to_char(date_trunc('week', ${leads.createdAt}), 'DD Mon')`,
          weekStart: sql<string>`date_trunc('week', ${leads.createdAt})`,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(gte(leads.createdAt, sql`now() - interval '8 weeks'`))
        .groupBy(sql`date_trunc('week', ${leads.createdAt})`)
        .orderBy(sql`date_trunc('week', ${leads.createdAt})`),
      db.select().from(leads).orderBy(desc(leads.createdAt)).limit(8),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(providers)
        .where(eq(providers.status, "active")),
      db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.startedAt)).limit(1),
    ]);

  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.count]));
  const total = statusRows.reduce((s, r) => s + r.count, 0);
  const won = byStatus["closed_won"] ?? 0;
  const lost = byStatus["closed_lost"] ?? 0;
  const closed = won + lost;
  const inPipeline = total - closed;
  const conversion = closed > 0 ? Math.round((won / closed) * 100) : null;
  const maxWeekly = Math.max(1, ...weeklyRows.map((r) => r.count));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-500">
          Directory: {providerCount[0]?.count ?? 0} active providers
          {lastRun[0] &&
            ` · last refresh ${formatDateTime(lastRun[0].startedAt)} (${lastRun[0].status})`}
        </p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total leads", value: total },
          { label: "In pipeline", value: inPipeline },
          { label: "Closed · won", value: won },
          {
            label: "Win rate (closed)",
            value: conversion === null ? "—" : `${conversion}%`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-extrabold text-ink-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline breakdown */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">
          Pipeline
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {LEAD_STATUSES.map((status) => {
            const meta = STATUS_META[status];
            const count = byStatus[status] ?? 0;
            return (
              <Link
                key={status}
                href={`/admin/leads?status=${status}`}
                className="press card-hover rounded-2xl border border-ink-100 bg-white p-4 transition-transform"
              >
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
                  <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
                  {meta.label}
                </span>
                <p className="mt-3 text-2xl font-extrabold text-ink-900">{count}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly volume */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
            Leads per week
          </h2>
          {weeklyRows.length === 0 ? (
            <p className="mt-6 text-sm text-ink-400">No leads yet.</p>
          ) : (
            <div className="mt-5 flex h-36 items-end gap-2">
              {weeklyRows.map((row) => (
                <div key={row.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-xs font-bold text-ink-700">{row.count}</span>
                  <div
                    className="w-full rounded-t-lg bg-brand-600/80 transition-all hover:bg-brand-700"
                    style={{ height: `${Math.max(6, (row.count / maxWeekly) * 100)}%` }}
                    title={`${row.week}: ${row.count}`}
                  />
                  <span className="text-[10px] text-ink-400">{row.week}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sources */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
            Lead sources
          </h2>
          <ul className="mt-4 space-y-3">
            {sourceRows.length === 0 && (
              <li className="text-sm text-ink-400">No leads yet.</li>
            )}
            {sourceRows
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <li key={row.source}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize text-ink-700">
                      {row.source === "form" ? "Lead form" : row.source === "quiz" ? "Readiness quiz" : row.source}
                    </span>
                    <span className="font-bold text-ink-900">{row.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-accent-500"
                      style={{ width: `${(row.count / total) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      </div>

      {/* Recent leads */}
      <section className="rounded-2xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
            Latest leads
          </h2>
          <Link href="/admin/leads" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
            View all →
          </Link>
        </div>
        <ul className="divide-y divide-ink-50">
          {recentLeads.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-ink-400">
              Leads will appear here as soon as the first form is submitted.
            </li>
          )}
          {recentLeads.map((lead) => {
            const meta = STATUS_META[lead.status];
            return (
              <li key={lead.id}>
                <Link
                  href={`/admin/leads/${lead.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900">
                      {lead.companyName}
                      {lead.flaggedDuplicate && (
                        <span className="ms-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 ring-1 ring-amber-200">
                          dup?
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {lead.fullName}{lead.emirate ? ` · ${EMIRATE_LABELS[lead.emirate] ?? lead.emirate}` : ""}
                    </p>
                  </div>
                  <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 sm:inline ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">
                    {formatDateTime(lead.createdAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
