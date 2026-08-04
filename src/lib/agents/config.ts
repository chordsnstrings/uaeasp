import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, AGENT_KEYS, type AgentKey } from "@/db/schema";

/**
 * Runtime configuration for the growth agents, editable in /admin/agents and
 * stored under one app_settings key. Same resolution order as the main app
 * config: DB value → environment variable → default.
 *
 * Everything defaults to OFF. An agent only runs when the master switch, its
 * own switch and its required credentials are all present — so a fresh deploy
 * never emails anyone by accident.
 */

const CONFIG_KEY = "agent_config";

export interface AgentConfig {
  /** Master kill switch. When false, the worker drains nothing. */
  agentsEnabled: boolean;
  visibilityEnabled: boolean;
  prospectorEnabled: boolean;
  conversationalistEnabled: boolean;
  analystEnabled: boolean;

  // --- Amazon SES (outbound transport) ---
  sesRegion: string;
  sesAccessKeyId: string;
  sesSecretAccessKey: string;
  /** Verified sender, e.g. "hello@send.uaeasp.ae". */
  sesFromEmail: string;
  sesFromName: string;
  /** Optional SES configuration set (event publishing to SNS). */
  sesConfigurationSet: string;
  /** Expected SNS topic ARN. When set, notifications from any other topic are
   *  rejected even if Amazon signed them. */
  snsTopicArn: string;
  /** Address replies come back to; defaults to sesFromEmail. */
  replyToEmail: string;

  // --- Outreach guardrails ---
  /** Hard ceiling on outbound emails per calendar day (Asia/Dubai). */
  outreachDailyCap: number;
  /** Where the warm-up ramp starts on day 1 of sending. */
  outreachWarmupStartCap: number;
  /** Ramp multiplier applied per day until the daily cap is reached. */
  outreachWarmupGrowth: number;
  /** manual = every email waits for approval; first_touch = sequence auto-sends,
   *  replies wait; auto = everything sends (still capped + suppressed). */
  outreachApprovalMode: "manual" | "first_touch" | "auto";
  /** Max follow-ups after the first touch before a thread closes itself. */
  outreachMaxFollowUps: number;
  /** Days between sequence steps. */
  outreachStepDelayDays: number;

  // --- Prospector ---
  placesApiKey: string;
  prospectorDailyDiscoveryCap: number;
  /** Comma-separated Google Places search terms. */
  prospectorSectors: string;
  /** Comma-separated emirate slugs to sweep. */
  prospectorEmirates: string;
  /** Minimum AI fit score required before a prospect enters a sequence. */
  prospectorMinScore: number;

  // --- Visibility ---
  /** serper | bing | none — pluggable SERP/mention source. */
  searchApiProvider: string;
  searchApiKey: string;
  /** Service-account JSON for the Search Console API. Write-only. */
  gscServiceAccountJson: string;
  /** Property to query, e.g. "sc-domain:uaeasp.ae". */
  gscSiteUrl: string;
  visibilityWeeklyDraftCap: number;
  /** Ceiling on drafts written in a rolling 24 hours. */
  visibilityDailyDraftCap: number;
  /** Sitemap resubmitted to Search Console each night. */
  sitemapFeedPath: string;
  /** Ask Google to recrawl changed URLs. Off by default — see gsc.ts. */
  indexingApiEnabled: boolean;
  /** URLs pinged per run. Google's default quota is 200/day. */
  indexingDailyPingCap: number;

  // --- Offer copy the Conversationalist pitches ---
  senderName: string;
  senderTitle: string;
  companyLegalName: string;
  companyAddress: string;
  offerHeadline: string;
  offerBody: string;
  offerCta: string;
  bookingLink: string;

  // --- Analyst ---
  reportRecipients: string;

  /** Daily ceiling on AI tokens across all agents. 0 = unlimited. */
  aiDailyTokenBudget: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  agentsEnabled: false,
  visibilityEnabled: false,
  prospectorEnabled: false,
  conversationalistEnabled: false,
  analystEnabled: false,

  sesRegion: "eu-west-1",
  sesAccessKeyId: "",
  sesSecretAccessKey: "",
  sesFromEmail: "",
  sesFromName: "UAE E-Invoicing Providers",
  sesConfigurationSet: "",
  snsTopicArn: "",
  replyToEmail: "",

  // 75/day is the published ceiling for professional-services cold outreach on
  // one sending domain. The previous 200 was 2.7x that, and a 6.4% bounce rate
  // against Amazon's 5% review threshold is what over-sending buys you — a
  // suspension there would take the lead-notification mail down with it.
  outreachDailyCap: 75,
  outreachWarmupStartCap: 20,
  // Compounds once per day we actually send on. At 1.12 the ramp reaches the
  // 200/day ceiling in about three weeks of sending; at the previous 1.4 it got
  // there in seven days, which is far too steep for a domain with no sending
  // history and is what gets a new domain filtered.
  outreachWarmupGrowth: 1.12,
  outreachApprovalMode: "manual",
  outreachMaxFollowUps: 2,
  outreachStepDelayDays: 4,

  placesApiKey: "",
  prospectorDailyDiscoveryCap: 150,
  // Swept as "{sector} in {Emirate}, UAE", so each entry has to read like a
  // business type someone would search for.
  //
  // Aimed at businesses that will themselves be told to appoint a provider —
  // sectors where UAE companies routinely clear the AED 50m Phase 1 threshold
  // and issue B2B invoices in volume. Phase 1 goes live in January 2027, which
  // makes those the only prospects with a reason to act this year.
  //
  // Professional-services firms were removed. They are the distribution
  // channel, not the buyer: a third of the list was accounting firms, business
  // setup consultants and corporate services providers, and the emails ended
  // up pitching them a shortlist for their clients. That is a partnership
  // conversation and it does not belong in the same sweep as a compliance one.
  //
  // Consumer-facing sectors are deliberately absent: they invoice individuals,
  // so a shortlist is worth little to them and they score low anyway.
  prospectorSectors: [
    "freight forwarding company",
    "customs clearance agency",
    "logistics company",
    "warehousing company",
    "general contracting company",
    "MEP contractor",
    "interior fit-out company",
    "facilities management company",
    "equipment rental company",
    "manpower supply agency",
    "foodstuff trading company",
    "building materials supplier",
    "trading company",
    "manufacturing company",
    "retail chain",
  ].join(","),
  prospectorEmirates: "dubai,abu-dhabi,sharjah,ajman,ras-al-khaimah,fujairah,umm-al-quwain",
  prospectorMinScore: 55,

  searchApiProvider: "none",
  searchApiKey: "",
  gscServiceAccountJson: "",
  gscSiteUrl: "sc-domain:uaeasp.ae",
  visibilityWeeklyDraftCap: 10,
  visibilityDailyDraftCap: 2,
  sitemapFeedPath: "https://uaeasp.ae/sitemap.xml",
  indexingApiEnabled: false,
  indexingDailyPingCap: 20,

  senderName: "",
  senderTitle: "",
  companyLegalName: "UAE E-Invoicing Providers",
  companyAddress: "",
  offerHeadline: "A free shortlist of pre-approved e-invoicing providers",
  offerBody:
    "We maintain the complete directory of the 42 e-invoicing service providers accredited by the UAE Ministry of Finance. Tell us your invoice volume and accounting system and we will send back a shortlist of the three that fit — free, no obligation.",
  // The label on the one link the email carries. A cold email's job is to earn
  // a click, not to explain the offer, so this is a promise about what is on
  // the other side — not an instruction to do something.
  offerCta: "See which providers fit you",
  bookingLink: "",

  reportRecipients: "",

  aiDailyTokenBudget: 0,
};

const ENV_MAP: Partial<Record<keyof AgentConfig, string>> = {
  sesRegion: "SES_REGION",
  sesAccessKeyId: "SES_ACCESS_KEY_ID",
  sesSecretAccessKey: "SES_SECRET_ACCESS_KEY",
  sesFromEmail: "SES_FROM_EMAIL",
  sesConfigurationSet: "SES_CONFIGURATION_SET",
  snsTopicArn: "SNS_TOPIC_ARN",
  placesApiKey: "PLACES_API_KEY",
  searchApiKey: "SEARCH_API_KEY",
};

/** Fields masked in the UI and never returned in full to the browser. */
export const AGENT_SECRET_FIELDS: readonly (keyof AgentConfig)[] = [
  "sesSecretAccessKey",
  "placesApiKey",
  "searchApiKey",
  "gscServiceAccountJson",
];

async function readStored(): Promise<Partial<AgentConfig>> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, CONFIG_KEY))
      .limit(1);
    return (row?.value as Partial<AgentConfig>) ?? {};
  } catch {
    return {};
  }
}

export async function getAgentConfig(): Promise<AgentConfig> {
  const stored = await readStored();
  const out = { ...DEFAULT_AGENT_CONFIG };
  for (const key of Object.keys(DEFAULT_AGENT_CONFIG) as (keyof AgentConfig)[]) {
    const fromDb = stored[key];
    if (typeof fromDb === "boolean" || typeof fromDb === "number") {
      (out[key] as unknown) = fromDb;
      continue;
    }
    if (typeof fromDb === "string" && fromDb.trim() !== "") {
      (out[key] as unknown) = coerce(key, fromDb.trim());
      continue;
    }
    const envName = ENV_MAP[key];
    const envValue = envName ? (process.env[envName] ?? "").trim() : "";
    if (envValue) (out[key] as unknown) = coerce(key, envValue);
  }
  return out;
}

function coerce(key: keyof AgentConfig, value: string): string | number | boolean {
  const shape = DEFAULT_AGENT_CONFIG[key];
  if (typeof shape === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : shape;
  }
  if (typeof shape === "boolean") return value === "true" || value === "1";
  return value;
}

export async function setAgentConfig(updates: Partial<AgentConfig>): Promise<void> {
  const stored = await readStored();
  const next = { ...stored, ...updates };
  await db
    .insert(appSettings)
    .values({ key: CONFIG_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
}

/** Whether a given agent may run right now, and why not if it may not. */
export function agentReadiness(
  config: AgentConfig,
): Record<AgentKey, { enabled: boolean; ready: boolean; missing: string[] }> {
  const emailReady = !!(
    config.sesAccessKeyId &&
    config.sesSecretAccessKey &&
    config.sesFromEmail
  );
  const emailMissing = emailReady ? [] : ["Amazon SES credentials + verified sender"];

  const map: Record<AgentKey, { enabled: boolean; ready: boolean; missing: string[] }> = {
    visibility: {
      enabled: config.visibilityEnabled,
      ready: true,
      missing: config.searchApiProvider === "none" ? ["Search API key (mention discovery only)"] : [],
    },
    prospector: {
      enabled: config.prospectorEnabled,
      ready: !!config.placesApiKey,
      missing: config.placesApiKey ? [] : ["Google Places API key"],
    },
    conversationalist: {
      enabled: config.conversationalistEnabled,
      ready: emailReady && !!config.senderName,
      missing: [...emailMissing, ...(config.senderName ? [] : ["Sender name"])],
    },
    analyst: {
      enabled: config.analystEnabled,
      ready: true,
      missing: config.reportRecipients ? [] : ["Report recipients (falls back to sales alerts)"],
    },
  };
  for (const key of AGENT_KEYS) {
    if (!config.agentsEnabled) map[key].enabled = false;
  }
  return map;
}
