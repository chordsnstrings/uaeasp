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
  Badge,
  ButtonLink,
  Card,
  Dot,
  EmptyState,
  Field,
  PageHeader,
  SectionTitle,
  type Tone,
} from "@/components/admin/ui";
import { AssignSelect, NoteForm, StatusSelect } from "@/components/admin/LeadControls";
import type { Lead } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Pipeline stage → badge tone, matching the leads table. */
const STATUS_TONE: Record<Lead["status"], Tone> = {
  new: "info",
  contacted: "brand",
  qualified: "brand",
  matched: "warning",
  closed_won: "positive",
  closed_lost: "danger",
};

/**
 * Activity type → how it reads in the timeline.
 *
 * The type column is free text written by the server actions, so anything
 * unrecognised falls back to a neutral entry rather than disappearing.
 */
const ACTIVITY_META: Record<string, { label: string; tone: Tone }> = {
  created: { label: "Created", tone: "brand" },
  note: { label: "Note", tone: "neutral" },
  status_change: { label: "Stage", tone: "info" },
  assignment: { label: "Assigned", tone: "warning" },
  email_sent: { label: "Email", tone: "positive" },
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
  const { lead, assigneeName } = row;

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

  const timeline = activities.slice().reverse();
  const score = lead.quizScore;
  // "as-needed" locale prefixes: English lives at the bare path.
  const trackHref =
    lead.locale === "ar"
      ? `/ar/track/${lead.trackingToken}`
      : `/track/${lead.trackingToken}`;

  const actionClass =
    "press inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800";

  return (
    <>
      <PageHeader
        title={lead.companyName}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Badge tone={STATUS_TONE[lead.status]}>{STATUS_META[lead.status].label}</Badge>
            <span>{lead.fullName}</span>
            {lead.emirate && (
              <>
                <span className="text-ink-300">·</span>
                <span>{EMIRATE_LABELS[lead.emirate] ?? lead.emirate}</span>
              </>
            )}
            <span className="text-ink-300">·</span>
            <span>
              received <span className="num">{formatDateTime(lead.createdAt)}</span>
            </span>
          </span>
        }
        actions={
          <>
            {lead.email && (
              <a href={`mailto:${lead.email}`} className={actionClass}>
                Email
              </a>
            )}
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className={actionClass}>
                Call
              </a>
            )}
            <ButtonLink href="/admin/leads">All leads</ButtonLink>
          </>
        }
      />

      {lead.flaggedDuplicate && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
          <Badge tone="warning">Possible duplicate</Badge>
          {duplicateOf[0] ? (
            <span>
              Intake matched this against{" "}
              <Link
                href={`/admin/leads/${duplicateOf[0].id}`}
                className="font-semibold underline underline-offset-2"
              >
                {duplicateOf[0].companyName}
              </Link>
              , received <span className="num">{formatDateTime(duplicateOf[0].createdAt)}</span>.
              Merge or dismiss before working it.
            </span>
          ) : (
            <span>Flagged at intake, but the matching record is no longer on file.</span>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <Card>
            <SectionTitle hint="Changing the stage or the owner is written to the activity log below.">
              Pipeline
            </SectionTitle>
            <StatusSelect leadId={lead.id} current={lead.status} />
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
              <span className="text-sm font-medium text-ink-600">Assigned to</span>
              <AssignSelect leadId={lead.id} current={lead.assignedTo} team={team} />
              {!lead.assignedTo && <Badge tone="warning">Unassigned</Badge>}
            </div>
          </Card>

          <Card>
            <SectionTitle hint="How to reach them, as submitted.">Contact</SectionTitle>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Contact person">{lead.fullName}</Field>
              <Field label="Company">{lead.companyName}</Field>
              <Field label="Email">
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="num text-brand-700 hover:underline"
                    dir="ltr"
                  >
                    {lead.email}
                  </a>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </Field>
              <Field label="Phone">
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="num text-brand-700 hover:underline"
                    dir="ltr"
                  >
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </Field>
              <Field label="Emirate">
                {lead.emirate ? (
                  (EMIRATE_LABELS[lead.emirate] ?? lead.emirate)
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </Field>
              <Field label="Language">{lead.locale === "ar" ? "Arabic" : "English"}</Field>
              <Field label="Owner">
                {assigneeName ?? <span className="text-ink-400">Unassigned</span>}
              </Field>
              <Field label="Consent given">
                <span className="num">{formatDateTime(lead.consentAt)}</span>
              </Field>
            </dl>
          </Card>

          <Card>
            <SectionTitle hint="What they told us about the job.">Qualification</SectionTitle>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Invoice volume">
                {lead.invoiceVolume ? (
                  <span className="num">
                    {VOLUME_LABELS[lead.invoiceVolume] ?? lead.invoiceVolume}
                  </span>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </Field>
              <Field label="Accounting software">
                {lead.accountingSoftware ?? <span className="text-ink-400">—</span>}
              </Field>
              <Field label="Budget">
                {lead.budgetRange ? (
                  (BUDGET_LABELS[lead.budgetRange] ?? lead.budgetRange)
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </Field>
              <Field label="Timeline">
                {lead.timeline ? (
                  (TIMELINE_LABELS[lead.timeline] ?? lead.timeline)
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </Field>
            </dl>

            {score != null && (
              <div className="mt-5 rounded-xl border border-ink-100 bg-paper/70 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                    Readiness score
                  </p>
                  <p className="num text-sm font-bold text-ink-900">
                    {score}
                    <span className="text-ink-400">/100</span>
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    aria-hidden
                    className={`h-full rounded-full ${
                      score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                  />
                </div>
              </div>
            )}

            {lead.message && (
              <div className="mt-5 rounded-xl border border-ink-100 bg-paper/70 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                  Message
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
                  {lead.message}
                </p>
              </div>
            )}

            {lead.quizAnswers != null && (
              <details className="mt-5 rounded-xl border border-ink-100 bg-paper/70 p-4">
                <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                  Readiness quiz answers
                </summary>
                <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-ink-600">
                  {JSON.stringify(lead.quizAnswers, null, 2)}
                </pre>
              </details>
            )}
          </Card>

          <Card>
            <SectionTitle hint="Where this record came from, and how to find it again.">
              Provenance
            </SectionTitle>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Source">
                <span className="num">{lead.source}</span>
              </Field>
              <Field label="Received">
                <span className="num">{formatDateTime(lead.createdAt)}</span>
              </Field>
              <Field label="Last updated">
                <span className="num">{formatDateTime(lead.updatedAt)}</span>
              </Field>
              <Field label="Lead ID">
                <span className="num text-xs text-ink-500">{lead.id}</span>
              </Field>
              {lead.referrer && (
                <Field label="Referrer">
                  <span className="num text-xs">{lead.referrer}</span>
                </Field>
              )}
              {lead.utm != null && (
                <Field label="UTM">
                  <span className="num text-xs">{JSON.stringify(lead.utm)}</span>
                </Field>
              )}
              <Field label="Client tracking page">
                <a
                  href={trackHref}
                  target="_blank"
                  rel="noreferrer"
                  className="num text-xs text-brand-700 hover:underline"
                >
                  {lead.trackingToken}
                </a>
              </Field>
            </dl>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-6 lg:self-start">
          <SectionTitle hint="Newest first. Notes are visible to the whole team.">
            Activity
          </SectionTitle>
          <NoteForm leadId={lead.id} />

          {timeline.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                title="Nothing logged yet"
                body="Notes, stage changes and sent emails all land here."
              />
            </div>
          ) : (
            <ol className="mt-5">
              {timeline.map(({ activity, userName }, i) => {
                const meta = ACTIVITY_META[activity.type] ?? {
                  label: activity.type.replace(/_/g, " "),
                  tone: "neutral" as Tone,
                };
                return (
                  <li key={activity.id} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex shrink-0 flex-col items-center pt-1">
                      <Dot tone={meta.tone} />
                      {i < timeline.length - 1 && (
                        <span aria-hidden className="mt-1 w-px flex-1 bg-ink-100" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="num text-[11px] text-ink-400">
                          {formatDateTime(activity.createdAt)}
                        </span>
                      </div>
                      {activity.body && (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
                          {activity.body}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-ink-500">{userName ?? "System"}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
