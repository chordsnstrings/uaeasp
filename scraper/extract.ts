import { hasLegalSuffix, looksLikeCompanyName, normalizeName } from "./normalize.js";

export interface ExtractedContact {
  name?: string;
  emails: string[];
  phones: string[];
}

export interface ExtractedProvider {
  name: string;
  website: string | null;
  contacts?: ExtractedContact[];
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// +9715xxxxxxxx style, or local numbers like 8000320420 — 7+ digits total
const PHONE_RE = /\+?\d[\d\s()-]{6,18}\d/g;

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

/** Lines in the "Contact Person" cell: human names — short, letters, no
 * emails/digits/URLs/domains. */
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

/**
 * Build structured contacts from a row's cells. Persons come from the cell(s)
 * with bare names; emails/phones are collected from the whole row. When the
 * email/phone counts line up with the person count they are paired by
 * position (the MOF table lists them in matching order); otherwise everything
 * is pooled onto the first contact so no data is lost.
 */
export function buildContacts(cellsAfterName: string[]): ExtractedContact[] {
  const rowText = cellsAfterName.join("\n");
  const emails = extractEmails(rowText);
  const phones = extractPhones(rowText);
  // extractPersonNames already rejects emails, numbers and domains, so it is
  // safe to scan every cell; dedupe while keeping order.
  const persons = cellsAfterName
    .flatMap((cell) => extractPersonNames(cell))
    .filter((name, i, arr) => arr.indexOf(name) === i);

  if (persons.length === 0) {
    if (emails.length === 0 && phones.length === 0) return [];
    return [{ emails, phones }];
  }

  return persons.map((name, i) => ({
    name,
    emails:
      emails.length === persons.length
        ? [emails[i]]
        : i === 0
          ? emails
          : [],
    phones:
      phones.length === persons.length
        ? [phones[i]]
        : i === 0
          ? phones
          : [],
  }));
}

/**
 * Extraction from raw text lines (used for the PDF fallback). Providers on
 * the MOF list are company names, almost all carrying legal-form suffixes
 * (LLC, FZCO, DMCC, …). Contact details cannot be reliably column-mapped in
 * flat PDF text, so this strategy returns names/websites only — the
 * reconciler keeps existing contact data when a payload carries none.
 */
export function extractFromTextLines(lines: string[]): ExtractedProvider[] {
  const candidates: string[] = [];
  for (const raw of lines) {
    // Strip list numbering ("1. Foo", "12) Foo", "• Foo")
    const line = raw.replace(/^\s*(\d{1,3}[.)]|[-•▪●])\s*/, "").trim();
    if (!looksLikeCompanyName(line)) continue;
    if (/[@]/.test(line)) continue; // email lines are not company names
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

export interface RawRow {
  cells: string[];
  links: string[];
}

/**
 * Table-model extraction: the MOF layout is
 *   # | Company Name | Company Website | Contact Person | Email | Phone Number
 * The name is the first plausible company-name cell; the website is the first
 * external link (or a www.… token); contacts come from the remaining cells.
 */
export function extractFromRows(rows: RawRow[]): ExtractedProvider[] {
  const out: ExtractedProvider[] = [];
  for (const row of rows) {
    const nameIdx = row.cells.findIndex(
      (c) =>
        looksLikeCompanyName(c.split("\n")[0] ?? c) &&
        !EMAIL_RE.test(c) &&
        (hasLegalSuffix(c) || row.cells.length > 1),
    );
    if (nameIdx === -1) continue;
    const nameCell = row.cells[nameIdx].split("\n")[0].trim();

    let website =
      row.links.find(
        (href) =>
          /^https?:\/\//i.test(href) &&
          !/mof\.gov\.ae|\.pdf($|\?)|mailto:|tel:/i.test(href),
      ) ?? null;
    if (!website) {
      const wwwToken = row.cells
        .slice(nameIdx + 1)
        .join(" ")
        .match(/\bwww\.[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?/i);
      if (wwwToken) website = `https://${wwwToken[0]}`;
    }

    const contacts = buildContacts(row.cells.slice(nameIdx + 1));
    out.push({
      name: nameCell,
      website,
      contacts: contacts.length > 0 ? contacts : undefined,
    });
  }
  return dedupe(out);
}
