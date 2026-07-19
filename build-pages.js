#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataFile = fs.readFileSync('pages-data.json', 'utf8');
const data = JSON.parse(dataFile);

const stateFile = 'build-state.json';
let state = { pageCount: 0, lastUpdate: new Date().toISOString() };

if (fs.existsSync(stateFile)) {
  state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// اختيار حكمة اليوم بشكل يدوري (مش عشوائي بحت) عشان ما تتكررش قبل ما تخلص القايمة كلها
function pickDailyQuote(pageNumber, quotes) {
  return quotes[(pageNumber - 1) % quotes.length];
}

function generatePageHTML(pageNumber, title, description, quote, imagePath) {
  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // ملاحظة: المسارات هنا نسبية لأن الملف هيتحط جوا مجلد pages/
  // الكلاسات دي هي الكلاسات الحقيقية المعرّفة في css/pages.css (navbar, page-hero,
  // page-content, media-block, page-footer...) — مطابقة تمامًا لباقي صفحات الموقع
  const template = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - MDM1</title>
  <link rel="stylesheet" href="../css/global.css">
  <link rel="stylesheet" href="../css/pages.css">
</head>
<body>
  <div id="particles"></div>

  <nav class="navbar">
    <a href="https://mdm1.org/index.html" class="nav-logo">👁️ MDM1</a>
    <a href="https://mdm1.org/pages/index.html" class="nav-back">كل الصفحات</a>
  </nav>

  <header class="page-hero reveal">
    <div class="page-label">MDM1 · صفحة يومية</div>
    <h1 class="page-title">${title}</h1>
    <p class="page-sub">${description}</p>
  </header>

  <main class="page-content">
    <div class="media-block reveal">
      <img src="${imagePath}" alt="رسالة اليوم"
           onerror="this.closest('.media-block').style.display='none'">
      <div class="media-caption">${quote}</div>
    </div>
  </main>

  <footer class="page-footer">
    ✦ MDM1 · صفحة #${pageNumber} · ${today} ✦
  </footer>

  <script src="../js/global.js"></script>
</body>
</html>`;
  return template;
}

function generateIndexHTML(pages) {
  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const items = pages
    .slice()
    .reverse()
    .map(p => {
      const d = new Date(p.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
      return `      <li class="tl-item">
        <div class="tl-date">صفحة #${p.number}</div>
        <div class="tl-title"><a href="${p.slug}.html" class="glow-gold">${p.title}</a></div>
        <div class="tl-text">${d}</div>
      </li>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كل الصفحات - MDM1</title>
  <link rel="stylesheet" href="../css/global.css">
  <link rel="stylesheet" href="../css/pages.css">
</head>
<body>
  <div id="particles"></div>

  <nav class="navbar">
    <a href="https://mdm1.org/index.html" class="nav-logo">👁️ MDM1</a>
    <a href="https://mdm1.org/index.html" class="nav-back">الرئيسية</a>
  </nav>

  <header class="page-hero reveal">
    <div class="page-label">MDM1 · الأرشيف</div>
    <h1 class="page-title">كل الصفحات</h1>
    <p class="page-sub">آخر تحديث: ${today} · إجمالي الصفحات: ${pages.length}</p>
  </header>

  <main class="page-content">
    <ul class="timeline reveal">
${items}
    </ul>
  </main>

  <footer class="page-footer">
    ✦ MDM1 · إجمالي الصفحات: ${pages.length} ✦
  </footer>

  <script src="../js/global.js"></script>
</body>
</html>`;
}

if (!fs.existsSync('pages')) fs.mkdirSync('pages', { recursive: true });

// رقم الصفحة الجديدة يزيد باستمرار (بدون إعادة تدوير) عشان الترقيم يفضل ثابت ومنطقي
const pageNumber = state.pageCount + 1;

const title = randomFrom(data.contentWords.titles);
const description = randomFrom(data.contentWords.descriptions);
const quote = pickDailyQuote(pageNumber, data.wisdomQuotes);
const imagePath = `../${data.config.imageBasePath}/${pageNumber}.jpg`;

const pageSlug = `${pageNumber}`;
const pagePath = path.join('pages', `${pageSlug}.html`);
const html = generatePageHTML(pageNumber, title, description, quote, imagePath);

fs.writeFileSync(pagePath, html, 'utf8');

// تحديث سجل كل الصفحات (مصدر واحد للحقيقة تُستخدم لبناء pages/index.html)
const registryFile = 'pages-registry.json';
let registry = [];
if (fs.existsSync(registryFile)) {
  registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
}
registry.push({ number: pageNumber, slug: pageSlug, title, date: new Date().toISOString() });
fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf8');

// إعادة بناء صفحة الفهرس كل مرة عشان تفضل محدثة بكل الصفحات
const indexHtml = generateIndexHTML(registry);
fs.writeFileSync(path.join('pages', 'index.html'), indexHtml, 'utf8');

// تحديث الحالة
state.pageCount = pageNumber;
state.lastUpdate = new Date().toISOString();
state.lastPageSlug = pageSlug;
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

console.log(`✅ تم إنشاء صفحة جديدة: pages/${pageSlug}.html`);
console.log(`📋 تم تحديث الفهرس: pages/index.html (${registry.length} صفحة)`);
console.log(`🖼️  الصورة المتوقعة: ${data.config.imageBasePath}/${pageNumber}.jpg (لازم ترفعها إنت يدويًا بنفس الاسم)`);
