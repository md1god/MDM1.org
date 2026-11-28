#!/usr/bin/env node
/* Single source of truth for the MDM1 Office cache-busting version.
 *
 *   node scripts/office-version.js check        # every occurrence must equal office/VERSION
 *   node scripts/office-version.js set <ver>    # rewrite VERSION + every occurrence
 *   node scripts/office-version.js bump         # pwa42 -> pwa43 (date = today, UTC)
 *
 * A version looks like 20261128pwa42 (optionally with a suffix such as ui1).
 * The office files (index.html, sw.js, pwa.js, standalone.js, manifest, config,
 * portal.html, styles.css) repeat it so browsers and the service worker refetch
 * changed assets; editing it by hand in 8 places caused repeated merge conflicts.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const OFFICE = path.join(__dirname, '..', 'office');
const VERSION_FILE = path.join(OFFICE, 'VERSION');
const RE = /20\d{6}pwa\d+[a-z0-9]*/g;
const SKIP_DIRS = new Set(['fonts']);
const TEXT_EXT = /\.(?:html|js|css|json|webmanifest)$/i;

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : files(p);
    return TEXT_EXT.test(e.name) ? [p] : [];
  });
}
const rel = (p) => path.relative(path.join(__dirname, '..'), p).split(path.sep).join('/');
const current = () => fs.readFileSync(VERSION_FILE, 'utf8').trim();

function scan() {
  const out = [];
  for (const f of files(OFFICE)) {
    const m = fs.readFileSync(f, 'utf8').match(RE);
    if (m) out.push({ file: f, versions: [...new Set(m)] });
  }
  return out;
}

function check() {
  const want = current();
  if (!/^20\d{6}pwa\d+[a-z0-9]*$/.test(want)) throw new Error('office/VERSION is not a valid version: ' + want);
  const bad = scan().filter((s) => s.versions.some((v) => v !== want));
  if (bad.length) {
    console.error('Version mismatch (office/VERSION = ' + want + '):');
    bad.forEach((b) => console.error('  ' + rel(b.file) + ' -> ' + b.versions.join(', ')));
    console.error('Fix with: node scripts/office-version.js set ' + want);
    process.exit(1);
  }
  const n = scan().length;
  if (n < 5) throw new Error('Expected the version in several office files, found ' + n);
  console.log('Office version ' + want + ' is consistent in ' + n + ' files.');
}

function set(ver) {
  if (!/^20\d{6}pwa\d+[a-z0-9]*$/.test(ver || '')) throw new Error('Usage: set <YYYYMMDDpwaNN[suffix]>');
  let changed = 0;
  for (const s of scan()) {
    const text = fs.readFileSync(s.file, 'utf8');
    const next = text.replace(RE, ver);
    if (next !== text) { fs.writeFileSync(s.file, next); changed++; }
  }
  fs.writeFileSync(VERSION_FILE, ver + '\n');
  console.log('Office version set to ' + ver + ' (' + changed + ' files changed).');
}

function bump() {
  const m = current().match(/^(20\d{6})pwa(\d+)/);
  if (!m) throw new Error('office/VERSION is not a valid version');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  set(today + 'pwa' + (Number(m[2]) + 1));
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'check') check();
  else if (cmd === 'set') set(arg);
  else if (cmd === 'bump') bump();
  else { console.error('Usage: office-version.js check | set <ver> | bump'); process.exit(2); }
} catch (e) { console.error(e.message); process.exit(1); }
