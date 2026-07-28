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
): Promise<string | null> {
  if (cached && cached.owner === key.client_email && cached.expiresAt > now + 60_000) {
    return cached.token;
  }
  const issued = Math.floor(now / 1000);
  const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url({
    iss: key.client_email,
    scope: TOKEN_SCOPE,
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
      owner: key.client_email,
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
