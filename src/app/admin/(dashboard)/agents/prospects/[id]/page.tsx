import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  PROSPECT_STATUSES,
  outreachMessages,
  outreachThreads,
  prospectContacts,
  prospects,
  suppressions,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAgentConfig } from "@/lib/agents/config";
import { EMIRATE_LABELS, formatDateTime } from "@/components/admin/status";
import {
  Badge,
  ButtonLink,
  Card,
  Cell,
  DataTable,
  Dot,
  EmptyState,
  Field,
  PageHeader,
  Row,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const VERIFICATION_LABEL: Record<string, string> = {
  mx_ok: "MX verified",
  syntax_ok: "syntax only",
  unknown: "unchecked",
  risky: "risky",
  invalid: "invalid",
};

const VERIFICATION_TONE: Record<string, Tone> = {
  mx_ok: "positive",
  syntax_ok: "neutral",
  unknown: "neutral",
  risky: "warning",
  invalid: "danger",
};

type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

const STATUS_LABEL: Record<ProspectStatus, string> = {
  discovered: "Discovered",
  enriched: "Enriched",
  contactable: "Contactable",
  sequenced: "Sequenced",
  replied: "Replied",
  converted: "Converted",
  rejected: "Rejected",
  suppressed: "Suppressed",
};

const STATUS_TONE: Record<ProspectStatus, Tone> = {
  discovered: "neutral",
  enriched: "info",
  contactable: "positive",
  sequenced: "brand",
  replied: "brand",
  converted: "positive",
  rejected: "danger",
  suppressed: "danger",
};

const THREAD_TONE: Record<string, Tone> = {
  active: "brand",
  awaiting_reply: "info",
  replied: "brand",
  converted: "positive",
  closed: "neutral",
  bounced: "danger",
  unsubscribed: "danger",
};

const MESSAGE_TONE: Record<string, Tone> = {
  draft: "neutral",
  pending_approval: "warning",
  scheduled: "info",
  sending: "info",
  sent: "positive",
  failed: "danger",
  received: "brand",
  rejected: "danger",
};

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");
  const { id } = await params;
  const config = await getAgentConfig();

  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!prospect) notFound();

  const contacts = await db
    .select()
    .from(prospectContacts)
    .where(eq(prospectContacts.prospectId, id))
    .orderBy(asc(prospectContacts.priority));

  const blocked = new Set(
    contacts.length
      ? (
          await db
            .select({ email: suppressions.email })
            .from(suppressions)
            .where(inArray(suppressions.email, contacts.map((c) => c.email)))
        ).map((s) => s.email)
      : [],
  );

  const threads = await db
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.prospectId, id))
    .orderBy(desc(outreachThreads.createdAt));

  const messages = threads.length
    ? await db
        .select()
        .from(outreachMessages)
        .where(inArray(outreachMessages.threadId, threads.map((t) => t.id)))
        .orderBy(asc(outreachMessages.createdAt))
    : [];

  const primary = contacts[0];
  const raw = prospect.raw as { types?: string[]; reviewCount?: number; rating?: number } | null;

  const suppressedCount = contacts.filter((c) => blocked.has(c.email)).length;
  const inbound = messages.filter((m) => m.direction === "inbound").length;
  const meetsThreshold = prospect.score !== null && prospect.score >= config.prospectorMinScore;

  return (
    <>
      <PageHeader
        title={prospect.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Dot tone={STATUS_TONE[prospect.status]} />
            <Badge tone={STATUS_TONE[prospect.status]}>{STATUS_LABEL[prospect.status]}</Badge>
            {prospect.website && (
              <>
                <span className="text-ink-300">·</span>
                <a
                  href={prospect.website}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="num break-all text-ink-500 underline-offset-2 hover:text-brand-700 hover:underline"
                  dir="ltr"
                >
                  {prospect.website}
                </a>
              </>
            )}
            {prospect.emirate && (
              <>
                <span className="text-ink-300">·</span>
                <span>{EMIRATE_LABELS[prospect.emirate] ?? prospect.emirate}</span>
              </>
            )}
          </span>
        }
        actions={<ButtonLink href="/admin/agents/prospects">← Prospects</ButtonLink>}
      />

      <Card>
        <SectionTitle hint="The one thing worth knowing before you touch anything else.">
          What happens next
        </SectionTitle>
        {prospect.status === "contactable" && primary && !blocked.has(primary.email) && (
          <p className="text-sm leading-relaxed text-ink-600">
            Cleared to contact. The first message would go to{" "}
            <span className="num font-medium text-ink-900" dir="ltr">
              {primary.email}
            </span>
            {config.outreachApprovalMode === "manual"
              ? " once you approve it in Approvals."
              : " automatically on the next send window."}
          </p>
        )}
        {prospect.status === "enriched" && (
          <p className="text-sm leading-relaxed text-ink-600">
            Held. It has a usable address but scored{" "}
            <span className="num">{prospect.score ?? "n/a"}</span>, under your threshold of{" "}
            <span className="num">{config.prospectorMinScore}</span>. Nothing will be sent.
          </p>
        )}
        {prospect.status === "rejected" && (
          <p className="text-sm leading-relaxed text-ink-600">
            Rejected — {prospect.scoreReason ?? "no usable address was found on the site"}. Nothing
            will be sent.
          </p>
        )}
        {prospect.status === "suppressed" && (
          <p className="text-sm leading-relaxed text-ink-600">
            Suppressed. This address opted out, bounced or was blocked by hand, and is permanently
            excluded.
          </p>
        )}
        {prospect.status === "discovered" && (
          <p className="text-sm leading-relaxed text-ink-600">
            Found but not yet crawled or scored. It will be enriched on an upcoming run.
          </p>
        )}
        {["sequenced", "replied", "converted"].includes(prospect.status) && (
          <p className="text-sm leading-relaxed text-ink-600">
            Already in conversation — see the thread below.
          </p>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Fit score"
          value={prospect.score ?? "—"}
          hint={`Threshold ${config.prospectorMinScore}`}
          tone={prospect.score === null ? "neutral" : meetsThreshold ? "positive" : "warning"}
        />
        <StatCard
          label="Addresses on file"
          value={contacts.length}
          hint={
            contacts.length === 0
              ? "Nothing to write to"
              : suppressedCount > 0
                ? `${suppressedCount} suppressed`
                : "Top one is used first"
          }
          tone={contacts.length === 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Conversations"
          value={threads.length}
          hint={threads.length === 0 ? "None started yet" : "Email threads on this business"}
          tone={threads.length > 0 ? "brand" : "neutral"}
        />
        <StatCard
          label="Messages"
          value={messages.length}
          hint={inbound > 0 ? `${inbound} inbound` : "No replies yet"}
          tone={inbound > 0 ? "positive" : "neutral"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle hint="Everything the Prospector recorded about the business itself.">
            Business
          </SectionTitle>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Emirate">
              {prospect.emirate
                ? (EMIRATE_LABELS[prospect.emirate] ?? prospect.emirate)
                : "—"}
            </Field>
            <Field label="Sector searched">{prospect.sector ?? "—"}</Field>
            <Field label="Size hint">{prospect.sizeHint ?? "—"}</Field>
            <Field label="Mandate wave">{prospect.mandateWave ?? "—"}</Field>
            <Field label="Phone">
              <span className="num" dir="ltr">
                {prospect.phone ?? "—"}
              </span>
            </Field>
            <Field label="Source">{prospect.source}</Field>
            <Field label="Address">{prospect.address ?? "—"}</Field>
            <Field label="Google types">{raw?.types?.join(", ") ?? "—"}</Field>
            <Field label="Reviews">
              <span className="num">
                {raw?.reviewCount ?? "—"}
                {raw?.rating ? ` · ${raw.rating}★` : ""}
              </span>
            </Field>
            <Field label="Found">
              <span className="num">{formatDateTime(prospect.createdAt)}</span>
            </Field>
            <Field label="Last crawled">
              {prospect.lastCrawledAt ? (
                <span className="num">{formatDateTime(prospect.lastCrawledAt)}</span>
              ) : (
                <span className="text-ink-400">Not crawled yet</span>
              )}
            </Field>
            <Field label="Lead">
              {prospect.leadId ? (
                <Link
                  href={`/admin/leads/${prospect.leadId}`}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  Open the lead
                </Link>
              ) : (
                <span className="text-ink-400">Not converted</span>
              )}
            </Field>
          </dl>
        </Card>

        <Card>
          <SectionTitle
            hint={`Scored out of 100 against a threshold of ${config.prospectorMinScore}.`}
          >
            Fit score
          </SectionTitle>
          <p
            className={`num text-[2.5rem] font-bold leading-none tracking-tight ${
              prospect.score === null
                ? "text-ink-400"
                : meetsThreshold
                  ? "text-emerald-700"
                  : "text-amber-700"
            }`}
          >
            {prospect.score ?? "—"}
          </p>
          {prospect.score !== null && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <div
                aria-hidden
                className={`h-full rounded-full ${meetsThreshold ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${Math.min(100, Math.max(0, prospect.score))}%` }}
              />
            </div>
          )}
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            {prospect.scoreReason ?? "No reason recorded."}
          </p>
        </Card>
      </div>

      {prospect.siteDigest && (
        <Card>
          <SectionTitle hint="What the crawler read on their own site. The outreach writer personalises from this and nothing else.">
            From their website
          </SectionTitle>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {prospect.siteDigest}
          </p>
        </Card>
      )}

      <section>
        <SectionTitle hint="In send order. Only the top one is used; the rest are fallbacks if it bounces. Every address was taken from a public page on the business's own site.">
          <span>
            Addresses found <span className="num text-ink-400">({contacts.length})</span>
          </span>
        </SectionTitle>
        <DataTable head={["Address", "Verification", "Found on", "Priority"]} minWidth="48rem">
          {contacts.length === 0 && (
            <EmptyState
              colSpan={4}
              title="No address was found on this site"
              body="Without one it can never be contacted. Re-crawling only helps if the site has since published a contact page."
              action={
                <ButtonLink href="/admin/agents/prospects?contactable=no">
                  See every prospect without an address
                </ButtonLink>
              }
            />
          )}
          {contacts.map((c, i) => {
            const isBlocked = blocked.has(c.email);
            return (
              <Row key={c.id}>
                <Cell>
                  <p
                    className={`num break-all ${
                      isBlocked ? "text-ink-400 line-through" : "text-ink-900"
                    }`}
                    dir="ltr"
                  >
                    {c.email}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    {i === 0 && !isBlocked && <Badge tone="brand">primary</Badge>}
                    {isBlocked && <Badge tone="danger">suppressed</Badge>}
                    <span className="text-[11px] text-ink-500">
                      {c.name ?? c.role ?? (c.isRoleAccount ? "shared mailbox" : "personal")}
                    </span>
                  </p>
                </Cell>
                <Cell>
                  <Badge tone={VERIFICATION_TONE[c.verification] ?? "neutral"}>
                    {VERIFICATION_LABEL[c.verification] ?? c.verification}
                  </Badge>
                </Cell>
                <Cell>
                  {c.sourceUrl ? (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="num break-all text-xs text-ink-500 underline-offset-2 hover:text-brand-700 hover:underline"
                      dir="ltr"
                    >
                      {c.sourceUrl}
                    </a>
                  ) : (
                    <span className="text-xs text-ink-400">—</span>
                  )}
                </Cell>
                <Cell className="num text-end text-xs text-ink-600">{c.priority}</Cell>
              </Row>
            );
          })}
        </DataTable>
      </section>

      {threads.length > 0 && (
        <section>
          <SectionTitle hint="Newest thread first, messages oldest first inside it.">
            Conversation
          </SectionTitle>
          <div className="space-y-4">
            {threads.map((t) => {
              const thread = messages.filter((m) => m.threadId === t.id);
              return (
                <Card key={t.id}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                    <Badge tone={THREAD_TONE[t.status] ?? "neutral"}>
                      {t.status.replace(/_/g, " ")}
                    </Badge>
                    <span className="num text-ink-900" dir="ltr">
                      {t.toEmail}
                    </span>
                    <span className="text-ink-300">·</span>
                    <span>
                      step <span className="num">{t.stepIndex}</span>
                    </span>
                    <span className="text-ink-300">·</span>
                    <span className="num">{formatDateTime(t.createdAt)}</span>
                  </div>
                  {thread.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-500">Nothing has been written yet.</p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {thread.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-xl border border-ink-100 bg-paper/70 p-4"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={m.direction === "inbound" ? "info" : "neutral"}>
                              {m.direction}
                            </Badge>
                            <Badge tone={MESSAGE_TONE[m.status] ?? "neutral"}>
                              {m.status.replace(/_/g, " ")}
                            </Badge>
                            {m.sentAt && (
                              <span className="num text-[11px] text-ink-400">
                                {formatDateTime(m.sentAt)}
                              </span>
                            )}
                          </div>
                          {m.subject && (
                            <p className="mt-2 font-display text-sm font-bold text-ink-900">
                              {m.subject}
                            </p>
                          )}
                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-ink-600">
                            {m.bodyText?.slice(0, 1200)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
