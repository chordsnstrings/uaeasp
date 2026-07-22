import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { leadActivities, leads, users } from "@/db/schema";
import {
  BUDGET_LABELS,
  EMIRATE_LABELS,
  STATUS_META,
  TIMELINE_LABELS,
  VOLUME_LABELS,
  formatDateTime,
} from "@/components/admin/status";
import {
  AssignSelect,
  NoteForm,
  StatusSelect,
} from "@/components/admin/LeadControls";

export const dynamic = "force-dynamic";

const ACTIVITY_ICONS: Record<string, string> = {
  created: "✦",
  note: "✎",
  status_change: "⇢",
  assignment: "☰",
  email_sent: "✉",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row] = await db
    .select({ lead: leads, assigneeName: users.name })
    .from(leads)
    .leftJoin(users, eq(leads.assignedTo, users.id))
    .where(eq(leads.id, id))
    .limit(1);
  if (!row) notFound();
  const { lead } = row;

  const [activities, team, duplicateOf] = await Promise.all([
    db
      .select({ activity: leadActivities, userName: users.name })
      .from(leadActivities)
      .leftJoin(users, eq(leadActivities.userId, users.id))
      .where(eq(leadActivities.leadId, id))
      .orderBy(asc(leadActivities.createdAt)),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.active, true)),
    lead.duplicateOf
      ? db
          .select({ id: leads.id, companyName: leads.companyName, createdAt: leads.createdAt })
          .from(leads)
          .where(eq(leads.id, lead.duplicateOf))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const facts: [string, string][] = [
    ["Contact person", lead.fullName],
    ["Email", lead.email ?? "—"],
    ["Phone", lead.phone],
    ["Emirate", lead.emirate ? (EMIRATE_LABELS[lead.emirate] ?? lead.emirate) : "—"],
    ["Invoice volume", lead.invoiceVolume ? (VOLUME_LABELS[lead.invoiceVolume] ?? lead.invoiceVolume) : "—"],
    ["Accounting software", lead.accountingSoftware ?? "—"],
    ["Budget", lead.budgetRange ? (BUDGET_LABELS[lead.budgetRange] ?? lead.budgetRange) : "—"],
    ["Timeline", lead.timeline ? (TIMELINE_LABELS[lead.timeline] ?? lead.timeline) : "—"],
    ["Language", lead.locale === "ar" ? "Arabic" : "English"],
    ["Source", lead.source],
    ["Consent given", formatDateTime(lead.consentAt)],
    ["Received", formatDateTime(lead.createdAt)],
  ];

  if (lead.quizScore != null) facts.push(["Readiness score", `${lead.quizScore}/100`]);
  if (lead.referrer) facts.push(["Referrer", lead.referrer]);
  if (lead.utm) facts.push(["UTM", JSON.stringify(lead.utm)]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm font-medium text-ink-500 hover:text-brand-700">
          ← All leads
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink-900">{lead.companyName}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_META[lead.status].badge}`}>
            {STATUS_META[lead.status].label}
          </span>
          {lead.flaggedDuplicate && duplicateOf[0] && (
            <Link
              href={`/admin/leads/${duplicateOf[0].id}`}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
            >
              Possible duplicate of {duplicateOf[0].companyName} ({formatDateTime(duplicateOf[0].createdAt)}) →
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {/* Status control */}
          <section className="rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">
              Pipeline status
            </h2>
            <StatusSelect leadId={lead.id} current={lead.status} />
            <div className="mt-5 flex items-center gap-3 border-t border-ink-50 pt-4">
              <span className="text-sm font-medium text-ink-600">Assigned to</span>
              <AssignSelect leadId={lead.id} current={lead.assignedTo} team={team} />
            </div>
          </section>

          {/* Facts */}
          <section className="rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">
              Lead details
            </h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs font-medium text-ink-400">{label}</dt>
                  <dd className="truncate text-sm font-semibold text-ink-800" title={value}>
                    {label === "Email" ? (
                      <a href={`mailto:${value}`} className="text-brand-700 hover:underline">{value}</a>
                    ) : label === "Phone" ? (
                      <a href={`tel:${value}`} className="text-brand-700 hover:underline" dir="ltr">{value}</a>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {lead.message && (
              <div className="mt-4 rounded-xl bg-ink-50 p-4">
                <p className="text-xs font-medium text-ink-400">Message</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{lead.message}</p>
              </div>
            )}
            {lead.quizAnswers != null && (
              <div className="mt-4 rounded-xl bg-ink-50 p-4">
                <p className="text-xs font-medium text-ink-400">Readiness quiz answers</p>
                <pre className="mt-1 overflow-x-auto text-xs text-ink-600">
                  {JSON.stringify(lead.quizAnswers, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </div>

        {/* Activity timeline */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">
            Activity
          </h2>
          <NoteForm leadId={lead.id} />
          <ol className="mt-5 space-y-4">
            {activities
              .slice()
              .reverse()
              .map(({ activity, userName }) => (
                <li key={activity.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-50 text-xs text-ink-500 ring-1 ring-ink-100"
                  >
                    {ACTIVITY_ICONS[activity.type] ?? "•"}
                  </span>
                  <div className="min-w-0 flex-1 border-b border-ink-50 pb-3">
                    <p className="whitespace-pre-wrap text-sm text-ink-700">{activity.body}</p>
                    <p className="mt-1 text-xs text-ink-400">
                      {userName ?? "System"} · {formatDateTime(activity.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
