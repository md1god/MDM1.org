# تقرير طبقة الكتالوج — قبل / بعد

لا حذف ولا نقل ولا تغيير في أي رابط. لا يتم النشر قبل مراجعتك.

## قبل
- 6 صفحات معطوبة (172, 200, 251, 258, 320, 515) قابلة للفهرسة وموجودة في sitemap-pages.xml (574 رابط).
- لا بوابة جودة: عناوين/أوصاف فيها نص تفكير مسرّب كانت تُنشر.
- لا طبقة بيانات موحّدة للمشاريع والتطبيقات.
- data/games-meta.json يقول 6000 بينما الفعلي 10000.
- لا sitemap خاص بالصفحات الجاهزة للفهرسة.

## بعد
- الـ6 صفحات معزولة: نسخة أصلية في `archive/broken-pages/*.html.bak` (و`Disallow: /archive/` في robots.txt)، وأُضيف `noindex,follow` للصفحات نفسها بدون تغيير الروابط. سجلّها في `data/excluded-pages.json`. sitemap-pages.xml صار 568 رابط، و pages/index.html صار 591 عنصر.
- بوابة جودة (`scripts/check-page-quality.js` + `scripts/page_quality.js`) تعمل في deploy.yml وcontent-check.yml وداخل build-pages.js: فحصت 829 صفحة، 0 مخالفة، وكشفت الـ6 المعطوبة فقط قبل العزل (0 إنذار كاذب). مُختبر أن مدخلاً سيئاً (`Let me think…`) يُرفض بدون تعديل أي ملف.
- `data/catalog.json`: 809 سجل = 214 تطبيق يعمل + 21 أداة + 574 خطة مشروع (+ 10000 سجل ألعاب كعدّاد). لكل سجل: status, primaryCategory, secondaryCategories, tags, classificationMethod, classificationConfidence, needsReview, indexable.
- حالة المراجعة: 276 مراجَع يدوياً، 212 آلي بثقة عالية، 321 آلي يحتاج مراجعة.
- 214/214 تطبيق نجح في اختبار smoke (متصفح بدون إنترنت، بلا أخطاء JS) — أساس حالة "يعمل".
- 128 خطة بأسماء مكررة: كل واحدة لها displayTitle فريد (574/574) بدون تغيير الـ slug.
- 21 مجموعة تطبيقات متشابهة (62 تطبيق) في `/catalog/groups/` بجداول مقارنة، مع إبقاء كل أداة بصفحتها.
- صفحات تصنيف ثابتة بروابط HTML حقيقية، canonical لنفسها: `/categories/{ai,developer-tools,business,education,privacy-offline}/`، و`/catalog/` مدخل عام، و`/projects/` (noindex,follow) فيه الخطط.
- `sitemap-catalog.xml`: 7 روابط فقط (لا خطط، لا فلاتر، لا صفحات معطوبة).
- games-meta.json: total = 10000 مع ملاحظة توضح المعنى (ألعاب HTML5 من طرف ثالث مضمّنة).

## ملفات جديدة
archive/broken-pages/*, catalog/index.html, catalog/groups/index.html, categories/*/index.html, projects/index.html, sitemap-catalog.xml, data/catalog.json, data/catalog-rules.json, data/catalog-overrides.json, data/excluded-pages.json, scripts/build_catalog.py, scripts/build_catalog_pages.py, scripts/check-page-quality.js, scripts/page_quality.js, docs/CATALOG-REPORT.md

## ملفات معدّلة
build-pages.js, .github/workflows/deploy.yml, .github/workflows/content-check.yml, robots.txt, sitemap-pages.xml, pages/index.html, data/games-meta.json, pages/{172,200,251,258,320,515}.html (noindex فقط)

## قرارات مفتوحة
1. الـ568 صفحة خطة ما زالت في sitemap-pages.xml (القديم). أنصح بإزالتها منه حتى تُراجع.
2. التطبيقات تُضاف يومياً بـ add-app، فيجب إعادة تشغيل `python3 scripts/build_catalog.py` ثم `python3 scripts/build_catalog_pages.py` (غير مؤتمت في هذا الـPR).
3. تصنيف الخطط آلي (~85%) وبعضه يحتاج مراجعة بشرية (321 سجل).
4. الـ6 صفحات المعطوبة تحتاج إعادة كتابة يدوية قبل إعادة فهرستها.
