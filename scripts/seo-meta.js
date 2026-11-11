// وحدة مشتركة للسيو: تُستخدم من build-pages.js (للصفحات الجديدة) ومن seo-backfill.js (للصفحات القديمة)
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://mdm1.org';
const OG_IMAGE = `${ORIGIN}/images/og-card.jpg`;

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function clip(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[،,.:؛\s]+$/, '') + '…';
}


// حدود Bing الموصى بها: العنوان 30-60 حرفًا، والوصف 120-160 حرفًا
const MIN_TITLE = 30;
const MIN_DESC = 120;
const PLAN_TAILS = [
  ' خطة مشروع كاملة من MDM1 تشمل الفكرة والجمهور والمنتج ونموذج الربح وخطة الانتشار وإدارة المخاطر.',
  ' خطة مشروع كاملة من MDM1 تشمل الفكرة والجمهور ونموذج الربح وخطة الانتشار.',
  ' خطة مشروع كاملة تشمل الفكرة ونموذج الربح وخطة الانتشار.',
  ' خطة مشروع كاملة من MDM1.'
];
const GENERIC_TAIL = ' صفحة من منصة MDM1 تقدّم معلومات ومحتوى عن المشروع والمجتمع والأدوات الرقمية المرتبطة به.';

const len = v => [...String(v)].length;

// عنوان <title>: "<العنوان> - MDM1" وإن كان أقصر من الحد الموصى به يُضاف وصف للمنصة
function richTitle(title) {
  const base = String(title || '').replace(/\s+/g, ' ').trim();
  const t = `${base} - MDM1`;
  return len(t) >= MIN_TITLE ? t : `${base} | MDM1 للمشاريع الرقمية`;
}

// وصف الميتا: يُستخدم الوصف كما هو إن كان كافيًا، وإلا يُكمَّل بجملة صادقة عن محتوى الصفحة
function richDescription(title, description) {
  const d = String(description || '').replace(/\s+/g, ' ').trim();
  if (len(d) >= MIN_DESC) return clip(d, 155);
  const isPlan = /خطة مشروع كاملة/.test(title || '');
  const name = String(title || '').replace(/\s*[—-]\s*خطة مشروع كاملة\s*$/, '').replace(/\s*[-|]\s*MDM1\s*$/, '').trim();
  const head = d ? `${name}: ${d}${/[.!؟?]$/.test(d) ? '' : '.'}` : `${name}.`;
  const tails = isPlan ? PLAN_TAILS : [GENERIC_TAIL];
  // أطول ذيل يبقي الوصف ضمن 155 حرفًا بلا اقتطاع
  const fit = tails.find(t => len(head + t) <= 155) || tails[tails.length - 1];
  return clip(head + fit, 155);
}

// يبني كتلة <head> الخاصة بالسيو لصفحة واحدة
function seoHead({ title, description, urlPath, isoDate, noindex }) {
  const url = `${ORIGIN}${urlPath}`;
  if (noindex) return [
    '  <meta name="robots" content="noindex,follow">',
    `  <meta property="og:image" content="${OG_IMAGE}">`,
    '  <meta property="og:image:type" content="image/jpeg">',
    '  <meta property="og:image:width" content="1200">',
    '  <meta property="og:image:height" content="630">',
    `  <meta name="twitter:image" content="${OG_IMAGE}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    ''
  ].join('\n');
  const desc = richDescription(title, description);
  const date = isoDate || new Date().toISOString();
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: clip(title, 110),
    description: desc,
    inLanguage: 'ar',
    datePublished: date,
    dateModified: date,
    mainEntityOfPage: url,
    image: OG_IMAGE,
    author: { '@type': 'Organization', name: 'MDM1', url: ORIGIN },
    publisher: { '@type': 'Organization', name: 'MDM1', url: ORIGIN }
  };
  return [
    `  <meta name="description" content="${esc(desc)}">`,
    `  <link rel="canonical" href="${url}">`,
    `  <meta property="og:type" content="article">`,
    `  <meta property="og:site_name" content="MDM1">`,
    `  <meta property="og:locale" content="ar_AR">`,
    `  <meta property="og:title" content="${esc(clip(title, 90))}">`,
    `  <meta property="og:description" content="${esc(desc)}">`,
    `  <meta property="og:url" content="${url}">`,
    `  <meta property="og:image" content="${OG_IMAGE}">`,
    '  <meta property="og:image:type" content="image/jpeg">',
    '  <meta property="og:image:width" content="1200">',
    '  <meta property="og:image:height" content="630">',
    `  <meta name="twitter:image" content="${OG_IMAGE}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    ''
  ].join('\n');
}

// يكتب sitemap-pages.xml من سجل الصفحات (الصفحات المفهرسة فقط)
function writeSitemapPages(entries, outFile = 'sitemap-pages.xml') {
  const rows = entries.map(e => {
    const last = String(e.date || '').slice(0, 10);
    return `  <url>\n    <loc>${ORIGIN}/pages/${e.slug}.html</loc>${last ? `\n    <lastmod>${last}</lastmod>` : ''}\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(outFile, xml, 'utf8');
}

// يتأكد أن robots.txt يعلن عن sitemap-pages.xml
function ensureRobotsSitemap(robotsFile = 'robots.txt') {
  const line = `Sitemap: ${ORIGIN}/sitemap-pages.xml`;
  let txt = fs.existsSync(robotsFile) ? fs.readFileSync(robotsFile, 'utf8') : 'User-agent: *\nAllow: /\n';
  if (/#\s*sitemap-pages:\s*withheld/.test(txt)) return; // قرار مقصود: الخطط خارج الإعلان حتى تُراجع
  if (!txt.includes(line)) {
    txt = txt.replace(/\s*$/, '\n') + line + '\n';
    fs.writeFileSync(robotsFile, txt, 'utf8');
  }
}

module.exports = { ORIGIN, esc, clip, richTitle, richDescription, seoHead, writeSitemapPages, ensureRobotsSitemap };
