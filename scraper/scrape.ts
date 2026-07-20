/**
 * MOF pre-approved e-invoicing service provider list scraper.
 *
 * Runs in GitHub Actions (weekly cron + manual dispatch). Strategy chain:
 *   1. HTML: real Chromium via Playwright (passes the WAF that blocks plain
 *      HTTP clients), DOM table/card extraction with a text-pattern fallback.
 *   2. PDF: the list's PDF mirror, downloaded through the same browser
 *      context (shares WAF cookies), parsed with pdf-parse.
 *
 * Whatever succeeds is POSTed to the site's ingest endpoint, where ALL
 * fail-safe logic lives (sanity gates, never-delete, grace periods). If every
 * strategy fails, a failure report is POSTed instead so the site records the
 * run and alerts the admin. This script deliberately contains no update
 * logic — it only fetches, extracts, and reports.
 */

import { chromium, type Browser, type Page } from "playwright";
import pdf from "pdf-parse";
import { z } from "zod";
import {
  dedupe,
  extractFromRows,
  extractFromTextLines,
  type ExtractedProvider,
  type RawRow,
} from "./extract.js";

const MOF_URL =
  process.env.MOF_URL ??
  "https://mof.gov.ae/en/about-us/initiatives/einvoicing/pre-approved-einvoicing-service-providers/";
const INGEST_URL = process.env.INGEST_URL; // e.g. https://<domain>/api/ingest/providers
const INGEST_SECRET = process.env.INGEST_SECRET;
const TRIGGERED_BY = process.env.TRIGGERED_BY ?? "cron";
const MIN_PROVIDERS = 20;

const resultSchema = z.object({
  strategy: z.enum(["scrape_html", "scrape_pdf"]),
  providers: z
    .array(z.object({ name: z.string().min(2), website: z.string().nullable() }))
    .min(MIN_PROVIDERS),
});

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    locale: "en-AE",
    timezoneId: "Asia/Dubai",
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    extraHTTPHeaders: { "Accept-Language": "en-AE,en;q=0.9,ar;q=0.8" },
  });
  return context.newPage();
}

async function htmlStrategy(page: Page): Promise<ExtractedProvider[]> {
  await page.goto(MOF_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  // Some WAFs interpose a JS challenge; give it a moment to clear.
  await page.waitForTimeout(4000);

  // 1) Table rows anywhere in the main content
  const rows: RawRow[] = await page.$$eval("table tr", (trs) =>
    trs.map((tr) => ({
      cells: Array.from(tr.querySelectorAll("td,th")).map(
        (td) => td.textContent?.trim() ?? "",
      ),
      links: Array.from(tr.querySelectorAll("a[href]")).map(
        (a) => (a as HTMLAnchorElement).href,
      ),
    })),
  );
  const fromTable = extractFromRows(
    rows.filter((r) => r.cells.length > 0 && !r.cells.every((c) => !c)),
  );
  if (fromTable.length >= MIN_PROVIDERS) return fromTable;

  // 2) Card/list items in the content area
  const items: RawRow[] = await page.$$eval(
    "main li, main h3, main h4, article li, article h3, .entry-content li, .entry-content h3, .wp-block-group p",
    (els) =>
      els.map((el) => ({
        cells: [el.textContent?.trim() ?? ""],
        links: Array.from(el.querySelectorAll("a[href]")).map(
          (a) => (a as HTMLAnchorElement).href,
        ),
      })),
  );
  const fromCards = extractFromRows(items);
  if (fromCards.length >= MIN_PROVIDERS) return fromCards;

  // 3) Raw text-pattern fallback over the whole page
  const bodyText = await page.evaluate(() => document.body.innerText);
  const fromText = extractFromTextLines(bodyText.split("\n"));
  if (fromText.length >= MIN_PROVIDERS) return fromText;

  // Combine partial signals before giving up
  const combined = dedupe([...fromTable, ...fromCards, ...fromText]);
  if (combined.length >= MIN_PROVIDERS) return combined;

  throw new Error(
    `HTML strategy found only ${combined.length} provider-like entries (need ${MIN_PROVIDERS})`,
  );
}

async function pdfStrategy(page: Page): Promise<ExtractedProvider[]> {
  // Find a PDF link on the page (list mirror). If page never loaded, try a
  // navigation first; ignore errors — the link search is what matters.
  try {
    if (page.url() === "about:blank") {
      await page.goto(MOF_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
  } catch {
    /* page may be blocked; fall through to known URL patterns */
  }

  let pdfUrls: string[] = [];
  try {
    pdfUrls = await page.$$eval('a[href*=".pdf"]', (as) =>
      as.map((a) => (a as HTMLAnchorElement).href),
    );
  } catch {
    /* ignore */
  }
  const candidates = [
    ...pdfUrls.filter((u) => /pre-?approved|service-?provider|asp/i.test(u)),
    ...pdfUrls,
    // Known historic location of the list PDF as a last resort
    "https://mof.gov.ae/wp-content/uploads/2025/10/Pre-approved-service-providers-page.pdf",
  ];

  for (const url of [...new Set(candidates)]) {
    try {
      const response = await page.context().request.get(url, { timeout: 60000 });
      if (!response.ok()) continue;
      const buffer = await response.body();
      const parsed = await pdf(buffer);
      const providers = extractFromTextLines(parsed.text.split("\n"));
      if (providers.length >= MIN_PROVIDERS) return providers;
    } catch {
      continue;
    }
  }
  throw new Error("PDF strategy: no parseable list PDF found");
}

async function post(path: string, body: unknown): Promise<void> {
  if (!INGEST_URL || !INGEST_SECRET) {
    console.log(`[dry-run] would POST to ${path}:`);
    console.log(JSON.stringify(body, null, 2).slice(0, 3000));
    return;
  }
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INGEST_SECRET}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`Ingest response ${res.status}: ${text.slice(0, 2000)}`);
  if (!res.ok) throw new Error(`Ingest endpoint returned ${res.status}`);
}

async function main() {
  const browser = await chromium.launch({
    args: ["--disable-blink-features=AutomationControlled"],
    // Allows local/dev environments with a system Chromium to run the scraper
    // without `playwright install`; unset in CI where browsers are installed.
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  });
  const errors: string[] = [];

  try {
    const page = await newPage(browser);

    for (const [strategy, fn] of [
      ["scrape_html", htmlStrategy],
      ["scrape_pdf", pdfStrategy],
    ] as const) {
      try {
        console.log(`Trying strategy: ${strategy}…`);
        const providers = await fn(page);
        const payload = resultSchema.parse({ strategy, providers });
        console.log(`${strategy}: extracted ${providers.length} providers`);
        await post("ingest", {
          strategy: payload.strategy,
          triggeredBy: TRIGGERED_BY,
          scrapedAt: new Date().toISOString(),
          providers: payload.providers,
        });
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${strategy} failed: ${message}`);
        errors.push(`${strategy}: ${message}`);
      }
    }

    // Every strategy failed → report so the app records + alerts.
    await post("failure", {
      status: "failed",
      triggeredBy: TRIGGERED_BY,
      error: errors.join(" | ").slice(0, 4900),
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
