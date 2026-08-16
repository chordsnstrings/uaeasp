import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { leadActivities, leads, outreachThreads, prospects } from "@/db/schema";
import { checkRateLimit, hashIp } from "@/lib/rate-limit";
import { getSalesNotifyEmails, sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ask for the shortlist from the personalised outreach page.
 *
 * This exists because the page it sits on used to end in a link. Fifty-one
 * people clicked an outreach email, thirty-six reached their own page, and
 * none became a lead — because asking for the shortlist meant clicking through
 * to /get-matched and filling in a form, two pages after they had already
 * shown interest.
 *
 * The thread token identifies the recipient, so we already hold their address,
 * their company, and their emirate. Nothing has to be typed. Invoice volume
 * and accounting system are asked for because they genuinely change which
 * three providers fit — and both are optional, because a lead with a blank
 * volume is worth incomparably more than a visitor who left.
 */

const VOLUMES = ["<100", "100-1000", "1000-10000", "10000+"];

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(`shortlist:${hashIp(ip)}`, 10, 3600))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: { token?: string; invoiceVolume?: string; accountingSoftware?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const token = String(body.token ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const [thread] = await db
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.token, token))
    .limit(1);
  if (!thread) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Already converted: say yes rather than creating a second lead. Someone who
  // presses the button twice has not made a mistake worth an error message.
  if (thread.leadId) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  const [prospect] = thread.prospectId
    ? await db.select().from(prospects).where(eq(prospects.id, thread.prospectId)).limit(1)
    : [];

  const volume = VOLUMES.includes(String(body.invoiceVolume)) ? String(body.invoiceVolume) : null;
  const software = String(body.accountingSoftware ?? "")
    .trim()
    .slice(0, 120);

  const email = thread.toEmail.toLowerCase();
  const [lead] = await db
    .insert(leads)
    .values({
      // Nothing was typed, so nothing is invented. The company is what we
      // already knew; the contact name stays honest about its origin.
      fullName: "(requested from outreach)",
      companyName: prospect?.name?.slice(0, 160) || email.split("@")[1] || "Unknown",
      email,
      // Phone is required on the table and we do not have one.
      phone: "",
      emirate: prospect?.emirate ?? null,
      invoiceVolume: volume,
      accountingSoftware: software || null,
      source: "outreach-page",
      locale: "en",
      consentAt: new Date(),
    })
    .returning({ id: leads.id, trackingToken: leads.trackingToken });

  if (!lead) {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }

  await db.insert(leadActivities).values({
    leadId: lead.id,
    type: "created",
    body: `Asked for a shortlist from their personalised outreach page (${email}).`,
    meta: { threadId: thread.id, prospectId: thread.prospectId },
  });

  await db
    .update(outreachThreads)
    .set({ status: "converted", leadId: lead.id, nextActionAt: null, updatedAt: new Date() })
    .where(eq(outreachThreads.id, thread.id));

  if (thread.prospectId) {
    await db
      .update(prospects)
      .set({ status: "converted", leadId: lead.id, updatedAt: new Date() })
      .where(and(eq(prospects.id, thread.prospectId)));
  }

  // Best-effort: a lead that is stored but not announced is recoverable, a
  // request that errors in front of the person who just asked is not.
  try {
    const to = await getSalesNotifyEmails();
    if (to.length) {
      const label = prospect?.name ?? email;
      const detail = [
        `${label} asked for a shortlist from their personalised outreach page.`,
        "",
        `Email: ${email}`,
        prospect?.emirate ? `Emirate: ${prospect.emirate}` : "",
        volume ? `Invoice volume: ${volume}` : "Invoice volume: not given",
        software ? `Accounting system: ${software}` : "Accounting system: not given",
        "",
        `Open in CRM: ${absoluteUrl(`/admin/leads/${lead.id}`)}`,
      ]
        .filter(Boolean)
        .join("\n");
      await sendEmail({
        to,
        subject: `[Outreach] ${label} asked for a shortlist`,
        text: detail,
        html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${detail
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</pre>`,
      });
    }
  } catch {
    /* the lead is saved; the alert is not worth failing the response over */
  }

  return NextResponse.json({ ok: true, trackingToken: lead.trackingToken });
}
