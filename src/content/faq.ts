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
      q: "What information does the official pre-approved list include?",
      a: "For every pre-approved service provider, the Ministry of Finance's list records the company name, company website, one or more designated contact persons, their email addresses and phone numbers, in alphabetical order. Our registry page mirrors exactly these fields, so you can reach any provider's official e-invoicing contact directly — and each provider also has a fuller profile page on this site with background, category and regional experience.",
    },
    {
      q: "How do I contact a pre-approved provider directly?",
      a: "Every provider designates an official contact person for e-invoicing enquiries, published with an email address and phone number. You'll find all of them on our registry page and on each provider's profile. If you'd rather not approach dozens of vendors one by one, our free matching service does the comparison for you and introduces you to the best fit for your requirements and budget.",
    },
    {
      q: "What is the difference between the directory and the registry on this site?",
      a: "The directory presents each provider as a browsable profile — background, category, regional experience and websites — designed for comparing options. The registry mirrors the official list format: a single alphabetical table of all providers with their designated contact persons, emails and phone numbers, useful when you need official contact details at a glance.",
    },
    {
      q: "Is this the official Ministry of Finance list?",
      a: "This directory is independent and is not affiliated with the UAE Ministry of Finance. We track the Ministry's official pre-approved service provider list closely and show the date the directory was last updated. For official confirmation of any provider's status, always refer to the Ministry of Finance's website.",
    },
    {
      q: "Do I need e-invoicing if my business is not VAT-registered?",
      a: "In many cases, yes. The Electronic Invoicing System applies to persons conducting business in the UAE for in-scope transactions — the framework is broader than VAT registration alone, and non-registered businesses can fall within it for B2B and B2G flows. Small businesses get later deadlines, not a blanket exemption; confirm your position with a tax adviser rather than assuming exclusion.",
    },
    {
      q: "Does UAE e-invoicing cover B2C (consumer) sales?",
      a: "Not initially. Business-to-consumer transactions are outside the current scope of the mandate — but the exclusion is temporary by design: B2C remains out of scope until a future Ministerial decision brings it in. Retailers should build with that extension in mind, especially when choosing a provider whose platform can handle receipt-level volumes later.",
    },
    {
      q: "What is EmaraTax's role in e-invoicing?",
      a: "EmaraTax is the Federal Tax Authority's tax portal, and it is where businesses record their Accredited Service Provider appointment as part of onboarding. Your ASP guides you through this step. Note that EmaraTax is not the invoicing channel itself — invoices flow through your ASP over the Peppol network, with tax data reported to the FTA automatically.",
    },
    {
      q: "When exactly does e-invoicing start in the UAE?",
      a: "Voluntary adoption and the pilot began on 1 July 2026. Mandatory dates then arrive in waves: businesses with annual revenue of AED 50 million or more must appoint an Accredited Service Provider by 30 October 2026 and issue e-invoices from 1 January 2027; all other businesses appoint by 31 March 2027 and go live by 1 July 2027; government entities follow by 1 October 2027.",
    },
    {
      q: "Is an XML file required, or can I keep sending PDFs?",
      a: "A compliant UAE e-invoice is a structured XML document in the PINT AE format, transmitted through your Accredited Service Provider. From your mandatory date, a PDF attached to an email no longer counts as an invoice for in-scope transactions — though human-readable copies can still accompany the structured invoice for convenience.",
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
      q: "ما المعلومات التي تتضمنها القائمة الرسمية للمعتمدين مبدئياً؟",
      a: "تسجل قائمة وزارة المالية لكل مزود معتمد مبدئياً: اسم الشركة وموقعها الإلكتروني وجهة اتصال معينة أو أكثر مع بريدها الإلكتروني وأرقام هواتفها، بالترتيب الأبجدي. تعكس صفحة السجل لدينا هذه الحقول نفسها بدقة لتتمكن من الوصول مباشرة إلى جهة الاتصال الرسمية لأي مزود — ولكل مزود أيضاً صفحة ملف أوسع في موقعنا تتضمن الخلفية والفئة والخبرة الإقليمية.",
    },
    {
      q: "كيف أتواصل مباشرة مع مزود معتمد مبدئياً؟",
      a: "يعين كل مزود جهة اتصال رسمية لاستفسارات الفوترة الإلكترونية، منشورة مع بريد إلكتروني ورقم هاتف. تجدها جميعاً في صفحة السجل وفي ملف كل مزود. وإذا كنت لا تفضل مخاطبة عشرات المزودين واحداً واحداً، تقوم خدمة الترشيح المجانية لدينا بالمقارنة نيابة عنك وتعرّفك على الأنسب لمتطلباتك وميزانيتك.",
    },
    {
      q: "ما الفرق بين الدليل والسجل في هذا الموقع؟",
      a: "يعرض الدليل كل مزود كملف تعريفي قابل للتصفح — الخلفية والفئة والخبرة الإقليمية والمواقع — وهو مصمم للمقارنة بين الخيارات. أما السجل فيعكس صيغة القائمة الرسمية: جدول أبجدي واحد لجميع المزودين مع جهات الاتصال المعينة والبريد الإلكتروني وأرقام الهاتف، وهو مفيد عندما تحتاج بيانات التواصل الرسمية في لمحة واحدة.",
    },
    {
      q: "هل هذه هي القائمة الرسمية لوزارة المالية؟",
      a: "هذا الدليل مستقل وغير تابع لوزارة المالية الإماراتية. نتابع القائمة الرسمية للمزودين المعتمدين مبدئياً عن قرب ونعرض تاريخ آخر تحديث للدليل. للتأكد الرسمي من حالة أي مزود، ارجع دائماً إلى موقع وزارة المالية.",
    },
    {
      q: "هل أحتاج الفوترة الإلكترونية إذا لم تكن منشأتي مسجلة في ضريبة القيمة المضافة؟",
      a: "في حالات كثيرة، نعم. يسري نظام الفوترة الإلكترونية على الأشخاص الذين يمارسون الأعمال في الإمارات للمعاملات المشمولة — فالإطار أوسع من التسجيل الضريبي وحده، وقد تقع المنشآت غير المسجلة ضمنه لمعاملات الأعمال والجهات الحكومية. الشركات الصغيرة تحصل على مواعيد لاحقة لا إعفاءً شاملاً؛ فتأكد من وضعك مع مستشار ضريبي بدل افتراض الاستثناء.",
    },
    {
      q: "هل تشمل الفوترة الإلكترونية الإماراتية مبيعات المستهلكين (B2C)؟",
      a: "ليس مبدئياً. معاملات المستهلكين خارج النطاق الحالي للإلزام — لكن الاستثناء مؤقت بطبيعته: يبقى قطاع B2C خارج النطاق حتى صدور قرار وزاري لاحق يُدخله. وعلى تجار التجزئة البناء مع أخذ هذا التوسع بالحسبان، خاصة عند اختيار مزود تستطيع منصته التعامل لاحقاً مع أحجام الإيصالات.",
    },
    {
      q: "ما دور منصة إمارات تاكس (EmaraTax) في الفوترة الإلكترونية؟",
      a: "إمارات تاكس هي بوابة الهيئة الاتحادية للضرائب، وفيها تسجل المنشآت تعيين مزود الخدمة المعتمد ضمن خطوات التأهيل، ويرشدك مزودك خلال هذه الخطوة. لكن إمارات تاكس ليست قناة الفوترة نفسها — فالفواتير تمر عبر مزودك على شبكة Peppol، وتُرفع البيانات الضريبية للهيئة تلقائياً.",
    },
    {
      q: "متى تبدأ الفوترة الإلكترونية في الإمارات تحديداً؟",
      a: "بدأ التبني الطوعي والتجربة في 1 يوليو 2026. ثم تصل التواريخ الإلزامية على موجات: الشركات التي تبلغ إيراداتها السنوية 50 مليون درهم أو أكثر تعيّن مزود خدمة معتمداً بحلول 30 أكتوبر 2026 وتصدر الفواتير الإلكترونية من 1 يناير 2027؛ وتعيّن باقي الشركات بحلول 31 مارس 2027 وتشغّل بحلول 1 يوليو 2027؛ وتتبع الجهات الحكومية بحلول 1 أكتوبر 2027.",
    },
    {
      q: "هل ملف XML مطلوب أم يمكنني مواصلة إرسال PDF؟",
      a: "الفاتورة الإلكترونية الإماراتية الممتثلة مستند XML منظم بصيغة PINT AE يُرسل عبر مزود الخدمة المعتمد. ومن تاريخك الإلزامي لا يعود ملف PDF المرفق بالبريد فاتورةً للمعاملات المشمولة — وإن جاز أن ترافق النسخُ المقروءة الفاتورةَ المنظمة للتيسير.",
    },
  ],
};
