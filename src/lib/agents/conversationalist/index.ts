import { and, asc, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  leadActivities,
  leads,
  outreachMessages,
  outreachThreads,
  prospectContacts,
  prospects,
  type OutreachThread,
  type Prospect,
} from "@/db/schema";
import { chat, extractJson } from "@/lib/ai/chat";
import { getSalesNotifyEmails, sendEmail } from "@/lib/email";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { appointmentDeadlineFor, mandateTimelineLines } from "@/content/mandate";
import { getAgentConfig, type AgentConfig } from "../config";
import {
  isSuppressed,
  remainingSendsToday,
  sendOutreachMessage,
  unsubscribeUrl,
} from "../mailer";
import { enqueue } from "../queue";
import type { AgentHandler } from "../types";

/**
 * Agent 3 — Conversationalist.
 *
 * Owns the mailbox: opens a thread per qualified prospect, writes a short
 * personalised first touch, follows up on a schedule, reads replies, and either
 * answers them or converts the person into a CRM lead and steps aside.
 *
 * It never invents facts about the mandate — the deadlines and provider count
 * are injected from our own data, and the prompt forbids anything else.
 */

const MANDATE_FACTS = `Verified facts you may state (never state anything else as fact):
- The UAE Ministry of Finance maintains a list of Accredited Service Providers (ASPs) for e-invoicing.
${mandateTimelineLines()
  .map((line) => `- ${line}`)
  .join("\n")}
- Never claim a deadline has already passed unless the date above says so.
- E-invoices must be issued through an accredited service provider using the PINT AE format and the Peppol 5-corner model.
- Our directory at uaeasp.ae lists every accredited provider and is free to use.
- We are an independent directory. We are not the Ministry of Finance, the FTA, or a provider ourselves.`;

function senderBlock(config: AgentConfig): string {
  return [
    config.senderName,
    config.senderTitle,
    config.companyLegalName || SITE_NAME,
    absoluteUrl("/"),
    config.companyAddress,
  ]
    .filter(Boolean)
    .join("\n");
}

function systemPrompt(config: AgentConfig, step: number): string {
  return `You write short B2B emails for ${config.companyLegalName || SITE_NAME}, an independent directory of UAE Ministry of Finance accredited e-invoicing service providers.

What we offer (do not exaggerate it): ${config.offerHeadline}
${config.offerBody}
Desired next step: ${config.offerCta}

${MANDATE_FACTS}

Writing rules:
- Plain text. No HTML, no markdown, no bullet symbols beyond "-".
- 90 words maximum for a first touch, 60 for a follow-up. Shorter is better.
- One clear ask. No stacked questions.
- Address a real business problem: they will need an accredited provider before their deadline and choosing one is confusing.
- British English. Professional, direct, no hype, no "I hope this email finds you well", no "revolutionary", no emojis, no exclamation marks.
- Never claim we are government, never imply enforcement, never invent a deadline specific to them beyond the two published waves.
- Never invent facts about the recipient's company. Use only what is given.
- Do not add a signature or sign-off block — one is appended automatically.
${step > 0 ? "- This is a follow-up to an unanswered email. Do not repeat the original pitch verbatim; add one new, useful angle and make it easy to say no." : ""}

Respond with ONLY JSON: {"subject": "...", "body": "..."}`;
}

interface Draft {
  subject: string;
  body: string;
}

function fallbackDraft(prospect: Prospect, config: AgentConfig, step: number): Draft {
  const name = prospect.name;
  // The appointment deadline, not the go-live date: it lands months earlier and
  // is the one thing the recipient still has to act on.
  const deadline = appointmentDeadlineFor(prospect.mandateWave);
  if (step === 0) {
    return {
      subject: `E-invoicing provider shortlist for ${name}`,
      body: `Hello,\n\nUnder the UAE e-invoicing mandate, businesses like ${name} need an accredited service provider appointed by ${deadline}, and invoices then have to be issued through that provider.\n\nWe maintain the full directory of accredited providers and put together free shortlists. ${config.offerCta}, and we will send back the three that fit ${name} best.\n\nIf this is not your area, please point me to whoever handles finance systems.`,
    };
  }
  return {
    subject: `Re: E-invoicing provider shortlist for ${name}`,
    body: `Hello,\n\nFollowing up briefly. The full list of accredited providers is free to browse at ${absoluteUrl("/providers")} — no signup needed.\n\nIf ${name} already has a provider lined up, tell me and I will close this off.`,
  };
}

function appendSignature(body: string, config: AgentConfig, threadToken: string): string {
  const signature = senderBlock(config);
  const optOut = `If you would rather not hear from us, unsubscribe here: ${unsubscribeUrl(threadToken)}`;
  return `${body.trim()}\n\n${signature ? `${signature}\n\n` : ""}${optOut}`;
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color:#0f766e">$1</a>',
    );
  return `<div style="font:15px/1.6 -apple-system,Segoe UI,sans-serif;color:#0f172a;white-space:pre-wrap">${escaped}</div>`;
}

/** Open a thread and draft the first touch for one qualified prospect. */
export const startSequence: AgentHandler = async (task, ctx) => {
  const { prospectId } = task.payload as { prospectId: string };
  const config = await getAgentConfig();

  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!prospect) return { itemsIn: 0, itemsOut: 0, summary: { reason: "prospect gone" } };

  const [existing] = await db
    .select({ id: outreachThreads.id })
    .from(outreachThreads)
    .where(eq(outreachThreads.prospectId, prospectId))
    .limit(1);
  if (existing) return { itemsIn: 1, itemsOut: 0, summary: { reason: "already sequenced" } };

  const [contact] = await db
    .select()
    .from(prospectContacts)
    .where(eq(prospectContacts.prospectId, prospectId))
    .orderBy(asc(prospectContacts.priority))
    .limit(1);
  if (!contact) return { itemsIn: 1, itemsOut: 0, summary: { reason: "no contact" } };
  if (await isSuppressed(contact.email)) {
    await db
      .update(prospects)
      .set({ status: "suppressed", updatedAt: new Date() })
      .where(eq(prospects.id, prospectId));
    return { itemsIn: 1, itemsOut: 0, summary: { reason: "suppressed" } };
  }

  const [thread] = await db
    .insert(outreachThreads)
    .values({
      prospectId,
      contactId: contact.id,
      campaign: "prospect-outreach",
      toEmail: contact.email,
      status: "active",
      stepIndex: 0,
    })
    .returning();

  const draft = await writeDraft(prospect, config, 0, ctx);
  await queueOutbound(thread, draft, 0, config);

  ctx.log(`sequence opened for ${prospect.name} → ${contact.email}`);
  return { itemsIn: 1, itemsOut: 1, summary: { threadId: thread.id, to: contact.email } };
};

async function writeDraft(
  prospect: Prospect,
  config: AgentConfig,
  step: number,
  ctx: { addTokens: (n: number, model?: string) => void },
): Promise<Draft> {
  const result = await chat(
    [
      { role: "system", content: systemPrompt(config, step) },
      {
        role: "user",
        content: [
          `Company: ${prospect.name}`,
          `Website: ${prospect.website ?? "unknown"}`,
          `Emirate: ${prospect.emirate ?? "UAE"}`,
          `Sector (from search): ${prospect.sector ?? "unknown"}`,
          `Estimated size: ${prospect.sizeHint ?? "unknown"}`,
          `Likely mandate wave: ${prospect.mandateWave ?? "unknown"}`,
          step > 0 ? `This is follow-up number ${step}.` : "This is the first contact.",
        ].join("\n"),
      },
    ],
    { temperature: 0.4, maxTokens: 700, job: "email" },
  );
  if (result) {
    ctx.addTokens(result.totalTokens, result.model);
    const parsed = extractJson<Draft>(result.text);
    if (parsed?.subject && parsed?.body) {
      return { subject: parsed.subject.slice(0, 180), body: parsed.body.slice(0, 4000) };
    }
  }
  return fallbackDraft(prospect, config, step);
}

async function queueOutbound(
  thread: OutreachThread,
  draft: Draft,
  step: number,
  config: AgentConfig,
): Promise<string> {
  // Approval mode decides whether this can send unattended.
  const autoSend =
    config.outreachApprovalMode === "auto" ||
    (config.outreachApprovalMode === "first_touch" && thread.agent === "conversationalist");
  const bodyText = appendSignature(draft.body, config, thread.token);

  const [row] = await db
    .insert(outreachMessages)
    .values({
      threadId: thread.id,
      direction: "outbound",
      status: autoSend ? "scheduled" : "pending_approval",
      stepIndex: step,
      subject: draft.subject,
      bodyText,
      bodyHtml: textToHtml(bodyText),
      toEmail: thread.toEmail,
      scheduledFor: new Date(),
    })
    .returning({ id: outreachMessages.id });

  await db
    .update(outreachThreads)
    .set({ subject: thread.subject ?? draft.subject, stepIndex: step, updatedAt: new Date() })
    .where(eq(outreachThreads.id, thread.id));

  if (autoSend) {
    await enqueue({
      agent: "conversationalist",
      kind: "send_message",
      payload: { messageId: row.id },
      dedupeKey: `send:${row.id}`,
      priority: 50,
    });
  }
  return row.id;
}

/** Send one approved/scheduled message, respecting caps and suppression. */
export const sendMessage: AgentHandler = async (task, ctx) => {
  const { messageId } = task.payload as { messageId: string };
  const outcome = await sendOutreachMessage(messageId);
  if (!outcome.sent && outcome.reason === "daily cap reached") {
    // Not a failure — try again after the cap resets.
    await enqueue({
      agent: "conversationalist",
      kind: "send_message",
      payload: { messageId },
      runAfter: new Date(Date.now() + 6 * 60 * 60 * 1000),
      dedupeKey: `send:${messageId}:capretry`,
      priority: 40,
    });
  }
  ctx.log(outcome.sent ? `sent ${messageId}` : `held ${messageId}: ${outcome.reason}`);
  return {
    itemsIn: 1,
    itemsOut: outcome.sent ? 1 : 0,
    summary: { sent: outcome.sent, reason: outcome.reason },
  };
};

const CLASSIFY_SYSTEM = `You classify replies to a B2B email offering a free shortlist of UAE accredited e-invoicing providers.

Classify the reply into exactly one intent:
- interested: they want the shortlist, ask about providers/pricing, or share requirements.
- question: they ask something about the mandate or about us, without committing.
- referral: they point to a different person or department.
- not_now: interested later, currently busy, or already evaluating.
- not_interested: a clear no, or they already have a provider.
- unsubscribe: they ask to stop being contacted, in any wording ("stop", "remove me", "لا ترسل").
- auto_reply: out-of-office, delivery notification, or other machine-generated mail.
- hostile: complaint, legal threat, or accusation of spam.

Also extract, when present: contact_name, company_name, phone, invoice_volume, accounting_software.

Respond with ONLY JSON: {"intent": "...", "confidence": 0-1, "contact_name": null, "company_name": null, "phone": null, "invoice_volume": null, "accounting_software": null, "summary": "one short sentence"}`;

interface Classification {
  intent: string;
  confidence: number;
  contact_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  invoice_volume?: string | null;
  accounting_software?: string | null;
  summary?: string;
}

/** Read an inbound reply, then answer it, convert it, or stand down. */
export const handleReply: AgentHandler = async (task, ctx) => {
  const { threadId, messageId } = task.payload as { threadId: string; messageId: string };
  const config = await getAgentConfig();

  const [row] = await db
    .select({ message: outreachMessages, thread: outreachThreads })
    .from(outreachMessages)
    .innerJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
    .where(eq(outreachMessages.id, messageId))
    .limit(1);
  if (!row) return { itemsIn: 0, itemsOut: 0, summary: { reason: "message gone" } };
  const { message, thread } = row;

  const prospect = thread.prospectId
    ? (
        await db.select().from(prospects).where(eq(prospects.id, thread.prospectId)).limit(1)
      )[0]
    : null;

  let classification: Classification | null = null;
  const result = await chat(
    [
      { role: "system", content: CLASSIFY_SYSTEM },
      {
        role: "user",
        content: `From: ${message.fromEmail}\nCompany (known): ${prospect?.name ?? "unknown"}\nSubject: ${message.subject ?? ""}\n\n${message.bodyText.slice(0, 4000)}`,
      },
    ],
    { temperature: 0, maxTokens: 500, job: "classify" },
  );
  if (result) {
    ctx.addTokens(result.totalTokens, result.model);
    classification = extractJson<Classification>(result.text);
  }

  const intent = classification?.intent ?? keywordIntent(message.bodyText);

  await db
    .update(outreachMessages)
    .set({ aiMeta: { classification, intent } })
    .where(eq(outreachMessages.id, message.id));

  if (intent === "unsubscribe" || intent === "hostile") {
    const { suppress } = await import("../mailer");
    // Suppress BOTH the address that replied and the address the sequence
    // targets. Someone behind a shared mailbox replies from their own account,
    // so suppressing only the sender leaves the mailbox that said stop fully
    // mailable — and suppress() closes live threads by toEmail, so passing it
    // is also what stops any queued follow-up.
    for (const address of new Set(
      [message.fromEmail, thread.toEmail].filter(Boolean) as string[],
    )) {
      await suppress(address, "unsubscribe", `reply: ${intent}`);
    }
    await notifySales(
      `Opt-out from ${prospect?.name ?? thread.toEmail}`,
      `${thread.toEmail} asked to stop being contacted (${intent}). They are now permanently suppressed.\n\n---\n${message.bodyText.slice(0, 1000)}`,
    );
    ctx.log(`opt-out: ${thread.toEmail}`);
    return { itemsIn: 1, itemsOut: 0, summary: { intent } };
  }

  if (intent === "auto_reply") {
    // Put the thread back to waiting; an OOO is not a reply.
    await db
      .update(outreachThreads)
      .set({
        status: "awaiting_reply",
        nextActionAt: new Date(Date.now() + 3 * 86_400_000),
        updatedAt: new Date(),
      })
      .where(eq(outreachThreads.id, thread.id));
    return { itemsIn: 1, itemsOut: 0, summary: { intent } };
  }

  if (intent === "not_interested") {
    await db
      .update(outreachThreads)
      .set({ status: "closed", nextActionAt: null, updatedAt: new Date() })
      .where(eq(outreachThreads.id, thread.id));
    if (thread.prospectId) {
      await db
        .update(prospects)
        .set({ status: "rejected", scoreReason: "declined by reply", updatedAt: new Date() })
        .where(eq(prospects.id, thread.prospectId));
    }
    return { itemsIn: 1, itemsOut: 0, summary: { intent } };
  }

  // Interested → create a real CRM lead so sales owns it from here.
  if (intent === "interested" && !thread.leadId) {
    const leadId = await convertToLead(thread, prospect, classification, message.fromEmail);
    if (leadId) {
      await db
        .update(outreachThreads)
        .set({ status: "converted", leadId, nextActionAt: null, updatedAt: new Date() })
        .where(eq(outreachThreads.id, thread.id));
      if (thread.prospectId) {
        await db
          .update(prospects)
          .set({ status: "converted", leadId, updatedAt: new Date() })
          .where(eq(prospects.id, thread.prospectId));
      }
      await notifySales(
        `Agent lead: ${classification?.company_name ?? prospect?.name ?? thread.toEmail}`,
        `The outreach agent converted a reply into a lead.\n\nIntent: ${intent}\nSummary: ${classification?.summary ?? "—"}\n\nReply:\n${message.bodyText.slice(0, 1500)}\n\nOpen in CRM: ${absoluteUrl(`/admin/leads/${leadId}`)}`,
      );
    }
  }

  // Draft a human-sounding answer for approval (or auto-send in "auto" mode).
  const draft = await writeReply(thread, prospect, message.bodyText, intent, config, ctx);
  const bodyText = appendSignature(draft.body, config, thread.token);
  const autoSend = config.outreachApprovalMode === "auto";

  const [drafted] = await db
    .insert(outreachMessages)
    .values({
      threadId: thread.id,
      direction: "outbound",
      status: autoSend ? "scheduled" : "pending_approval",
      subject: draft.subject || `Re: ${thread.subject ?? "your enquiry"}`,
      bodyText,
      bodyHtml: textToHtml(bodyText),
      toEmail: thread.toEmail,
      inReplyTo: message.messageId,
      scheduledFor: new Date(),
      aiMeta: { intent, replyTo: message.id },
    })
    .returning({ id: outreachMessages.id });

  if (autoSend) {
    await enqueue({
      agent: "conversationalist",
      kind: "send_message",
      payload: { messageId: drafted.id },
      dedupeKey: `send:${drafted.id}`,
      priority: 20,
    });
  }

  ctx.log(`reply from ${thread.toEmail} classified ${intent}, response drafted`);
  return { itemsIn: 1, itemsOut: 1, summary: { intent, autoSend } };
};

/**
 * Fallback used when the AI classifier is unavailable. It errs heavily towards
 * catching opt-outs: a missed "stop" is a compliance failure, while a
 * misclassified question merely waits for a human.
 */
export function keywordIntent(body: string): string {
  const lower = body.toLowerCase();
  if (
    /\b(unsubscribe|un-subscribe|stop|remove me|remove us|take me off|take us off|opt out|opt-out|do not contact|don't contact|no longer wish|not interested)\b/.test(
      lower,
    ) ||
    /(إلغاء الاشتراك|توقف عن|لا ترسل|أزلني|إزالة)/.test(lower)
  ) {
    return "unsubscribe";
  }
  if (
    /out of (the )?office|automatic reply|auto-reply|autoreply|on annual leave|currently away|delivery status notification|undeliverable/.test(
      lower,
    )
  ) {
    return "auto_reply";
  }
  return "question";
}

async function writeReply(
  thread: OutreachThread,
  prospect: Prospect | null,
  replyText: string,
  intent: string,
  config: AgentConfig,
  ctx: { addTokens: (n: number, model?: string) => void },
): Promise<Draft> {
  const history = await db
    .select({
      direction: outreachMessages.direction,
      body: outreachMessages.bodyText,
      createdAt: outreachMessages.createdAt,
    })
    .from(outreachMessages)
    .where(eq(outreachMessages.threadId, thread.id))
    .orderBy(asc(outreachMessages.createdAt))
    .limit(10);

  const transcript = history
    .map((h) => `${h.direction === "outbound" ? "US" : "THEM"}: ${h.body.slice(0, 800)}`)
    .join("\n\n");

  const result = await chat(
    [
      {
        role: "system",
        content: `${systemPrompt(config, 1)}

You are now replying inside an existing conversation. The classified intent of their last message is "${intent}".
- interested: confirm the next step and ask only for invoice volume and accounting software if not already given. Mention a colleague will follow up.
- question: answer only from the verified facts. If you do not know, say so and offer to check.
- referral: thank them, ask for the right person's name and email.
- not_now: agree a specific later date, keep it to two sentences.
Keep it under 80 words.`,
      },
      {
        role: "user",
        content: `Company: ${prospect?.name ?? "unknown"}\n\nConversation so far:\n${transcript}\n\nTheir latest message:\n${replyText.slice(0, 2000)}`,
      },
    ],
    { temperature: 0.4, maxTokens: 600, job: "email" },
  );
  if (result) {
    ctx.addTokens(result.totalTokens, result.model);
    const parsed = extractJson<Draft>(result.text);
    if (parsed?.body) {
      return {
        subject: parsed.subject || `Re: ${thread.subject ?? "your enquiry"}`,
        body: parsed.body,
      };
    }
  }
  return {
    subject: `Re: ${thread.subject ?? "your enquiry"}`,
    body: `Thank you for coming back to me.\n\nSo I can send the right shortlist, could you tell me roughly how many invoices you issue a month and which accounting system you use?\n\nThe full accredited provider list is always free at ${absoluteUrl("/providers")}.`,
  };
}

async function convertToLead(
  thread: OutreachThread,
  prospect: Prospect | null,
  classification: Classification | null,
  fromEmail: string | null,
): Promise<string | null> {
  const email = (fromEmail ?? thread.toEmail).toLowerCase();
  const [lead] = await db
    .insert(leads)
    .values({
      fullName: classification?.contact_name?.slice(0, 120) || "(from email reply)",
      companyName:
        classification?.company_name?.slice(0, 160) || prospect?.name || email.split("@")[1],
      email,
      // Phone is required on leads; outreach replies rarely include one.
      phone: classification?.phone?.slice(0, 40) || "",
      emirate: prospect?.emirate ?? null,
      invoiceVolume: classification?.invoice_volume?.slice(0, 60) ?? null,
      accountingSoftware: classification?.accounting_software?.slice(0, 120) ?? null,
      message: classification?.summary?.slice(0, 500) ?? null,
      source: "agent-outreach",
      locale: "en",
      consentAt: new Date(),
    })
    .returning({ id: leads.id });
  if (!lead) return null;

  await db.insert(leadActivities).values({
    leadId: lead.id,
    type: "created",
    body: `Created by the outreach agent from an email reply (${email}).`,
    meta: { threadId: thread.id, prospectId: thread.prospectId },
  });
  return lead.id;
}

async function notifySales(subject: string, body: string): Promise<void> {
  const to = await getSalesNotifyEmails();
  if (!to.length) return;
  await sendEmail({
    to,
    subject: `[Agent] ${subject}`,
    text: body,
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
  });
}

/** Follow up on threads that went quiet, then close them out politely. */
export const tick: AgentHandler = async (_task, ctx) => {
  const config = await getAgentConfig();
  const budget = await remainingSendsToday(config);
  if (budget <= 0) return { itemsIn: 0, itemsOut: 0, summary: { reason: "daily cap reached" } };

  const staleAfter = new Date(Date.now() - config.outreachStepDelayDays * 86_400_000);
  const due = await db
    .select({ thread: outreachThreads, prospect: prospects })
    .from(outreachThreads)
    .leftJoin(prospects, eq(outreachThreads.prospectId, prospects.id))
    .where(
      and(
        eq(outreachThreads.status, "awaiting_reply"),
        // Only this agent's own sequences — link-outreach threads belong to
        // Visibility and must never receive a prospecting follow-up.
        eq(outreachThreads.agent, "conversationalist"),
        isNotNull(outreachThreads.lastOutboundAt),
        lte(outreachThreads.lastOutboundAt, staleAfter),
        sql`${outreachThreads.stepIndex} < ${config.outreachMaxFollowUps}`,
      ),
    )
    .orderBy(asc(outreachThreads.lastOutboundAt))
    .limit(Math.min(budget, 25));

  let queued = 0;
  for (const { thread, prospect } of due) {
    if (await isSuppressed(thread.toEmail)) continue;
    const step = thread.stepIndex + 1;
    const draft = prospect
      ? await writeDraft(prospect, config, step, ctx)
      : {
          subject: `Re: ${thread.subject ?? "e-invoicing providers"}`,
          body: `Just following up in case this slipped through. The accredited provider directory is free at ${absoluteUrl("/providers")} — happy to send a shortlist if useful.`,
        };
    await queueOutbound(thread, draft, step, config);
    queued += 1;
  }

  // Threads that used up their follow-ups stop bothering people.
  const closed = await db
    .update(outreachThreads)
    .set({ status: "closed", nextActionAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(outreachThreads.status, "awaiting_reply"),
        lte(outreachThreads.lastOutboundAt, staleAfter),
        sql`${outreachThreads.stepIndex} >= ${config.outreachMaxFollowUps}`,
      ),
    )
    .returning({ id: outreachThreads.id });

  ctx.log(`follow-ups queued: ${queued}, threads closed: ${closed.length}`);
  return { itemsIn: due.length, itemsOut: queued, summary: { queued, closed: closed.length } };
};

/** Drain messages a human approved in the console. */
export const flushApproved: AgentHandler = async (_task, ctx) => {
  const rows = await db
    .select({ id: outreachMessages.id })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.direction, "outbound"),
        isNotNull(outreachMessages.approvedAt),
        sql`${outreachMessages.status} IN ('pending_approval','scheduled')`,
      ),
    )
    .orderBy(desc(outreachMessages.approvedAt))
    .limit(50);

  let sent = 0;
  for (const row of rows) {
    const outcome = await sendOutreachMessage(row.id);
    if (outcome.sent) sent += 1;
    else if (outcome.reason === "daily cap reached") break;
  }
  ctx.log(`flushed ${sent}/${rows.length} approved messages`);
  return { itemsIn: rows.length, itemsOut: sent, summary: { sent } };
};

export const conversationalistHandlers: Record<string, AgentHandler> = {
  start_sequence: startSequence,
  send_message: sendMessage,
  handle_reply: handleReply,
  tick,
  flush_approved: flushApproved,
};
