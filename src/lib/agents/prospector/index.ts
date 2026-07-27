import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  EMIRATES,
  leads,
  prospectContacts,
  prospects,
  providers,
  type Emirate,
} from "@/db/schema";
import { chat, extractJson } from "@/lib/ai/chat";
import { getAgentConfig } from "../config";
import { dubaiDayStart, isSuppressed, normalizeEmail } from "../mailer";
import { enqueue } from "../queue";
import type { AgentContext, AgentHandler } from "../types";
import { buildSweepQueries, searchPlaces, type PlaceResult } from "./places";
import { findContactEmails, registrableDomain, verifyEmail } from "./crawl";

/**
 * Agent 2 — Prospector.
 *
 * Sweeps Google Places by (sector × emirate), keeps businesses that plausibly
 * fall under the e-invoicing mandate, finds a public contact address on their
 * own website, verifies it, scores the fit with AI, and hands the good ones to
 * the Conversationalist. Everything it rejects is recorded with a reason.
 */

/** Businesses already in our world: the 42 providers and existing leads. */
async function knownDomains(): Promise<Set<string>> {
  const [providerRows, leadRows] = await Promise.all([
    db.select({ website: providers.website }).from(providers),
    db.select({ email: leads.email }).from(leads),
  ]);
  const set = new Set<string>();
  for (const row of providerRows) {
    const domain = row.website ? registrableDomain(row.website) : null;
    if (domain) set.add(domain);
  }
  for (const row of leadRows) {
    const domain = row.email ? row.email.split("@")[1]?.toLowerCase() : null;
    if (domain) set.add(domain);
  }
  return set;
}

async function discoveredToday(): Promise<number> {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(prospects)
    .where(gte(prospects.createdAt, dubaiDayStart()));
  return Number(row?.count ?? 0);
}

/** Sweep one batch of (sector × emirate) queries into the prospect table. */
export const sweep: AgentHandler = async (task, ctx) => {
  const config = await getAgentConfig();
  if (!config.placesApiKey) throw new Error("Places API key is not configured");

  const payload = task.payload as {
    queryIndex?: number;
    pageToken?: string;
    batchSize?: number;
  };
  const sectors = config.prospectorSectors.split(",").map((s) => s.trim()).filter(Boolean);
  const emirates = config.prospectorEmirates
    .split(",")
    .map((e) => e.trim())
    .filter((e): e is Emirate => (EMIRATES as readonly string[]).includes(e));
  const queries = buildSweepQueries(sectors, emirates);
  if (!queries.length) return { itemsIn: 0, itemsOut: 0, summary: { reason: "no queries" } };

  const queryIndex = payload.queryIndex ?? 0;
  if (queryIndex >= queries.length) {
    return { itemsIn: 0, itemsOut: 0, summary: { done: true, sweptQueries: queries.length } };
  }

  const remainingToday = config.prospectorDailyDiscoveryCap - (await discoveredToday());
  if (remainingToday <= 0) {
    // Resume tomorrow rather than burning API quota we cannot store.
    await enqueue({
      agent: "prospector",
      kind: "sweep",
      payload: { queryIndex, pageToken: payload.pageToken },
      runAfter: new Date(dubaiDayStart().getTime() + 26 * 60 * 60 * 1000),
      dedupeKey: `sweep:${queryIndex}:${dubaiDayStart().toISOString().slice(0, 10)}:next`,
    });
    return { itemsIn: 0, itemsOut: 0, summary: { paused: "daily discovery cap" } };
  }

  const query = queries[queryIndex];
  const { places, nextPageToken, error } = await searchPlaces(
    config.placesApiKey,
    query,
    payload.pageToken,
  );
  if (error) throw new Error(error);

  const known = await knownDomains();
  let stored = 0;
  const skipped: Record<string, number> = {};

  for (const place of places.slice(0, remainingToday)) {
    const outcome = await storePlace(place, known, query);
    if (outcome === "stored") stored += 1;
    else skipped[outcome] = (skipped[outcome] ?? 0) + 1;
  }

  // Chain: next page of this query, or the next query.
  const nextPayload = nextPageToken
    ? { queryIndex, pageToken: nextPageToken }
    : { queryIndex: queryIndex + 1 };
  if (queryIndex + 1 < queries.length || nextPageToken) {
    await enqueue({
      agent: "prospector",
      kind: "sweep",
      payload: nextPayload,
      // Spread calls out so we stay well inside Places rate limits.
      runAfter: new Date(Date.now() + 20_000),
      dedupeKey: `sweep:${nextPayload.queryIndex}:${nextPageToken ?? "page1"}`,
    });
  }

  ctx.log(`sweep "${query}" → ${places.length} places, ${stored} new`);
  return {
    itemsIn: places.length,
    itemsOut: stored,
    summary: { query, queryIndex, stored, skipped, hasNextPage: !!nextPageToken },
  };
};

type StoreOutcome = "stored" | "no_website" | "known_domain" | "duplicate";

async function storePlace(
  place: PlaceResult,
  known: Set<string>,
  query: string,
): Promise<StoreOutcome> {
  if (!place.website) return "no_website";
  const domain = registrableDomain(place.website);
  if (!domain) return "no_website";
  if (known.has(domain)) return "known_domain";

  const sector = query.split(" in ")[0] ?? null;
  const inserted = await db
    .insert(prospects)
    .values({
      name: place.name,
      website: place.website,
      domain,
      placeId: place.placeId,
      phone: place.phone,
      address: place.address,
      city: place.city,
      emirate: place.emirate,
      sector,
      source: "places",
      raw: { types: place.types, rating: place.rating, reviewCount: place.reviewCount, query },
    })
    .onConflictDoNothing()
    .returning({ id: prospects.id });

  if (!inserted.length) return "duplicate";
  known.add(domain);

  await enqueue({
    agent: "prospector",
    kind: "enrich",
    payload: { prospectId: inserted[0].id },
    dedupeKey: `enrich:${inserted[0].id}`,
    priority: 120,
  });
  return "stored";
}

const SCORING_SYSTEM = `You qualify UAE businesses as prospects for a free service that matches companies to Ministry of Finance accredited e-invoicing service providers (ASPs).

UAE e-invoicing is mandatory: large businesses (turnover ≥ AED 50m) from 1 July 2026, other VAT-registered businesses from 1 January 2027, government from October 2027. Every VAT-registered UAE business must eventually issue invoices through an accredited provider.

Score 0-100 for how useful our free shortlist service is to them:
- 80-100: mid-size or larger UAE company issuing many B2B invoices (trading, logistics, contracting, manufacturing, distribution, professional services).
- 55-79: smaller UAE business that still issues VAT invoices and will need a provider.
- 20-54: micro business, consumer-facing with few B2B invoices, or unclear.
- 0-19: not a UAE business, a competitor (they ARE an e-invoicing/ERP/tax software vendor or an accredited provider), a government entity, or otherwise irrelevant.

Also estimate: size_hint (micro|small|mid|large), mandate_wave (jul-2026|jan-2027|unknown).

Respond with ONLY JSON: {"score": 0-100, "size_hint": "...", "mandate_wave": "...", "reason": "one short sentence"}`;

interface Scoring {
  score: number;
  size_hint: string;
  mandate_wave: string;
  reason: string;
}

/** Crawl one prospect for contacts, verify, score, and route it onward. */
export const enrich: AgentHandler = async (task, ctx) => {
  const { prospectId } = task.payload as { prospectId: string };
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!prospect) return { itemsIn: 0, itemsOut: 0, summary: { reason: "prospect gone" } };
  if (!prospect.website) {
    await reject(prospectId, "no website");
    return { itemsIn: 1, itemsOut: 0, summary: { rejected: "no website" } };
  }

  const config = await getAgentConfig();
  const found = await findContactEmails(prospect.website);
  let usable = 0;

  for (const [i, contact] of found.entries()) {
    const email = normalizeEmail(contact.email);
    if (await isSuppressed(email)) continue;
    const verification = await verifyEmail(email);
    if (verification === "invalid") continue;
    await db
      .insert(prospectContacts)
      .values({
        prospectId,
        email,
        isRoleAccount: contact.isRoleAccount,
        verification,
        verifiedAt: new Date(),
        sourceUrl: contact.sourceUrl,
        priority: i * 10 + (contact.isRoleAccount ? 50 : 0),
      })
      .onConflictDoNothing();
    usable += 1;
  }

  // Qualify with AI when available; without it, keep the prospect for a human
  // rather than guessing a score.
  let scoring: Scoring | null = null;
  const result = await chat(
    [
      { role: "system", content: SCORING_SYSTEM },
      {
        role: "user",
        content: [
          `Business: ${prospect.name}`,
          `Website: ${prospect.website}`,
          `Emirate: ${prospect.emirate ?? "unknown"}`,
          `Found via search: ${prospect.sector ?? "unknown"}`,
          `Google types: ${(prospect.raw as { types?: string[] })?.types?.join(", ") ?? "unknown"}`,
          `Review count: ${(prospect.raw as { reviewCount?: number })?.reviewCount ?? "unknown"}`,
        ].join("\n"),
      },
    ],
    { temperature: 0.1, maxTokens: 600, job: "scoring" },
  );
  if (result) {
    ctx.addTokens(result.totalTokens, result.model);
    scoring = extractJson<Scoring>(result.text);
  }

  const score = scoring ? Math.max(0, Math.min(100, Math.round(scoring.score))) : null;
  const contactable = usable > 0;
  const qualified = contactable && (score === null || score >= config.prospectorMinScore);

  await db
    .update(prospects)
    .set({
      score,
      scoreReason: scoring?.reason?.slice(0, 300) ?? null,
      sizeHint: scoring?.size_hint ?? null,
      mandateWave: scoring?.mandate_wave ?? null,
      status: qualified ? "contactable" : contactable ? "enriched" : "rejected",
      lastCrawledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(prospects.id, prospectId));

  if (qualified) {
    await enqueue({
      agent: "conversationalist",
      kind: "start_sequence",
      payload: { prospectId },
      dedupeKey: `sequence:${prospectId}`,
      priority: 150,
    });
  }

  ctx.log(
    `${prospect.name}: ${usable} contact(s), score ${score ?? "n/a"} → ${qualified ? "queued" : "held"}`,
  );
  return {
    itemsIn: 1,
    itemsOut: qualified ? 1 : 0,
    summary: { contacts: usable, score, qualified },
  };
};

async function reject(prospectId: string, reason: string): Promise<void> {
  await db
    .update(prospects)
    .set({ status: "rejected", scoreReason: reason, updatedAt: new Date() })
    .where(eq(prospects.id, prospectId));
}

/** Daily kick-off: start a fresh sweep and re-enrich anything left hanging. */
export const dailyPlan: AgentHandler = async (_task, ctx: AgentContext) => {
  const today = dubaiDayStart().toISOString().slice(0, 10);
  await enqueue({
    agent: "prospector",
    kind: "sweep",
    payload: { queryIndex: 0 },
    dedupeKey: `sweep-start:${today}`,
  });

  const stalled = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(and(eq(prospects.status, "discovered"), sql`last_crawled_at IS NULL`))
    .limit(50);
  for (const row of stalled) {
    await enqueue({
      agent: "prospector",
      kind: "enrich",
      payload: { prospectId: row.id },
      dedupeKey: `enrich:${row.id}`,
      priority: 130,
    });
  }
  ctx.log(`daily plan: sweep queued, ${stalled.length} stalled prospects re-queued`);
  return { itemsIn: 0, itemsOut: stalled.length, summary: { requeued: stalled.length } };
};

export const prospectorHandlers: Record<string, AgentHandler> = {
  daily_plan: dailyPlan,
  sweep,
  enrich,
};
