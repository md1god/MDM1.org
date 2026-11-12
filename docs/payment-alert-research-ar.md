# ملاحظات بحث: تنبيه تحويل Polygon وتأكيد دفع MDM1

## حقائق مهمة للموقع

- موقع MDM1 منشور كصفحات ثابتة على GitHub Pages. ملف `supabase/README.md` يصرّح بأن مشروع Supabase لم يُنشأ بعد، ولا توجد إعدادات CLI/دوال Edge حالية. لا يمكن لملف JavaScript ثابت استقبال webhook موثوق أو إرسال بريد باسم الموقع مع سر مخفي.
- عنوان الاستقبال الحالي في صفحة الخدمات هو عنوان Binance عام، وملف QR يحمل العنوان فقط. لا يحتوي تحويل ERC-20 على رقم طلب أو بريد عميل ضمن حدث `Transfer`؛ لذلك إشعار وصول التحويل وحده لا يحدد أي عميل دفع.
- أقرب آلية موثوقة مع الإبقاء على العنوان الحالي: مراقبة التحويلات الواردة لخدمة USDT على Polygon وإرسال تنبيه للمالك؛ ثم يقدّم العميل TXID في نموذج التأكيد، ويتحقق خادم من الإيصال والسجل والعقد والمبلغ والعنوان قبل إرسال إيصال بالبريد. إذا لم تُرسل TXID، فلا يمكن ربط التحويل ببريد أو طلب بعينه بأمان عبر العنوان المشترك. البديل للتأكيد الفوري دون TXID هو عنوان فريد لكل طلب أو بوابة فواتير تحمل معرف الطلب، وهذا يغيّر طريقة التحويل المباشر الحالية.

## ملاحظة التوكن والشبكة

أعلنت Polygon أن USDT على Polygon PoS انتقل إلى USDT0 الأصلي، ويعرّف مستكشف Polygon العقد `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` بالرمز USDT0. كما توضح Binance أن USDT0 مدعوم على Polygon وتنبّه إلى أن التوكن/الشبكة غير المدعومين قد لا يُقيّدان. ولأن صفحة Tether الحالية لقائمة البروتوكولات لا تعرض Polygon في قائمتها، يجب عدم افتراض اسم عقد أو ticker من واجهة فقط: نلتزم بما تعرضه شاشة إيداع Binance الحالية ونثبت العقد من أول TXID تجريبي قبل تفعيل أي تأكيد آلي. لا تطلب من العميل إدخال عقد التوكن يدويًا.

## مسار التنفيذ المقترح

1. مستمع Alchemy Address Activity على Polygon Mainnet لإشعار الخادم عند تحويلات ERC-20 الواردة للعناوين المتتبعة. التحقق من `X-Alchemy-Signature` باستخدام HMAC SHA-256 على نص الجسم الخام، ومعالجة إعادة الإرسال بصورة idempotent. الحدث قد يصبح removed في إعادة تنظيم للسلسلة؛ لا ترسل تأكيدًا نهائيًا قبل التحقق من الإيصال وحالة المعاملة وعدد/حالة التأكيدات.
2. مستقبل webhook خادمي في Supabase Edge Function، مع عقد أحداث/مدفوعات خاص غير متاح للقراءة العامة. تخزين `ALCHEMY_WEBHOOK_SIGNING_KEY` و`RESEND_API_KEY` وأي RPC/API key كأسرار في الخادم، لا في GitHub Pages أو الواجهة.
3. تنبيه للمالك عند حدث وارد مطابق فقط؛ مرشح الحدث: chain Polygon، `to` يساوي عنوان Binance الحالي، token contract يساوي العقد الذي تحققنا منه فعليًا، والقيمة موجبة. حفظ txHash/logIndex مرة واحدة لمنع رسائل مكررة.
4. بعد إدخال العميل TXID وبريده وباقته/المبلغ، تتحقق Edge Function من `eth_getTransactionReceipt` والسجل الفعلي، وتتأكد من عقد التوكن والعنوان والقيمة ونجاح الإيصال، وترفض TXID المستخدم سابقًا. عند النجاح ترسل رسالة استلام آلية؛ لا ترسل كلمة مرور أو تطلب سر محفظة.
5. يلزم حساب/مشروع Supabase فعّال، حساب Alchemy مع Webhook، ومزود بريد مثل Resend مع نطاق مرسل موثّق. المعرّف العام/مفتاح الواجهة يمكن أن يكونا عامين مع RLS مضبوط، أما مفاتيح الخدمات فتبقى أسرار Edge Function. حتى تفعيل هذه المكونات لا يصح الادعاء بأن التنبيه أو تأكيد العميل يعمل آليًا.

## تعليمات التحويل من Binance

تقول تعليمات Binance الرسمية إن المسار في التطبيق هو: الأصول ← نظرة عامة ← إرسال ← سحب أصل، ثم اختيار الأصل، لصق العنوان، واختيار الشبكة نفسها التي يدعمها المستلم. بعدها يكتب العميل المبلغ ويفحص الرسوم والعنوان والشبكة، يؤكد العملية، ثم يحفظ TXID. تذكر Binance أن اختيار شبكة غير متوافقة قد يؤدي إلى فقدان الأموال، وتقترح إرسال مبلغ اختبار صغير عند أول سحب إلى عنوان جديد. يجب عرض رسوم الشبكة والخيار الذي يحدد هل المبلغ المدخل هو الإجمالي أم صافي ما يصل للمستلم.

## References

[1]: https://polygon.technology/blog/native-usdt0-comes-to-polygon-for-lower-fees-and-deeper-liquidity "Polygon native USDT0 migration"
[2]: https://www.binance.com/en/support/faq/detail/655644d8b6614dec9fe9baeb37658645 "Binance guide to USDT0"
[3]: https://polygonscan.com/address/0xc2132D05D31c914a87C6611C10748AEb04B58e8F "PolygonScan USDT0 token contract"
[4]: https://www.alchemy.com/docs/reference/address-activity-webhook "Alchemy Address Activity webhooks"
[5]: https://www.alchemy.com/docs/reference/notify-api-quickstart "Alchemy webhook security and retries"
[6]: https://supabase.com/docs/guides/functions/secrets "Supabase Edge Function secrets"
[7]: https://supabase.com/docs/guides/functions/examples/send-emails "Supabase Edge Function email example"
[8]: https://www.binance.com/en/support/faq/how-to-withdraw-crypto-from-binance-115003670492 "Binance crypto withdrawal instructions"
[9]: https://tether.to/en/supported-protocols/ "Tether supported protocols"
