import nodemailer from "nodemailer";

/**
 * Provider-agnostic SMTP mailer. Works with Resend SMTP, Postmark, SES, Zoho
 * or any other SMTP endpoint — configured entirely via env vars. When SMTP is
 * not configured (e.g. local dev), emails are logged instead of sent so lead
 * capture never depends on email availability.
 */

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

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
  const transport = getTransport();
  if (!transport) {
    console.log(`[email:dry-run] to=${to.join(",")} subject="${subject}"`);
    return { ok: true };
  }
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? "noreply@localhost",
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

export function getSalesNotifyEmails(): string[] {
  return (process.env.SALES_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function getAdminAlertEmail(): string[] {
  const email = process.env.ADMIN_ALERT_EMAIL?.trim();
  return email ? [email] : getSalesNotifyEmails();
}
