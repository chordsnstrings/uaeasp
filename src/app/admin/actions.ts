"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import {
  leadActivities,
  leads,
  providers,
  users,
  type Lead,
} from "@/db/schema";
import { requireAdmin, requireUser, signIn, signOut } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { PROVIDERS_CACHE_TAG } from "@/lib/data";
import { revalidateTag } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

/* ---------- auth ---------- */

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/admin",
    });
    return {};
  } catch (err) {
    // signIn throws NEXT_REDIRECT on success — rethrow it
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    return { error: "Invalid email or password" };
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}

/* ---------- leads ---------- */

const LEAD_STATUSES: Lead["status"][] = [
  "new",
  "contacted",
  "qualified",
  "matched",
  "closed_won",
  "closed_lost",
];

export async function updateLeadStatus(
  leadId: string,
  status: Lead["status"],
): Promise<ActionResult> {
  const user = await requireUser();
  if (!LEAD_STATUSES.includes(status)) return { ok: false, error: "bad status" };

  const [before] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!before) return { ok: false, error: "not found" };
  if (before.status === status) return { ok: true };

  await db
    .update(leads)
    .set({ status, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  await db.insert(leadActivities).values({
    leadId,
    userId: user.id,
    type: "status_change",
    body: `Status changed: ${before.status} → ${status}`,
    meta: { from: before.status, to: status },
  });
  await writeAudit({
    userId: user.id,
    action: "lead.status_change",
    entity: "lead",
    entityId: leadId,
    diff: { from: before.status, to: status },
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function assignLead(
  leadId: string,
  assigneeId: string | null,
): Promise<ActionResult> {
  const user = await requireUser();

  let assigneeName = "Unassigned";
  if (assigneeId) {
    const [assignee] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1);
    if (!assignee) return { ok: false, error: "assignee not found" };
    assigneeName = assignee.name;
  }

  await db
    .update(leads)
    .set({ assignedTo: assigneeId, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  await db.insert(leadActivities).values({
    leadId,
    userId: user.id,
    type: "assignment",
    body: assigneeId ? `Assigned to ${assigneeName}` : "Unassigned",
    meta: { assigneeId },
  });
  await writeAudit({
    userId: user.id,
    action: "lead.assign",
    entity: "lead",
    entityId: leadId,
    diff: { assigneeId },
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function addLeadNote(
  leadId: string,
  note: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const body = note.trim();
  if (!body) return { ok: false, error: "empty note" };
  if (body.length > 4000) return { ok: false, error: "note too long" };

  await db.insert(leadActivities).values({
    leadId,
    userId: user.id,
    type: "note",
    body,
  });
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true };
}

/* ---------- providers ---------- */

export async function updateProviderAdmin(
  providerId: string,
  fields: {
    nameAr?: string;
    website?: string;
    description?: string;
    descriptionAr?: string;
    status?: "active" | "delisted" | "hidden";
    priceTier?: number | null;
  },
): Promise<ActionResult> {
  const user = await requireAdmin();

  const [before] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);
  if (!before) return { ok: false, error: "not found" };

  // Fields an admin edits become overrides the scraper must not clobber.
  const overrides = { ...(before.adminOverrides as Record<string, boolean>) };
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    set[key] = value === "" ? null : value;
    if (["website", "description", "nameAr", "descriptionAr"].includes(key)) {
      overrides[key] = true;
    }
  }
  set.adminOverrides = overrides;

  await db.update(providers).set(set).where(eq(providers.id, providerId));
  await writeAudit({
    userId: user.id,
    action: "provider.update",
    entity: "provider",
    entityId: providerId,
    diff: fields,
  });
  revalidateTag(PROVIDERS_CACHE_TAG);
  revalidatePath("/admin/providers");
  return { ok: true };
}

/* ---------- users ---------- */

export async function createUserAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "sales") as "admin" | "sales";

  if (!email || !name) return { error: "Email and name are required" };
  if (password.length < 10) return { error: "Password must be at least 10 characters" };
  if (!["admin", "sales"].includes(role)) return { error: "Invalid role" };

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await db.insert(users).values({ email, name, passwordHash, role });
  } catch {
    return { error: "A user with this email already exists" };
  }
  await writeAudit({
    userId: admin.id,
    action: "user.create",
    entity: "user",
    entityId: email,
    diff: { role },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleUserActive(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.id === userId) return { ok: false, error: "cannot deactivate yourself" };
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { ok: false, error: "not found" };
  await db
    .update(users)
    .set({ active: !target.active })
    .where(eq(users.id, userId));
  await writeAudit({
    userId: admin.id,
    action: target.active ? "user.deactivate" : "user.activate",
    entity: "user",
    entityId: userId,
  });
  revalidatePath("/admin/users");
  return { ok: true };
}
