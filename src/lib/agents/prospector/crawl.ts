import { resolveMx } from "node:dns/promises";

/**
 * Polite contact discovery on a prospect's own website.
 *
 * Rules this crawler holds to: obey robots.txt, at most a handful of pages per
 * domain, a real user agent that identifies us with a contact URL, hard
 * timeouts, and no assets — HTML only. It is a courtesy crawl for a public
 * contact address, not a scrape.
 */

export const CRAWLER_UA =
  "UAEASPBot/1.0 (+https://uaeasp.ae/about; contact directory research)";

/**
 * Pages worth a look, in the order we try them.
 *
 * Team and leadership pages sit high in this list because they are where a
 * named person's address lives. A contact page usually offers info@ and
 * nothing else; a team page offers "Layla Haddad, Finance Manager" with the
 * mailbox that actually reaches her.
 */
const CONTACT_PATHS = [
  "/",
  "/contact",
  "/contact-us",
  "/team",
  "/our-team",
  "/about",
  "/about-us",
  "/leadership",
  "/management",
  "/people",
  "/ar/contact",
];

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?![a-zA-Z0-9.-]*\.(png|jpg|jpeg|gif|webp|svg|css|js))/g;

const ROLE_PREFIXES = [
  "info",
  "sales",
  "contact",
  "hello",
  "enquiries",
  "enquiry",
  "inquiries",
  "admin",
  "office",
  "support",
  "accounts",
  "finance",
  "marketing",
  // Department mailboxes are just as shared as info@, and just as likely to
  // sit next to a heading that is not a person's name.
  "commercial",
  "communications",
  "corporate",
  "business",
  "careers",
  "jobs",
  "hr",
  "recruitment",
  "media",
  "press",
  "customerservice",
  "customercare",
  "service",
  "services",
  "help",
  "bookings",
  "reservations",
  "operations",
  "logistics",
  "procurement",
  "purchase",
  "purchasing",
  "tenders",
  "quality",
  "export",
  "imports",
  "shipping",
  "billing",
  "invoices",
  "ap",
  "ar",
  "general",
  "mail",
  "team",
];

/** Addresses that are never a real person and never worth mailing. */
const JUNK_PREFIXES = [
  "noreply",
  "no-reply",
  "donotreply",
  "postmaster",
  "abuse",
  "webmaster",
  "privacy",
  "unsubscribe",
  "mailer-daemon",
];

const JUNK_DOMAINS = [
  "sentry.io",
  "wixpress.com",
  "example.com",
  "domain.com",
  "yourdomain.com",
  "godaddy.com",
  "squarespace.com",
  "cloudflare.com",
  "w3.org",
  "schema.org",
  "sentry-next.wixpress.com",
];

export interface FoundContact {
  email: string;
  /** The person the mailbox belongs to, when the site actually says so. */
  name: string | null;
  /** Their job title, when it sits next to the name. */
  role: string | null;
  isRoleAccount: boolean;
  sourceUrl: string;
}

/** What a crawled page told us about the business, beyond its addresses. */
export interface CrawledPage {
  url: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
}

const TAG_RE = {
  title: /<title[^>]*>([\s\S]{0,300}?)<\/title>/i,
  description: /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,500})["']/i,
  ogDescription: /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{0,500})["']/i,
  heading: /<h[123][^>]*>([\s\S]{0,200}?)<\/h[123]>/gi,
};

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d{2,5});/g, (_m, code: string) => String.fromCharCode(Number(code)));
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Pull the human-readable substance out of a page.
 *
 * We already fetch these pages to find an address and then throw the rest away,
 * which is why outreach had nothing to say about the recipient. Keeping the
 * title, meta description, headings and body text costs one extra pass over
 * HTML that is already in memory, and it is the whole difference between "Dear
 * business owner" and a first line that proves we looked.
 */
export function extractPageFacts(html: string, url: string): CrawledPage {
  // Scripts and styles are pure noise and can be enormous — drop them first so
  // neither the regexes below nor the digest ever see them.
  const body = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const headings: string[] = [];
  for (const match of body.matchAll(TAG_RE.heading)) {
    const heading = stripTags(match[1]);
    if (heading.length > 2 && heading.length < 160 && !headings.includes(heading)) {
      headings.push(heading);
    }
    if (headings.length >= 12) break;
  }

  return {
    url,
    title: stripTags(body.match(TAG_RE.title)?.[1] ?? "").slice(0, 200),
    description: stripTags(
      body.match(TAG_RE.description)?.[1] ?? body.match(TAG_RE.ogDescription)?.[1] ?? "",
    ).slice(0, 400),
    headings,
    text: stripTags(body).slice(0, 4000),
  };
}

/**
 * Flatten crawled pages into a compact brief for the model.
 *
 * Bounded deliberately: this text is pasted into a prompt, and an attacker who
 * controls their own website controls every byte of it.
 */
export function buildSiteDigest(pages: CrawledPage[], maxChars = 3500): string {
  const parts: string[] = [];
  for (const page of pages) {
    const section = [
      `PAGE: ${page.url}`,
      page.title && `Title: ${page.title}`,
      page.description && `Description: ${page.description}`,
      page.headings.length && `Headings: ${page.headings.slice(0, 8).join(" | ")}`,
      page.text && `Text: ${page.text.slice(0, 1200)}`,
    ]
      .filter(Boolean)
      .join("\n");
    parts.push(section);
  }
  return parts.join("\n\n").slice(0, maxChars);
}

export function registrableDomain(input: string): string | null {
  try {
    const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
    return url.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

export function isRoleAccount(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return ROLE_PREFIXES.some((p) => local === p || local.startsWith(`${p}.`));
}

export function isJunkAddress(email: string): boolean {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return true;
  if (JUNK_PREFIXES.some((p) => local.startsWith(p))) return true;
  if (JUNK_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  // Image sprites and hashed asset names occasionally look like addresses.
  if (/^[0-9a-f]{16,}$/.test(local)) return true;
  // Percent-escapes leak in from mailto: hrefs — a live site yielded
  // "%20advisory@…". The domain is real, so MX verification passes it and the
  // bounce only arrives after we have mailed it. Refuse it here instead.
  if (local.includes("%")) return true;
  return false;
}

/* ------------------------------------------------------------------ *
 * Whose mailbox is this?
 *
 * An address on its own tells you almost nothing to say. "Hello," opens a
 * cold email that reads like every other cold email; "Hi Layla," opens one
 * that reads like it was meant for her. So when we are already on the page
 * that lists the address, we take the trouble to work out who owns it.
 *
 * Every rule here fails closed. A wrong name is far worse than no name —
 * "Hi Contact," or "Hi Dubai," destroys the message — so anything we are not
 * confident about is discarded and the greeting falls back to "Hello,".
 * ------------------------------------------------------------------ */

/** Words that appear inside candidate names but prove it is not a person. */
const NON_NAME_WORDS = new Set([
  "contact", "contacts", "email", "e-mail", "mail", "us", "here", "click",
  "info", "information", "enquiry", "enquiries", "inquiry", "inquiries",
  "team", "sales", "support", "admin", "office", "general", "customer",
  "service", "services", "department", "dept", "hr", "careers", "jobs",
  "address", "phone", "tel", "mobile", "fax", "whatsapp", "location",
  "branch", "head", "main", "our", "the", "and", "for", "llc", "fzco",
  "fze", "ltd", "limited", "company", "co", "group", "trading", "est",
  "establishment", "corporation", "corp", "inc", "uae", "dubai", "sharjah",
  "abu", "dhabi", "ajman", "fujairah", "ras", "khaimah", "umm", "quwain",
  "reserved", "rights", "copyright", "privacy", "policy", "terms", "home",
  "about", "read", "more", "send", "message", "write", "reach", "get",
  "touch", "now", "today", "free", "quote", "book", "call", "hello",
]);

/** Honorifics to drop before judging a candidate name. */
const TITLE_RE = /^(mr|mrs|ms|miss|dr|eng|engr|prof|sheikh|shaikh|hh|he)\.?\s+/i;

/**
 * Job-title words. These do double duty: they mark the line next to a name as
 * that person's role, and they disqualify a line from being a name at all.
 * Without the second use, "Finance Manager" reads as a perfectly good name
 * and the email opens "Hi Finance,".
 */
const ROLE_WORDS = [
  "manager", "director", "ceo", "cfo", "coo", "cto", "chairman", "founder",
  "co-founder", "owner", "partner", "principal", "president", "vice",
  "head", "chief", "officer", "supervisor", "executive", "accountant",
  "controller", "consultant", "lead", "specialist", "administrator",
  "proprietor", "gm", "md", "vp", "finance", "accounting", "accounts",
  "operations", "logistics", "procurement", "commercial", "technical",
  "regional", "senior", "junior", "assistant", "deputy", "coordinator",
  "representative", "engineer", "analyst", "advisor", "adviser", "staff",
];

/**
 * Turn HTML into lines, keeping the block structure that gives an address its
 * meaning. Stripping straight to a single string loses exactly the signal we
 * need: on a team card, the name is the line above the address.
 */
export function htmlToLines(html: string): string[] {
  const withBreaks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|td|th|tr|h[1-6]|section|article|span|a|strong|b|em)\s*>/gi, "\n");
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Is this string plausibly a person's name?
 *
 * Deliberately strict. Two to four words, letters only, none of them a word
 * that betrays a label ("Contact Us", "Sales Team", "Dubai Office"). A single
 * word is rejected outright: "Ahmed" and "Accounts" are indistinguishable
 * without context we do not have.
 */
export function isPersonName(raw: string): boolean {
  const candidate = cleanName(raw);
  if (candidate.length < 4 || candidate.length > 60) return false;
  if (/[\d@/\\|<>(){}[\]:;!?*#%$€£+=_"]/.test(candidate)) return false;
  const words = candidate.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => {
    if (!/^[\p{L}][\p{L}'’.-]{0,24}$/u.test(word)) return false;
    const bare = word.toLowerCase().replace(/[.'’-]+$/, "");
    return !NON_NAME_WORDS.has(bare) && !ROLE_WORDS.includes(bare);
  });
}

/** Strip the honorific and normalise spacing, once a name has been accepted. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(TITLE_RE, "").trim().slice(0, 80);
}

function looksLikeRole(line: string): boolean {
  if (line.length < 2 || line.length > 80) return false;
  const lower = line.toLowerCase();
  return ROLE_WORDS.some((word) => new RegExp(`\\b${word}\\b`).test(lower));
}

/**
 * Recover a name from the mailbox itself — but only when the local part uses a
 * separator, e.g. "layla.haddad@" or "a_khan@".
 *
 * A separator is a real signal that the domain names mailboxes after people.
 * A bare "ahmed@" is not: it is indistinguishable from "accounts@" or
 * "dubai@" without a dictionary we do not have, and guessing wrong puts the
 * wrong name at the top of the email. So bare local parts get no name.
 */
export function nameFromLocalPart(email: string): string | null {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (!/^[a-z]{2,}[._-][a-z]{2,}$/.test(local)) return null;
  const parts = local.split(/[._-]/);
  if (parts.length !== 2) return null;
  if (parts.some((part) => NON_NAME_WORDS.has(part) || ROLE_PREFIXES.includes(part))) return null;
  const name = parts.map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
  return isPersonName(name) ? name : null;
}

interface Attribution {
  name: string | null;
  role: string | null;
}

/** Names carried in JSON-LD, which is the one place a site states them exactly. */
function attributionFromJsonLd(html: string, email: string): Attribution | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]{0,20000}?)<\/script>/gi,
  );
  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const found = walkJsonLd(parsed, email);
    if (found) return found;
  }
  return null;
}

function walkJsonLd(node: unknown, email: string, depth = 0): Attribution | null {
  if (depth > 6 || !node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = walkJsonLd(child, email, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  const nodeEmail = typeof record.email === "string" ? record.email : "";
  if (nodeEmail.toLowerCase().replace(/^mailto:/, "") === email) {
    const name = typeof record.name === "string" ? record.name : "";
    const role = typeof record.jobTitle === "string" ? record.jobTitle : "";
    if (isPersonName(name)) {
      return { name: cleanName(name), role: role ? role.trim().slice(0, 80) : null };
    }
  }
  for (const value of Object.values(record)) {
    const found = walkJsonLd(value, email, depth + 1);
    if (found) return found;
  }
  return null;
}

/** The text of a mailto link, when the site labelled the link with a person. */
function attributionFromMailto(html: string, email: string): Attribution | null {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const anchors = html.matchAll(
    new RegExp(`<a[^>]+href=["']mailto:${escaped}[^"']*["'][^>]*>([\\s\\S]{0,200}?)</a>`, "gi"),
  );
  for (const anchor of anchors) {
    const text = stripTags(anchor[1]);
    if (isPersonName(text)) return { name: cleanName(text), role: null };
  }
  return null;
}

/**
 * The last resort and the most common case: read the lines around the address
 * the way a person would. On a team card the name is one or two lines above
 * the mailbox, often with the job title in between.
 */
function attributionFromLines(lines: string[], email: string): Attribution | null {
  for (const [index, line] of lines.entries()) {
    if (!line.toLowerCase().includes(email)) continue;

    // "Layla Haddad - Finance Manager - layla@x.ae" on a single line.
    const inline = line.split(/[|•·—–-]|,\s/).map((part) => part.trim());
    const inlineName = inline.find((part) => isPersonName(part));
    if (inlineName) {
      const inlineRole = inline.find((part) => part !== inlineName && looksLikeRole(part));
      return { name: cleanName(inlineName), role: inlineRole ?? null };
    }

    // Otherwise walk back up the card: nearest name wins, and any role line
    // between it and the address belongs to that name.
    let role: string | null = null;
    for (let back = index - 1; back >= Math.max(0, index - 3); back -= 1) {
      const above = lines[back];
      if (isPersonName(above)) return { name: cleanName(above), role };
      if (!role && looksLikeRole(above)) role = above;
    }
  }
  return null;
}

/**
 * Best available attribution for one address on one page, most trustworthy
 * source first. Structured data beats a link label beats reading the layout
 * beats inferring from the mailbox name.
 */
export function attributeContact(html: string, lines: string[], email: string): Attribution {
  // Structured data and a mailto label are the site telling us directly that
  // this name owns this address, so they are taken at face value.
  const stated = attributionFromJsonLd(html, email) ?? attributionFromMailto(html, email);
  if (stated) return stated;

  // Reading the layout is a guess, and on a real site it guesses wrong: a
  // page heading two lines above commercial@ produced "Digital Technologies".
  // So a name inferred from position has to be corroborated by the mailbox
  // itself before we will believe it.
  const nearby = attributionFromLines(lines, email);
  if (nearby?.name && corroborates(nearby.name, email)) return nearby;
  // The role can still be trusted even when the name could not be — it was
  // read off the same block and is never used to address anyone.
  const role = nearby?.role ?? null;

  return { name: nameFromLocalPart(email), role };
}

/**
 * Does the mailbox back up the name we think we read?
 *
 * "Layla Haddad" beside l.haddad@ or lh@ is a match. "Digital Technologies"
 * beside commercial@ is not, and that is the whole point.
 */
export function corroborates(name: string, email: string): boolean {
  const letters = (email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!letters) return false;
  const tokens = name
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}]/gu, ""))
    .filter((token) => token.length >= 2);
  if (!tokens.length) return false;
  if (tokens.some((token) => letters.includes(token))) return true;
  const initials = tokens.map((token) => token[0]).join("");
  return initials.length >= 2 && letters === initials;
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": CRAWLER_UA, Accept: "text/html,text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return null;
    const text = await res.text();
    // Guard against multi-megabyte pages.
    return text.slice(0, 500_000);
  } catch {
    return null;
  }
}

/** Parse robots.txt into the set of disallowed prefixes for our agent. */
export function parseRobots(body: string): { disallowed: string[]; crawlDelay: number } {
  const lines = body.split("\n").map((l) => l.trim());
  const disallowed: string[] = [];
  let crawlDelay = 0;
  let applies = false;
  for (const line of lines) {
    if (/^#/.test(line) || !line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      applies = value === "*" || value.toLowerCase().includes("uaeaspbot");
      continue;
    }
    if (!applies) continue;
    if (key === "disallow" && value) disallowed.push(value);
    if (key === "crawl-delay") crawlDelay = Math.min(Number(value) || 0, 10);
  }
  return { disallowed, crawlDelay };
}

export function robotsAllows(path: string, disallowed: string[]): boolean {
  return !disallowed.some((rule) => rule !== "" && path.startsWith(rule));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Visit a small set of likely contact pages and return the addresses found,
 * best first (personal mailboxes on the site's own domain rank above shared
 * ones, and anything off-domain ranks last).
 */
export async function findContactEmails(
  websiteUrl: string,
  maxPages = 5,
): Promise<FoundContact[]> {
  return (await crawlSite(websiteUrl, maxPages)).contacts;
}

/**
 * One courtesy crawl, two outputs: the addresses we may write to, and what the
 * business says about itself. Same pages, same budget — we were already paying
 * for the fetch and discarding half of what came back.
 */
export async function crawlSite(
  websiteUrl: string,
  maxPages = 5,
): Promise<{ contacts: FoundContact[]; pages: CrawledPage[] }> {
  const domain = registrableDomain(websiteUrl);
  if (!domain) return { contacts: [], pages: [] };
  const origin = websiteUrl.startsWith("http") ? new URL(websiteUrl).origin : `https://${domain}`;

  const robotsBody = await fetchText(`${origin}/robots.txt`, 8000);
  const { disallowed, crawlDelay } = robotsBody
    ? parseRobots(robotsBody)
    : { disallowed: [], crawlDelay: 0 };

  const found = new Map<string, FoundContact>();
  const pages: CrawledPage[] = [];
  let visited = 0;

  for (const path of CONTACT_PATHS) {
    if (visited >= maxPages) break;
    if (!robotsAllows(path, disallowed)) continue;
    const html = await fetchText(`${origin}${path}`);
    visited += 1;
    if (crawlDelay) await sleep(crawlDelay * 1000);
    if (!html) continue;

    const facts = extractPageFacts(html, `${origin}${path}`);
    if (facts.title || facts.description || facts.text) pages.push(facts);

    const lines = htmlToLines(html);
    const matches = html.match(EMAIL_RE) ?? [];
    for (const rawMatch of matches) {
      const email = rawMatch.toLowerCase().replace(/\.$/, "");
      if (isJunkAddress(email)) continue;
      const attribution = attributeContact(html, lines, email);
      const existing = found.get(email);
      if (existing) {
        // A later page can still tell us who the mailbox belongs to — the
        // contact page gives the address, the team page gives the person.
        existing.name ??= attribution.name;
        existing.role ??= attribution.role;
        continue;
      }
      found.set(email, {
        email,
        name: attribution.name,
        role: attribution.role,
        isRoleAccount: isRoleAccount(email),
        sourceUrl: `${origin}${path}`,
      });
    }
    // Stop only once we have a named person on their own domain. The old rule
    // stopped at any personal address, which meant a bare "ahmed@" on the home
    // page kept us off the team page that would have told us who Ahmed is.
    if ([...found.values()].some((c) => contactRank(c, domain) === 0)) break;
  }

  return {
    contacts: [...found.values()].sort((a, b) => contactRank(a, domain) - contactRank(b, domain)),
    pages,
  };
}

/**
 * How good a contact is, lowest first.
 *
 * The ordering encodes one preference: reach a person, not a mailbox. A named
 * individual on the company's own domain is worth several times a shared
 * info@, because the mail lands with someone who can answer it rather than in
 * a queue nobody owns.
 */
export function contactRank(contact: FoundContact, domain: string): number {
  const onDomain = contact.email.endsWith(`@${domain}`);
  const personal = !contact.isRoleAccount;
  if (onDomain && personal) return contact.name ? 0 : 1;
  if (!onDomain && personal) return contact.name ? 2 : 3;
  return onDomain ? 4 : 5;
}

/** Link text and hrefs that suggest a page naming individual people. */
const PEOPLE_HINTS = [
  "team", "people", "staff", "management", "leadership", "directors",
  "board", "who-we-are", "who we are", "our-people", "our people",
  "meet-the", "meet the", "executive", "founders", "contact",
];

/**
 * Find the pages on a site that name individuals, by reading its own links.
 *
 * The fixed path list handles the common cases; this handles the rest. Plenty
 * of UAE company sites put their people at /company/our-leadership or
 * /en/about/management, which no guessed path will ever hit.
 */
export function peoplePageLinks(html: string, origin: string, limit = 6): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const [, href, label] = match;
    const haystack = `${href} ${stripTags(label)}`.toLowerCase();
    if (!PEOPLE_HINTS.some((hint) => haystack.includes(hint))) continue;
    let resolved: URL;
    try {
      resolved = new URL(href, origin);
    } catch {
      continue;
    }
    // Same-origin only: an off-site "team" link is someone else's staff.
    if (resolved.origin !== origin) continue;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|docx?|xlsx?)$/i.test(resolved.pathname)) continue;
    const path = resolved.pathname + resolved.search;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * A second, deeper pass for a prospect we only have a shared mailbox for.
 *
 * Run after the ordinary crawl has failed to name anyone: start from the home
 * page, follow the site's own links to wherever it lists its people, and read
 * those. More expensive than the fixed-path crawl, so it is only worth paying
 * for the prospects that need it.
 */
export async function findDirectContacts(
  websiteUrl: string,
  maxPages = 6,
): Promise<FoundContact[]> {
  const domain = registrableDomain(websiteUrl);
  if (!domain) return [];
  const origin = websiteUrl.startsWith("http") ? new URL(websiteUrl).origin : `https://${domain}`;

  const robotsBody = await fetchText(`${origin}/robots.txt`, 8000);
  const { disallowed, crawlDelay } = robotsBody
    ? parseRobots(robotsBody)
    : { disallowed: [], crawlDelay: 0 };

  const home = await fetchText(origin);
  if (!home) return [];
  const paths = peoplePageLinks(home, origin, maxPages);

  const found = new Map<string, FoundContact>();
  let visited = 0;
  for (const path of paths) {
    if (visited >= maxPages) break;
    if (!robotsAllows(path, disallowed)) continue;
    const html = await fetchText(`${origin}${path}`);
    visited += 1;
    if (crawlDelay) await sleep(crawlDelay * 1000);
    if (!html) continue;

    const lines = htmlToLines(html);
    for (const rawMatch of html.match(EMAIL_RE) ?? []) {
      const email = rawMatch.toLowerCase().replace(/\.$/, "");
      if (isJunkAddress(email)) continue;
      const attribution = attributeContact(html, lines, email);
      const existing = found.get(email);
      if (existing) {
        existing.name ??= attribution.name;
        existing.role ??= attribution.role;
        continue;
      }
      found.set(email, {
        email,
        name: attribution.name,
        role: attribution.role,
        isRoleAccount: isRoleAccount(email),
        sourceUrl: `${origin}${path}`,
      });
    }
    if ([...found.values()].some((c) => contactRank(c, domain) === 0)) break;
  }

  return [...found.values()].sort((a, b) => contactRank(a, domain) - contactRank(b, domain));
}

export type VerificationResult = "syntax_ok" | "mx_ok" | "invalid" | "risky";

const SYNTAX_RE = /^[^\s@]+@[^\s@,]+\.[a-zA-Z]{2,}$/;
const DISPOSABLE_DOMAINS = ["mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com"];

/**
 * Verify an address as far as we honestly can from a container: syntax, then a
 * live MX lookup for the domain. A full SMTP RCPT probe is not possible here —
 * outbound port 25 is blocked on App Platform — and most large providers accept
 * everything anyway, so MX plus a bounce-driven suppression list is the honest
 * ceiling.
 */
export async function verifyEmail(email: string): Promise<VerificationResult> {
  if (!SYNTAX_RE.test(email)) return "invalid";
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return "invalid";
  if (DISPOSABLE_DOMAINS.includes(domain)) return "invalid";
  try {
    const records = await resolveMx(domain);
    return records.length > 0 ? "mx_ok" : "invalid";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // NXDOMAIN means the domain does not exist at all; anything else (timeout,
    // SERVFAIL) is inconclusive, so we keep the address but flag it.
    if (code === "ENOTFOUND" || code === "ENODATA") return "invalid";
    return "risky";
  }
}
