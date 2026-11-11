#!/usr/bin/env node
// تشغيل من جذر المستودع: node scripts/seo-lengths-backfill.js [--dry]
// يطيل العناوين والأوصاف القصيرة في صفحات pages/<رقم>.html المولّدة إلى الحدود التي يوصي بها Bing
// (عنوان 30+ حرفًا، وصف 120-160 حرفًا). الصفحات التي فيها نص مسرّب أو بديل تُمنع من الفهرسة.
const fs = require('fs');
const { richTitle, richDescription, esc } = require('./seo-meta');
const dry = process.argv.includes('--dry');
const dec = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const len = v => [...v].length;
const JUNK = /Let me|<one sentence>|\bpick\b|TODO|lorem/i;

let t = 0, d = 0, junk = 0, ok = 0;
for (const f of fs.readdirSync('pages').filter(x => /^\d+\.html$/.test(x))) {
  const p = `pages/${f}`;
  let h = fs.readFileSync(p, 'utf8');
  if (/name="robots"[^>]*noindex/.test(h)) continue;
  const tm = h.match(/<title>([\s\S]*?)<\/title>/);
  const dm = h.match(/<meta name="description" content="([^"]*)">/);
  if (!tm) continue;
  if (!/خطة مشروع كاملة/.test(tm[1])) { console.log('SKIP (hand-written needed):', p); continue; }
  const rawTitle = dec(tm[1]).replace(/\s*-\s*MDM1\s*$/, '').replace(/\s*\|\s*MDM1 للمشاريع الرقمية\s*$/, '');
  const rawDesc = dm ? dec(dm[1]) : '';
  if (JUNK.test(rawTitle) || JUNK.test(rawDesc)) {
    junk++;
    console.log('JUNK → noindex:', p, '|', rawTitle.slice(0, 50));
    if (!dry) {
      h = h.replace(/(<title>[\s\S]*?<\/title>)/, '$1\n  <meta name="robots" content="noindex,follow">');
      fs.writeFileSync(p, h, 'utf8');
    }
    continue;
  }
  const newTitle = richTitle(rawTitle);
  const newDesc = richDescription(rawTitle, rawDesc);
  let changed = false;
  if (dec(tm[1]) !== newTitle) { h = h.replace(tm[0], `<title>${esc(newTitle)}</title>`); t++; changed = true; }
  if (dm && dec(dm[1]) !== newDesc) {
    h = h.replace(dm[0], `<meta name="description" content="${esc(newDesc)}">`);
    h = h.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${esc(newDesc)}$2`);
    h = h.replace(/("description":")[^"]*(","inLanguage")/, (m, a, b) => a + JSON.stringify(newDesc).slice(1, -1) + b);
    d++; changed = true;
  }
  if (changed && !dry) fs.writeFileSync(p, h, 'utf8');
  if (len(newTitle) < 30 || len(newDesc) < 120 || len(newDesc) > 160) console.log('STILL OUT OF RANGE:', p, len(newTitle), len(newDesc));
  ok++;
}
console.log(`${dry ? '[dry] ' : ''}titles=${t} descriptions=${d} junk=${junk} checked=${ok}`);
