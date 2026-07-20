import nodemailer from "nodemailer";
import { getConfig } from "@/lib/settings";

/**
 * Provider-agnostic SMTP mailer. Works with Resend SMTP, Postmark, SES, Zoho
 * or any other SMTP endpoint. Configuration comes from admin settings
 * (/admin/settings) with env vars as fallback — see src/lib/settings.ts.
 * When SMTP is not configured (e.g. local dev), emails are logged instead of
 * sent so lead capture never depends on email availability.
 */

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const config = await getConfig();
  if (!config.smtpHost) {
    console.log(`[email:dry-run] to=${to.join(",")} subject="${subject}"`);
    return { ok: true };
  }
  const port = Number(config.smtpPort || 587);
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port,
    secure: port === 465,
    auth: config.smtpUser
      ? { user: config.smtpUser, pass: config.smtpPass }
      : undefined,
  });
  try {
    await transport.sendMail({
      from: config.emailFrom || "noreply@localhost",
      to: to.join(", "),
      subject,
      html,
      text,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getSalesNotifyEmails(): Promise<string[]> {
  const config = await getConfig();
  return config.salesNotifyEmails
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export async function getAdminAlertEmail(): Promise<string[]> {
  const config = await getConfig();
  const email = config.adminAlertEmail.trim();
  return email ? [email] : getSalesNotifyEmails();
}
