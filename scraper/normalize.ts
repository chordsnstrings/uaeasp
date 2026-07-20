/**
 * Standalone copy of the app's name-normalization logic (src/lib/normalize.ts).
 * The scraper package must not import from src/ — it runs with its own
 * dependencies in GitHub Actions. Keep the two in sync; the server-side
 * reconciler is the source of truth for matching, so drift here only affects
 * client-side dedupe within one payload.
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
  while (tokens.length > 1 && SUFFIX_TOKENS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/** Heuristic: does this text look like a company name (not a heading/nav item)? */
export function looksLikeCompanyName(text: string): boolean {
  const t = text.trim();
  if (t.length < 3 || t.length > 140) return false;
  if (!/[a-z]/i.test(t)) return false;
  // Obvious non-name page furniture
  if (
    /^(home|about|contact|search|menu|news|events|initiatives|services|share|print|download|read more|learn more|last updated|page \d|©|copyright|ministry of finance|pre-?approved|service providers?|e-?invoicing|(provider|company|entity)?\s*name|website|email|phone|country|no\.?|#|sr\.?\s*no\.?|s\/n|status|date)$/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/\b(privacy|cookie|policy|terms|copyright|sitemap)\b/i.test(t)) return false;
  return true;
}

/** Strong signal: name carries a UAE legal-form suffix. */
export function hasLegalSuffix(text: string): boolean {
  return /\b(l\.?l\.?c|f\.?z\.?-?\s?l\.?l\.?c|fzco|fzc|fze|dmcc|ltd|limited|inc|co\.|company|corp|corporation|group|holding|technologies|solutions|software|systems|services)\b\.?/i.test(
    text,
  );
}
