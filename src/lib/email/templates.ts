import type { Lead } from "@/db/schema";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const LABELS: Record<string, string> = {
  "abu-dhabi": "Abu Dhabi",
  dubai: "Dubai",
  sharjah: "Sharjah",
  ajman: "Ajman",
  "umm-al-quwain": "Umm Al Quwain",
  "ras-al-khaimah": "Ras Al Khaimah",
  fujairah: "Fujairah",
  lt100: "Under 100 invoices/mo",
  "100-1000": "100–1,000 invoices/mo",
  "1000-10000": "1,000–10,000 invoices/mo",
  gt10000: "Over 10,000 invoices/mo",
  economy: "Most affordable option",
  mid: "Balanced price/features",
  premium: "Premium",
  unsure: "Budget not sure yet",
  asap: "ASAP",
  "3months": "Within 3 months",
  "6months": "Within 6 months",
  exploring: "Just exploring",
};

const label = (v: string | null | undefined) => (v ? (LABELS[v] ?? v) : "—");

function row(name: string, value: string): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap;vertical-align:top">${name}</td><td style="padding:6px 0;color:#0f172a;font-weight:600">${value}</td></tr>`;
}

export function newLeadEmail(lead: Lead): {
  subject: string;
  html: string;
  text: string;
} {
  const url = `${SITE_URL}/admin/leads/${lead.id}`;
  const flag = lead.flaggedDuplicate ? " [possible duplicate]" : "";
  const subject = `New lead: ${lead.companyName}${lead.emirate ? ` (${label(lead.emirate)})` : ""}${flag}`;

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="color:#0f766e;margin:0 0 4px">New lead${flag}</h2>
    <p style="color:#64748b;margin:0 0 20px">via ${SITE_NAME} — source: ${lead.source}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      ${row("Contact", lead.fullName)}
      ${row("Company", lead.companyName)}
      ${row("Email", lead.email ? `<a href="mailto:${lead.email}">${lead.email}</a>` : "— (call or WhatsApp)")}
      ${row("Phone", `<a href="tel:${lead.phone}">${lead.phone}</a>`)}
      ${row("Emirate", label(lead.emirate))}
      ${row("Invoice volume", label(lead.invoiceVolume))}
      ${row("Software", lead.accountingSoftware || "—")}
      ${row("Budget", label(lead.budgetRange))}
      ${row("Timeline", label(lead.timeline))}
      ${lead.quizScore != null ? row("Readiness score", `${lead.quizScore}/100`) : ""}
      ${lead.message ? row("Message", lead.message) : ""}
      ${row("Language", lead.locale === "ar" ? "Arabic" : "English")}
    </table>
    <a href="${url}" style="display:inline-block;margin-top:24px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px">Open in CRM</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Speed-to-lead matters — this lead expects contact within one business day.</p>
  </div>`;

  const text = [
    `New lead${flag} via ${SITE_NAME} (source: ${lead.source})`,
    `Contact: ${lead.fullName}`,
    `Company: ${lead.companyName}`,
    `Email: ${lead.email ?? "—"}`,
    `Phone: ${lead.phone}`,
    `Emirate: ${label(lead.emirate)}`,
    `Invoice volume: ${label(lead.invoiceVolume)}`,
    `Software: ${lead.accountingSoftware || "—"}`,
    `Budget: ${label(lead.budgetRange)}`,
    `Timeline: ${label(lead.timeline)}`,
    lead.message ? `Message: ${lead.message}` : "",
    `CRM: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

export function scrapeAlertEmail({
  status,
  summary,
  detailLines,
}: {
  status: string;
  summary: string;
  detailLines: string[];
}): { subject: string; html: string; text: string } {
  const subject = `[${SITE_NAME}] Directory refresh ${status}: ${summary}`;
  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="color:${status === "success" ? "#0f766e" : "#b91c1c"};margin:0 0 12px">Directory refresh ${status}</h2>
    <p style="color:#0f172a">${summary}</p>
    <ul style="color:#334155;font-size:14px;line-height:1.7">${detailLines.map((l) => `<li>${l}</li>`).join("")}</ul>
    <a href="${SITE_URL}/admin/scrapes" style="display:inline-block;margin-top:16px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:10px">Review in admin</a>
  </div>`;
  const text = `Directory refresh ${status}\n${summary}\n${detailLines.join("\n")}\n${SITE_URL}/admin/scrapes`;
  return { subject, html, text };
}
