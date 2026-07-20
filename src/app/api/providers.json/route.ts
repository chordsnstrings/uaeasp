import { NextResponse } from "next/server";
import { getDirectoryLastUpdated, getPublicProviders } from "@/lib/data";
import { MOF_SOURCE_URL, SITE_NAME, absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

/**
 * Public machine-readable feed of the directory — for AI assistants,
 * researchers and integrators. Mirrors the public registry (name, website,
 * official contacts, category); nothing here goes beyond what the pages
 * already publish.
 */
export async function GET() {
  const [providers, lastUpdated] = await Promise.all([
    getPublicProviders(),
    getDirectoryLastUpdated(),
  ]);

  const body = {
    source: SITE_NAME,
    url: absoluteUrl("/providers"),
    officialSource: MOF_SOURCE_URL,
    note: "Independently maintained mirror of the UAE Ministry of Finance pre-approved e-invoicing service provider list. The authoritative list is published by the Ministry of Finance.",
    lastUpdated,
    count: providers.filter((p) => p.status === "active").length,
    providers: providers
      .filter((p) => p.status === "active")
      .map((p) => ({
        name: p.name,
        nameAr: p.nameAr,
        website: p.website,
        category: p.category,
        profile: absoluteUrl(`/providers/${p.slug}`),
        contacts: p.contacts,
      })),
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
