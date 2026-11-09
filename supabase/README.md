# تفعيل حسابات MDM1 ومزامنة المفضلات

الموقع يعمل حالياً على GitHub Pages، لذلك لا يجوز وضع `service_role` أو أي مفتاح سري داخل HTML/JavaScript. الواجهة الحالية تعمل بوضع محلي على الجهاز، ومخطط الحسابات جاهز في [`account.sql`](account.sql).

للتفعيل السحابي:

1. أنشئ مشروعاً في Supabase.
2. نفّذ `account.sql` في SQL Editor.
3. فعّل Email Auth، واضبط Site URL على `https://mdm1.org`، وأضف redirect URL للمسارات المطلوبة.
4. استخدم **Project URL** و**anon public key** فقط في خطوة بناء آمنة أو في ملف إعداد عام؛ لا تستخدم `service_role` في الواجهة.
5. حدّث `js/mdm1-account.js` ليستخدم `supabase.auth.signInWithOtp` ومداولتي `profiles` و`favorites`، ثم اختبر RLS بحسابين مختلفين.

لا تُرسل كلمة المرور إلى كود الموقع ولا تحفظها في `localStorage`. الوضع المحلي الحالي لا يدّعي أنه تسجيل سحابي، ويعرض ذلك للمستخدم بوضوح إلى أن يتم ربط مشروع Supabase فعلياً.
