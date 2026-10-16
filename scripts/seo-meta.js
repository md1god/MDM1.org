// وحدة مشتركة للسيو: تُستخدم من build-pages.js (للصفحات الجديدة) ومن seo-backfill.js (للصفحات القديمة)
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://mdm1.org';
const OG_IMAGE = `${ORIGIN}/images/md111-token.png`;

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

// يبني كتلة <head> الخاصة بالسيو لصفحة واحدة
function seoHead({ title, description, urlPath, isoDate, noindex }) {
  const url = `${ORIGIN}${urlPath}`;
  if (noindex) return '  <meta name="robots" content="noindex,follow">\n';
  const desc = clip(description, 155);
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
  if (!txt.includes(line)) {
    txt = txt.replace(/\s*$/, '\n') + line + '\n';
    fs.writeFileSync(robotsFile, txt, 'utf8');
  }
}

module.exports = { ORIGIN, esc, clip, seoHead, writeSitemapPages, ensureRobotsSitemap };
