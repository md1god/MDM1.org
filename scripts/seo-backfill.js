#!/usr/bin/env node
// تشغيل مرة واحدة من جذر المستودع: node scripts/seo-backfill.js
// يضيف description/canonical/og/JSON-LD لكل الصفحات المولّدة (pages/<رقم>.html) ويبني sitemap-pages.xml
// الصفحات الرقيقة جدًا (أقل من 120 كلمة) تأخذ noindex بدل الظهور في الـ sitemap.
const fs = require('fs');
const path = require('path');
const { seoHead, writeSitemapPages, ensureRobotsSitemap } = require('./seo-meta');

const MIN_WORDS = 120;
const registry = JSON.parse(fs.readFileSync('pages-registry.json', 'utf8'));
const bySlug = new Map(registry.map(e => [String(e.slug), e]));

function textOf(html) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
function pick(html, re) { const m = html.match(re); return m ? textOf(m[1]) : ''; }

const files = fs.readdirSync('pages').filter(f => /^\d+\.html$/.test(f));
const indexable = [];
let patched = 0, noindexed = 0, skipped = 0;

for (const f of files) {
  const slug = f.replace('.html', '');
  const p = path.join('pages', f);
  let html = fs.readFileSync(p, 'utf8');
  if (/rel="canonical"/.test(html) || /name="robots"/.test(html)) {
    skipped++;
    const wc = textOf(html.replace(/<nav[\s\S]*?<\/nav>/i, '')).split(' ').length;
    if (wc < MIN_WORDS) {
      // صفحة رقيقة لها canonical قديم: تُمنع من الفهرسة وتخرج من الـ sitemap
      if (!/name="robots"/.test(html)) {
        html = html.replace(/(<title>[\s\S]*?<\/title>\s*)/i, `$1<meta name="robots" content="noindex,follow">\n  `);
        fs.writeFileSync(p, html, 'utf8');
        noindexed++;
      }
    } else if (/rel="canonical"/.test(html)) {
      indexable.push(bySlug.get(slug) || { slug, date: '' });
    }
    continue;
  }
  const title = pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || pick(html, /<title>([\s\S]*?)<\/title>/i);
  const sub = pick(html, /<p class="page-sub"[^>]*>([\s\S]*?)<\/p>/i);
  const body = pick(html, /<section[^>]*id="pg-body"[^>]*>([\s\S]*?)<\/section>/i);
  const words = textOf(html.replace(/<nav[\s\S]*?<\/nav>/i, '')).split(' ').length;
  const entry = bySlug.get(slug);
  const thin = words < MIN_WORDS;
  const description = (sub && sub.length >= 60) ? sub : [sub, body].filter(Boolean).join(' — ');
  const head = seoHead({
    title, description, urlPath: `/pages/${slug}.html`,
    isoDate: entry && entry.date, noindex: thin
  });
  html = html.replace(/(<title>[\s\S]*?<\/title>\s*)/i, `$1${head.trimStart()}`);
  fs.writeFileSync(p, html, 'utf8');
  patched++;
  if (thin) noindexed++; else indexable.push(entry || { slug, date: '' });
}

indexable.sort((a, b) => Number(a.slug) - Number(b.slug));
writeSitemapPages(indexable);
ensureRobotsSitemap();
console.log(`patched=${patched} noindex=${noindexed} already-ok=${skipped} in-sitemap=${indexable.length}`);
