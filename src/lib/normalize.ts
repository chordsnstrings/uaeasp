/**
 * Name/slug normalization shared by the seed script, the ingest reconciler,
 * and (copied logic) the GitHub Actions scraper. normalizedName is the stable
 * match key between scrape runs — keep this deterministic.
 */

/**
 * Trailing tokens stripped from company names. Punctuation is removed first,
 * so "L.L.C-FZ" becomes the tokens "l l c fz" — hence the single letters,
 * which are only ever stripped from the END of a name, after other suffixes.
 */
const SUFFIX_TOKENS = new Set([
  "llc", "lc", "fz", "fzc", "fzco", "fze", "dmcc", "ltd", "limited",
  "inc", "incorporated", "co", "company", "corp", "corporation",
  "l", "c", "f", "z", "m", "e",
]);

export function normalizeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[\s-]+/g, " ")
    .trim();
  const tokens = cleaned.split(" ");
  // Strip legal-form suffixes from the end (possibly several: "x llc fzco"),
  // but never strip the whole name away.
  while (tokens.length > 1 && SUFFIX_TOKENS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

export function slugify(name: string): string {
  return normalizeName(name)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return null;
  }
}

export function websiteDomain(url: string | null | undefined): string | null {
  const normalized = normalizeWebsite(url);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
