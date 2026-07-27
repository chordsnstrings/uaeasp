import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentReports } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { WeeklyMetrics, Recommendation } from "@/lib/agents/analyst";

export const dynamic = "force-dynamic";

function delta(now: number, before: number): { text: string; positive: boolean } {
  if (before === 0) {
    return { text: now === 0 ? "—" : `new`, positive: now > 0 };
  }
  const change = Math.round(((now - before) / before) * 1000) / 10;
  return { text: `${change >= 0 ? "+" : ""}${change}%`, positive: change >= 0 };
}

/** Minimal markdown rendering: headings, bullets, ordered lists, paragraphs. */
function renderMarkdown(md: string): React.ReactNode {
  const blocks = md.split("\n");
  return blocks.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={i} className="mt-6 font-display text-lg font-semibold text-ink-900">
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (/^[-*] /.test(trimmed)) {
      return (
        <p key={i} className="mt-1.5 ps-5 text-sm leading-relaxed text-ink-700">
          <span className="text-brand-600">—</span> {trimmed.slice(2)}
        </p>
      );
    }
    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <p key={i} className="num mt-1.5 ps-5 text-sm leading-relaxed text-ink-700">
          {trimmed}
        </p>
      );
    }
    return (
      <p key={i} className="mt-2 text-sm leading-relaxed text-ink-700">
        {trimmed.replace(/^_|_$/g, "")}
      </p>
    );
  });
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");
  const { id } = await params;

  const [report] = await db
    .select()
    .from(agentReports)
    .where(eq(agentReports.id, id))
    .limit(1);
  if (!report) notFound();

  const metrics = report.metrics as { current: WeeklyMetrics; previous: WeeklyMetrics };
  const recommendations = (report.recommendations ?? []) as Recommendation[];
  const { current, previous } = metrics;

  const stats = [
    { label: "Leads", now: current.funnel.leads, before: previous.funnel.leads },
    { label: "Visitors", now: current.traffic.visitors, before: previous.traffic.visitors },
    { label: "Pageviews", now: current.traffic.pageviews, before: previous.traffic.pageviews },
    { label: "Emails sent", now: current.outreach.sent, before: previous.outreach.sent },
    { label: "Replies", now: current.outreach.replies, before: previous.outreach.replies },
    {
      label: "Prospects found",
      now: current.prospecting.discovered,
      before: previous.prospecting.discovered,
    },
    { label: "Keywords top 10", now: current.seo.keywordsTop10, before: previous.seo.keywordsTop10 },
    { label: "Unsubscribes", now: current.outreach.unsubscribes, before: previous.outreach.unsubscribes },
  ];

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/reports" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
          ← Reports
        </Link>
        <h1 className="num mt-2 text-2xl font-bold text-ink-900">
          {report.periodStart} → {report.periodEnd}
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map((stat) => {
          const d = delta(stat.now, stat.before);
          return (
            <div key={stat.label} className="rounded-xl border border-ink-200 bg-white p-4">
              <p className="num text-2xl font-semibold text-ink-900">{stat.now}</p>
              <p className="num mt-1 text-[10px] uppercase tracking-[0.12em] text-ink-500">
                {stat.label}
              </p>
              <p
                className={`num mt-1 text-xs ${
                  d.positive ? "text-brand-700" : "text-red-600"
                }`}
              >
                {d.text} <span className="text-ink-400">vs {stat.before}</span>
              </p>
            </div>
          );
        })}
      </div>

      <article className="rounded-xl border border-ink-200 bg-white p-6">
        {report.narrativeMd ? (
          renderMarkdown(report.narrativeMd)
        ) : (
          <p className="text-sm text-ink-500">No narrative was generated for this period.</p>
        )}
      </article>

      {recommendations.length > 0 && (
        <section className="rounded-xl border border-ink-200 bg-white p-6">
          <h2 className="num text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Recommendations
          </h2>
          <ul className="mt-4 space-y-4">
            {recommendations.map((rec, i) => (
              <li key={i} className="border-s-2 border-brand-300 ps-4">
                <p className="font-semibold text-ink-900">{rec.title}</p>
                <p className="mt-1 text-sm text-ink-600">{rec.why}</p>
                <p className="mt-1.5 text-sm text-ink-800">
                  <span className="num text-[10px] uppercase tracking-wide text-brand-700">
                    {rec.agent}
                  </span>{" "}
                  {rec.action}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {current.topPages.length > 0 && (
        <section className="rounded-xl border border-ink-200 bg-white p-6">
          <h2 className="num text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Top pages
          </h2>
          <ul className="mt-3 space-y-1.5">
            {current.topPages.map((page) => (
              <li key={page.path} className="flex justify-between gap-4 text-sm">
                <span className="num truncate text-ink-700" dir="ltr">
                  {page.path}
                </span>
                <span className="num font-semibold text-ink-900">{page.views}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
