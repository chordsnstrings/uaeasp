import type { Locale } from "@/lib/site";

export interface IntegrationSystem {
  key: string;
  name: string;
  tier: "enterprise" | "sme" | "custom";
}

export const INTEGRATION_SYSTEMS: IntegrationSystem[] = [
  { key: "sap", name: "SAP (ECC / S/4HANA)", tier: "enterprise" },
  { key: "oracle", name: "Oracle (EBS / Fusion / NetSuite)", tier: "enterprise" },
  { key: "dynamics", name: "Microsoft Dynamics 365", tier: "enterprise" },
  { key: "tally", name: "Tally", tier: "sme" },
  { key: "zoho", name: "Zoho Books", tier: "sme" },
  { key: "odoo", name: "Odoo", tier: "sme" },
  { key: "quickbooks", name: "QuickBooks", tier: "sme" },
  { key: "sage", name: "Sage", tier: "sme" },
  { key: "xero", name: "Xero", tier: "sme" },
  { key: "custom", name: "Custom / in-house systems", tier: "custom" },
  { key: "spreadsheets", name: "Spreadsheets & manual invoicing", tier: "custom" },
  { key: "pos", name: "POS & e-commerce platforms", tier: "custom" },
];

export interface IntegrationCopy {
  blurb: string;
  route: string;
  timeline: string;
}

export const INTEGRATION_COPY: Record<Locale, Record<string, IntegrationCopy>> = {
  en: {
    sap: {
      blurb:
        "Several pre-approved ASPs maintain packaged SAP connectors and have run large ZATCA (Saudi) SAP rollouts. The critical question is proven support for your exact version and customisations — ask for reference clients on ECC or S/4HANA to match yours.",
      route: "Packaged connector or SAP middleware (PI/PO, BTP); custom IDoc/API mapping for heavily customised estates.",
      timeline: "3–6 months including data cleanup, mapping and UAT",
    },
    oracle: {
      blurb:
        "Oracle E-Business Suite, Fusion Cloud and NetSuite are all supported by multiple enterprise-focused ASPs. NetSuite typically integrates fastest via SuiteApp-style connectors; EBS integrations lean on middleware.",
      route: "Vendor connector, Oracle Integration Cloud, or API integration against the ASP's endpoints.",
      timeline: "3–6 months for EBS/Fusion; 6–10 weeks for NetSuite",
    },
    dynamics: {
      blurb:
        "Dynamics 365 Finance & Operations and Business Central both have connector coverage among the pre-approved list, often via Microsoft AppSource packages or the provider's own extension.",
      route: "AppSource extension or provider connector; Power Platform / API for custom flows.",
      timeline: "2–4 months depending on customisation",
    },
    tally: {
      blurb:
        "Tally is one of the most common SME systems in the UAE — and Tally itself appears on the pre-approved provider list, alongside other ASPs offering Tally connectors. If you run Tally, you have genuinely easy options.",
      route: "Native (Tally as ASP) or lightweight connector syncing invoices to the ASP.",
      timeline: "2–6 weeks",
    },
    zoho: {
      blurb:
        "Zoho is itself on the pre-approved list, and Zoho Books users can expect the most integrated path. Other ASPs also read from Zoho's APIs if you prefer separating your ASP from your accounting vendor.",
      route: "Native within Zoho ecosystem, or API-based sync to a third-party ASP.",
      timeline: "1–4 weeks",
    },
    odoo: {
      blurb:
        "Odoo's open architecture makes it one of the easier mid-market integrations: providers ship Odoo modules, and Odoo partners in the UAE routinely bundle e-invoicing setup with implementations.",
      route: "Odoo module from the ASP or API integration via Odoo's REST framework.",
      timeline: "2–6 weeks",
    },
    quickbooks: {
      blurb:
        "QuickBooks Online integrates through app-store connectors offered by several ASPs. Desktop editions are harder — most providers route them through file upload or portal entry.",
      route: "QBO app connector; portal/CSV route for desktop editions.",
      timeline: "1–4 weeks (Online); longer for desktop",
    },
    sage: {
      blurb:
        "Sage 50/200/X3 users will find connector support among ASPs with strong GCC practices; X3 behaves like a mid-market ERP project, while Sage 50 is closer to the SME connector pattern.",
      route: "Provider connector for X3; API or file-based sync for smaller editions.",
      timeline: "2–8 weeks by edition",
    },
    xero: {
      blurb:
        "Xero's API ecosystem means several ASPs offer app-marketplace connectors. Confirm UAE-specific field mapping (TRN, VAT categories) is production-ready, as Xero's UAE footprint is newer than its global one.",
      route: "Marketplace app connector or API sync.",
      timeline: "1–4 weeks",
    },
    custom: {
      blurb:
        "In-house billing systems integrate through the ASP's API. The differentiator between providers here is documentation quality, sandbox availability and webhook support for delivery status — evaluate all three before signing.",
      route: "Direct REST API integration built by your team or the provider's professional services.",
      timeline: "1–3 months depending on your development capacity",
    },
    spreadsheets: {
      blurb:
        "If you invoice from Excel or Word today, you can comply via an ASP portal (manual entry or CSV upload) — workable at low volume. Many businesses use the mandate as the moment to adopt a proper accounting app, which makes every other row on this page available to them.",
      route: "ASP web portal entry or structured CSV/Excel upload.",
      timeline: "Days to set up; ongoing manual effort per invoice",
    },
    pos: {
      blurb:
        "Retail and e-commerce invoices (in-scope B2B portions) route through the same ASP APIs; several providers offer high-volume APIs designed for POS transaction streams and marketplace order feeds, including the e-commerce transaction flag PINT AE requires.",
      route: "High-volume API or batch integration from your POS/e-commerce backend.",
      timeline: "1–3 months for transaction-stream integrations",
    },
  },
  ar: {
    sap: {
      blurb:
        "يحتفظ عدد من المزودين المعتمدين مبدئياً بموصلات SAP جاهزة وسبق لهم تنفيذ مشاريع كبرى على SAP ضمن نظام «فاتورة» السعودي. السؤال الحاسم هو الدعم المثبت لإصدارك وتخصيصاتك تحديداً — اطلب عملاء مرجعيين على ECC أو S/4HANA بما يطابق بيئتك.",
      route: "موصل جاهز أو وسيط SAP (PI/PO أو BTP)؛ وربط IDoc/API مخصص للبيئات كثيفة التخصيص.",
      timeline: "3–6 أشهر شاملة تنظيف البيانات والربط والاختبار",
    },
    oracle: {
      blurb:
        "تحظى أنظمة Oracle E-Business Suite وFusion Cloud وNetSuite بدعم عدة مزودين موجهين للمؤسسات. يتكامل NetSuite عادة أسرع عبر موصلات على نمط SuiteApp، بينما تعتمد تكاملات EBS على الوسيط.",
      route: "موصل من المزود، أو Oracle Integration Cloud، أو ربط برمجي مباشر بواجهات المزود.",
      timeline: "3–6 أشهر لـ EBS/Fusion؛ و6–10 أسابيع لـ NetSuite",
    },
    dynamics: {
      blurb:
        "يتوفر لكل من Dynamics 365 Finance & Operations وBusiness Central تغطية موصلات لدى مزودين معتمدين، غالباً عبر حزم Microsoft AppSource أو امتداد المزود الخاص.",
      route: "امتداد AppSource أو موصل المزود؛ وPower Platform / API للتدفقات المخصصة.",
      timeline: "2–4 أشهر بحسب التخصيص",
    },
    tally: {
      blurb:
        "Tally من أكثر أنظمة الشركات الصغيرة انتشاراً في الإمارات — وتظهر Tally نفسها على قائمة المزودين المعتمدين مبدئياً، إلى جانب مزودين آخرين يقدمون موصلات لها. إن كنت تستخدم Tally فخياراتك سهلة فعلاً.",
      route: "مسار أصلي (Tally كمزود) أو موصل خفيف يزامن الفواتير مع المزود.",
      timeline: "2–6 أسابيع",
    },
    zoho: {
      blurb:
        "Zoho نفسها على القائمة المعتمدة مبدئياً، ويمكن لمستخدمي Zoho Books توقع المسار الأكثر تكاملاً. كما تقرأ مزودات أخرى من واجهات Zoho إن فضّلت فصل مزود الفوترة عن مورد المحاسبة.",
      route: "مسار أصلي داخل منظومة Zoho، أو مزامنة برمجية مع مزود خارجي.",
      timeline: "1–4 أسابيع",
    },
    odoo: {
      blurb:
        "بنية Odoo المفتوحة تجعله من أسهل تكاملات السوق المتوسطة: يطرح المزودون وحدات Odoo جاهزة، ويضمّن شركاء Odoo في الإمارات إعداد الفوترة الإلكترونية في مشاريع التطبيق عادة.",
      route: "وحدة Odoo من المزود أو ربط برمجي عبر إطار REST في Odoo.",
      timeline: "2–6 أسابيع",
    },
    quickbooks: {
      blurb:
        "يتكامل QuickBooks Online عبر موصلات متجر التطبيقات لدى عدة مزودين. النسخ المكتبية أصعب — ويوجهها معظم المزودين عبر رفع الملفات أو الإدخال في البوابة.",
      route: "موصل QBO؛ ومسار البوابة/CSV للنسخ المكتبية.",
      timeline: "1–4 أسابيع (Online)؛ وأطول للنسخ المكتبية",
    },
    sage: {
      blurb:
        "سيجد مستخدمو Sage 50/200/X3 دعم موصلات لدى مزودين ذوي حضور خليجي قوي؛ يتصرف X3 كمشروع ERP متوسط، بينما يقترب Sage 50 من نمط موصلات الشركات الصغيرة.",
      route: "موصل المزود لـ X3؛ ومزامنة برمجية أو ملفية للإصدارات الأصغر.",
      timeline: "2–8 أسابيع بحسب الإصدار",
    },
    xero: {
      blurb:
        "منظومة Xero البرمجية تتيح لعدة مزودين موصلات عبر متجر التطبيقات. تأكد أن ربط الحقول الإماراتية (رقم التسجيل الضريبي وفئات الضريبة) جاهز للإنتاج، فحضور Xero الإماراتي أحدث من حضورها العالمي.",
      route: "موصل متجر التطبيقات أو مزامنة برمجية.",
      timeline: "1–4 أسابيع",
    },
    custom: {
      blurb:
        "تتكامل أنظمة الفوترة الداخلية عبر الواجهة البرمجية للمزود. والفارق بين المزودين هنا هو جودة التوثيق وتوافر بيئة تجريبية ودعم Webhooks لحالة التسليم — قيّم الثلاثة قبل التوقيع.",
      route: "ربط REST مباشر يبنيه فريقك أو خدمات المزود الاحترافية.",
      timeline: "1–3 أشهر بحسب قدرتكم التطويرية",
    },
    spreadsheets: {
      blurb:
        "إن كنت تفوتر اليوم من Excel أو Word فيمكنك الامتثال عبر بوابة المزود (إدخال يدوي أو رفع CSV) — وهو مجدٍ للأحجام الصغيرة. وتتخذ شركات كثيرة الإلزام لحظةً لاعتماد تطبيق محاسبي حقيقي، ما يفتح أمامها كل خيارات هذه الصفحة.",
      route: "إدخال عبر بوابة المزود أو رفع ملفات CSV/Excel منظمة.",
      timeline: "أيام للإعداد؛ مع جهد يدوي مستمر لكل فاتورة",
    },
    pos: {
      blurb:
        "تمر فواتير التجزئة والتجارة الإلكترونية (الأجزاء المشمولة B2B) عبر واجهات المزود نفسها؛ ويقدم عدة مزودين واجهات عالية الحجم مصممة لتدفقات معاملات نقاط البيع وطلبات المتاجر، بما يشمل علامة معاملات التجارة الإلكترونية التي تتطلبها PINT AE.",
      route: "واجهة عالية الحجم أو تكامل دفعات من خلفية نقاط البيع/المتجر.",
      timeline: "1–3 أشهر لتكاملات تدفق المعاملات",
    },
  },
};
