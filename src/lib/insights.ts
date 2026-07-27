import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, type Article } from "@/db/schema";

/**
 * Published agent-drafted articles. Every read is build-safe: if the database
 * is unreachable during prerendering, /insights renders empty rather than
 * failing the whole build.
 */

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function getPublishedArticles(locale: string): Promise<Article[]> {
  return safe(
    () =>
      db
        .select()
        .from(articles)
        .where(and(eq(articles.status, "published"), eq(articles.locale, locale)))
        .orderBy(desc(articles.publishedAt))
        .limit(100),
    [],
  );
}

export async function getArticle(slug: string, locale: string): Promise<Article | null> {
  return safe(async () => {
    const [row] = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.slug, slug),
          eq(articles.locale, locale),
          eq(articles.status, "published"),
        ),
      )
      .limit(1);
    return row ?? null;
  }, null);
}

/** Slugs for the sitemap and static params. */
export async function getPublishedArticleSlugs(): Promise<
  { slug: string; locale: string; updatedAt: Date }[]
> {
  return safe(
    async () =>
      (
        await db
          .select({
            slug: articles.slug,
            locale: articles.locale,
            updatedAt: articles.updatedAt,
          })
          .from(articles)
          .where(eq(articles.status, "published"))
          .limit(500)
      ).map((r) => ({ ...r, updatedAt: new Date(r.updatedAt) })),
    [],
  );
}
