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
import { dubaiDayStart, emailDomain, normalizeEmail } from "./mailer";
import { findOwnPosition } from "./visibility/search";
import { dubaiHour, refreshIsDue } from "./maintenance";
import { AI_JOBS, pickModel } from "@/lib/ai/models";
import { certUrlIsTrusted, subscribeUrlIsTrusted } from "./sns";
import { keywordIntent } from "./conversationalist";
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
