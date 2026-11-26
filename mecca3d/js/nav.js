// Road graph, A* routing and Arabic turn-by-turn instructions.
import { ROAD_SPEED } from './data.js';
import { bearingDeg, angDiff } from './util.js';

class MinHeap {
  constructor() { this.f = []; this.n = []; }
  get size() { return this.f.length; }
  push(f, n) {
    const F = this.f, N = this.n;
    let i = F.length; F.push(f); N.push(n);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (F[p] <= F[i]) break;
      [F[p], F[i]] = [F[i], F[p]]; [N[p], N[i]] = [N[i], N[p]]; i = p;
    }
  }
  pop() {
    const F = this.f, N = this.n, rf = F[0], rn = N[0];
    const lf = F.pop(), ln = N.pop();
    if (F.length) {
      F[0] = lf; N[0] = ln;
      let i = 0; const L = F.length;
      for (;;) {
        let l = i * 2 + 1, r = l + 1, m = i;
        if (l < L && F[l] < F[m]) m = l;
        if (r < L && F[r] < F[m]) m = r;
        if (m === i) break;
        [F[m], F[i]] = [F[i], F[m]]; [N[m], N[i]] = [N[i], N[m]]; i = m;
      }
    }
    return [rf, rn];
  }
}

export class Nav {
  constructor(D) {
    this.D = D;
    const roads = D.roads, M = D.meta, inB = (x, z) => x > M.x0 + 100 && x < M.x1 - 100 && z > M.z0 + 100 && z < M.z1 - 100;
    let G = 0;
    for (const r of roads) for (let k = 1; k < r.j.length; k += 2) if (r.j[k] + 1 > G) G = r.j[k] + 1;
    this.G = G;
    this.nx = new Float32Array(G); this.nz = new Float32Array(G);
    this.edges = [];
    this.adj = new Array(G);
    this.edgesByRoad = new Array(roads.length);
    for (let ri = 0; ri < roads.length; ri++) {
      const r = roads[ri], j = r.j;
      if (j.length < 4 || r.t > 9) continue;
      const list = [];
      for (let k = 0; k + 3 < j.length; k += 2) {
        const i0 = j[k], g0 = j[k + 1], i1 = j[k + 2], g1 = j[k + 3];
        if (i1 <= i0 || g0 === g1) continue;
        if (!inB(r.pts[i0 * 2], r.pts[i0 * 2 + 1]) || !inB(r.pts[i1 * 2], r.pts[i1 * 2 + 1])) continue; // خارج حدود الخريطة
        const e = { a: g0, b: g1, ri, i0, i1, len: r.cum[i1] - r.cum[i0], drv: r.t <= 7, ow: r.ow, spd: ROAD_SPEED[r.t] || 8 };
        const ei = this.edges.length;
        this.edges.push(e); list.push(ei);
        (this.adj[g0] || (this.adj[g0] = [])).push(ei);
        (this.adj[g1] || (this.adj[g1] = [])).push(ei);
        this.nx[g0] = r.pts[i0 * 2]; this.nz[g0] = r.pts[i0 * 2 + 1];
        this.nx[g1] = r.pts[i1 * 2]; this.nz[g1] = r.pts[i1 * 2 + 1];
      }
      this.edgesByRoad[ri] = list;
    }
  }

  snap(x, z, foot) {
    const D = this.D;
    for (const maxD of [80, 250, 800]) {
      const s = D.idx.nearest(x, z, maxD, { drv: !foot });
      if (!s) continue;
      const list = this.edgesByRoad[s.ri];
      if (!list) continue;
      for (const ei of list) {
        const e = this.edges[ei];
        if (e.i0 <= s.si && s.si < e.i1) {
          const r = s.road;
          const da = r.cum[s.si] - r.cum[e.i0] + s.t * (r.cum[s.si + 1] - r.cum[s.si]);
          return { ei, e, da, x: s.x, z: s.z, si: s.si, d: s.d };
        }
      }
    }
    return null;
  }

  nearestOnStreet(key, x, z) {
    const st = this.D.streets.get(key);
    if (!st) return null;
    let best = null, bd = 1e18;
    for (const ri of st.ri) {
      const r = this.D.roads[ri];
      if (r.t > 7) continue;
      for (let k = 0; k < r.pts.length; k += 2) {
        const d = (r.pts[k] - x) ** 2 + (r.pts[k + 1] - z) ** 2;
        if (d < bd) { bd = d; best = { x: r.pts[k], z: r.pts[k + 1] }; }
      }
    }
    return best;
  }

  // Returns a Route or null.
  route(start, goal, foot) {
    this._foot = !!foot || !!this.freeRoam;
    const S = this.snap(start.x, start.z, foot), T = this.snap(goal.x, goal.z, foot);
    if (!S || !T) return null;
    const D = this.D, edges = this.edges, G = this.G;
    const spdOf = (e) => (foot ? 1.4 : e.spd);
    const fwdOk = (e) => foot || e.drv;
    const backOk = (e) => foot || (e.drv && !e.ow);
    const vmax = foot ? 1.4 : 27;

    let seq = null, startMode = null, goalMode = null;
    if (S.ei === T.ei) {
      if (T.da >= S.da && fwdOk(S.e)) { seq = []; startMode = 'f'; goalMode = 'f'; }
      else if (T.da < S.da && backOk(S.e)) { seq = []; startMode = 'b'; goalMode = 'b'; }
    }
    if (!seq) {
      const g = new Float64Array(G).fill(Infinity), came = new Int32Array(G).fill(-1), dirF = new Int8Array(G);
      const heap = new MinHeap();
      const h = (n) => Math.hypot(this.nx[n] - goal.x, this.nz[n] - goal.z) / vmax;
      const seeds = [];
      if (fwdOk(S.e)) seeds.push([S.e.b, (S.e.len - S.da) / spdOf(S.e), 'f']);
      if (backOk(S.e)) seeds.push([S.e.a, S.da / spdOf(S.e), 'b']);
      const seedMode = new Map();
      for (const [n, c, m] of seeds) {
        if (c < g[n]) { g[n] = c; came[n] = -2; seedMode.set(n, m); heap.push(c + h(n), n); }
      }
      const tgt = new Map();
      if (fwdOk(T.e)) tgt.set(T.e.a, [T.da / spdOf(T.e), 'f']);
      if (backOk(T.e)) tgt.set(T.e.b, [(T.e.len - T.da) / spdOf(T.e), 'b']);
      let best = Infinity, bestNode = -1;
      let guard = 0;
      while (heap.size && guard++ < 4000000) {
        const [f, n] = heap.pop();
        if (f >= best) break;
        if (f > g[n] + h(n) + 1e-6) continue;
        const tg = tgt.get(n);
        if (tg && g[n] + tg[0] < best) { best = g[n] + tg[0]; bestNode = n; }
        const adj = this.adj[n];
        if (!adj) continue;
        for (const ei of adj) {
          const e = edges[ei];
          const isFwd = e.a === n;
          if (!(isFwd ? fwdOk(e) : backOk(e))) continue;
          const m = isFwd ? e.b : e.a;
          const ng = g[n] + e.len / spdOf(e);
          if (ng < g[m]) { g[m] = ng; came[m] = ei; dirF[m] = isFwd ? 1 : 0; heap.push(ng + h(m), m); }
        }
      }
      if (bestNode < 0) return null;
      seq = [];
      let n = bestNode;
      while (came[n] !== -2) {
        const e = edges[came[n]], fwd = dirF[n] === 1;
        seq.push({ e, fwd });
        n = fwd ? e.a : e.b;
      }
      seq.reverse();
      startMode = seedMode.get(n);
      goalMode = tgt.get(bestNode)[1];
    }
    return this._assemble(S, T, seq, startMode, goalMode, goal);
  }

  _assemble(S, T, seq, startMode, goalMode, goal) {
    const roads = this.D.roads;
    const pieces = []; // {ri, pts:[x,z,...]}
    const addPts = (arr, r, from, to) => { // inclusive indexes, direction by from->to
      if (from <= to) for (let k = from; k <= to; k++) arr.push(r.pts[k * 2], r.pts[k * 2 + 1]);
      else for (let k = from; k >= to; k--) arr.push(r.pts[k * 2], r.pts[k * 2 + 1]);
    };
    const sameEdge = (S.ei === T.ei && seq.length === 0);
    const rs = roads[S.e.ri];
    if (sameEdge) {
      const a = [S.x, S.z];
      if (startMode === 'f') { if (T.si > S.si) addPts(a, rs, S.si + 1, T.si); }
      else if (T.si < S.si || (T.si === S.si)) { if (S.si > T.si) addPts(a, rs, S.si, T.si + 1); }
      if (this._foot) a.push(goal.x, goal.z); else a.push(T.x, T.z); // السيارة تنتهي على الطريق لا داخل المباني
      pieces.push({ ri: S.e.ri, pts: a });
    } else {
      const a = [S.x, S.z];
      if (startMode === 'f') addPts(a, rs, S.si + 1, S.e.i1); else addPts(a, rs, S.si, S.e.i0);
      pieces.push({ ri: S.e.ri, pts: a });
      for (const { e, fwd } of seq) {
        const r = roads[e.ri], p = [];
        if (fwd) addPts(p, r, e.i0, e.i1); else addPts(p, r, e.i1, e.i0);
        pieces.push({ ri: e.ri, pts: p });
      }
      const rt = roads[T.e.ri], b = [];
      if (goalMode === 'f') addPts(b, rt, T.e.i0, T.si); else addPts(b, rt, T.e.i1, T.si + 1);
      if (this._foot) b.push(goal.x, goal.z); else b.push(T.x, T.z);
      pieces.push({ ri: T.e.ri, pts: b });
    }
    return this._finish(pieces, goal);
  }

  _finish(pieces, goal) {
    const roads = this.D.roads;
    const flat = [], pieceStart = [], pieceRi = [];
    for (const p of pieces) {
      pieceStart.push(flat.length / 2); pieceRi.push(p.ri);
      for (let k = 0; k < p.pts.length; k += 2) {
        const n = flat.length;
        if (n >= 2 && Math.abs(flat[n - 2] - p.pts[k]) < 0.05 && Math.abs(flat[n - 1] - p.pts[k + 1]) < 0.05) continue;
        flat.push(p.pts[k], p.pts[k + 1]);
      }
    }
    const pts = Float32Array.from(flat), n = pts.length / 2;
    const cum = new Float32Array(n);
    for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + Math.hypot(pts[k * 2] - pts[k * 2 - 2], pts[k * 2 + 1] - pts[k * 2 - 1]);

    const bearAt = (i, j) => bearingDeg(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]);
    const back = (b) => { let k = b; while (k > 0 && cum[b] - cum[k] < 12) k--; return k; };
    const fwd = (b) => { let k = b; while (k < n - 1 && cum[k] - cum[b] < 12) k++; return k; };

    const steps = [];
    const name0 = roads[pieceRi[0]].name;
    steps.push({ dist: 0, x: pts[0], z: pts[1], kind: 'start', text: 'انطلق' + (name0 ? ' على ' + name0 : ''), name: name0 });
    for (let p = 1; p < pieceStart.length; p++) {
      const b = pieceStart[p];
      if (b <= 0 || b >= n - 1) continue;
      const rA = roads[pieceRi[p - 1]], rB = roads[pieceRi[p]];
      const inRb = !!(rA.fl & 4), outRb = !!(rB.fl & 4);
      const k0 = back(b), k1 = fwd(b);
      if (k0 === b || k1 === b) continue;
      const turn = angDiff(bearAt(k0, b), bearAt(b, k1));
      const sameName = rA.key && rA.key === rB.key;
      let text = null, kind = 'straight';
      if (!inRb && outRb) { text = 'ادخل الدوار'; kind = 'roundabout'; }
      else if (inRb && !outRb) { text = 'اخرج من الدوار' + (rB.name ? ' إلى ' + rB.name : ''); kind = 'exit'; }
      else if (inRb && outRb) continue;
      else if (!sameName || Math.abs(turn) >= 35) {
        const a = Math.abs(turn), side = turn > 0 ? 'يميناً' : 'يساراً';
        if (a < 25) { text = 'استمر للأمام' + (rB.name && !sameName ? ' على ' + rB.name : ''); kind = 'straight'; }
        else if (a < 60) { text = 'انعطف قليلاً ' + side; kind = turn > 0 ? 'slight-right' : 'slight-left'; }
        else if (a < 145) { text = 'انعطف ' + side; kind = turn > 0 ? 'right' : 'left'; }
        else { text = 'استدر للخلف'; kind = 'uturn'; }
        if (kind !== 'straight' && rB.name) text += ' إلى ' + rB.name;
        else if (kind === 'straight' && !rB.name) text = null;
      }
      if (!text) continue;
      const last = steps[steps.length - 1];
      if (cum[b] - last.dist < 15 && last.kind !== 'start') { last.text = text; last.kind = kind; last.x = pts[b * 2]; last.z = pts[b * 2 + 1]; last.name = rB.name; continue; }
      steps.push({ dist: cum[b], x: pts[b * 2], z: pts[b * 2 + 1], kind, text, name: rB.name });
    }
    steps.push({ dist: cum[n - 1], x: pts[(n - 1) * 2], z: pts[(n - 1) * 2 + 1], kind: 'arrive', text: 'وصلت إلى وجهتك', name: goal.name || '' });
    for (let i = 0; i < steps.length - 1; i++) steps[i].meters = steps[i + 1].dist - steps[i].dist;
    steps[steps.length - 1].meters = 0;
    return { pts, cum, steps, total: cum[n - 1], goal };
  }
}

// Progress of a position along a route. hint = previous index.
export function routeProgress(route, x, z, hint) {
  const { pts, cum } = route, n = pts.length / 2;
  const lo = Math.max(0, (hint || 0) - 5), hi = Math.min(n - 2, (hint || 0) + 400);
  let best = -1, bd = 1e18, bt = 0;
  for (let k = lo; k <= hi; k++) {
    const ax = pts[k * 2], az = pts[k * 2 + 1], dx = pts[k * 2 + 2] - ax, dz = pts[k * 2 + 3] - az, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < bd) { bd = d; best = k; bt = t; }
  }
  if (best < 0) return { idx: hint || 0, along: 0, off: 1e9 };
  return { idx: best, along: cum[best] + bt * (cum[best + 1] - cum[best]), off: bd };
}
