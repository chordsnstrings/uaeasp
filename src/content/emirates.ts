import type { Locale } from "@/lib/site";
import type { Emirate } from "@/db/schema";

export interface EmirateCopy {
  name: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  faq: { q: string; a: string }[];
}

export const emirateContent: Record<Locale, Record<Emirate, EmirateCopy>> = {
  en: {
    dubai: {
      name: "Dubai",
      metaTitle: "E-Invoicing in Dubai: Providers, Deadlines & Free Matching",
      metaDescription:
        "UAE e-invoicing for Dubai businesses: which pre-approved providers to choose, mainland and free zone scope (DMCC, JAFZA, DIFC), deadlines and penalties. Get matched free.",
      intro: [
        "Dubai is home to the largest share of businesses affected by the UAE e-invoicing mandate — from DIFC financial firms and DMCC commodity traders to JAFZA logistics operators and tens of thousands of mainland SMEs. The mandate applies across mainland and free zones alike: what matters is your revenue phase and transaction scope, not where your licence was issued.",
        "Every provider in this directory serves Dubai-based businesses, and most are headquartered or staffed here. That means genuine choice — and it makes structured comparison (integration fit, pricing versus your volume, onboarding capacity) more valuable than in any other emirate.",
      ],
      faq: [
        {
          q: "Does UAE e-invoicing apply to Dubai free zone companies?",
          a: "Yes. The Electronic Invoicing System applies to businesses across the UAE, including free zones such as DMCC, JAFZA, DAFZA and DIFC, for in-scope B2B and B2G transactions. Free Trade Zone supplies are specifically catered for in the invoice format itself — PINT AE carries a dedicated Free Trade Zone transaction flag.",
        },
        {
          q: "When do Dubai businesses need to comply?",
          a: "The same national timeline applies in Dubai as everywhere in the UAE: businesses with annual revenue of AED 50 million or more must appoint an Accredited Service Provider by 30 October 2026 and go live by 1 January 2027; other businesses follow by 31 March 2027 (appointment) and 1 July 2027 (go-live).",
        },
      ],
    },
    "abu-dhabi": {
      name: "Abu Dhabi",
      metaTitle: "E-Invoicing in Abu Dhabi: Providers, Deadlines & Matching",
      metaDescription:
        "UAE e-invoicing for Abu Dhabi businesses: government contractors, ADGM firms and mainland companies — providers, deadlines, penalties and free matching.",
      intro: [
        "Abu Dhabi's economy concentrates exactly the transaction types the mandate reaches first: business-to-government invoicing. Contractors, suppliers and service firms billing government and semi-government entities should note that Phase 3 puts government entities themselves on the network by 1 October 2027 — after which public-sector customers will expect network invoices as standard.",
        "ADGM-based firms and mainland companies alike fall under the national framework. For large Abu Dhabi groups, the practical constraint is ERP integration lead time; for suppliers to government, it is being invoice-ready before your customers switch.",
      ],
      faq: [
        {
          q: "Do companies supplying Abu Dhabi government entities need e-invoicing earlier?",
          a: "Your own deadline is set by your revenue phase, not by your customers. But government entities go live by 1 October 2027, and in practice public-sector buyers will increasingly expect compliant network invoices from their suppliers — so being ready early protects those relationships.",
        },
        {
          q: "Does the mandate cover ADGM companies?",
          a: "The Electronic Invoicing System is a federal framework applying to businesses across the UAE for in-scope transactions. ADGM firms conducting business in the UAE should plan for compliance on the same phased timeline; confirm any entity-specific scope questions with your tax adviser.",
        },
      ],
    },
    sharjah: {
      name: "Sharjah",
      metaTitle: "E-Invoicing in Sharjah: Providers for Manufacturers & SMEs",
      metaDescription:
        "UAE e-invoicing for Sharjah businesses: manufacturers, traders and SMEs — the July 2027 SME deadline, affordable providers and free matching.",
      intro: [
        "Sharjah's manufacturing and trading base means high invoice volumes flowing to mainland and free zone customers across the UAE — exactly the flows the mandate moves onto the network. Most Sharjah businesses fall below the AED 50 million threshold, putting their deadlines at 31 March 2027 (appoint a provider) and 1 July 2027 (go live).",
        "Manufacturers should pay particular attention to master-data cleanup: recurring B2B customers, credit notes for returns, and summary invoices are the scenarios that most often fail validation when data is untidy.",
      ],
      faq: [
        {
          q: "My Sharjah business uses Tally — is that a problem?",
          a: "No — it's an advantage. Tally is widely used in Sharjah and is itself on the pre-approved provider list, and several other providers offer Tally connectors. Businesses on Tally typically have one of the shortest integration paths.",
        },
        {
          q: "Do SAIF Zone and Hamriyah free zone companies need to comply?",
          a: "Yes — free zone businesses across the UAE are within the framework for in-scope transactions, on the same phased timeline as mainland companies.",
        },
      ],
    },
    ajman: {
      name: "Ajman",
      metaTitle: "E-Invoicing in Ajman: Affordable Providers for Small Business",
      metaDescription:
        "UAE e-invoicing for Ajman businesses: SME deadlines (July 2027), affordable provider plans and free matching for small companies.",
      intro: [
        "Ajman's business community is dominated by small and medium enterprises, which means one date matters most locally: 1 July 2027, when e-invoicing becomes mandatory for businesses under AED 50 million in revenue — with providers to be appointed by 31 March 2027.",
        "The good news for smaller businesses is cost: several pre-approved providers offer entry plans priced for modest invoice volumes, and businesses on mainstream cloud accounting apps can often go live in weeks.",
      ],
      faq: [
        {
          q: "Is e-invoicing worth adopting early for a small Ajman business?",
          a: "Early adopters get more provider choice, calmer onboarding and full penalty exemption during the voluntary period. For a small business, the project is also simply smaller — often a connector to your existing accounting app plus a data tidy-up.",
        },
        {
          q: "What happens if a small business misses the deadline?",
          a: "The penalties are the same regardless of size: AED 5,000 per month for a missed provider appointment or missed go-live, and AED 100 per invoice issued outside the system (capped at AED 5,000/month). For an SME those numbers are painful — and entirely avoidable.",
        },
      ],
    },
    "umm-al-quwain": {
      name: "Umm Al Quwain",
      metaTitle: "E-Invoicing in Umm Al Quwain: Providers & SME Deadlines",
      metaDescription:
        "UAE e-invoicing for Umm Al Quwain businesses: the 2027 SME timeline, low-cost provider options and free matching.",
      intro: [
        "Umm Al Quwain businesses — including UAQ Free Trade Zone companies — follow the national timeline: for most local businesses (under AED 50 million revenue) that means appointing an Accredited Service Provider by 31 March 2027 and invoicing through the network from 1 July 2027.",
        "Because every accredited provider serves the whole UAE, UAQ businesses choose from exactly the same list as Dubai head offices — the comparison criteria are simply pricing, your accounting software, and onboarding support.",
      ],
      faq: [
        {
          q: "Are there providers that suit very small UAQ businesses?",
          a: "Yes. Several pre-approved providers offer SME plans for low invoice volumes, and portal-based invoicing (manual entry) is a workable route for the smallest operations. Our free matching filters for exactly this.",
        },
        {
          q: "Does UAQ FTZ registration change my obligations?",
          a: "No — free zone and mainland businesses follow the same federal framework and phased deadlines for in-scope transactions.",
        },
      ],
    },
    "ras-al-khaimah": {
      name: "Ras Al Khaimah",
      metaTitle: "E-Invoicing in Ras Al Khaimah: Providers for RAK Businesses",
      metaDescription:
        "UAE e-invoicing for Ras Al Khaimah businesses: RAKEZ companies, manufacturers and SMEs — deadlines, providers and free matching.",
      intro: [
        "Ras Al Khaimah's mix of RAKEZ free zone companies, industrial manufacturers and trading SMEs all land in the same national framework. Larger RAK manufacturers near or above AED 50 million in revenue face the early dates — provider appointed by 30 October 2026, live by 1 January 2027 — while smaller businesses follow in 2027.",
        "RAK's industrial firms often run older or heavily customised systems; for them the integration route (connector, API or middleware) is the first question to settle, and it decides the realistic project timeline.",
      ],
      faq: [
        {
          q: "Our RAK factory runs a legacy ERP — can we still comply?",
          a: "Yes. Providers integrate legacy systems through APIs or middleware, and at moderate volumes a structured CSV/portal route can bridge the gap while a fuller integration is built. The key is starting early enough to test properly.",
        },
        {
          q: "Do RAKEZ companies follow the same deadlines?",
          a: "Yes — the phased national timeline applies to free zone and mainland businesses alike, based on annual revenue.",
        },
      ],
    },
    fujairah: {
      name: "Fujairah",
      metaTitle: "E-Invoicing in Fujairah: Providers for Ports, Logistics & Trade",
      metaDescription:
        "UAE e-invoicing for Fujairah businesses: shipping, logistics, bunkering and trading firms — export flows, deadlines and free provider matching.",
      intro: [
        "Fujairah's port-driven economy — bunkering, shipping services, logistics and trade — produces exactly the invoice patterns that deserve early attention under the mandate: export transactions, multi-currency billing and high-value B2B flows.",
        "PINT AE handles exports explicitly (a dedicated Exports transaction flag, customs references and Incoterms fields), but that also means export-heavy Fujairah businesses should test those scenarios specifically during implementation, not discover them at go-live.",
      ],
      faq: [
        {
          q: "How does e-invoicing handle our export customers who aren't on Peppol?",
          a: "The UAE format anticipates this: export transactions carry a dedicated flag, and where the receiver is not registered on the network the invoice is directed to a predefined endpoint so tax reporting still completes. Your provider configures this — ask them to demonstrate an export scenario.",
        },
        {
          q: "Do multi-currency invoices work on the network?",
          a: "Yes. Invoices can be issued in foreign currency with VAT amounts expressed in AED — PINT AE includes mandatory AED tax-amount fields for exactly this case. Test your currency rounding rules during UAT.",
        },
      ],
    },
  },
  ar: {
    dubai: {
      name: "دبي",
      metaTitle: "الفوترة الإلكترونية في دبي: المزودون والمواعيد والمطابقة المجانية",
      metaDescription:
        "الفوترة الإلكترونية لشركات دبي: أي المزودين المعتمدين تختار، ونطاق البر الرئيسي والمناطق الحرة (DMCC وJAFZA وDIFC)، والمواعيد والغرامات. مطابقة مجانية.",
      intro: [
        "تضم دبي الحصة الأكبر من الشركات المشمولة بإلزام الفوترة الإلكترونية الإماراتي — من شركات DIFC المالية وتجار سلع DMCC إلى مشغلي الخدمات اللوجستية في JAFZA وعشرات آلاف الشركات الصغيرة في البر الرئيسي. يسري الإلزام على البر الرئيسي والمناطق الحرة سواء: المهم مرحلة إيراداتك ونطاق معاملاتك، لا جهة إصدار رخصتك.",
        "يخدم كل مزود في هذا الدليل شركات دبي، ومعظمهم يتخذ منها مقراً أو فريقاً. هذا يعني خيارات حقيقية — ويجعل المقارنة المنهجية (توافق الأنظمة والتسعير مقابل حجمك وطاقة التأهيل) أعلى قيمة منها في أي إمارة أخرى.",
      ],
      faq: [
        {
          q: "هل تسري الفوترة الإلكترونية على شركات المناطق الحرة في دبي؟",
          a: "نعم. يسري نظام الفوترة الإلكترونية على الشركات في كل الإمارات، بما فيها المناطق الحرة مثل DMCC وJAFZA وDAFZA وDIFC، للمعاملات المشمولة بين الشركات ومع الجهات الحكومية. بل إن صيغة PINT AE تتضمن علامة معاملة مخصصة لتوريدات المناطق الحرة.",
        },
        {
          q: "متى يجب على شركات دبي الامتثال؟",
          a: "الجدول الوطني نفسه يسري في دبي كسائر الإمارات: الشركات التي تبلغ إيراداتها السنوية 50 مليون درهم أو أكثر تعيّن مزود خدمة معتمداً بحلول 30 أكتوبر 2026 وتشغّل بحلول 1 يناير 2027؛ وتتبع باقي الشركات بحلول 31 مارس 2027 (التعيين) و1 يوليو 2027 (التشغيل).",
        },
      ],
    },
    "abu-dhabi": {
      name: "أبوظبي",
      metaTitle: "الفوترة الإلكترونية في أبوظبي: المزودون والمواعيد والمطابقة",
      metaDescription:
        "الفوترة الإلكترونية لشركات أبوظبي: مقاولو الحكومة وشركات ADGM وشركات البر الرئيسي — المزودون والمواعيد والغرامات والمطابقة المجانية.",
      intro: [
        "يتركز في اقتصاد أبوظبي تحديداً نوع المعاملات الذي يصل إليه الإلزام أولاً: الفوترة للجهات الحكومية. وعلى المقاولين والموردين وشركات الخدمات التي تفوتر جهات حكومية وشبه حكومية ملاحظة أن المرحلة الثالثة تُدخل الجهات الحكومية نفسها إلى الشبكة بحلول 1 أكتوبر 2027 — وبعدها سيتوقع عملاء القطاع العام فواتير شبكية كمعيار.",
        "تخضع شركات ADGM وشركات البر الرئيسي على السواء للإطار الوطني. وبالنسبة لمجموعات أبوظبي الكبيرة، القيد العملي هو مدة تكامل أنظمة ERP؛ ولموردي الحكومة، الجاهزية قبل تحول عملائهم.",
      ],
      faq: [
        {
          q: "هل تحتاج الشركات الموردة لجهات أبوظبي الحكومية إلى الفوترة الإلكترونية مبكراً؟",
          a: "موعدك يحدده مرحلة إيراداتك لا عملاؤك. لكن الجهات الحكومية تشغّل بحلول 1 أكتوبر 2027، وعملياً سيتوقع المشترون الحكوميون فواتير شبكية ممتثلة من مورديهم بازدياد — فالجاهزية المبكرة تحمي تلك العلاقات.",
        },
        {
          q: "هل يشمل الإلزام شركات سوق أبوظبي العالمي ADGM؟",
          a: "نظام الفوترة الإلكترونية إطار اتحادي يسري على الشركات في كل الإمارات للمعاملات المشمولة. وعلى شركات ADGM العاملة في الدولة التخطيط للامتثال على الجدول المرحلي نفسه؛ وتُراجع أسئلة النطاق الخاصة مع المستشار الضريبي.",
        },
      ],
    },
    sharjah: {
      name: "الشارقة",
      metaTitle: "الفوترة الإلكترونية في الشارقة: مزودون للمصنعين والشركات الصغيرة",
      metaDescription:
        "الفوترة الإلكترونية لشركات الشارقة: المصنعون والتجار والشركات الصغيرة — موعد يوليو 2027 ومزودون بأسعار مناسبة ومطابقة مجانية.",
      intro: [
        "قاعدة الشارقة الصناعية والتجارية تعني أحجام فواتير كبيرة تتدفق إلى عملاء في البر الرئيسي والمناطق الحرة عبر الإمارات — وهي بالضبط التدفقات التي ينقلها الإلزام إلى الشبكة. ومعظم شركات الشارقة دون عتبة الـ50 مليون درهم، ما يجعل موعديها 31 مارس 2027 (تعيين المزود) و1 يوليو 2027 (التشغيل).",
        "وعلى المصنعين إيلاء تنظيف البيانات الرئيسية عناية خاصة: العملاء المتكررون وإشعارات الدائن للمرتجعات والفواتير المجمعة هي السيناريوهات الأكثر إخفاقاً في التحقق حين تكون البيانات غير مرتبة.",
      ],
      faq: [
        {
          q: "شركتي في الشارقة تستخدم Tally — هل هذه مشكلة؟",
          a: "لا — بل ميزة. Tally واسع الانتشار في الشارقة وهو نفسه على قائمة المزودين المعتمدين مبدئياً، ويقدم عدة مزودين آخرين موصلات له. أصحاب Tally عادة من أقصر مسارات التكامل.",
        },
        {
          q: "هل يجب على شركات المنطقة الحرة سيف زون والحمرية الامتثال؟",
          a: "نعم — شركات المناطق الحرة في كل الإمارات ضمن الإطار للمعاملات المشمولة، وعلى الجدول المرحلي نفسه كشركات البر الرئيسي.",
        },
      ],
    },
    ajman: {
      name: "عجمان",
      metaTitle: "الفوترة الإلكترونية في عجمان: مزودون بأسعار مناسبة للشركات الصغيرة",
      metaDescription:
        "الفوترة الإلكترونية لشركات عجمان: مواعيد الشركات الصغيرة (يوليو 2027) وباقات مزودين ميسورة ومطابقة مجانية.",
      intro: [
        "يغلب على مجتمع أعمال عجمان الشركات الصغيرة والمتوسطة، ما يعني أن تاريخاً واحداً هو الأهم محلياً: 1 يوليو 2027، حين تصبح الفوترة الإلكترونية إلزامية للشركات دون 50 مليون درهم من الإيرادات — مع وجوب تعيين المزود بحلول 31 مارس 2027.",
        "الخبر الجيد للشركات الأصغر هو التكلفة: يقدم عدة مزودين معتمدين باقات دخول مسعّرة لأحجام فواتير متواضعة، وتستطيع الشركات على تطبيقات المحاسبة السحابية الشائعة التشغيل خلال أسابيع غالباً.",
      ],
      faq: [
        {
          q: "هل يستحق التبني المبكر للشركة الصغيرة في عجمان؟",
          a: "المتبنون مبكراً يحصلون على خيارات مزودين أوسع وتأهيل أهدأ وإعفاء كامل من الغرامات خلال الفترة الطوعية. والمشروع للشركة الصغيرة أصغر أصلاً — غالباً موصل لتطبيقك المحاسبي الحالي مع ترتيب للبيانات.",
        },
        {
          q: "ماذا يحدث إذا فوتت شركة صغيرة الموعد؟",
          a: "الغرامات واحدة بغض النظر عن الحجم: 5,000 درهم شهرياً عن تفويت تعيين المزود أو التشغيل، و100 درهم عن كل فاتورة خارج النظام (بسقف 5,000 درهم شهرياً). وهي أرقام مؤلمة للشركة الصغيرة — وقابلة للتفادي تماماً.",
        },
      ],
    },
    "umm-al-quwain": {
      name: "أم القيوين",
      metaTitle: "الفوترة الإلكترونية في أم القيوين: المزودون ومواعيد الشركات الصغيرة",
      metaDescription:
        "الفوترة الإلكترونية لشركات أم القيوين: جدول 2027 للشركات الصغيرة وخيارات مزودين منخفضة التكلفة ومطابقة مجانية.",
      intro: [
        "تتبع شركات أم القيوين — بما فيها شركات المنطقة الحرة UAQ FTZ — الجدول الوطني: ولمعظم الشركات المحلية (دون 50 مليون درهم) يعني ذلك تعيين مزود خدمة معتمد بحلول 31 مارس 2027 والفوترة عبر الشبكة من 1 يوليو 2027.",
        "ولأن كل مزود معتمد يخدم الإمارات كلها، تختار شركات أم القيوين من القائمة نفسها المتاحة لمقار دبي — ومعايير المقارنة ببساطة: التسعير وبرنامجك المحاسبي ودعم التأهيل.",
      ],
      faq: [
        {
          q: "هل من مزودين يناسبون الشركات الصغيرة جداً في أم القيوين؟",
          a: "نعم. يقدم عدة مزودين معتمدين باقات للشركات الصغيرة بأحجام فواتير منخفضة، والفوترة عبر البوابة (إدخال يدوي) مسار عملي لأصغر الأعمال. ومطابقتنا المجانية ترشح على هذا الأساس تحديداً.",
        },
        {
          q: "هل يغير تسجيل UAQ FTZ التزاماتي؟",
          a: "لا — تتبع شركات المناطق الحرة والبر الرئيسي الإطار الاتحادي نفسه والمواعيد المرحلية نفسها للمعاملات المشمولة.",
        },
      ],
    },
    "ras-al-khaimah": {
      name: "رأس الخيمة",
      metaTitle: "الفوترة الإلكترونية في رأس الخيمة: مزودون لشركات رأس الخيمة",
      metaDescription:
        "الفوترة الإلكترونية لشركات رأس الخيمة: شركات راكز والمصنعون والشركات الصغيرة — المواعيد والمزودون والمطابقة المجانية.",
      intro: [
        "مزيج رأس الخيمة من شركات المنطقة الحرة راكز والمصنعين الصناعيين والشركات التجارية الصغيرة يقع كله ضمن الإطار الوطني نفسه. يواجه كبار مصنعي رأس الخيمة عند عتبة 50 مليون درهم أو فوقها التواريخ المبكرة — تعيين المزود بحلول 30 أكتوبر 2026 والتشغيل بحلول 1 يناير 2027 — بينما تتبع الشركات الأصغر في 2027.",
        "كثير من شركات رأس الخيمة الصناعية تشغّل أنظمة قديمة أو كثيفة التخصيص؛ ولهذه، مسار التكامل (موصل أو واجهة برمجية أو وسيط) هو السؤال الأول الذي يجب حسمه، وهو ما يحدد الجدول الواقعي للمشروع.",
      ],
      faq: [
        {
          q: "مصنعنا في رأس الخيمة يشغّل نظام ERP قديماً — هل يمكننا الامتثال؟",
          a: "نعم. يتكامل المزودون مع الأنظمة القديمة عبر الواجهات البرمجية أو الوسيطات، وعند الأحجام المتوسطة يمكن لمسار CSV/بوابة منظم سد الفجوة ريثما يُبنى تكامل أكمل. المفتاح هو البدء مبكراً بما يكفي للاختبار الجيد.",
        },
        {
          q: "هل تتبع شركات راكز المواعيد نفسها؟",
          a: "نعم — يسري الجدول الوطني المرحلي على شركات المناطق الحرة والبر الرئيسي سواء، بحسب الإيرادات السنوية.",
        },
      ],
    },
    fujairah: {
      name: "الفجيرة",
      metaTitle: "الفوترة الإلكترونية في الفجيرة: مزودون للموانئ واللوجستيات والتجارة",
      metaDescription:
        "الفوترة الإلكترونية لشركات الفجيرة: الشحن واللوجستيات وتموين السفن والتجارة — تدفقات التصدير والمواعيد والمطابقة المجانية.",
      intro: [
        "اقتصاد الفجيرة القائم على الموانئ — تموين السفن وخدمات الشحن واللوجستيات والتجارة — ينتج بالضبط أنماط الفواتير التي تستحق انتباهاً مبكراً تحت الإلزام: معاملات التصدير والفوترة متعددة العملات والتدفقات عالية القيمة بين الشركات.",
        "تعالج صيغة PINT AE الصادرات صراحة (علامة معاملة تصدير مخصصة وحقول مرجع جمركي وIncoterms)، لكن هذا يعني أيضاً أن على شركات الفجيرة كثيفة التصدير اختبار تلك السيناريوهات تحديداً أثناء التطبيق، لا اكتشافها عند التشغيل.",
      ],
      faq: [
        {
          q: "كيف تتعامل الفوترة الإلكترونية مع عملاء التصدير غير المسجلين على Peppol؟",
          a: "الصيغة الإماراتية تتحسب لهذا: تحمل معاملات التصدير علامة مخصصة، وحين لا يكون المستلم مسجلاً على الشبكة تُوجه الفاتورة إلى نقطة نهاية محددة مسبقاً ليكتمل الرفع الضريبي. مزودك يهيئ ذلك — اطلب منه عرض سيناريو تصدير.",
        },
        {
          q: "هل تعمل الفواتير متعددة العملات على الشبكة؟",
          a: "نعم. يمكن إصدار الفواتير بعملة أجنبية مع التعبير عن مبالغ الضريبة بالدرهم — وتتضمن PINT AE حقول مبالغ ضريبة إلزامية بالدرهم لهذه الحالة تحديداً. اختبر قواعد تقريب عملاتك أثناء الاختبارات.",
        },
      ],
    },
  },
};
