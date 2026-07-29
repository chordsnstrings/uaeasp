import { and, asc, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  analyticsEvents,
  articles,
  outreachMessages,
  outreachThreads,
  seoKeywords,
  visibilityTargets,
} from "@/db/schema";
import { chat, extractJson } from "@/lib/ai/chat";
import { getActiveProviderCount } from "@/lib/data";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { mandateTimelineLines } from "@/content/mandate";
import { getAgentConfig, type AgentConfig } from "../config";
import { isSuppressed, normalizeEmail } from "../mailer";
import { enqueue } from "../queue";
import type { AgentHandler } from "../types";
import { findContactEmails, registrableDomain, verifyEmail } from "../prospector/crawl";
import { findOwnPosition, webSearch, type SearchHit } from "./search";
import {
  classifyQuery,
  isActionableQuery,
  isConfigured,
  explainIndexingError,
  listSitemaps,
  localeOf,
  needsDedicatedPage,
  publishUrlNotification,
  querySearchAnalytics,
  submitSitemap,
  type IndexPingResult,
  type QueryAction,
} from "./gsc";
import { LANDING_SLUGS } from "@/content/landings";

/**
 * Agent 1 — Visibility.
 *
 * Earns rankings rather than spamming links. Four jobs:
 *   1. rank_check    — where we sit for the keywords we care about
 *   2. find_gaps     — queries we should own but have no page for
 *   3. draft_article — writes the missing page into /insights for approval
 *   4. find_mentions — pages discussing UAE e-invoicing that could cite us,
 *                      queued as link-outreach or a human-posted answer
 *
 * Nothing it produces is published or sent without a human approving it.
 */

/** Domains where an automated pitch is pointless or unwelcome. */
const OUTREACH_BLOCKLIST = [
  "uaeasp.ae",
  "google.com",
  "youtube.com",
  "facebook.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "instagram.com",
  "reddit.com",
  "wikipedia.org",
  "mof.gov.ae",
  "tax.gov.ae",
  "u.ae",
];

/** Seed keyword set: the queries this business lives or dies by. */
export const SEED_KEYWORDS: { phrase: string; locale: string; priority: number }[] = [
  { phrase: "uae e-invoicing service providers", locale: "en", priority: 10 },
  { phrase: "accredited service provider uae e-invoicing", locale: "en", priority: 10 },
  { phrase: "uae e invoicing mandate 2026", locale: "en", priority: 20 },
  { phrase: "ministry of finance e-invoicing providers list", locale: "en", priority: 20 },
  { phrase: "peppol accredited provider uae", locale: "en", priority: 30 },
  { phrase: "pint ae format", locale: "en", priority: 30 },
  { phrase: "e-invoicing software dubai", locale: "en", priority: 40 },
  { phrase: "e invoicing uae deadline", locale: "en", priority: 40 },
  { phrase: "uae e-invoicing penalties", locale: "en", priority: 50 },
  { phrase: "how to choose an e-invoicing provider uae", locale: "en", priority: 50 },
  { phrase: "مزودي الفوترة الإلكترونية في الإمارات", locale: "ar", priority: 30 },
  { phrase: "الفوترة الإلكترونية الإمارات 2026", locale: "ar", priority: 40 },
];

export const seedKeywords: AgentHandler = async (_task, ctx) => {
  let added = 0;
  for (const keyword of SEED_KEYWORDS) {
    const rows = await db
      .insert(seoKeywords)
      .values({ ...keyword, source: "seed" })
      .onConflictDoNothing()
      .returning({ id: seoKeywords.id });
    added += rows.length;
  }
  ctx.log(`seeded ${added} keywords`);
  return { itemsIn: SEED_KEYWORDS.length, itemsOut: added, summary: { added } };
};

/** Check our position for the highest-priority keywords due a refresh. */
export const rankCheck: AgentHandler = async (_task, ctx) => {
  const config = await getAgentConfig();
  const staleBefore = new Date(Date.now() - 6 * 86_400_000);
  const due = await db
    .select()
    .from(seoKeywords)
    .where(or(isNull(seoKeywords.lastCheckedAt), sql`last_checked_at < ${staleBefore}`))
    .orderBy(asc(seoKeywords.priority))
    .limit(12);

  if (!due.length) return { itemsIn: 0, itemsOut: 0, summary: { reason: "nothing due" } };

  let checked = 0;
  let gaps = 0;
  for (const keyword of due) {
    const { hits, error } = await webSearch(config, keyword.phrase, { count: 20 });
    if (error) {
      ctx.log(`rank check unavailable: ${error}`);
      break;
    }
    const position = findOwnPosition(hits);
    // No page in the top 20 for a keyword we care about = a content gap.
    const hasGap = position === null || position > 10;
    await db
      .update(seoKeywords)
      .set({ lastPosition: position, lastCheckedAt: new Date(), hasGap })
      .where(eq(seoKeywords.id, keyword.id));
    checked += 1;
    if (hasGap) gaps += 1;
    await storeCompetitorMentions(hits, keyword.phrase);
  }

  if (gaps > 0) {
    await enqueue({
      agent: "visibility",
      kind: "draft_article",
      payload: {},
      dedupeKey: `draft:${new Date().toISOString().slice(0, 10)}`,
      priority: 200,
    });
  }
  ctx.log(`checked ${checked} keywords, ${gaps} gaps`);
  return { itemsIn: due.length, itemsOut: checked, summary: { checked, gaps } };
};

async function storeCompetitorMentions(hits: SearchHit[], query: string): Promise<void> {
  for (const hit of hits.slice(0, 10)) {
    if (OUTREACH_BLOCKLIST.some((d) => hit.domain === d || hit.domain.endsWith(`.${d}`))) {
      continue;
    }
    await db
      .insert(visibilityTargets)
      .values({
        kind: "link",
        url: hit.url,
        domain: hit.domain,
        title: hit.title.slice(0, 300),
        snippet: hit.snippet.slice(0, 600),
        query,
        meta: { position: hit.position },
      })
      .onConflictDoNothing();
  }
}

const ARTICLE_SYSTEM = `You write reference pages for ${SITE_NAME} (uaeasp.ae), an independent UAE directory of Ministry of Finance accredited e-invoicing service providers.

Verified facts you may use:
- E-invoicing is mandatory in the UAE on this timeline:
${mandateTimelineLines()
  .map((line) => `  - ${line}`)
  .join("\n")}
- Invoices must be exchanged through an Accredited Service Provider (ASP) using the PINT AE format on the Peppol 5-corner model.
- Cabinet Decision No. 106 of 2025 and Ministerial Decision No. 244 of 2025 govern the regime.
- We list every accredited provider and the directory is free.

Rules:
- Answer the search query directly in the first two sentences. No throat-clearing introductions.
- 500-800 words, markdown, with ## subheadings and at least one comparison table or list.
- Never invent statistics, penalties, provider names, prices or dates beyond the verified facts above.
- Where a claim needs a source, say "according to the Ministry of Finance" rather than fabricating a citation.
- Include one natural internal link to /providers and one to /toolkit/penalty-calculator or /guides.
- Neutral, factual British English. No marketing voice, no first-person plural sales talk.

Respond with ONLY JSON: {"slug": "kebab-case-slug", "title": "...", "summary": "one sentence, max 160 chars", "body_md": "...", "keywords": ["...", "..."]}`;

interface ArticleDraft {
  slug: string;
  title: string;
  summary: string;
  body_md: string;
  keywords: string[];
}

/** Write the highest-value missing page as a draft article. */
export const draftArticle: AgentHandler = async (_task, ctx) => {
  const config = await getAgentConfig();
  // Two ceilings, both on drafts rather than publications: an unreviewed
  // backlog stops the agent writing more, which is the behaviour we want.
  const dayAgo = new Date(Date.now() - 86_400_000);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [today, thisWeek] = await Promise.all([
    db
      .select({ count: sql<string>`count(*)` })
      .from(articles)
      .where(and(eq(articles.agentGenerated, true), gte(articles.createdAt, dayAgo))),
    db
      .select({ count: sql<string>`count(*)` })
      .from(articles)
      .where(and(eq(articles.agentGenerated, true), gte(articles.createdAt, weekAgo))),
  ]);
  if (Number(today[0]?.count ?? 0) >= config.visibilityDailyDraftCap) {
    return { itemsIn: 0, itemsOut: 0, summary: { reason: "daily draft cap reached" } };
  }
  if (Number(thisWeek[0]?.count ?? 0) >= config.visibilityWeeklyDraftCap) {
    return { itemsIn: 0, itemsOut: 0, summary: { reason: "weekly draft cap reached" } };
  }

  const [gap] = await db
    .select()
    .from(seoKeywords)
    .where(and(eq(seoKeywords.hasGap, true), isNull(seoKeywords.coveredByPath)))
    .orderBy(asc(seoKeywords.priority))
    .limit(1);
  if (!gap) return { itemsIn: 0, itemsOut: 0, summary: { reason: "no open gaps" } };

  const providerCount = await getActiveProviderCount();
  const result = await chat(
    [
      { role: "system", content: ARTICLE_SYSTEM },
      {
        role: "user",
        content: `Target search query: "${gap.phrase}"\nLanguage: ${gap.locale === "ar" ? "Arabic (Modern Standard)" : "English"}\nOur directory currently lists ${providerCount} accredited providers.\nCurrent position for this query: ${gap.lastPosition ?? "not in top 20"}.`,
      },
    ],
    { temperature: 0.35, maxTokens: 3000, job: "article" },
  );
  if (!result) return { itemsIn: 1, itemsOut: 0, summary: { reason: "AI unavailable" } };
  ctx.addTokens(result.totalTokens, result.model);

  const draft = extractJson<ArticleDraft>(result.text);
  if (!draft?.slug || !draft.body_md) {
    return { itemsIn: 1, itemsOut: 0, summary: { reason: "unparseable draft" } };
  }

  const slug = draft.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const [inserted] = await db
    .insert(articles)
    .values({
      slug,
      locale: gap.locale,
      title: draft.title.slice(0, 200),
      summary: draft.summary?.slice(0, 300),
      bodyMd: draft.body_md,
      keywords: [gap.phrase, ...(draft.keywords ?? [])].slice(0, 12),
      status: "draft",
      agentGenerated: true,
    })
    .onConflictDoNothing()
    .returning({ id: articles.id });

  if (inserted) {
    await db
      .update(seoKeywords)
      .set({ coveredByPath: `/insights/${slug}` })
      .where(eq(seoKeywords.id, gap.id));
  }

  ctx.log(`drafted "${draft.title}" for "${gap.phrase}"`);
  return {
    itemsIn: 1,
    itemsOut: inserted ? 1 : 0,
    summary: { slug, keyword: gap.phrase, needsApproval: true },
  };
};

const MENTION_QUERIES = [
  '"e-invoicing" UAE "service provider" -site:uaeasp.ae',
  "UAE e-invoicing mandate 2026 guide",
  "how to comply UAE e-invoicing accredited provider",
  "قائمة مزودي الفوترة الإلكترونية الإمارات",
];

/** Find pages writing about the mandate that could cite the directory. */
export const findMentions: AgentHandler = async (_task, ctx) => {
  const config = await getAgentConfig();
  let discovered = 0;
  for (const query of MENTION_QUERIES) {
    const { hits, error } = await webSearch(config, query, { count: 15 });
    if (error) {
      ctx.log(`mention search unavailable: ${error}`);
      break;
    }
    for (const hit of hits) {
      if (OUTREACH_BLOCKLIST.some((d) => hit.domain === d || hit.domain.endsWith(`.${d}`))) {
        continue;
      }
      const rows = await db
        .insert(visibilityTargets)
        .values({
          kind: "mention",
          url: hit.url,
          domain: hit.domain,
          title: hit.title.slice(0, 300),
          snippet: hit.snippet.slice(0, 600),
          query,
          meta: { position: hit.position },
        })
        .onConflictDoNothing()
        .returning({ id: visibilityTargets.id });
      discovered += rows.length;
    }
  }
  if (discovered) {
    await enqueue({
      agent: "visibility",
      kind: "draft_outreach",
      payload: {},
      dedupeKey: `link-outreach:${new Date().toISOString().slice(0, 10)}`,
      priority: 220,
    });
  }
  ctx.log(`discovered ${discovered} new mention targets`);
  return { itemsIn: MENTION_QUERIES.length, itemsOut: discovered, summary: { discovered } };
};

const LINK_PITCH_SYSTEM = `You write brief, genuine outreach emails to editors and authors who have published an article about UAE e-invoicing.

You are offering a genuinely useful reference: uaeasp.ae maintains the complete, continuously updated directory of every e-invoicing service provider accredited by the UAE Ministry of Finance, free and with no signup.

Rules:
- Under 90 words. Plain text. British English.
- Reference their specific article by title and say, in one clause, what it covers.
- Offer the directory as a resource for their readers — never demand a link, never mention SEO, backlinks, or "link exchange".
- No flattery ("great article!"), no hype, no attachments.
- Do not add a sign-off block; one is appended automatically.

Respond with ONLY JSON: {"subject": "...", "body": "..."}`;

/** Draft link-outreach emails for discovered mention targets. */
export const draftOutreach: AgentHandler = async (_task, ctx) => {
  const config = await getAgentConfig();
  const targets = await db
    .select()
    .from(visibilityTargets)
    .where(and(eq(visibilityTargets.kind, "mention"), eq(visibilityTargets.status, "discovered")))
    .orderBy(desc(visibilityTargets.createdAt))
    .limit(5);

  let drafted = 0;
  for (const target of targets) {
    const domain = target.domain ?? registrableDomain(target.url);
    if (!domain) continue;
    const contacts = await findContactEmails(`https://${domain}`, 3);
    const contact = contacts[0];
    if (!contact) {
      await db
        .update(visibilityTargets)
        .set({ status: "skipped", notes: "no contact address found", updatedAt: new Date() })
        .where(eq(visibilityTargets.id, target.id));
      continue;
    }
    const email = normalizeEmail(contact.email);
    if ((await verifyEmail(email)) === "invalid" || (await isSuppressed(email))) {
      await db
        .update(visibilityTargets)
        .set({ status: "skipped", notes: "contact unusable", updatedAt: new Date() })
        .where(eq(visibilityTargets.id, target.id));
      continue;
    }

    const result = await chat(
      [
        { role: "system", content: LINK_PITCH_SYSTEM },
        {
          role: "user",
          content: `Their article: "${target.title}"\nURL: ${target.url}\nExcerpt: ${target.snippet ?? ""}\nOur directory: ${absoluteUrl("/providers")}`,
        },
      ],
      { temperature: 0.4, maxTokens: 600, job: "email" },
    );
    if (result) ctx.addTokens(result.totalTokens, result.model);
    const draft = result
      ? extractJson<{ subject: string; body: string }>(result.text)
      : null;
    if (!draft?.body) continue;

    const [thread] = await db
      .insert(outreachThreads)
      .values({
        agent: "visibility",
        campaign: "link-outreach",
        toEmail: email,
        subject: draft.subject?.slice(0, 180),
        status: "active",
      })
      .returning();

    const bodyText = `${draft.body.trim()}\n\n${[config.senderName, config.companyLegalName || SITE_NAME, absoluteUrl("/")].filter(Boolean).join("\n")}\n\nIf you would rather not hear from us: ${absoluteUrl(`/api/outreach/unsubscribe?t=${thread.token}`)}`;

    await db.insert(outreachMessages).values({
      threadId: thread.id,
      direction: "outbound",
      // Link outreach always waits for a human — one bad pitch costs a relationship.
      status: "pending_approval",
      stepIndex: 0,
      subject: draft.subject?.slice(0, 180) ?? "A free UAE e-invoicing provider directory",
      bodyText,
      toEmail: email,
    });

    await db
      .update(visibilityTargets)
      .set({
        status: "drafted",
        draft: bodyText.slice(0, 4000),
        notes: `contact: ${email}`,
        updatedAt: new Date(),
      })
      .where(eq(visibilityTargets.id, target.id));
    drafted += 1;
  }

  ctx.log(`drafted ${drafted} link-outreach emails for approval`);
  return { itemsIn: targets.length, itemsOut: drafted, summary: { drafted } };
};

/** Citation targets worth a human ten minutes each, seeded once. */
const CITATION_TARGETS = [
  { url: "https://business.google.com/", title: "Google Business Profile" },
  { url: "https://www.bingplaces.com/", title: "Bing Places" },
  { url: "https://www.yellowpages.ae/", title: "Yellow Pages UAE" },
  { url: "https://www.connect.ae/", title: "Connect.ae business directory" },
  { url: "https://uae.lookanddo.com/", title: "Look & Do UAE" },
  { url: "https://www.crunchbase.com/", title: "Crunchbase company profile" },
  { url: "https://www.producthunt.com/", title: "Product Hunt (toolkit launch)" },
  { url: "https://news.ycombinator.com/showhn.html", title: "Show HN (toolkit launch)" },
];

export const seedCitations: AgentHandler = async (_task, ctx) => {
  let added = 0;
  for (const target of CITATION_TARGETS) {
    const rows = await db
      .insert(visibilityTargets)
      .values({
        kind: "citation",
        url: target.url,
        domain: registrableDomain(target.url),
        title: target.title,
        notes: "Create or claim a listing for uaeasp.ae, with the same NAP details everywhere.",
      })
      .onConflictDoNothing()
      .returning({ id: visibilityTargets.id });
    added += rows.length;
  }
  ctx.log(`seeded ${added} citation targets`);
  return { itemsIn: CITATION_TARGETS.length, itemsOut: added, summary: { added } };
};

/** Weekly cycle: refresh ranks, hunt mentions, keep the content queue moving. */
export const weekly: AgentHandler = async (_task, ctx) => {
  const week = new Date().toISOString().slice(0, 10);
  // Search Console first: it supplies the real demand every later step reads.
  await enqueue({
    agent: "visibility",
    kind: "import_search_console",
    dedupeKey: `gsc:${week}`,
    priority: 5,
  });
  await enqueue({ agent: "visibility", kind: "seed_keywords", dedupeKey: `seed-kw:${week}` });
  await enqueue({ agent: "visibility", kind: "seed_citations", dedupeKey: `seed-cit:${week}` });
  await enqueue({ agent: "visibility", kind: "rank_check", dedupeKey: `rank:${week}` });
  await enqueue({ agent: "visibility", kind: "find_mentions", dedupeKey: `mentions:${week}` });
  ctx.log("weekly visibility cycle queued");
  return { itemsIn: 0, itemsOut: 5, summary: { queued: 5 } };
};

/** Which of our pages actually pull traffic — used by the analyst report. */
export async function topLandingPages(days = 7): Promise<{ path: string; views: number }[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({
      path: analyticsEvents.path,
      views: sql<string>`count(*)`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.type, "pageview"), gte(analyticsEvents.createdAt, since)))
    .groupBy(analyticsEvents.path)
    .orderBy(sql`count(*) DESC`)
    .limit(10);
  return rows.map((r) => ({ path: r.path, views: Number(r.views) }));
}


/**
 * Pull real demand from Search Console into the keyword table.
 *
 * This replaces guesswork as the agent's view of the world. Before this, the
 * only keywords it knew were twelve phrases typed by hand with priorities
 * someone invented, and a keyword only became a "gap" if a paid SERP API said
 * so — which is why nothing was ever drafted.
 *
 * Now every query that actually produced impressions arrives with its true
 * impressions, clicks, position and, crucially, the URL Google chose to show.
 * That last field is what stops the agent writing a second page for a query it
 * already has a page for.
 */
export const importSearchConsole: AgentHandler = async (_task, ctx) => {
  const config = await getAgentConfig();
  if (!isConfigured(config)) {
    return { itemsIn: 0, itemsOut: 0, summary: { reason: "Search Console not configured" } };
  }

  const [queryRows, pairRows] = await Promise.all([
    querySearchAnalytics(config, { dimensions: ["query"], rowLimit: 500 }),
    // query+page together tells us which URL is competing for each phrase.
    querySearchAnalytics(config, { dimensions: ["query", "page"], rowLimit: 1000 }),
  ]);
  if (queryRows.error) {
    ctx.log(`Search Console unavailable: ${queryRows.error}`);
    throw new Error(queryRows.error);
  }

  // Best-ranking page per query, so a phrase spread over several URLs resolves
  // to the one Google actually favours.
  const bestPage = new Map<string, { path: string; position: number }>();
  for (const row of pairRows.rows) {
    const [phrase, url] = row.keys;
    if (!phrase || !url) continue;
    const path = url.replace(/^https?:\/\/[^/]+/, "") || "/";
    const current = bestPage.get(phrase);
    if (!current || row.position < current.position) {
      bestPage.set(phrase, { path, position: row.position });
    }
  }

  const actionable = queryRows.rows.filter((r) => isActionableQuery(r));
  const tally: Record<QueryAction, number> = { winning: 0, improve: 0, gap: 0 };
  let stored = 0;

  for (const row of actionable) {
    const phrase = row.keys[0].trim().toLowerCase();
    const page = bestPage.get(row.keys[0]);
    // A hub page standing in for a specific question is not coverage. Without
    // this the queue stayed empty: every query resolved to /providers or the
    // homepage, so everything looked "covered" and nothing was ever written.
    const action: QueryAction = needsDedicatedPage(row.position, page?.path)
      ? "gap"
      : classifyQuery(row.position, Boolean(page));
    tally[action] += 1;

    await db
      .insert(seoKeywords)
      .values({
        phrase,
        locale: localeOf(phrase),
        // Impressions are the demand signal, so they drive the queue order.
        // Priority ascends, so negate: the busiest query sorts first.
        priority: -row.impressions,
        lastPosition: Math.round(row.position),
        lastCheckedAt: new Date(),
        impressions: row.impressions,
        clicks: row.clicks,
        rankingPath: page?.path ?? null,
        hasGap: action === "gap",
        coveredByPath: action === "gap" ? null : (page?.path ?? null),
        source: "gsc",
      })
      .onConflictDoUpdate({
        target: [seoKeywords.phrase, seoKeywords.locale],
        set: {
          priority: -row.impressions,
          lastPosition: Math.round(row.position),
          lastCheckedAt: new Date(),
          impressions: row.impressions,
          clicks: row.clicks,
          rankingPath: page?.path ?? null,
          hasGap: action === "gap",
          coveredByPath: action === "gap" ? null : (page?.path ?? null),
          source: "gsc",
        },
      });
    stored += 1;
  }

  if (tally.gap > 0) {
    await enqueue({
      agent: "visibility",
      kind: "draft_article",
      payload: {},
      dedupeKey: `draft:${new Date().toISOString().slice(0, 10)}`,
      priority: 200,
    });
  }

  ctx.log(
    `Search Console: ${actionable.length} actionable of ${queryRows.rows.length} queries — ` +
      `${tally.winning} winning, ${tally.improve} to improve, ${tally.gap} gaps`,
  );
  return {
    itemsIn: queryRows.rows.length,
    itemsOut: stored,
    summary: { ...tally, stored },
  };
};


/**
 * Resubmit the sitemap and record what Google makes of it.
 *
 * Google retired the anonymous ping endpoint in 2023, so the Search Console
 * API is the only programmatic nudge left. Resubmitting an unchanged sitemap
 * is a no-op to Google, which makes this safe to run nightly and after every
 * deploy — new pages get noticed without anyone remembering to do it.
 *
 * Deliberately not here: the Indexing API. Google restricts it to job postings
 * and live-stream markup; using it for ordinary pages is against its terms.
 * Inspection tells us the truth about a URL, which is the honest substitute.
 */
export const submitSitemapJob: AgentHandler = async (_task, ctx) => {
  const config = await getAgentConfig();
  if (!isConfigured(config)) {
    return { itemsIn: 0, itemsOut: 0, summary: { reason: "Search Console not configured" } };
  }
  const feed = config.sitemapFeedPath || absoluteUrl("/sitemap.xml");
  const submitted = await submitSitemap(config, feed);
  if (!submitted.ok) {
    ctx.log(`sitemap submit failed: ${submitted.error}`);
    throw new Error(submitted.error ?? "sitemap submit failed");
  }

  const { sitemaps } = await listSitemaps(config);
  const mine = sitemaps.find((s) => s.path === feed) ?? sitemaps[0];
  if (mine) {
    ctx.log(
      `sitemap ${feed}: ${mine.submitted} URLs submitted, ${mine.indexed} indexed, ` +
        `${mine.warnings} warnings, ${mine.errors} errors`,
    );
  }
  return {
    itemsIn: 1,
    itemsOut: 1,
    summary: {
      feed,
      submitted: mine?.submitted ?? null,
      indexed: mine?.indexed ?? null,
      warnings: mine?.warnings ?? null,
      errors: mine?.errors ?? null,
      lastDownloaded: mine?.lastDownloaded ?? null,
    },
  };
};

/**
 * The daily loop: refresh demand, submit the sitemap, keep writing.
 *
 * Content used to move on a weekly cycle with a cap of three, so at best the
 * agent produced three pages a week and only if that week's cycle happened to
 * fire. Gaps are discovered daily now, and drafting is bounded by a daily cap
 * instead of waiting a week for permission.
 */
export const daily: AgentHandler = async (_task, ctx) => {
  const day = new Date().toISOString().slice(0, 10);
  await enqueue({
    agent: "visibility",
    kind: "import_search_console",
    dedupeKey: `gsc:${day}`,
    priority: 5,
  });
  await enqueue({
    agent: "visibility",
    kind: "submit_sitemap",
    dedupeKey: `sitemap:${day}`,
    priority: 8,
  });
  await enqueue({
    agent: "visibility",
    kind: "draft_article",
    dedupeKey: `draft:${day}`,
    priority: 200,
  });
  await enqueue({
    agent: "visibility",
    kind: "ping_index",
    dedupeKey: `ping:${day}`,
    priority: 210,
  });
  ctx.log("daily visibility cycle queued");
  return { itemsIn: 0, itemsOut: 4, summary: { queued: 4 } };
};


/**
 * Which URLs are worth asking Google to recrawl.
 *
 * Pinging the whole site every night would burn the quota on pages that have
 * not moved and teaches Google nothing. Only genuinely changed things go: a
 * page published or edited since the last run, and the query-cluster landings,
 * which change whenever the provider list does.
 */
export function urlsWorthPinging(
  recentArticles: { slug: string; locale: string }[],
  landingSlugs: readonly string[],
  cap: number,
): string[] {
  const urls = [
    ...recentArticles.map((a) =>
      absoluteUrl(a.locale === "ar" ? `/ar/insights/${a.slug}` : `/insights/${a.slug}`),
    ),
    ...landingSlugs.map((s) => absoluteUrl(`/lists/${s}`)),
  ];
  // De-duplicate before capping, or a repeated URL silently eats the budget.
  return [...new Set(urls)].slice(0, Math.max(0, cap));
}

/**
 * Ask Google to recrawl what changed.
 *
 * Off unless indexingApiEnabled is set, because Google documents this endpoint
 * as being for job postings and live-stream markup. Enabled deliberately, it
 * is capped and reports every rejection with the remedy rather than a raw 403 —
 * both prerequisites (API enabled, service account is a property OWNER) fail
 * with the same status code and entirely different fixes.
 */
export const pingIndex: AgentHandler = async (task, ctx) => {
  const config = await getAgentConfig();
  if (!isConfigured(config)) {
    return { itemsIn: 0, itemsOut: 0, summary: { reason: "Search Console not configured" } };
  }
  if (!config.indexingApiEnabled) {
    return { itemsIn: 0, itemsOut: 0, summary: { reason: "indexing API disabled in config" } };
  }

  const explicit = (task.payload as { urls?: string[] })?.urls;
  let urls: string[];
  if (Array.isArray(explicit) && explicit.length) {
    urls = [...new Set(explicit)].slice(0, config.indexingDailyPingCap);
  } else {
    const since = new Date(Date.now() - 2 * 86_400_000);
    const recent = await db
      .select({ slug: articles.slug, locale: articles.locale })
      .from(articles)
      .where(and(eq(articles.status, "published"), gte(articles.updatedAt, since)))
      .limit(50);
    urls = urlsWorthPinging(recent, LANDING_SLUGS, config.indexingDailyPingCap);
  }
  if (!urls.length) return { itemsIn: 0, itemsOut: 0, summary: { reason: "nothing changed" } };

  const results: IndexPingResult[] = [];
  for (const url of urls) {
    const result = await publishUrlNotification(config, url);
    results.push(result);
    // One misconfiguration will reject every URL identically, so stop at the
    // first rather than spending the whole cap proving the same point.
    if (!result.ok && result.status === 403) {
      ctx.log(explainIndexingError(result.status, result.error ?? ""));
      break;
    }
    if (!result.ok && result.status === 429) {
      ctx.log(explainIndexingError(result.status, result.error ?? ""));
      break;
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  ctx.log(
    `indexing: ${ok}/${results.length} accepted` +
      (failed.length ? ` — ${explainIndexingError(failed[0].status, failed[0].error ?? "")}` : ""),
  );
  return {
    itemsIn: urls.length,
    itemsOut: ok,
    summary: {
      accepted: ok,
      rejected: failed.length,
      firstError: failed[0]
        ? explainIndexingError(failed[0].status, failed[0].error ?? "")
        : null,
    },
  };
};

export const visibilityHandlers: Record<string, AgentHandler> = {
  weekly,
  seed_keywords: seedKeywords,
  seed_citations: seedCitations,
  rank_check: rankCheck,
  daily,
  submit_sitemap: submitSitemapJob,
  ping_index: pingIndex,
  import_search_console: importSearchConsole,
  draft_article: draftArticle,
  find_mentions: findMentions,
  draft_outreach: draftOutreach,
};
