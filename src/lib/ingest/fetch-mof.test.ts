import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMofHtml } from "./fetch-mof";

interface SeedProvider {
  name: string;
  website: string | null;
  contacts: { name?: string; emails: string[]; phones: string[] }[];
}

const seed = (
  JSON.parse(
    readFileSync(new URL("../../../db-seed/providers.seed.json", import.meta.url), "utf8"),
  ) as { providers: SeedProvider[] }
).providers;

/** Rebuild an MoF-style 6-column table (# | Company | Website | Contact
 * Person | Email | Phone) from the seed data. */
function buildFixture(providers: SeedProvider[]): string {
  const rows = providers
    .map((p, i) => {
      const persons = p.contacts.map((c) => c.name ?? "").filter(Boolean);
      const emails = p.contacts.flatMap((c) => c.emails);
      const phones = p.contacts.flatMap((c) => c.phones);
      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${p.name.replace(/&/g, "&amp;")}</strong></td>
        <td>${p.website ? `<a href="${p.website}">${p.website}</a>` : ""}</td>
        <td>${persons.join("<br/>")}</td>
        <td>${emails.map((e) => `<a href="mailto:${e}">${e}</a>`).join("<br>")}</td>
        <td>${phones.join("<br />")}</td>
      </tr>`;
    })
    .join("\n");
  return `<html><body><main>
    <h1>Pre-Approved eInvoicing Service Providers</h1>
    <table>
      <thead><tr><th>#</th><th>Company Name</th><th>Company Website</th><th>Contact Person</th><th>Email</th><th>Phone</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main></body></html>`;
}

describe("parseMofHtml", () => {
  const html = buildFixture(seed);
  const parsed = parseMofHtml(html);

  it("extracts every provider and no header rows", () => {
    expect(parsed).toHaveLength(seed.length);
    expect(parsed.map((p) => p.name)).toEqual(seed.map((s) => s.name));
  });

  it("extracts websites", () => {
    const withSite = seed.filter((s) => s.website);
    for (const s of withSite) {
      const p = parsed.find((x) => x.name === s.name)!;
      expect(p.website).toBeTruthy();
    }
  });

  it("extracts contact names, emails and phones", () => {
    for (const s of seed) {
      const p = parsed.find((x) => x.name === s.name)!;
      const expectedEmails = new Set(s.contacts.flatMap((c) => c.emails.map((e) => e.toLowerCase())));
      const gotEmails = new Set((p.contacts ?? []).flatMap((c) => c.emails.map((e) => e.toLowerCase())));
      expect(gotEmails).toEqual(expectedEmails);
      const expectedNames = s.contacts.map((c) => c.name).filter(Boolean);
      const gotNames = (p.contacts ?? []).map((c) => c.name).filter(Boolean);
      expect(gotNames).toEqual(expectedNames);
    }
  });

  it("ignores decorative rows and entity-encoded names survive", () => {
    const decorated = html.replace(
      "<tbody>",
      `<tbody><tr><td colspan="6">Last updated July 2026</td></tr>`,
    );
    const p = parseMofHtml(decorated);
    expect(p.length).toBeGreaterThanOrEqual(seed.length);
    expect(p.some((x) => x.name.includes("&") || !x.name.includes("&amp;"))).toBe(true);
  });
});
