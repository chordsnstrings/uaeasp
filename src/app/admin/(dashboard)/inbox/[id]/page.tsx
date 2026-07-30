import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { outreachMessages, outreachThreads, prospects } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAgentConfig } from "@/lib/agents/config";
import { previewHtml } from "@/lib/agents/compose";
import { EMIRATE_LABELS, formatDateTime } from "@/components/admin/status";
import { ApprovalCard } from "@/components/admin/AgentConsole";
import {
  Badge,
  ButtonLink,
  Card,
  Dot,
  EmptyState,
  Field,
  PageHeader,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const THREAD_TONE: Record<string, Tone> = {
  active: "brand",
  awaiting_reply: "info",
  replied: "warning",
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

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [thread] = await db
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.id, id))
    .limit(1);
  if (!thread) notFound();

  const [prospect] = thread.prospectId
    ? await db.select().from(prospects).where(eq(prospects.id, thread.prospectId)).limit(1)
    : [];

  const messages = await db
    .select()
    .from(outreachMessages)
    .where(eq(outreachMessages.threadId, id))
    .orderBy(asc(outreachMessages.createdAt));

  // Needed to render a preview the same way the send path will.
  const config = await getAgentConfig();

  const opens = messages.reduce((s, m) => s + (m.openCount ?? 0), 0);
  const clicks = messages.reduce((s, m) => s + (m.clickCount ?? 0), 0);
  const inbound = messages.filter((m) => m.direction === "inbound").length;
  const pending = messages.filter((m) => m.status === "pending_approval");

  return (
    <>
      <PageHeader
        title={prospect?.name ?? thread.toEmail}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Dot tone={THREAD_TONE[thread.status] ?? "neutral"} />
            <Badge tone={THREAD_TONE[thread.status] ?? "neutral"}>{thread.status}</Badge>
            <span className="num" dir="ltr">
              {thread.toEmail}
            </span>
            {prospect?.emirate && (
              <>
                <span className="text-ink-300">·</span>
                <span>{EMIRATE_LABELS[prospect.emirate] ?? prospect.emirate}</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            {prospect && (
              <ButtonLink href={`/admin/agents/prospects/${prospect.id}`}>Prospect</ButtonLink>
            )}
            {thread.leadId && (
              <ButtonLink href={`/admin/leads/${thread.leadId}`} variant="primary">
                Open lead
              </ButtonLink>
            )}
            <ButtonLink href="/admin/inbox">← Inbox</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Messages" value={messages.length} hint={`${inbound} from them`} />
        <StatCard
          label="Opens"
          value={opens}
          tone={opens > 0 ? "info" : "neutral"}
          hint="Approximate — images are often blocked"
        />
        <StatCard
          label="Clicks"
          value={clicks}
          tone={clicks > 0 ? "positive" : "neutral"}
          hint="The signal worth trusting"
        />
        <StatCard label="Sequence step" value={thread.stepIndex} hint={`Campaign: ${thread.campaign}`} />
      </div>

      {pending.length > 0 && (
        <section>
          <SectionTitle hint="Edit before approving if it needs it. Nothing sends until you do.">
            Waiting on you
          </SectionTitle>
          <div className="space-y-4">
            {pending.map((m) => (
              <Card key={m.id} padded={false} className="[&>article]:rounded-none [&>article]:border-0 [&>article]:p-5 sm:[&>article]:p-6">
                <ApprovalCard
                  message={{
                    id: m.id,
                    subject: m.subject,
                    bodyText: m.bodyText,
                    bodyHtml: previewHtml(m, config, thread.token),
                    toEmail: m.toEmail ?? thread.toEmail,
                    campaign: thread.campaign,
                    company: prospect?.name ?? null,
                    intent: ((m.aiMeta ?? {}) as { intent?: string }).intent ?? null,
                    createdAt: m.createdAt.toISOString(),
                  }}
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      <Card padded={false}>
        <div className="p-5 pb-4 sm:p-6 sm:pb-4">
          <SectionTitle hint="Oldest first, so the conversation reads top to bottom.">
            Conversation
          </SectionTitle>
        </div>
        {messages.length === 0 ? (
          <div className="px-5 pb-6">
            <EmptyState title="Nothing sent yet" body="This thread has no messages." />
          </div>
        ) : (
          <ul className="space-y-4 border-t border-ink-100 p-5 sm:p-6">
            {messages.map((m) => {
              const them = m.direction === "inbound";
              const meta = (m.aiMeta ?? {}) as { intent?: string };
              return (
                <li
                  key={m.id}
                  className={`max-w-[46rem] rounded-2xl border p-4 ${
                    them
                      ? "border-brand-200 bg-brand-50/40"
                      : "ms-auto border-ink-200 bg-paper/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={them ? "brand" : "neutral"}>{them ? "them" : "us"}</Badge>
                    <Badge tone={MESSAGE_TONE[m.status] ?? "neutral"}>{m.status}</Badge>
                    {meta.intent && <Badge tone="info">{meta.intent}</Badge>}
                    {!them && (m.openCount ?? 0) > 0 && (
                      <span className="num text-[11px] text-ink-500">
                        {m.openCount} open{m.openCount === 1 ? "" : "s"}
                      </span>
                    )}
                    {!them && (m.clickCount ?? 0) > 0 && (
                      <span className="num text-[11px] font-semibold text-emerald-700">
                        {m.clickCount} click{m.clickCount === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="num ms-auto text-[11px] text-ink-400">
                      {formatDateTime(m.sentAt ?? m.receivedAt ?? m.createdAt)}
                    </span>
                  </div>
                  {m.subject && (
                    <p className="mt-2 text-sm font-semibold text-ink-900">{m.subject}</p>
                  )}
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                    {m.bodyText}
                  </p>
                  {m.error && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      {m.error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Thread</SectionTitle>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Opened">
            <span className="num">{formatDateTime(thread.createdAt)}</span>
          </Field>
          <Field label="Last outbound">
            <span className="num">
              {thread.lastOutboundAt ? formatDateTime(thread.lastOutboundAt) : "—"}
            </span>
          </Field>
          <Field label="Last inbound">
            <span className="num">
              {thread.lastInboundAt ? formatDateTime(thread.lastInboundAt) : "—"}
            </span>
          </Field>
          <Field label="Next action">
            <span className="num">
              {thread.nextActionAt ? formatDateTime(thread.nextActionAt) : "none scheduled"}
            </span>
          </Field>
        </dl>
      </Card>
    </>
  );
}
