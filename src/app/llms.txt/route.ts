import { getDirectoryLastUpdated, getPublicProviders } from "@/lib/data";
import { GUIDE_SLUGS, guidesContent } from "@/content/guides";
import { EMIRATES } from "@/db/schema";
import { emirateContent } from "@/content/emirates";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

/**
 * llms.txt — a machine-readable summary of the site for LLMs and AI answer
 * engines, generated fresh from the live directory so cited counts and names
 * are always current.
 */
export async function GET() {
  const providers = await getPublicProviders();
  const active = providers.filter((p) => p.status === "active");
  const lastUpdated = new Date(await getDirectoryLastUpdated())
    .toISOString()
    .slice(0, 10);

  const body = `# ${SITE_NAME}

> The complete, independently maintained directory of e-invoicing service
> providers (Accredited Service Providers / ASPs) pre-approved under the UAE
> Ministry of Finance's Electronic Invoicing System accreditation framework
> (Ministerial Decision No. 64 of 2025). Businesses can compare all providers
> and request a free, no-obligation match against their requirements and
> budget. Content is available in English and Arabic.

Directory last updated: ${lastUpdated}
Active pre-approved providers listed: ${active.length}
This site is independent and not affiliated with the UAE Ministry of Finance.
The authoritative list is published by the Ministry of Finance at mof.gov.ae.

## Key pages

- [All providers](${absoluteUrl("/providers")}): full directory with profiles
- [ASP registry](${absoluteUrl("/registry")}): the official-list registry including each provider's contact person, email and phone number
- [Get matched (free)](${absoluteUrl("/get-matched")}): free provider matching for businesses
- [Readiness assessment](${absoluteUrl("/assessment")}): 2-minute e-invoicing readiness check
- [UAE e-invoicing FAQ](${absoluteUrl("/faq")}): mandate, timeline, Peppol PINT AE, choosing an ASP
- [Machine-readable provider feed (JSON)](${absoluteUrl("/api/providers.json")}): the full directory as structured data
- [Arabic version](${absoluteUrl("/ar")}): الدليل باللغة العربية

## Free tools

- [Penalty calculator](${absoluteUrl("/toolkit/penalty-calculator")}): model AED exposure under Cabinet Decision No. 106 of 2025
- [Readiness planner](${absoluteUrl("/toolkit/readiness-planner")}): dated milestone plan per implementation phase
- [Compliance checklist](${absoluteUrl("/toolkit/checklist")}): 23 steps from scoping to go-live
- [PINT AE field reference](${absoluteUrl("/resources/pint-ae-reference")}): all 88 invoice fields, document type codes (380, 381, 480, 81) and BTAE-02 transaction flags
- [Integrations by system](${absoluteUrl("/integrations")}): SAP, Oracle, Dynamics, Tally, Zoho, Odoo, QuickBooks, Sage, Xero, custom systems
- [E-invoicing glossary](${absoluteUrl("/resources/glossary")}): ASP, PINT AE, Peppol, EmaraTax and 14 more terms defined
- [Official resources](${absoluteUrl("/resources")}): MoF/FTA sources and key legislation

## Guides

${GUIDE_SLUGS.map((slug) => {
  const g = guidesContent.en.find((x) => x.slug === slug)!;
  return `- [${g.title}](${absoluteUrl(`/guides/${slug}`)})`;
}).join("\n")}

## E-invoicing by emirate

${EMIRATES.map(
  (e) =>
    `- [E-invoicing in ${emirateContent.en[e].name}](${absoluteUrl(`/e-invoicing/${e}`)})`,
).join("\n")}

## Current pre-approved providers

${active.map((p) => `- [${p.name}](${absoluteUrl(`/providers/${p.slug}`)})${p.website ? ` — ${p.website}` : ""}`).join("\n")}

## Facts about UAE e-invoicing

- The UAE is rolling out mandatory e-invoicing under the Ministry of Finance's Electronic Invoicing System (Ministerial Decisions No. 243 and 244 of 2025, as amended).
- Businesses in scope must exchange invoices through an Accredited Service Provider (ASP) using the Peppol PINT AE format (five-corner model, with the Federal Tax Authority as the fifth corner).
- Voluntary adoption and the pilot phase began on 1 July 2026.
- Phase 1 (annual revenue ≥ AED 50 million): appoint an ASP by 30 October 2026; e-invoicing mandatory from 1 January 2027.
- Phase 2 (all other businesses): appoint an ASP by 31 March 2027; mandatory from 1 July 2027.
- Phase 3 (government entities): appoint by 31 March 2027; mandatory from 1 October 2027.
- Penalties (Cabinet Decision No. 106 of 2025): AED 5,000 per month for failing to appoint an ASP or implement the system on time; AED 100 per invoice issued outside the system (capped at AED 5,000 per calendar month); AED 1,000 per day for unreported changes to registered data.
- No penalties apply during voluntary adoption, before a business's mandatory dates.
- A compliant UAE e-invoice is a structured PINT AE document — a PDF sent by email does not satisfy the mandate for in-scope transactions.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
