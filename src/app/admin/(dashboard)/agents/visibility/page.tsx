import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { visibilityTargets } from "@/db/schema";
import { auth } from "@/lib/auth";
import { TargetStatusForm } from "@/components/admin/AgentConsole";
import { formatDateTime } from "@/components/admin/status";
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

const SECTIONS = [
  {
    kind: "citation" as const,
    title: "Citations",
    blurb: "Business listings to claim. Use identical name, address and phone on each.",
  },
  {
    kind: "mention" as const,
    title: "Mentions & link targets",
    blurb: "Pages writing about the mandate that could cite the directory.",
  },
  {
    kind: "link" as const,
    title: "Ranking competitors",
    blurb: "Who currently outranks us for the keywords we track.",
  },
];

/** The workflow reads left to right: found → planned → written → sent → won. */
const STATUSES = ["discovered", "queued", "drafted", "actioned", "won", "skipped"] as const;

const STATUS_TONE: Record<string, Tone> = {
  discovered: "neutral",
  queued: "info",
  drafted: "brand",
  actioned: "warning",
  won: "positive",
  skipped: "neutral",
};

export default async function VisibilityTargetsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const [groups, tallies] = await Promise.all([
    Promise.all(
      SECTIONS.map(async (section) => ({
        ...section,
        rows: await db
          .select()
          .from(visibilityTargets)
          .where(eq(visibilityTargets.kind, section.kind))
          .orderBy(desc(visibilityTargets.createdAt))
          .limit(40),
      })),
    ),
    // One cheap grouped scan. The lists below are capped at 40 rows per kind,
    // so without this the page would quietly under-report itself.
    db
      .select({
        kind: visibilityTargets.kind,
        status: visibilityTargets.status,
        count: sql<number>`count(*)::int`,
      })
      .from(visibilityTargets)
      .groupBy(visibilityTargets.kind, visibilityTargets.status),
  ]);

  const total = tallies.reduce((sum, t) => sum + t.count, 0);
  const byStatus = new Map<string, number>();
  const byKind = new Map<string, number>();
  for (const t of tallies) {
    byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + t.count);
    byKind.set(t.kind, (byKind.get(t.kind) ?? 0) + t.count);
  }

  const undecided = (byStatus.get("discovered") ?? 0) + (byStatus.get("queued") ?? 0);
  const drafted = byStatus.get("drafted") ?? 0;
  const won = byStatus.get("won") ?? 0;

  const kindLabel: Record<string, string> = Object.fromEntries(
    SECTIONS.map((s) => [s.kind, s.title]),
  );

  return (
    <>
      <PageHeader
        title="Visibility targets"
        count={total}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Dot tone={drafted > 0 ? "brand" : undecided > 0 ? "warning" : "positive"} />
            <span>
              Places worth being listed or cited. The agent finds and drafts; a human decides
              and posts — automated link dropping is what gets a domain penalised, so it does
              not do that.
            </span>
          </span>
        }
        actions={
          <>
            <ButtonLink href="/admin/agents">Agent console</ButtonLink>
            <ButtonLink href="/admin/agents/content" variant="primary">
              Content &amp; rankings
            </ButtonLink>
          </>
        }
      />

      <section>
        <SectionTitle hint="Counts cover every target, not only the rows listed below.">
          Pipeline
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Targets tracked" value={total} hint="Citations, mentions and competitors" />
          <StatCard
            label="Waiting on a decision"
            value={undecided}
            tone={undecided > 0 ? "warning" : "neutral"}
            hint="Discovered or queued, not yet judged"
          />
          <StatCard
            label="Pitch drafted"
            value={drafted}
            tone={drafted > 0 ? "brand" : "neutral"}
            hint="Written by the agent, needs a human to send"
          />
          <StatCard
            label="Won"
            value={won}
            tone="positive"
            hint={total ? `${Math.round((won / total) * 100)}% of all targets` : "Nothing yet"}
          />
        </div>
      </section>

      {total > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle hint="Found, planned, written, sent, won — in workflow order.">
              By stage
            </SectionTitle>
            <BarList
              items={STATUSES.map((status) => ({
                label: status,
                value: byStatus.get(status) ?? 0,
              }))}
            />
          </Card>
          <Card>
            <SectionTitle hint="Where the opportunity sits.">By kind</SectionTitle>
            <BarList
              tone="info"
              items={SECTIONS.map((section) => ({
                label: section.title,
                value: byKind.get(section.kind) ?? 0,
              }))}
            />
          </Card>
        </div>
      )}

      {groups.map((group) => {
        const kindTotal = byKind.get(group.kind) ?? group.rows.length;
        return (
          <section key={group.kind}>
            <SectionTitle
              hint={group.blurb}
              action={
                <span className="num text-xs text-ink-400">
                  {group.rows.length} of {kindTotal}
                </span>
              }
            >
              {kindLabel[group.kind] ?? group.title}
            </SectionTitle>

            {group.rows.length === 0 ? (
              <Card>
                <EmptyState
                  title={`No ${group.title.toLowerCase()} yet`}
                  body="The Visibility agent fills this in when it runs. Queue a job and it will search for targets worth pitching."
                  action={<ButtonLink href="/admin/agents">Queue a visibility job</ButtonLink>}
                />
              </Card>
            ) : (
              <ul className="grid gap-4 lg:grid-cols-2">
                {group.rows.map((target) => (
                  <li key={target.id}>
                    <Card className="h-full">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <Badge tone={STATUS_TONE[target.status] ?? "neutral"}>
                          {target.status}
                        </Badge>
                        {target.actionedAt && (
                          <span className="num text-[11px] text-ink-400">
                            actioned {formatDateTime(target.actionedAt)}
                          </span>
                        )}
                        <span className="num ms-auto text-[11px] text-ink-400">
                          {formatDateTime(target.createdAt)}
                        </span>
                      </div>

                      <a
                        href={target.url}
                        target="_blank"
                        rel="noreferrer nofollow"
                        className="mt-3 block font-display text-base font-bold leading-snug tracking-tight text-ink-900 transition-colors hover:text-brand-800"
                      >
                        {target.title || target.url}
                      </a>
                      <p className="num mt-1 truncate text-xs text-ink-400" dir="ltr">
                        {target.domain ?? target.url}
                      </p>

                      {target.snippet && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-600">
                          {target.snippet}
                        </p>
                      )}
                      {target.notes && (
                        <p className="mt-2 rounded-lg bg-paper-dark px-3 py-2 text-xs leading-relaxed text-ink-600">
                          {target.notes}
                        </p>
                      )}
                      {target.query && (
                        <p className="mt-3 text-[11px] text-ink-500">
                          Found searching{" "}
                          <span className="text-ink-700">“{target.query}”</span>
                        </p>
                      )}

                      {target.draft && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-semibold text-brand-700 transition-colors hover:text-brand-900">
                            Drafted pitch
                          </summary>
                          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-paper-dark p-3 text-xs leading-relaxed text-ink-700">
                            {target.draft}
                          </pre>
                        </details>
                      )}

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
                        <span className="text-[11px] text-ink-400">
                          Move it along when you have acted.
                        </span>
                        <TargetStatusForm targetId={target.id} status={target.status} />
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
