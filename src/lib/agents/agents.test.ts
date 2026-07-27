import { describe, expect, it } from "vitest";
import { buildRawMessage, encodeHeaderWord } from "./ses";
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
