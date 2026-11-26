# Show HN launch kit — MDM1.org

هذا الدليل يجهّز منشوراً تقنياً صادقاً لـ Hacker News. **لا ينشر شيئاً تلقائياً**: الإرسال النهائي يجب أن يتم من حسابك أنت بعد مراجعة النص والموافقة عليه داخل HN.

## قبل النشر

- تأكد أن الصفحة الرئيسية المباشرة (`https://mdm1.org/`) تطابق الوصف أدناه: منصة اكتشاف + مساعد يعمل في المتصفح، بلا محتوى عملات رقمية.
- تأكد أن المستودع علني، وأن الـ README يشرح بوضوح فكرة «المتصفح أولاً» والشفافية.
- لا تستخدم كلمات مثل «إعلان» أو «ترويج» أو «عملة» أو «رمز» أو «استثمار» في العنوان أو التعليق.
- لا تضع أرقاماً غير موثّقة (عدد مستخدمين، ترتيب، نمو) ولا تعد بأداء غير مضمون.

## العنوان المقترح (Show HN)

```
Show HN: MDM1 – a browser-first tool catalog with opt-in local LLM via WebGPU
```

بديل مختصر: `Show HN: MDM1 – multilingual discovery with a private, in-browser assistant`

## نص المنشور المقترح

```
I built MDM1.org because finding the right tool usually starts with a long list of ads rather than a useful first step.

It is a static, multilingual catalog of software, apps and buildable project ideas. The assistant's fast mode runs entirely in the browser against the catalog: no account, no API key, no paid backend. On WebGPU-capable browsers you can optionally load a small WebLLM model (Qwen2.5-0.5B) so the conversation stays on your device; the download only starts when you click the button.

There is also a Code Lab that generates editable starter files for HTML/CSS, JavaScript, Python and SQL.

Everything is plain HTML/CSS/JS published with GitHub Pages, and the repository is open. It is a non-commercial project; there is no token, wallet or financial product involved. I would love feedback on the recommendations, the generated code and which languages to prioritize next.

Site: https://mdm1.org/assistant/
Code: https://github.com/md1god/MDM1.org
```

## أول تعليق منك (بعد النشر)

```
Happy to answer questions. A few implementation notes:

- The site is fully static; the deploy workflow injects the menu and WebGL layer at publish time, so source pages stay readable.
- Local AI uses WebLLM's Qwen2.5-0.5B-Instruct-q4f16_1-MLC, fetched from the official CDN only after an explicit click and cached by the browser.
- Catalog mode does not call any hosted model or paid API.
- This is a side project with no monetization; the separate digital-dollar site is unrelated and is not part of this submission.

The weakest part right now is recommendation quality and language coverage — concrete examples of misses are especially useful.
```

## ما يجب تجنّبه في HN

- لا تكتب «إعلان عن موقعي» أو «أريد ترويجاً». Show HN مُخصّص لشيء بنيته ويمكن للناس تجربته.
- لا تذكر العملات الرقمية أو الروابط ذات الصلة في المنشور؛ هذا المشروع منفصل تماماً.
- لا تكرر النشر ولا تطلب من أشخاص التصويت؛ هذا مخالف لقواعد HN وسيؤدي لحذف المنشور.
- إذا طلب HN تسجيل دخول أو تحقق، أكمله أنت بنفسك؛ لا تحاول تجاوز أي تحقق آلي.

## بعد النشر

- اقرأ التعليقات وأجب بتفاصيل تقنية محددة بدل الوعود العامة.
- سجّل الملاحظات المتكررة وأضفها كـ issues في المستودع.
- حدّث الـ README والصفحة الرئيسية بناءً على ملاحظات حقيقية فقط.
