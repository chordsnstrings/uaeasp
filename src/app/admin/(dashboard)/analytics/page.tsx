import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

const DAYS = 30;

interface DailyRow {
  day: string;
  pageviews: number;
  sessions: number;
  visitors: number;
}

interface CountRow {
  key: string;
  count: number;
}

interface FunnelRow {
  sessions: number;
  engaged: number;
  reached: number;
  converted: number;
}

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(query);
  return res.rows as T[];
}

function TopList({ title, data, empty, hint }: { title: string; data: CountRow[]; empty: string; hint?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">{title}</h2>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.map((d) => (
            <li key={d.key} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-ink-800" dir="ltr">
                  {d.key}
                </span>
                <span className="shrink-0 tabular-nums text-ink-500">{d.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-50">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AnalyticsPage() {
  const since = sql`now() - interval '${sql.raw(String(DAYS))} days'`;
  // Older rows predate the visitor hash — fall back to the session id so
  // history still counts.
  const visitorExpr = sql.raw("coalesce(visitor_id, session_id)");

  const [daily, topPages, entryPages, exitPages, transitions, topReferrers, topUtm, devices, locales, events, funnels, totals] =
    await Promise.all([
      rows<DailyRow>(sql`
        SELECT to_char(created_at AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD') AS day,
               count(*) FILTER (WHERE type = 'pageview')::int AS pageviews,
               count(DISTINCT session_id)::int AS sessions,
               count(DISTINCT ${visitorExpr})::int AS visitors
        FROM analytics_events WHERE created_at > ${since}
        GROUP BY 1 ORDER BY 1`),
      rows<CountRow>(sql`
        SELECT path AS key, count(*)::int AS count
        FROM analytics_events WHERE type = 'pageview' AND created_at > ${since}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      rows<CountRow>(sql`
        SELECT path AS key, count(*)::int AS count FROM (
          SELECT DISTINCT ON (session_id) session_id, path
          FROM analytics_events
          WHERE type = 'pageview' AND created_at > ${since}
          ORDER BY session_id, created_at ASC
        ) firsts GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      rows<CountRow>(sql`
        SELECT path AS key, count(*)::int AS count FROM (
          SELECT DISTINCT ON (session_id) session_id, path
          FROM analytics_events
          WHERE type = 'pageview' AND created_at > ${since}
          ORDER BY session_id, created_at DESC
        ) lasts GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      rows<CountRow>(sql`
        WITH ordered AS (
          SELECT session_id, path,
                 lead(path) OVER (PARTITION BY session_id ORDER BY created_at) AS next_path
          FROM analytics_events
          WHERE type = 'pageview' AND created_at > ${since}
        )
        SELECT path || '  →  ' || next_path AS key, count(*)::int AS count
        FROM ordered
        WHERE next_path IS NOT NULL AND next_path <> path
        GROUP BY 1 ORDER BY 2 DESC LIMIT 12`),
      rows<CountRow>(sql`
        SELECT referrer_host AS key, count(DISTINCT session_id)::int AS count
        FROM analytics_events WHERE referrer_host IS NOT NULL AND created_at > ${since}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      rows<CountRow>(sql`
        SELECT utm_source AS key, count(DISTINCT session_id)::int AS count
        FROM analytics_events WHERE utm_source IS NOT NULL AND created_at > ${since}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      rows<CountRow>(sql`
        SELECT device AS key, count(DISTINCT session_id)::int AS count
        FROM analytics_events WHERE device IS NOT NULL AND created_at > ${since}
        GROUP BY 1 ORDER BY 2 DESC`),
      rows<CountRow>(sql`
        SELECT locale AS key, count(DISTINCT session_id)::int AS count
        FROM analytics_events WHERE locale IS NOT NULL AND created_at > ${since}
        GROUP BY 1 ORDER BY 2 DESC`),
      rows<CountRow>(sql`
        SELECT name AS key, count(*)::int AS count
        FROM analytics_events WHERE type = 'event' AND created_at > ${since}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      rows<FunnelRow>(sql`
        WITH per_session AS (
          SELECT session_id,
                 count(DISTINCT path) FILTER (WHERE type = 'pageview') AS distinct_pages,
                 bool_or(type = 'pageview' AND (path LIKE '%/get-matched%' OR path LIKE '%/assessment%')) AS reached,
                 bool_or(type = 'event' AND name IN ('lead_submitted','quiz_completed')) AS converted
          FROM analytics_events WHERE created_at > ${since}
          GROUP BY session_id
        )
        SELECT count(*)::int AS sessions,
               count(*) FILTER (WHERE distinct_pages >= 2)::int AS engaged,
               count(*) FILTER (WHERE reached)::int AS reached,
               count(*) FILTER (WHERE converted)::int AS converted
        FROM per_session`),
      // The visitor hash rotates daily by design, so a cross-window distinct
      // would count visitor-DAYS. Honest headline: average daily uniques.
      rows<{ avgDailyVisitors: number; sessions: number; pageviews: number; converting: number }>(sql`
        WITH daily_uniques AS (
          SELECT to_char(created_at AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD') AS day,
                 count(DISTINCT ${visitorExpr}) AS uniques
          FROM analytics_events WHERE created_at > ${since}
          GROUP BY 1
        )
        SELECT coalesce((SELECT round(avg(uniques))::int FROM daily_uniques), 0) AS "avgDailyVisitors",
               count(DISTINCT session_id)::int AS sessions,
               count(*) FILTER (WHERE type = 'pageview')::int AS pageviews,
               count(DISTINCT session_id) FILTER (WHERE type = 'event' AND name IN ('lead_submitted','quiz_completed'))::int AS converting
        FROM analytics_events WHERE created_at > ${since}`),
    ]);

  const t = totals[0] ?? { avgDailyVisitors: 0, sessions: 0, pageviews: 0, converting: 0 };
  const f = funnels[0] ?? { sessions: 0, engaged: 0, reached: 0, converted: 0 };
  const convRate = t.sessions > 0 ? ((t.converting / t.sessions) * 100).toFixed(1) : "0.0";
  const viewsPerVisit = t.sessions > 0 ? (t.pageviews / t.sessions).toFixed(1) : "0.0";
  const maxDaily = Math.max(1, ...daily.map((d) => d.pageviews));

  const funnelSteps = [
    { label: "Visits", value: f.sessions, note: "unique browsing sessions" },
    { label: "Engaged (2+ pages)", value: f.engaged, note: "kept browsing past the first page" },
    { label: "Reached a lead page", value: f.reached, note: "viewed get-matched or the assessment" },
    { label: "Converted", value: f.converted, note: "submitted the form or completed the quiz" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Analytics</h1>
        <p className="mt-1 text-sm text-ink-500">
          First-party, cookieless measurement — last {DAYS} days, stored in your own database.
          Visitors are counted per day via a salted daily hash of IP + browser; no IP is ever
          stored, and by design the same person cannot be tracked across days. Bots and admin
          pages are excluded, and abusive traffic is rate-limited.
        </p>
      </div>

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-5">
        {[
          { label: "Daily visitors (avg)", value: t.avgDailyVisitors },
          { label: "Visits (sessions)", value: t.sessions },
          { label: "Pageviews", value: t.pageviews },
          { label: "Pages / visit", value: viewsPerVisit },
          { label: "Conversion rate", value: `${convRate}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-ink-100 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {s.label}
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Conversion funnel */}
      <section className="rounded-2xl border border-ink-100 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
          Conversion funnel
        </h2>
        <p className="mt-1 text-xs text-ink-400">
          Where visits drop off between landing and becoming a lead.
        </p>
        <div className="mt-4 space-y-3">
          {funnelSteps.map((step, i) => {
            const pctOfAll = f.sessions > 0 ? (step.value / f.sessions) * 100 : 0;
            const prev = i === 0 ? step.value : funnelSteps[i - 1].value;
            const stepRate = i === 0 ? null : prev > 0 ? ((step.value / prev) * 100).toFixed(0) : "0";
            return (
              <div key={step.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink-800">{step.label}</span>
                  <span className="tabular-nums text-ink-500">
                    {step.value}
                    {stepRate !== null && (
                      <span className="ms-2 text-xs text-ink-400">({stepRate}% of previous)</span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-6 overflow-hidden rounded-lg bg-ink-50">
                  <div
                    className={`flex h-full items-center rounded-lg px-2 text-[11px] font-semibold text-white ${
                      i === funnelSteps.length - 1 ? "bg-accent-500 text-ink-950" : "bg-brand-600"
                    }`}
                    style={{ width: `${Math.max(pctOfAll, step.value > 0 ? 4 : 0)}%` }}
                  >
                    {pctOfAll >= 12 ? `${pctOfAll.toFixed(0)}%` : ""}
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-ink-400">{step.note}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Daily chart */}
      <section className="rounded-2xl border border-ink-100 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
          Daily traffic
        </h2>
        {daily.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">
            No data yet — it starts collecting from the first visit after this deploys.
          </p>
        ) : (
          <>
            <div className="mt-4 flex h-40 items-end gap-1">
              {daily.map((d) => (
                <div key={d.day} className="group relative flex flex-1 flex-col justify-end">
                  <div
                    className="w-full rounded-t bg-brand-200"
                    style={{ height: `${Math.max(2, (d.pageviews / maxDaily) * 152)}px` }}
                  />
                  <div
                    className="absolute bottom-0 w-full rounded-t bg-brand-600"
                    style={{ height: `${Math.max(2, (d.visitors / maxDaily) * 152)}px` }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2 py-1 text-[11px] font-medium text-white group-hover:block">
                    {d.day}: {d.visitors} visitors · {d.sessions} visits · {d.pageviews} views
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-ink-500">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-600" /> Unique visitors
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-200" /> Pageviews
              </span>
            </div>
          </>
        )}
      </section>

      {/* Flow */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopList
          title="Entry pages"
          data={entryPages}
          empty="No data yet."
          hint="The first page of each visit — what search engines and links land people on."
        />
        <TopList
          title="Exit pages"
          data={exitPages}
          empty="No data yet."
          hint="The last page of each visit — where people leave."
        />
      </div>
      <TopList
        title="Page flow — most common steps"
        data={transitions}
        empty="Flows appear once visits span more than one page."
        hint="How visitors move page-to-page within a visit."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TopList title="Top pages" data={topPages} empty="No pageviews yet." />
        <TopList title="Top referrers" data={topReferrers} empty="No external referrers yet — direct visits only so far." />
        <TopList title="UTM sources" data={topUtm} empty="No campaign-tagged visits yet. Use ?utm_source=… links in campaigns." />
        <TopList title="Conversion & interaction events" data={events} empty="No events yet — lead submissions and quiz completions will appear here." />
        <TopList title="Devices" data={devices} empty="No data yet." />
        <TopList title="Languages" data={locales} empty="No data yet." />
      </div>
    </div>
  );
}
