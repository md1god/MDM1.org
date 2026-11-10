# MDM1 global growth playbook

## الهدف

زيادة الاستخدام الحقيقي للمساعد، وليس مجرد زيارات عابرة. كل حملة يجب أن تقود إلى تجربة واضحة: اكتب هدفاً، احصل على توصية، أو ولّد ملف كود.

## قنوات الأولوية

### GitHub

- تحسين README ليشرح القيمة خلال أول شاشة ويضع روابط مباشرة للمساعد والديسكفري.
- استخدام Issues لاستقبال طلبات الأدوات، اللغات، الأخطاء وتحسينات الوصول.
- نشر Release notes قصيرة عند إضافة وظيفة ملموسة، مع لقطة قبل/بعد وروابط تشغيل.
- دعوة مساهمات صغيرة قابلة للدمج: ترجمة، أداة جديدة، تحسين نص، اختبار هاتف.
- تجنب حشو الكلمات المفتاحية أو الادعاء بأن المشروع مفتوح المصدر بالكامل إذا كانت بعض البيانات أو الأصول خارجية.

### Product Hunt

استخدم [حزمة الإطلاق](PRODUCT-HUNT-LAUNCH.md). ابدأ بصفحة مجدولة، ثم راجع النص والصور قبل الإرسال. الأولوية هي الملاحظات النوعية من المطورين، وليس شراء التصويت أو وعود الترتيب.

### مجتمعات المطورين

- Hacker News: منشور تقني يركز على تشغيل WebLLM داخل المتصفح ومشكلة الأداء، لا إعلان عام.
- DEV Community وHashnode: شرح عملي بعنوان “Build a browser-local assistant with WebGPU” مع رابط تجربة واضح.
- Reddit المناسب: مشاركة تقنية في مجتمعات WebGPU وJavaScript وself-hosting بعد مراجعة قواعد كل مجتمع.
- LinkedIn وX: مقاطع قصيرة من رحلة goal → recommendation → code، مع رابط UTM مختلف لكل قناة.

## روابط القياس

- GitHub: `https://mdm1.org/assistant/?utm_source=github&utm_medium=readme&utm_campaign=global_assistant`
- Product Hunt: `https://mdm1.org/assistant/?utm_source=producthunt&utm_medium=referral&utm_campaign=assistant_launch`
- DEV: `https://mdm1.org/assistant/?utm_source=devto&utm_medium=article&utm_campaign=assistant_launch`
- Reddit: `https://mdm1.org/assistant/?utm_source=reddit&utm_medium=community&utm_campaign=assistant_launch`
- X: `https://mdm1.org/assistant/?utm_source=x&utm_medium=social&utm_campaign=assistant_launch`

## خطة 14 يوماً

**اليومان 1–2:** اختبر الهاتف، WebGPU fallback، توليد اللغات الأربع، النسخ والتنزيل، والروابط الأساسية. سجل الأخطاء في GitHub.

**الأيام 3–4:** انشر تحسين README وContributing، ثم اطلب من 3–5 مطورين تجربة حقيقية مع أهداف مختلفة.

**الأيام 5–7:** انشر مقالاً تقنياً واحداً عن Local AI في المتصفح، وليس عدة منشورات مكررة. أضف أمثلة كود وقيود الأداء.

**اليومان 8–9:** جهز صفحة Product Hunt وصور المعرض والتعليق الأول، ثم اجعل شخصاً آخر يراجع النص.

**اليوم 10:** أطلق Product Hunt بعد تأكيد المالك. رد على التعليقات بسرعة وبشفافية.

**الأيام 11–14:** انشر changelog صغيراً، أصلح أكثر مشكلة متكررة، وحدث README بملاحظات حقيقية لا بأرقام مختلقة.

## مؤشرات الأداء

- عدد الزيارات الفريدة من كل UTM source.
- بدء محادثة واحدة على الأقل.
- عدد عمليات توليد الكود الناجحة.
- نسبة العودة خلال 7 أيام إن توفر قياس تحليلي يحترم الخصوصية.
- نقرات GitHub وطلبات الأدوات والترجمات.
- أخطاء WebGPU ومعدل استخدام الوضع السريع.

لا نستخدم أرقاماً مصطنعة أو تتبعاً مخفياً. يجب تفعيل أي تحليلات مستقبلية بموافقة واضحة، مع تفضيل القياس المجهول أو التحليلات التي تحترم الخصوصية.

## ضوابط الرسائل

قل: “يعمل اختيارياً داخل المتصفح على الأجهزة المتوافقة.”

لا تقل: “يعمل على كل جهاز” أو “يضمن كوداً جاهزاً للإنتاج” أو “يضمن الظهور في كل محرك بحث”.

## مراجع المنصة

- GitHub README guidance: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
- Product Hunt launch requirements: https://www.producthunt.com/launch/preparing-for-launch
- Google SEO starter guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
