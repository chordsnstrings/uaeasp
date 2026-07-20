"use client";

import { useActionState } from "react";
import {
  saveSettingsAction,
  sendTestEmailAction,
  testAiAction,
} from "@/app/admin/(dashboard)/settings/actions";

interface FieldStatus {
  set: boolean;
  source: "db" | "env" | "none";
  preview: string;
}

type Status = Record<string, FieldStatus>;

function SourceBadge({ status }: { status: FieldStatus }) {
  if (!status.set) {
    return (
      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-500">
        not set
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
        status.source === "db"
          ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
          : "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200"
      }`}
    >
      {status.source === "db" ? "set here" : "from env"}
    </span>
  );
}

function Field({
  name,
  label,
  status,
  secret = false,
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  status: FieldStatus;
  secret?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <label htmlFor={`setting-${name}`} className="text-sm font-semibold text-ink-800">
          {label}
        </label>
        <SourceBadge status={status} />
      </div>
      <input
        id={`setting-${name}`}
        name={name}
        type={secret ? "password" : "text"}
        autoComplete="off"
        defaultValue={secret ? "" : status.source === "db" ? status.preview : ""}
        placeholder={
          secret
            ? status.set
              ? `${status.preview} — enter a new value to replace`
              : (placeholder ?? "")
            : status.source === "env" && status.set
              ? `${status.preview} (from env — type to override)`
              : (placeholder ?? "")
        }
        dir="ltr"
        className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export function SettingsForm({ status, ingestUrl }: { status: Status; ingestUrl: string }) {
  const [saveState, saveAction, saving] = useActionState(saveSettingsAction, undefined);
  const [testState, testAction, testing] = useActionState(sendTestEmailAction, undefined);
  const [aiState, aiAction, aiTesting] = useActionState(testAiAction, undefined);

  return (
    <div className="max-w-3xl space-y-8">
      <form action={saveAction} className="space-y-8">
        {/* Email / SMTP */}
        <section className="rounded-2xl border border-ink-100 bg-white p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
            Email (SMTP)
          </h2>
          <p className="mt-1 text-xs text-ink-400">
            Works with any SMTP provider — Resend (smtp.resend.com), Postmark, SES, Zoho…
            Leave the host empty to disable sending (emails are then logged only).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field name="smtpHost" label="SMTP host" status={status.smtpHost} placeholder="smtp.resend.com" />
            <Field name="smtpPort" label="SMTP port" status={status.smtpPort} placeholder="587" />
            <Field name="smtpUser" label="SMTP username" status={status.smtpUser} placeholder="resend" />
            <Field
              name="smtpPass"
              label="SMTP password / API key"
              status={status.smtpPass}
              secret
              hint='Write-only. Blank keeps the current value; type "unset" to clear.'
            />
            <div className="sm:col-span-2">
              <Field
                name="emailFrom"
                label="From address"
                status={status.emailFrom}
                placeholder='UAE E-Invoicing Providers <leads@your-domain.ae>'
              />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-2xl border border-ink-100 bg-white p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
            Notifications
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              name="salesNotifyEmails"
              label="Sales team emails"
              status={status.salesNotifyEmails}
              placeholder="sales@your-domain.ae, jana@your-domain.ae"
              hint="Comma-separated. Every new lead is sent here instantly."
            />
            <Field
              name="adminAlertEmail"
              label="Admin alert email"
              status={status.adminAlertEmail}
              placeholder="admin@your-domain.ae"
              hint="Directory refresh changes and failure alerts."
            />
          </div>
        </section>

        {/* AI enrichment */}
        <section className="rounded-2xl border border-ink-100 bg-white p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
            AI profile drafts
          </h2>
          <p className="mt-1 text-xs text-ink-400">
            Optional. When configured, newly discovered providers get an auto-drafted
            English + Arabic profile (empty fields only — your edits are never touched).
            Any OpenAI-compatible API works.
          </p>
          <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-relaxed text-ink-600">
            <p className="font-bold text-ink-800">Using BytePlus (ModelArk)? Map the console fields like this:</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <span className="font-semibold text-ink-800">API key</span> ← the key from
                BytePlus console → <span className="italic">API Key Management</span> — the value
                starting <code className="rounded bg-white px-1" dir="ltr">ark-…</code> (the name
                you gave it, e.g. &ldquo;BakeOffAPI&rdquo;, and the Resource ID{" "}
                <code className="rounded bg-white px-1" dir="ltr">apikey-…</code> are just labels —
                don&rsquo;t paste those here).
              </li>
              <li>
                <span className="font-semibold text-ink-800">API base URL</span> ← BytePlus&rsquo;s
                chat endpoint:{" "}
                <code className="rounded bg-white px-1" dir="ltr">
                  https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions
                </code>
              </li>
              <li>
                <span className="font-semibold text-ink-800">Model</span> ← the model ID (or your
                endpoint ID) from the BytePlus model list, e.g.{" "}
                <code className="rounded bg-white px-1" dir="ltr">seed-1-6-250615</code>.
              </li>
            </ul>
            <p className="mt-2 text-ink-500">
              For OpenAI, DeepSeek, GLM or any other OpenAI-compatible service, the same three
              fields apply — base URL, key, model — and a base URL without{" "}
              <code className="rounded bg-white px-1" dir="ltr">/chat/completions</code> gets{" "}
              <code className="rounded bg-white px-1" dir="ltr">/v1/chat/completions</code> appended
              automatically.
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                name="aiApiBaseUrl"
                label="API base URL"
                status={status.aiApiBaseUrl}
                placeholder="https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions"
                hint="The provider's chat-completions endpoint (or its API root)."
              />
            </div>
            <Field
              name="aiApiKey"
              label="API key"
              status={status.aiApiKey}
              secret
              hint='The secret key itself (BytePlus: starts with "ark-"). Write-only — blank keeps the current value; type "unset" to clear.'
            />
            <Field
              name="aiModel"
              label="Model"
              status={status.aiModel}
              placeholder="seed-1-6-250615"
              hint="Model or endpoint ID exactly as the provider lists it."
            />
          </div>
        </section>

        {/* Ingest */}
        <section className="rounded-2xl border border-ink-100 bg-white p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
            Data refresh (scraper)
          </h2>
          <p className="mt-1 text-xs text-ink-400">
            The refresh reads the official Ministry of Finance list (the source page) and
            delivers the result to this site&rsquo;s own ingest endpoint. Two different URLs,
            two different jobs.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-ink-800">
                Source page <span className="font-normal text-ink-400">— what gets read (fixed)</span>
              </p>
              <p className="mt-1 break-all rounded-xl bg-ink-50 px-4 py-2.5 font-mono text-xs text-ink-700" dir="ltr">
                https://mof.gov.ae/en/about-us/initiatives/einvoicing/pre-approved-einvoicing-service-providers/
              </p>
              <p className="mt-1 text-xs text-ink-400">
                The official MoF pre-approved provider list. Both the nightly refresh and the
                &ldquo;Refresh now&rdquo; button read from here — it is built into the app and
                needs no configuration.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-800">
                Ingest URL <span className="font-normal text-ink-400">— where results are delivered</span>
              </p>
              <p className="mt-1 break-all rounded-xl bg-ink-50 px-4 py-2.5 font-mono text-xs text-ink-700" dir="ltr">
                {ingestUrl}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                This site&rsquo;s own receiving endpoint — not the MoF page. Set it as the{" "}
                <code>INGEST_URL</code> secret in GitHub → repo Settings → Secrets → Actions,
                together with the secret below as <code>INGEST_SECRET</code>, so the nightly
                workflow can deliver its results here.
              </p>
            </div>
            <Field
              name="ingestSecret"
              label="Ingest secret"
              status={status.ingestSecret}
              secret
              hint="Must match the INGEST_SECRET GitHub Actions secret. Changing it here rotates it immediately — update GitHub at the same time or the nightly refresh will fail."
            />
          </div>
        </section>

        {saveState?.error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
            {saveState.error}
          </p>
        )}
        {saveState?.ok && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            Settings saved. They take effect immediately — no redeploy needed.
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="press rounded-xl bg-brand-700 px-6 py-3 font-bold text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>

      {/* Test AI connection */}
      <form action={aiAction} className="rounded-2xl border border-ink-100 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
          Test AI connection
        </h2>
        <p className="mt-1 text-xs text-ink-400">
          Sends a tiny request to the configured AI endpoint using the saved key and model.
          Save your settings first, then test.
        </p>
        <button
          type="submit"
          disabled={aiTesting}
          className="press mt-4 rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800 disabled:opacity-50"
        >
          {aiTesting ? "Testing…" : "Test AI connection"}
        </button>
        {aiState?.error && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
            {aiState.error}
          </p>
        )}
        {aiState?.ok && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            AI connection works. {aiState.detail}
          </p>
        )}
      </form>

      {/* Test email */}
      <form action={testAction} className="rounded-2xl border border-ink-100 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
          Send a test email
        </h2>
        <p className="mt-1 text-xs text-ink-400">
          Uses the saved SMTP settings. Sends to your account email unless you enter another
          address.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            name="to"
            type="email"
            placeholder="you@your-domain.ae (optional)"
            dir="ltr"
            className="w-full max-w-xs rounded-xl border border-ink-200 px-4 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={testing}
            className="press rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800 disabled:opacity-50"
          >
            {testing ? "Sending…" : "Send test"}
          </button>
        </div>
        {testState?.error && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
            {testState.error}
          </p>
        )}
        {testState?.ok && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            Test email sent — check the inbox (and spam folder). If SMTP is not configured,
            it was logged to the server console instead.
          </p>
        )}
      </form>
    </div>
  );
}
