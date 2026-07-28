import type { Locale } from "@/lib/site";

/**
 * Query-cluster landing pages.
 *
 * Search Console showed /providers competing for roughly twenty distinct
 * generic phrases and winning none of them — "accredited service provider uae
 * e-invoicing" at position 56, "e invoicing service providers" at 57, "approved
 * asp in uae" at 55 — while every single-purpose provider profile ranks 4-6 for
 * its own name. Same domain, same authority; the difference is that a profile
 * page targets one thing.
 *
 * Each entry below is one cluster of phrases that mean the same thing to a
 * searcher, given its own page with its own heading, intro and questions.
 * These are not thin variants of each other: each answers a different question
 * a buyer is actually asking, and each links to the others so the cluster
 * reads as a set rather than as duplicates.
 */

export interface LandingFaq {
  q: string;
  a: string;
}

export interface LandingCopy {
  /** Route segment, also the canonical path. */
  slug: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  /** Short lead-in above the provider list. */
  listHeading: string;
  listIntro: string;
  faq: LandingFaq[];
  /** Slugs of sibling landings to cross-link. */
  related: string[];
}

export const LANDING_SLUGS = [
  "accredited-service-providers",
  "e-invoicing-service-providers",
] as const;

export type LandingSlug = (typeof LANDING_SLUGS)[number];

export const landingContent: Record<Locale, Record<LandingSlug, LandingCopy>> = {
  en: {
    "accredited-service-providers": {
      slug: "accredited-service-providers",
      metaTitle: "Accredited Service Providers (ASPs) for UAE E-Invoicing — Full List",
      metaDescription:
        "Every Accredited Service Provider approved by the UAE Ministry of Finance for e-invoicing, with contact details and accreditation status. Updated daily, free to use.",
      h1: "Accredited Service Providers for UAE e-invoicing",
      intro:
        "An Accredited Service Provider, or ASP, is a company the UAE Ministry of Finance has approved to transmit e-invoices on a business's behalf. From the mandate dates onward, invoices must pass through one. This page lists every provider currently on the Ministry's list, checked against the official register every night.",
      listHeading: "The complete list",
      listIntro:
        "Each entry links to a full profile with contact details, category and the date we first saw it on the Ministry's list.",
      faq: [
        {
          q: "What does ASP stand for in UAE e-invoicing?",
          a: "ASP stands for Accredited Service Provider. It is a company the Ministry of Finance has approved to issue, transmit and receive e-invoices through the Peppol network on behalf of UAE businesses. Only an accredited provider may do this once the mandate applies to you.",
        },
        {
          q: "Is an approved ASP the same as an accredited one?",
          a: "In practice the Ministry's own register has used the wording 'pre-approved' and 'accredited' at different points, and the public list has grown over time. We track the register nightly and record when a provider is added, changed or removed, so the status shown here reflects the Ministry's current published list rather than a snapshot taken once.",
        },
        {
          q: "How do I choose between accredited service providers?",
          a: "Start with whether the provider integrates with the accounting or ERP system you already run, then look at your monthly invoice volume, whether you need Arabic support, and what the provider commits to on data export if you ever leave. Our free shortlist service narrows the list to three based on those answers.",
        },
        {
          q: "Does it cost anything to use this directory?",
          a: "No. We are an independent directory, not a provider, and we take no payment from the companies listed. The list and every profile are free to browse without signing up.",
        },
      ],
      related: ["e-invoicing-service-providers"],
    },
    "e-invoicing-service-providers": {
      slug: "e-invoicing-service-providers",
      metaTitle: "E-Invoicing Service Providers in the UAE — Compare All Companies",
      metaDescription:
        "Compare every e-invoicing service provider operating in the UAE by category, emirate and integration. Independent, free, and rebuilt from the official register every night.",
      h1: "E-invoicing service providers in the UAE",
      intro:
        "The companies below supply e-invoicing software and services to UAE businesses and are approved by the Ministry of Finance to transmit invoices. They differ widely: some are full ERP vendors, some are tax-technology specialists, some are network operators. This page groups them so you can tell which kind you are looking at before you contact anyone.",
      listHeading: "Every provider, by category",
      listIntro:
        "Filter by what the company actually is — ERP, tax technology, consultancy, network operator — rather than by marketing claims.",
      faq: [
        {
          q: "What is an e-invoicing service provider?",
          a: "It is a company that converts your invoices into the required PINT AE format and transmits them over the Peppol network to your customer and to the tax authority. In the UAE the provider must be accredited by the Ministry of Finance for those invoices to be valid.",
        },
        {
          q: "Which e-invoicing provider works with my accounting software?",
          a: "It depends on what you run. Providers differ sharply here: some offer certified connectors for SAP, Oracle, Dynamics, TallyPrime, Zoho, Odoo, QuickBooks or Xero, while others only offer a portal you upload to manually, which does not scale beyond a handful of invoices a month. Our integrations page groups providers by the systems they support.",
        },
        {
          q: "How many e-invoicing providers are there in the UAE?",
          a: "The number has grown steadily as the Ministry of Finance accredits more companies. Rather than quote a figure that goes stale, this page is rebuilt from the official register every night and the count shown is what the register said at that point.",
        },
        {
          q: "Can I switch e-invoicing providers later?",
          a: "Yes, but it is an integration project rather than a form: you re-do the connection to your accounting system, repeat testing, and reconfirm your Peppol participant identifier. Because of that, ask any provider about notice periods and data export before you sign, not after.",
        },
      ],
      related: ["accredited-service-providers"],
    },
  },
  ar: {
    "accredited-service-providers": {
      slug: "accredited-service-providers",
      metaTitle: "مزودو الخدمة المعتمدون للفوترة الإلكترونية في الإمارات — القائمة الكاملة",
      metaDescription:
        "كل مزود خدمة معتمد من وزارة المالية الإماراتية للفوترة الإلكترونية، مع بيانات التواصل وحالة الاعتماد. يُحدَّث يومياً والاستخدام مجاني.",
      h1: "مزودو الخدمة المعتمدون للفوترة الإلكترونية في الإمارات",
      intro:
        "مزود الخدمة المعتمد هو شركة وافقت عليها وزارة المالية لإرسال الفواتير الإلكترونية نيابة عن المنشأة. ابتداءً من مواعيد الإلزام يجب أن تمر الفواتير عبر أحد هؤلاء المزودين. تعرض هذه الصفحة كل مزود مدرج حالياً في قائمة الوزارة، ونتحقق من السجل الرسمي كل ليلة.",
      listHeading: "القائمة الكاملة",
      listIntro: "يفتح كل مدخل ملفاً كاملاً يضم بيانات التواصل والتصنيف وتاريخ إدراجه في القائمة.",
      faq: [
        {
          q: "ما معنى مزود خدمة معتمد في الفوترة الإلكترونية؟",
          a: "هو شركة اعتمدتها وزارة المالية لإصدار الفواتير الإلكترونية وإرسالها واستقبالها عبر شبكة Peppol نيابة عن منشآت الدولة. ولا يجوز لغير المعتمدين القيام بذلك بعد سريان الإلزام عليك.",
        },
        {
          q: "كيف أختار بين مزودي الخدمة المعتمدين؟",
          a: "ابدأ بمدى تكامل المزود مع النظام المحاسبي أو نظام تخطيط الموارد الذي تستخدمه، ثم انظر إلى حجم فواتيرك الشهري، وحاجتك للدعم بالعربية، والتزامات المزود بتصدير بياناتك إذا قررت الانتقال لاحقاً.",
        },
        {
          q: "هل استخدام هذا الدليل مجاني؟",
          a: "نعم. نحن دليل مستقل ولسنا مزوداً، ولا نتقاضى أي مقابل من الشركات المدرجة. القائمة وكل الملفات متاحة مجاناً دون تسجيل.",
        },
      ],
      related: ["e-invoicing-service-providers"],
    },
    "e-invoicing-service-providers": {
      slug: "e-invoicing-service-providers",
      metaTitle: "مزودو خدمات الفوترة الإلكترونية في الإمارات — قارن بين الشركات",
      metaDescription:
        "قارن بين كل مزودي خدمات الفوترة الإلكترونية في الإمارات حسب التصنيف والإمارة والتكامل. دليل مستقل ومجاني يُعاد بناؤه من السجل الرسمي كل ليلة.",
      h1: "مزودو خدمات الفوترة الإلكترونية في الإمارات",
      intro:
        "الشركات أدناه توفّر برامج وخدمات الفوترة الإلكترونية لمنشآت الدولة، وهي معتمدة من وزارة المالية لإرسال الفواتير. وهي تختلف كثيراً فيما بينها: بعضها موردو أنظمة تخطيط موارد، وبعضها متخصص في تقنيات الضرائب، وبعضها مشغّلو شبكات.",
      listHeading: "كل المزودين حسب التصنيف",
      listIntro: "صنّف حسب طبيعة الشركة الفعلية لا حسب ما تعلنه.",
      faq: [
        {
          q: "ما هو مزود خدمات الفوترة الإلكترونية؟",
          a: "شركة تحوّل فواتيرك إلى صيغة PINT AE المطلوبة وترسلها عبر شبكة Peppol إلى عميلك وإلى الجهة الضريبية. ويجب أن يكون المزود معتمداً من وزارة المالية حتى تكون الفواتير صحيحة.",
        },
        {
          q: "أي مزود يتكامل مع برنامجي المحاسبي؟",
          a: "يعتمد على ما تستخدمه. يختلف المزودون بشكل كبير هنا: بعضهم يوفر روابط معتمدة مع SAP وOracle وDynamics وTallyPrime وZoho وOdoo، وبعضهم لا يوفر سوى بوابة ترفع إليها الفواتير يدوياً وهو ما لا يصلح لأحجام كبيرة.",
        },
        {
          q: "هل يمكنني تغيير المزود لاحقاً؟",
          a: "نعم، لكنه مشروع تكامل وليس مجرد نموذج: ستعيد الربط مع نظامك المحاسبي وتكرر الاختبارات وتؤكد معرّف مشاركتك في Peppol. لذلك اسأل عن مدة الإشعار وتصدير البيانات قبل التوقيع.",
        },
      ],
      related: ["accredited-service-providers"],
    },
  },
};
