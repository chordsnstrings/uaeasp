import { NextResponse, after, type NextRequest } from "next/server";
import { db } from "@/db";
import { leadActivities } from "@/db/schema";
import { sendEmail, getSalesNotifyEmails } from "@/lib/email";
import { newLeadEmail } from "@/lib/email/templates";
import { leadConfirmationEmail } from "@/lib/email/client-templates";
import { createLead } from "@/lib/leads/create-lead";
import { checkRateLimit, hashIp } from "@/lib/rate-limit";
import { leadSchema } from "@/lib/validation/lead";

export const runtime = "nodejs";

const MIN_FILL_MS = 3000;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // feature disabled
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success;
  } catch {
    // Fail open: a Cloudflare outage must not kill lead capture
    return true;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const ip = clientIp(req);
  const ipHash = ip === "unknown" ? null : hashIp(ip);

  // Honeypot filled or submitted suspiciously fast → pretend success, drop.
  const tooFast = Date.now() - input.renderedAt < MIN_FILL_MS;
  if (input.website || tooFast) {
    return NextResponse.json({ ok: true });
  }

  if (ipHash) {
    const allowed = await checkRateLimit(`lead:${ipHash}`, 5, 3600);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  }

  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    return NextResponse.json({ error: "captcha" }, { status: 400 });
  }

  const lead = await createLead(input, { ipHash });

  // Notify sales + confirm to the client without blocking the response.
  after(async () => {
    const recipients = getSalesNotifyEmails();
    if (recipients.length > 0) {
      const { subject, html, text } = newLeadEmail(lead);
      const result = await sendEmail({ to: recipients, subject, html, text });
      await db.insert(leadActivities).values({
        leadId: lead.id,
        userId: null,
        type: "email_sent",
        body: result.ok
          ? `Sales team notified (${recipients.length} recipient${recipients.length > 1 ? "s" : ""}).`
          : `Sales notification FAILED: ${result.error}`,
        meta: { ok: result.ok },
      });
    }
    const confirmation = leadConfirmationEmail(lead);
    await sendEmail({ to: [lead.email], ...confirmation });
  });

  return NextResponse.json({ ok: true, id: lead.id, trackingToken: lead.trackingToken });
}
