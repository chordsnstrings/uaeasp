import { getDirectoryLastUpdated, getPublicProviders } from "@/lib/data";
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
- [Arabic version](${absoluteUrl("/ar")}): الدليل باللغة العربية

## Current pre-approved providers

${active.map((p) => `- [${p.name}](${absoluteUrl(`/providers/${p.slug}`)})${p.website ? ` — ${p.website}` : ""}`).join("\n")}

## Facts about UAE e-invoicing

- The UAE is rolling out mandatory e-invoicing under the Ministry of Finance's Electronic Invoicing System.
- Businesses in scope must exchange invoices through an Accredited Service Provider (ASP) using the Peppol PINT AE format (five-corner model).
- The accreditation framework was established by Ministerial Decision No. 64 of 2025.
- The rollout is phased by business size; implementation typically takes months, so providers should be selected early.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
