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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function bodyHtml(text) {
  return String(text || '').split(/\n+/).filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`).join('\n');
}


// ---------- اللغات: كل صفحة Scout تُنشر بعدة لغات وتختار لغة الزائر تلقائيًا (مع زر لتغييرها)
const LANG_NAMES = {
  ar: 'العربية', en: 'English', es: 'Español', pt: 'Português', id: 'Bahasa Indonesia',
  tr: 'Türkçe', fr: 'Français', de: 'Deutsch', hi: 'हिन्दी', ru: 'Русский'
};
const RTL_LANGS = ['ar'];
const UI = {
  ar: { all: 'كل الصفحات', lang: 'اللغة', label: 'MDM1 · صفحة يومية', page: 'صفحة' },
  en: { all: 'All pages', lang: 'Language', label: 'MDM1 · Daily page', page: 'Page' },
  es: { all: 'Todas las páginas', lang: 'Idioma', label: 'MDM1 · Página diaria', page: 'Página' },
  pt: { all: 'Todas as páginas', lang: 'Idioma', label: 'MDM1 · Página diária', page: 'Página' },
  id: { all: 'Semua halaman', lang: 'Bahasa', label: 'MDM1 · Halaman harian', page: 'Halaman' },
  tr: { all: 'Tüm sayfalar', lang: 'Dil', label: 'MDM1 · Günlük sayfa', page: 'Sayfa' },
  fr: { all: 'Toutes les pages', lang: 'Langue', label: 'MDM1 · Page du jour', page: 'Page' },
  de: { all: 'Alle Seiten', lang: 'Sprache', label: 'MDM1 · Tagesseite', page: 'Seite' },
  hi: { all: 'सभी पृष्ठ', lang: 'भाषा', label: 'MDM1 · दैनिक पृष्ठ', page: 'पृष्ठ' },
  ru: { all: 'Все страницы', lang: 'Язык', label: 'MDM1 · Страница дня', page: 'Страница' }
};

// SCOUT_TRANSLATIONS = JSON: { "en": {"title","description","body"}, ... } — يُتجاهل أي شيء غير سليم
function parseTranslations(raw) {
  if (!raw) return {};
  let data;
  try { data = JSON.parse(raw); } catch (err) {
    console.error(`⚠️ SCOUT_TRANSLATIONS غير صالح: ${err.message}`);
    return {};
  }
  const out = {};
  for (const [code, t] of Object.entries(data || {})) {
    if (code === 'ar' || !LANG_NAMES[code] || !t) continue;
    const title = String(t.title || '').trim();
    const body = String(t.body || '').trim();
    if (!title || !body) continue;
    out[code] = {
      title: title.slice(0, 160),
      description: String(t.description || '').trim().slice(0, 300),
      body: body.slice(0, 12000)
    };
  }
  return out;
}

// JSON آمن للتضمين داخل <script type="application/json">
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function i18nBlocks(title, description, customBody, quote, translations) {
  const codes = ['ar', ...Object.keys(translations)];
  const data = { default: 'ar', fallback: translations.en ? 'en' : 'ar', rtl: RTL_LANGS, langs: {} };
  data.langs.ar = { name: LANG_NAMES.ar, ui: UI.ar, title, description, body: customBody, quote };
  for (const c of Object.keys(translations)) {
    data.langs[c] = { name: LANG_NAMES[c], ui: UI[c], ...translations[c], quote: '' };
  }
  const options = codes.map(c => `<option value="${c}">${escapeHtml(LANG_NAMES[c])}</option>`).join('');
  const bar = `<label class="lang-picker"><span aria-hidden="true">🌐</span>
      <select id="lang-select" aria-label="Language / اللغة">${options}</select></label>`;
  const script = `<script type="application/json" id="i18n-data">${safeJson(data)}</script>
  <script>
    (function () {
      var D = JSON.parse(document.getElementById('i18n-data').textContent);
      var sel = document.getElementById('lang-select');
      function saved() { try { return localStorage.getItem('mdm1_lang'); } catch (e) { return null; } }
      function remember(v) { try { localStorage.setItem('mdm1_lang', v); } catch (e) {} }
      function pick() {
        var s = saved();
        if (s && D.langs[s]) return s;
        var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
        for (var i = 0; i < prefs.length; i++) {
          var c = String(prefs[i]).toLowerCase().split('-')[0];
          if (D.langs[c]) return c;
        }
        return D.fallback;
      }
      function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
      function apply(code) {
        var L = D.langs[code]; if (!L) return;
        var root = document.documentElement;
        root.lang = code;
        root.dir = D.rtl.indexOf(code) >= 0 ? 'rtl' : 'ltr';
        document.title = L.title + ' - MDM1';
        setText('pg-title', L.title);
        setText('pg-sub', L.description);
        setText('pg-label', L.ui.label);
        setText('pg-back', L.ui.all);
        var foot = document.getElementById('pg-footer-label'); if (foot) foot.textContent = L.ui.page;
        var cap = document.getElementById('pg-quote'); if (cap && L.quote) cap.textContent = L.quote;
        var body = document.getElementById('pg-body');
        if (body) {
          body.textContent = '';
          String(L.body || '').split(/\\n+/).forEach(function (line) {
            if (!line.trim()) return;
            var p = document.createElement('p'); p.textContent = line; body.appendChild(p);
          });
        }
        if (sel) sel.value = code;
      }
      if (sel) sel.addEventListener('change', function () { remember(sel.value); apply(sel.value); });
      apply(pick());
    })();
  </script>`;
  return { bar, script };
}

function generatePageHTML(pageNumber, title, description, quote, customBody = '', translations = {}) {
  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // ملاحظة: المسارات هنا نسبية لأن الملف هيتحط جوا مجلد pages/
  // الكلاسات دي هي الكلاسات الحقيقية المعرّفة في css/pages.css (navbar, page-hero,
  // page-content, page-footer...) — مطابقة تمامًا لباقي صفحات الموقع
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeQuote = escapeHtml(quote);
  const i18n = customBody && Object.keys(translations).length
    ? i18nBlocks(title, description, customBody, quote, translations) : { bar: '', script: '' };
  const template = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - MDM1</title>
  <link rel="stylesheet" href="../css/global.css">
  <link rel="stylesheet" href="../css/pages.css">
  <style>
    .page-quote { margin: 0 0 1.5rem; padding: .8rem 1rem; border-inline-start: 3px solid rgba(201,168,76,.6);
      background: rgba(201,168,76,.05); font-style: italic; opacity: .9; }
    .lang-picker { display: inline-flex; align-items: center; gap: .4rem; margin-inline-start: auto; }
    .lang-picker select { background: rgba(0,0,0,.35); color: inherit; border: 1px solid rgba(201,168,76,.45);
      border-radius: 8px; padding: .3rem .5rem; font: inherit; cursor: pointer; }
    .scout-plan p { line-height: 1.9; margin: 0 0 .9rem; }
  </style>
</head>
<body>
  <div id="particles"></div>

  <nav class="navbar">
    <a href="https://mdm1.org/index.html" class="nav-logo">👁️ MDM1</a>
    ${i18n.bar}
    <a href="https://mdm1.org/pages/index.html" class="nav-back" id="pg-back">كل الصفحات</a>
  </nav>

  <header class="page-hero reveal">
    <div class="page-label" id="pg-label">MDM1 · صفحة يومية</div>
    <h1 class="page-title" id="pg-title">${safeTitle}</h1>
    <p class="page-sub" id="pg-sub">${safeDescription}</p>
  </header>

  <main class="page-content">
    <blockquote class="page-quote reveal" id="pg-quote">${safeQuote}</blockquote>
    ${customBody ? `<section class="page-content reveal scout-plan" id="pg-body">${bodyHtml(customBody)}</section>` : ''}
  </main>
  <footer class="page-footer">
    ✦ MDM1 · <span id="pg-footer-label">صفحة</span> #${pageNumber} · ${today} ✦
  </footer>

  <script src="../js/global.js"></script>
  ${i18n.script}
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

const customTitle = process.env.SCOUT_TITLE?.trim();
const customDescription = process.env.SCOUT_DESCRIPTION?.trim();
const customBody = process.env.SCOUT_BODY?.trim();
const scoutId = (process.env.SCOUT_ID || '').trim();
const translations = parseTranslations(process.env.SCOUT_TRANSLATIONS);

// منع التكرار: نفس معرّف الفرصة لا يُنشر مرتين (يبقى رقم الصفحة القديمة كما هو)
if (scoutId) {
  const prev = fs.existsSync('pages-registry.json') ? JSON.parse(fs.readFileSync('pages-registry.json', 'utf8')) : [];
  const dup = prev.find(p => p.scoutId === scoutId);
  if (dup) {
    state.lastPageSlug = dup.slug;
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
    console.log(`⏭️ الفرصة ${scoutId} منشورة سابقًا في الصفحة ${dup.slug} — لا إنشاء جديد.`);
    process.exit(0);
  }
}
const title = customTitle || randomFrom(data.contentWords.titles);
const description = customDescription || randomFrom(data.contentWords.descriptions);
const quote = customBody ? 'خطة أصلية مبنية على احتياج حقيقي وتُراجع قبل التنفيذ.' : pickDailyQuote(pageNumber, data.wisdomQuotes);

const pageSlug = `${pageNumber}`;
const pagePath = path.join('pages', `${pageSlug}.html`);
const html = generatePageHTML(pageNumber, title, description, quote, customBody, translations);

fs.writeFileSync(pagePath, html, 'utf8');

// تحديث سجل كل الصفحات (مصدر واحد للحقيقة تُستخدم لبناء pages/index.html)
const registryFile = 'pages-registry.json';
let registry = [];
if (fs.existsSync(registryFile)) {
  registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
}
const entry = { number: pageNumber, slug: pageSlug, title, date: new Date().toISOString() };
if (scoutId) { entry.scoutId = scoutId; entry.langs = ['ar', ...Object.keys(translations)]; }
registry.push(entry);
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
if (customBody) console.log(`🌍 اللغات: ${['ar', ...Object.keys(translations)].join(', ')}`);
console.log(`📋 تم تحديث الفهرس: pages/index.html (${registry.length} صفحة)`);
