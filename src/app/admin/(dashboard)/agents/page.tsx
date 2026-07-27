import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
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
import { dailySendCap, sentToday } from "@/lib/agents/mailer";
import { queueDepth } from "@/lib/agents/queue";
import { absoluteUrl } from "@/lib/site";
import {
  AgentConfigForm,
  QueueJobForm,
  TestSesForm,
  TickButton,
} from "@/components/admin/AgentConsole";

export const dynamic = "force-dynamic";

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
  { agent: "conversationalist", kind: "tick", label: "Conversationalist — run follow-ups" },
  { agent: "conversationalist", kind: "flush_approved", label: "Conversationalist — send approved" },
  { agent: "visibility", kind: "weekly", label: "Visibility — full weekly cycle" },
  { agent: "visibility", kind: "rank_check", label: "Visibility — check rankings" },
  { agent: "visibility", kind: "draft_article", label: "Visibility — draft an article" },
  { agent: "visibility", kind: "find_mentions", label: "Visibility — find link targets" },
  { agent: "analyst", kind: "weekly_report", label: "Analyst — generate the weekly report" },
];

export default async function AgentsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const config = await getAgentConfig();
  const readiness = agentReadiness(config);

  const [depth, runs, counts, cap, used] = await Promise.all([
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
  ]);

  const [pendingApproval, prospectCount, draftCount, suppressionCount, targetCount] =
    counts.map((c) => Number(c[0]?.n ?? 0));

  const secretsSet = Object.fromEntries(
    AGENT_SECRET_FIELDS.map((field) => [field, !!config[field]]),
  ) as Record<string, boolean>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Growth agents</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Four agents share one queue: the Prospector finds businesses, the
            Conversationalist emails them, Visibility earns rankings, the Analyst reports
            weekly. Nothing runs until the master switch is on and the agent has what it
            needs.
          </p>
        </div>
        <TickButton />
      </header>

      {/* Agent status */}
      <div className="grid gap-4 sm:grid-cols-2">
        {AGENT_META.map((agent) => {
          const state = readiness[agent.key];
          return (
            <div key={agent.key} className="rounded-xl border border-ink-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-ink-900">{agent.name}</h2>
                  <p className="mt-1 text-xs text-ink-500">{agent.role}</p>
                </div>
                <span
                  className={`num rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    state.enabled && state.ready
                      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                      : state.enabled
                        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                        : "bg-ink-100 text-ink-500"
                  }`}
                >
                  {state.enabled && state.ready ? "running" : state.enabled ? "blocked" : "off"}
                </span>
              </div>
              {state.enabled && state.missing.length > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Needs: {state.missing.join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Live numbers */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Queued", value: depth.queued ?? 0 },
          { label: "Running", value: depth.running ?? 0 },
          { label: "Failed", value: depth.failed ?? 0 },
          { label: "Sent today", value: `${used}/${cap}` },
          { label: "Prospects", value: prospectCount },
          { label: "Suppressed", value: suppressionCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-ink-200 bg-white p-4">
            <p className="num text-2xl font-semibold text-ink-900">{stat.value}</p>
            <p className="num mt-1 text-[10px] uppercase tracking-[0.12em] text-ink-500">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Work waiting on a human */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/agents/approvals"
          className="card-hover rounded-xl border border-ink-200 bg-white p-5 transition-transform hover:border-ink-900"
        >
          <p className="num text-2xl font-semibold text-ink-900">{pendingApproval}</p>
          <p className="mt-1 text-sm font-semibold text-ink-800">Emails awaiting approval</p>
          <p className="mt-1 text-xs text-ink-500">Read, edit and send — or reject.</p>
        </Link>
        <Link
          href="/admin/agents/content"
          className="card-hover rounded-xl border border-ink-200 bg-white p-5 transition-transform hover:border-ink-900"
        >
          <p className="num text-2xl font-semibold text-ink-900">{draftCount}</p>
          <p className="mt-1 text-sm font-semibold text-ink-800">Article drafts</p>
          <p className="mt-1 text-xs text-ink-500">Publish to /insights once you agree with them.</p>
        </Link>
        <Link
          href="/admin/agents/visibility"
          className="card-hover rounded-xl border border-ink-200 bg-white p-5 transition-transform hover:border-ink-900"
        >
          <p className="num text-2xl font-semibold text-ink-900">{targetCount}</p>
          <p className="mt-1 text-sm font-semibold text-ink-800">Link & citation targets</p>
          <p className="mt-1 text-xs text-ink-500">Sites worth a listing or a pitch.</p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-ink-200 bg-white p-5">
          <QueueJobForm jobs={MANUAL_JOBS} />
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-5">
          <TestSesForm defaultTo={session.user.email ?? ""} />
        </div>
      </div>

      {/* Run log */}
      <section className="rounded-xl border border-ink-200 bg-white">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
          <h2 className="num text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Recent runs
          </h2>
          <Link href="/admin/reports" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
            Weekly reports →
          </Link>
        </div>
        <div className="divide-y divide-ink-100">
          {runs.length === 0 && (
            <p className="px-5 py-6 text-sm text-ink-500">
              Nothing has run yet. Turn the master switch on, then press “Run agents now”.
            </p>
          )}
          {runs.map((run) => (
            <div key={run.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <span
                className={`num rounded px-1.5 py-0.5 text-[10px] uppercase ${
                  run.status === "success"
                    ? "bg-brand-50 text-brand-700"
                    : run.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : "bg-ink-100 text-ink-600"
                }`}
              >
                {run.status}
              </span>
              <span className="font-medium text-ink-800">
                {run.agent}/{run.kind}
              </span>
              <span className="num text-xs text-ink-500">
                in {run.itemsIn} · out {run.itemsOut}
                {run.aiTokens > 0 ? ` · ${run.aiTokens} tokens` : ""}
              </span>
              <span className="num ms-auto text-xs text-ink-400">
                {new Date(run.startedAt).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })}
              </span>
              {run.error && (
                <p className="w-full text-xs text-red-600">{run.error.slice(0, 200)}</p>
              )}
              {!run.error && (run.summary as { logs?: string[] })?.logs?.length ? (
                <p className="w-full text-xs text-ink-500">
                  {((run.summary as { logs?: string[] }).logs ?? []).join(" · ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <AgentConfigForm config={config} secretsSet={secretsSet} />

      <section className="rounded-xl border border-ink-200 bg-paper-dark p-5">
        <h2 className="num text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Wiring checklist
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-ink-700">
          <li>
            1. In AWS SES, verify the sending domain (DKIM) and request production access —
            sandbox mode only sends to verified addresses.
          </li>
          <li>
            2. Point an SNS topic at{" "}
            <code className="num text-xs">{absoluteUrl("/api/outreach/sns")}</code> for bounces,
            complaints and inbound replies. The endpoint self-confirms the subscription.
          </li>
          <li>
            3. Nothing to schedule — the app beats its own clock every five minutes and
            refreshes the provider directory nightly. Adding GitHub secrets{" "}
            <code className="num text-xs">AGENT_TICK_URL</code> and{" "}
            <code className="num text-xs">INGEST_SECRET</code> adds a redundant external tick.
          </li>
          <li>4. Fill in the offer copy below — the agent will not invent a sender identity.</li>
          <li>5. Start in manual approval mode and read the first twenty emails yourself.</li>
        </ol>
      </section>
    </div>
  );
}
