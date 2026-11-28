#!/usr/bin/env node
/* MDM1 Office UI smoke test (headless Chromium, mocked API).
 *
 * Loads the real office/index.html + app.js + styles.css with the runtime
 * loader and /api/* replaced by fixtures built from office/data.json, then checks:
 *   - the office floor renders and no 3D tilt covers the content below it
 *   - hostile agent names / ids / bubbles are rendered as text (no XSS)
 *   - all tabs open without JS errors or horizontal overflow (desktop + phone)
 *   - the staff search filters the floor
 *   - the Content-Security-Policy is present and nothing in the page violates it
 *
 *   node tests/office-ui-smoke.js        (needs: npm i playwright && npx playwright install chromium)
 */
'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.jfif': 'image/jpeg' };

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const file = path.normalize(path.join(ROOT, u.endsWith('/') ? u + 'index.html' : u));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

function fixture() {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'office', 'data.json'), 'utf8'));
  const hostile = {
    id: "x');window.__pwn=1;('", name: '<img src=x onerror="window.__pwn=2">', englishName: 'Hostile',
    avatar: '<b onmouseover="window.__pwn=3">', department: '"><script>window.__pwn=4</script>',
    zone: 'legal', status: 'working', bubble: '<img src=x onerror=window.__pwn=5>'
  };
  const zones = base.agents.map((a) => a.zone);
  const agents = base.agents.concat([hostile]).map((a, i) => ({
    ...a, status: a.status === 'available' && i % 3 === 1 ? 'working' : a.status,
    bubble: a.bubble || (i % 2 ? 'جاري العمل على تقرير تحليل الموقع ونقاط القوة والضعف' : ''),
    memoryCount: i * 3, gamification: { points: 40 + i * 10, rankTitle: 'موظف تنفيذي', level: 1, badges: [] },
    allowedTools: a.allowedTools || [], requiresApprovalFor: a.requiresApprovalFor || [], roleMd: a.roleMd || '', skillsMd: a.skillsMd || ''
  }));
  const longTitle = 'تقرير تحليل الموقع يشمل نقاط القوة والضعف والفرص والتهديدات (SWOT) مع توصيات تفصيلية لكل قسم';
  const longDesc = 'إعداد جدول متابعة وتلخيص الحالة للمدير. السبب: تنسيق عام ومتابعة التنفيذ مع كل الأقسام المعنية في الشركة';
  return {
    agents, zones, providerConfig: { provider: 'cloud', model: 'big-pickle', hasKey: true }, providerStatus: {},
    knowledgeFiles: base.knowledge || [], exports: [], auditLog: [], sandboxFiles: [], playbooks: base.playbooks || [], snapshots: [],
    memoryStats: { totalMemories: 14, byAgent: {} }, outgoingWebhooks: {}, telegramEnabled: false,
    state: {
      directChats: {}, teamChat: [], tasks: agents.slice(0, 6).map((a, i) => ({ id: 't' + i, agentId: a.id, title: longTitle, description: longDesc, status: 'working' })),
      approvals: [{ id: 'a1', status: 'pending', risk: 'low', agentName: 'x', actionType: 'y', title: 't', details: 'd' }],
      webhooks: [], usageStats: { totalTokens: 3968, totalCostUsd: 0, byAgent: {} }, meetingActive: false, meetingAttendees: [],
      internalMemos: [{ id: 'm1', read: false, subject: 's', body: 'b', fromName: 'f', toName: 't', fromAvatar: '', toAvatar: '' }],
      kpiReviews: [], financialLedger: [], schedules: [], gamification: {}, customers: [], votes: [], emergencyMode: false, incidents: [], simulations: [], requestLedger: []
    }
  };
}

const STRIP = /<script src="(?:https:\/\/mdm1\.org\/js\/lang\.js|office-config\.js|office-auth\.js|pwa\.js|standalone\.js)[^"]*"><\/script>/g;
function mockedIndex(html, data) {
  const stub = '<script>(function(){var D=' + JSON.stringify(data).replace(/</g, '\\u003c') + ';' +
    'window.fetch=function(u){var s=String(u);var body=s.indexOf("/api/bootstrap")>=0?D:{};' +
    'return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve(body)},text:function(){return Promise.resolve("")}})};' +
    'window.MDM1OfficeReady=Promise.resolve();window.MDM1Office={ready:Promise.resolve(),showToast:function(){},openConnectionPanel:function(){}};' +
    'window.__csp=[];document.addEventListener("securitypolicyviolation",function(e){window.__csp.push(e.violatedDirective+" "+e.blockedURI)});})();</script>';
  return html.replace(STRIP, '').replace('<body>', '<body>' + stub);
}

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.error('playwright is not installed: npm i playwright && npx playwright install chromium'); process.exit(2); }
  const srv = await startServer();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const html = fs.readFileSync(path.join(ROOT, 'office', 'index.html'), 'utf8');
  const data = fixture();
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const failures = [];
  const fail = (m) => { failures.push(m); console.error('  ✗ ' + m); };
  const ok = (m) => console.log('  ✓ ' + m);

  if (!/Content-Security-Policy/.test(html)) fail('office/index.html has no Content-Security-Policy meta');

  for (const [label, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
    console.log(label + ' ' + w + 'x' + h);
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('dialog', (d) => d.dismiss());
    await page.route('**/office/index.html*', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: mockedIndex(html, data) }));
    await page.goto(base + '/office/index.html');
    const rendered = await page.waitForSelector('.desk-card', { timeout: 10000 }).then(() => true).catch(() => false);
    if (!rendered) { fail(label + ': office floor did not render' + (errs.length ? ' (' + errs[0] + ')' : '')); await page.close(); continue; }
    await page.waitForTimeout(300);
    ok('office floor rendered');

    // XSS payloads must stay inert text
    const xss = await page.evaluate(() => ({ pwn: window.__pwn || 0, injected: !!document.querySelector('.office-rooms img[src="x"], .office-rooms b[onmouseover], .office-rooms script, #tasksGrid img[src="x"]') }));
    if (xss.pwn || xss.injected) fail(label + ': hostile agent data was executed or injected as HTML (' + JSON.stringify(xss) + ')'); else ok('hostile agent data stays inert');

    // No 3D tilt / overlap between the floor and the section after it
    const geo = await page.evaluate(() => {
      const r = document.getElementById('officeRooms'), t = document.querySelector('.tasks-strip');
      return { transform: getComputedStyle(r).transform, perspective: getComputedStyle(r.parentElement).perspective, roomsBottom: r.getBoundingClientRect().bottom, tasksTop: t ? t.getBoundingClientRect().top : null };
    });
    if (geo.transform !== 'none' || geo.perspective !== 'none') fail(label + ': office floor is 3D-transformed (' + geo.transform + ' / ' + geo.perspective + ')');
    else if (geo.tasksTop !== null && geo.tasksTop < geo.roomsBottom - 1) fail(label + ': tasks section overlaps the office floor');
    else ok('no 3D tilt, no overlap');

    // Every tab: no horizontal overflow, no new JS errors
    const tabs = await page.$$eval('.nav-item', (els) => els.map((e) => e.dataset.tab));
    const overflow = [];
    for (const t of tabs) {
      // switchTab() is what both the sidebar and the phone bottom bar call
      await page.evaluate((tab) => window.switchTab(tab), t);
      await page.waitForTimeout(60);
      const over = await page.evaluate(() => { const c = document.querySelector('.content-area'); return c.scrollWidth > c.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth; });
      if (over) overflow.push(t);
    }
    if (overflow.length) fail(label + ': horizontal overflow in tabs: ' + overflow.join(', ')); else ok(tabs.length + ' tabs open without horizontal overflow');
    await page.evaluate(() => window.switchTab('office'));

    // Navigation: sidebar on desktop, bottom bar on phones
    const navVisible = await page.evaluate((phone) => {
      const el = document.querySelector(phone ? '#mobileBottomNav' : '.sidebar');
      return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    }, w <= 900);
    if (!navVisible) fail(label + ': navigation (' + (w <= 900 ? 'bottom bar' : 'sidebar') + ') is not visible'); else ok('navigation visible');

    // Staff search
    const input = await page.$('#staffSearchInput');
    if (!input) fail(label + ': #staffSearchInput missing');
    else {
      const total = await page.$$eval('.desk-card', (e) => e.length);
      await input.fill('zzzz-no-such-agent');
      await page.waitForTimeout(120);
      const none = await page.$$eval('.desk-card', (e) => e.length);
      await input.fill('');
      await page.waitForTimeout(120);
      const back = await page.$$eval('.desk-card', (e) => e.length);
      if (none !== 0 || back !== total) fail(label + ': staff search did not filter (' + total + ' -> ' + none + ' -> ' + back + ')'); else ok('staff search filters and resets');
    }

    if (process.env.SMOKE_SHOTS) { fs.mkdirSync(process.env.SMOKE_SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.SMOKE_SHOTS, label + '.png') }); }
    // Backup reminder (fixture has data but no snapshots) can be snoozed
    const remShown = await page.evaluate(() => { const e = document.getElementById('backupReminder'); return !!e && !e.classList.contains('hidden') && e.textContent.length > 20; });
    if (!remShown) fail(label + ': backup reminder is not shown');
    else {
      await page.click('#backupLaterBtn');
      const remHidden = await page.evaluate(() => document.getElementById('backupReminder').classList.contains('hidden'));
      if (!remHidden) fail(label + ': backup reminder was not snoozed'); else ok('backup reminder shows and snoozes');
    }
    if (w > 900) {
      const toggle = await page.evaluate(() => { const t = document.getElementById('approvalSoundToggle'); return !!t && t.checked; });
      if (!toggle) fail(label + ': approval sound toggle missing'); else ok('approval sound toggle present');
    }

    const csp = await page.evaluate(() => window.__csp || []);
    if (csp.length) fail(label + ': CSP violations: ' + csp.join('; ')); else ok('no CSP violations');
    if (errs.length) fail(label + ': JS errors: ' + errs.slice(0, 3).join(' | '));
    await page.close();
  }

  await browser.close();
  srv.close();
  if (failures.length) { console.error('\n' + failures.length + ' check(s) failed.'); process.exit(1); }
  console.log('\nOffice UI smoke test passed.');
})().catch((e) => { console.error(e); process.exit(1); });
