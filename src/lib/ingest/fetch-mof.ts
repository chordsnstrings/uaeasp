import { MOF_SOURCE_URL } from "@/lib/site";
import type { IngestPayload } from "@/lib/validation/provider-ingest";

type IngestProvider = IngestPayload["providers"][number];
type IngestContact = NonNullable<IngestProvider["contacts"]>[number];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /\+?\d[\d\s()-]{6,18}\d/g;
const URL_RE = /(https?:\/\/[^\s"']+|www\.[^\s"']+)/i;

const HEADER_CELL_RE = /^(#|no\.?|(provider|company|entity)?\s*(name|website)|contact\s*person|e-?mail|phone|contact\s*(details|number))$/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/** Strip tags from a table-cell fragment, keeping line structure so multiple
 * contact names inside one cell stay on separate lines. */
function cellText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|span)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.trim()))];
}

function extractPhones(text: string): string[] {
  return [
    ...new Set(
      (text.match(PHONE_RE) ?? [])
        .map((p) => p.replace(/[\s()-]/g, ""))
        .filter((p) => p.replace(/\D/g, "").length >= 7),
    ),
  ];
}

function extractPersonNames(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length >= 3 &&
        line.length <= 60 &&
        !/[@\d/]/.test(line) &&
        !/www\.|https?:/i.test(line) &&
        !/\.[a-z]{2,}$/i.test(line) &&
        /^[a-z]/i.test(line) &&
        line.split(/\s+/).length <= 5,
    );
}

/** Same pairing rules as the workflow scraper: names paired with emails and
 * phones by position when the counts line up, pooled on the first contact
 * otherwise. */
function buildContacts(cellsAfterName: string[]): IngestContact[] {
  const rowText = cellsAfterName.join("\n");
  const emails = extractEmails(rowText);
  const phones = extractPhones(rowText);
  const persons = cellsAfterName
    .flatMap((cell) => extractPersonNames(cell))
    .filter((name, i, arr) => arr.indexOf(name) === i);

  if (persons.length === 0) {
    if (emails.length === 0 && phones.length === 0) return [];
    return [{ emails, phones }];
  }

  return persons.map((name, i) => ({
    name,
    emails: emails.length === persons.length ? [emails[i]] : i === 0 ? emails : [],
    phones: phones.length === persons.length ? [phones[i]] : i === 0 ? phones : [],
  }));
}

function findWebsite(cells: string[]): string | null {
  for (const cell of cells) {
    const m = cell.match(URL_RE);
    if (m) {
      const url = m[0].replace(/[),.;]+$/, "");
      return url.startsWith("http") ? url : `https://${url}`;
    }
  }
  return null;
}

export interface MofFetchResult {
  ok: boolean;
  providers: IngestPayload["providers"];
  error?: string;
}

/** Parse the provider table out of the MoF page HTML. Exported for tests. */
export function parseMofHtml(html: string): IngestPayload["providers"] {
  const providers: IngestPayload["providers"] = [];
  const seen = new Set<string>();

  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      cellText(c[1]),
    );
    if (cells.length < 2) continue;

    // Skip header rows (all cells look like column titles).
    if (cells.every((c) => c === "" || HEADER_CELL_RE.test(c.replace(/\n/g, " ")))) continue;

    // Name is the first non-numeric cell.
    const nameIdx = /^\d{1,3}$/.test(cells[0]) ? 1 : 0;
    const name = (cells[nameIdx] ?? "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 300) continue;
    if (HEADER_CELL_RE.test(name)) continue;
    if (new RegExp(EMAIL_RE.source, "i").test(name)) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rest = cells.slice(nameIdx + 1);
    providers.push({
      name,
      website: findWebsite(rest),
      contacts: buildContacts(rest),
    });
  }

  return providers;
}

/**
 * Fetch and parse the official MoF pre-approved provider list directly from
 * the app server. This backs the admin "Refresh now" button; the nightly
 * GitHub workflow (full browser + PDF fallback) remains the primary path.
 */
export async function fetchMofProviders(): Promise<MofFetchResult> {
  let html: string;
  try {
    const res = await fetch(MOF_SOURCE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, providers: [], error: `Source returned HTTP ${res.status}` };
    }
    html = await res.text();
  } catch (err) {
    return {
      ok: false,
      providers: [],
      error: `Could not reach the source page: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const providers = parseMofHtml(html);

  if (providers.length < 20) {
    return {
      ok: false,
      providers: [],
      error: `Parsed only ${providers.length} provider(s) from the source page — the page layout may have changed or the request was blocked. No changes were applied.`,
    };
  }

  return { ok: true, providers };
}
