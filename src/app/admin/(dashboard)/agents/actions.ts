"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, outreachMessages, visibilityTargets } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  AGENT_SECRET_FIELDS,
  DEFAULT_AGENT_CONFIG,
  setAgentConfig,
  type AgentConfig,
} from "@/lib/agents/config";
import { heartbeat } from "@/lib/agents/heartbeat";
import { sendOutreachMessage, suppress } from "@/lib/agents/mailer";
import { enqueue } from "@/lib/agents/queue";
import { testSesConnection } from "@/lib/agents/ses";

type ActionState = { ok?: boolean; error?: string; detail?: string } | undefined;

export async function saveAgentConfigAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const updates: Partial<AgentConfig> = {};
  const changed: string[] = [];

  for (const key of Object.keys(DEFAULT_AGENT_CONFIG) as (keyof AgentConfig)[]) {
    const shape = DEFAULT_AGENT_CONFIG[key];
    if (typeof shape === "boolean") {
      // Unchecked checkboxes are absent from the payload — a hidden companion
      // field marks which switches were on the form at all.
      if (formData.get(`__present_${key}`) === null) continue;
      (updates[key] as unknown) = formData.get(key) === "on";
      changed.push(key);
      continue;
    }
    const raw = formData.get(key);
    if (raw === null) continue;
    const value = String(raw).trim();
    if (AGENT_SECRET_FIELDS.includes(key)) {
      if (value === "") continue;
      (updates[key] as unknown) = value === "unset" ? "" : value;
    } else if (typeof shape === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      (updates[key] as unknown) = n;
    } else {
      (updates[key] as unknown) = value;
    }
    changed.push(key);
  }

  if (!changed.length) return { ok: true };
  try {
    await setAgentConfig(updates);
  } catch {
    return { error: "Could not save agent settings." };
  }
  await writeAudit({
    userId: admin.id,
    action: "agents.config.update",
    entity: "agent_config",
    diff: { fields: changed },
  });
  revalidatePath("/admin/agents");
  return { ok: true };
}

export async function testSesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const to = String(formData.get("to") ?? "").trim() || admin.email || "";
  if (!to) return { error: "No recipient address." };
  const result = await testSesConnection(to);
  return result.ok ? { ok: true, detail: result.detail } : { error: result.detail };
}

/** Run a tick synchronously from the console — the "do it now" button. */
export async function runTickAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  // minGapSeconds 0: an admin pressing the button means "now", not "if due".
  const result = await heartbeat({ limit: 15, minGapSeconds: 0 });
  await writeAudit({
    userId: admin.id,
    action: "agents.tick",
    entity: "agent_tasks",
    diff: { ...result },
  });
  revalidatePath("/admin/agents");
  revalidatePath("/admin/scrapes");

  const parts: string[] = [];
  if (result.maintenance?.ran) {
    parts.push(`Directory refresh: ${result.maintenance.detail ?? result.maintenance.reason}.`);
  }
  if (result.skipped) parts.push(`Agents: ${result.skipped}.`);
  else {
    parts.push(
      `Scheduled ${result.scheduled?.length ?? 0}, processed ${result.processed ?? 0}. Queue: ${
        Object.entries(result.depth ?? {})
          .map(([k, v]) => `${v} ${k}`)
          .join(", ") || "empty"
      }.`,
    );
  }
  return { ok: true, detail: parts.join(" ") };
}

export async function queueJobAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const agent = String(formData.get("agent") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!agent || !kind) return { error: "Pick an agent and a job." };
  await enqueue({
    agent: agent as "visibility" | "prospector" | "conversationalist" | "analyst",
    kind,
    dedupeKey: `manual:${agent}:${kind}:${Date.now()}`,
    priority: 10,
  });
  await writeAudit({
    userId: admin.id,
    action: "agents.enqueue",
    entity: "agent_tasks",
    diff: { agent, kind },
  });
  revalidatePath("/admin/agents");
  return { ok: true, detail: `Queued ${agent}/${kind}.` };
}

export async function approveMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("messageId") ?? "");
  const editedBody = String(formData.get("bodyText") ?? "").trim();
  const editedSubject = String(formData.get("subject") ?? "").trim();
  if (!id) return { error: "Missing message." };

  await db
    .update(outreachMessages)
    .set({
      ...(editedBody ? { bodyText: editedBody } : {}),
      ...(editedSubject ? { subject: editedSubject } : {}),
      status: "scheduled",
      approvedBy: admin.id,
      approvedAt: new Date(),
    })
    .where(eq(outreachMessages.id, id));

  const outcome = await sendOutreachMessage(id);
  await writeAudit({
    userId: admin.id,
    action: "agents.message.approve",
    entity: "outreach_message",
    entityId: id,
    diff: { sent: outcome.sent, reason: outcome.reason },
  });
  revalidatePath("/admin/agents/approvals");
  return outcome.sent
    ? { ok: true, detail: "Approved and sent." }
    : { ok: true, detail: `Approved. Queued to send (${outcome.reason ?? "pending"}).` };
}

export async function rejectMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("messageId") ?? "");
  const alsoSuppress = formData.get("suppress") === "on";
  if (!id) return { error: "Missing message." };

  const [message] = await db
    .select()
    .from(outreachMessages)
    .where(eq(outreachMessages.id, id))
    .limit(1);
  await db
    .update(outreachMessages)
    .set({ status: "rejected", approvedBy: admin.id, approvedAt: new Date() })
    .where(eq(outreachMessages.id, id));

  if (alsoSuppress && message?.toEmail) {
    await suppress(message.toEmail, "manual", "rejected in console");
  }
  await writeAudit({
    userId: admin.id,
    action: "agents.message.reject",
    entity: "outreach_message",
    entityId: id,
    diff: { suppressed: alsoSuppress },
  });
  revalidatePath("/admin/agents/approvals");
  return { ok: true, detail: alsoSuppress ? "Rejected and suppressed." : "Rejected." };
}

export async function publishArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("articleId") ?? "");
  const action = String(formData.get("action") ?? "publish");
  const editedBody = String(formData.get("bodyMd") ?? "").trim();
  const editedTitle = String(formData.get("title") ?? "").trim();
  if (!id) return { error: "Missing article." };

  if (action === "archive") {
    await db.update(articles).set({ status: "archived" }).where(eq(articles.id, id));
    revalidatePath("/admin/agents/content");
    return { ok: true, detail: "Archived." };
  }

  await db
    .update(articles)
    .set({
      ...(editedBody ? { bodyMd: editedBody } : {}),
      ...(editedTitle ? { title: editedTitle } : {}),
      status: "published",
      approvedBy: admin.id,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(articles.id, id));

  await writeAudit({
    userId: admin.id,
    action: "agents.article.publish",
    entity: "article",
    entityId: id,
  });
  revalidatePath("/admin/agents/content");
  revalidatePath("/insights");
  return { ok: true, detail: "Published to /insights." };
}

export async function updateTargetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("targetId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return { error: "Missing target." };
  await db
    .update(visibilityTargets)
    .set({
      status: status as "discovered" | "queued" | "drafted" | "actioned" | "won" | "skipped",
      actionedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(visibilityTargets.id, id));
  revalidatePath("/admin/agents/visibility");
  return { ok: true };
}

export async function suppressEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter an email address." };
  await suppress(email, "manual", `added by ${admin.email}`);
  await writeAudit({
    userId: admin.id,
    action: "agents.suppress",
    entity: "suppression",
    diff: { email },
  });
  revalidatePath("/admin/agents/suppressions");
  return { ok: true, detail: `${email} will never be contacted again.` };
}
