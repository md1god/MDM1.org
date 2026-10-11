// Headless smoke test: the page must load offline, run without JS errors, and survive clicking every button.
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.goto('file://' + require('path').resolve(file));
  await p.waitForTimeout(500);
  const n = await p.evaluate(() => document.querySelectorAll('.app button, .app input, .app select, .app textarea, .app canvas').length);
  if (n < 3) errs.push('no interactive app elements found (' + n + ')');
  const btns = await p.$$('.app button');
  for (const btn of btns.slice(0, 40)) { try { await btn.click({ timeout: 800, force: true }); } catch (_) {} }
  await p.waitForTimeout(300);
  await b.close();
  if (errs.length) { console.error('SMOKE FAIL\n' + errs.join('\n')); process.exit(1); }
  console.log('SMOKE OK, elements:', n);
})();
