import type { AgentConfig } from "../config";

/**
 * Pluggable web-search source for mention discovery and rank checks.
 *
 * Two providers are supported because neither is universally available:
 * Serper (Google results, cheap, no contract) and Bing Web Search. When
 * neither is configured the Visibility agent still runs — it just works from
 * our own data instead of the live SERP.
 */

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  position: number;
  domain: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export async function webSearch(
  config: AgentConfig,
  query: string,
  options: { count?: number; country?: string } = {},
): Promise<{ hits: SearchHit[]; error?: string }> {
  const count = options.count ?? 20;
  if (config.searchApiProvider === "serper" && config.searchApiKey) {
    return serperSearch(config.searchApiKey, query, count, options.country ?? "ae");
  }
  if (config.searchApiProvider === "bing" && config.searchApiKey) {
    return bingSearch(config.searchApiKey, query, count);
  }
  return { hits: [], error: "no search provider configured" };
}

async function serperSearch(
  apiKey: string,
  query: string,
  count: number,
  country: string,
): Promise<{ hits: SearchHit[]; error?: string }> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: country, hl: "en", num: count }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { hits: [], error: `Serper ${res.status}` };
    const data = (await res.json()) as {
      organic?: { link?: string; title?: string; snippet?: string; position?: number }[];
    };
    return {
      hits: (data.organic ?? [])
        .filter((r) => r.link)
        .map((r, i) => ({
          url: r.link!,
          title: r.title ?? "",
          snippet: r.snippet ?? "",
          position: r.position ?? i + 1,
          domain: hostOf(r.link!),
        })),
    };
  } catch (err) {
    return { hits: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function bingSearch(
  apiKey: string,
  query: string,
  count: number,
): Promise<{ hits: SearchHit[]; error?: string }> {
  try {
    const url = new URL("https://api.bing.microsoft.com/v7.0/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(count, 50)));
    url.searchParams.set("mkt", "en-AE");
    const res = await fetch(url, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { hits: [], error: `Bing ${res.status}` };
    const data = (await res.json()) as {
      webPages?: { value?: { url?: string; name?: string; snippet?: string }[] };
    };
    return {
      hits: (data.webPages?.value ?? [])
        .filter((r) => r.url)
        .map((r, i) => ({
          url: r.url!,
          title: r.name ?? "",
          snippet: r.snippet ?? "",
          position: i + 1,
          domain: hostOf(r.url!),
        })),
    };
  } catch (err) {
    return { hits: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Where uaeasp.ae sits in a result set, or null if it is not on the page. */
export function findOwnPosition(hits: SearchHit[], ownDomain = "uaeasp.ae"): number | null {
  const hit = hits.find((h) => h.domain === ownDomain || h.domain.endsWith(`.${ownDomain}`));
  return hit ? hit.position : null;
}
