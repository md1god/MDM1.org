#!/usr/bin/env node
// Fails (exit 1) if any published page has a leaked-reasoning / empty / placeholder title or description.
// Pages listed in data/excluded-pages.json, or marked noindex, are skipped (they are quarantined on purpose).
const fs = require('fs');
const path = require('path');
const { findProblems } = require('./page_quality');
const root = path.resolve(__dirname, '..');
const excludedFile = path.join(root, 'data/excluded-pages.json');
const excluded = new Set(fs.existsSync(excludedFile) ? JSON.parse(fs.readFileSync(excludedFile, 'utf8')).excluded.map(e => e.path) : []);
const dirs = ['pages', 'apps', 'tools', 'learn'];
const decode = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
let bad = 0, checked = 0;
for (const d of dirs) {
  const dir = path.join(root, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
    const rel = `${d}/${f}`;
    if (excluded.has(rel)) continue;
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    if (/name="robots"[^>]*noindex/i.test(s)) continue;
    const title = (s.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const description = (s.match(/<meta name="description" content="([\s\S]*?)"\s*\/?>/i) || [])[1] || '';
    const problems = findProblems({ title: decode(title), description: decode(description) });
    checked++;
    if (problems.length) { bad++; console.error(`✗ ${rel}\n   ${problems.join('\n   ')}`); }
  }
}
console.log(`فُحصت ${checked} صفحة، المخالفة: ${bad}`);
process.exit(bad ? 1 : 0);
