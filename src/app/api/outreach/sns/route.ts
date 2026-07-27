import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { outreachMessages, outreachThreads } from "@/db/schema";
import { verifySnsMessage, type SesNotification, type SnsEnvelope } from "@/lib/agents/sns";
import { parseEmail, stripQuotedReply } from "@/lib/agents/mime";
import { normalizeEmail, suppress } from "@/lib/agents/mailer";
import { enqueue } from "@/lib/agents/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single SNS endpoint for everything Amazon tells us about our mail:
 * inbound replies (SES receipt rule → SNS), plus bounce, complaint and
 * delivery events (SES configuration set → SNS).
 *
 * Every message is signature-verified before it can change any state.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let envelope: SnsEnvelope;
  try {
    envelope = JSON.parse(raw) as SnsEnvelope;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!(await verifySnsMessage(envelope))) {
    console.warn("[sns] rejected message with invalid signature");
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // Auto-confirm the subscription so wiring SNS up needs no console clicking.
  if (envelope.Type === "SubscriptionConfirmation" && envelope.SubscribeURL) {
    await fetch(envelope.SubscribeURL, { signal: AbortSignal.timeout(10_000) }).catch(
      (err) => console.error("[sns] subscription confirm failed:", err),
    );
    return NextResponse.json({ ok: true, confirmed: true });
  }

  if (envelope.Type !== "Notification") return NextResponse.json({ ok: true });

  let payload: SesNotification;
  try {
    payload = JSON.parse(envelope.Message) as SesNotification;
  } catch {
    return NextResponse.json({ ok: true, ignored: "unparseable message" });
  }

  const kind = payload.notificationType ?? payload.eventType ?? "";

  if (kind === "Bounce") {
    const permanent = payload.bounce?.bounceType === "Permanent";
    for (const recipient of payload.bounce?.bouncedRecipients ?? []) {
      if (permanent) {
        await suppress(recipient.emailAddress, "bounce", recipient.diagnosticCode);
      }
    }
    return NextResponse.json({ ok: true, handled: "bounce" });
  }

  if (kind === "Complaint") {
    for (const recipient of payload.complaint?.complainedRecipients ?? []) {
      await suppress(
        recipient.emailAddress,
        "complaint",
        payload.complaint?.complaintFeedbackType,
      );
    }
    return NextResponse.json({ ok: true, handled: "complaint" });
  }

  if (kind === "Received" || payload.content) {
    return handleInbound(payload);
  }

  return NextResponse.json({ ok: true, ignored: kind || "unknown" });
}

async function handleInbound(payload: SesNotification) {
  if (!payload.content) {
    // Large messages are written to S3 instead of inlined; we only support the
    // inline SNS action, so record the gap rather than failing silently.
    console.warn("[sns] inbound notification without inline content (S3 action?)");
    return NextResponse.json({ ok: true, ignored: "no inline content" });
  }

  const rawMime = Buffer.from(payload.content, "base64").toString("utf8");
  const email = parseEmail(rawMime.startsWith("Return-Path") || rawMime.includes("\n") ? rawMime : payload.content);
  const from = normalizeEmail(email.from);
  if (!from) return NextResponse.json({ ok: true, ignored: "no sender" });

  // Match the reply to a thread: header threading first, sender address second.
  const candidateIds = [email.inReplyTo, ...(email.references ?? [])].filter(
    Boolean,
  ) as string[];

  let threadId: string | null = null;
  if (candidateIds.length) {
    const [row] = await db
      .select({ threadId: outreachMessages.threadId })
      .from(outreachMessages)
      .where(
        sql`${outreachMessages.messageId} = ANY(${sql.raw(
          `ARRAY[${candidateIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")}]::text[]`,
        )})`,
      )
      .limit(1);
    threadId = row?.threadId ?? null;
  }
  if (!threadId) {
    const [row] = await db
      .select({ id: outreachThreads.id })
      .from(outreachThreads)
      .where(eq(outreachThreads.toEmail, from))
      .orderBy(desc(outreachThreads.updatedAt))
      .limit(1);
    threadId = row?.id ?? null;
  }
  if (!threadId) {
    console.warn(`[sns] inbound reply from ${from} matched no thread`);
    return NextResponse.json({ ok: true, ignored: "no matching thread" });
  }

  const body = stripQuotedReply(email.text || "");
  const now = new Date();

  const [inserted] = await db
    .insert(outreachMessages)
    .values({
      threadId,
      direction: "inbound",
      status: "received",
      subject: email.subject,
      bodyText: body || email.text || "(empty reply)",
      fromEmail: from,
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
      receivedAt: email.date ?? now,
    })
    .returning({ id: outreachMessages.id });

  await db
    .update(outreachThreads)
    .set({ status: "replied", lastInboundAt: now, nextActionAt: null, updatedAt: now })
    .where(and(eq(outreachThreads.id, threadId), sql`status NOT IN ('unsubscribed','converted')`));

  // Hand the reply to the Conversationalist for classification + drafting.
  await enqueue({
    agent: "conversationalist",
    kind: "handle_reply",
    payload: { threadId, messageId: inserted.id },
    dedupeKey: `reply:${inserted.id}`,
    priority: 10,
  });

  return NextResponse.json({ ok: true, handled: "inbound", threadId });
}
