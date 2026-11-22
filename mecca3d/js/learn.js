// Spaced-repetition learning for streets and neighbourhoods.
import { store, norm, streetKey, bearingDeg, dirName } from './util.js';

const MIN = 60 * 1000;
const INTERVALS = [0, 10 * MIN, 24 * 60 * MIN, 3 * 24 * 60 * MIN, 7 * 24 * 60 * MIN, 21 * 24 * 60 * MIN]; // by box 0..5

export class Learn {
  constructor(D) {
    this.D = D;
    this.srs = store.get('m3d_srs', {});
    this.seen = new Set(store.get('m3d_seen', []));
    this.stats = store.get('m3d_stats', { ok: 0, total: 0 });
    this.task = null; this.lastKey = null; this._saveT = 0;
    for (const s of D.streets.values()) {
      let m = 99;
      for (const i of s.ri) if (D.roads[i].t < m) m = D.roads[i].t;
      s.minT = m;
    }
  }
  _save() {
    store.set('m3d_srs', this.srs); store.set('m3d_stats', this.stats);
  }
  markSeen(key) {
    if (!key || this.seen.has(key)) return false;
    this.seen.add(key);
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => store.set('m3d_seen', Array.from(this.seen)), 2000);
    return true;
  }
  box(key) { return this.srs[key] ? this.srs[key].b : -1; }

  pool(scope) {
    const out = [];
    for (const s of this.D.streets.values()) {
      if (!s.drv || s.minT > 6) continue;
      if (scope === 'major') { if (s.minT > 4 || s.len < 500) continue; }
      else if (scope === 'all') { if (s.len < 150) continue; }
      else if (scope.startsWith('hood:')) { if (s.hood !== scope.slice(5) || s.len < 120) continue; }
      out.push(s);
    }
    return out;
  }

  pick(scope) {
    const pool = this.pool(scope);
    if (!pool.length) return null;
    const now = Date.now();
    const failed = [], fresh = [], due = [], later = [];
    for (const s of pool) {
      if (this.task && this.task.key === s.key) continue;
      const r = this.srs[s.key];
      if (!r) fresh.push(s);
      else if (r.b === 0) failed.push(s);
      else if (r.due <= now) due.push(s);
      else later.push(s);
    }
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    if (failed.length && (Math.random() < 0.6 || !fresh.length)) return rnd(failed);
    if (due.length && (Math.random() < 0.5 || !fresh.length)) return rnd(due);
    if (fresh.length) {
      fresh.sort((a, b) => b.len - a.len); // important (long) streets first
      return fresh[Math.floor(Math.random() * Math.min(8, fresh.length))];
    }
    if (due.length) return rnd(due);
    if (failed.length) return rnd(failed);
    later.sort((a, b) => this.srs[a.key].due - this.srs[b.key].due);
    return later[0] || null;
  }

  startTask(scope, type) {
    const s = this.pick(scope);
    if (!s) return null;
    this.task = { type, scope, key: s.key, name: s.name, street: s, hints: 0, startedAt: Date.now(), done: false };
    return this.task;
  }
  stopTask() { this.task = null; }

  // distance bucket + direction hint (level 1)
  hintText(px, pz) {
    const t = this.task; if (!t) return '';
    const dx = t.street.mx - px, dz = t.street.mz - pz, d = Math.hypot(dx, dz);
    const near = d < 400 ? 'قريب منك' : d < 1200 ? 'على بعد نحو ' + (Math.round(d / 100) / 10) + ' كم' : 'بعيد: نحو ' + (Math.round(d / 100) / 10) + ' كم';
    return near + ' — ناحية ال' + dirName(bearingDeg(dx, dz)) + (t.street.hood ? ' (حي ' + t.street.hood.replace(/^حي\s+/, '') + ')' : '');
  }

  check(curKey, dist) {
    const t = this.task;
    return !!(t && t.type === 'goto' && !t.done && curKey && curKey === t.key && dist <= 14);
  }
  checkAnswer(text) {
    const t = this.task; if (!t) return false;
    const a = streetKey(text), c = t.key;
    return !!a && (a === c || (a.length >= 3 && (c.includes(a) || a.includes(c))));
  }

  finish(success) {
    const t = this.task; if (!t || t.done) return null;
    t.done = true;
    const r = this.srs[t.key] || { b: -1, due: 0 };
    let b = r.b < 0 ? 0 : r.b;
    if (success && t.hints === 0) b = Math.min(5, b + 1);
    else if (success && t.hints === 1) b = Math.max(1, b);
    else b = 0;
    this.srs[t.key] = { b, due: Date.now() + INTERVALS[b], n: (r.n || 0) + 1 };
    this.stats.total++; if (success && t.hints <= 1) this.stats.ok++;
    this.markSeen(t.key);
    this._save();
    return { box: b, success, hints: t.hints };
  }

  progress() {
    const rows = new Map();
    for (const s of this.D.streets.values()) {
      if (!s.drv || s.minT > 6 || s.len < 120) continue;
      const h = s.hood || '—';
      let r = rows.get(h);
      if (!r) { r = { hood: h, total: 0, known: 0, seen: 0 }; rows.set(h, r); }
      r.total++;
      if (this.box(s.key) >= 3) r.known++;
      if (this.seen.has(s.key)) r.seen++;
    }
    return Array.from(rows.values()).sort((a, b) => b.total - a.total);
  }
  totals() {
    let total = 0, known = 0, seen = 0;
    for (const s of this.D.streets.values()) {
      if (!s.drv || s.minT > 6 || s.len < 120) continue;
      total++; if (this.box(s.key) >= 3) known++; if (this.seen.has(s.key)) seen++;
    }
    return { total, known, seen };
  }
  reset() {
    this.srs = {}; this.seen = new Set(); this.stats = { ok: 0, total: 0 }; this.task = null;
    this._save(); store.set('m3d_seen', []);
  }
}
