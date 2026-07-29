"use client";

import { useActionState, useState } from "react";
import {
  approveMessageAction,
  publishArticleAction,
  queueJobAction,
  rejectMessageAction,
  runTickAction,
  saveAgentConfigAction,
  saveModelRoutingAction,
  suppressEmailAction,
  testSesAction,
  updateTargetAction,
} from "@/app/admin/(dashboard)/agents/actions";
import type { AgentConfig } from "@/lib/agents/config";

/** Shared bits of chrome for the agent console. */

// These constants style every control in the console, so they are the one
// place the client components meet the Ledger primitives the pages use. They
// deliberately mirror ButtonLink in components/admin/ui.tsx: a migrated page
// wrapping an un-migrated button is the seam users actually notice.
const inputClass =
  "w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const buttonClass =
  "press inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50";
const ghostButtonClass =
  "press inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-50";
/** Reject is not destructive, but it does end a conversation — say so in colour. */
const cautionButtonClass =
  "press inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50";

function Status({ state }: { state?: { ok?: boolean; error?: string; detail?: string } }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800 ring-1 ring-brand-200">
        {state.detail ?? "Saved."}
      </p>
    );
  }
  return null;
}

function Toggle({
  name,
  label,
  checked,
  hint,
}: {
  name: keyof AgentConfig;
  label: string;
  checked: boolean;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 bg-white p-3 transition-colors hover:border-brand-300">
      <input type="hidden" name={`__present_${name}`} value="1" />
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-0.5 size-4 accent-brand-700"
      />
      <span>
        <span className="block text-sm font-semibold text-ink-800">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>}
      </span>
    </label>
  );
}

function Text({
  name,
  label,
  value,
  hint,
  type = "text",
  secret = false,
  isSet = false,
  textarea = false,
}: {
  name: keyof AgentConfig;
  label: string;
  value: string | number;
  hint?: string;
  type?: string;
  secret?: boolean;
  isSet?: boolean;
  textarea?: boolean;
}) {
  return (
    <div>
      <label htmlFor={`agent-${name}`} className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink-800">
        {label}
        {secret && (
          <span
            className={`num rounded-full px-2 py-0.5 text-[10px] uppercase ${
              isSet ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "bg-ink-100 text-ink-500"
            }`}
          >
            {isSet ? "set" : "not set"}
          </span>
        )}
      </label>
      {textarea ? (
        <textarea
          id={`agent-${name}`}
          name={name}
          rows={4}
          defaultValue={String(value)}
          className={inputClass}
        />
      ) : (
        <input
          id={`agent-${name}`}
          name={name}
          type={secret ? "password" : type}
          autoComplete="off"
          defaultValue={secret ? "" : String(value)}
          placeholder={secret && isSet ? "•••••• — enter a new value to replace" : undefined}
          dir="ltr"
          className={inputClass}
        />
      )}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-ink-200 bg-white p-5">
      <h2 className="num text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function AgentConfigForm({
  config,
  secretsSet,
}: {
  config: AgentConfig;
  secretsSet: Record<string, boolean>;
}) {
  const [state, action, pending] = useActionState(saveAgentConfigAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <Section title="Switches">
        <Toggle
          name="agentsEnabled"
          label="Master switch"
          checked={config.agentsEnabled}
          hint="Off means nothing runs, no matter what else is configured."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            name="prospectorEnabled"
            label="Prospector"
            checked={config.prospectorEnabled}
            hint="Finds UAE businesses and their contact addresses."
          />
          <Toggle
            name="conversationalistEnabled"
            label="Conversationalist"
            checked={config.conversationalistEnabled}
            hint="Writes, sends and answers outreach email."
          />
          <Toggle
            name="visibilityEnabled"
            label="Visibility"
            checked={config.visibilityEnabled}
            hint="Rank checks, content drafts, citations, link outreach."
          />
          <Toggle
            name="analystEnabled"
            label="Analyst"
            checked={config.analystEnabled}
            hint="Weekly report by email."
          />
        </div>
      </Section>

      <Section title="Amazon SES">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text name="sesRegion" label="Region" value={config.sesRegion} hint="e.g. eu-west-1, us-east-1" />
          <Text name="sesFromEmail" label="From address" value={config.sesFromEmail} hint="Must be a verified SES identity." />
          <Text name="sesFromName" label="From name" value={config.sesFromName} />
          <Text name="replyToEmail" label="Reply-to" value={config.replyToEmail} hint="Where replies land. Defaults to the from address." />
          <Text name="sesAccessKeyId" label="Access key ID" value={config.sesAccessKeyId} />
          <Text
            name="sesSecretAccessKey"
            label="Secret access key"
            value=""
            secret
            isSet={secretsSet.sesSecretAccessKey}
          />
          <Text
            name="sesConfigurationSet"
            label="Configuration set"
            value={config.sesConfigurationSet}
            hint="Optional. Needed for bounce/complaint events via SNS."
          />
        </div>
      </Section>

      <Section title="Outreach guardrails">
        <div className="grid gap-4 sm:grid-cols-3">
          <Text name="outreachDailyCap" label="Daily cap" value={config.outreachDailyCap} type="number" />
          <Text name="outreachWarmupStartCap" label="Warm-up start" value={config.outreachWarmupStartCap} type="number" hint="Day-one send limit." />
          <Text name="outreachWarmupGrowth" label="Warm-up growth" value={config.outreachWarmupGrowth} type="number" hint="Multiplier per day, e.g. 1.4" />
          <Text name="outreachMaxFollowUps" label="Max follow-ups" value={config.outreachMaxFollowUps} type="number" />
          <Text name="outreachStepDelayDays" label="Days between steps" value={config.outreachStepDelayDays} type="number" />
          <div>
            <label htmlFor="agent-mode" className="mb-1.5 block text-sm font-semibold text-ink-800">
              Approval mode
            </label>
            <select
              id="agent-mode"
              name="outreachApprovalMode"
              defaultValue={config.outreachApprovalMode}
              className={inputClass}
            >
              <option value="manual">Manual — approve every email</option>
              <option value="first_touch">First touch auto, replies approved</option>
              <option value="auto">Fully automatic</option>
            </select>
            <p className="mt-1 text-xs text-ink-400">Start manual. Move up once you trust the copy.</p>
          </div>
        </div>
      </Section>

      <Section title="Prospector">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            name="placesApiKey"
            label="Google Places API key"
            value=""
            secret
            isSet={secretsSet.placesApiKey}
          />
          <Text name="prospectorDailyDiscoveryCap" label="New prospects per day" value={config.prospectorDailyDiscoveryCap} type="number" />
          <Text name="prospectorMinScore" label="Minimum fit score" value={config.prospectorMinScore} type="number" hint="0-100. Below this, a prospect waits for a human." />
        </div>
        <Text name="prospectorSectors" label="Search terms" value={config.prospectorSectors} textarea hint="Comma-separated. Each is combined with every emirate." />
        <Text name="prospectorEmirates" label="Emirates" value={config.prospectorEmirates} hint="Comma-separated slugs." />
      </Section>

      <Section title="Offer copy">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text name="senderName" label="Sender name" value={config.senderName} hint="The human the email comes from." />
          <Text name="senderTitle" label="Sender title" value={config.senderTitle} />
          <Text name="companyLegalName" label="Company name" value={config.companyLegalName} />
          <Text name="companyAddress" label="Postal address" value={config.companyAddress} hint="Shown in the signature — required by most anti-spam rules." />
          <Text name="bookingLink" label="Booking link" value={config.bookingLink} hint="Optional calendar URL." />
        </div>
        <Text name="offerHeadline" label="Offer headline" value={config.offerHeadline} />
        <Text name="offerBody" label="Offer description" value={config.offerBody} textarea hint="What the agent pitches. Keep it honest and specific." />
        <Text name="offerCta" label="Call to action" value={config.offerCta} />
      </Section>

      <Section title="Visibility & reporting">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="agent-search" className="mb-1.5 block text-sm font-semibold text-ink-800">
              Search provider
            </label>
            <select
              id="agent-search"
              name="searchApiProvider"
              defaultValue={config.searchApiProvider}
              className={inputClass}
            >
              <option value="none">None — skip rank checks</option>
              <option value="serper">Serper (Google)</option>
              <option value="bing">Bing Web Search</option>
            </select>
          </div>
          <Text name="searchApiKey" label="Search API key" value="" secret isSet={secretsSet.searchApiKey} />
          <Text name="visibilityWeeklyDraftCap" label="Article drafts per week" value={config.visibilityWeeklyDraftCap} type="number" />
          <Text name="reportRecipients" label="Report recipients" value={config.reportRecipients} hint="Comma-separated. Falls back to the admin alert address." />
          <Text name="aiDailyTokenBudget" label="Daily AI token budget" value={config.aiDailyTokenBudget} type="number" hint="0 means unlimited." />
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save agent settings"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function TickButton() {
  const [state, action, pending] = useActionState(runTickAction, undefined);
  return (
    <form action={action}>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Running…" : "Run agents now"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function TestSesForm({ defaultTo }: { defaultTo: string }) {
  const [state, action, pending] = useActionState(testSesAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[16rem] flex-1">
        <label htmlFor="ses-test-to" className="mb-1.5 block text-sm font-semibold text-ink-800">
          Send a test email to
        </label>
        <input id="ses-test-to" name="to" type="email" defaultValue={defaultTo} className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={ghostButtonClass}>
        {pending ? "Sending…" : "Test SES"}
      </button>
      <div className="w-full">
        <Status state={state} />
      </div>
    </form>
  );
}

export function QueueJobForm({ jobs }: { jobs: { agent: string; kind: string; label: string }[] }) {
  const [state, action, pending] = useActionState(queueJobAction, undefined);
  const [selected, setSelected] = useState(`${jobs[0]?.agent}:${jobs[0]?.kind}`);
  const [agent, kind] = selected.split(":");
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="agent" value={agent} />
      <input type="hidden" name="kind" value={kind} />
      <div className="min-w-[16rem] flex-1">
        <label htmlFor="queue-job" className="mb-1.5 block text-sm font-semibold text-ink-800">
          Queue a job
        </label>
        <select
          id="queue-job"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className={inputClass}
        >
          {jobs.map((job) => (
            <option key={`${job.agent}:${job.kind}`} value={`${job.agent}:${job.kind}`}>
              {job.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={ghostButtonClass}>
        {pending ? "Queuing…" : "Queue"}
      </button>
      <div className="w-full">
        <Status state={state} />
      </div>
    </form>
  );
}

export function ApprovalCard({
  message,
}: {
  message: {
    id: string;
    subject: string | null;
    bodyText: string;
    toEmail: string | null;
    campaign: string;
    company: string | null;
    intent?: string | null;
    createdAt: string;
  };
}) {
  const [approveState, approve, approving] = useActionState(approveMessageAction, undefined);
  const [rejectState, reject, rejecting] = useActionState(rejectMessageAction, undefined);
  const [body, setBody] = useState(message.bodyText);
  const [subject, setSubject] = useState(message.subject ?? "");

  return (
    <article className="rounded-xl border border-ink-200 bg-white p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="num text-[11px] uppercase tracking-[0.12em] text-ink-400">
            {message.campaign} · {message.createdAt}
          </p>
          <h3 className="mt-1 font-semibold text-ink-900">
            {message.company ?? message.toEmail}
          </h3>
          <p className="num text-xs text-ink-500" dir="ltr">
            {message.toEmail}
          </p>
        </div>
        {message.intent && (
          <span className="stamp text-[9px] text-brand-700">{message.intent}</span>
        )}
      </header>

      <div className="mt-4 space-y-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClass}
          aria-label="Subject"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className={`${inputClass} font-mono text-[13px] leading-relaxed`}
          aria-label="Message body"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink-200/70 pt-4">
        <form action={approve}>
          <input type="hidden" name="messageId" value={message.id} />
          <input type="hidden" name="bodyText" value={body} />
          <input type="hidden" name="subject" value={subject} />
          <button type="submit" disabled={approving || rejecting} className={buttonClass}>
            {approving ? "Sending…" : "Approve & send"}
          </button>
        </form>
        <form action={reject} className="flex items-center gap-3">
          <input type="hidden" name="messageId" value={message.id} />
          <label className="flex items-center gap-1.5 text-xs text-ink-600">
            <input type="checkbox" name="suppress" className="size-3.5 accent-red-600" />
            never contact
          </label>
          <button type="submit" disabled={approving || rejecting} className={cautionButtonClass}>
            {rejecting ? "Rejecting…" : "Reject"}
          </button>
        </form>
        <p className="ms-auto text-[11px] text-ink-400">
          Nothing leaves until you approve it.
        </p>
      </div>
      <Status state={approveState ?? rejectState} />
    </article>
  );
}

export function ArticleReview({
  article,
}: {
  article: { id: string; title: string; slug: string; locale: string; summary: string | null; bodyMd: string; keywords: string[] };
}) {
  const [state, action, pending] = useActionState(publishArticleAction, undefined);
  const [body, setBody] = useState(article.bodyMd);
  const [title, setTitle] = useState(article.title);
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-xl border border-ink-200 bg-white p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink-900">{article.title}</h3>
          <p className="num mt-1 text-xs text-ink-500" dir="ltr">
            /insights/{article.slug} · {article.locale} · {article.keywords.slice(0, 3).join(", ")}
          </p>
          {article.summary && <p className="mt-2 text-sm text-ink-600">{article.summary}</p>}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className={ghostButtonClass}>
          {open ? "Collapse" : "Review"}
        </button>
      </header>

      {open && (
        <div className="mt-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} aria-label="Title" />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={22}
            className={`${inputClass} font-mono text-[13px] leading-relaxed`}
            aria-label="Article body"
          />
          <div className="flex flex-wrap gap-3">
            <form action={action}>
              <input type="hidden" name="articleId" value={article.id} />
              <input type="hidden" name="bodyMd" value={body} />
              <input type="hidden" name="title" value={title} />
              <input type="hidden" name="action" value="publish" />
              <button type="submit" disabled={pending} className={buttonClass}>
                {pending ? "Publishing…" : "Publish"}
              </button>
            </form>
            <form action={action}>
              <input type="hidden" name="articleId" value={article.id} />
              <input type="hidden" name="action" value="archive" />
              <button type="submit" disabled={pending} className={ghostButtonClass}>
                Archive
              </button>
            </form>
          </div>
          <Status state={state} />
        </div>
      )}
    </article>
  );
}

export function TargetStatusForm({
  targetId,
  status,
}: {
  targetId: string;
  status: string;
}) {
  const [, action, pending] = useActionState(updateTargetAction, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="targetId" value={targetId} />
      <select name="status" defaultValue={status} className={`${inputClass} py-1 text-xs`}>
        <option value="discovered">discovered</option>
        <option value="queued">queued</option>
        <option value="drafted">drafted</option>
        <option value="actioned">actioned</option>
        <option value="won">won</option>
        <option value="skipped">skipped</option>
      </select>
      <button type="submit" disabled={pending} className="press text-xs font-semibold text-brand-700 hover:text-brand-900">
        save
      </button>
    </form>
  );
}

export function SuppressForm() {
  const [state, action, pending] = useActionState(suppressEmailAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[16rem] flex-1">
        <label htmlFor="suppress-email" className="mb-1.5 block text-sm font-semibold text-ink-800">
          Never contact this address
        </label>
        <input id="suppress-email" name="email" type="email" required className={inputClass} dir="ltr" />
      </div>
      <button type="submit" disabled={pending} className={ghostButtonClass}>
        {pending ? "Adding…" : "Suppress"}
      </button>
      <div className="w-full">
        <Status state={state} />
      </div>
    </form>
  );
}

export function ModelRoutingForm({
  jobs,
  models,
  globalModel,
}: {
  jobs: readonly { key: string; label: string; where: string; hint: string }[];
  models: Record<string, string>;
  globalModel: string;
}) {
  const [state, action, pending] = useActionState(saveModelRoutingAction, undefined);
  return (
    <form action={action}>
      <Section title="Model routing">
        <p className="-mt-1 text-sm text-ink-600">
          Every AI call belongs to one job. Leave a field empty and it uses the global
          model{" "}
          <code className="num rounded bg-paper-dark px-1.5 py-0.5 text-xs">
            {globalModel || "(not set)"}
          </code>{" "}
          from Settings. Name a model here to route that job somewhere else — worth doing
          where volume is high (scoring) or quality is visible (articles).
        </p>
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.key}
              className="grid gap-3 border-t border-dashed border-ink-200 pt-3 sm:grid-cols-[1fr_20rem]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-800">{job.label}</p>
                <p className="num mt-0.5 text-[11px] uppercase tracking-[0.1em] text-ink-400">
                  {job.where}
                </p>
                <p className="mt-1 text-xs text-ink-500">{job.hint}</p>
              </div>
              <input
                name={`model_${job.key}`}
                defaultValue={models[job.key] ?? ""}
                placeholder={globalModel ? `inherits ${globalModel}` : "inherits global model"}
                dir="ltr"
                aria-label={`${job.label} model`}
                className={`${inputClass} self-start font-mono text-[13px]`}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Saving…" : "Save model routing"}
          </button>
          <Status state={state} />
        </div>
      </Section>
    </form>
  );
}
