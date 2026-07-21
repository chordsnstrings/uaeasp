import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

const DAYS = 30;

interface DailyRow {
  day: string;
  pageviews: number;
  sessions: number;
}

interface CountRow {
  key: string;
  count: number;
}

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(query);
  return res.rows as T[];
}

function TopList({ title, data, empty }: { title: string; data: CountRow[]; empty: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">{title}</h2>
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

  const [daily, topPages, topReferrers, topUtm, devices, locales, events, totals] =
    await Promise.all([
      rows<DailyRow>(sql`
        SELECT to_char(created_at AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD') AS day,
               count(*) FILTER (WHERE type = 'pageview')::int AS pageviews,
               count(DISTINCT session_id)::int AS sessions
        FROM analytics_events WHERE created_at > ${since}
        GROUP BY 1 ORDER BY 1`),
      rows<CountRow>(sql`
        SELECT path AS key, count(*)::int AS count
        FROM analytics_events WHERE type = 'pageview' AND created_at > ${since}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
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
      rows<{ sessions: number; pageviews: number; converting: number }>(sql`
        SELECT count(DISTINCT session_id)::int AS sessions,
               count(*) FILTER (WHERE type = 'pageview')::int AS pageviews,
               count(DISTINCT session_id) FILTER (WHERE type = 'event' AND name IN ('lead_submitted','quiz_completed'))::int AS converting
        FROM analytics_events WHERE created_at > ${since}`),
    ]);

  const t = totals[0] ?? { sessions: 0, pageviews: 0, converting: 0 };
  const convRate = t.sessions > 0 ? ((t.converting / t.sessions) * 100).toFixed(1) : "0.0";
  const maxDaily = Math.max(1, ...daily.map((d) => d.pageviews));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Analytics</h1>
        <p className="mt-1 text-sm text-ink-500">
          First-party, cookieless measurement of the public site — last {DAYS} days, stored in
          your own database. Admin pages and known bots are excluded.
        </p>
      </div>

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Visits (sessions)", value: t.sessions },
          { label: "Pageviews", value: t.pageviews },
          { label: "Converting visits", value: t.converting },
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

      {/* Daily chart */}
      <section className="rounded-2xl border border-ink-100 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
          Daily pageviews
        </h2>
        {daily.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">
            No data yet — it starts collecting from the first visit after this deploys.
          </p>
        ) : (
          <div className="mt-4 flex h-40 items-end gap-1">
            {daily.map((d) => (
              <div key={d.day} className="group relative flex-1">
                <div
                  className="w-full rounded-t bg-brand-500 transition-colors group-hover:bg-brand-700"
                  style={{ height: `${Math.max(2, (d.pageviews / maxDaily) * 152)}px` }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2 py-1 text-[11px] font-medium text-white group-hover:block">
                  {d.day}: {d.pageviews} views · {d.sessions} visits
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
