import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, seoKeywords } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ArticleReview } from "@/components/admin/AgentConsole";
import { formatDateTime } from "@/components/admin/status";
import {
  Badge,
  BarList,
  ButtonLink,
  Card,
  Cell,
  DataTable,
  EmptyState,
  PageHeader,
  Row,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/**
 * Rank bands.
 *
 * A raw position number tells an admin nothing until they know which side of
 * page one it sits on, so every position carries its band: 1-10 is won,
 * 11-30 is within reach, 31+ is not yet a real listing.
 */
function band(position: number | null): { label: string; tone: Tone } {
  if (position === null) return { label: "unranked", tone: "neutral" };
  if (position <= 10) return { label: "top 10", tone: "positive" };
  if (position <= 30) return { label: "11–30", tone: "warning" };
  return { label: "31+", tone: "neutral" };
}

const BANDS = ["top 10", "11–30", "31+", "unranked"] as const;

function wordCount(md: string): number {
  const words = md.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export default async function AgentContentPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const [drafts, published, keywords, articleCounts, keywordTotals] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(eq(articles.status, "draft"))
      .orderBy(desc(articles.createdAt))
      .limit(20),
    db
      .select()
      .from(articles)
      .where(eq(articles.status, "published"))
      .orderBy(desc(articles.publishedAt))
      .limit(20),
    db
      .select()
      .from(seoKeywords)
      .orderBy(sql`priority ASC, last_position NULLS LAST`)
      .limit(30),
    // Both aggregates are single cheap scans, and they are what stops the page
    // lying: the lists above are capped at 20 and 30 rows.
    db
      .select({ status: articles.status, count: sql<number>`count(*)::int` })
      .from(articles)
      .groupBy(articles.status),
    db
      .select({
        total: sql<number>`count(*)::int`,
        ranked: sql<number>`count(${seoKeywords.lastPosition})::int`,
        top10: sql<number>`(count(*) filter (where ${seoKeywords.lastPosition} between 1 and 10))::int`,
        gaps: sql<number>`(count(*) filter (where ${seoKeywords.hasGap}))::int`,
        impressions: sql<number>`coalesce(sum(${seoKeywords.impressions}), 0)::int`,
        clicks: sql<number>`coalesce(sum(${seoKeywords.clicks}), 0)::int`,
      })
      .from(seoKeywords),
  ]);

  const byStatus = Object.fromEntries(articleCounts.map((r) => [r.status, r.count]));
  const draftTotal = byStatus["draft"] ?? 0;
  const publishedTotal = byStatus["published"] ?? 0;
  const archivedTotal = byStatus["archived"] ?? 0;
  const stats = keywordTotals[0];
  const keywordTotal = stats?.total ?? 0;
  const gapTotal = stats?.gaps ?? 0;
  const top10Total = stats?.top10 ?? 0;
  const impressions = stats?.impressions ?? 0;
  const clicks = stats?.clicks ?? 0;

  // Band distribution, over the keywords actually listed below — not a claim
  // about the whole corpus.
  const bandCounts = new Map<string, number>(BANDS.map((b) => [b, 0]));
  for (const keyword of keywords) {
    const key = band(keyword.lastPosition).label;
    bandCounts.set(key, (bandCounts.get(key) ?? 0) + 1);
  }

  // Where the effort pays: a keyword with demand that we do not own yet.
  const candidates = keywords
    .filter((k) => k.hasGap || (k.lastPosition ?? 999) > 10)
    .sort((a, b) => b.impressions - a.impressions || a.priority - b.priority)
    .slice(0, 6);
  // The same phrase can be tracked per locale, so disambiguate only when it
  // would otherwise collide.
  const phraseCounts = new Map<string, number>();
  for (const k of candidates) phraseCounts.set(k.phrase, (phraseCounts.get(k.phrase) ?? 0) + 1);
  const opportunities = candidates.map((k) => ({
    label: (phraseCounts.get(k.phrase) ?? 0) > 1 ? `${k.phrase} · ${k.locale}` : k.phrase,
    value: k.impressions,
    hint: k.lastPosition ? `#${k.lastPosition}` : "unranked",
  }));

  return (
    <>
      <PageHeader
        title="Content & rankings"
        count={draftTotal}
        subtitle="The Visibility agent writes a page for each keyword we should own but do not. Drafts stay unpublished until you read them — nothing reaches the public site unreviewed."
        actions={
          <>
            <ButtonLink href="/admin/agents">Agent console</ButtonLink>
            <ButtonLink href="/insights" variant="primary">
              View insights
            </ButtonLink>
          </>
        }
      />

      <section>
        <SectionTitle hint="Counts are across everything, not just the rows listed below.">
          Where content stands
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Drafts to review"
            value={draftTotal}
            tone={draftTotal > 0 ? "warning" : "neutral"}
            hint={
              draftTotal > drafts.length
                ? `${drafts.length} newest shown below`
                : "Nothing publishes until you read it"
            }
          />
          <StatCard
            label="Published"
            value={publishedTotal}
            tone="positive"
            hint={archivedTotal > 0 ? `${archivedTotal} archived` : "Live at /insights"}
          />
          <StatCard
            label="Keywords tracked"
            value={keywordTotal}
            hint={`${top10Total} in the top 10`}
          />
          <StatCard
            label="Gaps to cover"
            value={gapTotal}
            tone={gapTotal > 0 ? "info" : "positive"}
            hint="No page targets these yet"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Across the keywords listed further down this page.">
            Rank bands
          </SectionTitle>
          <BarList
            tone="brand"
            items={BANDS.map((b) => ({ label: b, value: bandCounts.get(b) ?? 0 }))}
            emptyLabel="No keywords tracked yet."
          />
        </Card>
        <Card>
          <SectionTitle hint="Demand we do not own yet — ranked by impressions from Search Console.">
            Top opportunities
          </SectionTitle>
          <BarList
            tone="warning"
            items={opportunities}
            emptyLabel="No gaps — every tracked keyword already has a page in the top 10."
          />
        </Card>
      </div>

      <section>
        <SectionTitle
          hint="Written by the agent, unpublished. Open one to read and edit before it goes live."
          action={
            <span className="num text-xs text-ink-400">
              {drafts.length} of {draftTotal}
            </span>
          }
        >
          Drafts awaiting review
        </SectionTitle>

        {drafts.length === 0 ? (
          <Card>
            <EmptyState
              title="No drafts waiting"
              body="Queue “Visibility — draft an article” and the agent will write a page for the highest-demand gap."
              action={<ButtonLink href="/admin/agents">Queue a job</ButtonLink>}
            />
          </Card>
        ) : (
          <ul className="space-y-4">
            {drafts.map((article, i) => {
              const words = wordCount(article.bodyMd);
              return (
                <li key={article.id}>
                  <Card padded={false} className="overflow-hidden">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-200/70 bg-paper-dark/60 px-5 py-3">
                      <span className="num text-[11px] font-semibold tracking-[0.12em] text-ink-400">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Badge tone="info">draft</Badge>
                      <span className="text-[11px] text-ink-500">
                        <span className="num font-semibold text-ink-700">
                          {words.toLocaleString()}
                        </span>{" "}
                        words · <span className="num">~{Math.max(1, Math.round(words / 220))}</span>{" "}
                        min read
                      </span>
                      <span className="num ms-auto text-[11px] text-ink-400">
                        {formatDateTime(article.createdAt)}
                      </span>
                    </div>
                    <div className="[&>article]:rounded-none [&>article]:border-0 [&>article]:bg-transparent [&>article]:p-5 sm:[&>article]:p-6">
                      <ArticleReview
                        article={{
                          id: article.id,
                          title: article.title,
                          slug: article.slug,
                          locale: article.locale,
                          summary: article.summary,
                          bodyMd: article.bodyMd,
                          keywords: article.keywords,
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

      <section>
        <SectionTitle
          hint={`Highest priority first. ${impressions.toLocaleString()} impressions and ${clicks.toLocaleString()} clicks across every tracked phrase.`}
          action={<ButtonLink href="/admin/agents">Check rankings</ButtonLink>}
        >
          Keyword positions
        </SectionTitle>
        <DataTable
          minWidth="52rem"
          head={["Keyword", "Locale", "Position", "Demand", "Coverage", "Checked"]}
        >
          {keywords.length === 0 ? (
            <EmptyState
              colSpan={6}
              title="No keywords tracked yet"
              body="Run “Visibility — check rankings” and the agent will fill this table with real positions."
              action={<ButtonLink href="/admin/agents">Queue a rank check</ButtonLink>}
            />
          ) : (
            keywords.map((keyword) => {
              const rank = band(keyword.lastPosition);
              const path = keyword.rankingPath ?? keyword.coveredByPath;
              return (
                <Row key={keyword.id}>
                  <Cell>
                    <p className="font-medium text-ink-900">{keyword.phrase}</p>
                    {path && (
                      <p className="num mt-0.5 truncate text-[11px] text-ink-400" dir="ltr">
                        {path}
                      </p>
                    )}
                  </Cell>
                  <Cell className="num text-xs uppercase text-ink-500">{keyword.locale}</Cell>
                  <Cell>
                    <div className="flex items-center gap-2">
                      <span className="num text-sm font-semibold text-ink-900">
                        {keyword.lastPosition ?? "—"}
                      </span>
                      <Badge tone={rank.tone}>{rank.label}</Badge>
                    </div>
                  </Cell>
                  <Cell className="num whitespace-nowrap text-xs text-ink-600">
                    {keyword.impressions.toLocaleString()} imp
                    <span className="text-ink-400"> · {keyword.clicks.toLocaleString()} clicks</span>
                  </Cell>
                  <Cell>
                    {keyword.hasGap ? (
                      <Badge tone="warning">gap</Badge>
                    ) : (
                      <Badge tone="neutral">covered</Badge>
                    )}
                  </Cell>
                  <Cell className="num whitespace-nowrap text-xs text-ink-500">
                    {keyword.lastCheckedAt
                      ? new Date(keyword.lastCheckedAt).toLocaleDateString("en-GB")
                      : "never"}
                  </Cell>
                </Row>
              );
            })
          )}
        </DataTable>
      </section>

      <section>
        <SectionTitle
          hint="Live on the public site. Newest first."
          action={
            <span className="num text-xs text-ink-400">
              {published.length} of {publishedTotal}
            </span>
          }
        >
          Published
        </SectionTitle>
        <DataTable minWidth="40rem" head={["Article", "Path", "Locale", "Published"]}>
          {published.length === 0 ? (
            <EmptyState
              colSpan={4}
              title="Nothing published yet"
              body="Approve a draft above and it appears at /insights immediately."
            />
          ) : (
            published.map((article) => (
              <Row key={article.id}>
                <Cell>
                  <span className="font-medium text-ink-900">{article.title}</span>
                </Cell>
                <Cell>
                  <a
                    href={`/insights/${article.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="num text-xs text-brand-700 hover:underline"
                    dir="ltr"
                  >
                    /insights/{article.slug}
                  </a>
                </Cell>
                <Cell className="num text-xs uppercase text-ink-500">{article.locale}</Cell>
                <Cell className="num whitespace-nowrap text-xs text-ink-500">
                  {article.publishedAt
                    ? new Date(article.publishedAt).toLocaleDateString("en-GB")
                    : "—"}
                </Cell>
              </Row>
            ))
          )}
        </DataTable>
      </section>
    </>
  );
}
