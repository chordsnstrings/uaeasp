import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
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

/** How many emails today's warm-up ramp allows. */
export async function dailySendCap(config: AgentConfig): Promise<number> {
  const [row] = await db
    .select({ first: sql<Date | null>`min(${outreachMessages.sentAt})` })
    .from(outreachMessages)
    .where(isNotNull(outreachMessages.sentAt));
  const first = row?.first ? new Date(row.first) : null;
  if (!first) return Math.min(config.outreachWarmupStartCap, config.outreachDailyCap);
  const days = Math.max(
    0,
    Math.floor((dubaiDayStart().getTime() - dubaiDayStart(first).getTime()) / 86_400_000),
  );
  const ramped = Math.round(
    config.outreachWarmupStartCap * Math.pow(config.outreachWarmupGrowth, days),
  );
  return Math.max(1, Math.min(ramped, config.outreachDailyCap));
}

export async function sentToday(): Promise<number> {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.direction, "outbound"),
        eq(outreachMessages.status, "sent"),
        gte(outreachMessages.sentAt, dubaiDayStart()),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function remainingSendsToday(config?: AgentConfig): Promise<number> {
  const cfg = config ?? (await getAgentConfig());
  const [cap, used] = await Promise.all([dailySendCap(cfg), sentToday()]);
  return Math.max(0, cap - used);
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

  const result = await sesSend({
    to,
    subject: message.subject ?? thread.subject ?? "Following up",
    text: message.bodyText,
    html: message.bodyHtml ?? undefined,
    messageId,
    inReplyTo: message.inReplyTo ?? previous?.messageId ?? null,
    references: message.inReplyTo ?? previous?.messageId
      ? `<${message.inReplyTo ?? previous?.messageId}>`
      : null,
    unsubscribeUrl: unsubscribeUrl(thread.token),
  });

  if (!result.ok) {
    await db
      .update(outreachMessages)
      .set({
        status: result.permanent ? "failed" : "scheduled",
        error: result.error?.slice(0, 1000),
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
