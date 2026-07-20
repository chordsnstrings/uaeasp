export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Long-form FAQ content, kept in TS (not messages JSON) because it feeds both
 * the FAQ page and the FAQPage JSON-LD. Keep answers factual and hedged where
 * the official timeline may still evolve.
 */
export const faqContent: Record<"en" | "ar", FaqItem[]> = {
  en: [
    {
      q: "Is e-invoicing mandatory in the UAE?",
      a: "Yes — the UAE is introducing mandatory e-invoicing through the Ministry of Finance's Electronic Invoicing System. The framework was established by Ministerial Decision No. 64 of 2025, and the rollout is phased: a pilot programme first, followed by mandatory adoption in waves based on business size. Businesses in scope must issue, exchange and report invoices electronically through an Accredited Service Provider (ASP).",
    },
    {
      q: "What is the UAE e-invoicing timeline?",
      a: "The rollout is phased. The pilot phase began in 2026 with selected businesses, and mandatory adoption follows in waves — larger businesses (by annual revenue) first, then progressively smaller ones. Exact go-live dates for each wave are announced by the Ministry of Finance and the Federal Tax Authority. Because implementation typically takes several months (integration, testing, training), businesses are strongly advised to select their service provider well before their mandatory date.",
    },
    {
      q: "What is an Accredited Service Provider (ASP)?",
      a: "An Accredited Service Provider is a company approved under the UAE Ministry of Finance's accreditation framework to transmit, validate and report e-invoices on behalf of businesses. Under the UAE's five-corner (Peppol-based) model, both the sender and the receiver of an invoice connect through their respective ASPs, and tax data is reported to the authorities automatically. Businesses cannot connect to the system directly — they must use an ASP.",
    },
    {
      q: "What does 'pre-approved' mean on the official list?",
      a: "Pre-approval is a provisional stage in the Ministry of Finance's accreditation process under Ministerial Decision No. 64 of 2025. Pre-approved providers have met the eligibility criteria and can participate in testing and onboarding activities while completing the final accreditation steps. The Ministry updates the official list periodically as new providers are approved — this directory tracks the same list and shows its last update date.",
    },
    {
      q: "What is Peppol PINT AE?",
      a: "PINT AE is the UAE-specific version of the international Peppol invoice format (Peppol Interoperable iNvoice Type). It defines exactly which fields a UAE e-invoice must contain — VAT details, tax registration numbers, line items and so on — so that any sender and receiver on the network can exchange invoices without custom mappings. Your ASP converts invoices from your accounting or ERP system into PINT AE and validates them before transmission.",
    },
    {
      q: "How much does an e-invoicing service provider cost in the UAE?",
      a: "Pricing varies enormously. Entry-level SME packages can start from a modest monthly subscription, while enterprise implementations with deep ERP integration, high invoice volumes and service-level guarantees can run into significant annual contracts. Most providers price on some combination of invoice volume, number of entities and integrations. This is exactly why we offer free matching: tell us your volume and budget and we'll shortlist providers that genuinely fit your price point.",
    },
    {
      q: "Does e-invoicing apply to my small business?",
      a: "Eventually, yes — the mandate is being phased in by business size, with larger businesses first. Small businesses get more time, but not an exemption. Starting early has real advantages: more provider choice, calmer implementation and time to clean up master data. Many providers offer affordable SME plans, and choosing one early avoids the rush as each wave's deadline approaches.",
    },
    {
      q: "Can I just email PDF invoices instead?",
      a: "No. Once your wave becomes mandatory, a PDF sent by email is not a compliant e-invoice. A compliant invoice is a structured data file (PINT AE format) transmitted through the accredited network, with tax data reported to the authorities. Paper and PDF invoices will not satisfy the mandate for transactions in scope.",
    },
    {
      q: "How do I choose between the pre-approved providers?",
      a: "The main factors are: integration with your existing accounting/ERP software, pricing model versus your invoice volume, onboarding and support quality (including Arabic-language support if you need it), regional experience (for example, providers that already handle Saudi ZATCA e-invoicing), and financial stability. Our team tracks all of the pre-approved providers and offers free, no-obligation matching against your requirements and budget.",
    },
    {
      q: "What happens if I don't comply?",
      a: "Non-compliant businesses face administrative penalties under UAE tax law, and — just as importantly — operational risk: in-scope trading partners will expect to exchange invoices through the network, and government entities will require it. Late movers also face compressed implementation timelines and less provider bandwidth as deadlines approach.",
    },
    {
      q: "Is this the official Ministry of Finance list?",
      a: "This directory is independent and is not affiliated with the UAE Ministry of Finance. We track the Ministry's official pre-approved service provider list closely and show the date the directory was last updated. For official confirmation of any provider's status, always refer to the Ministry of Finance's website.",
    },
  ],
  ar: [
    {
      q: "هل الفوترة الإلكترونية إلزامية في الإمارات؟",
      a: "نعم — تطبق دولة الإمارات الفوترة الإلكترونية الإلزامية عبر منظومة الفوترة الإلكترونية التابعة لوزارة المالية. تأسس الإطار بموجب القرار الوزاري رقم 64 لسنة 2025، ويتم التطبيق على مراحل: برنامج تجريبي أولاً، ثم إلزام تدريجي على دفعات حسب حجم الأعمال. يجب على الشركات المشمولة إصدار الفواتير وتبادلها والإبلاغ عنها إلكترونياً عبر مزود خدمة معتمد (ASP).",
    },
    {
      q: "ما هو الجدول الزمني للفوترة الإلكترونية في الإمارات؟",
      a: "التطبيق تدريجي. بدأت المرحلة التجريبية في 2026 مع شركات مختارة، ويلي ذلك الإلزام على دفعات — الشركات الأكبر (حسب الإيرادات السنوية) أولاً ثم الأصغر تدريجياً. تعلن وزارة المالية والهيئة الاتحادية للضرائب المواعيد الرسمية لكل دفعة. ولأن التنفيذ يستغرق عادة عدة أشهر (تكامل واختبار وتدريب)، يُنصح بشدة باختيار مزود الخدمة قبل موعد الإلزام بوقت كافٍ.",
    },
    {
      q: "ما هو مزود الخدمة المعتمد (ASP)؟",
      a: "مزود الخدمة المعتمد هو شركة معتمدة ضمن إطار اعتماد وزارة المالية الإماراتية لنقل الفواتير الإلكترونية والتحقق منها والإبلاغ عنها نيابة عن الشركات. وفق نموذج الزوايا الخمس المعتمد على شبكة Peppol، يتصل مرسل الفاتورة ومستلمها عبر مزوديهما المعتمدين، ويتم إبلاغ البيانات الضريبية للجهات تلقائياً. لا يمكن للشركات الاتصال بالمنظومة مباشرة — بل يجب استخدام مزود معتمد.",
    },
    {
      q: "ماذا تعني «الموافقة المبدئية» في القائمة الرسمية؟",
      a: "الموافقة المبدئية مرحلة مؤقتة في عملية الاعتماد لدى وزارة المالية بموجب القرار الوزاري رقم 64 لسنة 2025. المزودون المعتمدون مبدئياً استوفوا معايير الأهلية ويمكنهم المشاركة في أنشطة الاختبار والتهيئة بينما يكملون خطوات الاعتماد النهائي. تحدّث الوزارة القائمة الرسمية دورياً مع اعتماد مزودين جدد — ويتابع هذا الدليل القائمة نفسها ويعرض تاريخ آخر تحديث.",
    },
    {
      q: "ما هو معيار Peppol PINT AE؟",
      a: "PINT AE هو النسخة الإماراتية من صيغة فواتير Peppol الدولية. يحدد بدقة الحقول التي يجب أن تحتويها الفاتورة الإلكترونية الإماراتية — بيانات ضريبة القيمة المضافة وأرقام التسجيل الضريبي وبنود الفاتورة وغيرها — بحيث يستطيع أي مرسل ومستقبل على الشبكة تبادل الفواتير دون تخصيصات. يقوم مزود الخدمة بتحويل فواتيرك من نظام المحاسبة إلى صيغة PINT AE والتحقق منها قبل الإرسال.",
    },
    {
      q: "كم تكلف خدمات الفوترة الإلكترونية في الإمارات؟",
      a: "تتفاوت الأسعار بشدة. باقات الشركات الصغيرة قد تبدأ باشتراك شهري متواضع، بينما قد تصل تنفيذات المؤسسات الكبرى ذات التكامل العميق والأحجام الكبيرة إلى عقود سنوية كبيرة. يعتمد التسعير عادة على حجم الفواتير وعدد الكيانات والتكاملات. ولهذا نقدم خدمة الترشيح المجانية: أخبرنا بحجمك وميزانيتك وسنختصر القائمة للمزودين المناسبين فعلاً لسعرك.",
    },
    {
      q: "هل تنطبق الفوترة الإلكترونية على شركتي الصغيرة؟",
      a: "نعم في نهاية المطاف — يُطبق الإلزام تدريجياً حسب حجم الأعمال، والشركات الكبرى أولاً. الشركات الصغيرة لديها وقت أطول لكن لا إعفاء. البدء المبكر له مزايا حقيقية: خيارات أوسع وتنفيذ أهدأ ووقت لتنظيف البيانات. كثير من المزودين يقدمون باقات اقتصادية للشركات الصغيرة، واختيار مزود مبكراً يجنبك الازدحام مع اقتراب المواعيد.",
    },
    {
      q: "هل يمكنني الاكتفاء بإرسال فواتير PDF بالبريد الإلكتروني؟",
      a: "لا. بعد سريان الإلزام على دفعتك، لا يُعد ملف PDF المرسل بالبريد فاتورة إلكترونية متوافقة. الفاتورة المتوافقة هي ملف بيانات منظم (بصيغة PINT AE) يُنقل عبر الشبكة المعتمدة مع إبلاغ البيانات الضريبية للجهات. الفواتير الورقية وملفات PDF لن تفي بمتطلبات الإلزام للمعاملات المشمولة.",
    },
    {
      q: "كيف أختار بين المزودين المعتمدين مبدئياً؟",
      a: "العوامل الرئيسية: التكامل مع برنامج المحاسبة أو تخطيط الموارد الحالي، ونموذج التسعير مقابل حجم فواتيرك، وجودة التهيئة والدعم (بما فيها الدعم باللغة العربية إن احتجته)، والخبرة الإقليمية (مثلاً مزودون يخدمون فوترة هيئة الزكاة والضريبة السعودية)، والاستقرار المالي. فريقنا يتابع جميع المزودين المعتمدين ويقدم ترشيحاً مجانياً دون التزام وفق متطلباتك وميزانيتك.",
    },
    {
      q: "ماذا يحدث إذا لم أمتثل؟",
      a: "تواجه الشركات غير الممتثلة غرامات إدارية بموجب التشريعات الضريبية الإماراتية، والأهم مخاطر تشغيلية: الشركاء التجاريون المشمولون سيتوقعون تبادل الفواتير عبر الشبكة، والجهات الحكومية ستشترطه. كما يواجه المتأخرون جداول تنفيذ مضغوطة وطاقة أقل لدى المزودين مع اقتراب المواعيد.",
    },
    {
      q: "هل هذه هي القائمة الرسمية لوزارة المالية؟",
      a: "هذا الدليل مستقل وغير تابع لوزارة المالية الإماراتية. نتابع القائمة الرسمية للمزودين المعتمدين مبدئياً عن قرب ونعرض تاريخ آخر تحديث للدليل. للتأكد الرسمي من حالة أي مزود، ارجع دائماً إلى موقع وزارة المالية.",
    },
  ],
};
