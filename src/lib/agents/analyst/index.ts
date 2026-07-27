import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agentReports,
  agentRuns,
  analyticsEvents,
  articles,
  leads,
  outreachMessages,
  outreachThreads,
  prospects,
  seoKeywords,
  visibilityTargets,
} from "@/db/schema";
import { chat } from "@/lib/ai/chat";
import { getAdminAlertEmail, sendEmail } from "@/lib/email";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getAgentConfig } from "../config";
import { dubaiDayStart } from "../mailer";
import { enqueue } from "../queue";
import type { AgentHandler } from "../types";

/**
 * Agent 4 — Analyst.
 *
 * Once a week: pull every number the system produced, compare it with the week
 * before, have the model explain what changed and what to do about it, then
 * store and email the result. Recommendations come back as structured items so
 * the console can queue them straight into the other three agents.
 */

export interface WeeklyMetrics {
  traffic: { pageviews: number; visitors: number; sessions: number };
  funnel: { leads: number; quizLeads: number; agentLeads: number; conversionRate: number };
  outreach: {
    sent: number;
    replies: number;
    replyRate: number;
    unsubscribes: number;
    bounces: number;
    converted: number;
    pendingApproval: number;
  };
  prospecting: { discovered: number; contactable: number; sequenced: number };
  seo: {
    keywordsTracked: number;
    keywordsTop10: number;
    averagePosition: number | null;
    openGaps: number;
    draftArticles: number;
    publishedArticles: number;
    linkTargetsOpen: number;
  };
  topPages: { path: string; views: number }[];
  agentActivity: { agent: string; runs: number; failures: number; tokens: number }[];
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

async function countRows(
  table: Parameters<typeof db.select>[0] extends never ? never : never,
): Promise<number> {
  return 0;
}
void countRows;

export async function collectMetrics(from: Date, to: Date): Promise<WeeklyMetrics> {
  const within = (col: typeof analyticsEvents.createdAt) =>
    and(gte(col, from), lt(col, to));

  const [traffic] = await db
    .select({
      pageviews: sql<string>`count(*) FILTER (WHERE type = 'pageview')`,
      visitors: sql<string>`count(DISTINCT visitor_id)`,
      sessions: sql<string>`count(DISTINCT session_id)`,
    })
    .from(analyticsEvents)
    .where(within(analyticsEvents.createdAt));

  const [leadCounts] = await db
    .select({
      total: sql<string>`count(*)`,
      quiz: sql<string>`count(*) FILTER (WHERE source = 'quiz')`,
      agent: sql<string>`count(*) FILTER (WHERE source = 'agent-outreach')`,
    })
    .from(leads)
    .where(and(gte(leads.createdAt, from), lt(leads.createdAt, to)));

  const [outreachCounts] = await db
    .select({
      sent: sql<string>`count(*) FILTER (WHERE direction = 'outbound' AND status = 'sent')`,
      replies: sql<string>`count(*) FILTER (WHERE direction = 'inbound')`,
      pending: sql<string>`count(*) FILTER (WHERE status = 'pending_approval')`,
    })
    .from(outreachMessages)
    .where(and(gte(outreachMessages.createdAt, from), lt(outreachMessages.createdAt, to)));

  const [threadCounts] = await db
    .select({
      unsubscribed: sql<string>`count(*) FILTER (WHERE status = 'unsubscribed')`,
      bounced: sql<string>`count(*) FILTER (WHERE status = 'bounced')`,
      converted: sql<string>`count(*) FILTER (WHERE status = 'converted')`,
    })
    .from(outreachThreads)
    .where(and(gte(outreachThreads.updatedAt, from), lt(outreachThreads.updatedAt, to)));

  const [prospectCounts] = await db
    .select({
      discovered: sql<string>`count(*)`,
      contactable: sql<string>`count(*) FILTER (WHERE status = 'contactable')`,
      sequenced: sql<string>`count(*) FILTER (WHERE status IN ('sequenced','replied','converted'))`,
    })
    .from(prospects)
    .where(and(gte(prospects.createdAt, from), lt(prospects.createdAt, to)));

  const [keywordStats] = await db
    .select({
      tracked: sql<string>`count(*)`,
      top10: sql<string>`count(*) FILTER (WHERE last_position IS NOT NULL AND last_position <= 10)`,
      avgPosition: sql<string | null>`round(avg(last_position) FILTER (WHERE last_position IS NOT NULL), 1)`,
      gaps: sql<string>`count(*) FILTER (WHERE has_gap)`,
    })
    .from(seoKeywords);

  const [articleStats] = await db
    .select({
      drafts: sql<string>`count(*) FILTER (WHERE status = 'draft')`,
      published: sql<string>`count(*) FILTER (WHERE status = 'published')`,
    })
    .from(articles);

  const [linkStats] = await db
    .select({
      open: sql<string>`count(*) FILTER (WHERE status IN ('discovered','drafted'))`,
    })
    .from(visibilityTargets);

  const topPages = await db
    .select({ path: analyticsEvents.path, views: sql<string>`count(*)` })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.type, "pageview"), within(analyticsEvents.createdAt)))
    .groupBy(analyticsEvents.path)
    .orderBy(sql`count(*) DESC`)
    .limit(8);

  const agentActivity = await db
    .select({
      agent: agentRuns.agent,
      runs: sql<string>`count(*)`,
      failures: sql<string>`count(*) FILTER (WHERE status = 'failed')`,
      tokens: sql<string>`coalesce(sum(ai_tokens), 0)`,
    })
    .from(agentRuns)
    .where(and(gte(agentRuns.startedAt, from), lt(agentRuns.startedAt, to)))
    .groupBy(agentRuns.agent);

  const sent = Number(outreachCounts?.sent ?? 0);
  const replies = Number(outreachCounts?.replies ?? 0);
  const sessions = Number(traffic?.sessions ?? 0);
  const totalLeads = Number(leadCounts?.total ?? 0);

  return {
    traffic: {
      pageviews: Number(traffic?.pageviews ?? 0),
      visitors: Number(traffic?.visitors ?? 0),
      sessions,
    },
    funnel: {
      leads: totalLeads,
      quizLeads: Number(leadCounts?.quiz ?? 0),
      agentLeads: Number(leadCounts?.agent ?? 0),
      conversionRate: pct(totalLeads, sessions),
    },
    outreach: {
      sent,
      replies,
      replyRate: pct(replies, sent),
      unsubscribes: Number(threadCounts?.unsubscribed ?? 0),
      bounces: Number(threadCounts?.bounced ?? 0),
      converted: Number(threadCounts?.converted ?? 0),
      pendingApproval: Number(outreachCounts?.pending ?? 0),
    },
    prospecting: {
      discovered: Number(prospectCounts?.discovered ?? 0),
      contactable: Number(prospectCounts?.contactable ?? 0),
      sequenced: Number(prospectCounts?.sequenced ?? 0),
    },
    seo: {
      keywordsTracked: Number(keywordStats?.tracked ?? 0),
      keywordsTop10: Number(keywordStats?.top10 ?? 0),
      averagePosition: keywordStats?.avgPosition ? Number(keywordStats.avgPosition) : null,
      openGaps: Number(keywordStats?.gaps ?? 0),
      draftArticles: Number(articleStats?.drafts ?? 0),
      publishedArticles: Number(articleStats?.published ?? 0),
      linkTargetsOpen: Number(linkStats?.open ?? 0),
    },
    topPages: topPages.map((p) => ({ path: p.path, views: Number(p.views) })),
    agentActivity: agentActivity.map((a) => ({
      agent: a.agent,
      runs: Number(a.runs),
      failures: Number(a.failures),
      tokens: Number(a.tokens),
    })),
  };
}

const REPORT_SYSTEM = `You are the growth analyst for ${SITE_NAME} (uaeasp.ae), an independent UAE directory of Ministry of Finance accredited e-invoicing service providers. The business makes money by matching UAE businesses to providers, so leads are the outcome that matters.

You are given this week's metrics and last week's for comparison.

Write a report in markdown with exactly these sections:
## What happened
3-5 sentences. Lead with the number that matters most. Quantify every change (absolute and %). Say plainly if a number moved because of low volume rather than a real trend.
## What is working
2-4 bullets, each citing a number.
## What is not working
2-4 bullets, each citing a number. Be blunt. If nothing is broken, say the constraint is volume and name it.
## Do this week
3-5 specific, ordered actions. Each must be something the site owner or an agent can actually execute this week.

Rules:
- Never invent numbers not present in the data. If something is zero or missing, say so.
- No filler, no congratulation, no "as an AI". British English.
- Small numbers deserve caution: with under 100 sessions or under 20 emails, call percentages indicative, not conclusive.

After the markdown, output a line containing only ---JSON--- followed by:
{"recommendations":[{"title":"...","why":"...","agent":"prospector|conversationalist|visibility|analyst|human","action":"one concrete step"}]}`;

function formatMetrics(label: string, m: WeeklyMetrics): string {
  return [
    `${label}:`,
    `  Traffic: ${m.traffic.pageviews} pageviews, ${m.traffic.visitors} visitors, ${m.traffic.sessions} sessions`,
    `  Leads: ${m.funnel.leads} total (${m.funnel.agentLeads} from outreach, ${m.funnel.quizLeads} from quiz), ${m.funnel.conversionRate}% of sessions`,
    `  Outreach: ${m.outreach.sent} sent, ${m.outreach.replies} replies (${m.outreach.replyRate}%), ${m.outreach.converted} converted, ${m.outreach.unsubscribes} unsubscribes, ${m.outreach.bounces} bounces, ${m.outreach.pendingApproval} awaiting approval`,
    `  Prospecting: ${m.prospecting.discovered} discovered, ${m.prospecting.contactable} contactable, ${m.prospecting.sequenced} sequenced`,
    `  SEO: ${m.seo.keywordsTracked} keywords tracked, ${m.seo.keywordsTop10} in top 10, avg position ${m.seo.averagePosition ?? "unknown"}, ${m.seo.openGaps} content gaps, ${m.seo.draftArticles} drafts awaiting approval, ${m.seo.publishedArticles} published, ${m.seo.linkTargetsOpen} link targets open`,
    `  Top pages: ${m.topPages.map((p) => `${p.path} (${p.views})`).join(", ") || "none"}`,
    `  Agent runs: ${m.agentActivity.map((a) => `${a.agent} ${a.runs} runs/${a.failures} failed`).join(", ") || "none"}`,
  ].join("\n");
}

export interface Recommendation {
  title: string;
  why: string;
  agent: string;
  action: string;
}

/** Build, store and email the weekly report. */
export const weeklyReport: AgentHandler = async (task, ctx) => {
  const config = await getAgentConfig();
  const payload = task.payload as { periodEnd?: string };
  const end = payload.periodEnd ? new Date(payload.periodEnd) : dubaiDayStart();
  const start = new Date(end.getTime() - 7 * 86_400_000);
  const prevStart = new Date(start.getTime() - 7 * 86_400_000);

  const [current, previous] = await Promise.all([
    collectMetrics(start, end),
    collectMetrics(prevStart, start),
  ]);

  let narrative = "";
  let recommendations: Recommendation[] = [];

  const result = await chat(
    [
      { role: "system", content: REPORT_SYSTEM },
      {
        role: "user",
        content: `${formatMetrics("This week", current)}\n\n${formatMetrics("Previous week", previous)}`,
      },
    ],
    { temperature: 0.2, maxTokens: 2000, job: "report" },
  );
  if (result) {
    ctx.addTokens(result.totalTokens, result.model);
    const [markdown, jsonPart] = result.text.split("---JSON---");
    narrative = markdown.trim();
    if (jsonPart) {
      try {
        const parsed = JSON.parse(jsonPart.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
          recommendations?: Recommendation[];
        };
        recommendations = parsed.recommendations ?? [];
      } catch {
        recommendations = [];
      }
    }
  } else {
    narrative = fallbackNarrative(current, previous);
  }

  const [report] = await db
    .insert(agentReports)
    .values({
      kind: "weekly",
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
      metrics: { current, previous } as unknown as Record<string, unknown>,
      narrativeMd: narrative,
      recommendations,
    })
    .onConflictDoUpdate({
      target: [agentReports.kind, agentReports.periodStart],
      set: {
        metrics: { current, previous } as unknown as Record<string, unknown>,
        narrativeMd: narrative,
        recommendations,
      },
    })
    .returning({ id: agentReports.id });

  const recipients = config.reportRecipients
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const to = recipients.length ? recipients : await getAdminAlertEmail();
  if (to.length) {
    const html = renderReportHtml(current, previous, narrative, recommendations, report.id);
    await sendEmail({
      to,
      subject: `Weekly growth report — ${current.funnel.leads} leads, ${current.traffic.visitors} visitors`,
      text: `${narrative}\n\nFull report: ${absoluteUrl(`/admin/reports/${report.id}`)}`,
      html,
    });
    await db
      .update(agentReports)
      .set({ emailedAt: new Date() })
      .where(eq(agentReports.id, report.id));
  }

  // Schedule next week's run.
  await enqueue({
    agent: "analyst",
    kind: "weekly_report",
    payload: { periodEnd: new Date(end.getTime() + 7 * 86_400_000).toISOString() },
    runAfter: new Date(end.getTime() + 7 * 86_400_000),
    dedupeKey: `weekly:${new Date(end.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)}`,
  });

  ctx.log(`weekly report generated for ${start.toDateString()} – ${end.toDateString()}`);
  return {
    itemsIn: 1,
    itemsOut: 1,
    summary: { reportId: report.id, recommendations: recommendations.length },
  };
};

function delta(now: number, before: number): string {
  if (before === 0) return now === 0 ? "no change" : `up from 0 to ${now}`;
  const change = Math.round(((now - before) / before) * 1000) / 10;
  return `${change >= 0 ? "+" : ""}${change}% (${before} → ${now})`;
}

function fallbackNarrative(current: WeeklyMetrics, previous: WeeklyMetrics): string {
  return [
    "## What happened",
    `Leads: ${delta(current.funnel.leads, previous.funnel.leads)}. Visitors: ${delta(current.traffic.visitors, previous.traffic.visitors)}. Outreach emails sent: ${delta(current.outreach.sent, previous.outreach.sent)} with ${current.outreach.replies} replies.`,
    "",
    "## What is working",
    `- ${current.prospecting.contactable} prospects became contactable this week.`,
    `- ${current.seo.keywordsTop10} of ${current.seo.keywordsTracked} tracked keywords sit in the top 10.`,
    "",
    "## What is not working",
    `- ${current.outreach.pendingApproval} messages are waiting for approval and cannot send until reviewed.`,
    `- ${current.seo.openGaps} keyword gaps still have no page.`,
    "",
    "## Do this week",
    "1. Clear the approval queue in /admin/agents/approvals.",
    "2. Approve or reject the drafted articles so they can publish.",
    "3. Review the prospect list for anything the scoring got wrong.",
    "",
    "_(AI narrative unavailable — this is the fallback summary.)_",
  ].join("\n");
}

function renderReportHtml(
  current: WeeklyMetrics,
  previous: WeeklyMetrics,
  narrative: string,
  recommendations: Recommendation[],
  reportId: string,
): string {
  const stat = (label: string, value: string | number, before: number) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:ui-monospace,monospace;text-align:right"><strong>${value}</strong> <span style="color:#64748b;font-size:12px">${delta(Number(value), before)}</span></td></tr>`;

  const body = narrative
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;margin:20px 0 8px;color:#0f172a">$1</h2>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:4px 0">$2</li>')
    .replace(/\n{2,}/g, "<br><br>");

  return `<div style="font:15px/1.6 -apple-system,Segoe UI,sans-serif;color:#0f172a;max-width:640px">
    <h1 style="font-size:20px;margin:0 0 4px">Weekly growth report</h1>
    <p style="color:#64748b;margin:0 0 20px;font-size:13px">${SITE_NAME}</p>
    <table style="width:100%;border-collapse:collapse;background:#faf8f3;border:1px solid #e2e8f0;border-radius:8px">
      ${stat("Leads", current.funnel.leads, previous.funnel.leads)}
      ${stat("Visitors", current.traffic.visitors, previous.traffic.visitors)}
      ${stat("Outreach sent", current.outreach.sent, previous.outreach.sent)}
      ${stat("Replies", current.outreach.replies, previous.outreach.replies)}
      ${stat("Prospects discovered", current.prospecting.discovered, previous.prospecting.discovered)}
      ${stat("Keywords in top 10", current.seo.keywordsTop10, previous.seo.keywordsTop10)}
    </table>
    <div style="margin-top:24px">${body}</div>
    ${
      recommendations.length
        ? `<h2 style="font-size:15px;margin:24px 0 8px">Queued recommendations</h2><ul style="padding-left:18px">${recommendations
            .map(
              (r) =>
                `<li style="margin:6px 0"><strong>${r.title}</strong> <span style="color:#64748b">(${r.agent})</span><br><span style="color:#475569;font-size:14px">${r.action}</span></li>`,
            )
            .join("")}</ul>`
        : ""
    }
    <p style="margin-top:24px"><a href="${absoluteUrl(`/admin/reports/${reportId}`)}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open the full report</a></p>
  </div>`;
}

export const analystHandlers: Record<string, AgentHandler> = {
  weekly_report: weeklyReport,
};
