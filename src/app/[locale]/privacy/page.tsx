import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import type { Locale } from "@/lib/site";

export const revalidate = 86400;

const CONTENT: Record<Locale, { heading: string; paragraphs: string[] }[]> = {
  en: [
    {
      heading: "What we collect",
      paragraphs: [
        "When you submit our contact or matching form, we collect the details you provide: your full name, company name, work email, phone number, emirate, and any optional information about your invoice volumes, software, budget and timeline.",
        "We also collect limited technical information needed to protect the service (such as a pseudonymised identifier derived from your network address, used for spam prevention) and standard analytics about how the site is used.",
      ],
    },
    {
      heading: "How we use your information",
      paragraphs: [
        "We use your details for one purpose: to match your business with suitable e-invoicing service providers and to contact you about that request. Our team may share your requirements with a shortlisted service provider so they can prepare a relevant proposal — that is the service you are requesting when you submit the form.",
        "We do not sell your personal data, and we do not use it for unrelated marketing without your consent.",
      ],
    },
    {
      heading: "Legal basis and consent",
      paragraphs: [
        "We process your information on the basis of your consent, given when you tick the consent box on the form, in line with UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL). You can withdraw consent at any time by contacting us, and we will stop processing and delete your details unless we are required to keep them.",
      ],
    },
    {
      heading: "Retention and your rights",
      paragraphs: [
        "We keep lead information only as long as needed to handle your request and for a reasonable follow-up period. You have the right to access, correct or delete your personal data, and to object to or restrict its processing. To exercise any of these rights, contact us using the details on this site.",
      ],
    },
    {
      heading: "Cookies and analytics",
      paragraphs: [
        "The site uses privacy-friendly, cookieless analytics to understand aggregate usage. We do not use advertising trackers.",
      ],
    },
  ],
  ar: [
    {
      heading: "ما الذي نجمعه",
      paragraphs: [
        "عند إرسال نموذج التواصل أو الترشيح، نجمع البيانات التي تقدمها: الاسم الكامل واسم الشركة والبريد الإلكتروني للعمل ورقم الهاتف والإمارة، وأي معلومات اختيارية عن حجم الفواتير والبرامج والميزانية والإطار الزمني.",
        "كما نجمع معلومات تقنية محدودة لحماية الخدمة (مثل معرّف مجهول الهوية مشتق من عنوان الشبكة لمنع الرسائل المزعجة) وتحليلات قياسية عن استخدام الموقع.",
      ],
    },
    {
      heading: "كيف نستخدم معلوماتك",
      paragraphs: [
        "نستخدم بياناتك لغرض واحد: مطابقة شركتك مع مزودي خدمات الفوترة الإلكترونية المناسبين والتواصل معك بشأن طلبك. قد يشارك فريقنا متطلباتك مع مزود مرشح ليقدم عرضاً مناسباً — وهذه هي الخدمة التي تطلبها عند إرسال النموذج.",
        "لا نبيع بياناتك الشخصية ولا نستخدمها لأغراض تسويقية أخرى دون موافقتك.",
      ],
    },
    {
      heading: "الأساس القانوني والموافقة",
      paragraphs: [
        "نعالج معلوماتك على أساس موافقتك التي تمنحها عند تحديد خانة الموافقة في النموذج، بما يتوافق مع المرسوم بقانون اتحادي رقم 45 لسنة 2021 بشأن حماية البيانات الشخصية. يمكنك سحب موافقتك في أي وقت بالتواصل معنا، وسنتوقف عن المعالجة ونحذف بياناتك ما لم يكن الاحتفاظ بها مطلوباً قانوناً.",
      ],
    },
    {
      heading: "الاحتفاظ وحقوقك",
      paragraphs: [
        "نحتفظ بمعلومات الطلبات فقط للمدة اللازمة لمعالجة طلبك ولفترة متابعة معقولة. لك الحق في الوصول إلى بياناتك الشخصية وتصحيحها وحذفها والاعتراض على معالجتها أو تقييدها. لممارسة أي من هذه الحقوق تواصل معنا عبر بيانات الاتصال في الموقع.",
      ],
    },
    {
      heading: "ملفات تعريف الارتباط والتحليلات",
      paragraphs: [
        "يستخدم الموقع تحليلات صديقة للخصوصية بدون ملفات تعريف ارتباط لفهم الاستخدام الإجمالي. لا نستخدم أدوات تتبع إعلانية.",
      ],
    },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return pageMetadata({
    locale,
    path: "/privacy",
    title: t("metaTitle"),
    description: t("metaTitle"),
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");
  const sections = CONTENT[locale];

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">{t("title")}</h1>
      {sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-xl font-bold text-ink-900">{section.heading}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="mt-3 leading-relaxed text-ink-700">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
