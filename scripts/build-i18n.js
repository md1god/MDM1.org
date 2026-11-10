#!/usr/bin/env node
/**
 * MDM1 — ناشر الصفحات متعددة اللغات (ملف جديد، لا يعدّل أي ملف موجود).
 *
 * يقرأ الترجمات الموجودة أصلًا داخل كل صفحة خطة (<script id="i18n-data">) ويكتب لكل لغة صفحة HTML حقيقية
 * يراها الزاحف: /{lang}/pages/{N}.html — برابطها الخاص و<title> و<html lang> وcanonical وعلامات hreflang.
 * ويكتب أيضًا: /{lang}/index.html (صفحة رئيسية بكل لغة)، /{lang}/pages/index.html (فهرس الخطط)، وsitemap-i18n.xml.
 *
 * التشغيل:  node scripts/build-i18n.js
 * اللغات تُؤخذ من i18n/site.json (أضف لغة هناك لتظهر).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ORIGIN, esc, clip } = require('./seo-meta');
const { findProblems, findBodyProblems } = require('./page_quality');

const ROOT = path.resolve(__dirname, '..');
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/site.json'), 'utf8'));
const LANGS = Object.keys(SITE.langs);
const OG_IMAGE = ORIGIN + '/images/md111-token.png';
const MARK = '.i18n-generated';
const LANG_DIR = 'languages';   // all generated language folders live here; deploy.yml flattens them back to /{lang}/ so public URLs never change

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));
const url = p => ORIGIN + p;
const digits = s => String(s || '').replace(/[\u0660-\u0669\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) & 15));
const pagePath = (c, slug) => (c === 'ar' ? `/pages/${slug}.html` : `/${c}/pages/${slug}.html`);
const homePath = c => (c === 'ar' ? '/' : `/${c}/`);
const listPath = c => `/${c}/pages/`;
const hl = c => (c === 'ar' ? 'ar' : (SITE.langs[c].hreflang || c));
const UI = c => Object.assign({}, SITE.langs.en.ui, SITE.langs[c].ui);
const langName = c => (c === 'ar' ? 'AR' : SITE.langs[c].name);   // الموقع عالمي: لا نكتب اسم اللغة الأصلية، فقط رمزها

// ───────────── 1) تنظيف ما ولّدناه سابقًا (لا نلمس مجلدًا لم يُنشأ من هذا السكربت)
for (const c of LANGS) {
  const dir = path.join(ROOT, LANG_DIR, c);
  if (!fs.existsSync(dir)) continue;
  if (!fs.existsSync(path.join(dir, MARK))) throw new Error(`المجلد /${c}/ موجود ولم يُنشأ بهذا السكربت — رفضت الكتابة فوقه`);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ───────────── 2) جمع الصفحات المترجمة (نفس قواعد الاستبعاد المعتمدة في الموقع)
const registry = exists('pages-registry.json') ? JSON.parse(read('pages-registry.json')) : [];
const dateOf = new Map(registry.map(e => [String(e.slug), e.date]));
const excluded = new Set(exists('data/excluded-pages.json')
  ? JSON.parse(read('data/excluded-pages.json')).excluded.map(e => path.basename(e.path, '.html')) : []);
const withheld = /#\s*sitemap-pages:\s*withheld/.test(exists('robots.txt') ? read('robots.txt') : '');

const items = [];
let skippedQuality = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'pages')).filter(f => /^\d+\.html$/.test(f))) {
  const slug = f.replace('.html', '');
  if (excluded.has(slug)) continue;
  const html = read('pages/' + f);
  if (/name="robots"[^>]*noindex/i.test(html)) continue;
  const m = html.match(/<script type="application\/json" id="i18n-data">([\s\S]*?)<\/script>/);
  if (!m) continue;
  let data;
  try { data = JSON.parse(m[1]); } catch (e) { console.error(`⚠️ pages/${f}: i18n-data غير صالح`); continue; }
  const tr = {};
  for (const c of LANGS) {
    const L = data.langs && data.langs[c];
    if (!L) continue;
    const title = digits(L.title).trim(), description = digits(L.description).trim(), body = digits(L.body).trim();
    if (!title || !body) continue;
    // نفس بوابة جودة الموقع للعنوان والوصف، ومعها فحص النص: ترجمات فيها كلام تفكير مسرّب من النموذج لا تُنشر.
    // (استثناء كلمتين تظهران في نص إنجليزي سليم: thinking / something like)
    const leaked = findBodyProblems(body).filter(p => !/thinking|something like/.test(p));
    // ترجمة ناقصة: فقرات عربية متروكة داخل نص لغة غير عربية الحروف، أو عنصر نائب "[مصدر مخفي]"
    const untranslated = (!['fa', 'ur'].includes(c) && (body.match(/[\u0600-\u06FF]/g) || []).length > 30) || body.includes('[مصدر مخفي]');
    if (findProblems({ title, description }).length || leaked.length || untranslated) { skippedQuality++; continue; }
    tr[c] = { title, description, body };
  }
  if (Object.keys(tr).length) items.push({ slug, n: Number(slug), date: dateOf.get(slug) || '', tr });
}
items.sort((a, b) => b.n - a.n);

// ───────────── 3) أدوات القالب
const isHeading = l => l.length <= 95 && /^([0-9\u0966-\u096F]{1,2})\)\s+\S/.test(l);
const bodyHtml = body => {
  const out = []; let ul = false;
  const close = () => { if (ul) { out.push('</ul>'); ul = false; } };
  for (const raw of body.split(/\n+/)) {
    const l = raw.trim(); if (!l) continue;
    if (l.startsWith('- ')) { if (!ul) { out.push('<ul>'); ul = true; } out.push(`<li>${esc(l.slice(2))}</li>`); continue; }
    close();
    if (l.startsWith('### ')) out.push(`<h3>${esc(l.slice(4))}</h3>`);
    else if (l.startsWith('## ')) out.push(`<h2>${esc(l.slice(3))}</h2>`);
    else out.push(isHeading(l) ? `<h2>${esc(l)}</h2>` : `<p>${esc(l)}</p>`);
  }
  close();
  return out.join('\n');
};

const fmtDate = (iso, c) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  try { return d.toLocaleDateString(SITE.langs[c].locale.replace('_', '-'), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); }
  catch (e) { return iso.slice(0, 10); }
};

const altLinks = (alts, xdef) => alts.map(([c, p]) => `  <link rel="alternate" hreflang="${hl(c)}" href="${url(p)}">`).join('\n')
  + `\n  <link rel="alternate" hreflang="x-default" href="${url(xdef)}">`;
const switcher = (cur, alts) => `<label class="i18n-pick"><span aria-hidden="true">🌐</span><select id="lang-select" aria-label="Language">`
  + alts.map(([c, p]) => `<option value="${p}"${c === cur ? ' selected' : ''}>${esc(langName(c))}</option>`).join('') + `</select></label>`;
const langNav = alts => `<nav class="i18n-langs" aria-label="Languages">`
  + alts.map(([c, p]) => `<a href="${p}" hreflang="${hl(c)}" lang="${hl(c)}">${esc(langName(c))}</a>`).join('') + `</nav>`;

const CSS = `.i18n-pick{display:inline-flex;align-items:center;gap:.4rem}
    .i18n-pick select{background:rgba(0,0,0,.35);color:inherit;border:1px solid rgba(201,168,76,.45);border-radius:8px;padding:.3rem .5rem;font:inherit;cursor:pointer}
    .i18n-body{max-width:860px;margin:0 auto;padding:2rem 1.25rem;text-align:start}
    .i18n-list a{display:block;padding:.7rem 0;border-bottom:1px solid rgba(201,168,76,.15);color:var(--light);text-decoration:none}
    .i18n-list a:hover{color:var(--gold-bright)}
    .i18n-list small{opacity:.6;margin-inline-start:.6rem}
    .i18n-langs{display:flex;flex-wrap:wrap;gap:.5rem 1.2rem;justify-content:center;padding:1.5rem 1rem;font-size:.9rem}
    .i18n-langs a{color:var(--gold);text-decoration:none;opacity:.85}
    .i18n-body p a{color:var(--gold)}
    .i18n-body ul{margin:.6rem 0 1rem;padding-inline-start:1.4rem;list-style:disc}
    .i18n-body li{margin:.35rem 0}
    #music-btn{position:fixed;bottom:5rem;left:1.5rem;z-index:999;width:48px;height:48px;border-radius:50%;border:1px solid rgba(201,168,76,.5);background:rgba(0,0,0,.75);color:#c9a84c;font-size:1.3rem;cursor:pointer;align-items:center;justify-content:center}
    #music-btn.playing{border-color:rgba(201,168,76,.9);box-shadow:0 0 18px rgba(201,168,76,.35)}
    .navbar{flex-wrap:wrap;gap:.6rem}
    .navbar .nav-back{white-space:nowrap}`;

// o: { lang, title, description, path, alts, xdef, og, ld, hero, main, navLink:[href,label], footer }
function shell(o) {
  const u = url(o.path), desc = clip(o.description, 155), L = SITE.langs[o.lang];
  const ld = Object.assign({ '@context': 'https://schema.org', description: desc, inLanguage: hl(o.lang), url: u, mainEntityOfPage: u, image: OG_IMAGE,
    publisher: { '@type': 'Organization', name: 'MDM1', url: ORIGIN } }, o.ld);
  return `<!DOCTYPE html>
<html lang="${hl(o.lang)}" dir="${L.dir || 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${u}">
${altLinks(o.alts, o.xdef)}
  <meta property="og:type" content="${o.og}">
  <meta property="og:site_name" content="MDM1">
  <meta property="og:locale" content="${L.locale}">
  <meta property="og:title" content="${esc(clip(o.title, 90))}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${u}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
  <link rel="stylesheet" href="/css/global.css">
  <link rel="stylesheet" href="/css/pages.css">
  <style>
    ${CSS}
  </style>
<meta name="google-adsense-account" content="ca-pub-8270783733461099">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8270783733461099" crossorigin="anonymous"></script>
</head>
<body>
<!-- generated by scripts/build-i18n.js — do not edit by hand. The two hidden ids below make the deploy-time injector
     (scripts/inject_menu_and_card.py) skip its menu and default music on translated pages. -->
<span id="mdm1m-btn" hidden></span><audio id="bg-music" preload="none"></audio><button id="music-btn" type="button" title="♪" aria-label="Music" style="display:none">🔇</button>
<div id="particles"></div>
<nav class="navbar">
  <a href="${homePath(o.lang)}" class="nav-logo">👁️ MDM1</a>
  ${switcher(o.lang, o.alts)}
  <a href="${o.navLink[0]}" class="nav-back">${esc(o.navLink[1])}</a>
</nav>
${o.hero}
${o.main}
${langNav(o.alts)}
<footer class="page-footer">${o.footer}</footer>
<script src="/js/global.js" defer></script>
<script>document.getElementById('lang-select').addEventListener('change',function(){location.href=this.value})</script>
</body>
</html>
`;
}

function write(rel, content) {
  const f = path.join(ROOT, rel.includes('/') ? path.join(LANG_DIR, rel) : rel);   // root files (sitemap-i18n.xml) stay at the root
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content, 'utf8');
}
const hero = (label, title, sub) => `<header class="page-hero"><div class="page-label">${esc(label)}</div>`
  + `<h1 class="page-title">${esc(title)}</h1><p class="page-sub">${esc(sub)}</p></header>`;

// صفحات أساسية مترجمة يدويًا: i18n/pages/*.json  → { langs: { code: {title, description, body} } }
const core = [];
if (exists('i18n/pages')) {
  for (const f of fs.readdirSync(path.join(ROOT, 'i18n/pages')).filter(f => f.endsWith('.json')).sort()) {
    const d = JSON.parse(read('i18n/pages/' + f)), tr = {};
    for (const c of LANGS) {
      const L = d.langs && d.langs[c];
      if (L && L.title && L.body) tr[c] = { title: L.title.trim(), description: (L.description || L.title).trim(), body: L.body.trim() };
    }
    if (Object.keys(tr).length) core.push({ slug: f.replace('.json', ''), tr });
  }
}
const coreHas = (c, slug) => core.some(p => p.slug === slug && p.tr[c]);

// ───────────── 4) صفحات الخطط: /{lang}/pages/{N}.html
const countByLang = Object.fromEntries(LANGS.map(c => [c, 0]));
for (const it of items) {
  const have = LANGS.filter(c => it.tr[c]);
  const alts = [['ar', pagePath('ar', it.slug)], ...have.map(c => [c, pagePath(c, it.slug)])];
  const xdef = it.tr.en ? pagePath('en', it.slug) : pagePath('ar', it.slug);
  for (const c of have) {
    const t = it.tr[c], ui = UI(c);
    const iso = it.date || '';
    write(`${c}/pages/${it.slug}.html`, shell({
      lang: c, title: `${t.title} - MDM1`, description: t.description || t.title, path: pagePath(c, it.slug), alts, xdef, og: 'article',
      ld: { '@type': 'Article', headline: clip(t.title, 110), datePublished: iso || undefined, dateModified: iso || undefined,
        author: { '@type': 'Organization', name: 'MDM1', url: ORIGIN } },
      hero: hero(ui.label, t.title, t.description),
      main: `<main class="page-content i18n-body">\n${bodyHtml(t.body)}\n<p class="i18n-orig"><a href="${pagePath('ar', it.slug)}" hreflang="ar" lang="ar">${esc(ui.original)}</a></p>\n</main>`,
      navLink: [listPath(c), ui.all],
      footer: `✦ MDM1 · ${esc(ui.page)} #${it.slug}${iso ? ' · ' + esc(fmtDate(iso, c)) : ''} ✦`
    }));
    countByLang[c]++;
  }
}

// ───────────── 4b) الصفحات الأساسية المترجمة: /{lang}/pages/{slug}.html (about, faq ...)
const coreCount = {};
for (const pg of core) {
  const have = LANGS.filter(c => pg.tr[c]);
  const alts = [['ar', pagePath('ar', pg.slug)], ...have.map(c => [c, pagePath(c, pg.slug)])];
  const xdef = pg.tr.en ? pagePath('en', pg.slug) : pagePath('ar', pg.slug);
  for (const c of have) {
    const t = pg.tr[c], ui = UI(c);
    write(`${c}/pages/${pg.slug}.html`, shell({
      lang: c, title: `${t.title} - MDM1`, description: t.description || t.title, path: pagePath(c, pg.slug), alts, xdef, og: 'website',
      ld: { '@type': 'WebPage', name: t.title, isPartOf: { '@type': 'WebSite', name: 'MDM1.org', url: ORIGIN + '/' } },
      hero: hero('MDM1', t.title, t.description),
      main: `<main class="page-content i18n-body">\n${bodyHtml(t.body)}\n<p class="i18n-orig"><a href="${pagePath('ar', pg.slug)}" hreflang="ar" lang="ar">${esc(ui.original)}</a></p>\n</main>`,
      navLink: [homePath(c), ui.home],
      footer: '✦ MDM1 ✦'
    }));
    coreCount[c] = (coreCount[c] || 0) + 1;
  }
}

// ───────────── 5) الصفحة الرئيسية لكل لغة (+ فهرس الخطط للغات التي لها خطط مترجمة فقط)
const hasPlans = c => items.some(it => it.tr[c]);
const planLangs = LANGS.filter(hasPlans);
const landingAlts = [['ar', homePath('ar')], ...LANGS.map(c => [c, homePath(c)])];
const landingX = SITE.langs.en ? homePath('en') : homePath('ar');
const arLinks = { whitepaper: '/whitepaper.html', roadmap: '/pages/roadmap.html', community: '/pages/community.html', about: '/pages/about.html', faq: '/pages/faq.html' };

for (const c of LANGS) {
  const S = SITE.langs[c], ui = UI(c), mine = items.filter(it => it.tr[c]);
  const link = it => `<a href="${pagePath(c, it.slug)}">${esc(it.tr[c].title)}<small>#${it.slug}</small></a>`;
  const official = Object.keys(S.links).filter(k => coreHas(c, k) || arLinks[k]).map(k => coreHas(c, k)
    ? `<a href="${pagePath(c, k)}">${esc(S.links[k])}</a>`
    : `<a href="${arLinks[k]}" hreflang="ar" lang="ar">${esc(S.links[k])}</a>`).join('');
  const plansBlock = mine.length ? `
<h2>${esc(S.plansTitle)}</h2>
<p>${esc(S.plansText)}</p>
<nav class="i18n-list">${mine.slice(0, 10).map(link).join('')}<a href="${listPath(c)}">${esc(ui.all)} →</a></nav>` : '';

  write(`${c}/index.html`, shell({
    lang: c, title: S.title, description: S.description, path: homePath(c), alts: landingAlts, xdef: landingX, og: 'website',
    ld: { '@type': 'WebPage', name: S.title, isPartOf: { '@type': 'WebSite', name: 'MDM1.org', url: ORIGIN + '/' } },
    hero: hero('MDM1.org', S.title, S.intro),
    main: `<main class="page-content i18n-body">
${S.notice ? `<p>${esc(S.notice)}</p>` : ''}
<h2>${esc(S.linksTitle)}</h2>
<nav class="i18n-list">${official}</nav>
<p><a href="https://md1usd.com/" rel="noopener">MD1USD · md1usd.com</a></p>${plansBlock}
</main>`,
    navLink: ['/', ui.arabicSite],
    footer: '✦ MDM1.org ✦'
  }));

  if (mine.length) write(`${c}/pages/index.html`, shell({
    lang: c, title: `${S.plansTitle} — MDM1`, description: S.plansText, path: listPath(c),
    alts: [['ar', '/pages/index.html'], ...planLangs.map(x => [x, listPath(x)])], xdef: hasPlans('en') ? listPath('en') : '/pages/index.html', og: 'website',
    ld: { '@type': 'CollectionPage', name: `${S.plansTitle} — MDM1`, isPartOf: { '@type': 'WebSite', name: 'MDM1.org', url: ORIGIN + '/' } },
    hero: hero('MDM1', S.plansTitle, S.plansText),
    main: `<main class="page-content i18n-body"><nav class="i18n-list">${mine.map(link).join('')}</nav></main>`,
    navLink: [homePath(c), ui.home],
    footer: `✦ MDM1 · ${mine.length} ✦`
  }));
  write(`${c}/${MARK}`, 'generated by scripts/build-i18n.js — safe to delete; regenerated on every run\n');
}

// ───────────── 6) sitemap-i18n.xml (hreflang داخل الـsitemap يغطي الصفحات العربية الأصلية دون تعديلها)
const xl = alts => alts.map(([c, p]) => `    <xhtml:link rel="alternate" hreflang="${hl(c)}" href="${url(p)}"/>`).join('\n');
const rows = [];
const group = (alts, xdef, last) => {
  const all = `${xl(alts)}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${url(xdef)}"/>`;
  for (const [, p] of alts) rows.push(`  <url>\n    <loc>${url(p)}</loc>${last ? `\n    <lastmod>${last}</lastmod>` : ''}\n${all}\n  </url>`);
};
group(landingAlts, landingX, '');
for (const pg of core) {                      // صفحات أساسية مترجمة يدويًا: تُعلَن دائمًا
  const have = LANGS.filter(c => pg.tr[c]);
  group([['ar', pagePath('ar', pg.slug)], ...have.map(c => [c, pagePath(c, pg.slug)])], pg.tr.en ? pagePath('en', pg.slug) : pagePath('ar', pg.slug), '');
}
if (!withheld) {      // نفس قرار الموقع: خطط الـ sitemap محجوبة حتى تُراجع (علامة robots.txt)
  for (const it of items) {
    const have = LANGS.filter(c => it.tr[c]);
    group([['ar', pagePath('ar', it.slug)], ...have.map(c => [c, pagePath(c, it.slug)])],
      it.tr.en ? pagePath('en', it.slug) : pagePath('ar', it.slug), String(it.date).slice(0, 10));
  }
}
write('sitemap-i18n.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join('\n')}\n</urlset>\n`);

// ───────────── 7) ملخص
const total = Object.values(countByLang).reduce((a, b) => a + b, 0);
const coreTotal = Object.values(coreCount).reduce((a, b) => a + b, 0);
console.log(`✅ ${LANGS.length} لغة: ${LANGS.length} صفحة رئيسية + ${planLangs.length} فهرس خطط + ${coreTotal} صفحة أساسية مترجمة + ${total} صفحة خطة (${items.length} خطة)`);
console.log('   خطط: ' + planLangs.map(c => `${c}:${countByLang[c]}`).join('  '));
console.log('   أساسية: ' + (Object.keys(coreCount).map(c => `${c}:${coreCount[c]}`).join('  ') || '—'));
console.log(`   تخطّيت ${skippedQuality} ترجمة خطة (فشلت بوابة الجودة)`);
console.log(`   sitemap-i18n.xml: ${rows.length} رابط${withheld ? ' (خطط الموقع محجوبة بعلامة robots.txt)' : ''}`);
