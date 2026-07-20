"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import {
  CONFIG_FIELDS,
  SECRET_FIELDS,
  setConfig,
  type AppConfig,
} from "@/lib/settings";

export async function saveSettingsAction(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireAdmin();

  const updates: Partial<AppConfig> = {};
  const changed: string[] = [];
  for (const field of CONFIG_FIELDS) {
    const raw = formData.get(field);
    if (raw === null) continue;
    const value = String(raw).trim();
    if (SECRET_FIELDS.includes(field)) {
      // Secrets are write-only: blank keeps the current value; the literal
      // "unset" clears the stored value (falling back to the env var).
      if (value === "") continue;
      updates[field] = value === "unset" ? "" : value;
    } else {
      updates[field] = value;
    }
    changed.push(field);
  }

  if (changed.length === 0) return { ok: true };

  try {
    await setConfig(updates);
  } catch {
    return { error: "Could not save settings. Please try again." };
  }

  await writeAudit({
    userId: admin.id,
    action: "settings.update",
    entity: "settings",
    // Field names only — never the values.
    diff: { fields: changed },
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function sendTestEmailAction(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = await requireAdmin();
  const to = String(formData.get("to") ?? "").trim() || admin.email;
  if (!to) return { error: "No recipient address." };

  const result = await sendEmail({
    to: [to],
    subject: "Test email — settings check",
    html: `<p>This is a test email sent from the admin settings page. If you can read this, SMTP is configured correctly.</p>`,
    text: "This is a test email sent from the admin settings page. If you can read this, SMTP is configured correctly.",
  });
  if (!result.ok) {
    return { error: `Send failed: ${result.error ?? "unknown error"}` };
  }
  await writeAudit({
    userId: admin.id,
    action: "settings.test_email",
    entity: "settings",
    diff: { to },
  });
  return { ok: true };
}
