import nodemailer from "nodemailer";
import { getConfig } from "@/lib/settings";

/**
 * Transactional mail for the site itself: lead confirmations, sales alerts,
 * scrape warnings, the weekly report.
 *
 * Prefers SMTP when configured (Resend, Postmark, Zoho, anything). When it is
 * not, but the agents' Amazon SES credentials are, it sends over SES instead —
 * there is no reason to run a second mail service once SES is set up, and
 * silently discarding a weekly report because SMTP was never filled in is
 * worse than either. Only if neither exists does it fall back to logging, so
 * lead capture never depends on mail being available.
 */

/** Last resort when no transport is configured at all. */
function dryRun(to: string[], subject: string): { ok: boolean } {
  console.log(`[email:dry-run] to=${to.join(",")} subject="${subject}"`);
  return { ok: true };
}

/** Send through the agents' SES credentials, one recipient at a time. */
async function sendViaSes(
  to: string[],
  subject: string,
  html: string,
  text: string,
): Promise<{ ok: boolean; error?: string } | null> {
  const { getAgentConfig } = await import("@/lib/agents/config");
  const agentConfig = await getAgentConfig();
  if (
    !agentConfig.sesAccessKeyId ||
    !agentConfig.sesSecretAccessKey ||
    !agentConfig.sesFromEmail
  ) {
    return null;
  }
  const { buildRawMessage, sesSendRaw } = await import("@/lib/agents/ses");
  const domain = agentConfig.sesFromEmail.split("@")[1] ?? "uaeasp.ae";

  const errors: string[] = [];
  for (const recipient of to) {
    try {
      const raw = buildRawMessage({
        from: agentConfig.sesFromEmail,
        fromName: agentConfig.sesFromName,
        to: recipient,
        replyTo: agentConfig.replyToEmail || agentConfig.sesFromEmail,
        subject,
        text,
        html,
        messageId: `${crypto.randomUUID()}@${domain}`,
      });
      const result = await sesSendRaw(raw, agentConfig);
      if (!result.ok) errors.push(`${recipient}: ${result.error}`);
    } catch (err) {
      errors.push(`${recipient}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (errors.length) {
    console.error("[email:ses] send failed:", errors.join("; "));
    return { ok: false, error: errors.join("; ") };
  }
  return { ok: true };
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
  const config = await getConfig();
  if (!to.length) return { ok: true };

  if (!config.smtpHost) {
    const viaSes = await sendViaSes(to, subject, html, text);
    return viaSes ?? dryRun(to, subject);
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
