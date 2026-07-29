import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { outreachMessages, outreachThreads, prospects } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ApprovalCard } from "@/components/admin/AgentConsole";
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
  type Tone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** How long this email has been sitting in front of a human, in words. */
function ageLabel(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))}m`;
  if (ms < 2 * DAY) return `${Math.floor(ms / HOUR)}h`;
  return `${Math.floor(ms / DAY)}d`;
}

/** Waiting is the failure mode here: the older it is, the louder it reads. */
function ageTone(ms: number): Tone {
  if (ms >= 3 * DAY) return "danger";
  if (ms >= DAY) return "warning";
  return "neutral";
}

const THREAD_TONE: Record<string, Tone> = {
  active: "info",
  awaiting_reply: "warning",
  replied: "positive",
  converted: "positive",
  closed: "neutral",
  bounced: "danger",
  unsubscribed: "danger",
};

/** Tally helper — a ranked breakdown out of a list of keys. */
function tally(keys: string[]): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const key of keys) map.set(key, (map.get(key) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export default async function ApprovalsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const [rows, pendingTotal] = await Promise.all([
    db
      .select({
        message: outreachMessages,
        thread: outreachThreads,
        prospectName: prospects.name,
      })
      .from(outreachMessages)
      .innerJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
      .leftJoin(prospects, eq(outreachThreads.prospectId, prospects.id))
      .where(eq(outreachMessages.status, "pending_approval"))
      .orderBy(asc(outreachMessages.createdAt))
      .limit(50),
    // Cheap indexed count, so the header can say how many are really queued
    // rather than how many fit on this page.
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(outreachMessages)
      .where(eq(outreachMessages.status, "pending_approval")),
  ]);

  const now = Date.now();
  const total = pendingTotal[0]?.n ?? rows.length;
  const ages = rows.map((r) => now - new Date(r.message.createdAt).getTime());
  const oldest = ages.length ? Math.max(...ages) : 0;
  const stale = ages.filter((a) => a >= DAY).length;

  const recipients = new Set(
    rows.map(({ message, thread }) => message.toEmail ?? thread.toEmail),
  );
  const byCampaign = tally(rows.map((r) => r.thread.campaign || "default"));
  const byDomain = tally(
    rows.map(({ message, thread }) =>
      (message.toEmail ?? thread.toEmail).split("@")[1]?.toLowerCase() ?? "unknown",
    ),
  );

  return (
    <>
      <PageHeader
        title="Approval queue"
        count={total}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Dot tone={total === 0 ? "positive" : stale > 0 ? "warning" : "info"} />
            {total === 0 ? (
              <span>Nothing is waiting. Every drafted email has been dealt with.</span>
            ) : (
              <span>
                Nothing sends until you approve it. Oldest has waited{" "}
                <span className="num font-semibold text-ink-700">{ageLabel(oldest)}</span>
                {stale > 0 && (
                  <>
                    {" "}
                    · <span className="num">{stale}</span> over a day old
                  </>
                )}
                .
              </span>
            )}
          </span>
        }
        actions={
          <>
            <ButtonLink href="/admin/agents">Agent console</ButtonLink>
            <ButtonLink href="/admin/agents/prospects" variant="primary">
              Prospects
            </ButtonLink>
          </>
        }
      />

      {rows.length > 0 && (
        <section>
          <SectionTitle hint="What is sitting in the queue right now.">Queue at a glance</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Awaiting approval"
              value={total}
              tone={stale > 0 ? "warning" : "brand"}
              hint={
                total > rows.length
                  ? `${rows.length} shown, oldest first`
                  : "Read, edit, then approve or reject"
              }
            />
            <StatCard
              label="Recipients"
              value={recipients.size}
              hint="Distinct addresses on this page"
            />
            <StatCard
              label="Campaigns"
              value={byCampaign.length}
              hint={byCampaign[0] ? `Largest: ${byCampaign[0].label}` : undefined}
            />
            <StatCard
              label="Oldest wait"
              value={ageLabel(oldest)}
              tone={ageTone(oldest)}
              hint="Drafts go stale — the company moves on"
            />
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle hint="Which sequence produced these drafts.">By campaign</SectionTitle>
            <BarList items={byCampaign.slice(0, 6)} emptyLabel="No campaigns yet." />
          </Card>
          <Card>
            <SectionTitle hint="Several drafts to one company usually means a duplicate thread.">
              By recipient domain
            </SectionTitle>
            <BarList tone="info" items={byDomain.slice(0, 6)} emptyLabel="No recipients yet." />
          </Card>
        </div>
      )}

      <section>
        <SectionTitle
          hint="Oldest first. What you approve is exactly what goes out — edit freely."
          action={
            rows.length > 0 ? (
              <span className="num text-xs text-ink-400">
                {rows.length} of {total}
              </span>
            ) : undefined
          }
        >
          Pending review
        </SectionTitle>

        {rows.length === 0 ? (
          <Card>
            <EmptyState
              title="The queue is clear"
              body="Nothing is waiting on you. The Conversationalist will queue the next email here as soon as it drafts one."
              action={<ButtonLink href="/admin/agents">Open the agent console</ButtonLink>}
            />
          </Card>
        ) : (
          <ul className="space-y-5">
            {rows.map(({ message, thread, prospectName }, i) => {
              const age = now - new Date(message.createdAt).getTime();
              return (
                <li key={message.id}>
                  <Card padded={false} className="overflow-hidden">
                    {/* Triage rail: the context the editor below does not carry. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-200/70 bg-paper-dark/60 px-5 py-3">
                      <span className="num text-[11px] font-semibold tracking-[0.12em] text-ink-400">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Badge tone={THREAD_TONE[thread.status] ?? "neutral"}>
                        {thread.status.replace(/_/g, " ")}
                      </Badge>
                      {message.stepIndex !== null && (
                        <Badge tone="neutral">
                          step <span className="num">{message.stepIndex + 1}</span>
                        </Badge>
                      )}
                      <Badge tone={ageTone(age)}>
                        waiting <span className="num">{ageLabel(age)}</span>
                      </Badge>
                      {thread.lastInboundAt && (
                        <Badge tone="positive">they replied</Badge>
                      )}
                      {thread.prospectId && (
                        <Link
                          href={`/admin/agents/prospects/${thread.prospectId}`}
                          className="ms-auto text-[11px] font-semibold text-brand-700 transition-colors hover:text-brand-900"
                        >
                          Open prospect
                        </Link>
                      )}
                    </div>

                    {/* The editor itself — the client card owns subject, body and
                        the approve/reject actions; the shell above is ours. */}
                    <div className="[&>article]:rounded-none [&>article]:border-0 [&>article]:bg-transparent [&>article]:p-5 sm:[&>article]:p-6">
                      <ApprovalCard
                        message={{
                          id: message.id,
                          subject: message.subject,
                          bodyText: message.bodyText,
                          toEmail: message.toEmail ?? thread.toEmail,
                          campaign: thread.campaign,
                          company: prospectName,
                          intent: (message.aiMeta as { intent?: string } | null)?.intent ?? null,
                          createdAt: new Date(message.createdAt).toLocaleString("en-GB", {
                            timeZone: "Asia/Dubai",
                            dateStyle: "medium",
                            timeStyle: "short",
                          }),
                        }}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
