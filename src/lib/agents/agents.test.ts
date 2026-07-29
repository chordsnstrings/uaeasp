import { describe, expect, it } from "vitest";
import { buildRawMessage, encodeHeaderWord, sanitizeAddress } from "./ses";
import { decodeQuotedPrintable, htmlToText, parseEmail, stripQuotedReply } from "./mime";
import {
  isJunkAddress,
  isRoleAccount,
  parseRobots,
  registrableDomain,
  robotsAllows,
} from "./prospector/crawl";
import { buildSweepQueries, parseEmirate } from "./prospector/places";
import { dubaiDayStart, emailDomain, normalizeEmail, rampedCap } from "./mailer";
import { DEFAULT_AGENT_CONFIG, type AgentConfig } from "./config";
import { findOwnPosition } from "./visibility/search";
import { urlsWorthPinging } from "./visibility";
import { LANDING_SLUGS, landingContent } from "@/content/landings";
import {
  classifyQuery,
  isActionableQuery,
  isoDay,
  localeOf,
  explainIndexingError,
  isHubPath,
  needsDedicatedPage,
  parseServiceAccount,
  type SearchAnalyticsRow,
} from "./visibility/gsc";
import { dubaiHour, refreshIsDue } from "./maintenance";
import { AI_JOBS, pickModel } from "@/lib/ai/models";
import { certUrlIsTrusted, subscribeUrlIsTrusted } from "./sns";
import { firstName, keywordIntent, personalisationEvidence } from "./conversationalist";
import { buildSiteDigest, extractPageFacts } from "./prospector/crawl";
import {
  MANDATE_PHASES,
  VOLUNTARY_START_ISO,
  appointmentDeadlineFor,
  formatMandateDate,
  mandateTimelineLines,
} from "@/content/mandate";

describe("SES message building", () => {
  it("includes one-click unsubscribe headers when a URL is given", () => {
    const raw = buildRawMessage({
      from: "hello@send.uaeasp.ae",
      fromName: "UAE E-Invoicing Providers",
      to: "finance@example.ae",
      subject: "Provider shortlist",
      text: "Hello there",
      messageId: "abc-123@uaeasp.ae",
      unsubscribeUrl: "https://uaeasp.ae/api/outreach/unsubscribe?t=token",
    });
    expect(raw).toContain("List-Unsubscribe: <https://uaeasp.ae/api/outreach/unsubscribe?t=token>");
    expect(raw).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    expect(raw).toContain("Message-ID: <abc-123@uaeasp.ae>");
  });

  it("threads replies with In-Reply-To and References", () => {
    const raw = buildRawMessage({
      from: "hello@send.uaeasp.ae",
      to: "finance@example.ae",
      subject: "Re: shortlist",
      text: "Following up",
      messageId: "new@uaeasp.ae",
      inReplyTo: "old@uaeasp.ae",
      references: "<old@uaeasp.ae>",
    });
    expect(raw).toContain("In-Reply-To: <old@uaeasp.ae>");
    expect(raw).toContain("References: <old@uaeasp.ae>");
  });

  it("builds multipart when HTML is supplied and base64-encodes both parts", () => {
    const raw = buildRawMessage({
      from: "a@b.ae",
      to: "c@d.ae",
      subject: "Test",
      text: "plain body",
      html: "<p>html body</p>",
      messageId: "m1@b.ae",
    });
    expect(raw).toContain("multipart/alternative");
    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(raw).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(raw).toContain(Buffer.from("plain body", "utf8").toString("base64"));
  });

  it("RFC 2047 encodes non-ASCII header words only when needed", () => {
    expect(encodeHeaderWord("Plain Subject")).toBe("Plain Subject");
    expect(encodeHeaderWord("الفوترة")).toMatch(/^=\?UTF-8\?B\?/);
  });
});

describe("inbound email parsing", () => {
  const rawReply = [
    "From: Layla Hassan <layla@example.ae>",
    "To: hello@send.uaeasp.ae",
    "Subject: Re: E-invoicing provider shortlist",
    "Message-ID: <reply-1@example.ae>",
    "In-Reply-To: <outbound-1@uaeasp.ae>",
    "References: <outbound-1@uaeasp.ae>",
    "Date: Mon, 20 Jul 2026 09:15:00 +0400",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    "Yes please, send the shortlist. We issue about 900 invoices a month on Zoho Books.",
    "",
    "On Sun, 19 Jul 2026 at 10:00, UAE E-Invoicing wrote:",
    "> Our directory lists every accredited provider.",
  ].join("\n");

  it("extracts sender, threading headers and body", () => {
    const parsed = parseEmail(rawReply);
    expect(parsed.from).toBe("layla@example.ae");
    expect(parsed.fromName).toBe("Layla Hassan");
    expect(parsed.inReplyTo).toBe("outbound-1@uaeasp.ae");
    expect(parsed.references).toEqual(["outbound-1@uaeasp.ae"]);
    expect(parsed.text).toContain("Yes please");
  });

  it("strips the quoted history so only the new text remains", () => {
    const parsed = parseEmail(rawReply);
    const stripped = stripQuotedReply(parsed.text);
    expect(stripped).toContain("Yes please");
    expect(stripped).not.toContain("Our directory lists");
    expect(stripped).not.toContain("On Sun, 19 Jul 2026");
  });

  it("decodes base64 multipart bodies and prefers text/plain", () => {
    const boundary = "xyz";
    const raw = [
      "From: a@b.ae",
      "Subject: Test",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from("plain wins", "utf8").toString("base64"),
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "",
      "<p>html loses</p>",
      "",
      `--${boundary}--`,
      "",
    ].join("\n");
    expect(parseEmail(raw).text).toBe("plain wins");
  });

  it("decodes quoted-printable and flattens HTML", () => {
    expect(decodeQuotedPrintable("caf=C3=A9")).toBe("café");
    expect(htmlToText("<p>One</p><p>Two</p>")).toBe("One\nTwo");
    // Style/script blocks are dropped entirely; block ends become line breaks.
    expect(htmlToText("<style>a{}</style><div>Body</div><br>Line")).toBe("Body\n\nLine");
  });

  it("cuts at a signature delimiter", () => {
    expect(stripQuotedReply("Interested.\n--\nSent from my phone")).toBe("Interested.");
  });
});

describe("contact discovery", () => {
  it("normalises domains", () => {
    expect(registrableDomain("https://www.Example.ae/contact")).toBe("example.ae");
    expect(registrableDomain("example.ae")).toBe("example.ae");
    expect(registrableDomain("not a url")).toBe("not a url".includes(" ") ? null : null);
  });

  it("flags shared mailboxes without discarding them", () => {
    expect(isRoleAccount("info@example.ae")).toBe(true);
    expect(isRoleAccount("sales.uae@example.ae")).toBe(true);
    expect(isRoleAccount("layla@example.ae")).toBe(false);
  });

  it("rejects addresses that are never worth mailing", () => {
    expect(isJunkAddress("noreply@example.ae")).toBe(true);
    expect(isJunkAddress("postmaster@example.ae")).toBe(true);
    expect(isJunkAddress("someone@sentry.io")).toBe(true);
    expect(isJunkAddress("a1b2c3d4e5f6a7b8@example.ae")).toBe(true);
    expect(isJunkAddress("finance@example.ae")).toBe(false);
  });

  it("honours robots.txt disallow rules", () => {
    const robots = parseRobots(
      ["User-agent: *", "Disallow: /private", "Crawl-delay: 2", "", "User-agent: Evil", "Disallow: /"].join("\n"),
    );
    expect(robots.disallowed).toEqual(["/private"]);
    expect(robots.crawlDelay).toBe(2);
    expect(robotsAllows("/contact", robots.disallowed)).toBe(true);
    expect(robotsAllows("/private/data", robots.disallowed)).toBe(false);
  });

  it("treats a blanket disallow as blocking everything", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /");
    expect(robotsAllows("/contact", robots.disallowed)).toBe(false);
  });
});

describe("places sweep", () => {
  it("produces one query per sector and emirate", () => {
    const queries = buildSweepQueries(["accounting firm", "logistics"], ["dubai", "sharjah"]);
    expect(queries).toHaveLength(4);
    expect(queries[0]).toBe("accounting firm in Dubai, UAE");
    expect(queries).toContain("logistics in Sharjah, UAE");
  });

  it("derives the emirate from a formatted address", () => {
    expect(parseEmirate("Office 12, Business Bay, Dubai, UAE")).toBe("dubai");
    expect(parseEmirate("Al Nahda, Ras Al Khaimah")).toBe("ras-al-khaimah");
    expect(parseEmirate("Doha, Qatar")).toBeNull();
    expect(parseEmirate(null)).toBeNull();
  });
});

describe("mailer helpers", () => {
  it("normalises addresses and extracts the domain", () => {
    expect(normalizeEmail("  Finance@Example.AE ")).toBe("finance@example.ae");
    expect(emailDomain("finance@example.ae")).toBe("example.ae");
    expect(emailDomain("broken")).toBeNull();
  });

  it("computes the Dubai day boundary as UTC+4", () => {
    // 2026-07-20T01:00Z is 05:00 in Dubai, so the day started at 2026-07-19T20:00Z.
    const start = dubaiDayStart(new Date("2026-07-20T01:00:00Z"));
    expect(start.toISOString()).toBe("2026-07-19T20:00:00.000Z");
    // 23:00Z on the 20th is already the 21st in Dubai.
    const later = dubaiDayStart(new Date("2026-07-20T23:00:00Z"));
    expect(later.toISOString()).toBe("2026-07-20T20:00:00.000Z");
  });
});

describe("rank detection", () => {
  it("finds our own domain in a result set", () => {
    const hits = [
      { url: "https://a.com", title: "", snippet: "", position: 1, domain: "a.com" },
      { url: "https://uaeasp.ae/providers", title: "", snippet: "", position: 4, domain: "uaeasp.ae" },
    ];
    expect(findOwnPosition(hits)).toBe(4);
    expect(findOwnPosition(hits.slice(0, 1))).toBeNull();
  });
});

describe("nightly refresh scheduling", () => {
  const at = (iso: string) => new Date(iso);

  it("runs when the directory has never been refreshed", () => {
    expect(refreshIsDue(null, at("2026-07-27T00:30:00Z"))).toBe(true);
  });

  it("waits until the nightly window on a normal day", () => {
    // Last run 2026-07-26 22:10 Dubai (18:10Z). "Now" is 00:30 Dubai on the
    // 27th — a new Dubai day, but before the 02:00 window.
    const lastRun = at("2026-07-26T18:10:00Z");
    expect(refreshIsDue(lastRun, at("2026-07-26T20:30:00Z"))).toBe(false);
    // 02:30 Dubai — window open, no run yet today.
    expect(refreshIsDue(lastRun, at("2026-07-26T22:30:00Z"))).toBe(true);
  });

  it("does not run twice in the same Dubai day", () => {
    // Ran at 02:05 Dubai; later the same Dubai day it must not run again.
    const lastRun = at("2026-07-26T22:05:00Z");
    expect(refreshIsDue(lastRun, at("2026-07-27T10:00:00Z"))).toBe(false);
  });

  it("catches up when a run has been missed for over a day", () => {
    const lastRun = at("2026-07-25T22:05:00Z");
    // 27 hours later, regardless of the hour of day.
    expect(refreshIsDue(lastRun, at("2026-07-27T01:05:00Z"))).toBe(true);
  });

  it("reports the Dubai hour as UTC+4", () => {
    expect(dubaiHour(at("2026-07-26T22:30:00Z"))).toBe(2);
    expect(dubaiHour(at("2026-07-27T20:00:00Z"))).toBe(0);
  });
});

describe("model routing", () => {
  const global = "seed-1-6-250615";

  it("inherits the global model when a job has no override", () => {
    expect(pickModel({}, "scoring", global)).toBe(global);
    expect(pickModel({ scoring: "" }, "scoring", global)).toBe(global);
    expect(pickModel({ scoring: "   " }, "scoring", global)).toBe(global);
  });

  it("routes a job to its own model when one is named", () => {
    const overrides = { scoring: "cheap-fast-model", article: "strong-model" };
    expect(pickModel(overrides, "scoring", global)).toBe("cheap-fast-model");
    expect(pickModel(overrides, "article", global)).toBe("strong-model");
    // Untouched jobs still inherit.
    expect(pickModel(overrides, "email", global)).toBe(global);
  });

  it("trims whitespace around a named model", () => {
    expect(pickModel({ report: "  spaced-model  " }, "report", global)).toBe("spaced-model");
  });

  it("uses the global model when no job is given", () => {
    expect(pickModel({ scoring: "other" }, undefined, global)).toBe(global);
  });

  it("covers every AI call site with a job key", () => {
    const keys = AI_JOBS.map((j) => j.key);
    expect(keys).toEqual(
      expect.arrayContaining(["scoring", "classify", "email", "article", "report", "profile"]),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("header injection (audit finding: critical)", () => {
  const base = {
    from: "hello@send.uaeasp.ae",
    to: "finance@example.ae",
    text: "body",
    messageId: "m1@send.uaeasp.ae",
  };

  it("strips CRLF from a company name so no header can be injected", () => {
    const raw = buildRawMessage({
      ...base,
      fromName: "Gulf Trading\r\nBcc: victim@example.com",
      subject: "Hello",
    });
    // The guarantee is that no NEW header line appears — the text may survive
    // harmlessly inside the display name, but it must not start a header.
    const headerLines = raw.split("\r\n\r\n")[0].split("\r\n");
    expect(headerLines.some((l) => /^bcc:/i.test(l))).toBe(false);
    expect(headerLines.filter((l) => /^from:/i.test(l))).toHaveLength(1);
  });

  it("strips CRLF from a subject line", () => {
    const raw = buildRawMessage({
      ...base,
      subject: "Shortlist\r\nBcc: victim@example.com\r\nX-Evil: 1",
    });
    const headerLines = raw.split("\r\n\r\n")[0].split("\r\n");
    expect(headerLines.some((l) => /^bcc:/i.test(l))).toBe(false);
    expect(headerLines.some((l) => /^x-evil:/i.test(l))).toBe(false);
    expect(headerLines.filter((l) => /^subject:/i.test(l))).toHaveLength(1);
  });

  it("rejects an address carrying a second recipient", () => {
    expect(() =>
      buildRawMessage({ ...base, to: "a@b.ae, victim@example.com", subject: "x" }),
    ).toThrow(/invalid address/);
    expect(() =>
      buildRawMessage({ ...base, to: "a@b.ae\r\nBcc: victim@example.com", subject: "x" }),
    ).toThrow(/invalid address/);
  });

  it("still encodes legitimate non-ASCII, and folds long encoded words", () => {
    expect(encodeHeaderWord("الفوترة")).toMatch(/^=\?UTF-8\?B\?/);
    const long = encodeHeaderWord("الفوترة الإلكترونية ".repeat(12));
    for (const word of long.split("\r\n ")) {
      // RFC 2047 caps an encoded-word at 75 characters.
      expect(word.length).toBeLessThanOrEqual(75);
    }
  });

  it("sanitizeAddress accepts a normal address unchanged", () => {
    expect(sanitizeAddress("  Finance@Example.AE ")).toBe("Finance@Example.AE");
  });
});

describe("SNS trust boundaries (audit finding: critical)", () => {
  it("rejects a signing certificate hosted anywhere but SNS", () => {
    // The original suffix check accepted any amazonaws.com host, so anyone with
    // an S3 bucket could sign notifications we would have accepted.
    expect(certUrlIsTrusted("https://s3.amazonaws.com/evil-bucket/cert.pem")).toBe(false);
    expect(certUrlIsTrusted("https://evil.amazonaws.com/cert.pem")).toBe(false);
    expect(certUrlIsTrusted("http://sns.eu-west-1.amazonaws.com/cert.pem")).toBe(false);
    expect(certUrlIsTrusted("https://sns.eu-west-1.amazonaws.com.evil.com/c.pem")).toBe(false);
    expect(certUrlIsTrusted("https://sns.eu-west-1.amazonaws.com/SimpleNotification-x.pem")).toBe(true);
  });

  it("refuses to fetch a SubscribeURL pointing anywhere but SNS", () => {
    expect(subscribeUrlIsTrusted("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(subscribeUrlIsTrusted("https://attacker.example.com/confirm")).toBe(false);
    expect(subscribeUrlIsTrusted("https://sns.eu-west-1.amazonaws.com/?Action=Confirm")).toBe(true);
  });
});

describe("opt-out handling (audit finding: high)", () => {
  it("catches opt-out wording the AI classifier would have handled", () => {
    for (const body of [
      "Please remove us from your list",
      "STOP",
      "we are not interested",
      "please opt out this address",
      "take me off your mailing list",
      "لا ترسل لنا المزيد",
    ]) {
      expect(keywordIntent(body)).toBe("unsubscribe");
    }
  });

  it("still recognises machine-generated mail", () => {
    expect(keywordIntent("Automatic reply: out of office until Monday")).toBe("auto_reply");
    expect(keywordIntent("Delivery Status Notification (Failure)")).toBe("auto_reply");
  });

  it("treats an ordinary question as a question", () => {
    expect(keywordIntent("What does this cost and who are you?")).toBe("question");
  });
});

describe("html flattening is bounded (audit finding: high)", () => {
  it("returns promptly on an unterminated style tag", () => {
    const hostile = `<style>${"a{}".repeat(20_000)}`;
    const started = Date.now();
    htmlToText(hostile);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("caps very large inputs", () => {
    const huge = `<p>${"x".repeat(500_000)}</p>`;
    expect(htmlToText(huge).length).toBeLessThanOrEqual(200_000);
  });
});

describe("mandate facts stated to prospects", () => {
  // These lines go into cold emails and published articles as fact. They were
  // once hand-typed into three prompts and drifted from the rest of the site,
  // which quoted deadlines months apart. Derive them, and prove they agree.
  const lines = mandateTimelineLines();
  const joined = lines.join("\n");

  it("quotes every phase date from MANDATE_PHASES verbatim", () => {
    for (const phase of MANDATE_PHASES) {
      expect(joined).toContain(formatMandateDate(phase.appointDeadlineIso, "en"));
      expect(joined).toContain(formatMandateDate(phase.goLiveIso, "en"));
    }
  });

  it("never states a deadline the site's own timeline does not contain", () => {
    // The old, wrong copy: "mandatory from 1 July 2026 / 1 January 2027".
    expect(joined).not.toMatch(/mandatory[^.]*1 July 2026/i);
    const stated = joined.match(/\d{1,2} \w+ \d{4}/g) ?? [];
    const allowed = new Set([
      formatMandateDate(VOLUNTARY_START_ISO, "en"),
      ...MANDATE_PHASES.flatMap((p) => [
        formatMandateDate(p.appointDeadlineIso, "en"),
        formatMandateDate(p.goLiveIso, "en"),
      ]),
    ]);
    for (const date of stated) expect(allowed).toContain(date);
  });

  it("separates appointing a provider from going live", () => {
    const large = MANDATE_PHASES.find((p) => p.key === "large")!;
    expect(formatMandateDate(large.appointDeadlineIso, "en")).not.toBe(
      formatMandateDate(large.goLiveIso, "en"),
    );
    expect(appointmentDeadlineFor("phase-1")).toBe(
      formatMandateDate(large.appointDeadlineIso, "en"),
    );
  });

  it("treats an unknown or missing wave as the later phase-2 deadline", () => {
    const other = MANDATE_PHASES.find((p) => p.key === "other")!;
    const expected = formatMandateDate(other.appointDeadlineIso, "en");
    expect(appointmentDeadlineFor(null)).toBe(expected);
    expect(appointmentDeadlineFor("unknown")).toBe(expected);
    expect(appointmentDeadlineFor("phase-2")).toBe(expected);
  });
});

describe("outreach warm-up ramp", () => {
  const cfg = (over: Partial<AgentConfig> = {}) =>
    ({ ...DEFAULT_AGENT_CONFIG, ...over }) as AgentConfig;

  it("starts at the warm-up cap on the first sending day", () => {
    expect(rampedCap(cfg({ outreachWarmupStartCap: 20 }), 0)).toBe(20);
  });

  it("compounds per sending day and stops at the hard ceiling", () => {
    const c = cfg({ outreachWarmupStartCap: 20, outreachWarmupGrowth: 1.12, outreachDailyCap: 200 });
    expect(rampedCap(c, 1)).toBe(22);
    expect(rampedCap(c, 7)).toBe(44);
    expect(rampedCap(c, 14)).toBe(98);
    expect(rampedCap(c, 21)).toBe(200);
    expect(rampedCap(c, 500)).toBe(200);
  });

  it("never exceeds the hard ceiling even if the start cap is above it", () => {
    expect(rampedCap(cfg({ outreachWarmupStartCap: 500, outreachDailyCap: 50 }), 0)).toBe(50);
  });

  it("treats a cap of zero as stop, not as one", () => {
    expect(rampedCap(cfg({ outreachDailyCap: 0 }), 0)).toBe(0);
    expect(rampedCap(cfg({ outreachDailyCap: 0 }), 30)).toBe(0);
  });

  it("cannot be advanced by calendar time, only by sending", () => {
    // The whole point: a pause must not graduate the ramp. Same sending-day
    // count returns the same cap no matter how much time has passed.
    const c = cfg({ outreachWarmupStartCap: 20, outreachWarmupGrowth: 1.12 });
    expect(rampedCap(c, 3)).toBe(rampedCap(c, 3));
    expect(rampedCap(c, 3)).toBeLessThan(rampedCap(c, 4));
  });

  it("clamps a negative day count rather than shrinking below the start", () => {
    expect(rampedCap(cfg({ outreachWarmupStartCap: 20 }), -5)).toBe(20);
  });
});

describe("outreach personalisation", () => {
  const prospect = {
    name: "Gulf Freight Systems LLC",
    emirate: "dubai",
    profile: {
      whatTheyDo: "customs clearance and sea freight out of Jebel Ali",
      sectorsServed: ["retail importers"],
      locations: ["Jebel Ali"],
      systems: ["SAP"],
      notable: ["operating since 1998"],
      language: "en",
    },
  };

  it("accepts a draft that cites a fact from their own site", () => {
    const body =
      "Hello Ahmed,\n\nGulf Freight Systems clears customs at Jebel Ali, so your invoice volume will make the provider choice matter.";
    expect(personalisationEvidence(body, prospect, "Ahmed").ok).toBe(true);
  });

  it("rejects a mail-merge draft that only knows the company name", () => {
    const body =
      "Hello,\n\nUnder the UAE e-invoicing mandate, businesses like Gulf Freight Systems LLC need an accredited service provider.";
    const result = personalisationEvidence(body, prospect, null);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no company-specific detail");
  });

  it("rejects the tells of a template even when a real fact follows", () => {
    const body = "Dear Sir/Madam,\n\nGulf Freight Systems operates from Jebel Ali.";
    expect(personalisationEvidence(body, prospect, null)).toEqual({
      ok: false,
      reason: "generic opener",
    });
    expect(
      personalisationEvidence("I hope this email finds you well. Jebel Ali.", prospect, null).ok,
    ).toBe(false);
  });

  it("rejects a draft that never names the company at all", () => {
    expect(personalisationEvidence("Hello, we maintain a directory.", prospect, null)).toEqual({
      ok: false,
      reason: "does not name the company",
    });
  });

  it("counts the contact's own name as evidence we looked", () => {
    const bare = { name: "Acme Trading", emirate: null, profile: null };
    expect(personalisationEvidence("Hi Fatima, Acme Trading — quick one.", bare, "Fatima").ok).toBe(
      true,
    );
    expect(personalisationEvidence("Hello, Acme Trading — quick one.", bare, null).ok).toBe(false);
  });

  it("does not mistake a title or a shared mailbox for a person's name", () => {
    expect(firstName("Mohammed Al Rashid")).toBe("Mohammed");
    expect(firstName("  Fatima   Khan ")).toBe("Fatima");
    expect(firstName("Dr Ahmed")).toBeNull();
    expect(firstName("Sales Team")).toBeNull();
    expect(firstName("info")).toBeNull();
    expect(firstName(null)).toBeNull();
    expect(firstName("A")).toBeNull();
  });
});

describe("site digest built for personalisation", () => {
  const html = `<html><head><title>Gulf Freight Systems LLC</title>
    <meta name="description" content="Customs clearance and sea freight from Jebel Ali since 1998."></head>
    <body><script>var x = "ignore me";</script><style>.a{color:red}</style>
    <h1>Sea freight &amp; customs clearance</h1><h2>Serving retail importers</h2>
    <p>We run SAP and handle 400 shipments a month.</p></body></html>`;

  it("keeps the parts a writer can actually use", () => {
    const page = extractPageFacts(html, "https://gulffreight.ae/");
    expect(page.title).toBe("Gulf Freight Systems LLC");
    expect(page.description).toContain("Jebel Ali");
    expect(page.headings).toContain("Sea freight & customs clearance");
    expect(page.text).toContain("400 shipments");
  });

  it("drops scripts and styles rather than feeding them to the model", () => {
    const page = extractPageFacts(html, "https://gulffreight.ae/");
    expect(page.text).not.toContain("ignore me");
    expect(page.text).not.toContain("color:red");
  });

  it("bounds the digest, because a hostile site controls every byte of it", () => {
    const huge = `<html><body><p>${"padding ".repeat(50_000)}</p></body></html>`;
    const digest = buildSiteDigest([extractPageFacts(huge, "https://x.ae/")], 3500);
    expect(digest.length).toBeLessThanOrEqual(3500);
  });
});

describe("Search Console demand classification", () => {
  const row = (over: Partial<SearchAnalyticsRow> = {}): SearchAnalyticsRow => ({
    keys: ["accredited service provider uae"],
    clicks: 0,
    impressions: 10,
    ctr: 0,
    position: 40,
    ...over,
  });

  it("ignores the one-impression long tail that would fill the queue with noise", () => {
    expect(isActionableQuery(row({ impressions: 1 }))).toBe(false);
    expect(isActionableQuery(row({ impressions: 3 }))).toBe(true);
  });

  it("ignores phrases too short or too long to be a real query", () => {
    expect(isActionableQuery(row({ keys: ["asp"] }))).toBe(false);
    expect(isActionableQuery(row({ keys: ["x".repeat(200)] }))).toBe(false);
  });

  it("calls a page we already rank for an improvement, never a gap", () => {
    // The whole point: writing a second page for a query we already have a
    // page for is how a site cannibalises itself.
    expect(classifyQuery(40, true)).toBe("improve");
    expect(classifyQuery(58, true)).toBe("improve");
  });

  it("only calls it a gap when no page of ours competes at all", () => {
    expect(classifyQuery(40, false)).toBe("gap");
    expect(classifyQuery(95, true)).toBe("gap");
  });

  it("leaves alone what is already winning", () => {
    expect(classifyQuery(4, true)).toBe("winning");
    expect(classifyQuery(10, true)).toBe("winning");
    expect(classifyQuery(11, true)).toBe("improve");
  });

  it("routes Arabic queries to the Arabic locale", () => {
    expect(localeOf("مزود خدمة معتمد الفوترة الإلكترونية")).toBe("ar");
    expect(localeOf("accredited service provider uae")).toBe("en");
  });

  it("rejects a service account that is missing, malformed or half-pasted", () => {
    expect(parseServiceAccount("")).toBeNull();
    expect(parseServiceAccount("{not json")).toBeNull();
    expect(parseServiceAccount('{"client_email":"a@b.com"}')).toBeNull();
    const ok = parseServiceAccount('{"client_email":"a@b.com","private_key":"-----BEGIN"}');
    expect(ok?.token_uri).toBe("https://oauth2.googleapis.com/token");
  });

  it("asks for whole days, which is all Search Console accepts", () => {
    expect(isoDay(new Date("2026-07-28T22:15:00Z"))).toBe("2026-07-28");
  });
});

describe("query-cluster landing pages", () => {
  const locales = ["en", "ar"] as const;

  it("gives every declared slug real copy in both locales", () => {
    for (const locale of locales) {
      for (const slug of LANDING_SLUGS) {
        const copy = landingContent[locale][slug];
        expect(copy, `${locale}/${slug}`).toBeTruthy();
        expect(copy.slug).toBe(slug);
        expect(copy.h1.length).toBeGreaterThan(10);
        expect(copy.intro.length).toBeGreaterThan(80);
        expect(copy.faq.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps titles inside what Google will actually render", () => {
    for (const locale of locales) {
      for (const slug of LANDING_SLUGS) {
        const { metaTitle, metaDescription } = landingContent[locale][slug];
        expect(metaTitle.length, `${locale}/${slug} title`).toBeLessThanOrEqual(75);
        expect(metaDescription.length, `${locale}/${slug} desc`).toBeLessThanOrEqual(175);
        expect(metaDescription.length).toBeGreaterThan(70);
      }
    }
  });

  it("never gives two pages the same title or heading", () => {
    // The failure mode this whole feature exists to avoid: near-duplicate
    // pages competing with each other instead of with anyone else.
    for (const locale of locales) {
      const titles = LANDING_SLUGS.map((s) => landingContent[locale][s].metaTitle);
      const h1s = LANDING_SLUGS.map((s) => landingContent[locale][s].h1);
      expect(new Set(titles).size).toBe(titles.length);
      expect(new Set(h1s).size).toBe(h1s.length);
    }
  });

  it("asks a different question on each page rather than rewording one", () => {
    for (const locale of locales) {
      const questions = LANDING_SLUGS.flatMap((s) =>
        landingContent[locale][s].faq.map((f) => f.q.toLowerCase().trim()),
      );
      expect(new Set(questions).size).toBe(questions.length);
    }
  });

  it("cross-links only to slugs that exist, and never to itself", () => {
    for (const locale of locales) {
      for (const slug of LANDING_SLUGS) {
        for (const rel of landingContent[locale][slug].related) {
          expect(LANDING_SLUGS as readonly string[]).toContain(rel);
          expect(rel).not.toBe(slug);
        }
      }
    }
  });
});

describe("gaps worth writing a page for", () => {
  it("treats a hub page standing in for a specific query as a gap", () => {
    // The live failure: "accredited service providers" resolved to "/" at
    // position 48, which classifyQuery called "covered" — so the content
    // queue stayed permanently empty while the homepage lost the query.
    expect(needsDedicatedPage(48, "/")).toBe(true);
    expect(needsDedicatedPage(56, "/providers")).toBe(true);
    expect(needsDedicatedPage(30, "/registry")).toBe(true);
    expect(needsDedicatedPage(40, "/ar")).toBe(true);
  });

  it("leaves a specific page alone — that is an improvement, not a gap", () => {
    expect(needsDedicatedPage(38, "/toolkit/penalty-calculator")).toBe(false);
    expect(needsDedicatedPage(35, "/guides/peppol-pint-ae-explained")).toBe(false);
    expect(needsDedicatedPage(58, "/integrations")).toBe(false);
  });

  it("never writes a second page for something already winning", () => {
    expect(needsDedicatedPage(4, "/")).toBe(false);
    expect(needsDedicatedPage(10, "/providers")).toBe(false);
    expect(needsDedicatedPage(11, "/providers")).toBe(true);
  });

  it("counts a query with no ranking page at all as a gap", () => {
    expect(needsDedicatedPage(45, null)).toBe(true);
    expect(needsDedicatedPage(45, undefined)).toBe(true);
  });

  it("recognises hubs with or without a trailing slash", () => {
    expect(isHubPath("/providers/")).toBe(true);
    expect(isHubPath("/providers")).toBe(true);
    expect(isHubPath("/providers/bdo-digital-solutions")).toBe(false);
    expect(isHubPath(null)).toBe(false);
  });
});

describe("indexing API guard rails", () => {
  it("turns each 403 into the remedy, since both fail identically", () => {
    expect(
      explainIndexingError(403, '{"reason":"SERVICE_DISABLED","message":"has not been used in project"}'),
    ).toContain("not enabled on the Google Cloud project");
    expect(explainIndexingError(403, "Failed to verify the URL ownership")).toContain("OWNER");
    expect(explainIndexingError(429, "quota")).toContain("quota");
  });

  it("dedupes before capping, so a repeat cannot eat the budget", () => {
    const urls = urlsWorthPinging(
      [
        { slug: "a", locale: "en" },
        { slug: "a", locale: "en" },
        { slug: "b", locale: "en" },
      ],
      [],
      10,
    );
    expect(urls).toHaveLength(2);
  });

  it("respects the cap and never returns more than asked", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ slug: `p${i}`, locale: "en" }));
    expect(urlsWorthPinging(many, ["x", "y"], 5)).toHaveLength(5);
    expect(urlsWorthPinging(many, ["x"], 0)).toHaveLength(0);
    expect(urlsWorthPinging(many, ["x"], -3)).toHaveLength(0);
  });

  it("builds the Arabic path for Arabic articles", () => {
    const urls = urlsWorthPinging([{ slug: "guide", locale: "ar" }], [], 5);
    expect(urls[0]).toContain("/ar/insights/guide");
  });
});
