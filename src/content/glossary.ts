import type { Locale } from "@/lib/site";

export interface GlossaryTerm {
  term: string;
  def: string;
}

export const glossaryContent: Record<Locale, GlossaryTerm[]> = {
  en: [
    {
      term: "E-invoicing (electronic invoicing)",
      def: "Issuing, exchanging and reporting invoices as structured data files between systems — not as paper or PDF documents. In the UAE, e-invoices travel through accredited providers over the Peppol network, with tax data reported to the Federal Tax Authority automatically.",
    },
    {
      term: "Electronic Invoicing System",
      def: "The UAE's national e-invoicing framework, established by Ministerial Decision No. 243 of 2025, with its phased implementation timeline set by Ministerial Decision No. 244 of 2025 (as amended). It becomes mandatory in waves from January 2027.",
    },
    {
      term: "ASP (Accredited Service Provider)",
      def: "A company accredited under Ministerial Decision No. 64 of 2025 to transmit, validate and report e-invoices on behalf of UAE businesses. Every in-scope business must appoint one — you cannot connect to the system directly.",
    },
    {
      term: "Pre-approved service provider",
      def: "A provider that has passed the Ministry of Finance's eligibility stage (Article 15 of MD 64/2025) and appears on the official pre-approved list while completing full accreditation. This directory tracks that list daily.",
    },
    {
      term: "Peppol",
      def: "The international network for exchanging structured business documents, governed by OpenPeppol. Originally European, now used worldwide — the UAE built its e-invoicing system on Peppol infrastructure.",
    },
    {
      term: "Five-corner model",
      def: "The UAE's network design: supplier (1) → supplier's ASP (2) → buyer's ASP (3) → buyer (4), with the Federal Tax Authority (5) receiving tax data on every exchanged invoice. Also called a decentralised CTC (continuous transaction controls) model.",
    },
    {
      term: "PINT AE",
      def: "The UAE specialisation of the Peppol International (PINT) invoice format — the exact structured format a compliant UAE e-invoice must follow, including UAE-specific fields (BTAE codes) like the 8-digit transaction type flag string and AED tax amounts.",
    },
    {
      term: "EmaraTax",
      def: "The Federal Tax Authority's online tax portal. In e-invoicing, it is where businesses record their ASP appointment during onboarding — the invoices themselves flow through ASPs, not through EmaraTax.",
    },
    {
      term: "FTA (Federal Tax Authority)",
      def: "The UAE authority that administers taxes and receives e-invoice tax data as the fifth corner of the network.",
    },
    {
      term: "MoF (Ministry of Finance)",
      def: "The UAE ministry that owns the e-invoicing programme, accredits service providers and publishes the official pre-approved provider list.",
    },
    {
      term: "TRN (Tax Registration Number)",
      def: "A business's VAT registration number in the UAE. Valid TRNs for both supplier and buyer are among the most common validation requirements on e-invoices — and missing buyer TRNs are the most common go-live data problem.",
    },
    {
      term: "Invoice type code",
      def: "The code identifying what a UAE e-invoice document is: 380 (tax invoice), 381 (tax credit note), 480 (invoice out of scope of tax) or 81 (out-of-scope credit note).",
    },
    {
      term: "Transaction type flags (BTAE-02)",
      def: "An 8-digit string of 0s and 1s carried on every UAE e-invoice marking special transaction types — Free Trade Zone supply, deemed supply, margin scheme, summary invoice, continuous supply, disclosed agent, e-commerce, exports.",
    },
    {
      term: "Voluntary phase",
      def: "From 1 July 2026, any UAE business may adopt e-invoicing before its mandatory date. Early adopters are exempt from the mandate's administrative penalties until their own phase begins.",
    },
    {
      term: "Appointment deadline",
      def: "The date by which a business must have contracted an Accredited Service Provider: 30 October 2026 for businesses with revenue of AED 50 million or more, 31 March 2027 for others. Missing it costs AED 5,000 per month under Cabinet Decision No. 106 of 2025.",
    },
    {
      term: "Go-live date",
      def: "The date e-invoicing becomes mandatory for a business's in-scope transactions: 1 January 2027 (revenue ≥ AED 50M), 1 July 2027 (other businesses), 1 October 2027 (government entities).",
    },
    {
      term: "Master data",
      def: "The reference data behind invoices — customer names, TRNs, addresses, VAT codes, units. Cleaning it before integration is the single biggest predictor of a smooth e-invoicing go-live.",
    },
    {
      term: "UUID (BTAE-07)",
      def: "A universally unique identifier every UAE e-invoice must carry, distinguishing the document across the network independent of the human-readable invoice number.",
    },
  ],
  ar: [
    {
      term: "الفوترة الإلكترونية",
      def: "إصدار الفواتير وتبادلها ورفعها كملفات بيانات منظمة بين الأنظمة — لا كمستندات ورقية أو PDF. تمر الفواتير الإلكترونية الإماراتية عبر مزودين معتمدين على شبكة Peppol، وتُرفع بياناتها الضريبية إلى الهيئة الاتحادية للضرائب تلقائياً.",
    },
    {
      term: "نظام الفوترة الإلكترونية",
      def: "الإطار الوطني الإماراتي للفوترة الإلكترونية، المُنشأ بالقرار الوزاري رقم 243 لسنة 2025، مع جدول تطبيق مرحلي حدده القرار الوزاري رقم 244 لسنة 2025 (بصيغته المعدلة). يصبح إلزامياً على موجات من يناير 2027.",
    },
    {
      term: "مزود الخدمة المعتمد (ASP)",
      def: "شركة معتمدة بموجب القرار الوزاري رقم 64 لسنة 2025 لإرسال الفواتير الإلكترونية والتحقق منها ورفعها نيابة عن الشركات الإماراتية. على كل منشأة مشمولة تعيين مزود — فلا اتصال مباشراً بالنظام.",
    },
    {
      term: "المزود المعتمد مبدئياً",
      def: "مزود اجتاز مرحلة الأهلية لدى وزارة المالية (المادة 15 من القرار 64/2025) ويظهر على القائمة الرسمية للمعتمدين مبدئياً ريثما يكمل الاعتماد الكامل. يتابع هذا الدليل تلك القائمة يومياً.",
    },
    {
      term: "شبكة Peppol",
      def: "الشبكة الدولية لتبادل المستندات التجارية المنظمة، وتحكمها OpenPeppol. أوروبية المنشأ وتُستخدم اليوم عالمياً — وقد بنت الإمارات نظامها للفوترة الإلكترونية على بنيتها.",
    },
    {
      term: "نموذج الزوايا الخمس",
      def: "تصميم الشبكة الإماراتي: المورد (1) ← مزوده (2) ← مزود المشتري (3) ← المشتري (4)، مع تلقي الهيئة الاتحادية للضرائب (5) البيانات الضريبية لكل فاتورة متبادلة. ويسمى أيضاً نموذج الرقابة المستمرة اللامركزية على المعاملات.",
    },
    {
      term: "صيغة PINT AE",
      def: "التخصيص الإماراتي لصيغة فواتير Peppol الدولية (PINT) — الصيغة المنظمة الدقيقة التي يجب أن تتبعها الفاتورة الإماراتية الممتثلة، بما فيها الحقول الإماراتية (رموز BTAE) كسلسلة أعلام المعاملات ومبالغ الضريبة بالدرهم.",
    },
    {
      term: "إمارات تاكس (EmaraTax)",
      def: "بوابة الهيئة الاتحادية للضرائب الإلكترونية. في الفوترة الإلكترونية، فيها تسجل المنشآت تعيين مزودها المعتمد أثناء التأهيل — أما الفواتير نفسها فتمر عبر المزودين لا عبر البوابة.",
    },
    {
      term: "الهيئة الاتحادية للضرائب",
      def: "الجهة الإماراتية التي تدير الضرائب وتتلقى البيانات الضريبية للفواتير الإلكترونية بوصفها الزاوية الخامسة في الشبكة.",
    },
    {
      term: "وزارة المالية",
      def: "الوزارة الإماراتية المالكة لبرنامج الفوترة الإلكترونية، وتعتمد مزودي الخدمة وتنشر القائمة الرسمية للمعتمدين مبدئياً.",
    },
    {
      term: "رقم التسجيل الضريبي (TRN)",
      def: "رقم تسجيل المنشأة في ضريبة القيمة المضافة الإماراتية. أرقام التسجيل الصحيحة للمورد والمشتري من أكثر متطلبات التحقق شيوعاً — وغياب رقم المشتري أكثر مشاكل بيانات التشغيل شيوعاً.",
    },
    {
      term: "رمز نوع الفاتورة",
      def: "الرمز الذي يحدد ماهية مستند الفاتورة الإماراتية: 380 (فاتورة ضريبية)، 381 (إشعار دائن ضريبي)، 480 (فاتورة خارج نطاق الضريبة)، 81 (إشعار دائن خارج النطاق).",
    },
    {
      term: "أعلام أنواع المعاملات (BTAE-02)",
      def: "سلسلة من 8 خانات (0 و1) تحملها كل فاتورة إماراتية لتمييز أنواع المعاملات الخاصة — توريد منطقة حرة، توريد اعتباري، هامش الربح، فاتورة مجمعة، توريد مستمر، وكيل معلن، تجارة إلكترونية، صادرات.",
    },
    {
      term: "المرحلة الطوعية",
      def: "من 1 يوليو 2026 يمكن لأي منشأة إماراتية تبني الفوترة الإلكترونية قبل تاريخها الإلزامي. والمتبنون مبكراً معفون من الغرامات الإدارية حتى بدء مرحلتهم.",
    },
    {
      term: "موعد التعيين",
      def: "التاريخ الذي يجب أن تتعاقد المنشأة قبله مع مزود خدمة معتمد: 30 أكتوبر 2026 للشركات بإيرادات 50 مليون درهم فأكثر، و31 مارس 2027 لغيرها. تفويته يكلف 5,000 درهم شهرياً بموجب قرار مجلس الوزراء 106 لسنة 2025.",
    },
    {
      term: "تاريخ التشغيل",
      def: "تاريخ صيرورة الفوترة الإلكترونية إلزامية لمعاملات المنشأة المشمولة: 1 يناير 2027 (إيرادات ≥ 50 مليون درهم)، 1 يوليو 2027 (باقي الشركات)، 1 أكتوبر 2027 (الجهات الحكومية).",
    },
    {
      term: "البيانات الرئيسية",
      def: "البيانات المرجعية خلف الفواتير — أسماء العملاء وأرقام تسجيلهم الضريبي والعناوين والرموز الضريبية والوحدات. تنظيفها قبل الربط هو المؤشر الأكبر على تشغيل سلس.",
    },
    {
      term: "المعرف الفريد (BTAE-07)",
      def: "معرف فريد عالمياً يجب أن تحمله كل فاتورة إماراتية، يميز المستند عبر الشبكة بمعزل عن رقم الفاتورة المقروء.",
    },
  ],
};
