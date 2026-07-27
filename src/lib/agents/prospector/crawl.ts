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

const CONTACT_PATHS = [
  "/",
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
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
  isRoleAccount: boolean;
  sourceUrl: string;
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
  return false;
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
  maxPages = 4,
): Promise<FoundContact[]> {
  const domain = registrableDomain(websiteUrl);
  if (!domain) return [];
  const origin = websiteUrl.startsWith("http") ? new URL(websiteUrl).origin : `https://${domain}`;

  const robotsBody = await fetchText(`${origin}/robots.txt`, 8000);
  const { disallowed, crawlDelay } = robotsBody
    ? parseRobots(robotsBody)
    : { disallowed: [], crawlDelay: 0 };

  const found = new Map<string, FoundContact>();
  let visited = 0;

  for (const path of CONTACT_PATHS) {
    if (visited >= maxPages) break;
    if (!robotsAllows(path, disallowed)) continue;
    const html = await fetchText(`${origin}${path}`);
    visited += 1;
    if (crawlDelay) await sleep(crawlDelay * 1000);
    if (!html) continue;

    const matches = html.match(EMAIL_RE) ?? [];
    for (const rawMatch of matches) {
      const email = rawMatch.toLowerCase().replace(/\.$/, "");
      if (isJunkAddress(email)) continue;
      if (found.has(email)) continue;
      found.set(email, {
        email,
        isRoleAccount: isRoleAccount(email),
        sourceUrl: `${origin}${path}`,
      });
    }
    // A page with a personal address is as good as it gets — stop early.
    if ([...found.values()].some((c) => !c.isRoleAccount && c.email.endsWith(`@${domain}`))) {
      break;
    }
  }

  return [...found.values()].sort((a, b) => rank(a, domain) - rank(b, domain));
}

function rank(contact: FoundContact, domain: string): number {
  const onDomain = contact.email.endsWith(`@${domain}`);
  if (onDomain && !contact.isRoleAccount) return 0;
  if (onDomain) return 1;
  return contact.isRoleAccount ? 3 : 2;
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
