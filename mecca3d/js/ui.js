// Minimap, big map, input controls and DOM labels.
import { clamp, norm } from './util.js';

const TYPE_COL = ['#f4cf74', '#f4cf74', '#eec26a', '#d9b866', '#b9b2a2', '#9a9aa2', '#8b8b94', '#737780', '#6d7078', '#5b5e66'];
const TYPE_W = [4, 4, 3.4, 3, 2.4, 2, 1.8, 1.3, 1, 0.8];
const SEG_CELL = 80;

function forSegments(D, x, z, rad, cb) {
  const R = Math.ceil(rad / SEG_CELL), cx = Math.floor(x / SEG_CELL), cz = Math.floor(z / SEG_CELL), seen = new Set();
  for (let ix = cx - R; ix <= cx + R; ix++) {
    for (let iz = cz - R; iz <= cz + R; iz++) {
      const a = D.idx.cells.get((ix + 2000) * 4000 + (iz + 2000));
      if (!a) continue;
      for (const v of a) { if (seen.has(v)) continue; seen.add(v); cb(v); }
    }
  }
}

export class Minimap {
  constructor(canvas, D) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.D = D; this.scale = 0.5; this.names = true;
  }
  draw(px, pz, headingRad, route, hlRoads, showNames) {
    const { g, c, D } = this, W = c.width, H = c.height, s = this.scale, rad = Math.hypot(W, H) / 2 / s + 30;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#14120d'; g.fillRect(0, 0, W, H);
    g.save();
    g.translate(W / 2, H * 0.62); g.rotate(-headingRad); g.scale(s, s);
    g.translate(-px, -pz);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const buckets = [[], [], [], []]; // major, mid, minor, foot
    forSegments(D, px, pz, rad, (v) => {
      const ri = (v / 8192) | 0, si = v - ri * 8192, r = D.roads[ri];
      const b = r.t <= 3 ? 0 : r.t <= 5 ? 1 : r.t <= 7 ? 2 : 3;
      buckets[b].push(r, si);
    });
    const widths = [5, 3.6, 2.4, 1.4], cols = ['#f4cf74', '#cfc2a0', '#8f949e', '#5b5e66'];
    for (let b = 3; b >= 0; b--) {
      g.beginPath();
      const arr = buckets[b];
      for (let i = 0; i < arr.length; i += 2) {
        const r = arr[i], si = arr[i + 1], p = r.pts;
        g.moveTo(p[si * 2], p[si * 2 + 1]); g.lineTo(p[si * 2 + 2], p[si * 2 + 3]);
      }
      g.strokeStyle = cols[b]; g.lineWidth = widths[b] / s * 0.9 + (b === 0 ? 1 : 0); g.stroke();
    }
    if (hlRoads && hlRoads.length) {
      g.strokeStyle = '#4da3ff'; g.lineWidth = 6 / s; g.beginPath();
      for (const ri of hlRoads) { const p = D.roads[ri].pts; g.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]); }
      g.stroke();
    }
    if (route) {
      g.strokeStyle = '#ffc933'; g.lineWidth = 6 / s; g.beginPath();
      const p = route.pts; g.moveTo(p[0], p[1]);
      for (let k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]);
      g.stroke();
      g.fillStyle = '#ffc933'; g.beginPath(); g.arc(p[p.length - 2], p[p.length - 1], 9 / s, 0, 7); g.fill();
    }
    g.restore();
    if (showNames) {
      g.font = 'bold 10px Tajawal, Tahoma, sans-serif'; g.textAlign = 'center'; g.direction = 'rtl';
      const placed = [], cs = Math.cos(headingRad), sn = Math.sin(headingRad);
      const cand = [];
      forSegments(D, px, pz, rad, (v) => {
        const ri = (v / 8192) | 0, si = v - ri * 8192, r = D.roads[ri];
        if (!r.name || r.t > 6) return;
        const mx = (r.pts[si * 2] + r.pts[si * 2 + 2]) / 2, mz = (r.pts[si * 2 + 1] + r.pts[si * 2 + 3]) / 2;
        const dx = mx - px, dz = mz - pz;
        const sx = W / 2 + (dx * cs + dz * sn) * s, sy = H * 0.62 + (-dx * sn + dz * cs) * s;
        if (sx < 20 || sx > W - 20 || sy < 12 || sy > H - 8) return;
        cand.push([r.t, sx, sy, r.name]);
      });
      cand.sort((a, b) => a[0] - b[0]);
      for (const [, sx, sy, nm] of cand) {
        if (placed.length > 9) break;
        const w = g.measureText(nm).width + 4;
        if (placed.some((q) => Math.abs(q[0] - sx) < (q[2] + w) / 2 && Math.abs(q[1] - sy) < 12)) continue;
        placed.push([sx, sy, w]);
        g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(nm, sx, sy);
        g.fillStyle = '#fff'; g.fillText(nm, sx, sy);
      }
    }
    // player arrow
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(W / 2, H * 0.62);
    g.fillStyle = '#4da3ff'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 5); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}

export class BigMap {
  constructor(canvas, D, hooks) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.D = D; this.hooks = hooks;
    const m = D.meta; this.x0 = m.x0; this.z0 = m.z0; this.PX = 0.2;
    this.cx = 0; this.cz = 0; this.S = 0.12; // screen px per metre
    this.open = false; this.dirty = true; this.discDirty = true; this.sel = null;
    this._buildBase();
    this._bind();
  }
  _buildBase() {
    const { D, PX } = this, m = D.meta, W = Math.ceil((m.x1 - m.x0) * PX), H = Math.ceil((m.z1 - m.z0) * PX);
    const base = this.base = document.createElement('canvas'); base.width = W; base.height = H;
    const g = base.getContext('2d');
    // hillshade
    const T = D.terrain, sh = document.createElement('canvas'); sh.width = T.w; sh.height = T.h;
    const sg = sh.getContext('2d'), img = sg.createImageData(T.w, T.h);
    let hmin = 1e9, hmax = -1e9;
    for (let i = 0; i < T.data.length; i++) { if (T.data[i] < hmin) hmin = T.data[i]; if (T.data[i] > hmax) hmax = T.data[i]; }
    for (let j = 0; j < T.h; j++) {
      for (let i = 0; i < T.w; i++) {
        const dx = (T.at(i + 1, j) - T.at(i - 1, j)) / (2 * T.step), dz = (T.at(i, j + 1) - T.at(i, j - 1)) / (2 * T.step);
        const lit = clamp(0.62 + (-dx * 0.7 - dz * 0.7) * 1.6, 0.25, 1.0);
        const e = (T.at(i, j) - hmin) / Math.max(1, hmax - hmin);
        const k = (j * T.w + i) * 4;
        img.data[k] = (196 - e * 40) * lit; img.data[k + 1] = (176 - e * 38) * lit; img.data[k + 2] = (140 - e * 30) * lit; img.data[k + 3] = 255;
      }
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(sh, 0, 0, T.w, T.h, (T.x0 - m.x0) * PX, (T.z0 - m.z0) * PX, (T.w - 1) * T.step * PX, (T.h - 1) * T.step * PX);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let pass = 3; pass >= 0; pass--) {
      g.beginPath();
      for (const r of D.roads) {
        const b = r.t <= 3 ? 0 : r.t <= 5 ? 1 : r.t <= 7 ? 2 : 3;
        if (b !== pass) continue;
        const p = r.pts; g.moveTo((p[0] - m.x0) * PX, (p[1] - m.z0) * PX);
        for (let k = 2; k < p.length; k += 2) g.lineTo((p[k] - m.x0) * PX, (p[k + 1] - m.z0) * PX);
      }
      g.strokeStyle = ['#f4cf74', '#d8cba8', '#9ea3ad', '#6a6e77'][pass]; g.lineWidth = [3.4, 2.4, 1.5, 1][pass]; g.stroke();
    }
    this.disc = document.createElement('canvas'); this.disc.width = W; this.disc.height = H;
  }
  _drawDiscovered(seen) {
    const { D, PX } = this, m = D.meta, g = this.disc.getContext('2d');
    g.clearRect(0, 0, this.disc.width, this.disc.height);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#3ddc97'; g.lineWidth = 2.6; g.beginPath();
    for (const r of D.roads) {
      if (!r.key || !seen.has(r.key) || r.t > 7) continue;
      const p = r.pts; g.moveTo((p[0] - m.x0) * PX, (p[1] - m.z0) * PX);
      for (let k = 2; k < p.length; k += 2) g.lineTo((p[k] - m.x0) * PX, (p[k + 1] - m.z0) * PX);
    }
    g.stroke();
    this.discDirty = false;
  }
  setOpen(o, px, pz) {
    this.open = o; this.c.parentElement.style.display = o ? 'block' : 'none';
    if (o) { this.cx = px; this.cz = pz; this._resize(); this.dirty = true; }
  }
  _resize() {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.c.width = Math.max(100, r.width * dpr); this.c.height = Math.max(100, r.height * dpr); this.dpr = dpr;
  }
  _toWorld(sx, sy) { const d = this.dpr; return { x: this.cx + (sx * d - this.c.width / 2) / (this.S * d), z: this.cz + (sy * d - this.c.height / 2) / (this.S * d) }; }
  _bind() {
    const c = this.c; let drag = null, pinch = null, moved = false;
    const pts = new Map();
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = [e.clientX, e.clientY]; moved = false; if (pts.size === 2) pinch = null; });
    c.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        const [a, b] = Array.from(pts.values()), d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) { this.S = clamp(this.S * d / pinch, 0.03, 1.6); this.dirty = true; }
        pinch = d; moved = true; return;
      }
      const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      this.cx -= dx / this.S; this.cz -= dy / this.S; drag = [e.clientX, e.clientY]; this.dirty = true;
    });
    const up = (e) => {
      const was = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (was && !moved && pts.size === 0) { const r = c.getBoundingClientRect(); this.select(this._toWorld(e.clientX - r.left, e.clientY - r.top)); }
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.S = clamp(this.S * (e.deltaY < 0 ? 1.15 : 0.87), 0.03, 1.6); this.dirty = true; }, { passive: false });
    window.addEventListener('resize', () => { if (this.open) { this._resize(); this.dirty = true; } });
  }
  zoom(f) { this.S = clamp(this.S * f, 0.03, 1.6); this.dirty = true; }
  select(p) {
    const n = this.D.idx.nearest(p.x, p.z, 40 / this.S * 0.4 + 15, { named: true });
    const hood = this.D.nearestHood(p.x, p.z);
    this.sel = { x: n ? n.x : p.x, z: n ? n.z : p.z, name: n ? n.road.name : '', hood: hood ? hood.n : '' };
    this.dirty = true;
    this.hooks.onSelect(this.sel);
  }
  draw(state) {
    if (!this.open) return;
    if (this.discDirty && state.seen) this._drawDiscovered(state.seen);
    if (!this.dirty && !state.force) return;
    this.dirty = false;
    const g = this.g, c = this.c, S = this.S * this.dpr, W = c.width, H = c.height, D = this.D, m = D.meta, PX = this.PX;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0d0c09'; g.fillRect(0, 0, W, H);
    const wx0 = this.cx - W / 2 / S, wz0 = this.cz - H / 2 / S, wx1 = this.cx + W / 2 / S, wz1 = this.cz + H / 2 / S;
    let sx = (wx0 - m.x0) * PX, sy = (wz0 - m.z0) * PX, sw = (wx1 - wx0) * PX, sh = (wz1 - wz0) * PX, dx = 0, dy = 0, dw = W, dh = H;
    const clipL = Math.max(0, -sx), clipT = Math.max(0, -sy), clipR = Math.max(0, sx + sw - this.base.width), clipB = Math.max(0, sy + sh - this.base.height);
    if (clipL < sw && clipT < sh) {
      const fx = W / sw, fy = H / sh;
      dx += clipL * fx; dy += clipT * fy; dw -= (clipL + clipR) * fx; dh -= (clipT + clipB) * fy;
      sx += clipL; sy += clipT; sw -= clipL + clipR; sh -= clipT + clipB;
      if (sw > 0 && sh > 0) {
        g.imageSmoothingEnabled = true;
        g.drawImage(this.base, sx, sy, sw, sh, dx, dy, dw, dh);
        g.drawImage(this.disc, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }
    const tx = (x) => (x - this.cx) * S + W / 2, tz = (z) => (z - this.cz) * S + H / 2;
    g.textAlign = 'center'; g.direction = 'rtl';
    const label = (txt, x, y, size, col) => {
      g.font = `bold ${size}px Tajawal, Tahoma, sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.9)'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y);
    };
    const dpr = this.dpr, placed = [];
    const free = (x, y, w) => { for (const q of placed) if (Math.abs(q[0] - x) < (q[2] + w) / 2 && Math.abs(q[1] - y) < 16 * dpr) return false; placed.push([x, y, w]); return true; };
    // streets names (zoomed in)
    if (this.S > 0.16) {
      const list = [];
      for (const s of D.streets.values()) {
        if (!s.drv || s.mx < wx0 || s.mx > wx1 || s.mz < wz0 || s.mz > wz1) continue;
        if (this.S < 0.3 && s.len < 900) continue;
        list.push(s);
      }
      list.sort((a, b) => b.len - a.len);
      for (const s of list.slice(0, 70)) {
        const x = tx(s.mx), y = tz(s.mz), w = s.name.length * 7 * dpr;
        if (free(x, y, w)) label(s.name, x, y, 11 * dpr, state.seen && state.seen.has(s.key) ? '#7dffc0' : '#fff');
      }
    }
    for (const p of D.places) {
      if (p.t > 2 && this.S < 0.2) continue;
      const x = tx(p.x), y = tz(p.z);
      if (x < -50 || x > W + 50 || y < -20 || y > H + 20) continue;
      if (free(x, y, p.n.length * 10 * dpr)) label(p.n, x, y, (p.t === 0 ? 16 : 13) * dpr, '#ffd98a');
    }
    if (this.S > 0.1) for (const l of D.landmarks) {
      const x = tx(l.x), y = tz(l.z);
      if (x < 0 || x > W || y < 0 || y > H) continue;
      if (free(x, y, l.n.length * 8 * dpr)) label('◆ ' + l.n, x, y, 11 * dpr, '#9fd8ff');
    }
    // origin
    g.font = `${18 * dpr}px sans-serif`; g.fillText('🕋', tx(0), tz(0));
    if (state.route) {
      g.strokeStyle = '#ffc933'; g.lineWidth = 5 * dpr; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      const p = state.route.pts; g.moveTo(tx(p[0]), tz(p[1]));
      for (let k = 2; k < p.length; k += 2) g.lineTo(tx(p[k]), tz(p[k + 1]));
      g.stroke();
    }
    if (state.hl && state.hl.length) {
      g.strokeStyle = '#4da3ff'; g.lineWidth = 5 * dpr; g.beginPath();
      for (const ri of state.hl) { const p = D.roads[ri].pts; g.moveTo(tx(p[0]), tz(p[1])); for (let k = 2; k < p.length; k += 2) g.lineTo(tx(p[k]), tz(p[k + 1])); }
      g.stroke();
    }
    if (this.sel) { g.fillStyle = '#ff5d5d'; g.beginPath(); g.arc(tx(this.sel.x), tz(this.sel.z), 7 * dpr, 0, 7); g.fill(); }
    // player
    g.save(); g.translate(tx(state.x), tz(state.z)); g.rotate(state.h);
    g.fillStyle = '#4da3ff'; g.strokeStyle = '#fff'; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(0, -12 * dpr); g.lineTo(9 * dpr, 10 * dpr); g.lineTo(0, 5 * dpr); g.lineTo(-9 * dpr, 10 * dpr); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}

export class Controls {
  constructor(stage, rig) {
    this.rig = rig;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 }; this.brakeBtn = false; this.runBtn = false;
    this.onAction = () => {};
    const kd = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!e.repeat) this.onAction(k);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    // mouse / touch look on the stage
    let last = null, id = null;
    stage.addEventListener('pointerdown', (e) => { if (e.target.closest('#joy,#btns')) return; id = e.pointerId; last = [e.clientX, e.clientY]; stage.setPointerCapture(id); });
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || !last) return;
      const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY];
      rig.look(dx * 0.006, dy * 0.005);
    });
    const end = (e) => { if (e.pointerId === id) { id = null; last = null; } };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    // joystick
    const joy = document.getElementById('joy'), knob = document.getElementById('knob');
    if (joy) {
      let jid = null;
      const set = (e) => {
        const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
        let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        this.joy.x = Math.abs(dx) < 0.08 ? 0 : dx; this.joy.y = Math.abs(dy) < 0.08 ? 0 : dy;
        knob.style.transform = `translate(${dx * R * 0.55}px, ${dy * R * 0.55}px)`;
      };
      joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); set(e); e.preventDefault(); });
      joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) set(e); });
      const je = (e) => { if (e.pointerId === jid) { jid = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; } };
      joy.addEventListener('pointerup', je); joy.addEventListener('pointercancel', je);
    }
  }
  has(...ks) { return ks.some((k) => this.keys.has(k)); }
  read() {
    const f = (this.has('w', 'arrowup', 'ц') ? 1 : 0) - (this.has('s', 'arrowdown') ? 1 : 0) - this.joy.y;
    const s = (this.has('d', 'arrowright') ? 1 : 0) - (this.has('a', 'arrowleft') ? 1 : 0) + this.joy.x;
    return {
      throttle: clamp(f, -1, 1), steer: clamp(s, -1, 1), brake: this.has(' ') || this.brakeBtn,
      mx: clamp(s, -1, 1), mz: clamp(f, -1, 1), run: this.has('shift') || this.runBtn,
      fwd: clamp(f, -1, 1), side: clamp(s, -1, 1), up: (this.has('e') ? 1 : 0) - (this.has('q') ? 1 : 0),
    };
  }
}

export class Labels {
  constructor(layer, world) { this.layer = layer; this.world = world; this.items = []; this.t = 0; }
  rebuild(px, pz) {
    const D = this.world.D, list = [];
    for (const p of D.places) {
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < 2600) list.push({ d, cls: 'hood t' + p.t, txt: p.n, x: p.x, z: p.z, up: 90 });
    }
    list.sort((a, b) => a.d - b.d);
    const hoods = list.slice(0, 18);
    const lms = [];
    for (const l of D.landmarks) {
      const d = Math.hypot(l.x - px, l.z - pz);
      if (d < 1600) lms.push({ d, cls: 'lm', txt: l.n, x: l.x, z: l.z, up: 28 });
    }
    lms.sort((a, b) => a.d - b.d);
    const all = hoods.concat(lms.slice(0, 24));
    all.push({ d: Math.hypot(px, pz), cls: 'lm kaaba', txt: '🕋 الكعبة المشرفة', x: 0, z: 0, up: 30 });
    this.layer.textContent = '';
    this.items = all.map((it) => {
      const e = document.createElement('div'); e.className = 'lab ' + it.cls; e.textContent = it.txt; this.layer.appendChild(e);
      it.el = e; it.y = this.world.D.terrain.heightAt(it.x, it.z) + it.up; return it;
    });
  }
  update(px, pz, dt) {
    this.t += dt;
    if (this.t > 2 || !this.items.length) { this.t = 0; this.rebuild(px, pz); }
    const vis = [], px0 = px, pz0 = pz;
    for (const it of this.items) {
      const s = this.world.project(it.x, it.y, it.z);
      if (s.z > 1 || s.y < 40 || s.y > innerHeight) { it.el.style.display = 'none'; continue; }
      if (this.skip && it.cls.startsWith('hood') && this.skip.has(it.txt)) { it.el.style.display = 'none'; continue; }
      // المعلم الذي تظهر صورته (وفيها اسمه) لا يُكرَّر نصه
      if (this.photos && it.cls.startsWith('lm') && !it.cls.includes('kaaba') && this.photos.shownPos.some((p) => Math.hypot(p[0] - it.x, p[1] - it.z) < 150)) { it.el.style.display = 'none'; continue; }
      if (s.x < 0 || s.x > innerWidth) { const w = it.el.offsetWidth / 2 + 4; s.x = clamp(s.x, w, innerWidth - w); }
      it.s = s; it.dd = Math.hypot(it.x - px0, it.z - pz0); vis.push(it);
    }
    // منع التراكب: الأولوية للكعبة ثم المعالم الأقرب ثم الأحياء؛ ما يتراكب مع نص أعلى أولوية يُخفى
    const pri = (it) => (it.cls.includes('kaaba') ? 0 : it.cls.startsWith('lm') ? 1 : 2);
    vis.sort((a, b) => pri(a) - pri(b) || a.dd - b.dd);
    const placed = [];
    for (const it of vis) {
      const w = it.el.offsetWidth || 80, h = it.el.offsetHeight || 20, x = it.s.x - w / 2 - 4, y = it.s.y - h / 2 - 2, W = w + 8, H = h + 4;
      if (placed.some((r) => x < r[0] + r[2] && x + W > r[0] && y < r[1] + r[3] && y + H > r[1])) { it.el.style.display = 'none'; continue; }
      placed.push([x, y, W, H]);
      it.el.style.display = 'block';
      it.el.style.transform = `translate(${it.s.x}px,${it.s.y}px) translate(-50%,-50%)`;
      it.el.style.opacity = it.cls.startsWith('hood') ? String(clamp(1.3 - it.dd / 5000, 0.8, 1)) : String(clamp(1.3 - it.dd / 900, 0.3, 1));
    }
  }
}
