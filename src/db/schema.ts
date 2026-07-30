import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["admin", "sales"]);
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "matched",
  "closed_won",
  "closed_lost",
]);
export const providerStatusEnum = pgEnum("provider_status", [
  "active",
  "delisted",
  "hidden",
]);
export const scrapeStatusEnum = pgEnum("scrape_status", [
  "success",
  "failed",
  "rejected",
  "partial",
]);
export const dataSourceEnum = pgEnum("data_source", [
  "seed",
  "scrape_html",
  "scrape_pdf",
  "manual",
]);

export const PROVIDER_CATEGORIES = [
  "erp",
  "tax-tech",
  "consulting",
  "edi-network",
  "enterprise-software",
  "fintech",
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

/** One contact person from the official MOF list (a provider can have several). */
export interface ProviderContact {
  name?: string;
  emails: string[];
  phones: string[];
}

export const EMIRATES = [
  "abu-dhabi",
  "dubai",
  "sharjah",
  "ajman",
  "umm-al-quwain",
  "ras-al-khaimah",
  "fujairah",
] as const;
export type Emirate = (typeof EMIRATES)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("sales"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    nameAr: text("name_ar"),
    normalizedName: text("normalized_name").notNull().unique(),
    website: text("website"),
    description: text("description"),
    descriptionAr: text("description_ar"),
    emirates: text("emirates")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    priceTier: smallint("price_tier"),
    logoUrl: text("logo_url"),
    contactEmail: text("contact_email"),
    phone: text("phone"),
    // Official contact persons from the MOF list
    contacts: jsonb("contacts")
      .$type<ProviderContact[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    category: text("category").$type<ProviderCategory>(),
    status: providerStatusEnum("status").notNull().default("active"),
    source: dataSourceEnum("source").notNull().default("seed"),
    mofListedAt: date("mof_listed_at"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenInScrapeAt: timestamp("last_seen_in_scrape_at", { withTimezone: true }),
    missingScrapeCount: integer("missing_scrape_count").notNull().default(0),
    adminOverrides: jsonb("admin_overrides").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("providers_status_idx").on(t.status)],
);

export const scrapeRuns = pgTable("scrape_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: scrapeStatusEnum("status").notNull(),
  strategy: dataSourceEnum("strategy"),
  providersFound: integer("providers_found").notNull().default(0),
  added: integer("added").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  missing: integer("missing").notNull().default(0),
  rawPayload: jsonb("raw_payload"),
  error: text("error"),
  triggeredBy: text("triggered_by").notNull().default("cron"),
});

export const scrapeChanges = pgTable(
  "scrape_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => scrapeRuns.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),
    changeType: text("change_type").notNull(), // added|updated|missing|delisted|restored
    field: text("field"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scrape_changes_run_idx").on(t.runId)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    companyName: text("company_name").notNull(),
    email: text("email"),
    phone: text("phone").notNull(),
    emirate: text("emirate"),
    invoiceVolume: text("invoice_volume"),
    accountingSoftware: text("accounting_software"),
    budgetRange: text("budget_range"),
    timeline: text("timeline"),
    message: text("message"),
    source: text("source").notNull().default("form"),
    quizAnswers: jsonb("quiz_answers"),
    quizScore: integer("quiz_score"),
    locale: text("locale").notNull().default("en"),
    utm: jsonb("utm"),
    referrer: text("referrer"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    status: leadStatusEnum("status").notNull().default("new"),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    duplicateOf: uuid("duplicate_of"),
    flaggedDuplicate: boolean("flagged_duplicate").notNull().default(false),
    // Client-facing tracking: the token IS the client's login (parcel-tracking
    // style). Rotatable by deleting/regenerating; never expose lead.id publicly.
    trackingToken: uuid("tracking_token").notNull().defaultRandom().unique(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leads_email_idx").on(t.email),
    index("leads_phone_idx").on(t.phone),
    index("leads_status_created_idx").on(t.status, t.createdAt),
    index("leads_assigned_idx").on(t.assignedTo),
  ],
);

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(), // created|note|status_change|assignment|email_sent
    body: text("body"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_activities_lead_idx").on(t.leadId, t.createdAt)],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  diff: jsonb("diff"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** First-party analytics: pageviews and named conversion events. No cookies,
 * no IPs stored — a random per-tab session id groups a visit. */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type", { enum: ["pageview", "event"] }).notNull(),
    name: text("name"),
    path: text("path").notNull(),
    locale: text("locale"),
    sessionId: text("session_id").notNull(),
    /** Salted daily hash of IP + user agent — counts unique visitors without
     * ever storing the IP. Rotates every day by construction. */
    visitorId: text("visitor_id"),
    referrerHost: text("referrer_host"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    device: text("device", { enum: ["mobile", "desktop"] }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("analytics_events_created_at_idx").on(t.createdAt),
    index("analytics_events_type_created_idx").on(t.type, t.createdAt),
    index("analytics_events_session_created_idx").on(t.sessionId, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Growth agents
 *
 * Four autonomous agents share one runway: a Postgres job queue drained
 * by a worker process. Everything they do is recorded (agent_runs), every
 * outbound email is threaded (outreach_*), and every address that ever
 * opts out is remembered forever (suppression).
 * ------------------------------------------------------------------ */

export const AGENT_KEYS = [
  "visibility",
  "prospector",
  "conversationalist",
  "analyst",
] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

/** Work queue. Claimed with FOR UPDATE SKIP LOCKED so many workers are safe. */
export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent: text("agent", { enum: AGENT_KEYS }).notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    status: text("status", {
      enum: ["queued", "running", "done", "failed", "canceled"],
    })
      .notNull()
      .default("queued"),
    priority: integer("priority").notNull().default(100),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    /** Not eligible to run before this instant — powers retries and schedules. */
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    /** Optional idempotency key: re-enqueueing the same key is a no-op. */
    dedupeKey: text("dedupe_key"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("agent_tasks_claim_idx").on(t.status, t.runAfter, t.priority),
    uniqueIndex("agent_tasks_dedupe_idx").on(t.dedupeKey),
  ],
);

/** One execution of an agent step: what it consumed, produced and cost. */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent: text("agent", { enum: AGENT_KEYS }).notNull(),
    kind: text("kind").notNull(),
    taskId: uuid("task_id"),
    status: text("status", { enum: ["running", "success", "failed"] })
      .notNull()
      .default("running"),
    itemsIn: integer("items_in").notNull().default(0),
    itemsOut: integer("items_out").notNull().default(0),
    aiTokens: integer("ai_tokens").notNull().default(0),
    /** Cost in US cents ×100 (millicents) — integer maths, no float drift. */
    costMillicents: integer("cost_millicents").notNull().default(0),
    summary: jsonb("summary"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("agent_runs_agent_started_idx").on(t.agent, t.startedAt)],
);

export const PROSPECT_STATUSES = [
  "discovered",
  "enriched",
  "contactable",
  "sequenced",
  "replied",
  "converted",
  "rejected",
  "suppressed",
] as const;

/** A UAE business the Prospector found and may reach out to. */
export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    website: text("website"),
    /** Registrable domain, lowercased — the natural dedupe key. */
    domain: text("domain"),
    placeId: text("place_id"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    emirate: text("emirate"),
    /** Search category that surfaced it, e.g. "accounting", "logistics". */
    sector: text("sector"),
    sizeHint: text("size_hint"),
    /** Which mandate wave they most likely fall into, from Cabinet Decision phasing. */
    mandateWave: text("mandate_wave"),
    /** 0-100 fit score from the AI qualification pass. */
    score: integer("score"),
    scoreReason: text("score_reason"),
    /** Compact brief built from the prospect's own site, for personalisation. */
    siteDigest: text("site_digest"),
    /** Facts the AI pulled out of that brief: services, sectors, ERP, clients. */
    profile: jsonb("profile"),
    status: text("status", { enum: PROSPECT_STATUSES }).notNull().default("discovered"),
    source: text("source").notNull().default("places"),
    raw: jsonb("raw"),
    /** Set once outreach converts them into a CRM lead. */
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("prospects_domain_idx").on(t.domain),
    uniqueIndex("prospects_place_idx").on(t.placeId),
    index("prospects_status_score_idx").on(t.status, t.score),
  ],
);

/** An address discovered on a prospect's site, with how much we trust it. */
export const prospectContacts = pgTable(
  "prospect_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role"),
    /** info@/sales@ style shared mailbox — deprioritised, never removed. */
    isRoleAccount: boolean("is_role_account").notNull().default(false),
    verification: text("verification", {
      enum: ["unknown", "syntax_ok", "mx_ok", "invalid", "risky"],
    })
      .notNull()
      .default("unknown"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    sourceUrl: text("source_url"),
    priority: integer("priority").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("prospect_contacts_email_idx").on(t.prospectId, t.email)],
);

/** One ongoing email conversation with one contact. */
export const outreachThreads = pgTable(
  "outreach_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").references(() => prospects.id, {
      onDelete: "cascade",
    }),
    contactId: uuid("contact_id").references(() => prospectContacts.id, {
      onDelete: "set null",
    }),
    /** Which agent owns this thread: outreach vs link-building. */
    agent: text("agent", { enum: AGENT_KEYS }).notNull().default("conversationalist"),
    campaign: text("campaign").notNull().default("default"),
    toEmail: text("to_email").notNull(),
    subject: text("subject"),
    status: text("status", {
      enum: [
        "active",
        "awaiting_reply",
        "replied",
        "converted",
        "closed",
        "bounced",
        "unsubscribed",
      ],
    })
      .notNull()
      .default("active"),
    stepIndex: integer("step_index").notNull().default(0),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    /** Signed token embedded in links so replies and clicks map back here. */
    token: uuid("token").notNull().defaultRandom().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("outreach_threads_next_action_idx").on(t.status, t.nextActionAt),
    index("outreach_threads_email_idx").on(t.toEmail),
  ],
);

export const outreachMessages = pgTable(
  "outreach_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => outreachThreads.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: ["outbound", "inbound"] }).notNull(),
    status: text("status", {
      enum: [
        "draft",
        "pending_approval",
        "scheduled",
        "sending",
        "sent",
        "failed",
        "received",
        "rejected",
      ],
    }).notNull(),
    stepIndex: integer("step_index"),
    subject: text("subject"),
    /** The writer's own words, without signature, CTA or opt-out.
     *  Kept separately so the wrapper can be rebuilt at send time against the
     *  current rules — a draft written last week must not go out carrying last
     *  week's call to action. Null on rows created before this existed. */
    bodyRaw: text("body_raw"),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html"),
    fromEmail: text("from_email"),
    toEmail: text("to_email"),
    /** RFC 5322 Message-ID, used to thread replies correctly. */
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    providerMessageId: text("provider_message_id"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    /** When a worker claimed this row for sending — in-flight messages count
     *  against the daily cap so concurrent workers cannot overshoot it. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    /** Opaque per-message token used by the open pixel and click redirect. */
    trackToken: uuid("track_token").notNull().defaultRandom().unique(),
    /** Engagement. Opens are approximate — image proxies and blocked images
     *  both distort them — so clicks are the number worth trusting. */
    openedAt: timestamp("opened_at", { withTimezone: true }),
    openCount: integer("open_count").notNull().default(0),
    firstClickAt: timestamp("first_click_at", { withTimezone: true }),
    clickCount: integer("click_count").notNull().default(0),
    /** Where the most recent click went. A click on the personalised page and
     *  a click on the directory mean different things, and the counter alone
     *  cannot tell them apart. */
    lastClickPath: text("last_click_path"),
    error: text("error"),
    aiMeta: jsonb("ai_meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("outreach_messages_thread_idx").on(t.threadId, t.createdAt),
    index("outreach_messages_status_idx").on(t.status, t.scheduledFor),
  ],
);

/** Permanent do-not-contact list. Checked before every single send. */
export const suppressions = pgTable(
  "suppressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    domain: text("domain"),
    reason: text("reason", {
      enum: ["unsubscribe", "bounce", "complaint", "manual", "invalid"],
    }).notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("suppressions_email_idx").on(t.email),
    index("suppressions_domain_idx").on(t.domain),
  ],
);

/** Targets the Visibility agent works: citations, mentions, link prospects. */
export const visibilityTargets = pgTable(
  "visibility_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: ["citation", "mention", "link"] }).notNull(),
    url: text("url").notNull(),
    domain: text("domain"),
    title: text("title"),
    snippet: text("snippet"),
    query: text("query"),
    status: text("status", {
      enum: ["discovered", "queued", "drafted", "actioned", "won", "skipped"],
    })
      .notNull()
      .default("discovered"),
    /** Human-facing note or the draft the agent produced for approval. */
    draft: text("draft"),
    notes: text("notes"),
    meta: jsonb("meta"),
    actionedAt: timestamp("actioned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("visibility_targets_url_idx").on(t.kind, t.url),
    index("visibility_targets_status_idx").on(t.status),
  ],
);

/** Keywords we want to own, with the last observed position. */
export const seoKeywords = pgTable(
  "seo_keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phrase: text("phrase").notNull(),
    locale: text("locale").notNull().default("en"),
    priority: integer("priority").notNull().default(100),
    lastPosition: integer("last_position"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    /** Real demand from Search Console: what this query did over the window. */
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    /** The URL Google actually shows for this query — not the one we assumed. */
    rankingPath: text("ranking_path"),
    /** True when we have no page targeting it — the content agent's queue. */
    hasGap: boolean("has_gap").notNull().default(false),
    coveredByPath: text("covered_by_path"),
    source: text("source").notNull().default("seed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("seo_keywords_phrase_idx").on(t.phrase, t.locale)],
);

/** Agent-drafted articles published at /insights/<slug> once approved. */
export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    locale: text("locale").notNull().default("en"),
    title: text("title").notNull(),
    summary: text("summary"),
    bodyMd: text("body_md").notNull(),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text("status", { enum: ["draft", "approved", "published", "archived"] })
      .notNull()
      .default("draft"),
    agentGenerated: boolean("agent_generated").notNull().default(true),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("articles_slug_locale_idx").on(t.slug, t.locale),
    index("articles_status_idx").on(t.status, t.publishedAt),
  ],
);

/** Analyst output: one row per reporting period. */
export const agentReports = pgTable(
  "agent_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull().default("weekly"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    metrics: jsonb("metrics").notNull(),
    narrativeMd: text("narrative_md"),
    recommendations: jsonb("recommendations"),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agent_reports_period_idx").on(t.kind, t.periodStart)],
);

/** Replay guard for signed webhooks: one row per provider message id. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull().default("sns"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_events_received_idx").on(t.receivedAt)],
);

export type User = typeof users.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type ScrapeChange = typeof scrapeChanges.$inferSelect;
export type AgentTask = typeof agentTasks.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type Prospect = typeof prospects.$inferSelect;
export type NewProspect = typeof prospects.$inferInsert;
export type ProspectContact = typeof prospectContacts.$inferSelect;
export type OutreachThread = typeof outreachThreads.$inferSelect;
export type OutreachMessage = typeof outreachMessages.$inferSelect;
export type Suppression = typeof suppressions.$inferSelect;
export type VisibilityTarget = typeof visibilityTargets.$inferSelect;
export type SeoKeyword = typeof seoKeywords.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type AgentReport = typeof agentReports.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
