import type { Locale } from "@/lib/site";

export interface GuideSection {
  h: string;
  body: string[];
  list?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  readingMinutes: number;
  intro: string;
  sections: GuideSection[];
  related: string[];
}

export const GUIDE_UPDATED_ISO = "2026-07-20";

const en: Guide[] = [
  {
    slug: "what-is-uae-e-invoicing",
    title: "What is UAE e-invoicing? The complete introduction",
    metaTitle: "What Is UAE E-Invoicing? Complete 2026 Introduction",
    metaDescription:
      "Understand the UAE's Electronic Invoicing System: the Peppol five-corner model, PINT AE format, Accredited Service Providers, and what changes for your business.",
    readingMinutes: 7,
    intro:
      "The UAE is replacing paper and PDF invoices with structured electronic invoices exchanged in real time through a government-supervised network. This guide explains what the Electronic Invoicing System actually is, how the five-corner model works, and what it means for every business that issues invoices in the Emirates.",
    sections: [
      {
        h: "The short version",
        body: [
          "Under the UAE's Electronic Invoicing System, invoices become structured data files — not documents. Instead of emailing a PDF, your billing or ERP system hands the invoice to an Accredited Service Provider (ASP), which validates it, delivers it to your customer's ASP, and reports the tax data to the Federal Tax Authority. All of this happens in seconds, automatically.",
          "The legal foundation was laid by amendments to the UAE VAT and Tax Procedures laws, with the operating framework set out in Ministerial Decision No. 243 of 2025 (the system itself) and No. 244 of 2025 (the phased implementation timeline). Accreditation of service providers is governed by Ministerial Decision No. 64 of 2025.",
        ],
      },
      {
        h: "How the five-corner model works",
        body: [
          "The UAE chose a decentralised 'five-corner' model built on the international Peppol network — the same architecture used in Singapore, Belgium and a growing list of countries. The five corners are: you (the supplier), your ASP, your customer's ASP, your customer, and the Federal Tax Authority as the fifth corner receiving tax data.",
          "You never connect to the government directly. Your ASP is your single gateway: it converts invoices from whatever your accounting system produces into the UAE's PINT AE format, validates them against the rules, exchanges them over the network, and reports to the FTA. Your customer's ASP does the same in reverse.",
        ],
      },
      {
        h: "What is PINT AE?",
        body: [
          "PINT AE is the UAE localisation of the Peppol International Invoice format. It defines exactly which fields a compliant UAE e-invoice must carry — TRN numbers, VAT breakdowns, line items, payment terms — so that any two parties on the network can exchange invoices without custom file mappings.",
          "In practice you will rarely see PINT AE itself: your ASP generates it from your normal invoice data. What matters is that your master data (customer TRNs, addresses, VAT codes) is clean enough for the conversion to validate. Data cleanup is consistently the most underestimated part of every e-invoicing project.",
        ],
      },
      {
        h: "Who is in scope?",
        body: [
          "The mandate covers persons conducting business in the UAE for their business-to-business and business-to-government transactions, unless specifically excluded. It applies regardless of VAT registration status in the broader framework, with the rollout phased by annual revenue: businesses at or above AED 50 million go first, followed by all other businesses, then government entities.",
          "Consumer (B2C) invoicing is outside the initial scope. Certain excluded transaction types are set out in the Ministerial Decisions — your ASP or tax adviser can confirm how the exclusions apply to your specific flows.",
        ],
      },
      {
        h: "What you need to do",
        body: [
          "Every in-scope business must appoint an Accredited Service Provider by its phase deadline, integrate its billing systems with that ASP, and go live by its mandated date. The Ministry of Finance publishes the official list of pre-approved providers — the same list this directory tracks daily.",
        ],
        list: [
          "Confirm your phase from your audited annual revenue",
          "Shortlist ASPs that integrate with your accounting or ERP system",
          "Appoint your ASP before your appointment deadline",
          "Clean your master data and integrate, test, and train",
          "Go live before your mandated date — penalties apply from day one",
        ],
      },
    ],
    related: ["uae-e-invoicing-timeline", "how-to-choose-an-asp", "peppol-pint-ae-explained"],
  },
  {
    slug: "uae-e-invoicing-timeline",
    title: "UAE e-invoicing timeline: every phase and deadline",
    metaTitle: "UAE E-Invoicing Timeline 2026–2027: All Phases & Deadlines",
    metaDescription:
      "Every UAE e-invoicing deadline in one place: the July 2026 pilot, the 30 October 2026 ASP appointment deadline, January 2027 go-live for large businesses, and the 2027 waves.",
    readingMinutes: 6,
    intro:
      "The UAE e-invoicing mandate arrives in waves, and each wave has two separate deadlines that businesses routinely confuse: the date by which you must appoint an Accredited Service Provider, and the date your e-invoicing actually goes live. Miss either and administrative penalties apply. Here is the full timeline.",
    sections: [
      {
        h: "The pilot and voluntary phase — from 1 July 2026",
        body: [
          "A pilot programme with selected businesses (the Taxpayer Working Group) started on 1 July 2026 under Ministry of Finance and FTA supervision. From the same date, any business may adopt e-invoicing voluntarily.",
          "Voluntary adoption is more than a gesture: businesses that implement during the voluntary window are not exposed to the mandate's administrative penalties until their mandatory date arrives, and they get first pick of provider onboarding capacity — which will be scarce close to each deadline.",
        ],
      },
      {
        h: "Phase 1 — large businesses (revenue ≥ AED 50 million)",
        body: [
          "Businesses with annual revenue of AED 50 million or more must appoint their ASP by 30 October 2026 (this deadline was extended from the original 31 July 2026) and must be live on the Electronic Invoicing System by 1 January 2027.",
          "The gap between those dates is deliberately short. An ERP integration project realistically needs three to six months for data cleanup, mapping, testing and training — which means Phase 1 businesses that have not started by mid-2026 are already compressing their timeline.",
        ],
      },
      {
        h: "Phase 2 — all other businesses",
        body: [
          "Businesses below AED 50 million in annual revenue must appoint an ASP by 31 March 2027 and go live by 1 July 2027. Smaller businesses often assume their implementation will be trivial; in practice SME accounting stacks (spreadsheets, offline invoicing, mixed systems) frequently need more cleanup than enterprise ERPs.",
        ],
      },
      {
        h: "Phase 3 — government entities",
        body: [
          "Government entities appoint by 31 March 2027 and go live by 1 October 2027. If you sell to government, note the practical consequence: your public-sector customers will expect network invoices from their go-live, regardless of your own phase.",
        ],
      },
      {
        h: "Why the appointment deadline is the one to watch",
        body: [
          "Failing to appoint an ASP by your deadline triggers a penalty of AED 5,000 for every month (or part of a month) of delay under Cabinet Decision No. 106 of 2025 — and the clock only stops when you appoint. The appointment deadline also arrives months before go-live, making it the first date most businesses miss.",
          "Use our free readiness planner to turn these dates into a working backwards plan for your business, or get matched with a provider that fits your systems and budget.",
        ],
      },
    ],
    related: ["uae-e-invoicing-penalties", "how-to-choose-an-asp", "sme-guide-to-e-invoicing"],
  },
  {
    slug: "how-to-choose-an-asp",
    title: "How to choose an Accredited Service Provider (ASP)",
    metaTitle: "How to Choose a UAE E-Invoicing ASP: 8-Factor Framework",
    metaDescription:
      "A practical framework for comparing the UAE's pre-approved e-invoicing providers: integration fit, pricing models, onboarding, support, regional experience and contract terms.",
    readingMinutes: 8,
    intro:
      "With dozens of pre-approved providers on the Ministry of Finance list, choosing an ASP is genuinely difficult — and switching later means re-integrating, re-testing and re-training. This framework covers the eight factors that actually separate providers, in the order that eliminates candidates fastest.",
    sections: [
      {
        h: "1. Integration with your systems",
        body: [
          "Start here because it eliminates the most candidates. If you run SAP, Oracle or Microsoft Dynamics, shortlist providers with proven connectors for your exact version. If you use regional or SME software — Tally, Zoho Books, Odoo, QuickBooks — ask each provider to demonstrate an existing integration, not promise one. If your invoicing is bespoke or spreadsheet-based, you need a provider with a well-documented API or a portal-based entry mode.",
        ],
      },
      {
        h: "2. Pricing model versus your volume",
        body: [
          "Providers price on some mix of invoice volume, entities, integrations and support tiers. A per-invoice price that looks cheap at 200 invoices a month can be punitive at 20,000; a flat enterprise licence can be absurd for an SME. Model your real monthly volume — both issued and received invoices count — before comparing quotes.",
        ],
      },
      {
        h: "3. Onboarding capacity and timeline",
        body: [
          "Every provider will be busiest in the months before each phase deadline. Ask for a committed onboarding start date and a realistic go-live estimate in writing. A slightly more expensive provider that can start next week routinely beats a cheaper one with a three-month queue.",
        ],
      },
      {
        h: "4. Support quality and language",
        body: [
          "E-invoicing failures block your revenue collection, so support is not a soft factor. Check support hours against your finance team's working days, escalation paths, and whether Arabic-language support is available if your team needs it.",
        ],
      },
      {
        h: "5. Regional e-invoicing track record",
        body: [
          "Providers that already operate under Saudi Arabia's ZATCA regime, Egypt's ETA or other Peppol jurisdictions have lived through a mandate before. That experience shows up in calmer go-lives and better validation tooling. Our provider profiles note regional experience where it is public.",
        ],
      },
      {
        h: "6, 7, 8. Stability, roadmap, contract terms",
        body: [
          "Financial stability matters because your ASP holds your invoice pipeline; ask about company backing and client references. Roadmap matters because the UAE specification will evolve — you want a provider that ships updates without change fees. And read the contract for exit terms: data export, notice periods and migration assistance if you ever switch.",
        ],
        list: [
          "Shortlist by integration fit first — it eliminates the most options",
          "Model pricing on your real invoice volume, issued and received",
          "Get onboarding dates in writing before you sign",
          "Weight support quality and Arabic availability to your team's needs",
          "Prefer providers with ZATCA or Peppol scars",
          "Check exit terms before you need them",
        ],
      },
    ],
    related: ["uae-e-invoicing-timeline", "erp-integration-guide", "uae-e-invoicing-penalties"],
  },
  {
    slug: "uae-e-invoicing-penalties",
    title: "UAE e-invoicing penalties: what non-compliance costs",
    metaTitle: "UAE E-Invoicing Penalties: Cabinet Decision 106 Explained",
    metaDescription:
      "Cabinet Decision No. 106 of 2025 sets the fines: AED 5,000/month for missing ASP appointment or go-live, AED 100 per invoice issued outside the system, AED 1,000/day for unreported changes.",
    readingMinutes: 6,
    intro:
      "The UAE has attached specific, automatic administrative penalties to the e-invoicing mandate through Cabinet Decision No. 106 of 2025. The amounts are calibrated to make delay more expensive than compliance — here is each penalty, when it starts applying, and how to stay out of scope entirely.",
    sections: [
      {
        h: "The four core penalties",
        body: [
          "The decision establishes four penalties that cover the full lifecycle of the obligation:",
        ],
        list: [
          "Failure to appoint an ASP by your deadline: AED 5,000 per month (or part of a month) until you appoint",
          "Failure to implement the system by your go-live date: AED 5,000 per month (or part) until you are live",
          "Issuing or transmitting invoices outside the system: AED 100 per invoice, capped at AED 5,000 per calendar month",
          "Failing to notify your ASP of changes to registered data: AED 1,000 per day (or part) until resolved",
        ],
      },
      {
        h: "When penalties start",
        body: [
          "Penalties bind from your phase's mandatory dates: from 1 January 2027 for large businesses (revenue ≥ AED 50 million) and from 1 July 2027 for other businesses, with the ASP appointment penalty tied to the earlier appointment deadlines (30 October 2026 and 31 March 2027 respectively).",
          "Nothing applies during the voluntary phase — a business that adopts early is exempt from these penalties until its mandatory date. This is the single strongest argument for voluntary adoption from July 2026.",
        ],
      },
      {
        h: "Why the numbers compound quickly",
        body: [
          "The penalties stack. A Phase 1 business that ignores the mandate entirely could face AED 5,000 per month for the missed appointment, then AED 5,000 per month for the missed go-live, plus up to AED 5,000 per month for invoices issued outside the system — a worst case in the region of AED 15,000 every month, before considering the operational reality that in-scope customers will start rejecting non-network invoices.",
          "Use our penalty calculator to model your own exposure based on your phase and invoice volume.",
        ],
      },
      {
        h: "Staying out of penalty scope",
        body: [
          "The playbook is unexciting and effective: know your phase, appoint an ASP well before the appointment deadline, and leave real time for integration and testing before go-live. Businesses that appoint six months ahead of their deadline essentially remove penalty risk from the project.",
        ],
      },
      {
        h: "A note on accuracy",
        body: [
          "Penalty amounts and dates summarised here reflect Cabinet Decision No. 106 of 2025 and the implementation decisions as amended at the time of writing. Always verify current amounts against official Ministry of Finance and FTA publications, and take professional advice for your specific situation — this guide is information, not legal advice.",
        ],
      },
    ],
    related: ["uae-e-invoicing-timeline", "what-is-uae-e-invoicing", "sme-guide-to-e-invoicing"],
  },
  {
    slug: "peppol-pint-ae-explained",
    title: "Peppol and PINT AE explained for UAE businesses",
    metaTitle: "Peppol & PINT AE Explained: UAE E-Invoice Format Guide",
    metaDescription:
      "What Peppol is, how the UAE's five-corner model uses it, and what the PINT AE invoice format requires — TRNs, VAT breakdowns, validation rules — explained without jargon.",
    readingMinutes: 6,
    intro:
      "Two technical terms dominate every UAE e-invoicing conversation: Peppol, the international exchange network, and PINT AE, the UAE's invoice format on that network. You do not need to be technical to make good decisions about either — you just need this mental model.",
    sections: [
      {
        h: "Peppol: the postal network for invoices",
        body: [
          "Peppol began as a European public-procurement network and has become the closest thing e-invoicing has to a global standard, now used from Singapore to Japan to Belgium. Think of it as a postal system for structured business documents: every participant has an address, every access point (in the UAE: every ASP) is certified, and any sender can reach any receiver without a bilateral setup.",
          "The UAE's Electronic Invoicing System runs on this network with a local governance layer — the 'five-corner' model — in which the FTA receives tax data on every exchanged invoice as the fifth corner.",
        ],
      },
      {
        h: "PINT AE: the UAE's invoice dialect",
        body: [
          "PINT (Peppol INTernational invoice) is the network's shared invoice model, and PINT AE is its UAE specialisation. It prescribes the mandatory fields for a UAE-compliant invoice: supplier and customer tax registration numbers, VAT category breakdowns, line-level detail, currency handling, and the UAE-specific business rules invoices are validated against.",
          "Validation is the practical point. When your ASP converts your invoice into PINT AE, the network checks it against these rules automatically. Invoices with missing TRNs, inconsistent VAT totals or malformed data are rejected before they ever reach your customer — which is why master-data quality decides how smooth your go-live is.",
        ],
      },
      {
        h: "What your systems must produce",
        body: [
          "Almost certainly not PINT AE itself. Your accounting or ERP system keeps producing what it produces today — the ASP maps that output into PINT AE. What your systems must provide is complete and correct data: valid TRNs for every in-scope customer, correct VAT codes per line, and consistent totals.",
        ],
        list: [
          "Valid TRN for your entity and every B2B customer",
          "Correct VAT category codes on every invoice line",
          "Consistent rounding and totals your ERP can reproduce",
          "Customer master data complete enough for network addressing",
        ],
      },
      {
        h: "Questions to ask your ASP about PINT AE",
        body: [
          "Ask how they handle validation failures (queue and alert, or silent rejection?), whether they pre-validate before transmission, how they surface FTA reporting status, and how format updates are rolled out when the UAE specification evolves. Providers with existing Peppol operations elsewhere answer these fluently.",
        ],
      },
    ],
    related: ["what-is-uae-e-invoicing", "erp-integration-guide", "how-to-choose-an-asp"],
  },
  {
    slug: "erp-integration-guide",
    title: "ERP and accounting integration for UAE e-invoicing",
    metaTitle: "UAE E-Invoicing ERP Integration Guide: SAP to Spreadsheets",
    metaDescription:
      "How e-invoicing integration actually works for SAP, Oracle, Dynamics, Tally, Zoho, Odoo, QuickBooks and custom systems — connector types, timelines and the data cleanup nobody budgets for.",
    readingMinutes: 8,
    intro:
      "Your integration path — not your company size — determines how long UAE e-invoicing implementation takes. A clean cloud accounting stack can be live in weeks; a customised ERP with dirty master data can take two quarters. This guide maps the main integration routes and their realistic timelines.",
    sections: [
      {
        h: "The four integration routes",
        body: [
          "Every provider connection reduces to one of four patterns: a packaged connector (pre-built for your ERP and version — fastest and safest), an API integration (your team or the provider's builds against their documented API), middleware (an integration platform bridges your systems and the ASP), or portal entry (you key or upload invoices into the provider's web portal — the fallback for low volumes and offline systems).",
        ],
      },
      {
        h: "Enterprise ERPs: SAP, Oracle, Dynamics",
        body: [
          "For SAP (ECC and S/4HANA), Oracle (E-Business Suite, Fusion) and Microsoft Dynamics 365, the question is never 'is integration possible' but 'does this provider have a proven connector for my exact version and customisations'. Ask for reference clients on your version, clarity on how customer exits and custom fields are handled, and who owns mapping changes over time. Realistic timeline: three to six months including testing.",
        ],
      },
      {
        h: "Regional and SME software: Tally, Zoho, Odoo, QuickBooks, Sage, Xero",
        body: [
          "Several pre-approved providers are themselves the vendors of regional accounting products, and others maintain connectors for the popular SME stack. If you run Tally, Zoho Books, Odoo, QuickBooks, Sage or Xero, shortlist providers that can demonstrate a working integration in a demo — this is common enough that you should not accept a roadmap promise. Realistic timeline: two weeks to two months.",
        ],
      },
      {
        h: "Custom systems and spreadsheets",
        body: [
          "Bespoke billing systems integrate through the provider's API — evaluate the API documentation quality before signing, because you will live with it. Businesses invoicing from spreadsheets or standalone tools face a choice: adopt the provider's portal for manual entry (viable at low volume) or use the mandate as the forcing function to move onto a proper accounting system first.",
        ],
      },
      {
        h: "The part everyone underestimates: data cleanup",
        body: [
          "Most go-live delays are data problems wearing a technology costume. Network validation will reject invoices with missing or invalid customer TRNs, wrong VAT codes and inconsistent totals — so the cleanup has to happen before testing, not after rejections start.",
        ],
        list: [
          "Collect and verify TRNs for every active B2B customer",
          "Map every product/service line to the correct VAT treatment",
          "Standardise customer names and addresses against TRN records",
          "Archive dormant customers so they don't pollute validation",
          "Agree rounding rules between your ERP and your ASP early",
        ],
      },
      {
        h: "Sequencing your project",
        body: [
          "A proven sequence: appoint the ASP first (it stops the penalty clock and books your onboarding slot), run data cleanup in parallel with technical integration, then test with real invoice samples across your actual scenarios — credit notes, discounts, multi-currency — before switching on. Our readiness planner turns this into dated milestones for your phase.",
        ],
      },
    ],
    related: ["how-to-choose-an-asp", "peppol-pint-ae-explained", "uae-e-invoicing-timeline"],
  },
  {
    slug: "sme-guide-to-e-invoicing",
    title: "The SME guide to UAE e-invoicing",
    metaTitle: "UAE E-Invoicing for SMEs: Simple Guide for Small Business",
    metaDescription:
      "What UAE e-invoicing means for small and medium businesses: your July 2027 deadline, what it will cost, whether your accounting app is ready, and the five steps to take now.",
    readingMinutes: 6,
    intro:
      "If your business earns under AED 50 million a year, your e-invoicing deadlines are in 2027 — which feels comfortably far away and is exactly why thousands of SMEs will end up scrambling in the final quarter. This guide gives small businesses the honest version: what changes, what it costs, and the small number of things worth doing now.",
    sections: [
      {
        h: "Your dates",
        body: [
          "Businesses below AED 50 million in annual revenue must appoint an Accredited Service Provider by 31 March 2027 and be live by 1 July 2027. From your go-live, invoices for in-scope transactions must travel through the network — a PDF by email stops counting as an invoice for those flows.",
        ],
      },
      {
        h: "What it will actually cost",
        body: [
          "SME pricing is genuinely affordable in most cases: several providers offer entry plans priced for hundreds (not thousands) of invoices per month, and some accounting products include e-invoicing in existing subscriptions. The expensive path is waiting — late movers get less choice, rushed onboarding and zero negotiating leverage.",
          "Budget for three components: the provider subscription, one-time onboarding/integration, and a few days of your own time for data cleanup and testing.",
        ],
      },
      {
        h: "Is your accounting app ready?",
        body: [
          "If you invoice from a mainstream cloud product — Zoho Books, QuickBooks, Xero, Odoo, Tally — the answer is probably yes via a provider connector, and your project is small. If you invoice from Word, Excel or a bespoke tool, the mandate is effectively also a decision point about adopting a real accounting system; doing that first makes the e-invoicing step trivial.",
        ],
      },
      {
        h: "The five things worth doing now",
        body: [],
        list: [
          "Confirm you're under the AED 50M threshold (your accountant can verify) so you know your phase",
          "Start collecting TRNs for your regular B2B customers — it's the #1 validation failure",
          "Ask your current accounting software vendor about their UAE e-invoicing plan",
          "Shortlist two or three providers with SME plans (our matching service does this free)",
          "Diarise a decision date no later than Q4 2026 — well before the March 2027 appointment deadline",
        ],
      },
      {
        h: "The upside nobody mentions",
        body: [
          "E-invoicing is framed as a compliance burden, but SMEs that have been through it in other countries report real benefits: faster payment cycles (structured invoices don't sit in inboxes), fewer disputes, automatic VAT data for returns, and cleaner books. Early movers bank those benefits a year ahead of their competitors.",
        ],
      },
    ],
    related: ["uae-e-invoicing-timeline", "uae-e-invoicing-penalties", "how-to-choose-an-asp"],
  },
];

const ar: Guide[] = [
  {
    slug: "what-is-uae-e-invoicing",
    title: "ما هي الفوترة الإلكترونية في الإمارات؟ المقدمة الشاملة",
    metaTitle: "ما هي الفوترة الإلكترونية في الإمارات؟ مقدمة شاملة 2026",
    metaDescription:
      "افهم نظام الفوترة الإلكترونية الإماراتي: نموذج الزوايا الخمس عبر شبكة Peppol، وصيغة PINT AE، ومزودي الخدمة المعتمدين، وما الذي سيتغير في أعمالك.",
    readingMinutes: 7,
    intro:
      "تستبدل دولة الإمارات الفواتير الورقية وملفات PDF بفواتير إلكترونية منظمة تُتبادل لحظياً عبر شبكة خاضعة لإشراف حكومي. يشرح هذا الدليل ماهية نظام الفوترة الإلكترونية، وكيف يعمل نموذج الزوايا الخمس، وما يعنيه ذلك لكل منشأة تصدر فواتير في الدولة.",
    sections: [
      {
        h: "الخلاصة المختصرة",
        body: [
          "بموجب نظام الفوترة الإلكترونية الإماراتي تتحول الفاتورة إلى ملف بيانات منظم — لا مستند. فبدلاً من إرسال PDF بالبريد الإلكتروني، يسلّم نظام الفوترة أو تخطيط الموارد لديك الفاتورة إلى مزود خدمة معتمد (ASP) يتحقق منها ويوصلها إلى مزود خدمة عميلك ويرفع بياناتها الضريبية إلى الهيئة الاتحادية للضرائب — كل ذلك خلال ثوانٍ وبشكل تلقائي.",
          "وُضع الأساس القانوني عبر تعديلات على قانوني ضريبة القيمة المضافة والإجراءات الضريبية، بينما حُدد الإطار التشغيلي في القرار الوزاري رقم 243 لسنة 2025 (النظام) والقرار رقم 244 لسنة 2025 (الجدول الزمني المرحلي)، ويخضع اعتماد مزودي الخدمة للقرار الوزاري رقم 64 لسنة 2025.",
        ],
      },
      {
        h: "كيف يعمل نموذج الزوايا الخمس",
        body: [
          "اختارت الإمارات نموذجاً لامركزياً من «خمس زوايا» مبنياً على شبكة Peppol الدولية — البنية نفسها المستخدمة في سنغافورة وبلجيكا وقائمة متزايدة من الدول. الزوايا الخمس هي: أنت (المورّد)، ومزود خدمتك، ومزود خدمة عميلك، وعميلك، ثم الهيئة الاتحادية للضرائب كزاوية خامسة تتلقى البيانات الضريبية.",
          "لن تتصل بالجهات الحكومية مباشرة أبداً؛ فمزود الخدمة المعتمد هو بوابتك الوحيدة: يحوّل فواتيرك إلى صيغة PINT AE الإماراتية، ويتحقق منها وفق القواعد، ويتبادلها عبر الشبكة، ويرفع التقارير إلى الهيئة. ويقوم مزود خدمة عميلك بالعملية نفسها في الاتجاه المعاكس.",
        ],
      },
      {
        h: "ما هي صيغة PINT AE؟",
        body: [
          "PINT AE هي النسخة الإماراتية من صيغة فواتير Peppol الدولية، وتحدد بدقة الحقول الإلزامية في الفاتورة الإلكترونية الإماراتية: أرقام التسجيل الضريبي، وتفاصيل ضريبة القيمة المضافة، وبنود الفاتورة، وشروط الدفع، بحيث يستطيع أي طرفين على الشبكة تبادل الفواتير دون تهيئة خاصة.",
          "عملياً لن ترى صيغة PINT AE بنفسك؛ إذ ينشئها مزود الخدمة من بيانات فواتيرك المعتادة. المهم أن تكون بياناتك الرئيسية — أرقام التسجيل الضريبي لعملائك وعناوينهم ورموز الضريبة — نظيفة بما يكفي لاجتياز التحقق. تنظيف البيانات هو الجزء الأكثر استهانة به في كل مشروع فوترة إلكترونية.",
        ],
      },
      {
        h: "من يشمله النظام؟",
        body: [
          "يغطي الإلزام الأشخاص الذين يمارسون الأعمال في الإمارات في معاملاتهم بين الشركات ومع الجهات الحكومية، ما لم يُستثنَ صراحة. ويُطبق على مراحل بحسب الإيرادات السنوية: الشركات التي تبلغ إيراداتها 50 مليون درهم أو أكثر أولاً، ثم باقي الشركات، فالجهات الحكومية.",
          "فوترة المستهلكين (B2C) خارج النطاق الأولي، وتوجد استثناءات لأنواع معاملات محددة وردت في القرارات الوزارية — يمكن لمزود خدمتك أو مستشارك الضريبي تأكيد انطباقها على تعاملاتك.",
        ],
      },
      {
        h: "ما المطلوب منك",
        body: [
          "على كل منشأة مشمولة تعيين مزود خدمة معتمد قبل الموعد النهائي لمرحلتها، وربط أنظمة الفوترة لديها به، والتشغيل الفعلي قبل تاريخها الإلزامي. وتنشر وزارة المالية القائمة الرسمية للمزودين المعتمدين مبدئياً — وهي القائمة نفسها التي يتابعها هذا الدليل يومياً.",
        ],
        list: [
          "حدد مرحلتك بناءً على إيراداتك السنوية المدققة",
          "ضع قائمة مختصرة بالمزودين المتوافقين مع نظامك المحاسبي",
          "عيّن مزود الخدمة قبل الموعد النهائي للتعيين",
          "نظّف بياناتك الرئيسية ثم اربط واختبر ودرّب",
          "شغّل النظام قبل تاريخك الإلزامي — فالغرامات تسري من اليوم الأول",
        ],
      },
    ],
    related: ["uae-e-invoicing-timeline", "how-to-choose-an-asp", "peppol-pint-ae-explained"],
  },
  {
    slug: "uae-e-invoicing-timeline",
    title: "الجدول الزمني للفوترة الإلكترونية في الإمارات: كل المراحل والمواعيد",
    metaTitle: "الجدول الزمني للفوترة الإلكترونية في الإمارات 2026–2027",
    metaDescription:
      "جميع مواعيد الفوترة الإلكترونية الإماراتية في مكان واحد: التجربة في يوليو 2026، وموعد تعيين المزود في 30 أكتوبر 2026، والتشغيل في يناير 2027 للشركات الكبيرة، وموجات 2027.",
    readingMinutes: 6,
    intro:
      "يصل إلزام الفوترة الإلكترونية في الإمارات على موجات، ولكل موجة موعدان منفصلان تخلط بينهما الشركات باستمرار: تاريخ وجوب تعيين مزود الخدمة المعتمد، وتاريخ التشغيل الفعلي للفوترة الإلكترونية. تفويت أيٍّ منهما يستوجب غرامات إدارية. إليك الجدول الكامل.",
    sections: [
      {
        h: "التجربة والمرحلة الطوعية — من 1 يوليو 2026",
        body: [
          "انطلق برنامج تجريبي مع شركات مختارة (مجموعة عمل المكلفين) في 1 يوليو 2026 بإشراف وزارة المالية والهيئة الاتحادية للضرائب. ومن التاريخ نفسه يمكن لأي منشأة تبنّي الفوترة الإلكترونية طوعاً.",
          "التبني الطوعي ليس مجرد بادرة حسنة: فالمنشآت التي تطبق خلال الفترة الطوعية لا تخضع للغرامات الإدارية حتى حلول تاريخها الإلزامي، وتحصل على أولوية في طاقة المزودين الاستيعابية — التي ستشح مع اقتراب كل موعد نهائي.",
        ],
      },
      {
        h: "المرحلة الأولى — الشركات الكبيرة (إيرادات ≥ 50 مليون درهم)",
        body: [
          "على الشركات التي تبلغ إيراداتها السنوية 50 مليون درهم أو أكثر تعيين مزود خدمتها بحلول 30 أكتوبر 2026 (بعد تمديد الموعد الأصلي 31 يوليو 2026)، والتشغيل الفعلي على النظام بحلول 1 يناير 2027.",
          "الفاصل بين التاريخين قصير عمداً؛ فمشروع ربط أنظمة تخطيط الموارد يحتاج واقعياً من ثلاثة إلى ستة أشهر لتنظيف البيانات والربط والاختبار والتدريب — ما يعني أن شركات المرحلة الأولى التي لم تبدأ بحلول منتصف 2026 تضغط جدولها الزمني بالفعل.",
        ],
      },
      {
        h: "المرحلة الثانية — باقي الشركات",
        body: [
          "على الشركات التي تقل إيراداتها السنوية عن 50 مليون درهم تعيين مزود خدمة بحلول 31 مارس 2027 والتشغيل بحلول 1 يوليو 2027. كثيراً ما تفترض الشركات الصغيرة أن تطبيقها سيكون سهلاً؛ لكن أنظمة المحاسبة لدى الشركات الصغيرة والمتوسطة (جداول بيانات، فوترة يدوية، أنظمة متفرقة) تحتاج عملياً تنظيفاً أكثر من أنظمة المؤسسات الكبيرة.",
        ],
      },
      {
        h: "المرحلة الثالثة — الجهات الحكومية",
        body: [
          "تعيّن الجهات الحكومية مزوديها بحلول 31 مارس 2027 وتشغّل بحلول 1 أكتوبر 2027. وإذا كنت تبيع للجهات الحكومية فانتبه للأثر العملي: سيتوقع عملاؤك في القطاع الحكومي فواتير عبر الشبكة من تاريخ تشغيلهم بغض النظر عن مرحلتك أنت.",
        ],
      },
      {
        h: "لماذا موعد التعيين هو الأهم",
        body: [
          "يترتب على عدم تعيين مزود خدمة قبل موعدك النهائي غرامة قدرها 5,000 درهم عن كل شهر تأخير (أو جزء منه) بموجب قرار مجلس الوزراء رقم 106 لسنة 2025 — ولا يتوقف العداد إلا بالتعيين. كما أن موعد التعيين يسبق التشغيل بأشهر، ما يجعله أول تاريخ تفوّته معظم الشركات.",
          "استخدم مخطط الجاهزية المجاني لدينا لتحويل هذه التواريخ إلى خطة عمل عكسية لمنشأتك، أو اطلب مطابقتك مجاناً مع مزود يناسب أنظمتك وميزانيتك.",
        ],
      },
    ],
    related: ["uae-e-invoicing-penalties", "how-to-choose-an-asp", "sme-guide-to-e-invoicing"],
  },
  {
    slug: "how-to-choose-an-asp",
    title: "كيف تختار مزود الخدمة المعتمد (ASP)؟",
    metaTitle: "كيف تختار مزود فوترة إلكترونية معتمداً في الإمارات: 8 معايير",
    metaDescription:
      "إطار عملي للمقارنة بين مزودي الفوترة الإلكترونية المعتمدين مبدئياً في الإمارات: توافق الأنظمة، ونماذج التسعير، والتأهيل، والدعم، والخبرة الإقليمية، وشروط العقد.",
    readingMinutes: 8,
    intro:
      "مع عشرات المزودين المعتمدين مبدئياً على قائمة وزارة المالية، يصبح اختيار مزود الخدمة صعباً فعلاً — والتبديل لاحقاً يعني إعادة الربط والاختبار والتدريب من جديد. يغطي هذا الإطار المعايير الثمانية التي تفرّق حقاً بين المزودين، مرتبةً بحسب سرعة استبعادها للخيارات.",
    sections: [
      {
        h: "1. التوافق مع أنظمتك",
        body: [
          "ابدأ هنا لأنه يستبعد أكبر عدد من الخيارات. إذا كنت تستخدم SAP أو Oracle أو Microsoft Dynamics فاختصر القائمة على مزودين يمتلكون موصلات مجربة لإصدارك تحديداً. وإذا كنت تستخدم برامج إقليمية أو للشركات الصغيرة — Tally أو Zoho Books أو Odoo أو QuickBooks — فاطلب من كل مزود عرضاً حياً لتكامل قائم، لا وعداً به. أما إذا كانت فوترتك مخصصة أو عبر جداول بيانات فتحتاج مزوداً بواجهة برمجية موثقة جيداً أو بوابة إدخال مباشر.",
        ],
      },
      {
        h: "2. نموذج التسعير مقابل حجمك",
        body: [
          "يسعّر المزودون بمزيج من حجم الفواتير وعدد الكيانات والتكاملات ومستويات الدعم. فسعر الفاتورة الواحدة الذي يبدو زهيداً عند 200 فاتورة شهرياً قد يصبح باهظاً عند 20,000، والرخصة المؤسسية الثابتة قد تكون عبثية لشركة صغيرة. احسب حجمك الشهري الحقيقي — الفواتير الصادرة والواردة معاً — قبل مقارنة العروض.",
        ],
      },
      {
        h: "3. طاقة التأهيل والجدول الزمني",
        body: [
          "سيكون كل مزود في أوج انشغاله في الأشهر السابقة لكل موعد نهائي. اطلب كتابياً تاريخ بدء تأهيل ملتزماً به وتقديراً واقعياً للتشغيل. المزود الأغلى قليلاً الذي يستطيع البدء الأسبوع المقبل يتفوق عادة على الأرخص الذي لديه طابور انتظار ثلاثة أشهر.",
        ],
      },
      {
        h: "4. جودة الدعم ولغته",
        body: [
          "أعطال الفوترة الإلكترونية تعطّل تحصيل إيراداتك، لذا الدعم ليس عاملاً ثانوياً. تحقق من ساعات الدعم مقابل أيام عمل فريقك المالي، ومسارات التصعيد، وتوافر الدعم باللغة العربية إن كان فريقك يحتاجه.",
        ],
      },
      {
        h: "5. السجل الإقليمي في الفوترة الإلكترونية",
        body: [
          "المزودون العاملون أصلاً تحت نظام هيئة الزكاة والضريبة والجمارك السعودية (ZATCA) أو مصلحة الضرائب المصرية أو غيرهما من أنظمة Peppol خاضوا تجربة إلزام من قبل، وتظهر تلك الخبرة في انطلاقات تشغيل أهدأ وأدوات تحقق أفضل. تُبرز صفحات المزودين لدينا الخبرة الإقليمية حيثما كانت معلنة.",
        ],
      },
      {
        h: "6، 7، 8. الاستقرار وخارطة الطريق وشروط العقد",
        body: [
          "الاستقرار المالي مهم لأن مزودك يمسك بشريان فواتيرك؛ فاسأل عن الجهات الداعمة والعملاء المرجعيين. وخارطة الطريق مهمة لأن المواصفة الإماراتية ستتطور — وتريد مزوداً يطلق التحديثات دون رسوم تغيير. واقرأ العقد بحثاً عن شروط الخروج: تصدير البيانات، وفترات الإشعار، والمساعدة في الانتقال إن بدّلت يوماً.",
        ],
        list: [
          "اختصر القائمة بمعيار توافق الأنظمة أولاً — فهو يستبعد أكثر الخيارات",
          "احسب التسعير على حجم فواتيرك الحقيقي صادرةً وواردة",
          "احصل على تواريخ التأهيل كتابياً قبل التوقيع",
          "قيّم جودة الدعم وتوافر العربية بحسب حاجة فريقك",
          "فضّل مزودين خبروا ZATCA أو شبكة Peppol",
          "افحص شروط الخروج قبل أن تحتاجها",
        ],
      },
    ],
    related: ["uae-e-invoicing-timeline", "erp-integration-guide", "uae-e-invoicing-penalties"],
  },
  {
    slug: "uae-e-invoicing-penalties",
    title: "غرامات الفوترة الإلكترونية في الإمارات: كلفة عدم الامتثال",
    metaTitle: "غرامات الفوترة الإلكترونية في الإمارات: شرح قرار مجلس الوزراء 106",
    metaDescription:
      "حدد قرار مجلس الوزراء رقم 106 لسنة 2025 الغرامات: 5,000 درهم شهرياً للتأخر في تعيين المزود أو التشغيل، و100 درهم عن كل فاتورة خارج النظام، و1,000 درهم يومياً لعدم الإبلاغ عن التغييرات.",
    readingMinutes: 6,
    intro:
      "ربطت الإمارات إلزام الفوترة الإلكترونية بغرامات إدارية محددة وتلقائية عبر قرار مجلس الوزراء رقم 106 لسنة 2025. صُممت المبالغ لتجعل التأخير أغلى من الامتثال — إليك كل غرامة، ومتى تسري، وكيف تبقى خارج نطاقها كلياً.",
    sections: [
      {
        h: "الغرامات الأربع الأساسية",
        body: ["يرسي القرار أربع غرامات تغطي دورة الالتزام كاملة:"],
        list: [
          "عدم تعيين مزود خدمة معتمد في الموعد: 5,000 درهم عن كل شهر (أو جزء منه) حتى التعيين",
          "عدم تطبيق النظام بحلول تاريخ التشغيل: 5,000 درهم عن كل شهر (أو جزء منه) حتى التشغيل",
          "إصدار أو إرسال فواتير خارج النظام: 100 درهم عن كل فاتورة بحد أقصى 5,000 درهم في الشهر الميلادي",
          "عدم إخطار مزود الخدمة بتغييرات البيانات المسجلة: 1,000 درهم عن كل يوم (أو جزء منه) حتى التصحيح",
        ],
      },
      {
        h: "متى تبدأ الغرامات",
        body: [
          "تسري الغرامات من التواريخ الإلزامية لمرحلتك: من 1 يناير 2027 للشركات الكبيرة (إيرادات ≥ 50 مليون درهم) ومن 1 يوليو 2027 لباقي الشركات، مع ارتباط غرامة تعيين المزود بموعدي التعيين الأسبقين (30 أكتوبر 2026 و31 مارس 2027 على التوالي).",
          "لا شيء يُطبق خلال المرحلة الطوعية — فالمنشأة التي تتبنى النظام مبكراً معفاة من هذه الغرامات حتى تاريخها الإلزامي. وهذه أقوى حجة منفردة للتبني الطوعي من يوليو 2026.",
        ],
      },
      {
        h: "لماذا تتراكم الأرقام بسرعة",
        body: [
          "الغرامات تتراكب. فشركة من المرحلة الأولى تتجاهل الإلزام كلياً قد تواجه 5,000 درهم شهرياً عن التعيين الفائت، ثم 5,000 درهم شهرياً عن التشغيل الفائت، إضافة إلى ما يصل إلى 5,000 درهم شهرياً عن الفواتير الصادرة خارج النظام — أي ما يقارب 15,000 درهم كل شهر في أسوأ الحالات، قبل احتساب الواقع التشغيلي: عملاؤك المشمولون سيبدؤون رفض الفواتير غير الشبكية.",
          "استخدم حاسبة الغرامات لدينا لتقدير تعرّضك بناءً على مرحلتك وحجم فواتيرك.",
        ],
      },
      {
        h: "كيف تبقى خارج نطاق الغرامات",
        body: [
          "الخطة غير مثيرة لكنها فعالة: اعرف مرحلتك، وعيّن مزود الخدمة قبل موعد التعيين بوقت كافٍ، واترك وقتاً حقيقياً للربط والاختبار قبل التشغيل. الشركات التي تعيّن قبل موعدها بستة أشهر تُخرج مخاطر الغرامات من مشروعها عملياً.",
        ],
      },
      {
        h: "ملاحظة حول الدقة",
        body: [
          "تعكس المبالغ والتواريخ الملخصة هنا قرار مجلس الوزراء رقم 106 لسنة 2025 وقرارات التنفيذ بصيغتها المعدلة وقت الكتابة. تحقق دائماً من المبالغ السارية في منشورات وزارة المالية والهيئة الاتحادية للضرائب الرسمية، واستشر مختصاً لحالتك — فهذا الدليل معلومات لا استشارة قانونية.",
        ],
      },
    ],
    related: ["uae-e-invoicing-timeline", "what-is-uae-e-invoicing", "sme-guide-to-e-invoicing"],
  },
  {
    slug: "peppol-pint-ae-explained",
    title: "شرح Peppol وصيغة PINT AE للشركات الإماراتية",
    metaTitle: "شرح Peppol وPINT AE: دليل صيغة الفاتورة الإلكترونية الإماراتية",
    metaDescription:
      "ما هي شبكة Peppol، وكيف يستخدمها نموذج الزوايا الخمس الإماراتي، وما الذي تتطلبه صيغة PINT AE — أرقام التسجيل الضريبي وتفاصيل الضريبة وقواعد التحقق — بلا تعقيد.",
    readingMinutes: 6,
    intro:
      "مصطلحان تقنيان يهيمنان على كل نقاش حول الفوترة الإلكترونية الإماراتية: Peppol، شبكة التبادل الدولية، وPINT AE، صيغة الفاتورة الإماراتية على تلك الشبكة. لست بحاجة لأن تكون تقنياً لتتخذ قرارات صائبة بشأنهما — تحتاج فقط هذا التصور الذهني.",
    sections: [
      {
        h: "Peppol: الشبكة البريدية للفواتير",
        body: [
          "بدأت Peppol كشبكة مشتريات حكومية أوروبية وأصبحت أقرب ما يكون لمعيار عالمي للفوترة الإلكترونية، وتُستخدم اليوم من سنغافورة إلى اليابان إلى بلجيكا. تصورها كنظام بريدي للمستندات التجارية المنظمة: لكل مشارك عنوان، وكل نقطة وصول (في الإمارات: كل مزود خدمة معتمد) معتمدة، وأي مرسل يصل إلى أي مستقبل دون تهيئة ثنائية.",
          "يعمل نظام الفوترة الإلكترونية الإماراتي على هذه الشبكة مع طبقة حوكمة محلية — نموذج «الزوايا الخمس» — تتلقى فيه الهيئة الاتحادية للضرائب البيانات الضريبية لكل فاتورة متبادلة بوصفها الزاوية الخامسة.",
        ],
      },
      {
        h: "PINT AE: اللهجة الإماراتية للفاتورة",
        body: [
          "PINT (فاتورة Peppol الدولية) هي نموذج الفاتورة المشترك للشبكة، وPINT AE تخصيصها الإماراتي. تحدد الحقول الإلزامية للفاتورة الإماراتية الممتثلة: رقما التسجيل الضريبي للمورد والعميل، وتفصيل فئات ضريبة القيمة المضافة، وبيانات البنود، ومعالجة العملات، وقواعد الأعمال الإماراتية التي تُدقق الفواتير وفقها.",
          "التحقق هو النقطة العملية. حين يحوّل مزودك فاتورتك إلى PINT AE تفحصها الشبكة تلقائياً وفق هذه القواعد، وتُرفض الفواتير ذات أرقام التسجيل الناقصة أو إجماليات الضريبة غير المتسقة أو البيانات المشوهة قبل وصولها لعميلك — ولهذا تقرر جودة بياناتك الرئيسية مدى سلاسة تشغيلك.",
        ],
      },
      {
        h: "ما الذي يجب أن تنتجه أنظمتك",
        body: [
          "بالتأكيد ليس PINT AE نفسها في الغالب. يواصل نظامك المحاسبي إنتاج ما ينتجه اليوم — ومزود الخدمة يحوّل ذلك الناتج إلى PINT AE. ما يجب أن توفره أنظمتك هو بيانات كاملة وصحيحة: أرقام تسجيل ضريبي سارية لكل عميل مشمول، ورموز ضريبة صحيحة لكل بند، وإجماليات متسقة.",
        ],
        list: [
          "رقم تسجيل ضريبي سارٍ لمنشأتك ولكل عميل B2B",
          "رموز فئات ضريبية صحيحة على كل بند فاتورة",
          "قواعد تقريب وإجماليات متسقة يستطيع نظامك إعادة إنتاجها",
          "بيانات عملاء رئيسية مكتملة بما يكفي للعنونة الشبكية",
        ],
      },
      {
        h: "أسئلة تطرحها على مزودك حول PINT AE",
        body: [
          "اسأل كيف يعالجون إخفاقات التحقق (طابور وتنبيه أم رفض صامت؟)، وهل يدققون مسبقاً قبل الإرسال، وكيف يعرضون حالة الرفع للهيئة، وكيف تُطرح تحديثات الصيغة حين تتطور المواصفة الإماراتية. المزودون ذوو العمليات القائمة على Peppol يجيبون عن هذه الأسئلة بطلاقة.",
        ],
      },
    ],
    related: ["what-is-uae-e-invoicing", "erp-integration-guide", "how-to-choose-an-asp"],
  },
  {
    slug: "erp-integration-guide",
    title: "ربط أنظمة تخطيط الموارد والمحاسبة بالفوترة الإلكترونية الإماراتية",
    metaTitle: "دليل ربط أنظمة ERP بالفوترة الإلكترونية الإماراتية",
    metaDescription:
      "كيف يتم ربط الفوترة الإلكترونية فعلياً مع SAP وOracle وDynamics وTally وZoho وOdoo وQuickBooks والأنظمة المخصصة — أنواع الموصلات والجداول الزمنية وتنظيف البيانات الذي لا يحسب أحدٌ ميزانيته.",
    readingMinutes: 8,
    intro:
      "مسار الربط لديك — لا حجم شركتك — هو ما يحدد مدة تطبيق الفوترة الإلكترونية الإماراتية. فمنظومة محاسبة سحابية نظيفة قد تعمل خلال أسابيع، بينما نظام مؤسسي مخصص ببيانات رئيسية فوضوية قد يستغرق ربعي سنة. يرسم هذا الدليل مسارات الربط الرئيسية وجداولها الواقعية.",
    sections: [
      {
        h: "مسارات الربط الأربعة",
        body: [
          "كل اتصال بمزود يؤول إلى أحد أربعة أنماط: موصل جاهز (مبني مسبقاً لنظامك وإصدارك — الأسرع والأكثر أماناً)، أو ربط عبر الواجهة البرمجية (يبنيه فريقك أو فريق المزود على واجهته الموثقة)، أو وسيط تكامل (منصة تكامل تربط أنظمتك بالمزود)، أو الإدخال عبر البوابة (تدخل الفواتير أو ترفعها في بوابة المزود — الحل الاحتياطي للأحجام الصغيرة والأنظمة غير المتصلة).",
        ],
      },
      {
        h: "أنظمة المؤسسات: SAP وOracle وDynamics",
        body: [
          "بالنسبة إلى SAP (ECC وS/4HANA) وOracle (E-Business Suite وFusion) وMicrosoft Dynamics 365، السؤال ليس أبداً «هل الربط ممكن» بل «هل يمتلك هذا المزود موصلاً مجرباً لإصداري وتخصيصاتي تحديداً». اطلب عملاء مرجعيين على إصدارك، ووضوحاً في التعامل مع الحقول المخصصة، وتحديد المسؤول عن تغييرات الربط لاحقاً. الجدول الواقعي: ثلاثة إلى ستة أشهر شاملة الاختبار.",
        ],
      },
      {
        h: "البرامج الإقليمية وبرامج الشركات الصغيرة: Tally وZoho وOdoo وQuickBooks وSage وXero",
        body: [
          "عدد من المزودين المعتمدين مبدئياً هم أنفسهم مطورو منتجات محاسبية إقليمية، ويحتفظ آخرون بموصلات لمنظومة الشركات الصغيرة الشائعة. إن كنت تستخدم Tally أو Zoho Books أو Odoo أو QuickBooks أو Sage أو Xero فاختصر القائمة على مزودين يعرضون تكاملاً عاملاً في عرض حي — فهذا شائع بما يكفي كي لا تقبل وعداً على خارطة طريق. الجدول الواقعي: أسبوعان إلى شهرين.",
        ],
      },
      {
        h: "الأنظمة المخصصة وجداول البيانات",
        body: [
          "تُربط أنظمة الفوترة المخصصة عبر الواجهة البرمجية للمزود — فقيّم جودة توثيقها قبل التوقيع لأنك ستتعايش معها. أما الشركات التي تفوتر من جداول بيانات أو أدوات مستقلة فأمامها خياران: اعتماد بوابة المزود للإدخال اليدوي (مجدٍ للأحجام الصغيرة) أو اتخاذ الإلزام دافعاً للانتقال أولاً إلى نظام محاسبي حقيقي.",
        ],
      },
      {
        h: "الجزء الذي يستهين به الجميع: تنظيف البيانات",
        body: [
          "معظم تأخيرات التشغيل مشاكلُ بيانات ترتدي زي التقنية. سيرفض تحقق الشبكة الفواتير ذات أرقام التسجيل الضريبي الناقصة أو غير الصالحة، والرموز الضريبية الخاطئة، والإجماليات غير المتسقة — لذا يجب أن يسبق التنظيفُ الاختبارَ، لا أن يبدأ بعد توالي الرفض.",
        ],
        list: [
          "اجمع وتحقق من أرقام التسجيل الضريبي لكل عميل B2B نشط",
          "اربط كل بند منتج/خدمة بالمعاملة الضريبية الصحيحة",
          "وحّد أسماء العملاء وعناوينهم وفق سجلات التسجيل الضريبي",
          "أرشف العملاء الخاملين كي لا يلوثوا التحقق",
          "اتفق مبكراً على قواعد التقريب بين نظامك ومزودك",
        ],
      },
      {
        h: "تسلسل مشروعك",
        body: [
          "تسلسل مجرب: عيّن مزود الخدمة أولاً (يوقف عداد الغرامات ويحجز موقعك في التأهيل)، ونفّذ تنظيف البيانات بالتوازي مع الربط التقني، ثم اختبر بعينات فواتير حقيقية عبر سيناريوهاتك الفعلية — إشعارات الدائن، والخصومات، وتعدد العملات — قبل التشغيل. يحوّل مخطط الجاهزية لدينا هذا التسلسل إلى معالم مؤرخة لمرحلتك.",
        ],
      },
    ],
    related: ["how-to-choose-an-asp", "peppol-pint-ae-explained", "uae-e-invoicing-timeline"],
  },
  {
    slug: "sme-guide-to-e-invoicing",
    title: "دليل الشركات الصغيرة والمتوسطة للفوترة الإلكترونية الإماراتية",
    metaTitle: "الفوترة الإلكترونية للشركات الصغيرة في الإمارات: دليل مبسط",
    metaDescription:
      "ما تعنيه الفوترة الإلكترونية الإماراتية للشركات الصغيرة والمتوسطة: موعدك في يوليو 2027، والتكلفة المتوقعة، وجاهزية برنامجك المحاسبي، والخطوات الخمس التي تتخذها الآن.",
    readingMinutes: 6,
    intro:
      "إذا كانت إيرادات منشأتك أقل من 50 مليون درهم سنوياً فمواعيدك للفوترة الإلكترونية في 2027 — وهو ما يبدو بعيداً بشكل مريح، وهذا تحديداً سبب اضطرار آلاف الشركات الصغيرة للتخبط في الربع الأخير. يقدم هذا الدليل للشركات الصغيرة النسخة الصادقة: ما الذي سيتغير، وكم سيكلف، والأشياء القليلة التي تستحق فعلها الآن.",
    sections: [
      {
        h: "تواريخك",
        body: [
          "على الشركات التي تقل إيراداتها السنوية عن 50 مليون درهم تعيين مزود خدمة معتمد بحلول 31 مارس 2027 والتشغيل بحلول 1 يوليو 2027. ومن تاريخ تشغيلك، يجب أن تمر فواتير المعاملات المشمولة عبر الشبكة — فملف PDF بالبريد الإلكتروني يتوقف عن الاحتساب كفاتورة لتلك المعاملات.",
        ],
      },
      {
        h: "التكلفة الفعلية",
        body: [
          "تسعير الشركات الصغيرة معقول فعلاً في معظم الحالات: يقدم عدة مزودين باقات دخول مسعّرة لمئات الفواتير شهرياً لا آلافها، وتضمّن بعض المنتجات المحاسبية الفوترة الإلكترونية في اشتراكاتها القائمة. المسار المكلف هو الانتظار — فالمتأخرون يحصلون على خيارات أقل وتأهيل متعجل وقدرة تفاوضية معدومة.",
          "ضع ميزانية لثلاثة مكونات: اشتراك المزود، وتكلفة تأهيل وربط لمرة واحدة، وبضعة أيام من وقت فريقك لتنظيف البيانات والاختبار.",
        ],
      },
      {
        h: "هل برنامجك المحاسبي جاهز؟",
        body: [
          "إن كنت تفوتر من منتج سحابي شائع — Zoho Books أو QuickBooks أو Xero أو Odoo أو Tally — فالجواب غالباً نعم عبر موصل مزود، ومشروعك صغير. أما إن كنت تفوتر من Word أو Excel أو أداة مخصصة، فالإلزام عملياً نقطةُ قرار لاعتماد نظام محاسبي حقيقي؛ والقيام بذلك أولاً يجعل خطوة الفوترة الإلكترونية سهلة للغاية.",
        ],
      },
      {
        h: "الأشياء الخمسة التي تستحق فعلها الآن",
        body: [],
        list: [
          "تأكد أنك تحت عتبة الـ50 مليون درهم (يستطيع محاسبك التحقق) لتعرف مرحلتك",
          "ابدأ جمع أرقام التسجيل الضريبي لعملائك المنتظمين — فهي سبب فشل التحقق الأول",
          "اسأل مزود برنامجك المحاسبي الحالي عن خطته للفوترة الإلكترونية الإماراتية",
          "ضع قائمة مختصرة بمزودين أو ثلاثة لديهم باقات للشركات الصغيرة (خدمة المطابقة لدينا تفعلها مجاناً)",
          "حدد موعداً للقرار لا يتجاوز الربع الأخير من 2026 — قبل موعد التعيين في مارس 2027 بوقت كافٍ",
        ],
      },
      {
        h: "الميزة التي لا يذكرها أحد",
        body: [
          "تُقدَّم الفوترة الإلكترونية كعبء امتثال، لكن الشركات الصغيرة التي خاضتها في دول أخرى تروي فوائد حقيقية: دورات سداد أسرع (الفواتير المنظمة لا تقبع في البريد)، ونزاعات أقل، وبيانات ضريبة جاهزة تلقائياً للإقرارات، ودفاتر أنظف. المتحركون مبكراً يجنون هذه الفوائد قبل منافسيهم بعام.",
        ],
      },
    ],
    related: ["uae-e-invoicing-timeline", "uae-e-invoicing-penalties", "how-to-choose-an-asp"],
  },
];

export const guidesContent: Record<Locale, Guide[]> = { en, ar };

export function getGuide(locale: Locale, slug: string): Guide | undefined {
  return guidesContent[locale].find((g) => g.slug === slug);
}

export const GUIDE_SLUGS = en.map((g) => g.slug);
