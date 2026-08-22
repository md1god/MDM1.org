# City Crime — حزمة الويب لـ MDM1

تحتوي هذه الحزمة على صفحة **CC GAME** الجاهزة، وفيديو المقدمة، وملفات Godot Web الخاصة بلعبة **City Crime**.

## الرفع إلى mdm1.org

أنشئ المجلد التالي في استضافة الموقع، ثم ارفع **محتويات** هذه الحزمة إليه كما هي:

```text
/pages/city-crime/
```

بعد الرفع يجب أن يفتح الرابط التالي صفحة اللعبة:

```text
https://mdm1.org/pages/city-crime/index.html
```

لا تغيّر أسماء الملفات داخل مجلد `cc-game`، ولا ترفع ملف `index.pck` أو `index.wasm` على أنه نص؛ يجب أن تظل الملفات الثنائية كما هي.

## زر CC GAME

يوجد الكود الجاهز للزر في:

```text
snippets/mdm1_cc_game_button.html
```

أضف الرابط إلى ملف قائمة الصفحات أو الصفحة الرئيسية في `mdm1.org`. الزر يفتح صفحة City Crime مباشرة.

## ترتيب الملفات

| المسار | الغرض |
|---|---|
| `index.html` | بوابة CC GAME وفيها فيديو المقدمة وزر البدء |
| `media/intro.mp4` | الفيديو السينمائي القصير |
| `cc-game/index.html` | صفحة تشغيل Godot Web |
| `cc-game/index.pck` | بيانات اللعبة |
| `cc-game/index.wasm` | محرك Godot Web |
| `cc-game/index.js` | محمّل اللعبة |
| `snippets/` | زر CC GAME الجاهز للدمج |

## ملاحظة تشغيل

يتطلب تصدير Godot Web استضافة تدعم `WebAssembly` وملفات بحجم كبير. لا يعمل فتح `cc-game/index.html` بالنقر المزدوج من الكمبيوتر؛ يجب فتحه عبر استضافة HTTP أو HTTPS. عند رفعه إلى mdm1.org يقرأ iframe المسار النسبي تلقائياً.
