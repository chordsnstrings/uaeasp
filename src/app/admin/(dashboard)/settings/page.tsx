import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CONFIG_FIELDS, getConfigStatus, type AppConfig } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";
import { SettingsForm } from "@/components/admin/SettingsForm";
import {
  Badge,
  Card,
  Dot,
  Field,
  PageHeader,
  SectionTitle,
  StatCard,
  type Tone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const LABELS: Record<keyof AppConfig, string> = {
  smtpHost: "SMTP host",
  smtpPort: "SMTP port",
  smtpUser: "SMTP username",
  smtpPass: "SMTP password",
  emailFrom: "From address",
  salesNotifyEmails: "Sales team emails",
  adminAlertEmail: "Admin alert email",
  aiApiBaseUrl: "AI API base URL",
  aiApiKey: "AI API key",
  aiModel: "AI model",
  ingestSecret: "Ingest secret",
};

const GROUPS: { title: string; fields: (keyof AppConfig)[] }[] = [
  { title: "Email (SMTP)", fields: ["smtpHost", "smtpPort", "smtpUser", "smtpPass", "emailFrom"] },
  { title: "Notifications", fields: ["salesNotifyEmails", "adminAlertEmail"] },
  { title: "AI profile drafts", fields: ["aiApiBaseUrl", "aiApiKey", "aiModel"] },
  { title: "Data refresh", fields: ["ingestSecret"] },
];

const SOURCE_TONE: Record<string, Tone> = { db: "brand", env: "info", none: "neutral" };
const SOURCE_LABEL: Record<string, string> = {
  db: "set here",
  env: "from env",
  none: "not set",
};

export default async function AdminSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/admin");

  const status = await getConfigStatus();

  const fromDb = CONFIG_FIELDS.filter((f) => status[f].source === "db").length;
  const fromEnv = CONFIG_FIELDS.filter((f) => status[f].source === "env").length;
  const unset = CONFIG_FIELDS.filter((f) => !status[f].set).length;
  const configured = CONFIG_FIELDS.length - unset;

  const capabilities: { label: string; on: boolean; onHint: string; offHint: string }[] = [
    {
      label: "Email sending",
      on: status.smtpHost.set,
      onHint: "Lead alerts and reports go out over SMTP.",
      offHint: "No SMTP host — emails are written to the server log only.",
    },
    {
      label: "AI profile drafts",
      on: status.aiApiKey.set && status.aiApiBaseUrl.set && status.aiModel.set,
      onHint: "New providers get an auto-drafted EN + AR profile.",
      offHint: "Needs a base URL, a key and a model before it runs.",
    },
    {
      label: "Scheduled data refresh",
      on: status.ingestSecret.set,
      onHint: "The nightly workflow can deliver results to the ingest endpoint.",
      offHint: "Without the secret, only a signed-in admin can post to the ingest endpoint.",
    },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Runtime configuration for email, notifications, AI drafts and the data-refresh secret. Values saved here override environment variables and apply immediately. Secrets are write-only — they are never displayed after saving."
      />

      <section>
        <SectionTitle hint="Across the eleven runtime settings below.">Configuration</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Configured"
            value={`${configured}/${CONFIG_FIELDS.length}`}
            tone={unset === 0 ? "positive" : "neutral"}
            hint="Resolved from this screen or the environment."
          />
          <StatCard label="Saved here" value={fromDb} tone="brand" hint="Stored in the database." />
          <StatCard
            label="From environment"
            value={fromEnv}
            tone="info"
            hint="Deploy-time variables, overridable here."
          />
          <StatCard
            label="Not set"
            value={unset}
            tone={unset > 0 ? "warning" : "neutral"}
            hint={unset > 0 ? "Features using these stay off." : "Everything is configured."}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <SectionTitle hint="What these settings switch on right now.">Live capabilities</SectionTitle>
          <ul className="space-y-3">
            {capabilities.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5">
                <span className="mt-1.5">
                  <Dot tone={c.on ? "positive" : "neutral"} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {c.label}
                    <Badge tone={c.on ? "positive" : "neutral"} className="ms-2">
                      {c.on ? "on" : "off"}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                    {c.on ? c.onHint : c.offHint}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle hint="Where each value is currently coming from. Secrets show only their last four characters.">
            Where the values come from
          </SectionTitle>
          <div className="space-y-5">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                  {group.title}
                </p>
                <dl className="mt-2 grid gap-4 sm:grid-cols-2">
                  {group.fields.map((field) => {
                    const s = status[field];
                    return (
                      <Field key={field} label={LABELS[field]}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone={SOURCE_TONE[s.source] ?? "neutral"}>
                            {SOURCE_LABEL[s.source] ?? s.source}
                          </Badge>
                          {s.set && (
                            <span
                              className="num max-w-[16rem] truncate text-xs text-ink-500"
                              dir="ltr"
                              title={s.preview}
                            >
                              {s.preview}
                            </span>
                          )}
                        </span>
                      </Field>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <SettingsForm status={status} ingestUrl={absoluteUrl("/api/ingest/providers")} />
    </>
  );
}
