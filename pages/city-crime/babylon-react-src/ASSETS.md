# سجل الأصول — City Crime

## الاتجاه الفني

المشهد المرجعي هو تقاطع حضري واقعي عند العصر، بكاميرا كتف خلفية، إسفلت متآكل وواجهات خرسانية دافئة وإضاءة شمس عملية. تظهر واجهة عربية تكتيكية قليلة التشتيت، وتستخدم الكهرماني `#F4A62A` فقط لتوجيه اللاعب وإبراز التفاعل. الأصول المرئية المولدة قيد الإنشاء ولا تمثل بديلاً عن نماذج أو خامات مرخّصة.

| الأصل | الحالة | الاستخدام | الرابط أو الموقع | الترخيص/الإسناد |
|---|---|---|---|---|
| الأصل | الحجم المستهدف | الحالة | الاستخدام | الرابط أو الموقع | الترخيص/الإسناد |
|---|---|---|---|---|---|
| مرجع المشهد الفني | 1920×1080، شاشة تحميل | مولّد | شاشة تحميل مرئية ومرجع QA للمشهد | `/manus-storage/city-crime-visual-target_460e0820.png` | أصل مولّد للمشروع |
| خلفية التحميل | 1920×1080، ملء viewport | مولّد | شاشة التحميل قبل تهيئة Babylon.js | `/manus-storage/city-crime-splash_e22e98ec.png` | أصل مولّد للمشروع |
| شعار رمز الطريق | 512×512 ثم 48px HUD | مولّد | HUD، الرأس المرئي، favicon | `/manus-storage/city-crime-symbol_a10b0634.png` | أصل مولّد للمشروع |
| Asphalt 02 | tile كل 4m | مرشح معتمد | خامة PBR للإسفلت المتآكل | [Poly Haven](https://polyhaven.com/a/asphalt_02) | CC0؛ ستحفظ نسخة 2K أو 4K محلياً مع سجل المصدر [1] |
| Concrete Block Wall | tile كل 3m | مرشح معتمد | خامة PBR لواجهات مباني الـ block-out | [Poly Haven](https://polyhaven.com/a/concrete_block_wall) | CC0؛ ستحفظ نسخة 2K أو 4K محلياً مع سجل المصدر [2] |
| HDRI مناسب للضوء النهاري | 1K–2K cubemap/IBL | معلّق الاختيار | IBL/skybox بدقة مناسبة لمستوى الأداء | [Poly Haven HDRIs](https://polyhaven.com/hdris) | CC0؛ يختار بعد اختبار الذاكرة [3] |
| City Builder Bits | مبانٍ 6–16m، طرق 4m | مرشح معتمد | مبانٍ وطرق وأشجار كـ block-out لمدينة مصغرة | [KayKit](https://kaylousberg.itch.io/city-builder-bits) | CC0، مع ملفات GLTF متوافقة مع المحركات [4] |
| الشخصية الرئيسية | 1.72m طولاً | معطّل مؤقتاً | نموذج GLB/GLTF للبطلة؛ النسخة الحالية تستخدم بديلاً إجرائياً خفيفاً لأن تحميل GLB يسبب عدم استقرار | [Sketchfab](https://sketchfab.com/3d-models/woman-standing-v8-0ca28ee485b1482c883f78b260edf0c8) | CC BY 4.0 لـ Fadly.W؛ تُحفظ الاعتمادات ويعاد تفعيل النموذج فقط بعد اختبار مستقل [5] |
| السيارة | 4.4m طولاً × 1.8m عرضاً | يحتاج اختياراً يدوياً | نموذج GLB/GLTF لسيارة قابلة للقيادة | [Sketchfab](https://sketchfab.com/) | يجب أن تكون قابلة للتنزيل وCC0 أو CC BY وموصوفة بأنها game-ready/PBR [5] |
| سلاح محمول | 0.75m تقريباً | يحتاج اختياراً يدوياً | عنصر بصري تفاعلي أولي لا يطلق مقذوفات في هذا الـ slice | [Sketchfab](https://sketchfab.com/) | يجب أن يكون قابلاً للتنزيل وCC0 أو CC BY مع الإسناد عند الحاجة [5] |
| Idle / Walk / Run | حركات 30fps، loop | يحتاج تنزيل محلي | حركات للشخصية الحالية فقط | [Mixamo](https://www.mixamo.com/) | تستخدم وفق شروط Adobe؛ تُحفظ الحركات محلياً مع اسم المصدر [6] |

## ضوابط الإدماج

لا تدخل أي أصول من Sketchfab إلا بعد التحقق اليدوي من تفعيل التنزيل، الترخيص، اسم المبدع، والرابط الأصلي. تحافظ شاشة الاعتمادات داخل اللعبة على هذا الإسناد لكل أصل CC BY؛ أما الأصول CC0 فتوثق في السجل للمراجعة فقط. لا يجري تنزيل أصول Sketchfab آلياً نيابة عن اللاعب، ولا تضمّن مفاتيح دخول ضمن المشروع.

أما حزم KayKit فهي مناسبة للـ block-out لأنها تتضمن نماذج GLTF منخفضة التفاصيل محسّنة، لذا ستغطى لاحقاً بخامات Poly Haven PBR بصورة انتقائية في المناطق القريبة من الكاميرا. ستضبط صور Poly Haven إلى دقة 2K مبدئياً، وتربط خرائط اللون والخشونة والطبيعي حيث تكون متاحة، قبل ضغط أصول GLB الجديدة بـ Draco وخاماتها بـ KTX2.

## المراجع

[1]: https://polyhaven.com/a/asphalt_02 "Poly Haven — Asphalt 02"
[2]: https://polyhaven.com/a/concrete_block_wall "Poly Haven — Concrete Block Wall"
[3]: https://polyhaven.com/hdris "Poly Haven — HDRIs"
[4]: https://kaylousberg.itch.io/city-builder-bits "KayKit — City Builder Bits"
[5]: https://sketchfab.com/developers/download-api/guidelines "Sketchfab — Download API Guidelines"
[6]: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html "Adobe — Mixamo FAQ"
