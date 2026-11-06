// Runs smoke_app.js logic over every apps/*.html. Usage: NODE_PATH=... node scripts/smoke_all.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const files = fs.readdirSync('apps').filter(f => f.endsWith('.html') && f !== 'index.html').sort();
let fail = 0;
for (const f of files) {
  try { execFileSync('node', ['scripts/smoke_app.js', 'apps/' + f], { stdio: 'pipe' }); }
  catch (e) { fail++; console.error('FAIL apps/' + f + '\n' + (e.stderr || '').toString().trim()); }
}
console.log(`smoke: ${files.length - fail}/${files.length} passed`);
process.exit(fail ? 1 : 0);
