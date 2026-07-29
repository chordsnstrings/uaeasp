import { createSign } from "node:crypto";
import type { AgentConfig } from "../config";

/**
 * Google Search Console, read-only.
 *
 * This is the only source that tells us what people actually searched to reach
 * us, which page Google chose to show, and where it ranked — first-party, free
 * and unlimited for our volume. Everything else the Visibility agent knows is
 * either a guess or a paid estimate.
 *
 * Authentication is a service account, not an API key: Search Console serves
 * private property data and requires a credential that asserts a principal.
 * The JWT-bearer exchange is short enough to hand-roll, and doing so keeps
 * googleapis (and its dependency tree) out of the worker.
 */

const TOKEN_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function base64url(value: string | object): string {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString(
    "base64url",
  );
}

export function parseServiceAccount(json: string): ServiceAccountKey | null {
  try {
    const key = JSON.parse(json) as Partial<ServiceAccountKey>;
    if (!key.client_email || !key.private_key) return null;
    return {
      client_email: key.client_email,
      private_key: key.private_key,
      token_uri: key.token_uri || "https://oauth2.googleapis.com/token",
    };
  } catch {
    return null;
  }
}

/** Tokens last an hour; hold one rather than re-signing on every call. */
let cached: { token: string; expiresAt: number; owner: string } | null = null;

export async function getAccessToken(
  key: ServiceAccountKey,
  now: number = Date.now(),
  scope: string = TOKEN_SCOPE,
): Promise<string | null> {
  // Scope is part of the cache identity: a read-only token cannot submit a
  // sitemap, and silently reusing one would fail in a confusing way.
  const owner = `${key.client_email}|${scope}`;
  if (cached && cached.owner === owner && cached.expiresAt > now + 60_000) {
    return cached.token;
  }
  const issued = Math.floor(now / 1000);
  const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url({
    iss: key.client_email,
    scope,
    aud: key.token_uri,
    exp: issued + 3600,
    iat: issued,
  })}`;

  let assertion: string;
  try {
    assertion = `${unsigned}.${createSign("RSA-SHA256")
      .update(unsigned)
      .end()
      .sign(key.private_key, "base64url")}`;
  } catch {
    // A malformed or truncated private key fails here rather than at the API.
    return null;
  }

  try {
    const res = await fetch(key.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return null;
    cached = {
      token: body.access_token,
      expiresAt: now + (body.expires_in ?? 3600) * 1000,
      owner: `${key.client_email}|${scope}`,
    };
    return body.access_token;
  } catch {
    return null;
  }
}

/** Reset the cached token — tests, and credential rotation. */
export function clearTokenCache(): void {
  cached = null;
}

export function isConfigured(config: AgentConfig): boolean {
  return Boolean(config.gscServiceAccountJson && config.gscSiteUrl);
}

/** Dates Search Console expects: YYYY-MM-DD, and it works in whole days. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function querySearchAnalytics(
  config: AgentConfig,
  body: {
    dimensions: string[];
    days?: number;
    rowLimit?: number;
    startRow?: number;
    type?: string;
  },
): Promise<{ rows: SearchAnalyticsRow[]; error?: string }> {
  const key = parseServiceAccount(config.gscServiceAccountJson);
  if (!key) return { rows: [], error: "service account JSON is missing or unparseable" };
  const token = await getAccessToken(key);
  if (!token) return { rows: [], error: "could not obtain an access token" };

  // Search Console finalises data on a lag, so the last two days are partial
  // and would make every fresh query look like it is losing ground.
  const end = new Date(Date.now() - 2 * 86_400_000);
  const start = new Date(end.getTime() - (body.days ?? 90) * 86_400_000);

  try {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        config.gscSiteUrl,
      )}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: isoDay(start),
          endDate: isoDay(end),
          dimensions: body.dimensions,
          rowLimit: body.rowLimit ?? 500,
          startRow: body.startRow ?? 0,
          type: body.type ?? "web",
          dataState: "final",
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return { rows: [], error: `Search Console ${res.status}: ${detail}` };
    }
    const json = (await res.json()) as { rows?: SearchAnalyticsRow[] };
    return { rows: json.rows ?? [] };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Is this query one we should act on?
 *
 * Search Console reports a long tail of one-impression accidents. Acting on
 * those would fill the content queue with noise, so a phrase has to show some
 * repeat demand before it counts as a signal.
 */
export function isActionableQuery(row: SearchAnalyticsRow, minImpressions = 3): boolean {
  const phrase = row.keys[0] ?? "";
  if (phrase.length < 6 || phrase.length > 120) return false;
  if (row.impressions < minImpressions) return false;
  return true;
}

/**
 * What to do about a query we already surface for.
 *
 * The distinction that matters: a page ranking 11-40 is a page Google already
 * considers relevant and is one improvement away from traffic. Writing a
 * second page for that query competes with the first and helps nobody. Only a
 * query with no page of its own is a genuine content gap.
 */
export type QueryAction = "winning" | "improve" | "gap";

export function classifyQuery(position: number, hasPage: boolean): QueryAction {
  if (position <= 10) return "winning";
  if (hasPage && position <= 60) return "improve";
  return "gap";
}

/** Arabic queries carry Arabic-script characters; everything else is English. */
export function localeOf(phrase: string): "en" | "ar" {
  return /[؀-ۿ]/.test(phrase) ? "ar" : "en";
}

/* ------------------------------------------------------- write-side calls */

/** Read/write scope — sitemap submission needs more than webmasters.readonly. */
const WRITE_SCOPE = "https://www.googleapis.com/auth/webmasters";

async function token(config: AgentConfig, scope: string): Promise<string | null> {
  const key = parseServiceAccount(config.gscServiceAccountJson);
  if (!key) return null;
  return getAccessToken(key, Date.now(), scope);
}

/**
 * Tell Google the sitemap changed.
 *
 * Google retired the anonymous ping endpoint in 2023, so this is now the only
 * programmatic way to nudge a sitemap — and it needs the same service account
 * as everything else. Cheap and idempotent: resubmitting an unchanged sitemap
 * is a no-op to Google, so this can run on every deploy and every night.
 */
export async function submitSitemap(
  config: AgentConfig,
  feedPath: string,
): Promise<{ ok: boolean; error?: string }> {
  const access = await token(config, WRITE_SCOPE);
  if (!access) return { ok: false, error: "no access token" };
  try {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        config.gscSiteUrl,
      )}/sitemaps/${encodeURIComponent(feedPath)}`,
      { method: "PUT", headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(20_000) },
    );
    if (res.status === 204 || res.ok) return { ok: true };
    return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface SitemapStatus {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  warnings: number;
  errors: number;
  submitted: number;
  indexed: number;
}

/** What Google currently thinks of our sitemap — warnings are the useful part. */
export async function listSitemaps(
  config: AgentConfig,
): Promise<{ sitemaps: SitemapStatus[]; error?: string }> {
  const access = await token(config, WRITE_SCOPE);
  if (!access) return { sitemaps: [], error: "no access token" };
  try {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        config.gscSiteUrl,
      )}/sitemaps`,
      { headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return { sitemaps: [], error: `${res.status}` };
    const json = (await res.json()) as {
      sitemap?: {
        path: string;
        lastSubmitted?: string;
        lastDownloaded?: string;
        isPending?: boolean;
        warnings?: string;
        errors?: string;
        contents?: { submitted?: string; indexed?: string }[];
      }[];
    };
    return {
      sitemaps: (json.sitemap ?? []).map((s) => ({
        path: s.path,
        lastSubmitted: s.lastSubmitted,
        lastDownloaded: s.lastDownloaded,
        isPending: s.isPending,
        warnings: Number(s.warnings ?? 0),
        errors: Number(s.errors ?? 0),
        submitted: Number(s.contents?.[0]?.submitted ?? 0),
        indexed: Number(s.contents?.[0]?.indexed ?? 0),
      })),
    };
  } catch (err) {
    return { sitemaps: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export interface UrlVerdict {
  url: string;
  verdict: string;
  coverageState: string;
  lastCrawlTime?: string;
  indexed: boolean;
}

/**
 * Ask Google whether one URL is actually in the index.
 *
 * This is the honest alternative to the Indexing API, which Google restricts
 * to job postings and live-stream markup — using it for ordinary pages is
 * against its terms, so we do not. Inspection cannot request indexing; it can
 * only tell us the truth about a page, which is what a report needs.
 * Quota is 2,000 URLs a day, far more than we will ever use.
 */
export async function inspectUrl(
  config: AgentConfig,
  url: string,
): Promise<{ result?: UrlVerdict; error?: string }> {
  const access = await token(config, WRITE_SCOPE);
  if (!access) return { error: "no access token" };
  try {
    const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: config.gscSiteUrl }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return { error: `${res.status}: ${(await res.text()).slice(0, 200)}` };
    const json = (await res.json()) as {
      inspectionResult?: {
        indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string };
      };
    };
    const r = json.inspectionResult?.indexStatusResult;
    return {
      result: {
        url,
        verdict: r?.verdict ?? "UNKNOWN",
        coverageState: r?.coverageState ?? "unknown",
        lastCrawlTime: r?.lastCrawlTime,
        indexed: (r?.coverageState ?? "").toLowerCase().includes("indexed") &&
          !(r?.coverageState ?? "").toLowerCase().includes("not indexed"),
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/* ------------------------------------------------- richer gap definition */

/**
 * Pages that answer many questions rather than one.
 *
 * When one of these ranks for a specific query, that is not coverage — it is
 * the homepage or a hub being asked to stand in for a page we never wrote.
 * Search Console showed exactly this: "accredited service providers" resolving
 * to "/" at position 48. Treating that as covered is what kept the content
 * queue permanently empty.
 */
const HUB_PATHS = ["/", "/ar", "/providers", "/ar/providers", "/registry", "/ar/registry"];

export function isHubPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return HUB_PATHS.includes(path.replace(/\/$/, "") || "/");
}

/**
 * Should we write a dedicated page for this query?
 *
 * Position alone is not enough. A specific page sitting at 30 needs improving,
 * not duplicating. A hub page sitting at 30 means the query has no home of its
 * own, and that is a genuine gap however well the hub happens to rank.
 */
export function needsDedicatedPage(
  position: number,
  rankingPath: string | null | undefined,
): boolean {
  if (position <= 10) return false;
  return isHubPath(rankingPath) || !rankingPath;
}
