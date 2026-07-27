import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, seoKeywords } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ArticleReview } from "@/components/admin/AgentConsole";

export const dynamic = "force-dynamic";

export default async function AgentContentPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const [drafts, published, keywords] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/agents" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
          ← Agents
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">Content & rankings</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          The Visibility agent writes a page for each keyword we should own but do not.
          Drafts stay unpublished until you read them — nothing reaches the public site
          unreviewed.
        </p>
      </header>

      <section>
        <h2 className="num text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Drafts awaiting review ({drafts.length})
        </h2>
        <div className="mt-4 space-y-4">
          {drafts.length === 0 && (
            <p className="rounded-xl border border-dashed border-ink-300 p-8 text-center text-sm text-ink-500">
              No drafts. Queue “Visibility — draft an article” to make one.
            </p>
          )}
          {drafts.map((article) => (
            <ArticleReview
              key={article.id}
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
          ))}
        </div>
      </section>

      <section>
        <h2 className="num text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Keyword positions
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-200 bg-paper-dark">
              <tr className="num text-[10px] uppercase tracking-[0.1em] text-ink-500">
                <th className="px-4 py-2.5 text-start">Keyword</th>
                <th className="px-4 py-2.5 text-start">Locale</th>
                <th className="px-4 py-2.5 text-end">Position</th>
                <th className="px-4 py-2.5 text-start">Gap</th>
                <th className="px-4 py-2.5 text-start">Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {keywords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                    No keywords tracked yet — run “Visibility — check rankings”.
                  </td>
                </tr>
              )}
              {keywords.map((keyword) => (
                <tr key={keyword.id}>
                  <td className="px-4 py-2.5 text-ink-800">{keyword.phrase}</td>
                  <td className="num px-4 py-2.5 text-xs text-ink-500">{keyword.locale}</td>
                  <td className="num px-4 py-2.5 text-end font-semibold text-ink-900">
                    {keyword.lastPosition ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {keyword.hasGap ? (
                      <span className="num rounded bg-amber-50 px-1.5 py-0.5 text-[10px] uppercase text-amber-700">
                        gap
                      </span>
                    ) : (
                      <span className="num text-[10px] uppercase text-ink-400">covered</span>
                    )}
                  </td>
                  <td className="num px-4 py-2.5 text-xs text-ink-500">
                    {keyword.lastCheckedAt
                      ? new Date(keyword.lastCheckedAt).toLocaleDateString("en-GB")
                      : "never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {published.length > 0 && (
        <section>
          <h2 className="num text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Published ({published.length})
          </h2>
          <ul className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
            {published.map((article) => (
              <li key={article.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="font-medium text-ink-800">{article.title}</span>
                <a
                  href={`/insights/${article.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="num text-xs text-brand-700 hover:underline"
                  dir="ltr"
                >
                  /insights/{article.slug}
                </a>
                <span className="num ms-auto text-xs text-ink-400">
                  {article.publishedAt
                    ? new Date(article.publishedAt).toLocaleDateString("en-GB")
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
