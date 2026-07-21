import type { Locale } from "@/lib/site";
import { MOF_SOURCE_URL } from "@/lib/site";

export interface ResourceLink {
  title: string;
  description: string;
  href: string;
  external: boolean;
}

export interface ResourceGroup {
  title: string;
  items: ResourceLink[];
}

export const resourcesContent: Record<Locale, ResourceGroup[]> = {
  en: [
    {
      title: "Official sources",
      items: [
        {
          title: "MoF: Pre-approved e-invoicing service providers",
          description:
            "The Ministry of Finance's official list of pre-approved ASPs — the source this directory tracks every night.",
          href: MOF_SOURCE_URL,
          external: true,
        },
        {
          title: "MoF: E-invoicing programme",
          description:
            "The Ministry of Finance's e-invoicing initiative hub: announcements, FAQ and programme documents.",
          href: "https://mof.gov.ae/en/about-us/initiatives/einvoicing/",
          external: true,
        },
        {
          title: "Federal Tax Authority",
          description:
            "The FTA is the fifth corner of the UAE model, receiving tax data on every exchanged invoice.",
          href: "https://tax.gov.ae/en/",
          external: true,
        },
        {
          title: "OpenPeppol: PINT billing model",
          description:
            "The international Peppol PINT specification that PINT AE specialises for the UAE.",
          href: "https://docs.peppol.eu/poac/pint/pint/",
          external: true,
        },
      ],
    },
    {
      title: "Key legislation & decisions",
      items: [
        {
          title: "Ministerial Decision No. 64 of 2025",
          description: "Accreditation framework for e-invoicing service providers — the rules ASPs are approved under.",
          href: "https://mof.gov.ae/en/about-us/initiatives/einvoicing/",
          external: true,
        },
        {
          title: "Ministerial Decision No. 243 of 2025",
          description: "Establishes the Electronic Invoicing System and its operating requirements.",
          href: "https://mof.gov.ae/en/about-us/initiatives/einvoicing/",
          external: true,
        },
        {
          title: "Ministerial Decision No. 244 of 2025",
          description: "The phased implementation timeline: appointment deadlines and go-live dates by phase (as amended).",
          href: "https://mof.gov.ae/en/about-us/initiatives/einvoicing/",
          external: true,
        },
        {
          title: "Cabinet Decision No. 106 of 2025",
          description: "Administrative penalties for e-invoicing non-compliance — the amounts our penalty calculator models.",
          href: "https://mof.gov.ae/en/about-us/initiatives/einvoicing/",
          external: true,
        },
      ],
    },
    {
      title: "Free tools on this site",
      items: [
        { title: "Penalty calculator", description: "Model your AED exposure under Cabinet Decision 106/2025.", href: "/toolkit/penalty-calculator", external: false },
        { title: "Readiness planner", description: "A dated, backwards-planned milestone schedule for your phase.", href: "/toolkit/readiness-planner", external: false },
        { title: "Compliance checklist", description: "Every step from scoping to go-live, savable in your browser.", href: "/toolkit/checklist", external: false },
        { title: "Readiness assessment", description: "Five questions, instant score, personalised next steps.", href: "/assessment", external: false },
        { title: "PINT AE field reference", description: "Searchable reference of all 88 invoice fields, document type codes and transaction flags.", href: "/resources/pint-ae-reference", external: false },
        { title: "E-invoicing glossary", description: "18 key terms — ASP, PINT AE, Peppol, EmaraTax and more — in plain language.", href: "/resources/glossary", external: false },
      ],
    },
    {
      title: "Directory",
      items: [
        { title: "All pre-approved providers", description: "Browse and filter every provider on the official list.", href: "/providers", external: false },
        { title: "Official registry with contacts", description: "The full MoF table with contact persons, emails and phones.", href: "/registry", external: false },
        { title: "Get matched free", description: "Tell us your requirements — we shortlist providers that fit.", href: "/get-matched", external: false },
      ],
    },
  ],
  ar: [
    {
      title: "المصادر الرسمية",
      items: [
        {
          title: "وزارة المالية: مزودو خدمات الفوترة الإلكترونية المعتمدون مبدئياً",
          description: "قائمة وزارة المالية الرسمية للمزودين المعتمدين مبدئياً — المصدر الذي يتابعه هذا الدليل كل ليلة.",
          href: MOF_SOURCE_URL,
          external: true,
        },
        {
          title: "وزارة المالية: برنامج الفوترة الإلكترونية",
          description: "صفحة مبادرة الفوترة الإلكترونية: الإعلانات والأسئلة الشائعة ووثائق البرنامج.",
          href: "https://mof.gov.ae/ar/about-us/initiatives/einvoicing/",
          external: true,
        },
        {
          title: "الهيئة الاتحادية للضرائب",
          description: "الهيئة هي الزاوية الخامسة في النموذج الإماراتي وتتلقى البيانات الضريبية لكل فاتورة متبادلة.",
          href: "https://tax.gov.ae/ar/",
          external: true,
        },
        {
          title: "OpenPeppol: نموذج فوترة PINT",
          description: "مواصفة Peppol الدولية التي تخصصها PINT AE للإمارات.",
          href: "https://docs.peppol.eu/poac/pint/pint/",
          external: true,
        },
      ],
    },
    {
      title: "التشريعات والقرارات الرئيسية",
      items: [
        {
          title: "القرار الوزاري رقم 64 لسنة 2025",
          description: "إطار اعتماد مزودي خدمات الفوترة الإلكترونية — القواعد التي يُعتمد المزودون بموجبها.",
          href: "https://mof.gov.ae/ar/about-us/initiatives/einvoicing/",
          external: true,
        },
        {
          title: "القرار الوزاري رقم 243 لسنة 2025",
          description: "ينشئ نظام الفوترة الإلكترونية ومتطلبات تشغيله.",
          href: "https://mof.gov.ae/ar/about-us/initiatives/einvoicing/",
          external: true,
        },
        {
          title: "القرار الوزاري رقم 244 لسنة 2025",
          description: "الجدول الزمني المرحلي للتطبيق: مواعيد التعيين والتشغيل لكل مرحلة (بصيغته المعدلة).",
          href: "https://mof.gov.ae/ar/about-us/initiatives/einvoicing/",
          external: true,
        },
        {
          title: "قرار مجلس الوزراء رقم 106 لسنة 2025",
          description: "الغرامات الإدارية لعدم الامتثال للفوترة الإلكترونية — المبالغ التي تحسبها حاسبتنا.",
          href: "https://mof.gov.ae/ar/about-us/initiatives/einvoicing/",
          external: true,
        },
      ],
    },
    {
      title: "أدوات مجانية على هذا الموقع",
      items: [
        { title: "حاسبة الغرامات", description: "قدّر تعرّضك بالدرهم بموجب قرار مجلس الوزراء 106 لسنة 2025.", href: "/toolkit/penalty-calculator", external: false },
        { title: "مخطط الجاهزية", description: "جدول معالم مؤرخ ومخطط عكسياً لمرحلتك.", href: "/toolkit/readiness-planner", external: false },
        { title: "قائمة تحقق الامتثال", description: "كل خطوة من تحديد النطاق إلى التشغيل، تُحفظ في متصفحك.", href: "/toolkit/checklist", external: false },
        { title: "تقييم الجاهزية", description: "خمسة أسئلة ونتيجة فورية وخطوات تالية مخصصة.", href: "/assessment", external: false },
        { title: "مرجع حقول PINT AE", description: "مرجع قابل للبحث لكل حقول الفاتورة الـ88 ورموز أنواع المستندات وأعلام المعاملات.", href: "/resources/pint-ae-reference", external: false },
        { title: "معجم الفوترة الإلكترونية", description: "18 مصطلحاً رئيسياً — ASP وPINT AE وPeppol وإمارات تاكس وغيرها — بلغة واضحة.", href: "/resources/glossary", external: false },
      ],
    },
    {
      title: "الدليل",
      items: [
        { title: "جميع المزودين المعتمدين مبدئياً", description: "تصفح وصفِّ كل مزود على القائمة الرسمية.", href: "/providers", external: false },
        { title: "السجل الرسمي مع بيانات التواصل", description: "جدول وزارة المالية الكامل بأسماء التواصل والبريد والهواتف.", href: "/registry", external: false },
        { title: "المطابقة المجانية", description: "أخبرنا بمتطلباتك — ونرشح لك المزودين الأنسب.", href: "/get-matched", external: false },
      ],
    },
  ],
};
