import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

/**
 * Runtime-configurable settings, editable in /admin/settings and stored in
 * app_settings under one key. Resolution order: DB value (if non-empty) →
 * environment variable → empty. Env vars therefore act as bootstrap/fallback
 * config, and admins can override everything at runtime without a redeploy.
 */

const CONFIG_KEY = "app_config";

export interface AppConfig {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  salesNotifyEmails: string;
  adminAlertEmail: string;
  aiApiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  ingestSecret: string;
}

export const CONFIG_FIELDS = [
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPass",
  "emailFrom",
  "salesNotifyEmails",
  "adminAlertEmail",
  "aiApiBaseUrl",
  "aiApiKey",
  "aiModel",
  "ingestSecret",
] as const satisfies readonly (keyof AppConfig)[];

/** Fields treated as secrets: write-only in the UI, masked everywhere. */
export const SECRET_FIELDS: readonly (keyof AppConfig)[] = [
  "smtpPass",
  "aiApiKey",
  "ingestSecret",
];

const ENV_MAP: Record<keyof AppConfig, string> = {
  smtpHost: "SMTP_HOST",
  smtpPort: "SMTP_PORT",
  smtpUser: "SMTP_USER",
  smtpPass: "SMTP_PASS",
  emailFrom: "EMAIL_FROM",
  salesNotifyEmails: "SALES_NOTIFY_EMAILS",
  adminAlertEmail: "ADMIN_ALERT_EMAIL",
  aiApiBaseUrl: "AI_API_BASE_URL",
  aiApiKey: "AI_API_KEY",
  aiModel: "AI_MODEL",
  ingestSecret: "INGEST_SECRET",
};

async function readStored(): Promise<Partial<AppConfig>> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, CONFIG_KEY))
      .limit(1);
    return (row?.value as Partial<AppConfig>) ?? {};
  } catch {
    // If the DB is briefly unavailable, fall back to env-only config rather
    // than failing the caller (emails, AI drafts) outright.
    return {};
  }
}

/** Effective config: DB overrides env; empty strings mean "unset". */
export async function getConfig(): Promise<AppConfig> {
  const stored = await readStored();
  const out = {} as AppConfig;
  for (const field of CONFIG_FIELDS) {
    const fromDb = stored[field];
    out[field] =
      typeof fromDb === "string" && fromDb.trim() !== ""
        ? fromDb.trim()
        : (process.env[ENV_MAP[field]] ?? "").trim();
  }
  return out;
}

/**
 * Merge updates into the stored config. Values are stored as given; empty
 * string clears the DB value (falling back to the env var).
 */
export async function setConfig(updates: Partial<AppConfig>): Promise<void> {
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

/** For the settings UI: which fields have a value, and where it comes from. */
export async function getConfigStatus(): Promise<
  Record<keyof AppConfig, { set: boolean; source: "db" | "env" | "none"; preview: string }>
> {
  const stored = await readStored();
  const out = {} as Record<
    keyof AppConfig,
    { set: boolean; source: "db" | "env" | "none"; preview: string }
  >;
  for (const field of CONFIG_FIELDS) {
    const dbValue = typeof stored[field] === "string" ? stored[field]!.trim() : "";
    const envValue = (process.env[ENV_MAP[field]] ?? "").trim();
    const value = dbValue || envValue;
    const source = dbValue ? "db" : envValue ? "env" : "none";
    const isSecret = SECRET_FIELDS.includes(field);
    out[field] = {
      set: value !== "",
      source,
      preview:
        value === ""
          ? ""
          : isSecret
            ? `••••••${value.slice(-4)}`
            : value,
    };
  }
  return out;
}
