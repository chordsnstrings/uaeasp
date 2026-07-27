import { EMIRATES, type Emirate } from "@/db/schema";

/**
 * Business discovery via the official Google Places API (Text Search, New).
 *
 * Deliberately the paid API rather than scraping Maps: scraped results break
 * whenever the markup shifts, get the IP blocked, and violate the terms — none
 * of which is acceptable for a system that has to run unattended every day.
 *
 * Coverage is systematic: every (sector × emirate) pair is a separate query
 * with pagination, so a sweep is resumable and we can prove what was covered.
 */

export interface PlaceResult {
  placeId: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  emirate: Emirate | null;
  types: string[];
  rating: number | null;
  reviewCount: number | null;
}

const EMIRATE_QUERY_NAMES: Record<Emirate, string> = {
  "abu-dhabi": "Abu Dhabi",
  dubai: "Dubai",
  sharjah: "Sharjah",
  ajman: "Ajman",
  "umm-al-quwain": "Umm Al Quwain",
  "ras-al-khaimah": "Ras Al Khaimah",
  fujairah: "Fujairah",
};

export function emirateLabel(emirate: Emirate): string {
  return EMIRATE_QUERY_NAMES[emirate];
}

export function parseEmirate(address: string | null): Emirate | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const emirate of EMIRATES) {
    if (lower.includes(EMIRATE_QUERY_NAMES[emirate].toLowerCase())) return emirate;
  }
  return null;
}

interface PlacesApiPlace {
  id?: string;
  displayName?: { text?: string };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  addressComponents?: { longText?: string; types?: string[] }[];
}

/**
 * One page of Text Search results. Returns the page plus the token needed to
 * continue, so the caller controls how much quota a single run spends.
 */
export async function searchPlaces(
  apiKey: string,
  query: string,
  pageToken?: string,
): Promise<{ places: PlaceResult[]; nextPageToken?: string; error?: string }> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.websiteUri",
          "places.nationalPhoneNumber",
          "places.formattedAddress",
          "places.types",
          "places.rating",
          "places.userRatingCount",
          "places.addressComponents",
          "nextPageToken",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "en",
        regionCode: "AE",
        maxResultCount: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { places: [], error: `Places API ${res.status}: ${detail.slice(0, 300)}` };
    }
    const data = (await res.json()) as {
      places?: PlacesApiPlace[];
      nextPageToken?: string;
    };
    const places = (data.places ?? [])
      .filter((p) => p.id && p.displayName?.text)
      .map((p) => {
        const address = p.formattedAddress ?? null;
        const city =
          p.addressComponents?.find((c) => c.types?.includes("locality"))?.longText ?? null;
        return {
          placeId: p.id!,
          name: p.displayName!.text!.trim(),
          website: p.websiteUri ?? null,
          phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
          address,
          city,
          emirate: parseEmirate(address ?? city),
          types: p.types ?? [],
          rating: p.rating ?? null,
          reviewCount: p.userRatingCount ?? null,
        } satisfies PlaceResult;
      });
    return { places, nextPageToken: data.nextPageToken };
  } catch (err) {
    return { places: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Every (sector × emirate) query for a full sweep, in a stable order. */
export function buildSweepQueries(sectors: string[], emirates: Emirate[]): string[] {
  const queries: string[] = [];
  for (const emirate of emirates) {
    for (const sector of sectors) {
      queries.push(`${sector.trim()} in ${EMIRATE_QUERY_NAMES[emirate]}, UAE`);
    }
  }
  return queries;
}
