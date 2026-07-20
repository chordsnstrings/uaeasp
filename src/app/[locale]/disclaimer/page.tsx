import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";

export const revalidate = 86400;

const CONTENT: Record<Locale, string[]> = {
  en: [
    "This website is an independent, privately operated directory and comparison service. It is not affiliated with, endorsed by, sponsored by, or connected to the United Arab Emirates Ministry of Finance, the Federal Tax Authority, or any other government entity.",
    "The list of pre-approved e-invoicing service providers shown on this site is compiled from official and public sources and refreshed regularly, with the last update date shown in the footer. However, the authoritative list is the one published by the UAE Ministry of Finance. Always verify a provider's current accreditation status with the Ministry before entering into any agreement.",
    "The information on this site is provided for general guidance only and does not constitute legal, tax, or professional advice. E-invoicing regulations, timelines and requirements may change. You should obtain advice from a qualified professional for your specific circumstances.",
    "Our matching service introduces businesses to e-invoicing service providers based on the requirements they share with us. We may receive a commission or referral fee from service providers if an introduction leads to a contract. This does not affect the price you pay, and matches are made based on fit with your stated requirements.",
    "All product names, logos and trademarks mentioned on this site are the property of their respective owners and are used for identification purposes only.",
  ],
  ar: [
    "هذا الموقع دليل مستقل وخدمة مقارنة تُدار من جهة خاصة. وهو غير تابع لوزارة المالية في دولة الإمارات العربية المتحدة أو الهيئة الاتحادية للضرائب أو أي جهة حكومية أخرى، وليس معتمداً أو مدعوماً أو مرتبطاً بها.",
    "قائمة مزودي خدمات الفوترة الإلكترونية المعتمدين مبدئياً المعروضة في هذا الموقع مجمّعة من مصادر رسمية وعامة ويتم تحديثها بانتظام، مع عرض تاريخ آخر تحديث في أسفل الصفحة. غير أن القائمة المرجعية هي القائمة المنشورة من وزارة المالية الإماراتية. تحقق دائماً من حالة اعتماد أي مزود لدى الوزارة قبل إبرام أي اتفاق.",
    "المعلومات في هذا الموقع مقدمة للإرشاد العام فقط ولا تشكل استشارة قانونية أو ضريبية أو مهنية. قد تتغير لوائح الفوترة الإلكترونية ومواعيدها ومتطلباتها. احصل على استشارة من مختص مؤهل لظروفك الخاصة.",
    "تقوم خدمة الترشيح لدينا بتعريف الشركات على مزودي خدمات الفوترة الإلكترونية وفق المتطلبات التي تشاركها معنا. قد نحصل على عمولة أو رسوم إحالة من المزودين إذا أدى التعريف إلى تعاقد. لا يؤثر ذلك على السعر الذي تدفعه، وتتم الترشيحات على أساس الملاءمة لمتطلباتك المعلنة.",
    "جميع أسماء المنتجات والشعارات والعلامات التجارية المذكورة في هذا الموقع ملك لأصحابها وتُستخدم لأغراض التعريف فقط.",
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "disclaimer" });
  return pageMetadata({
    locale,
    path: "/disclaimer",
    title: t("metaTitle"),
    description: t("metaTitle"),
  });
}

export default async function DisclaimerPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("disclaimer");

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">{t("title")}</h1>
      <div className="mt-6 space-y-5 leading-relaxed text-ink-700">
        {CONTENT[locale].map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
