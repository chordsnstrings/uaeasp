import type { ReactNode } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  Badge,
  BarList,
  ButtonLink,
  Card,
  Cell,
  ColumnChart,
  DataTable,
  EmptyState,
  PageHeader,
  Row,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const DAYS = 30;
const DAY_MS = 86_400_000;
/** The window is short enough that the trend split is honest at fortnights. */
const TREND_WINDOW = 14;

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

/** A day bucket after gaps have been filled — a quiet day is a zero, not a hole. */
interface DayPoint extends DailyRow {
  label: string;
}

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(query);
  return res.rows as T[];
}

/* ----------------------------------------------------------------- helpers */

/** Today in Asia/Dubai as YYYY-MM-DD, matching the buckets the SQL emits. */
function dubaiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayLabel(iso: string): string {
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  }).format(new Date(parsed));
}

/**
 * The query only returns days that saw traffic, so a silent day used to vanish
 * and quietly compress the axis. Fill the range end to end — a day with no
 * visits is information.
 */
function fillDays(daily: DailyRow[]): DayPoint[] {
  if (daily.length === 0) return [];
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const start = Date.parse(`${daily[0].day}T00:00:00Z`);
  const lastRow = Date.parse(`${daily[daily.length - 1].day}T00:00:00Z`);
  const today = Date.parse(`${dubaiToday()}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(lastRow)) {
    return daily.map((d) => ({ ...d, label: dayLabel(d.day) }));
  }
  const end = Math.max(lastRow, Number.isFinite(today) ? today : lastRow);
  const out: DayPoint[] = [];
  for (let t = start; t <= end && out.length < 400; t += DAY_MS) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const row = byDay.get(iso);
    out.push({
      day: iso,
      label: dayLabel(iso),
      pageviews: row?.pageviews ?? 0,
      sessions: row?.sessions ?? 0,
      visitors: row?.visitors ?? 0,
    });
  }
  return out;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Percentage change of the last fortnight against the one before it. Returns
 * null when the window is too short to say anything — better a missing arrow
 * than a confident lie.
 */
function trendDelta(values: number[], window = TREND_WINDOW): number | null {
  if (values.length < window * 2) return null;
  const recent = sum(values.slice(-window));
  const prior = sum(values.slice(-window * 2, -window));
  if (prior === 0) return recent === 0 ? 0 : null;
  return ((recent - prior) / prior) * 100;
}

function share(value: number, total: number): string | undefined {
  if (!total || total <= 0) return undefined;
  const p = (value / total) * 100;
  if (!Number.isFinite(p)) return undefined;
  return p >= 10 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

/** GROUP BY keys can be null on older rows; never render a blank bar. */
const keyLabel = (k: string | null) => (k && k.trim() !== "" ? k : "(not set)");

/* -------------------------------------------------------------- local panel */

/**
 * Every breakdown on this page is the same shape: a ranked list of keys with a
 * count. One panel, composed from the shared BarList, instead of nine variants.
 */
function ListCard({
  title,
  hint,
  data,
  tone = "brand",
  denom,
  emptyTitle,
  emptyBody,
  emptyAction,
  className = "",
}: {
  title: string;
  hint?: string;
  data: CountRow[];
  tone?: Tone;
  /** Denominator for the share shown beside each count. */
  denom?: number;
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <SectionTitle hint={hint}>{title}</SectionTitle>
      {data.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />
      ) : (
        <BarList
          tone={tone}
          items={data.map((d) => ({
            label: keyLabel(d.key),
            value: d.count,
            hint: denom ? share(d.count, denom) : undefined,
          }))}
        />
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- the page */

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

  const series = fillDays(daily);
  const viewSeries = series.map((d) => d.pageviews);
  const visitSeries = series.map((d) => d.sessions);
  const visitorSeries = series.map((d) => d.visitors);
  const busiest = series.reduce<DayPoint | null>(
    (best, d) => (best === null || d.pageviews > best.pageviews ? d : best),
    null,
  );

  // Three series, three columns — the old overlay stacked visitors on top of
  // pageviews in one bar, which made neither readable.
  const panels: { key: string; title: string; values: number[]; tone: Tone; total: number }[] = [
    { key: "views", title: "Pageviews", values: viewSeries, tone: "brand", total: sum(viewSeries) },
    { key: "visits", title: "Visits", values: visitSeries, tone: "info", total: sum(visitSeries) },
    {
      key: "visitors",
      title: "Unique visitors",
      values: visitorSeries,
      tone: "positive",
      total: sum(visitorSeries),
    },
  ];

  const funnelSteps = [
    { label: "Visits", value: f.sessions, note: "unique browsing sessions" },
    { label: "Engaged (2+ pages)", value: f.engaged, note: "kept browsing past the first page" },
    { label: "Reached a lead page", value: f.reached, note: "viewed get-matched or the assessment" },
    { label: "Converted", value: f.converted, note: "submitted the form or completed the quiz" },
  ];

  const deviceTotal = sum(devices.map((d) => d.count));
  const localeTotal = sum(locales.map((d) => d.count));
  const eventTotal = sum(events.map((d) => d.count));

  const visitSite = <ButtonLink href="/">Open the public site</ButtonLink>;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={
          <span className="block max-w-3xl">
            First-party, cookieless measurement — last <span className="num">{DAYS}</span> days,
            stored in your own database. Visitors are counted per day via a salted daily hash of IP
            + browser; no IP is ever stored, and by design the same person cannot be tracked across
            days. Bots and admin pages are excluded, and abusive traffic is rate-limited.
          </span>
        }
        actions={
          <ButtonLink href="/admin/leads" variant="primary">
            Open leads
          </ButtonLink>
        }
      />

      <section>
        <SectionTitle
          hint={`Totals for the last ${DAYS} days. The change compares the most recent ${TREND_WINDOW} days with the ${TREND_WINDOW} before them.`}
        >
          Headline
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Daily visitors (avg)"
            value={t.avgDailyVisitors.toLocaleString()}
            delta={trendDelta(visitorSeries)}
            spark={visitorSeries}
            tone="positive"
            hint="Uniques per day; the hash rotates nightly, so days cannot be summed."
          />
          <StatCard
            label="Visits (sessions)"
            value={t.sessions.toLocaleString()}
            delta={trendDelta(visitSeries)}
            spark={visitSeries}
            tone="info"
            hint="One visit is one browsing session."
          />
          <StatCard
            label="Pageviews"
            value={t.pageviews.toLocaleString()}
            delta={trendDelta(viewSeries)}
            spark={viewSeries}
            tone="brand"
            hint={busiest ? `Busiest day ${busiest.label} (${busiest.pageviews})` : undefined}
          />
          <StatCard
            label="Pages / visit"
            value={viewsPerVisit}
            hint="How deep the average visit goes before leaving."
          />
          <StatCard
            label="Conversion rate"
            value={`${convRate}%`}
            tone={t.converting > 0 ? "positive" : "neutral"}
            hint={`${t.converting.toLocaleString()} of ${t.sessions.toLocaleString()} visits submitted the form or finished the quiz.`}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle hint="One column per day, bucketed in Asia/Dubai time. Hover a column for the exact count.">
            Daily traffic
          </SectionTitle>
          {series.length === 0 ? (
            <EmptyState
              title="No traffic measured yet"
              body="Collection starts with the first visit after this deploys. Open the site once to confirm the tracker is reporting."
              action={visitSite}
            />
          ) : (
            <>
              <div className="space-y-5">
                {panels.map((p) => (
                  <div key={p.key}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                        {p.title}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        <span className="num font-semibold text-ink-800">
                          {p.total.toLocaleString()}
                        </span>{" "}
                        total · peak{" "}
                        <span className="num font-semibold text-ink-800">
                          {Math.max(0, ...p.values).toLocaleString()}
                        </span>{" "}
                        in a day
                      </p>
                    </div>
                    <ColumnChart
                      points={series.map((d, i) => ({ label: d.label, value: p.values[i] ?? 0 }))}
                      tone={p.tone}
                      height={p.key === "views" ? 148 : 96}
                    />
                  </div>
                ))}
              </div>

              <details className="group mt-5 border-t border-ink-100 pt-4">
                <summary className="press cursor-pointer list-none text-xs font-semibold text-ink-600 transition-colors hover:text-brand-800 [&::-webkit-details-marker]:hidden">
                  <span className="me-1.5 inline-block transition-transform group-open:rotate-90">
                    ›
                  </span>
                  Day-by-day numbers (<span className="num">{series.length}</span> days)
                </summary>
                <div className="mt-3">
                  <DataTable
                    head={["Day", "Visitors", "Visits", "Pageviews", "Pages / visit"]}
                    minWidth="30rem"
                  >
                    {series
                      .slice()
                      .reverse()
                      .map((d) => (
                        <Row key={d.day}>
                          <Cell className="num whitespace-nowrap text-ink-800">{d.label}</Cell>
                          <Cell className="num text-ink-700">{d.visitors.toLocaleString()}</Cell>
                          <Cell className="num text-ink-700">{d.sessions.toLocaleString()}</Cell>
                          <Cell className="num font-semibold text-ink-900">
                            {d.pageviews.toLocaleString()}
                          </Cell>
                          <Cell className="num text-ink-500">
                            {d.sessions > 0 ? (d.pageviews / d.sessions).toFixed(1) : "—"}
                          </Cell>
                        </Row>
                      ))}
                  </DataTable>
                </div>
              </details>
            </>
          )}
        </Card>

        <Card>
          <SectionTitle hint="Where visits drop off between landing and becoming a lead.">
            Conversion funnel
          </SectionTitle>
          {f.sessions === 0 ? (
            <EmptyState
              title="No visits to funnel yet"
              body="Once visits arrive, this shows how many browse on, reach a lead page, and convert."
              action={visitSite}
            />
          ) : (
            <ol className="space-y-4">
              {funnelSteps.map((step, i) => {
                const pctOfAll = f.sessions > 0 ? (step.value / f.sessions) * 100 : 0;
                const prev = i === 0 ? step.value : funnelSteps[i - 1].value;
                const stepRate =
                  i === 0 ? null : prev > 0 ? ((step.value / prev) * 100).toFixed(0) : "0";
                const dropped = i === 0 ? 0 : Math.max(0, prev - step.value);
                const last = i === funnelSteps.length - 1;
                return (
                  <li key={step.label}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-ink-800">{step.label}</span>
                      <span className="flex shrink-0 items-baseline gap-2">
                        <span className="num text-sm font-semibold text-ink-900">
                          {step.value.toLocaleString()}
                        </span>
                        {stepRate !== null && (
                          <Badge tone="neutral">
                            <span className="num">{stepRate}%</span> of previous
                          </Badge>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 h-6 overflow-hidden rounded-lg bg-ink-100">
                      <div
                        className={`flex h-full items-center rounded-lg px-2 ${
                          last ? "bg-accent-500 text-ink-950" : "bg-brand-600 text-white"
                        }`}
                        style={{ width: `${Math.max(pctOfAll, step.value > 0 ? 4 : 0)}%` }}
                      >
                        <span className="num text-[11px] font-semibold">
                          {pctOfAll >= 12 ? `${pctOfAll.toFixed(0)}%` : ""}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">
                      {step.note}
                      {dropped > 0 && (
                        <>
                          {" · "}
                          <span className="num">{dropped.toLocaleString()}</span> lost here
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <section>
        <SectionTitle hint="The doors people come in and go out of. Percentages are shares of all visits.">
          Entry and exit
        </SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <ListCard
            title="Entry pages"
            hint="The first page of each visit — what search engines and links land people on."
            data={entryPages}
            tone="info"
            denom={t.sessions}
            emptyTitle="No landings recorded"
            emptyBody="The first page of every visit is listed here once traffic arrives."
            emptyAction={visitSite}
          />
          <ListCard
            title="Exit pages"
            hint="The last page of each visit — where people leave. A lead page here is a good exit; a guide is not."
            data={exitPages}
            tone="warning"
            denom={t.sessions}
            emptyTitle="No exits recorded"
            emptyBody="Once visits end, the page they ended on is ranked here."
            emptyAction={visitSite}
          />
        </div>
      </section>

      <Card>
        <SectionTitle hint="How visitors move page to page inside a single visit, most travelled step first.">
          Page flow
        </SectionTitle>
        <DataTable head={["From", "To", "Steps"]} minWidth="38rem">
          {transitions.length === 0 ? (
            <EmptyState
              colSpan={3}
              title="No page-to-page flow yet"
              body="Flows appear once visits span more than one page."
              action={visitSite}
            />
          ) : (
            transitions.map((row) => {
              const parts = keyLabel(row.key).split("  →  ");
              const from = parts[0] ?? "";
              const to = parts.length === 2 ? parts[1] : null;
              return (
                <Row key={row.key}>
                  <Cell className="num max-w-[18rem] truncate text-ink-800">{from}</Cell>
                  <Cell className="num max-w-[18rem] truncate text-ink-800">
                    {to === null ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      <>
                        <span aria-hidden className="me-1.5 text-ink-300">
                          →
                        </span>
                        {to}
                      </>
                    )}
                  </Cell>
                  <Cell className="num font-semibold text-ink-900">
                    {row.count.toLocaleString()}
                  </Cell>
                </Row>
              );
            })
          )}
        </DataTable>
      </Card>

      <section>
        <SectionTitle hint="What gets read, where it comes from, and what people do once they arrive.">
          Content and acquisition
        </SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <ListCard
            title="Top pages"
            hint="Most viewed pages, as a share of all pageviews."
            data={topPages}
            tone="brand"
            denom={t.pageviews}
            emptyTitle="No pageviews yet"
            emptyBody="Every page view lands here, ranked by volume."
            emptyAction={visitSite}
          />
          <ListCard
            title="Top referrers"
            hint="External hosts that sent visits, counted per visit."
            data={topReferrers}
            tone="info"
            denom={t.sessions}
            emptyTitle="No external referrers"
            emptyBody="Every visit so far arrived directly or without a referrer header."
          />
          <ListCard
            title="UTM sources"
            hint="Campaign-tagged visits, counted per visit."
            data={topUtm}
            tone="warning"
            denom={t.sessions}
            emptyTitle="No campaign-tagged visits"
            emptyBody="Add ?utm_source=… to the links you publish and tagged visits will be attributed here."
          />
          <ListCard
            title="Conversion & interaction events"
            hint="Events fired on the site — form submissions, quiz completions and interactions."
            data={events}
            tone="positive"
            denom={eventTotal}
            emptyTitle="No events yet"
            emptyBody="Lead submissions and quiz completions appear here as soon as one is fired."
            emptyAction={<ButtonLink href="/admin/leads">Open leads</ButtonLink>}
          />
          <ListCard
            title="Devices"
            hint="Visits by device class."
            data={devices}
            tone="neutral"
            denom={deviceTotal}
            emptyTitle="No device data"
            emptyBody="Device class is recorded from the first visit onwards."
            emptyAction={visitSite}
          />
          <ListCard
            title="Languages"
            hint="Visits by the locale the site was served in."
            data={locales}
            tone="neutral"
            denom={localeTotal}
            emptyTitle="No language data"
            emptyBody="Arabic and English visits are split out here once traffic arrives."
            emptyAction={visitSite}
          />
        </div>
      </section>
    </>
  );
}
