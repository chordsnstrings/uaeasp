"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { AGENT_KEYS, articles, outreachMessages, visibilityTargets } from "@/db/schema";
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
import { AI_JOBS, setJobModels, type AiJob } from "@/lib/ai/models";

type ActionState = { ok?: boolean; error?: string; detail?: string } | undefined;

/** One click should not be able to arm an unbounded number of sends. */
const BULK_APPROVE_LIMIT = 200;

const APPROVAL_MODES = ["manual", "first_touch", "auto"] as const;

const APPROVAL_MODE_CONFIRMATION: Record<string, string> = {
  manual: "Manual: nothing sends until you approve it.",
  first_touch: "First touch: opening emails send themselves, replies wait for you.",
  auto: "Autonomous: outreach now sends without review. Watch the inbox.",
};

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

/**
 * Turn one agent on or off.
 *
 * Deliberately its own action rather than a checkbox inside the settings form.
 * That form posts every field it renders, so a stale page could quietly revert
 * an unrelated setting on the way past; a switch that does one thing should
 * write one key. It also means the toggle works without scrolling to a form
 * and pressing save, which is the whole point of putting it on the card.
 */
export async function toggleAgentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const agent = String(formData.get("agent") ?? "");
  // "agents" is the master switch; everything else must be a real agent, so a
  // crafted form cannot flip an arbitrary config key through this action.
  if (agent !== "agents" && !(AGENT_KEYS as readonly string[]).includes(agent)) {
    return { error: "Unknown agent." };
  }
  const key = `${agent}Enabled` as keyof AgentConfig;
  const next = formData.get("next") === "on";

  try {
    await setAgentConfig({ [key]: next } as Partial<AgentConfig>);
  } catch {
    return { error: "Could not change that switch." };
  }
  await writeAudit({
    userId: admin.id,
    action: "agents.toggle",
    entity: "agent_config",
    entityId: agent,
    diff: { [key]: next },
  });
  revalidatePath("/admin/agents");
  revalidatePath("/admin");
  const label = agent === "agents" ? "Master switch" : agent;
  return { ok: true, detail: `${label} ${next ? "switched on" : "switched off"}.` };
}

/**
 * How much of the outreach the Conversationalist may do unattended.
 *
 * Its own action rather than a field on the settings form, for the same reason
 * as the on/off switch: this is the setting most worth changing quickly and
 * least worth changing by accident, so it writes one key and records who did
 * it. Moving to "auto" means email leaves without anyone reading it, which is
 * why the choice is spelled out on the card rather than hidden in a dropdown.
 */
export async function setApprovalModeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const mode = String(formData.get("mode") ?? "");
  if (!APPROVAL_MODES.includes(mode as (typeof APPROVAL_MODES)[number])) {
    return { error: "Unknown approval mode." };
  }

  try {
    await setAgentConfig({
      outreachApprovalMode: mode as AgentConfig["outreachApprovalMode"],
    });
  } catch {
    return { error: "Could not change the approval mode." };
  }
  await writeAudit({
    userId: admin.id,
    action: "agents.approval_mode",
    entity: "agent_config",
    diff: { outreachApprovalMode: mode },
  });
  revalidatePath("/admin/agents");
  revalidatePath("/admin");
  revalidatePath("/admin/agents/approvals");
  return { ok: true, detail: APPROVAL_MODE_CONFIRMATION[mode] };
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

  // Only a message that has not yet left may be approved. Without this guard a
  // second click on a stale page resets a 'sent' row to 'scheduled' and mails
  // the recipient again.
  const armed = await db
    .update(outreachMessages)
    .set({
      ...(editedBody ? { bodyText: editedBody } : {}),
      ...(editedSubject ? { subject: editedSubject } : {}),
      status: "scheduled",
      approvedBy: admin.id,
      approvedAt: new Date(),
    })
    .where(
      and(
        eq(outreachMessages.id, id),
        inArray(outreachMessages.status, ["pending_approval", "draft", "scheduled"]),
      ),
    )
    .returning({ id: outreachMessages.id });
  if (!armed.length) {
    return { ok: true, detail: "Already handled — nothing was sent again." };
  }

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

/**
 * Approve everything that is safe to approve, in one click.
 *
 * "Everything" is doing real work here, because two kinds of draft sit in this
 * queue and only one of them should ever go out unread:
 *
 * - A message written before the current rules (no stored raw body) carries the
 *   old shape — no link to the recipient's own page, a full-URL opt-out, no
 *   tracking. Bulk-approving those is exactly the mistake this button would
 *   otherwise make easy, so they are skipped and counted.
 * - A message the writer itself flagged (`error` set) failed the
 *   personalisation check. It exists because a human has to look at it.
 *
 * What survives is marked approved and left for the sender to pick up rather
 * than transmitted inline. Sending hundreds of messages inside one request
 * would blow the request budget and ignore the daily cap; the queue already
 * respects both.
 */
export async function approveAllAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  // The page renders the count it is asking to approve. If the queue has moved
  // on since, the operator is agreeing to something they did not see.
  const expected = Number(formData.get("expected") ?? -1);

  const eligible = await db
    .select({ id: outreachMessages.id })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.direction, "outbound"),
        eq(outreachMessages.status, "pending_approval"),
        isNull(outreachMessages.approvedAt),
        isNotNull(outreachMessages.bodyRaw),
        isNull(outreachMessages.error),
      ),
    )
    .limit(BULK_APPROVE_LIMIT);

  if (!eligible.length) {
    return { ok: true, detail: "Nothing was eligible — every draft here still needs a person." };
  }
  if (expected >= 0 && expected !== eligible.length) {
    return {
      error: `The queue changed: ${eligible.length} are now eligible, not ${expected}. Reload and check before approving.`,
    };
  }

  const ids = eligible.map((row) => row.id);
  const approved = await db
    .update(outreachMessages)
    .set({ status: "scheduled", approvedBy: admin.id, approvedAt: new Date() })
    .where(
      and(
        inArray(outreachMessages.id, ids),
        // Re-checked at write time: between the read above and here, another
        // admin may have approved or rejected some of these.
        eq(outreachMessages.status, "pending_approval"),
      ),
    )
    .returning({ id: outreachMessages.id });

  await enqueue({
    agent: "conversationalist",
    kind: "flush_approved",
    dedupeKey: `flush:bulk:${Date.now()}`,
    priority: 30,
  });

  await writeAudit({
    userId: admin.id,
    action: "agents.message.approve_all",
    entity: "outreach_message",
    diff: { approved: approved.length },
  });
  revalidatePath("/admin/agents/approvals");
  revalidatePath("/admin");
  return {
    ok: true,
    detail: `Approved ${approved.length}. They send on the queue, inside the daily cap.`,
  };
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

export async function saveModelRoutingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const updates: Partial<Record<AiJob, string>> = {};
  for (const job of AI_JOBS) {
    const raw = formData.get(`model_${job.key}`);
    if (raw === null) continue;
    updates[job.key] = String(raw).trim();
  }
  try {
    await setJobModels(updates);
  } catch {
    return { error: "Could not save model routing." };
  }
  await writeAudit({
    userId: admin.id,
    action: "agents.models.update",
    entity: "ai_models",
    diff: updates,
  });
  revalidatePath("/admin/agents");
  const named = Object.values(updates).filter(Boolean).length;
  return {
    ok: true,
    detail: named
      ? `${named} job${named === 1 ? "" : "s"} routed to a specific model; the rest inherit the global one.`
      : "All jobs inherit the global model.",
  };
}
