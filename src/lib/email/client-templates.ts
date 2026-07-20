import type { Lead } from "@/db/schema";
import { SITE_NAME, SITE_URL, localePath } from "@/lib/site";

/** Confirmation email to the client, in their language, with tracking link. */
export function leadConfirmationEmail(lead: Lead): {
  subject: string;
  html: string;
  text: string;
} {
  const locale = (lead.locale === "ar" ? "ar" : "en") as "ar" | "en";
  const trackUrl = `${SITE_URL}${localePath(locale, `/track/${lead.trackingToken}`)}`;

  const copy =
    locale === "ar"
      ? {
          subject: `تم استلام طلبك — ${SITE_NAME}`,
          greeting: `مرحباً ${lead.fullName}،`,
          body: `تم استلام طلب شركة ${lead.companyName} للحصول على ترشيح مزود فوترة إلكترونية. سيتواصل معك مختص من فريقنا خلال يوم عمل واحد.`,
          track: "يمكنك متابعة حالة طلبك في أي وقت عبر رابط التتبع الخاص بك:",
          button: "تتبع طلبي",
          note: "احتفظ بهذه الرسالة — الرابط خاص بطلبك.",
          dir: "rtl" as const,
        }
      : {
          subject: `We received your request — ${SITE_NAME}`,
          greeting: `Hello ${lead.fullName},`,
          body: `Your request for ${lead.companyName} to be matched with an e-invoicing provider has been received. A specialist from our team will get back to you within one business day.`,
          track: "You can follow the status of your request anytime via your private tracking link:",
          button: "Track my request",
          note: "Keep this email — the link is private to your request.",
          dir: "ltr" as const,
        };

  const html = `
  <div dir="${copy.dir}" style="font-family:ui-sans-serif,system-ui,'Segoe UI',Tahoma,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="color:#0f766e;margin:0 0 16px">${SITE_NAME}</h2>
    <p style="color:#0f172a">${copy.greeting}</p>
    <p style="color:#334155;line-height:1.7">${copy.body}</p>
    <p style="color:#334155;line-height:1.7">${copy.track}</p>
    <a href="${trackUrl}" style="display:inline-block;margin-top:8px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px">${copy.button}</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">${copy.note}</p>
  </div>`;

  const text = `${copy.greeting}\n\n${copy.body}\n\n${copy.track}\n${trackUrl}\n\n${copy.note}`;

  return { subject: copy.subject, html, text };
}
