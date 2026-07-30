import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { outreachMessages, outreachThreads, prospects } from "@/db/schema";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/components/admin/status";
import {
  Badge,
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

const PAGE_SIZE = 30;

const THREAD_TONE: Record<string, Tone> = {
  active: "brand",
  awaiting_reply: "info",
  replied: "warning",
  converted: "positive",
  closed: "neutral",
  bounced: "danger",
  unsubscribed: "danger",
};

const THREAD_LABEL: Record<string, string> = {
  active: "Active",
  awaiting_reply: "Awaiting reply",
  replied: "They replied",
  converted: "Converted",
  closed: "Closed",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");
  const params = await searchParams;
  const status = params.status;
  const q = params.q?.trim();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const conditions: SQL[] = [];
  if (status && THREAD_LABEL[status]) {
    conditions.push(eq(outreachThreads.status, status as "active"));
  }
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(outreachThreads.toEmail, pattern),
        ilike(outreachThreads.subject, pattern),
        ilike(prospects.name, pattern),
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, countRow, statusCounts, needsReply] = await Promise.all([
    db
      .select({
        thread: outreachThreads,
        company: prospects.name,
        // The newest message decides how a row reads, so fetch it as a scalar
        // rather than joining every message and collapsing in memory.
        lastAt: sql<Date | null>`(SELECT max(m.created_at) FROM outreach_messages m WHERE m.thread_id = ${outreachThreads.id})`,
        lastDirection: sql<
          string | null
        >`(SELECT m.direction FROM outreach_messages m WHERE m.thread_id = ${outreachThreads.id} ORDER BY m.created_at DESC LIMIT 1)`,
        preview: sql<
          string | null
        >`(SELECT left(m.body_text, 160) FROM outreach_messages m WHERE m.thread_id = ${outreachThreads.id} ORDER BY m.created_at DESC LIMIT 1)`,
        messages: sql<number>`(SELECT count(*)::int FROM outreach_messages m WHERE m.thread_id = ${outreachThreads.id})`,
        opens: sql<number>`(SELECT coalesce(sum(m.open_count),0)::int FROM outreach_messages m WHERE m.thread_id = ${outreachThreads.id})`,
        clicks: sql<number>`(SELECT coalesce(sum(m.click_count),0)::int FROM outreach_messages m WHERE m.thread_id = ${outreachThreads.id})`,
        awaiting: sql<number>`(SELECT count(*)::int FROM outreach_messages m WHERE m.thread_id = ${outreachThreads.id} AND m.status = 'pending_approval')`,
      })
      .from(outreachThreads)
      .leftJoin(prospects, eq(outreachThreads.prospectId, prospects.id))
      .where(where)
      .orderBy(desc(outreachThreads.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(outreachThreads)
      .leftJoin(prospects, eq(outreachThreads.prospectId, prospects.id))
      .where(where),
    db
      .select({ status: outreachThreads.status, n: sql<number>`count(*)::int` })
      .from(outreachThreads)
      .groupBy(outreachThreads.status),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(outreachMessages)
      .where(eq(outreachMessages.status, "pending_approval")),
  ]);

  const total = countRow[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.n]));
  const totalThreads = statusCounts.reduce((s, r) => s + r.n, 0);
  const totalOpens = rows.reduce((s, r) => s + r.opens, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, q, page: undefined, ...patch })) {
      if (v) next.set(k, String(v));
    }
    const qs = next.toString();
    return `/admin/inbox${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Inbox"
        count={total}
        subtitle="Every outreach conversation, newest activity first."
        actions={<ButtonLink href="/admin/agents/approvals">Approvals</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Conversations" value={totalThreads} hint="All time" />
        <StatCard
          label="They replied"
          value={byStatus["replied"] ?? 0}
          tone={(byStatus["replied"] ?? 0) > 0 ? "warning" : "neutral"}
          hint="Waiting on us"
          href={href({ status: "replied" })}
        />
        <StatCard
          label="Converted"
          value={byStatus["converted"] ?? 0}
          tone="positive"
          hint="Became a CRM lead"
          href={href({ status: "converted" })}
        />
        <StatCard
          label="Clicks on this page"
          value={totalClicks}
          hint={`${totalOpens} opens — clicks are the number to trust`}
          tone={totalClicks > 0 ? "brand" : "neutral"}
        />
      </div>

      {(needsReply[0]?.n ?? 0) > 0 && (
        <Card>
          <SectionTitle hint="Drafted replies do not send until you approve them.">
            <span className="num">{needsReply[0].n}</span> message
            {needsReply[0].n === 1 ? "" : "s"} awaiting approval
          </SectionTitle>
          <ButtonLink href="/admin/agents/approvals" variant="primary">
            Review them
          </ButtonLink>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href({ status: undefined })}
            aria-current={!status ? "page" : undefined}
            className={`press num rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${
              !status
                ? "bg-ink-900 text-white ring-ink-900"
                : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-400"
            }`}
          >
            all {totalThreads}
          </Link>
          {Object.entries(THREAD_LABEL).map(([key, label]) => {
            const n = byStatus[key] ?? 0;
            if (!n && status !== key) return null;
            return (
              <Link
                key={key}
                href={href({ status: key })}
                aria-current={status === key ? "page" : undefined}
                className={`press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${
                  status === key
                    ? "bg-ink-900 text-white ring-ink-900"
                    : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-400"
                }`}
              >
                <Dot tone={THREAD_TONE[key] ?? "neutral"} />
                {label} <span className="num">{n}</span>
              </Link>
            );
          })}
        </div>
        <form method="get" className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            aria-label="Search conversations"
            placeholder="Search company, address or subject…"
            className="w-full max-w-sm rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            className="press rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Search
          </button>
          {(q || status) && (
            <Link
              href="/admin/inbox"
              className="press rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700"
            >
              Clear
            </Link>
          )}
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title={q || status ? "No conversations match" : "No conversations yet"}
            body={
              q || status
                ? "Try clearing the filters."
                : "They appear here as soon as the Conversationalist opens a thread."
            }
            action={<ButtonLink href="/admin/agents/prospects">See prospects</ButtonLink>}
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {rows.map((r) => {
              const inbound = r.lastDirection === "inbound";
              return (
                <li key={r.thread.id}>
                  <Link
                    href={`/admin/inbox/${r.thread.id}`}
                    className="block px-5 py-4 transition-colors hover:bg-paper/70"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Dot tone={THREAD_TONE[r.thread.status] ?? "neutral"} />
                      <p className="min-w-0 truncate font-semibold text-ink-900">
                        {r.company ?? r.thread.toEmail}
                      </p>
                      <Badge tone={THREAD_TONE[r.thread.status] ?? "neutral"}>
                        {THREAD_LABEL[r.thread.status] ?? r.thread.status}
                      </Badge>
                      {r.awaiting > 0 && <Badge tone="warning">needs approval</Badge>}
                      {inbound && <Badge tone="info">new reply</Badge>}
                      <span className="num ms-auto shrink-0 text-[11px] text-ink-400">
                        {r.lastAt ? formatDateTime(new Date(r.lastAt)) : "—"}
                      </span>
                    </div>
                    <p className="num mt-1 truncate text-xs text-ink-500" dir="ltr">
                      {r.thread.toEmail}
                      {r.thread.subject ? ` · ${r.thread.subject}` : ""}
                    </p>
                    {r.preview && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-600">
                        {inbound ? "" : "You: "}
                        {r.preview}
                      </p>
                    )}
                    <p className="num mt-1.5 text-[11px] text-ink-400">
                      {r.messages} message{r.messages === 1 ? "" : "s"} · {r.opens} open
                      {r.opens === 1 ? "" : "s"} · {r.clicks} click{r.clicks === 1 ? "" : "s"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="num text-ink-500">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            {page > 1 && <ButtonLink href={href({ page: String(page - 1) })}>← Previous</ButtonLink>}
            {page < totalPages && (
              <ButtonLink href={href({ page: String(page + 1) })}>Next →</ButtonLink>
            )}
          </div>
        </div>
      )}
    </>
  );
}
