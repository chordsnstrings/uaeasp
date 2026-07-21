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
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    emirate: text("emirate").notNull(),
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
  ],
);

export type User = typeof users.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type ScrapeChange = typeof scrapeChanges.$inferSelect;
