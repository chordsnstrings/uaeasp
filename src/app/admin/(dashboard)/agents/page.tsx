import { redirect } from "next/navigation";
import { desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agentRuns,
  articles,
  outreachMessages,
  prospects,
  suppressions,
  visibilityTargets,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { agentReadiness, getAgentConfig, AGENT_SECRET_FIELDS } from "@/lib/agents/config";
import { heartbeatState } from "@/lib/agents/heartbeat";
import { AI_JOBS, getJobModels } from "@/lib/ai/models";
import { getConfig } from "@/lib/settings";
import { dailySendCap, sentToday } from "@/lib/agents/mailer";
import { queueDepth } from "@/lib/agents/queue";
import { absoluteUrl } from "@/lib/site";
import { dubaiDay, formatDateTime } from "@/components/admin/status";
import {
  AgentConfigForm,
  AgentSwitch,
  ModelRoutingForm,
  QueueJobForm,
  TestSesForm,
  TickButton,
} from "@/components/admin/AgentConsole";
import {
  Badge,
  BarList,
  ButtonLink,
  Card,
  Cell,
  ColumnChart,
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

const DAY = 86_400_000;

const AGENT_META = [
  {
    key: "prospector" as const,
    name: "Prospector",
    role: "Finds UAE businesses and their contact addresses",
  },
  {
    key: "conversationalist" as const,
    name: "Conversationalist",
    role: "Writes, sends and answers outreach email",
  },
  {
    key: "visibility" as const,
    name: "Visibility",
    role: "Rank checks, content drafts, citations, link outreach",
  },
  { key: "analyst" as const, name: "Analyst", role: "Weekly report with recommendations" },
];

const MANUAL_JOBS = [
  { agent: "prospector", kind: "daily_plan", label: "Prospector — start a discovery sweep" },
  { agent: "prospector", kind: "find_direct", label: "Prospector — hunt for named contacts" },
  { agent: "conversationalist", kind: "tick", label: "Conversationalist — run follow-ups" },
  { agent: "conversationalist", kind: "flush_approved", label: "Conversationalist — send approved" },
  { agent: "visibility", kind: "weekly", label: "Visibility — full weekly cycle" },
  { agent: "visibility", kind: "rank_check", label: "Visibility — check rankings" },
  { agent: "visibility", kind: "draft_article", label: "Visibility — draft an article" },
  { agent: "visibility", kind: "find_mentions", label: "Visibility — find link targets" },
  { agent: "analyst", kind: "weekly_report", label: "Analyst — generate the weekly report" },
];

const CHECKLIST = [
  <>
    In AWS SES, verify the sending domain (DKIM) and request production access — sandbox mode
    only sends to verified addresses.
  </>,
  <>
    Point an SNS topic at <code className="num text-xs">{absoluteUrl("/api/outreach/sns")}</code>{" "}
    for bounces, complaints and inbound replies. The endpoint self-confirms the subscription.
  </>,
  <>
    Nothing to schedule — the app beats its own clock every five minutes and refreshes the
    provider directory nightly. Adding GitHub secrets{" "}
    <code className="num text-xs">AGENT_TICK_URL</code> and{" "}
    <code className="num text-xs">INGEST_SECRET</code> adds a redundant external tick.
  </>,
  <>Fill in the offer copy below — the agent will not invent a sender identity.</>,
  <>Start in manual approval mode and read the first twenty emails yourself.</>,
];

const RUN_TONE: Record<string, Tone> = {
  success: "positive",
  failed: "danger",
  running: "info",
};

export default async function AgentsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const config = await getAgentConfig();
  const readiness = agentReadiness(config);

  const now = Date.now();
  const since14 = new Date(now - 14 * DAY);

  const [depth, runs, counts, cap, used, clock, jobModels, appConfig, runHistory] =
    await Promise.all([
      queueDepth(),
      db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(12),
      Promise.all([
        db
          .select({ n: sql<string>`count(*)` })
          .from(outreachMessages)
          .where(eq(outreachMessages.status, "pending_approval")),
        db.select({ n: sql<string>`count(*)` }).from(prospects),
        db
          .select({ n: sql<string>`count(*)` })
          .from(articles)
          .where(eq(articles.status, "draft")),
        db.select({ n: sql<string>`count(*)` }).from(suppressions),
        db
          .select({ n: sql<string>`count(*)` })
          .from(visibilityTargets)
          .where(sql`status IN ('discovered','drafted')`),
      ]),
      dailySendCap(config),
      sentToday(),
      heartbeatState(),
      getJobModels(),
      getConfig(),
      // Cheap roll-up over a small, indexed table: one grouped pass powers the
      // daily trend, the per-agent split and "how much ran today".
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${agentRuns.startedAt} AT TIME ZONE 'Asia/Dubai'), 'YYYY-MM-DD')`,
          agent: agentRuns.agent,
          status: agentRuns.status,
          n: sql<number>`count(*)::int`,
        })
        .from(agentRuns)
        .where(gte(agentRuns.startedAt, since14))
        .groupBy(
          sql`to_char(date_trunc('day', ${agentRuns.startedAt} AT TIME ZONE 'Asia/Dubai'), 'YYYY-MM-DD')`,
          agentRuns.agent,
          agentRuns.status,
        ),
    ]);

  const fmt = (iso: string | null) => (iso ? formatDateTime(iso) : "never");
  const beatAgeMin = clock.lastBeatAt
    ? Math.round((Date.now() - new Date(clock.lastBeatAt).getTime()) / 60000)
    : null;
  const clockHealthy = beatAgeMin !== null && beatAgeMin <= 15;

  const [pendingApproval, prospectCount, draftCount, suppressionCount, targetCount] =
    counts.map((c) => Number(c[0]?.n ?? 0));

  const secretsSet = Object.fromEntries(
    AGENT_SECRET_FIELDS.map((field) => [field, !!config[field]]),
  ) as Record<string, boolean>;

  /* Derived views over the one grouped query. */
  const runsPerDay = new Map<string, number>();
  const runsPerAgent = new Map<string, number>();
  const failsPerAgent = new Map<string, number>();
  const failsPerDay = new Map<string, number>();
  for (const r of runHistory) {
    runsPerDay.set(r.day, (runsPerDay.get(r.day) ?? 0) + r.n);
    runsPerAgent.set(r.agent, (runsPerAgent.get(r.agent) ?? 0) + r.n);
    if (r.status === "failed") {
      failsPerAgent.set(r.agent, (failsPerAgent.get(r.agent) ?? 0) + r.n);
      failsPerDay.set(r.day, (failsPerDay.get(r.day) ?? 0) + r.n);
    }
  }

  // A continuous 14-day series, so a quiet day reads as a zero column rather
  // than vanishing and silently compressing the axis.
  const series: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const { key, label } = dubaiDay(now - i * DAY);
    series.push({ label, value: runsPerDay.get(key) ?? 0 });
  }
  const today = dubaiDay(now).key;
  const runsToday = runsPerDay.get(today) ?? 0;
  const failsToday = failsPerDay.get(today) ?? 0;
  const runs14 = series.reduce((s, p) => s + p.value, 0);

  const agentStates = AGENT_META.map((agent) => {
    const state = readiness[agent.key];
    const tone: Tone =
      state.enabled && state.ready ? "positive" : state.enabled ? "warning" : "neutral";
    const label = state.enabled && state.ready ? "running" : state.enabled ? "blocked" : "off";
    return { ...agent, state, tone, label };
  });
  const liveAgents = agentStates.filter((a) => a.label === "running").length;
  const blockedAgents = agentStates.filter((a) => a.label === "blocked").length;

  const queued = depth.queued ?? 0;
  const running = depth.running ?? 0;
  const failedTasks = depth.failed ?? 0;
  const doneTasks = depth.done ?? 0;

  return (
    <>
      <PageHeader
        title="Growth agents"
        subtitle={
          <div className="space-y-1.5">
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <Dot tone={clockHealthy ? "positive" : "warning"} />
              <span className={clockHealthy ? "text-emerald-700" : "text-amber-700"}>
                {clockHealthy ? "clock running" : "clock stalled"}
              </span>
              <span className="text-ink-300">·</span>
              <span>
                last beat <span className="num text-ink-700">{fmt(clock.lastBeatAt)}</span>
                {beatAgeMin !== null && <span className="num text-ink-400"> ({beatAgeMin}m)</span>}
              </span>
            </span>
            <p className="max-w-2xl">
              Four agents share one queue: the Prospector finds businesses, the
              Conversationalist emails them, Visibility earns rankings, the Analyst reports
              weekly. Nothing runs until the master switch is on and the agent has what it needs.
            </p>
          </div>
        }
        actions={<TickButton />}
      />

      {/* Right now — the five numbers that decide whether to intervene. */}
      <section>
        <SectionTitle hint="Queue, throughput and switches, as of this page load.">
          Right now
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Queued"
            value={queued}
            tone={queued > 0 ? "warning" : "neutral"}
            hint={`${running} running · ${doneTasks} done`}
          />
          <StatCard
            label="Failed tasks"
            value={failedTasks}
            tone={failedTasks > 0 ? "danger" : "neutral"}
            hint={failedTasks > 0 ? "Buried after their retries ran out." : "Nothing buried."}
          />
          <StatCard
            label="Runs today"
            value={runsToday}
            tone={failsToday > 0 ? "warning" : "brand"}
            spark={series.map((s) => s.value)}
            hint={
              failsToday > 0
                ? `${failsToday} failed · ${runs14} in 14 days`
                : `${runs14} in the last 14 days`
            }
          />
          <StatCard
            label="Emails sent today"
            value={`${used}/${cap}`}
            tone={used >= cap ? "warning" : "neutral"}
            hint={used >= cap ? "Daily cap reached." : `${Math.max(0, cap - used)} left in today's cap`}
          />

          {/* Composed locally: StatCard holds one number, this holds four switches. */}
          <div className="rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                Agents live
              </p>
              <span className="num text-[11px] font-semibold text-ink-400">
                {liveAgents}/{agentStates.length}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {agentStates.map((agent) => (
                <li key={agent.key} className="flex items-center gap-2">
                  <Dot tone={agent.tone} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-700">
                    {agent.name}
                  </span>
                  <span className="stamp text-[9px] text-ink-400">{agent.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Agent health */}
        <Card className="xl:col-span-2">
          <SectionTitle
            hint="Blocked means the switch is on but a credential or setting is missing."
            action={
              blockedAgents > 0 ? (
                <Badge tone="warning">
                  <span className="num">{blockedAgents}</span> blocked
                </Badge>
              ) : (
                <Badge tone="positive">all clear</Badge>
              )
            }
          >
            Agent health
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {agentStates.map((agent) => (
              <div key={agent.key} className="rounded-xl border border-ink-200/70 bg-paper/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink-900">
                      <Dot tone={agent.tone} />
                      {agent.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{agent.role}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <AgentSwitch
                      agent={agent.key}
                      enabled={agent.state.enabled}
                      name={agent.name}
                    />
                    {/* The switch says on/off; this says what that actually
                        means right now — enabled but blocked is not running. */}
                    <Badge tone={agent.tone}>{agent.label}</Badge>
                  </div>
                </div>
                <p className="num mt-3 text-[11px] text-ink-400">
                  {(runsPerAgent.get(agent.key) ?? 0).toLocaleString()} runs · 14d
                  {(failsPerAgent.get(agent.key) ?? 0) > 0 && (
                    <span className="text-red-600"> · {failsPerAgent.get(agent.key)} failed</span>
                  )}
                </p>
                {agent.state.enabled && agent.state.missing.length > 0 && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200">
                    Needs: {agent.state.missing.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Scheduler */}
        <Card>
          <SectionTitle
            hint="The app beats its own clock every five minutes."
            action={
              <Badge tone={clockHealthy ? "positive" : "warning"}>
                {clockHealthy ? "running" : "stalled"}
              </Badge>
            }
          >
            Scheduler
          </SectionTitle>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Last beat">
              <span className="num">{fmt(clock.lastBeatAt)}</span>
              {beatAgeMin !== null && (
                <span className="num ms-1.5 text-xs text-ink-400">{beatAgeMin}m ago</span>
              )}
            </Field>
            <Field label="Directory refreshed">
              <span className="num">{fmt(clock.lastRefreshAt)}</span>
            </Field>
            <Field label="Master switch">
              <span className="flex items-center gap-2">
                <AgentSwitch agent="agents" enabled={config.agentsEnabled} name="master switch" />
                <span className="text-xs text-ink-500">
                  {config.agentsEnabled ? "all agents may run" : "nothing runs"}
                </span>
              </span>
            </Field>
            <Field label="Approval mode">
              <Badge tone={config.outreachApprovalMode === "manual" ? "info" : "warning"}>
                {config.outreachApprovalMode.replace("_", " ")}
              </Badge>
            </Field>
          </dl>
          {!config.agentsEnabled && (
            <p className="mt-4 rounded-lg bg-ink-100 px-3 py-2 text-xs leading-relaxed text-ink-600">
              The master switch is off, so the clock beats but no agent work is scheduled. Turn
              it on under Configuration below.
            </p>
          )}
        </Card>
      </div>

      {/* Work waiting on a human, and what the agents have built. */}
      <section>
        <SectionTitle hint="The first two are queues only a person can clear.">
          Waiting on you
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Emails to approve"
            value={pendingApproval}
            href="/admin/agents/approvals"
            tone={pendingApproval > 0 ? "warning" : "neutral"}
            hint="Read, edit and send — or reject."
          />
          <StatCard
            label="Article drafts"
            value={draftCount}
            href="/admin/agents/content"
            tone={draftCount > 0 ? "info" : "neutral"}
            hint="Publish to /insights once you agree with them."
          />
          <StatCard
            label="Link & citation targets"
            value={targetCount}
            href="/admin/agents/visibility"
            hint="Sites worth a listing or a pitch."
          />
          <StatCard
            label="Prospects"
            value={prospectCount}
            href="/admin/agents/prospects"
            hint="Everything the Prospector has found."
          />
          <StatCard
            label="Suppressed"
            value={suppressionCount}
            href="/admin/agents/prospects"
            hint="Addresses that will never be contacted."
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle hint="Runs per day, Dubai time, last 14 days. Hover a column for the count.">
            Run volume
          </SectionTitle>
          <ColumnChart points={series} tone="brand" />
        </Card>

        <Card>
          <SectionTitle hint="Which agent did the work, last 14 days.">Work by agent</SectionTitle>
          <BarList
            items={AGENT_META.map((agent) => {
              const fails = failsPerAgent.get(agent.key) ?? 0;
              return {
                label: agent.name,
                value: runsPerAgent.get(agent.key) ?? 0,
                hint: fails > 0 ? `${fails} failed` : undefined,
              };
            }).sort((a, b) => b.value - a.value)}
            emptyLabel="No runs in the last 14 days."
          />
        </Card>
      </div>

      {/* Manual triggers */}
      <div id="manual-jobs" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Enqueued immediately and picked up on the next beat.">
            Queue a job by hand
          </SectionTitle>
          <QueueJobForm jobs={MANUAL_JOBS} />
        </Card>
        <Card>
          <SectionTitle hint="Proves the SES credentials and the verified sender actually work.">
            Test email delivery
          </SectionTitle>
          <TestSesForm defaultTo={session.user.email ?? ""} />
        </Card>
      </div>

      {/* Run log — DataTable brings its own surface, so no Card around it. */}
      <section>
        <SectionTitle
          hint="The last twelve executions, newest first. Errors and step logs sit under the job."
          action={<ButtonLink href="/admin/reports">Weekly reports</ButtonLink>}
        >
          Recent runs
        </SectionTitle>
        <DataTable
          head={["Status", "Job", "In / out", "Tokens", "Models", "Started"]}
          minWidth="54rem"
        >
          {runs.length === 0 ? (
            <EmptyState
              colSpan={6}
              title="Nothing has run yet"
              body="Turn the master switch on, then press “Run agents now” — or queue a single job by hand."
              action={<ButtonLink href="#manual-jobs">Queue a job</ButtonLink>}
            />
          ) : (
            runs.map((run) => {
              const summary = run.summary as { models?: string[]; logs?: string[] } | null;
              const models = summary?.models ?? [];
              const logs = summary?.logs ?? [];
              return (
                <Row key={run.id}>
                  <Cell>
                    <Badge tone={RUN_TONE[run.status] ?? "neutral"}>{run.status}</Badge>
                  </Cell>
                  <Cell>
                    <span className="num text-[13px] font-semibold text-ink-900">
                      {run.agent}/{run.kind}
                    </span>
                    {run.error && (
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-red-600">
                        {run.error.slice(0, 200)}
                      </p>
                    )}
                    {!run.error && logs.length > 0 && (
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-500">
                        {logs.join(" · ")}
                      </p>
                    )}
                  </Cell>
                  {/* A slash, not an arrow: an arrow flips under RTL. */}
                  <Cell className="num whitespace-nowrap text-ink-700">
                    {run.itemsIn} / {run.itemsOut}
                  </Cell>
                  <Cell className="num text-ink-700">
                    {run.aiTokens > 0 ? run.aiTokens.toLocaleString() : "—"}
                  </Cell>
                  <Cell>
                    {models.length > 0 ? (
                      // Model ids are identifiers, not statuses: keep their case.
                      <span className="num text-[11px] leading-relaxed text-ink-500" dir="ltr">
                        {models.join(", ")}
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </Cell>
                  <Cell className="num whitespace-nowrap text-xs text-ink-400">
                    {formatDateTime(run.startedAt)}
                  </Cell>
                </Row>
              );
            })
          )}
        </DataTable>
      </section>

      {/* Configuration — the form brings its own sub-sections. */}
      <section>
        <SectionTitle hint="Switches, credentials, guardrails and the copy the agents send.">
          Configuration
        </SectionTitle>
        <AgentConfigForm config={config} secretsSet={secretsSet} />
      </section>

      <ModelRoutingForm jobs={AI_JOBS} models={jobModels} globalModel={appConfig.aiModel} />

      <Card>
        <SectionTitle hint="One-time wiring, in order. Steps 1 and 2 happen in AWS.">
          Wiring checklist
        </SectionTitle>
        <ol className="space-y-3">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-700">
              <span className="num grid size-5 shrink-0 place-items-center rounded-md bg-ink-100 text-[11px] font-semibold text-ink-600">
                {i + 1}
              </span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
