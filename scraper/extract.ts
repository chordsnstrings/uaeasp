import { hasLegalSuffix, looksLikeCompanyName, normalizeName } from "./normalize.js";

export interface ExtractedProvider {
  name: string;
  website: string | null;
}

/**
 * Extraction from raw text lines (used for both HTML text fallback and PDF).
 * Providers on the MOF list are company names, almost all carrying legal-form
 * suffixes (LLC, FZCO, DMCC, …). We accept a line as a provider if it looks
 * like a company name AND (has a legal suffix OR sits in a run of similar
 * lines).
 */
export function extractFromTextLines(lines: string[]): ExtractedProvider[] {
  const candidates: string[] = [];
  for (const raw of lines) {
    // Strip list numbering ("1. Foo", "12) Foo", "• Foo")
    const line = raw.replace(/^\s*(\d{1,3}[.)]|[-•▪●])\s*/, "").trim();
    if (!looksLikeCompanyName(line)) continue;
    if (hasLegalSuffix(line)) candidates.push(line);
  }
  return dedupe(candidates.map((name) => ({ name, website: null })));
}

export function dedupe(providers: ExtractedProvider[]): ExtractedProvider[] {
  const seen = new Set<string>();
  const out: ExtractedProvider[] = [];
  for (const p of providers) {
    const key = normalizeName(p.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * Table-model extraction: rows of cells, first plausible cell is the name and
 * the first URL in the row is the website. Works on data extracted from the
 * DOM by the Playwright strategy.
 */
export interface RawRow {
  cells: string[];
  links: string[];
}

export function extractFromRows(rows: RawRow[]): ExtractedProvider[] {
  const out: ExtractedProvider[] = [];
  for (const row of rows) {
    const nameCell = row.cells.find(
      (c) => looksLikeCompanyName(c) && (hasLegalSuffix(c) || row.cells.length > 1),
    );
    if (!nameCell) continue;
    const website =
      row.links.find(
        (href) =>
          /^https?:\/\//i.test(href) &&
          !/mof\.gov\.ae|\.pdf($|\?)|mailto:|tel:/i.test(href),
      ) ?? null;
    out.push({ name: nameCell.trim(), website });
  }
  return dedupe(out);
}
