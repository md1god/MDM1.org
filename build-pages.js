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
  const template = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - MDM1</title>
  <link rel="stylesheet" href="../css/global.css">
</head>
<body>
  <nav class="mdm1-nav">
    <div class="nav-container">
      <a href="https://mdm1.org/index.html" class="logo">👁️ MDM1</a>
      <ul class="nav-menu nav-item">
        <li><a href="https://mdm1.org/index.html">الرئيسية</a></li>
        <li><a href="https://mdm1.org/pages/about.html">من نحن</a></li>
        <li><a href="https://mdm1.org/pages/tokenomics.html">التوكنوميكس</a></li>
        <li><a href="https://mdm1.org/pages/index.html">كل الصفحات</a></li>
      </ul>
    </div>
  </nav>

  <main class="mdm1-particles">
    <section class="hero reveal">
      <h1 class="glow-gold">${title}</h1>
      <p>${description}</p>
    </section>

    <section class="daily-image reveal">
      <img src="${imagePath}" alt="رسالة اليوم" loading="lazy"
           onerror="this.closest('.daily-image').style.display='none'">
      <p class="daily-quote glow-gold">${quote}</p>
    </section>
  </main>

  <footer class="meta">
    <p>✦ MDM1 · صفحة #${pageNumber} · ${today} ✦</p>
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
    .map(p => `        <li class="reveal"><a href="${p.slug}.html">صفحة #${p.number} — ${p.title}</a></li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كل الصفحات - MDM1</title>
  <link rel="stylesheet" href="../css/global.css">
</head>
<body>
  <nav class="mdm1-nav">
    <div class="nav-container">
      <a href="https://mdm1.org/index.html" class="logo">👁️ MDM1</a>
      <ul class="nav-menu nav-item">
        <li><a href="https://mdm1.org/index.html">الرئيسية</a></li>
        <li><a href="https://mdm1.org/pages/about.html">من نحن</a></li>
        <li><a href="https://mdm1.org/pages/tokenomics.html">التوكنوميكس</a></li>
      </ul>
    </div>
  </nav>

  <main class="mdm1-particles">
    <section class="hero reveal">
      <h1 class="glow-gold">كل الصفحات</h1>
      <p>أرشيف الصفحات اليومية — آخر تحديث: ${today}</p>
    </section>
    <section class="reveal">
      <ul class="pages-list">
${items}
      </ul>
    </section>
  </main>

  <footer class="meta">
    <p>✦ MDM1 · إجمالي الصفحات: ${pages.length} ✦</p>
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
