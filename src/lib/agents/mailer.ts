import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  outreachMessages,
  outreachThreads,
  prospectContacts,
  prospects,
  suppressions,
} from "@/db/schema";
import { absoluteUrl } from "@/lib/site";
import { getAgentConfig, type AgentConfig } from "./config";
import { sesSend } from "./ses";
import { composeBody, textToHtml } from "./compose";

/**
 * The only path outbound agent email may take.
 *
 * Every send passes three gates in order — suppression list, daily cap
 * (warm-up ramped), approval mode — before SES is touched at all. Bounces and
 * complaints feed straight back into the suppression list, so a bad address
 * can only ever be mailed once.
 */

/** The UAE has no DST, so the Dubai day is simply UTC+4 year-round. */
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

export function dubaiDayStart(at: Date = new Date()): Date {
  const shifted = new Date(at.getTime() + DUBAI_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - DUBAI_OFFSET_MS);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
}

export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const domain = emailDomain(normalized);
  const [row] = await db
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(
      domain
        ? sql`${suppressions.email} = ${normalized} OR (${suppressions.email} = '*' AND ${suppressions.domain} = ${domain})`
        : eq(suppressions.email, normalized),
    )
    .limit(1);
  return !!row;
}

export async function suppress(
  email: string,
  reason: "unsubscribe" | "bounce" | "complaint" | "manual" | "invalid",
  detail?: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  await db
    .insert(suppressions)
    .values({
      email: normalized,
      domain: emailDomain(normalized),
      reason,
      detail: detail?.slice(0, 500),
    })
    .onConflictDoNothing({ target: suppressions.email });

  // Close any live conversation with that address so no follow-up fires.
  await db
    .update(outreachThreads)
    .set({
      status: reason === "unsubscribe" ? "unsubscribed" : "bounced",
      nextActionAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(outreachThreads.toEmail, normalized),
        sql`${outreachThreads.status} IN ('active','awaiting_reply','replied')`,
      ),
    );
}

/**
 * How many emails today's warm-up ramp allows.
 *
 * The ramp advances per day we actually sent on, not per day on the calendar.
 * Reputation is built by delivering mail; elapsed time builds none. Ramping on
 * calendar days would mean a pause silently graduated us — send 20 on Monday,
 * stop for a month, and the ceiling would be waiting on our return, which is
 * the opposite of a warm-up. Counting sending days makes an interruption cost
 * nothing and resume exactly where it left off.
 */
export function rampedCap(config: AgentConfig, sendingDays: number): number {
  const ramped = Math.round(
    config.outreachWarmupStartCap * Math.pow(config.outreachWarmupGrowth, Math.max(0, sendingDays)),
  );
  if (config.outreachDailyCap <= 0) return 0;
  return Math.max(1, Math.min(ramped, config.outreachDailyCap));
}

export async function dailySendCap(config: AgentConfig): Promise<number> {
  // Distinct Dubai dates we have sent on, excluding today — today is the day
  // being budgeted, so it must not advance its own allowance.
  const [row] = await db
    .select({
      days: sql<string>`count(DISTINCT ((${outreachMessages.sentAt} AT TIME ZONE 'Asia/Dubai')::date))`,
    })
    .from(outreachMessages)
    .where(and(isNotNull(outreachMessages.sentAt), lt(outreachMessages.sentAt, dubaiDayStart())));
  return rampedCap(config, Number(row?.days ?? 0));
}

/**
 * Everything that has consumed today's budget: delivered messages plus any
 * currently mid-flight. Counting only "sent" would let concurrent workers each
 * see the same remaining budget and all send.
 */
export async function sentToday(): Promise<number> {
  const dayStart = dubaiDayStart();
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.direction, "outbound"),
        sql`(
          (${outreachMessages.status} = 'sent' AND ${outreachMessages.sentAt} >= ${dayStart})
          OR (${outreachMessages.status} = 'sending' AND ${outreachMessages.claimedAt} >= ${dayStart})
        )`,
      ),
    );
  return Number(row?.count ?? 0);
}

export async function remainingSendsToday(config?: AgentConfig): Promise<number> {
  const cfg = config ?? (await getAgentConfig());
  const [cap, used] = await Promise.all([dailySendCap(cfg), sentToday()]);
  return Math.max(0, cap - used);
}

/**
 * Amazon reviews a sending account above a 5% bounce rate and suspends above
 * 10%. A suspension is not confined to cold outreach — every transactional
 * message leaves through the same identity, so the first thing you lose is the
 * alert telling you a lead arrived.
 *
 * Below this many sends the rate is too noisy to act on: two bounces out of
 * twenty is 10% and means nothing.
 */
export const BOUNCE_HALT_RATE = 0.04;
const BOUNCE_MIN_SAMPLE = 50;

export interface BounceHealth {
  sent: number;
  bounced: number;
  rate: number;
  halted: boolean;
}

/**
 * Rolling bounce rate over recent sends.
 *
 * Deliberately a ratio over the last N messages rather than a lifetime figure:
 * a list that has gone bad needs to stop sending now, and a good history should
 * not be allowed to mask it.
 */
export async function bounceHealth(sample = 200): Promise<BounceHealth> {
  const rows = await db
    .select({ status: outreachMessages.status })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.direction, "outbound"),
        sql`${outreachMessages.status} IN ('sent','failed')`,
        isNotNull(outreachMessages.sentAt),
      ),
    )
    .orderBy(sql`${outreachMessages.sentAt} DESC`)
    .limit(sample);

  const sent = rows.length;
  // A hard bounce closes the thread; the message row is marked failed.
  const bounced = rows.filter((r) => r.status === "failed").length;
  const rate = sent ? bounced / sent : 0;
  return {
    sent,
    bounced,
    rate,
    halted: sent >= BOUNCE_MIN_SAMPLE && rate > BOUNCE_HALT_RATE,
  };
}

export function unsubscribeUrl(token: string): string {
  return absoluteUrl(`/api/outreach/unsubscribe?t=${token}`);
}

export function messageIdFor(domain: string): string {
  return `${crypto.randomUUID()}@${domain}`;
}

export interface SendOutcome {
  sent: boolean;
  reason?: string;
}

/**
 * Send one queued outreach message. Idempotent: a message not in a sendable
 * state is skipped, and the row is only marked sent after SES accepts it.
 */
export async function sendOutreachMessage(messageRowId: string): Promise<SendOutcome> {
  const config = await getAgentConfig();
  const [row] = await db
    .select({ message: outreachMessages, thread: outreachThreads })
    .from(outreachMessages)
    .innerJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
    .where(eq(outreachMessages.id, messageRowId))
    .limit(1);
  if (!row) return { sent: false, reason: "message not found" };

  const { message, thread } = row;
  if (message.direction !== "outbound") return { sent: false, reason: "not outbound" };
  if (!["scheduled", "draft", "pending_approval"].includes(message.status)) {
    return { sent: false, reason: `status ${message.status}` };
  }
  if (message.status === "pending_approval" && !message.approvedAt) {
    return { sent: false, reason: "awaiting approval" };
  }

  const to = normalizeEmail(message.toEmail ?? thread.toEmail);
  if (await isSuppressed(to)) {
    await db
      .update(outreachMessages)
      .set({ status: "rejected", error: "recipient suppressed" })
      .where(eq(outreachMessages.id, message.id));
    await db
      .update(outreachThreads)
      .set({ status: "unsubscribed", nextActionAt: null })
      .where(eq(outreachThreads.id, thread.id));
    return { sent: false, reason: "suppressed" };
  }

  if ((await remainingSendsToday(config)) <= 0) {
    return { sent: false, reason: "daily cap reached" };
  }

  // Refuse to make a reputation problem worse. This is checked per message
  // rather than per batch because the whole point is to stop mid-run.
  const health = await bounceHealth();
  if (health.halted) {
    return {
      sent: false,
      reason: `bounce rate ${(health.rate * 100).toFixed(1)}% over the last ${health.sent} sends — sending halted to protect the domain`,
    };
  }

  // Claim the row before touching SES. This single conditional update is what
  // stops an approval, a queued task and a flush from all transmitting the same
  // message: exactly one of them can move it out of a sendable state.
  const claimed = await db
    .update(outreachMessages)
    .set({ status: "sending", claimedAt: new Date() })
    .where(
      and(
        eq(outreachMessages.id, message.id),
        sql`${outreachMessages.status} IN ('scheduled','draft','pending_approval')`,
      ),
    )
    .returning({ id: outreachMessages.id });
  if (!claimed.length) {
    return { sent: false, reason: "already claimed by another worker" };
  }

  const senderDomain = emailDomain(config.sesFromEmail) ?? "uaeasp.ae";
  const messageId = message.messageId ?? messageIdFor(senderDomain);

  // Thread replies to the last message we exchanged.
  const [previous] = await db
    .select({ messageId: outreachMessages.messageId })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.threadId, thread.id),
        isNotNull(outreachMessages.messageId),
        sql`${outreachMessages.id} <> ${message.id}`,
      ),
    )
    .orderBy(sql`${outreachMessages.createdAt} DESC`)
    .limit(1);

  // Rebuild the wrapper from the writer's own words against the rules in force
  // right now. A draft can sit in the approval queue for days, and what we send
  // must reflect today's call to action, opt-out and tracking rather than
  // whatever was current when it was written. Only the wrapper is rebuilt — the
  // argument the approver read is untouched.
  // A message with a stored raw body is rebuilt from the parts. One without —
  // drafted before the split — still gets its HTML re-rendered from its own
  // text, so the recipient sees a labelled link and a one-word opt-out instead
  // of raw URLs. The wording is untouched; only the rendering improves.
  const composed = message.bodyRaw
    ? composeBody(message.bodyRaw, config, thread.token, message.trackToken)
    : {
        text: message.bodyText,
        html: textToHtml(message.bodyText, message.trackToken),
      };
  if (composed.text !== message.bodyText || composed.html !== message.bodyHtml) {
    await db
      .update(outreachMessages)
      .set({ bodyText: composed.text, bodyHtml: composed.html })
      .where(eq(outreachMessages.id, message.id));
  }

  const result = await sesSend({
    to,
    subject: message.subject ?? thread.subject ?? "Following up",
    text: composed.text,
    html: composed.html ?? undefined,
    messageId,
    inReplyTo: message.inReplyTo ?? previous?.messageId ?? null,
    references: message.inReplyTo ?? previous?.messageId
      ? `<${message.inReplyTo ?? previous?.messageId}>`
      : null,
    unsubscribeUrl: unsubscribeUrl(thread.token),
  });

  if (!result.ok) {
    // A permanent rejection is safe to mark failed. Anything else (timeout,
    // socket error) may have been accepted by SES after we stopped listening,
    // so the row stays failed rather than re-queued — re-sending a message that
    // was in fact delivered is worse than making a human retry it.
    await db
      .update(outreachMessages)
      .set({
        status: "failed",
        error: `${result.permanent ? "" : "ambiguous: "}${result.error ?? ""}`.slice(0, 1000),
      })
      .where(eq(outreachMessages.id, message.id));
    if (result.permanent) {
      await db
        .update(outreachThreads)
        .set({ status: "closed", nextActionAt: null })
        .where(eq(outreachThreads.id, thread.id));
    }
    return { sent: false, reason: result.error };
  }

  const now = new Date();
  await db
    .update(outreachMessages)
    .set({
      status: "sent",
      sentAt: now,
      messageId,
      providerMessageId: result.providerMessageId,
      fromEmail: config.sesFromEmail,
      toEmail: to,
      error: null,
    })
    .where(eq(outreachMessages.id, message.id));

  await db
    .update(outreachThreads)
    .set({
      status: "awaiting_reply",
      lastOutboundAt: now,
      stepIndex: message.stepIndex ?? thread.stepIndex,
      subject: thread.subject ?? message.subject,
      updatedAt: now,
    })
    .where(eq(outreachThreads.id, thread.id));

  if (thread.prospectId) {
    await db
      .update(prospects)
      .set({ status: "sequenced", updatedAt: now })
      .where(and(eq(prospects.id, thread.prospectId), sql`status <> 'converted'`));
  }
  if (thread.contactId) {
    await db
      .update(prospectContacts)
      .set({ verification: "mx_ok" })
      .where(
        and(
          eq(prospectContacts.id, thread.contactId),
          eq(prospectContacts.verification, "unknown"),
        ),
      );
  }

  return { sent: true };
}
