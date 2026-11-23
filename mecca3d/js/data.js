// Data loading, terrain, road index, streets and search index.
import { norm, streetKey, clamp } from './util.js';

const SEG_CELL = 80;
const SEG_MUL = 8192;
export const ROAD_WIDTH = [20, 17, 15, 12.5, 10.5, 8.5, 7.5, 5, 4, 2, 2]; // by type code 0..9 (10 spare)
export const ROAD_SPEED = [27, 24, 20, 16, 14, 12, 10, 8, 1.4, 1.4];

export class Terrain {
  constructor(t) {
    this.x0 = t.x0; this.z0 = t.z0; this.step = t.step; this.w = t.w; this.h = t.h;
    const bin = atob(t.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const i16 = new Int16Array(bytes.buffer, 0, bin.length >> 1);
    this.data = new Float32Array(i16.length);
    const s = t.scale || 10;
    for (let i = 0; i < i16.length; i++) this.data[i] = i16[i] / s;
    this.x1 = this.x0 + (this.w - 1) * this.step;
    this.z1 = this.z0 + (this.h - 1) * this.step;
  }
  upsample(f) {
    const w2 = (this.w - 1) * f + 1, h2 = (this.h - 1) * f + 1, d = new Float32Array(w2 * h2);
    for (let j = 0; j < h2; j++) {
      const gj = j / f, j0 = Math.min(this.h - 2, Math.floor(gj)), tj = gj - j0;
      for (let i = 0; i < w2; i++) {
        const gi = i / f, i0 = Math.min(this.w - 2, Math.floor(gi)), ti = gi - i0;
        const a = this.data[j0 * this.w + i0], b = this.data[j0 * this.w + i0 + 1], c = this.data[(j0 + 1) * this.w + i0], e = this.data[(j0 + 1) * this.w + i0 + 1];
        d[j * w2 + i] = (a * (1 - ti) + b * ti) * (1 - tj) + (c * (1 - ti) + e * ti) * tj;
      }
    }
    this.data = d; this.w = w2; this.h = h2; this.step /= f;
    this.x1 = this.x0 + (this.w - 1) * this.step; this.z1 = this.z0 + (this.h - 1) * this.step;
  }
  at(ix, iz) {
    ix = clamp(ix, 0, this.w - 1); iz = clamp(iz, 0, this.h - 1);
    return this.data[iz * this.w + ix];
  }
  // Triangle interpolation matching the mesh diagonal (v00 -> v11).
  heightAt(x, z) {
    let gx = (x - this.x0) / this.step, gz = (z - this.z0) / this.step;
    gx = clamp(gx, 0, this.w - 1.0001); gz = clamp(gz, 0, this.h - 1.0001);
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const h00 = this.at(ix, iz), h10 = this.at(ix + 1, iz), h01 = this.at(ix, iz + 1), h11 = this.at(ix + 1, iz + 1);
    if (fx >= fz) return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
    return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }
}

export class RoadIndex {
  constructor(roads) {
    this.roads = roads;
    this.cells = new Map();
    const add = (cx, cz, v) => {
      const k = (cx + 2000) * 4000 + (cz + 2000);
      let a = this.cells.get(k);
      if (!a) { a = []; this.cells.set(k, a); }
      if (a[a.length - 1] !== v) a.push(v);
    };
    for (let ri = 0; ri < roads.length; ri++) {
      const p = roads[ri].pts, n = p.length / 2;
      for (let si = 0; si < n - 1; si++) {
        const x0 = p[si * 2], z0 = p[si * 2 + 1], x1 = p[si * 2 + 2], z1 = p[si * 2 + 3];
        const v = ri * SEG_MUL + si;
        const len = Math.hypot(x1 - x0, z1 - z0);
        const steps = Math.max(1, Math.ceil(len / 30));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          add(Math.floor((x0 + (x1 - x0) * t) / SEG_CELL), Math.floor((z0 + (z1 - z0) * t) / SEG_CELL), v);
        }
      }
    }
  }
  // opts: named (only roads with a name), drv (only t<=7), ys (only bridge/tunnel roads)
  nearest(x, z, maxD, opts) {
    opts = opts || {};
    const R = Math.ceil(maxD / SEG_CELL), cx = Math.floor(x / SEG_CELL), cz = Math.floor(z / SEG_CELL);
    let best = null, bd = maxD;
    for (let ix = cx - R; ix <= cx + R; ix++) {
      for (let iz = cz - R; iz <= cz + R; iz++) {
        const a = this.cells.get((ix + 2000) * 4000 + (iz + 2000));
        if (!a) continue;
        for (let q = 0; q < a.length; q++) {
          const v = a[q], ri = (v / SEG_MUL) | 0, si = v - ri * SEG_MUL, r = this.roads[ri];
          if (opts.named && r.ni < 0) continue;
          if (opts.drv && r.t > 7) continue;
          if (opts.ys && !r.ys) continue;
          const p = r.pts, ax = p[si * 2], az = p[si * 2 + 1], bx = p[si * 2 + 2], bz = p[si * 2 + 3];
          const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
          let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
          if (d < bd) { bd = d; best = { ri, si, t, d, x: px, z: pz, road: r }; }
        }
      }
    }
    return best;
  }
}

export async function loadData(base, onProgress) {
  const get = async (p) => {
    const r = await fetch(base + p);
    if (!r.ok) throw new Error(p + ' ' + r.status);
    return r.json();
  };
  const prog = (t, f) => onProgress && onProgress(t, f);
  prog('تحميل بيانات المدينة…', 0.05);
  const [meta, rd, places, lms, tj] = await Promise.all([
    get('meta.json'), get('roads.json'), get('places.json'), get('landmarks.json'), get('terrain.json'),
  ]);
  prog('تجهيز التضاريس…', 0.3);
  const terrain = new Terrain(tj);
  terrain.upsample(2);
  { // gentle smoothing so the up-sampled ground has no creases
    for (let pass = 0; pass < 2; pass++) {
      const src = terrain.data.slice(), W = terrain.w, H = terrain.h;
      for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
        const k = j * W + i;
        terrain.data[k] = (src[k] * 4 + src[k - 1] * 2 + src[k + 1] * 2 + src[k - W] * 2 + src[k + W] * 2 + src[k - W - 1] + src[k - W + 1] + src[k + W - 1] + src[k + W + 1]) / 16;
      }
    }
  }
  // أرض مسطّحة: الطرق والمباني والسيارة كلها على مستوى واحد فلا غطس ولا تداخل ولا ميل (بدل تضاريس مكة الحقيقية)
  const BASE = terrain.heightAt(0, 0);
  terrain.data.fill(BASE);
  const ownerT = new Int8Array(terrain.w * terrain.h).fill(99);

  const names = rd.names;
  const roads = [];
  for (let i = 0; i < rd.roads.length; i++) {
    const [ni, t, ow, fl, ln, ms, flat, j] = rd.roads[i];
    const pts = Float32Array.from(flat);
    const n = pts.length / 2;
    const cum = new Float32Array(n);
    for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + Math.hypot(pts[k * 2] - pts[k * 2 - 2], pts[k * 2 + 1] - pts[k * 2 - 1]);
    const nm = ni >= 0 ? (names[ni][0] || names[ni][1]) : '';
    roads.push({
      id: i, ni, name: nm, en: ni >= 0 ? names[ni][1] : '', t, ow, fl, lanes: ln, ms, pts, cum, j: Int32Array.from(j),
      len: cum[n - 1], width: Math.min(26, Math.max(ROAD_WIDTH[t] || 5, t <= 6 && ln > 0 ? ln * 3.6 + 2 : 0)), key: nm ? streetKey(nm) : '', ys: null,
    });
  }
  prog('معالجة الجسور والأنفاق…', 0.45);

  // Bridges: straight line between ends (never below ground). Tunnels: line between portals, terrain is carved.
  for (const r of roads) {
    if (!(r.fl & 1) || r.pts.length < 4) continue;
    const n = r.pts.length / 2;
    const ha = terrain.heightAt(r.pts[0], r.pts[1]), hb = terrain.heightAt(r.pts[(n - 1) * 2], r.pts[(n - 1) * 2 + 1]);
    r.ys = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const f = r.len > 0 ? r.cum[k] / r.len : 0;
      let y = ha + (hb - ha) * f;
      if (r.fl & 1) y = BASE + 0.12;
      r.ys[k] = y;
    }
  }
  for (const r of roads) {
    if (!(r.fl & 2) || !r.ys) continue;
    const n = r.pts.length / 2, rad = Math.max(16, r.width * 1.6);
    for (let k = 0; k < n - 1; k++) {
      const x0 = r.pts[k * 2], z0 = r.pts[k * 2 + 1], x1 = r.pts[k * 2 + 2], z1 = r.pts[k * 2 + 3];
      const len = Math.hypot(x1 - x0, z1 - z0), steps = Math.max(1, Math.ceil(len / 8));
      for (let s = 0; s <= steps; s++) {
        const f = s / steps, px = x0 + (x1 - x0) * f, pz = z0 + (z1 - z0) * f, y = r.ys[k] + (r.ys[k + 1] - r.ys[k]) * f - 1.4;
        const gx0 = Math.floor((px - rad - terrain.x0) / terrain.step), gx1 = Math.ceil((px + rad - terrain.x0) / terrain.step);
        const gz0 = Math.floor((pz - rad - terrain.z0) / terrain.step), gz1 = Math.ceil((pz + rad - terrain.z0) / terrain.step);
        for (let gz = Math.max(0, gz0); gz <= Math.min(terrain.h - 1, gz1); gz++) {
          for (let gx = Math.max(0, gx0); gx <= Math.min(terrain.w - 1, gx1); gx++) {
            const vx = terrain.x0 + gx * terrain.step, vz = terrain.z0 + gz * terrain.step;
            if (Math.hypot(vx - px, vz - pz) <= rad) {
              const i = gz * terrain.w + gx;
              if (terrain.data[i] > y) terrain.data[i] = y;
            }
          }
        }
      }
    }
  }


  // Ground roads: smooth vertical profile + flatten the terrain under/around them (cut & fill),
  // so the road is continuous and the terrain never pokes through it.
  prog('تمهيد الطرق على التضاريس…', 0.5);
  const profile = (r) => {
    const n = r.pts.length / 2;
    // sample terrain along the road at <=10 m and smooth over ~40 m, then read back at vertices
    const ys = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      let acc = 0, wsum = 0;
      for (const off of (r.fl & 2 ? [-160, -120, -80, -40, 0, 40, 80, 120, 160] : [-40, -20, 0, 20, 40])) {
        const d = clamp(r.cum[k] + off, 0, r.len);
        let j = k; if (off < 0) { while (j > 0 && r.cum[j] > d) j--; } else if (off > 0) { while (j < n - 2 && r.cum[j + 1] < d) j++; }
        j = Math.min(j, n - 2);
        const segL = r.cum[j + 1] - r.cum[j], f = segL > 0 ? (d - r.cum[j]) / segL : 0;
        const x = r.pts[j * 2] + (r.pts[j * 2 + 2] - r.pts[j * 2]) * f, z = r.pts[j * 2 + 1] + (r.pts[j * 2 + 3] - r.pts[j * 2 + 1]) * f;
        const oi = Math.round((z - terrain.z0) / terrain.step) * terrain.w + Math.round((x - terrain.x0) / terrain.step);
        const w = (ownerT[oi] < r.t ? 12 : 1) * (off === 0 ? 2 : 1); acc += terrain.heightAt(x, z) * w; wsum += w;
      }
      ys[k] = acc / wsum + 0.12;
    }
    return ys;
  };
  const order = roads.filter((r) => !r.ys).sort((a, b) => a.t - b.t);
  for (const r of order) {
    const n = r.pts.length / 2;
    if (n < 2) continue;
    const ys = profile(r);
    r.ys = ys;
    if (r.t > 7) continue; // footways follow the ground, no earthworks
    const hw = r.width / 2, inner = hw + 19, rad = inner + 22, hit = new Map();
    for (let k = 0; k < n - 1; k++) {
      const x0 = r.pts[k * 2], z0 = r.pts[k * 2 + 1], x1 = r.pts[k * 2 + 2], z1 = r.pts[k * 2 + 3];
      const len = Math.hypot(x1 - x0, z1 - z0), steps = Math.max(1, Math.ceil(len / 8));
      for (let s = 0; s <= steps; s++) {
        const f = s / steps, px = x0 + (x1 - x0) * f, pz = z0 + (z1 - z0) * f, y = ys[k] + (ys[k + 1] - ys[k]) * f - 0.3;
        const gx0 = Math.max(0, Math.floor((px - rad - terrain.x0) / terrain.step)), gx1 = Math.min(terrain.w - 1, Math.ceil((px + rad - terrain.x0) / terrain.step));
        const gz0 = Math.max(0, Math.floor((pz - rad - terrain.z0) / terrain.step)), gz1 = Math.min(terrain.h - 1, Math.ceil((pz + rad - terrain.z0) / terrain.step));
        for (let gz = gz0; gz <= gz1; gz++) {
          for (let gx = gx0; gx <= gx1; gx++) {
            const d = Math.hypot(terrain.x0 + gx * terrain.step - px, terrain.z0 + gz * terrain.step - pz);
            if (d > rad) continue;
            const i = gz * terrain.w + gx;
            if (ownerT[i] <= r.t) continue;
            const o = hit.get(i);
            if (!o || d < o[0]) hit.set(i, [d, y]);
          }
        }
      }
    }
    for (const [i, [d, y]] of hit) {
      const w = d <= inner ? 1 : 1 - (d - inner) / (rad - inner), sw = w * w * (3 - 2 * w);
      terrain.data[i] = terrain.data[i] + (y - terrain.data[i]) * sw;
      if (d <= inner) ownerT[i] = Math.min(ownerT[i], r.t);
    }
  }
  // final road heights follow the finished ground exactly (so crossing/overlapping roads agree)
  for (const r of order) {
    const n = r.pts.length / 2; if (n < 2) continue;
    const raw = new Float32Array(n);
    for (let k = 0; k < n; k++) raw[k] = terrain.heightAt(r.pts[k * 2], r.pts[k * 2 + 1]);
    const ys = new Float32Array(n), lift = r.t > 7 ? 0.22 : 0.12;
    for (let k = 0; k < n; k++) ys[k] = (k > 0 && k < n - 1 && r.t <= 7 ? (raw[k - 1] + raw[k] * 2 + raw[k + 1]) / 4 : raw[k]) + lift;
    r.ys = ys;
  }
  // final guarantee: cut any terrain still above the finished road surface
  for (const r of order) {
    if (r.t > 7 || r.pts.length < 4) continue;
    const n = r.pts.length / 2, hw = r.width / 2, rad = hw + 19;
    for (let k = 0; k < n - 1; k++) {
      const x0 = r.pts[k * 2], z0 = r.pts[k * 2 + 1], x1 = r.pts[k * 2 + 2], z1 = r.pts[k * 2 + 3];
      const len = Math.hypot(x1 - x0, z1 - z0), steps = Math.max(1, Math.ceil(len / 8));
      for (let st = 0; st <= steps; st++) {
        const f = st / steps, px = x0 + (x1 - x0) * f, pz = z0 + (z1 - z0) * f, y = r.ys[k] + (r.ys[k + 1] - r.ys[k]) * f - 0.25;
        const gx0 = Math.max(0, Math.floor((px - rad - terrain.x0) / terrain.step)), gx1 = Math.min(terrain.w - 1, Math.ceil((px + rad - terrain.x0) / terrain.step));
        const gz0 = Math.max(0, Math.floor((pz - rad - terrain.z0) / terrain.step)), gz1 = Math.min(terrain.h - 1, Math.ceil((pz + rad - terrain.z0) / terrain.step));
        for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
          if (Math.hypot(terrain.x0 + gx * terrain.step - px, terrain.z0 + gz * terrain.step - pz) > rad) continue;
          const i = gz * terrain.w + gx; if (ownerT[i] < r.t) continue; if (terrain.data[i] > y) terrain.data[i] = y;
        }
      }
    }
  }

  prog('بناء الفهارس…', 0.6);
  const idx = new RoadIndex(roads);

  // Places (hoods)
  const hoods = places.filter((p) => p.t <= 2);
  const allPlaces = places;
  const nearestHood = (x, z) => {
    const list = hoods.length ? hoods : allPlaces;
    let b = null, bd = 1e18;
    for (const p of list) {
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < bd) { bd = d; b = p; }
    }
    return b;
  };

  // Streets: group roads by street key
  const streets = new Map();
  for (const r of roads) {
    if (!r.key) continue;
    let s = streets.get(r.key);
    if (!s) { s = { key: r.key, name: r.name, en: r.en, ri: [], len: 0, drv: false, mx: 0, mz: 0, hood: '', best: 0 }; streets.set(r.key, s); }
    s.ri.push(r.id);
    s.len += r.len;
    if (r.t <= 7) s.drv = true;
    if (!s.en && r.en) s.en = r.en;
    if (r.len > s.best) {
      s.best = r.len;
      const half = r.len / 2;
      let k = 0;
      while (k < r.cum.length - 1 && r.cum[k + 1] < half) k++;
      s.mx = r.pts[k * 2]; s.mz = r.pts[k * 2 + 1];
    }
  }
  for (const s of streets.values()) {
    const h = nearestHood(s.mx, s.mz);
    s.hood = h ? h.n : '';
  }

  // Search index
  const search = [];
  for (const s of streets.values()) search.push({ type: 'street', name: s.name, en: s.en, nn: norm(s.name), ne: (s.en || '').toLowerCase(), x: s.mx, z: s.mz, key: s.key, hood: s.hood });
  for (const p of places) search.push({ type: 'hood', name: p.n, en: p.en, nn: norm(p.n), ne: (p.en || '').toLowerCase(), x: p.x, z: p.z, key: 'hood:' + norm(p.n) });
  for (const l of lms) search.push({ type: 'landmark', name: l.n, en: l.en, nn: norm(l.n), ne: (l.en || '').toLowerCase(), x: l.x, z: l.z, kind: l.k, key: 'lm:' + norm(l.n) });

  search.push({ type: 'landmark', name: 'الكعبة المشرفة', en: 'kaaba masjid al haram', nn: norm('الكعبة المشرفة المسجد الحرام الحرم'), ne: 'kaaba masjid al haram', x: 0, z: 40, kind: 'kaaba', key: 'lm:kaaba' });
  const D = {
    meta, terrain, roads, idx, streets, places, hoods, landmarks: lms, search, nearestHood,
    bcells: new Set(meta.bcells || []),
    groundAt(x, z, ref) {
      let by = null, bs = 1e9;
      const cx = Math.floor(x / SEG_CELL), cz = Math.floor(z / SEG_CELL);
      for (let ix = cx - 1; ix <= cx + 1; ix++) {
        for (let iz = cz - 1; iz <= cz + 1; iz++) {
          const a = idx.cells.get((ix + 2000) * 4000 + (iz + 2000));
          if (!a) continue;
          for (let q = 0; q < a.length; q++) {
            const v = a[q], ri = (v / SEG_MUL) | 0, si = v - ri * SEG_MUL, r = roads[ri];
            if (!r.ys) continue;
            const p = r.pts, ax = p[si * 2], az = p[si * 2 + 1], dx = p[si * 2 + 2] - ax, dz = p[si * 2 + 3] - az, l2 = dx * dx + dz * dz;
            let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
            if (d > r.width * 0.5 + 1.5) continue;
            // نفس ارتفاع شريحة الطريق المرسومة (world.js _roadGeometry) كي لا تغطس العجلات فيها
            const y = r.ys[si] + (r.ys[si + 1] - r.ys[si]) * t + 0.05 + ((r.fl & 3) ? 0 : (9 - Math.min(r.t, 9)) * 0.02);
            const sc = ref === undefined ? d : Math.abs(y - ref) + d * 0.05;
            if (sc < bs) { bs = sc; by = y; }
          }
        }
      }
      const th = terrain.heightAt(x, z);
      return by !== null ? Math.max(by, th) : th;
    },
    searchItems(q, limit = 12) {
      const nq = norm(q), lq = q.toLowerCase().trim();
      if (!nq) return [];
      const out = [], toks = nq.split(' ').filter(Boolean);
      for (const it of search) {
        let score = -1;
        if (it.nn === nq) score = 100;
        else if (it.nn.startsWith(nq)) score = 80;
        else if (it.nn.includes(nq)) score = 60;
        else if (toks.length > 1 && toks.every((t) => it.nn.includes(t))) score = 50;
        else if (it.ne && lq && it.ne.includes(lq)) score = 40;
        if (score < 0) continue;
        if (it.type === 'street') score += Math.min(10, (streets.get(it.key).len / 500));
        if (it.type === 'landmark') score += 5;
        out.push({ it, score });
      }
      out.sort((a, b) => b.score - a.score);
      return out.slice(0, limit).map((o) => o.it);
    },
  };
  prog('جاهز', 0.7);
  return D;
}
