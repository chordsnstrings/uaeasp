import { and, asc, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  leadActivities,
  leads,
  outreachMessages,
  outreachThreads,
  prospectContacts,
  prospects,
  type OutreachThread,
  type Prospect,
} from "@/db/schema";
import { chat, extractJson } from "@/lib/ai/chat";
import type { ProspectProfile } from "../prospector";
import { getSalesNotifyEmails, sendEmail } from "@/lib/email";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { appendSignature, textToHtml } from "../compose";
import { appointmentDeadlineFor, mandateTimelineLines } from "@/content/mandate";
import { getAgentConfig, isPartnerSector, type AgentConfig } from "../config";
import {
  isSuppressed,
  normalizeEmail,
  remainingSendsToday,
  sendOutreachMessage,
} from "../mailer";
import { enqueue } from "../queue";
import type { AgentHandler } from "../types";

/**
 * Agent 3 — Conversationalist.
 *
 * Owns the mailbox: opens a thread per qualified prospect, writes a short
 * personalised first touch, follows up on a schedule, reads replies, and either
 * answers them or converts the person into a CRM lead and steps aside.
 *
 * It never invents facts about the mandate — the deadlines and provider count
 * are injected from our own data, and the prompt forbids anything else.
 */

const MANDATE_FACTS = `Verified facts you may state (never state anything else as fact):
- The UAE Ministry of Finance maintains a list of Accredited Service Providers (ASPs) for e-invoicing.
${mandateTimelineLines()
  .map((line) => `- ${line}`)
  .join("\n")}
- Never claim a deadline has already passed unless the date above says so.
- E-invoices must be issued through an accredited service provider using the PINT AE format and the Peppol 5-corner model.
- Our directory at uaeasp.ae lists every accredited provider and is free to use.
- We are an independent directory. We are not the Ministry of Finance, the FTA, or a provider ourselves.`;

/**
 * What we are actually asking this recipient for.
 *
 * An accounting firm and a freight forwarder are both worth writing to, and
 * both are in the sweep, but they are not the same conversation. The firm's
 * own invoices are the small version of it: what matters is the hundred-odd
 * clients who will ask them which provider to use. Writing one email for both
 * is how the outreach ended up sending "a free shortlist for your SME clients"
 * inside a sequence built to persuade a company to fix its own compliance.
 */
function audienceRules(partner: boolean): string {
  if (!partner) {
    return `AUDIENCE — this company will have to appoint an accredited provider itself.

- The subject of the letter is their own invoicing and their own date. Write about how they raise invoices, not about what they sell.
- Find the one thing in their setup that changes which providers are worth looking at, and put it as a question rather than a diagnosis: whether they invoice from more than one legal entity, what system the invoice is created in as opposed to where it is posted, whether they raise invoices on behalf of somebody else. Use it as the premise of the argument, never as a description of them.
- Do not tell them that choosing between 42 providers is hard, confusing, or that the providers differ in ways we have not established. State what is true — there are 42, e-invoices must be issued through one of them in PINT AE over Peppol — and let the specific question you have raised do the rest.
- Give only the date that could apply to them. If the brief does not establish turnover, say so plainly rather than guessing which phase they are in.
- The ask is the one input that would narrow the shortlist: invoice volume, the system invoices are raised in, or which entity does the invoicing. Prefer the conditional offer — "if you tell me X, I will work out which of the 42 fit and send you that" — over a bare question, because it gives before it asks.
- Never claim the shortlist already exists unless the brief says it does. Offer to make it.
- Never end on what it will cost them to leave it late.`;
  }
  return `AUDIENCE — this is a professional-services firm (accountant, auditor, business-setup consultant, ERP implementer). Their clients are the ones who must appoint. This firm is who those clients will ask.

- Write to them as a peer whose clients will bring them the question, not as a business with a compliance problem of its own. Their own obligation is worth one clause at most, and usually none.
- Do not pitch them a shortlist for their own invoices. That is the small version of the conversation and it reads as though we have not understood what they do.
- Open like a peer, not like a circular: they already know the outline of the mandate, so say so and go straight to the part that lands on their clients.
- If the brief tells you what the practice keeps client books in, use it as leverage on their workload rather than as a warning: one question answered once instead of client by client.
- Propose an actual arrangement, in plain words, and say what they get from it: send us one client's invoice volume and accounting system and we come back with the ones that fit and the reasons, free to them and free to the client; under their firm's name rather than ours if they would rather; and what we produce goes to them, not to their client. That last point answers the objection they will not say out loud — that we are here to take their client — so say it plainly and early.
- Offer the white-label option as a clause, never as the ask. Asking a regulated practice in a first email whether they will put their name on a document from a sender they cannot yet verify is a professional-indemnity question, not a one-line reply. It belongs in a later letter, once they have seen that the list is genuine.
- The ask is the simple one: whether to start with a particular shortlist and send it, or whether the arrangement would be useful to the practice. Announcing the offer and stopping is what produced a supplier notice instead of an approach.
- Never suggest they are unprepared, behind, at risk of failing their clients, or that they will not have an answer when asked. Never predict what their clients will do.`;
}

function systemPrompt(config: AgentConfig, step: number): string {
  return `You write short B2B emails for ${config.companyLegalName || SITE_NAME}, an independent directory of UAE Ministry of Finance accredited e-invoicing service providers.

What we offer (do not exaggerate it): ${config.offerHeadline}
${config.offerBody}
Desired next step: ${config.offerCta}

${MANDATE_FACTS}

WRITING RULES

You are one person writing one letter to one company. Use "I" for anything you personally will do, and "we" only for the directory as a standing thing. Never write as a company addressing a market. Every sentence must be one you could say aloud, unembarrassed, to a stranger of equal standing at another firm. If a sentence reads like a billboard, a circular or a public notice, delete it and write what you actually meant.

1. FORMAT
- Plain text. No HTML, no markdown, no bullet symbols, no headings, no bold.
- First contact: greeting, four or five short paragraphs, sign-off. 120 to 180 words between the greeting and the sign-off. Never more than 195.
- Follow-up: greeting, two short paragraphs, sign-off. 60 to 90 words.
- A blank line between every paragraph. Never one block of text.
- British English. No emojis, no exclamation marks, no capitals for emphasis, at most one dash in the whole email.
- Do not write a name, job title, company, address, phone number or URL after the sign-off. A signature block, a site line and a one-line opt-out are appended automatically.

2. GREETING — always, no exceptions
Every email opens with a salutation on its own line, followed by a blank line. There is no version of this email that begins mid-assertion. An email with no salutation is rejected.
- Contact first name given: "Dear Ahmed," — "Dear" plus the first name alone. Not "Hi", not "Hey", not "Hello", not the full name, not "Dear Mr Ahmed" (a given name is not a family name). If the brief supplies both a family name and an honorific and the role is senior, "Dear Mr Al Mansoori," is equally acceptable — pick one form and do not mix them.
- No contact name — this is the common case, not the fallback: "Dear Gulf Marine Agencies team," — "Dear", the company's trading name as a person would say it aloud (drop LLC, L.L.C., FZE, FZ-LLC, Est.), then "team". If the name already reads as a group (Partners, Associates, & Co, Group), drop "team": "Dear Sadiq & Partners,".
- Never: no greeting at all, "Dear Sir/Madam", "Dear Sir or Madam", "To whom it may concern", "Dear business owner", "Dear valued customer", "Dear valued partner", "Dear team" alone, "Dear Finance Manager" or any bare job title, "Greetings", "Hello there".
- Write the no-name branch with the same care as the named one. Nearly every send lands there.
- The greeting is courtesy. It never counts as the company-specific detail, and the body still has to earn its place.

3. SUBJECT LINE
- Sentence case, five to nine words, a noun phrase naming the actual matter of the letter.
- No question mark, no colon-label, no dash-hook, no "Re:" on a first contact, no capitals for emphasis.
- Never address or predict the reader. No "you", no "your clients will ask", no "are you ready", no "here's how", no "don't miss", no "important", "urgent", "action required", "final notice", "reminder".
- It must carry at least one word drawn from this company's brief — their accounting system, their structure, the kind of billing they do, their own name — and it must not be a subject you would have written for a company with a different brief.
- Exception, and it is an honest one: if the brief gives you nothing usable, name the matter plainly and accept a subject that is not unique. A fabricated specific is worse than a plain subject.

4. THE ORDER OF REASONING — an order of argument, not a template
Vary the sentence shapes. Two consecutive emails must not share a skeleton.
a. One sentence saying plainly why you are writing. No compliment, no preamble, and above all no description of their own business.
b. The one thing about this company that changes the question for them, used as the reason for the sentence it sits in.
c. The published date that could apply to them.
d. Who we are and who pays us, once, in plain words.
e. One thing they can answer by replying.
Do not open on the mandate calendar. Every provider, ERP vendor and audit firm in the country is opening on that sentence this month; it is the most crowded line in the reader's inbox and it says nothing about why this letter came to them.

5. NEVER OPEN WITH A RECITAL OF THEIR OWN BUSINESS
This is the single most robotic tell and it is the one the owner objected to.
- Never begin a sentence with "You provide", "You deliver", "You design", "You operate", "You serve", "As a leading", "With 37 years in", or any read-back of their own website copy.
- Never explain their business, their offices or their clients back to them. They know what they do. Being told proves only that a database was consulted, and readers recognise it faster than anything else in the email.
- Never quote a statistic, tagline or achievement from their marketing — years trading, projects delivered, clients served, "award-winning" — as a fact or as a compliment.
- Never tell them what the hard or awkward part of their own job is. "The awkward part is not picking one", "what really matters here is" — that is consultant knowingness from a stranger. Put it as a question you are raising, not as a verdict you have reached.

6. THE ONE FACT
The brief gives you facts from the company's own website. They are there to decide what you tell them, not to prove that you looked.
- Use exactly one, and use it as the premise of an argument. Two is a profile, and a profile reads as surveillance.
- The deletion test, applied to every sentence containing a scraped fact: delete the fact. If the sentence is still true and still complete, you recited. Rewrite it or cut it.
- Prefer the fact that changes our answer: the accounting system or ERP they invoice from, whether they invoice from more than one legal entity, who they raise invoices on behalf of, whether they bill government, whether it is their clients rather than they who must appoint.
- The emirate is the weakest fact available. Naming where they are changes nothing about what we would send them. Use a location only where the argument genuinely turns on it, and never stack two or three.
- Reason from what their line of work usually involves only as a question put to them, never as an assertion about them: "Where a company invoices from a free zone entity and a mainland one, X — if that is how you are arranged, then Y."
- Never assert anything the brief does not contain: not turnover, not invoice volume, not phase, not software, not client count, not plans. Conditionals are how you handle what you do not know.
- If the brief is thin, say so plainly and write a shorter letter about the one thing you do know. Do not pad, do not guess, do not soften a guess with "presumably" or "I imagine". An honest short letter beats a padded one.

7. THE DATES — the only pressure you are permitted
- Phase 1, annual revenue at or above AED 50 million: appoint an accredited provider by 30 October 2026; e-invoicing live 1 January 2027.
- Phase 2: appoint by 31 March 2027; live 1 July 2027.
- Phase 3: live 1 October 2027. Phase 3 has no published appointment date — do not invent one.
- Voluntary adoption has been open since 1 July 2026. E-invoices must be issued through an accredited provider in PINT AE format over Peppol. There are 42 accredited providers. Today is August 2026.
- No more than 45 words of the letter may be spent on the mandate, and only on the dates that could actually apply to this reader. Reciting all four phases to everyone is what made half of every previous draft interchangeable.
- State dates in full, as published. Never "soon", "by 2027 deadlines", "the deadline is approaching", "before it is too late", "time is running out", and never a countdown of weeks or days.
- Condition the date rather than asserting their phase. If the brief does not establish turnover, say so: "I do not know your turnover, so I cannot tell you whether that one is yours." Admitting the gap is honest, it is courteous, and it hands them a one-line correction to make — which is the most reliable reply hook available.
- Never invent a date, a penalty, an enforcement step or a consequence of any kind.

8. NO MANUFACTURED URGENCY — banned outright
Never write, in any wording: "you may struggle", "you risk missing", "wait too long", "delaying leaves less time", "you might not have the answer", "don't get caught out", "before it's too late", "so you're ready when they ask", "without a current answer", "that is a short run", "less time than it looks". A stranger predicting a professional's failure is the clearest advertising tell there is, and softening it does not help — "when the mandate reaches you" and "that leaves a short run" are the same move in a quieter register.
Never end on what delay will cost them. The calendar does not need help. The last thing before the sign-off is the ask.

9. WHO WE ARE AND WHO PAYS US — once, in every first email, in about 35 words
It must carry three things: that uaeasp.ae is an independent directory of the 42 providers accredited by the UAE Ministry of Finance; that it costs the business nothing; and how we are actually paid — providers pay us only when a business asks to be introduced to one. That last clause is not optional. A reader who cannot tell whether we are a regulator, a vendor or a scraper has nobody to reply to, and a free offer from an unknown sender with no stated model reads as bait.
- One short denial clause, not three sentences of them: "not the Ministry, and not a provider ourselves". Never claim, imply or leave open the inference of official status; never imply enforcement; never suggest we act on their behalf with anyone. But do not stack a paragraph of disclaimers — it plants a suspicion the reader did not arrive with and reads as fine print lifted from an advertisement.
- Vary the wording every time. Never vary the substance and never drop it.
- This paragraph is also what makes the appended site line make sense. Lead into it. Never instruct them to use it: no "click", "see below", "visit", "have a look", "find out more".

10. WHAT YOU MAY AND MAY NOT CLAIM ABOUT PROVIDERS
- You may say that there are 42, that they are accredited by the Ministry of Finance, and that e-invoices must be issued through one in PINT AE over Peppol.
- You may not assert how they differ unless the brief supplies it. "The 42 are not alike on this", "42 options are hard to navigate", "choosing between them is confusing", "some have a live connector and some need middleware" — all forbidden. That is doubt manufactured from facts we do not hold, it is the one thing a provider could write in and dispute, and the first person who replies is exactly the person who will catch it.
- Never invent a count, a ranking, a price or a named provider's capability.
- Never claim a comparison, shortlist or document already exists unless the brief says it does. Offer to prepare it: "I will work out which of the 42 can do that and send you the list", not "I have already been through all 42 for you".

11. THE ASK
- Exactly one thing, as the last line of the body before the sign-off. At most one question mark in the whole email.
- It must be answerable in one line, by email, from a phone, with no meeting, no form and no commitment. Never ask for a call, a demo, fifteen minutes or a slot in their diary.
- Two forms work. A plain question: "Which system do you raise invoices in?" Or a conditional offer: "If you tell me X, I will come back with Y." The conditional offer is usually the better of the two, because it gives before it asks.
- Ask for something you genuinely need because the answer changes what you would send: invoice volume, the system invoices are raised in, which entity does the invoicing, who handles finance systems.
- Never a vague binary ("Which would you rather?"), never "would you be interested", "does that sound of interest", "let me know if you have any questions", "looking forward to hearing from you".
- Never put a qualifying or softening sentence after the ask. The ask is the last thing.

12. FOLLOW-UPS
- Refer to the earlier letter once, in half a sentence, without reproach. Never count how long it has been unless you actually know. Never "just following up", "circling back", "bumping this", "in case you missed it", and never mention that they did not reply.
- Add one genuinely new and useful thing they did not have, drawn only from the published facts — a distinction between two of the dates, what sits in the gap between appointing and going live, that voluntary adoption opened on 1 July 2026. Never restate the first email's argument. If you have nothing new, the follow-up should not be written.
- Give before you ask. The follow-up is the touch where replies actually happen; it should be the more useful of the two letters, not the more insistent.
- It must still contain one answerable question, and separately an explicit way out: "if you would rather I did not write again, tell me and I will stop." An easy no on its own is not enough — a letter whose only possible reply is a refusal will get silence instead.
- Never send a third variation of the same argument.

13. THE CLOSE
End with a courteous valediction on its own line and nothing after it: "Kind regards," is the default; "With kind regards," and "Best regards," are the only permitted alternatives. Never "Cheers", "Thanks!", "Warm wishes", "Regards" bare, "Yours faithfully", or a dash and a name.

14. CHECK BEFORE RETURNING THE DRAFT
- Is there a greeting on its own line, and a sign-off?
- Could this be sent to the next company on the list by changing one noun? If yes, it has failed. Rewrite it.
- Does the company's name appear in the body, and one specific detail that is not part of that name?
- Does any sentence tell the reader something about their own business that they already know? Cut it.
- Is any fact in it decoration? Apply the deletion test to each one.
- Does it give a real published date rather than "soon", and does the mandate content stay under 45 words?
- Does it say once, plainly, that we are independent, free, and paid by providers only when a business asks to be introduced?
- Does any sentence predict that something bad will happen to them? Delete it.
- Is there exactly one thing to reply to, and is it the last line?
${step > 0 ? "\n\nThis is a follow-up to an unanswered email. Do not repeat the first letter. Add one distinction they did not have, and give them an explicit way to stop hearing from you." : ""}
Respond with ONLY JSON: {"subject": "...", "body": "..."}`;
}

interface Draft {
  subject: string;
  body: string;
  /** Set when the draft failed the personalisation check and must not auto-send. */
  needsReview?: string;
}

function fallbackDraft(prospect: Prospect, config: AgentConfig, step: number): Draft {
  const name = prospect.name;
  // The appointment deadline, not the go-live date: it lands months earlier and
  // is the one thing the recipient still has to act on.
  const deadline = appointmentDeadlineFor(prospect.mandateWave);
  if (step === 0) {
    return {
      subject: `E-invoicing provider shortlist for ${name}`,
      body: `Hello,\n\nUnder the UAE e-invoicing mandate, businesses like ${name} need an accredited service provider appointed by ${deadline}, and invoices then have to be issued through that provider.\n\nWe maintain the full directory of accredited providers and put together free shortlists. ${config.offerCta}, and we will send back the three that fit ${name} best.\n\nIf this is not your area, please point me to whoever handles finance systems.`,
    };
  }
  return {
    subject: `Re: E-invoicing provider shortlist for ${name}`,
    body: `Hello,\n\nFollowing up briefly. The full list of accredited providers is free to browse at ${absoluteUrl("/providers")} — no signup needed.\n\nIf ${name} already has a provider lined up, tell me and I will close this off.`,
  };
}

/** "Mohammed Al Rashid" -> "Mohammed". Blank if we have nothing usable. */
export function firstName(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  // Titles and role words are not names and must never be used as one.
  if (!/^[\p{L}'-]{2,40}$/u.test(first)) return null;
  if (/^(mr|mrs|ms|dr|eng|sheikh|hh|the|team|sales|info|admin|contact|support)$/i.test(first)) {
    return null;
  }
  return first;
}

/**
 * Re-render the HTML body once the row exists.
 *
 * The open pixel and the click redirect both key off trackToken, which is
 * generated by the insert, so the tracked HTML cannot be built before the row
 * is there. One extra write per message, and it happens before the send.
 */
async function applyTracking(messageId: string, trackToken: string, bodyText: string) {
  await db
    .update(outreachMessages)
    .set({ bodyHtml: textToHtml(bodyText, trackToken) })
    .where(eq(outreachMessages.id, messageId));
}

/** Open a thread and draft the first touch for one qualified prospect. */
export const startSequence: AgentHandler = async (task, ctx) => {
  const { prospectId } = task.payload as { prospectId: string };
  const config = await getAgentConfig();

  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!prospect) return { itemsIn: 0, itemsOut: 0, summary: { reason: "prospect gone" } };

  const [existing] = await db
    .select({ id: outreachThreads.id })
    .from(outreachThreads)
    .where(eq(outreachThreads.prospectId, prospectId))
    .limit(1);
  if (existing) return { itemsIn: 1, itemsOut: 0, summary: { reason: "already sequenced" } };

  // Only addresses whose domain resolved to a live MX record. "risky" means
  // the DNS lookup failed or timed out, and mailing those is a large part of
  // how a 6.4% bounce rate happens — which is the number that gets a sending
  // account suspended, taking transactional mail down with it.
  const [contact] = await db
    .select()
    .from(prospectContacts)
    .where(
      and(
        eq(prospectContacts.prospectId, prospectId),
        eq(prospectContacts.verification, "mx_ok"),
      ),
    )
    .orderBy(asc(prospectContacts.priority))
    .limit(1);
  if (!contact) return { itemsIn: 1, itemsOut: 0, summary: { reason: "no contact" } };
  if (await isSuppressed(contact.email)) {
    await db
      .update(prospects)
      .set({ status: "suppressed", updatedAt: new Date() })
      .where(eq(prospects.id, prospectId));
    return { itemsIn: 1, itemsOut: 0, summary: { reason: "suppressed" } };
  }

  const [thread] = await db
    .insert(outreachThreads)
    .values({
      prospectId,
      contactId: contact.id,
      campaign: "prospect-outreach",
      toEmail: contact.email,
      status: "active",
      stepIndex: 0,
    })
    .returning();

  const draft = await writeDraft(
    prospect,
    config,
    0,
    ctx,
    firstName(contact.name),
    contact.role,
  );
  if (!draft) {
    // No personalised draft, and a generic first touch is not worth sending.
    // Retry later: the enrich pass may yet fill in what we are missing.
    await enqueue({
      agent: "conversationalist",
      kind: "start_sequence",
      payload: { prospectId },
      runAfter: new Date(Date.now() + 6 * 60 * 60 * 1000),
      dedupeKey: `sequence-retry:${prospectId}`,
      priority: 60,
    });
    await db.delete(outreachThreads).where(eq(outreachThreads.id, thread.id));
    ctx.log(`no personalised draft for ${prospect.name} — retrying later, nothing sent`);
    return { itemsIn: 1, itemsOut: 0, summary: { reason: "no personalised draft" } };
  }
  await queueOutbound(thread, draft, 0, config);

  ctx.log(`sequence opened for ${prospect.name} → ${contact.email}`);
  return { itemsIn: 1, itemsOut: 1, summary: { threadId: thread.id, to: contact.email } };
};

/** Everything we know about this company, laid out for the writer. */
function prospectBrief(
  prospect: Prospect,
  contactName: string | null,
  step: number,
  contactRole: string | null = null,
): string {
  const partner = isPartnerSector(prospect.sector);
  const profile = (prospect.profile ?? null) as ProspectProfile | null;
  const lines = [
    `Company: ${prospect.name}`,
    `Website: ${prospect.website ?? "unknown"}`,
    `Emirate: ${prospect.emirate ?? "UAE"}`,
    `Sector (from search, may be crude): ${prospect.sector ?? "unknown"}`,
    `Estimated size: ${prospect.sizeHint ?? "unknown"}`,
    `Likely mandate wave: ${prospect.mandateWave ?? "unknown"}`,
    contactName ? `Contact first name: ${contactName}` : "Contact name: not known",
    // Their job decides what they care about: a finance lead hears "penalties
    // and the appointment deadline", an IT lead hears "integration".
    contactRole ? `Their role: ${contactRole}` : "Their role: not known",
  ];
  if (profile) {
    lines.push("", "Facts taken from their own website:");
    if (profile.whatTheyDo) lines.push(`- What they do: ${profile.whatTheyDo}`);
    if (profile.sectorsServed.length) lines.push(`- Sectors they serve: ${profile.sectorsServed.join(", ")}`);
    if (profile.locations.length) lines.push(`- Locations: ${profile.locations.join(", ")}`);
    if (profile.systems.length) lines.push(`- Systems they run: ${profile.systems.join(", ")}`);
    if (profile.notable.length) lines.push(`- Notable: ${profile.notable.join("; ")}`);
  } else {
    lines.push("", "We could not read their website. Keep it short and do not pretend to know them.");
  }
  lines.push("", audienceRules(partner));
  lines.push("", step > 0 ? `This is follow-up number ${step}.` : "This is the first contact.");
  return lines.join("\n");
}

/**
 * Openings that read back the recipient's own website.
 *
 * Every email in the first live batch began this way — "You provide ERP
 * implementation and serve commercial, government and industrial clients in
 * Fujairah" — because the personalisation check below demanded proof we had
 * looked. To the reader it is not proof of care, it is a machine reciting
 * their About page, and it was the single most robotic tell in the copy.
 */
const RECITAL_OPENERS =
  /^\s*(dear[^\n]*\n+)?\s*(you (provide|deliver|design|operate|serve|run|offer|specialise|handle|manage|supply)|with \d+\+? years|as (a|an|the) (leading|established|prominent|award))/i;

/**
 * Invented anxiety. The published dates are the only pressure available, and
 * a stranger predicting a professional's failure is advertising, not help.
 */
const MANUFACTURED_URGENCY =
  /\b(you may struggle|you risk missing|wait too long|waiting too long|delaying leaves|you might not have the answer|before it'?s too late|don'?t get caught|time is running out|without a current answer|act now|last chance)\b/i;

/**
 * An email that says outright we could not learn much about them. Honest, and
 * the right letter to send when the crawl came back empty.
 */
const ADMITS_THIN =
  /\b(could not (learn|find|tell)|couldn'?t (learn|find|tell)|i do not know|i don'?t know|not going to pretend|cannot tell you whether|can'?t tell you whether)\b/i;

/** The tells of a template: an opening that would fit any company at all. */
const GENERIC_OPENERS =
  /\b(dear (sir|madam|sir\/madam|business owner|team)|to whom it may concern|i hope (this|you)|as a (leading|prominent|reputable|well[- ]known)|in today'?s (fast[- ]paced|digital|competitive))/i;

/**
 * Does this draft prove we actually looked at them?
 *
 * The company name alone does not count — a mail merge produces that. We
 * require a second, harder-won detail: something from their site, their
 * emirate, or the contact's own name. A draft that cannot clear this is not
 * sent; it goes to a human instead.
 */
export function personalisationEvidence(
  body: string,
  prospect: { name: string; emirate?: string | null; profile?: unknown },
  contactName: string | null,
  step = 0,
): { ok: boolean; reason?: string } {
  const text = body.toLowerCase();
  if (GENERIC_OPENERS.test(body)) return { ok: false, reason: "generic opener" };
  // A greeting is now required, and it is the first thing the owner objected
  // to. "Dear Rashid," and "Dear Gulf Marine Agencies team," both qualify;
  // starting mid-assertion does not.
  if (!/^\s*dear\s+\S/i.test(body)) return { ok: false, reason: "no greeting" };
  if (RECITAL_OPENERS.test(body)) return { ok: false, reason: "opens by reciting their business" };
  if (MANUFACTURED_URGENCY.test(body)) return { ok: false, reason: "manufactured urgency" };
  if (!text.includes(prospect.name.toLowerCase().split(/\s+/)[0] ?? "")) {
    return { ok: false, reason: "does not name the company" };
  }

  // Saying plainly that we could not learn much is a legitimate email and the
  // honest one to send when the crawl found nothing. Demanding a specific
  // detail regardless is what taught the writer to recite the recipient's own
  // website back at them; an email that admits the gap must not be forced to
  // manufacture one.
  if (ADMITS_THIN.test(body)) return { ok: true };

  // A follow-up is a continuation, not a fresh introduction. The first letter
  // carried the company-specific argument; demanding a new one every time is
  // what produces a second email that says the same thing in other words. The
  // greeting, recital and urgency bans above still apply to every message.
  if (step > 0) return { ok: true };

  const profile = (prospect.profile ?? null) as ProspectProfile | null;
  const specifics: string[] = [];
  if (contactName) specifics.push(contactName);
  if (prospect.emirate) specifics.push(prospect.emirate.replace(/-/g, " "));
  if (profile) {
    specifics.push(
      ...profile.sectorsServed,
      ...profile.locations,
      ...profile.systems,
      ...profile.notable,
    );
    // Match on the meaningful words of the description, not the whole clause.
    if (profile.whatTheyDo) {
      specifics.push(
        ...profile.whatTheyDo.split(/[^a-zA-Z]+/).filter((w) => w.length > 4),
      );
    }
  }
  // A term that already appears in the company's own name proves nothing —
  // "Gulf Freight Systems" trivially contains "freight". Only a detail the
  // name does not hand us for free counts as evidence we actually looked.
  const companyName = prospect.name.toLowerCase();
  const hit = specifics.some((s) => {
    const needle = s?.toLowerCase().slice(0, 40);
    return needle && !companyName.includes(needle) && text.includes(needle);
  });
  return hit ? { ok: true } : { ok: false, reason: "no company-specific detail" };
}

async function writeDraft(
  prospect: Prospect,
  config: AgentConfig,
  step: number,
  ctx: { addTokens: (n: number, model?: string) => void; log?: (m: string) => void },
  contactName: string | null = null,
  contactRole: string | null = null,
): Promise<Draft | null> {
  const result = await chat(
    [
      { role: "system", content: systemPrompt(config, step) },
      { role: "user", content: prospectBrief(prospect, contactName, step, contactRole) },
    ],
    { temperature: 0.4, maxTokens: 700, job: "email" },
  );
  if (result) {
    ctx.addTokens(result.totalTokens, result.model);
    const parsed = extractJson<Draft>(result.text);
    if (parsed?.subject && parsed?.body) {
      const draft = {
        subject: parsed.subject.slice(0, 180),
        body: parsed.body.slice(0, 4000),
      };
      const evidence = personalisationEvidence(draft.body, prospect, contactName, step);
      if (evidence.ok) return draft;
      ctx.log?.(`draft for ${prospect.name} rejected: ${evidence.reason}`);
      return { ...draft, needsReview: evidence.reason };
    }
  }
  // A follow-up may safely fall back to the plain template — the recipient has
  // already had the personalised first touch. A first contact may not: sending
  // a merge-field email is worse than sending nothing, so it goes to a human.
  return step > 0 ? fallbackDraft(prospect, config, step) : null;
}

async function queueOutbound(
  thread: OutreachThread,
  draft: Draft,
  step: number,
  config: AgentConfig,
): Promise<string> {
  // Approval mode decides whether this can send unattended — but a draft that
  // failed the personalisation check never sends unattended, whatever the mode.
  const autoSend =
    !draft.needsReview &&
    (config.outreachApprovalMode === "auto" ||
      (config.outreachApprovalMode === "first_touch" && thread.agent === "conversationalist"));
  const bodyText = appendSignature(draft.body, config, thread.token);

  const [row] = await db
    .insert(outreachMessages)
    .values({
      threadId: thread.id,
      direction: "outbound",
      status: autoSend ? "scheduled" : "pending_approval",
      stepIndex: step,
      subject: draft.subject,
      bodyRaw: draft.body,
      bodyText,
      bodyHtml: textToHtml(bodyText),
      toEmail: thread.toEmail,
      scheduledFor: new Date(),
    })
    .returning({ id: outreachMessages.id, trackToken: outreachMessages.trackToken });

  await applyTracking(row.id, row.trackToken, bodyText);

  await db
    .update(outreachThreads)
    .set({ subject: thread.subject ?? draft.subject, stepIndex: step, updatedAt: new Date() })
    .where(eq(outreachThreads.id, thread.id));

  if (autoSend) {
    await enqueue({
      agent: "conversationalist",
      kind: "send_message",
      payload: { messageId: row.id },
      dedupeKey: `send:${row.id}`,
      priority: 50,
    });
  }
  return row.id;
}

/** Send one approved/scheduled message, respecting caps and suppression. */
export const sendMessage: AgentHandler = async (task, ctx) => {
  const { messageId } = task.payload as { messageId: string };
  const outcome = await sendOutreachMessage(messageId);
  if (!outcome.sent && outcome.reason === "daily cap reached") {
    // Not a failure — try again after the cap resets.
    await enqueue({
      agent: "conversationalist",
      kind: "send_message",
      payload: { messageId },
      runAfter: new Date(Date.now() + 6 * 60 * 60 * 1000),
      dedupeKey: `send:${messageId}:capretry`,
      priority: 40,
    });
  }
  ctx.log(outcome.sent ? `sent ${messageId}` : `held ${messageId}: ${outcome.reason}`);
  return {
    itemsIn: 1,
    itemsOut: outcome.sent ? 1 : 0,
    summary: { sent: outcome.sent, reason: outcome.reason },
  };
};

const CLASSIFY_SYSTEM = `You classify replies to a B2B email offering a free shortlist of UAE accredited e-invoicing providers.

Classify the reply into exactly one intent:
- interested: they want the shortlist, ask about providers/pricing, or share requirements.
- question: they ask something about the mandate or about us, without committing.
- referral: they point to a different person or department.
- not_now: interested later, currently busy, or already evaluating.
- not_interested: a clear no, or they already have a provider.
- unsubscribe: they ask to stop being contacted, in any wording ("stop", "remove me", "لا ترسل").
- auto_reply: out-of-office, delivery notification, or other machine-generated mail.
- hostile: complaint, legal threat, or accusation of spam.

Also extract, when present: contact_name, company_name, phone, invoice_volume, accounting_software.

Respond with ONLY JSON: {"intent": "...", "confidence": 0-1, "contact_name": null, "company_name": null, "phone": null, "invoice_volume": null, "accounting_software": null, "summary": "one short sentence"}`;

interface Classification {
  intent: string;
  confidence: number;
  contact_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  invoice_volume?: string | null;
  accounting_software?: string | null;
  summary?: string;
}

/** Read an inbound reply, then answer it, convert it, or stand down. */
export const handleReply: AgentHandler = async (task, ctx) => {
  const { threadId, messageId } = task.payload as { threadId: string; messageId: string };
  const config = await getAgentConfig();

  const [row] = await db
    .select({ message: outreachMessages, thread: outreachThreads })
    .from(outreachMessages)
    .innerJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
    .where(eq(outreachMessages.id, messageId))
    .limit(1);
  if (!row) return { itemsIn: 0, itemsOut: 0, summary: { reason: "message gone" } };
  const { message, thread } = row;

  const prospect = thread.prospectId
    ? (
        await db.select().from(prospects).where(eq(prospects.id, thread.prospectId)).limit(1)
      )[0]
    : null;

  let classification: Classification | null = null;
  const result = await chat(
    [
      { role: "system", content: CLASSIFY_SYSTEM },
      {
        role: "user",
        content: `From: ${message.fromEmail}\nCompany (known): ${prospect?.name ?? "unknown"}\nSubject: ${message.subject ?? ""}\n\n${message.bodyText.slice(0, 4000)}`,
      },
    ],
    { temperature: 0, maxTokens: 500, job: "classify" },
  );
  if (result) {
    ctx.addTokens(result.totalTokens, result.model);
    classification = extractJson<Classification>(result.text);
  }

  const intent = classification?.intent ?? keywordIntent(message.bodyText);

  await db
    .update(outreachMessages)
    .set({ aiMeta: { classification, intent } })
    .where(eq(outreachMessages.id, message.id));

  if (intent === "unsubscribe" || intent === "hostile") {
    const { suppress } = await import("../mailer");
    // Suppress BOTH the address that replied and the address the sequence
    // targets. Someone behind a shared mailbox replies from their own account,
    // so suppressing only the sender leaves the mailbox that said stop fully
    // mailable — and suppress() closes live threads by toEmail, so passing it
    // is also what stops any queued follow-up.
    for (const address of new Set(
      [message.fromEmail, thread.toEmail].filter(Boolean) as string[],
    )) {
      await suppress(address, "unsubscribe", `reply: ${intent}`);
    }
    await notifySales(
      `Opt-out from ${prospect?.name ?? thread.toEmail}`,
      `${thread.toEmail} asked to stop being contacted (${intent}). They are now permanently suppressed.\n\n---\n${message.bodyText.slice(0, 1000)}`,
    );
    ctx.log(`opt-out: ${thread.toEmail}`);
    return { itemsIn: 1, itemsOut: 0, summary: { intent } };
  }

  if (intent === "auto_reply") {
    // Put the thread back to waiting; an OOO is not a reply.
    await db
      .update(outreachThreads)
      .set({
        status: "awaiting_reply",
        nextActionAt: new Date(Date.now() + 3 * 86_400_000),
        updatedAt: new Date(),
      })
      .where(eq(outreachThreads.id, thread.id));
    return { itemsIn: 1, itemsOut: 0, summary: { intent } };
  }

  if (intent === "not_interested") {
    await db
      .update(outreachThreads)
      .set({ status: "closed", nextActionAt: null, updatedAt: new Date() })
      .where(eq(outreachThreads.id, thread.id));
    if (thread.prospectId) {
      await db
        .update(prospects)
        .set({ status: "rejected", scoreReason: "declined by reply", updatedAt: new Date() })
        .where(eq(prospects.id, thread.prospectId));
    }
    return { itemsIn: 1, itemsOut: 0, summary: { intent } };
  }

  // Interested → create a real CRM lead so sales owns it from here.
  if (intent === "interested" && !thread.leadId) {
    const leadId = await convertToLead(thread, prospect, classification, message.fromEmail);
    if (leadId) {
      await db
        .update(outreachThreads)
        .set({ status: "converted", leadId, nextActionAt: null, updatedAt: new Date() })
        .where(eq(outreachThreads.id, thread.id));
      if (thread.prospectId) {
        await db
          .update(prospects)
          .set({ status: "converted", leadId, updatedAt: new Date() })
          .where(eq(prospects.id, thread.prospectId));
      }
      await notifySales(
        `Agent lead: ${classification?.company_name ?? prospect?.name ?? thread.toEmail}`,
        `The outreach agent converted a reply into a lead.\n\nIntent: ${intent}\nSummary: ${classification?.summary ?? "—"}\n\nReply:\n${message.bodyText.slice(0, 1500)}\n\nOpen in CRM: ${absoluteUrl(`/admin/leads/${leadId}`)}`,
      );
    }
  }

  // Draft a human-sounding answer for approval (or auto-send in "auto" mode).
  const draft = await writeReply(thread, prospect, message.bodyText, intent, config, ctx);
  const bodyText = appendSignature(draft.body, config, thread.token);
  const autoSend = config.outreachApprovalMode === "auto";

  const [drafted] = await db
    .insert(outreachMessages)
    .values({
      threadId: thread.id,
      direction: "outbound",
      status: autoSend ? "scheduled" : "pending_approval",
      subject: draft.subject || `Re: ${thread.subject ?? "your enquiry"}`,
      bodyRaw: draft.body,
      bodyText,
      bodyHtml: textToHtml(bodyText),
      toEmail: thread.toEmail,
      inReplyTo: message.messageId,
      scheduledFor: new Date(),
      aiMeta: { intent, replyTo: message.id },
    })
    .returning({ id: outreachMessages.id, trackToken: outreachMessages.trackToken });

  await applyTracking(drafted.id, drafted.trackToken, bodyText);

  if (autoSend) {
    await enqueue({
      agent: "conversationalist",
      kind: "send_message",
      payload: { messageId: drafted.id },
      dedupeKey: `send:${drafted.id}`,
      priority: 20,
    });
  }

  ctx.log(`reply from ${thread.toEmail} classified ${intent}, response drafted`);
  return { itemsIn: 1, itemsOut: 1, summary: { intent, autoSend } };
};

/**
 * Fallback used when the AI classifier is unavailable. It errs heavily towards
 * catching opt-outs: a missed "stop" is a compliance failure, while a
 * misclassified question merely waits for a human.
 */
export function keywordIntent(body: string): string {
  const lower = body.toLowerCase();
  if (
    /\b(unsubscribe|un-subscribe|stop|remove me|remove us|take me off|take us off|opt out|opt-out|do not contact|don't contact|no longer wish|not interested)\b/.test(
      lower,
    ) ||
    /(إلغاء الاشتراك|توقف عن|لا ترسل|أزلني|إزالة)/.test(lower)
  ) {
    return "unsubscribe";
  }
  if (
    /out of (the )?office|automatic reply|auto-reply|autoreply|on annual leave|currently away|delivery status notification|undeliverable/.test(
      lower,
    )
  ) {
    return "auto_reply";
  }
  return "question";
}

async function writeReply(
  thread: OutreachThread,
  prospect: Prospect | null,
  replyText: string,
  intent: string,
  config: AgentConfig,
  ctx: { addTokens: (n: number, model?: string) => void },
): Promise<Draft> {
  const history = await db
    .select({
      direction: outreachMessages.direction,
      body: outreachMessages.bodyText,
      createdAt: outreachMessages.createdAt,
    })
    .from(outreachMessages)
    .where(eq(outreachMessages.threadId, thread.id))
    .orderBy(asc(outreachMessages.createdAt))
    .limit(10);

  const transcript = history
    .map((h) => `${h.direction === "outbound" ? "US" : "THEM"}: ${h.body.slice(0, 800)}`)
    .join("\n\n");

  const result = await chat(
    [
      {
        role: "system",
        content: `${systemPrompt(config, 1)}

You are now replying inside an existing conversation. The classified intent of their last message is "${intent}".
- interested: confirm the next step and ask only for invoice volume and accounting software if not already given. Mention a colleague will follow up.
- question: answer only from the verified facts. If you do not know, say so and offer to check.
- referral: thank them, ask for the right person's name and email.
- not_now: agree a specific later date, keep it to two sentences.
Keep it under 80 words.`,
      },
      {
        role: "user",
        content: `Company: ${prospect?.name ?? "unknown"}\n\nConversation so far:\n${transcript}\n\nTheir latest message:\n${replyText.slice(0, 2000)}`,
      },
    ],
    { temperature: 0.4, maxTokens: 600, job: "email" },
  );
  if (result) {
    ctx.addTokens(result.totalTokens, result.model);
    const parsed = extractJson<Draft>(result.text);
    if (parsed?.body) {
      return {
        subject: parsed.subject || `Re: ${thread.subject ?? "your enquiry"}`,
        body: parsed.body,
      };
    }
  }
  return {
    subject: `Re: ${thread.subject ?? "your enquiry"}`,
    body: `Thank you for coming back to me.\n\nSo I can send the right shortlist, could you tell me roughly how many invoices you issue a month and which accounting system you use?\n\nThe full accredited provider list is always free at ${absoluteUrl("/providers")}.`,
  };
}

async function convertToLead(
  thread: OutreachThread,
  prospect: Prospect | null,
  classification: Classification | null,
  fromEmail: string | null,
): Promise<string | null> {
  const email = (fromEmail ?? thread.toEmail).toLowerCase();
  const [lead] = await db
    .insert(leads)
    .values({
      fullName: classification?.contact_name?.slice(0, 120) || "(from email reply)",
      companyName:
        classification?.company_name?.slice(0, 160) || prospect?.name || email.split("@")[1],
      email,
      // Phone is required on leads; outreach replies rarely include one.
      phone: classification?.phone?.slice(0, 40) || "",
      emirate: prospect?.emirate ?? null,
      invoiceVolume: classification?.invoice_volume?.slice(0, 60) ?? null,
      accountingSoftware: classification?.accounting_software?.slice(0, 120) ?? null,
      message: classification?.summary?.slice(0, 500) ?? null,
      source: "agent-outreach",
      locale: "en",
      consentAt: new Date(),
    })
    .returning({ id: leads.id });
  if (!lead) return null;

  await db.insert(leadActivities).values({
    leadId: lead.id,
    type: "created",
    body: `Created by the outreach agent from an email reply (${email}).`,
    meta: { threadId: thread.id, prospectId: thread.prospectId },
  });
  return lead.id;
}

async function notifySales(subject: string, body: string): Promise<void> {
  const to = await getSalesNotifyEmails();
  if (!to.length) return;
  await sendEmail({
    to,
    subject: `[Agent] ${subject}`,
    text: body,
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`,
  });
}

/** Follow up on threads that went quiet, then close them out politely. */
export const tick: AgentHandler = async (_task, ctx) => {
  const config = await getAgentConfig();
  const budget = await remainingSendsToday(config);
  if (budget <= 0) return { itemsIn: 0, itemsOut: 0, summary: { reason: "daily cap reached" } };

  const staleAfter = new Date(Date.now() - config.outreachStepDelayDays * 86_400_000);
  const due = await db
    .select({ thread: outreachThreads, prospect: prospects })
    .from(outreachThreads)
    .leftJoin(prospects, eq(outreachThreads.prospectId, prospects.id))
    .where(
      and(
        eq(outreachThreads.status, "awaiting_reply"),
        // Only this agent's own sequences — link-outreach threads belong to
        // Visibility and must never receive a prospecting follow-up.
        eq(outreachThreads.agent, "conversationalist"),
        isNotNull(outreachThreads.lastOutboundAt),
        lte(outreachThreads.lastOutboundAt, staleAfter),
        sql`${outreachThreads.stepIndex} < ${config.outreachMaxFollowUps}`,
      ),
    )
    .orderBy(asc(outreachThreads.lastOutboundAt))
    .limit(Math.min(budget, 25));

  let queued = 0;
  for (const { thread, prospect } of due) {
    if (await isSuppressed(thread.toEmail)) continue;
    const step = thread.stepIndex + 1;
    const contactName = thread.contactId
      ? firstName(
          (
            await db
              .select({ name: prospectContacts.name })
              .from(prospectContacts)
              .where(eq(prospectContacts.id, thread.contactId))
              .limit(1)
          )[0]?.name,
        )
      : null;
    const draft = prospect
      ? await writeDraft(prospect, config, step, ctx, contactName)
      : {
          subject: `Re: ${thread.subject ?? "e-invoicing providers"}`,
          body: `Just following up in case this slipped through. The accredited provider directory is free at ${absoluteUrl("/providers")} — happy to send a shortlist if useful.`,
        };
    // writeDraft only returns null for a first touch, which this never is.
    if (!draft) continue;
    await queueOutbound(thread, draft, step, config);
    queued += 1;
  }

  // Threads that used up their follow-ups stop bothering people.
  const closed = await db
    .update(outreachThreads)
    .set({ status: "closed", nextActionAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(outreachThreads.status, "awaiting_reply"),
        lte(outreachThreads.lastOutboundAt, staleAfter),
        sql`${outreachThreads.stepIndex} >= ${config.outreachMaxFollowUps}`,
      ),
    )
    .returning({ id: outreachThreads.id });

  ctx.log(`follow-ups queued: ${queued}, threads closed: ${closed.length}`);
  return { itemsIn: due.length, itemsOut: queued, summary: { queued, closed: closed.length } };
};

/** Drain messages a human approved in the console. */
export const flushApproved: AgentHandler = async (_task, ctx) => {
  const rows = await db
    .select({ id: outreachMessages.id })
    .from(outreachMessages)
    .where(
      and(
        eq(outreachMessages.direction, "outbound"),
        isNotNull(outreachMessages.approvedAt),
        sql`${outreachMessages.status} IN ('pending_approval','scheduled')`,
      ),
    )
    .orderBy(desc(outreachMessages.approvedAt))
    .limit(50);

  let sent = 0;
  for (const row of rows) {
    const outcome = await sendOutreachMessage(row.id);
    if (outcome.sent) sent += 1;
    else if (outcome.reason === "daily cap reached") break;
  }
  ctx.log(`flushed ${sent}/${rows.length} approved messages`);
  return { itemsIn: rows.length, itemsOut: sent, summary: { sent } };
};


/**
 * Seed one conversation against an address you control, and send it.
 *
 * The inbound leg — reply arrives, gets matched to its thread, gets classified,
 * gets answered — is the only part of the pipeline that cannot be proven
 * without a real round trip. A raw SES send will not do it: with no thread and
 * no Message-ID to reference, an inbound reply has nothing to match against and
 * is dropped. So this creates a genuine prospect, contact, thread and outbound
 * message, and sends through the normal mailer.
 *
 * Not a bypass. It routes through sendOutreachMessage, so the suppression list,
 * the daily cap and the warm-up ramp all still apply. It only skips the
 * approval queue, because an operator invoking this job by name IS the
 * approval — and it refuses any address not given explicitly.
 */
export const testConversation: AgentHandler = async (task, ctx) => {
  const payload = task.payload as {
    email?: string;
    companyName?: string;
    website?: string;
    contactName?: string;
  };
  const config = await getAgentConfig();
  const email = normalizeEmail(String(payload.email ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
    return { itemsIn: 0, itemsOut: 0, summary: { reason: "a valid email is required" } };
  }
  if (await isSuppressed(email)) {
    return { itemsIn: 1, itemsOut: 0, summary: { reason: "address is suppressed" } };
  }

  const name = String(payload.companyName ?? "Test Company").slice(0, 200);
  const website = payload.website ? String(payload.website).slice(0, 300) : null;

  // Reuse the prospect on a repeat run rather than accumulating duplicates.
  const [existing] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.name, name))
    .limit(1);

  let prospectId: string;
  if (existing) {
    prospectId = existing.id;
  } else {
    const [created] = await db
      .insert(prospects)
      .values({
        name,
        website,
        domain: website ? website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : null,
        emirate: "dubai",
        sector: "test",
        status: "contactable",
        source: "test",
      })
      .returning({ id: prospects.id });
    prospectId = created.id;
  }

  await db
    .insert(prospectContacts)
    .values({
      prospectId,
      email,
      name: payload.contactName ?? null,
      verification: "mx_ok",
      verifiedAt: new Date(),
      priority: 0,
    })
    .onConflictDoNothing();

  // A fresh thread every run, so each test is its own conversation.
  const [thread] = await db
    .insert(outreachThreads)
    .values({
      prospectId,
      campaign: "test",
      toEmail: email,
      status: "active",
      stepIndex: 0,
    })
    .returning();

  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);

  const draft =
    (await writeDraft(prospect, config, 0, ctx, firstName(payload.contactName))) ??
    fallbackDraft(prospect, config, 0);
  const bodyText = appendSignature(draft.body, config, thread.token);

  const [row] = await db
    .insert(outreachMessages)
    .values({
      threadId: thread.id,
      direction: "outbound",
      status: "scheduled",
      stepIndex: 0,
      subject: draft.subject,
      bodyRaw: draft.body,
      bodyText,
      bodyHtml: textToHtml(bodyText),
      toEmail: email,
      scheduledFor: new Date(),
    })
    .returning({ id: outreachMessages.id, trackToken: outreachMessages.trackToken });

  await applyTracking(row.id, row.trackToken, bodyText);

  const outcome = await sendOutreachMessage(row.id);
  await db
    .update(outreachThreads)
    .set({
      status: outcome.sent ? "awaiting_reply" : "active",
      lastOutboundAt: outcome.sent ? new Date() : null,
      subject: draft.subject,
      updatedAt: new Date(),
    })
    .where(eq(outreachThreads.id, thread.id));

  ctx.log(
    `test conversation → ${email}: ${outcome.sent ? "sent" : `not sent (${outcome.reason})`}`,
  );
  return {
    itemsIn: 1,
    itemsOut: outcome.sent ? 1 : 0,
    summary: {
      to: email,
      sent: outcome.sent,
      reason: outcome.reason ?? null,
      threadId: thread.id,
      subject: draft.subject,
      personalised: !draft.needsReview,
    },
  };
};

/**
 * Bring drafts written under the old rules up to the current ones.
 *
 * A draft is a snapshot of whatever the writer and the wrapper were doing on
 * the day it was made. Rules have since changed — emails now open with a name,
 * carry a link to a personalised page, and are tracked — but a message already
 * sitting in the approval queue still holds the old text and would send it.
 *
 * `bodyRaw` is the marker: nothing written before the split has it. For each
 * stale message this rewrites the body with the current writer, which now has
 * the contact's name and role to work with. Two rules keep it safe:
 *
 * - Approval never survives a rewrite. A human approved specific words; new
 *   words need a new approval, so the row goes back to pending_approval.
 * - A message that cannot be rewritten is held rather than sent. It is still
 *   stale, and a generic email going out unattended is the thing we are trying
 *   to stop, so it waits for a person instead.
 */
export const redraftStale: AgentHandler = async (_task, ctx) => {
  const config = await getAgentConfig();
  const stale = await db
    .select({ message: outreachMessages, thread: outreachThreads, prospect: prospects })
    .from(outreachMessages)
    .innerJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
    .leftJoin(prospects, eq(outreachThreads.prospectId, prospects.id))
    .where(
      and(
        eq(outreachMessages.direction, "outbound"),
        sql`${outreachMessages.bodyRaw} is null`,
        // Sent and in-flight messages are history — only what has not left yet
        // can still be fixed.
        sql`${outreachMessages.status} IN ('draft','pending_approval','scheduled')`,
      ),
    )
    .orderBy(asc(outreachMessages.createdAt))
    .limit(25);

  if (!stale.length) {
    ctx.log("no stale drafts left");
    return { itemsIn: 0, itemsOut: 0, summary: { rewritten: 0, held: 0 } };
  }

  let rewritten = 0;
  let held = 0;

  for (const { message, thread, prospect } of stale) {
    const [contact] = thread.contactId
      ? await db
          .select({ name: prospectContacts.name, role: prospectContacts.role })
          .from(prospectContacts)
          .where(eq(prospectContacts.id, thread.contactId))
          .limit(1)
      : [];

    const draft = prospect
      ? await writeDraft(
          prospect,
          config,
          message.stepIndex ?? 0,
          ctx,
          firstName(contact?.name),
          contact?.role ?? null,
        )
      : null;

    if (!draft) {
      await db
        .update(outreachMessages)
        .set({
          status: "pending_approval",
          approvedAt: null,
          approvedBy: null,
          error: "written before the current rules and could not be rewritten — review before sending",
        })
        .where(eq(outreachMessages.id, message.id));
      held += 1;
      continue;
    }

    const bodyText = appendSignature(draft.body, config, thread.token);
    await db
      .update(outreachMessages)
      .set({
        subject: draft.subject,
        bodyRaw: draft.body,
        bodyText,
        bodyHtml: textToHtml(bodyText, message.trackToken),
        status: "pending_approval",
        approvedAt: null,
        approvedBy: null,
        error: draft.needsReview ?? null,
      })
      .where(eq(outreachMessages.id, message.id));
    rewritten += 1;
  }

  // More to do: come back for the next batch rather than doing it all at once,
  // since each rewrite costs a model call.
  if (stale.length === 25) {
    await enqueue({
      agent: "conversationalist",
      kind: "redraft_stale",
      runAfter: new Date(Date.now() + 60_000),
      dedupeKey: `redraft-stale:${Date.now()}`,
      priority: 90,
    });
  }

  ctx.log(`rewrote ${rewritten} stale draft(s), held ${held} for review`);
  return {
    itemsIn: stale.length,
    itemsOut: rewritten,
    summary: { rewritten, held, moreQueued: stale.length === 25 },
  };
};

export const conversationalistHandlers: Record<string, AgentHandler> = {
  start_sequence: startSequence,
  send_message: sendMessage,
  handle_reply: handleReply,
  tick,
  flush_approved: flushApproved,
  test_conversation: testConversation,
  redraft_stale: redraftStale,
};
