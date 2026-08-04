import type { Locale } from "@/lib/site";

export interface IntegrationSystem {
  key: string;
  name: string;
  tier: "enterprise" | "sme" | "custom";
}

export const INTEGRATION_SYSTEMS: IntegrationSystem[] = [
  { key: "sap", name: "SAP (ECC / S/4HANA)", tier: "enterprise" },
  { key: "oracle", name: "Oracle (E-Business Suite / Fusion)", tier: "enterprise" },
  // Split out of the Oracle bundle: Search Console shows 143 impressions in 28
  // days for NetSuite integration queries in the UAE and nothing on this site
  // targeting them. A system with its own demand needs its own page.
  { key: "netsuite", name: "Oracle NetSuite", tier: "enterprise" },
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

/**
 * The extra copy a system's own page needs, beyond its card on the hub.
 *
 * The hub page puts all twelve systems on one URL, which is why it ranks for
 * none of them — the same failure /providers has against generic phrases.
 * A page per system targets one question, the way a provider profile targets
 * one name, and those rank 5-8.
 */
export interface IntegrationPageCopy {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  /** Terms to look for in a provider's own description. Evidence, not claims. */
  match: string[];
  faq: { q: string; a: string }[];
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
        "Oracle E-Business Suite and Fusion Cloud are both supported by multiple enterprise-focused ASPs. EBS integrations lean on middleware; Fusion has more direct API options.",
      route: "Vendor connector, Oracle Integration Cloud, or API integration against the ASP's endpoints.",
      timeline: "3–6 months for EBS/Fusion",
    },
    netsuite: {
      blurb:
        "NetSuite is usually the fastest enterprise ERP to connect, because SuiteApp-style connectors and SuiteTalk REST let a provider read invoice data without middleware. The work is normally mapping your NetSuite invoice records to PINT AE fields rather than building transport.",
      route: "SuiteApp connector, SuiteTalk REST/SOAP, or SuiteScript posting to the ASP's API.",
      timeline: "6–10 weeks including field mapping and UAT",
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
        "تحظى أنظمة Oracle E-Business Suite وFusion Cloud بدعم عدة مزودين موجهين للمؤسسات. تعتمد تكاملات EBS على الوسيط، بينما يوفر Fusion خيارات ربط مباشرة أكثر.",
      route: "موصل من المزود، أو Oracle Integration Cloud، أو ربط برمجي مباشر بواجهات المزود.",
      timeline: "3–6 أشهر لـ EBS/Fusion",
    },
    netsuite: {
      blurb:
        "يُعد NetSuite عادةً أسرع أنظمة تخطيط الموارد المؤسسية في الربط، إذ تتيح الموصلات على نمط SuiteApp وواجهات SuiteTalk REST للمزود قراءة بيانات الفواتير دون وسيط. العمل الأساسي هو مطابقة حقول فواتير NetSuite مع حقول PINT AE، لا بناء قناة النقل.",
      route: "موصل SuiteApp، أو SuiteTalk REST/SOAP، أو SuiteScript يرسل إلى واجهة المزود.",
      timeline: "6–10 أسابيع تشمل مطابقة الحقول واختبار القبول",
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

/**
 * Per-system page copy.
 *
 * `match` holds the terms we look for in a provider's own description. Nothing
 * on the page claims a provider supports a system — it reports that the
 * provider says so, and links to the profile so the reader can check. The
 * distinction matters: we are a directory, and an invented integration claim
 * would be worse than an empty list.
 */
export const INTEGRATION_PAGES: Record<Locale, Record<string, IntegrationPageCopy>> = {
  en: {
    netsuite: {
      metaTitle: "NetSuite E-Invoicing in the UAE — Accredited Providers & Integration",
      metaDescription:
        "How Oracle NetSuite connects to UAE e-invoicing: SuiteApp connectors, SuiteTalk REST, PINT AE field mapping and realistic timelines. Which accredited providers name NetSuite.",
      h1: "NetSuite e-invoicing in the UAE",
      intro:
        "If you run Oracle NetSuite in the UAE, your invoices will have to leave through a Ministry of Finance accredited service provider once your phase begins. NetSuite is generally the least painful enterprise ERP to connect, but the work is not zero and it is not the transport layer — it is getting your invoice records to line up with the PINT AE fields the Ministry expects.",
      match: ["netsuite", "suiteapp", "suitetalk"],
      faq: [
        {
          q: "Does NetSuite handle UAE e-invoicing on its own?",
          a: "No. NetSuite can produce the invoice, but under the UAE mandate the invoice has to be transmitted through an accredited service provider on the Peppol network in PINT AE format. NetSuite is the source system; the provider is the channel.",
        },
        {
          q: "How long does a NetSuite e-invoicing integration take?",
          a: "Typically six to ten weeks, most of which is mapping NetSuite invoice records to PINT AE fields and user acceptance testing rather than building the connection itself. Heavily customised NetSuite accounts take longer.",
        },
        {
          q: "How does a provider connect to NetSuite?",
          a: "Usually a SuiteApp-style connector installed in your account, SuiteTalk REST or SOAP calls, or a SuiteScript that posts invoices to the provider's API. Which one you get depends on the provider, so ask before you sign.",
        },
      ],
    },
    sap: {
      metaTitle: "SAP E-Invoicing in the UAE — Accredited Providers & Integration Routes",
      metaDescription:
        "Connecting SAP ECC or S/4HANA to UAE e-invoicing: packaged connectors, PI/PO and BTP middleware, IDoc mapping, and which accredited providers name SAP.",
      h1: "SAP e-invoicing in the UAE",
      intro:
        "SAP estates are the most involved integrations on this list, and the most worth getting right first time. Several accredited providers maintain packaged SAP connectors and have run large ZATCA rollouts in Saudi Arabia — the question worth asking is not whether they support SAP, but whether they have done your exact version with your customisations.",
      match: ["sap", "s/4hana", "s4hana", "ecc"],
      faq: [
        {
          q: "Can SAP send UAE e-invoices without a provider?",
          a: "No. SAP can generate and format the invoice, but the mandate requires transmission through an accredited service provider using PINT AE over Peppol. SAP Document Compliance still needs an accredited channel at the UAE end.",
        },
        {
          q: "How long does an SAP e-invoicing project take?",
          a: "Three to six months is normal once data cleanup, field mapping and UAT are included. A heavily customised ECC estate can run longer; a clean S/4HANA implementation can be faster.",
        },
        {
          q: "What should I ask an SAP-capable provider for?",
          a: "Reference clients on your specific version, whether the connector is packaged or bespoke, and who owns the middleware. Ask before you shortlist, not after.",
        },
      ],
    },
    tally: {
      metaTitle: "Tally E-Invoicing in the UAE — Accredited Providers & How It Connects",
      metaDescription:
        "How Tally connects to UAE e-invoicing under the Ministry of Finance mandate, what the integration involves, realistic timelines, and which accredited providers name Tally.",
      h1: "Tally e-invoicing in the UAE",
      intro:
        "Tally is one of the most widely used accounting systems among UAE SMEs, which makes it one of the most commonly asked-about integrations. It is also one of the quicker ones: most providers offering Tally support do it through a connector or TDL extension rather than a bespoke build.",
      match: ["tally"],
      faq: [
        {
          q: "Will Tally support UAE e-invoicing directly?",
          a: "Tally can produce the invoice, but it still has to be transmitted through a Ministry of Finance accredited service provider in PINT AE format. Check with your provider which Tally releases their connector supports.",
        },
        {
          q: "How quickly can Tally be connected?",
          a: "Often a few weeks, since most Tally integrations use an existing connector or TDL extension rather than a bespoke build. Confirm the timeline with the provider against your own Tally version.",
        },
      ],
    },
    zoho: {
      metaTitle: "Zoho Books E-Invoicing in the UAE — Accredited Providers & Integration",
      metaDescription:
        "How Zoho Books connects to UAE e-invoicing, what the mandate requires, and which Ministry of Finance accredited providers name Zoho in their own description.",
      h1: "Zoho Books e-invoicing in the UAE",
      intro:
        "Zoho Books is common among UAE small businesses and generally straightforward to connect, usually through the provider's API or an existing Zoho marketplace extension. As with every system on this list, Zoho produces the invoice but an accredited provider has to carry it.",
      match: ["zoho"],
      faq: [
        {
          q: "Does Zoho Books handle UAE e-invoicing by itself?",
          a: "No. Under the mandate the invoice has to be transmitted through a Ministry of Finance accredited service provider in PINT AE format over Peppol. Zoho is the source system.",
        },
      ],
    },
    quickbooks: {
      metaTitle: "QuickBooks E-Invoicing in the UAE — Accredited Providers & Integration",
      metaDescription:
        "Connecting QuickBooks to UAE e-invoicing under the Ministry of Finance mandate: what is required, what it involves, and which accredited providers name QuickBooks.",
      h1: "QuickBooks e-invoicing in the UAE",
      intro:
        "QuickBooks is widely used by smaller UAE businesses and is usually connected through the provider's API rather than a packaged connector. The mandate applies the same way it does to any other system: the invoice has to leave through an accredited provider.",
      match: ["quickbooks"],
      faq: [
        {
          q: "Can QuickBooks send UAE e-invoices on its own?",
          a: "No. QuickBooks can raise the invoice, but transmission has to go through a Ministry of Finance accredited service provider using PINT AE over the Peppol network.",
        },
      ],
    },
  },
  ar: {},
};

/** English copy is the fallback while an Arabic page is unwritten. */
export function integrationPageCopy(locale: Locale, key: string): IntegrationPageCopy | null {
  return INTEGRATION_PAGES[locale]?.[key] ?? INTEGRATION_PAGES.en[key] ?? null;
}

/** Systems that have a page of their own, in the order they appear on the hub. */
export const INTEGRATION_PAGE_KEYS = Object.keys(INTEGRATION_PAGES.en);
