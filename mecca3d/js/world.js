// Three.js world: terrain, roads, buildings, sky, signs, route ribbons.
import * as THREE from 'three';
import { hash2, lerp, clamp } from './util.js';

const SAND = new THREE.Color('#c4af84'), ROCK = new THREE.Color('#7b6a56'), DRY = new THREE.Color('#a8946c');
const ROAD_COL = ['#2c2c31', '#303035', '#343439', '#38383e', '#3c3c42', '#414147', '#46464c', '#505056', '#b7a688', '#a99a7c'].map((c) => new THREE.Color(c));
const MARK = new THREE.Color('#ecebe3');
const BCOLS = ['#e8dcc0', '#d9c9a3', '#cdbb94', '#e2d6bb', '#bdb5a4', '#cbc4b6', '#d8cfc0', '#aca69c', '#e9e2d3', '#d3b896'].map((c) => new THREE.Color(c));

const KF = [
  { h: 0, top: '#04070f', hor: '#0b1428', amb: 0.32, sun: 0, sc: '#8899ff', fog: '#0b1428' },
  { h: 5, top: '#0a1230', hor: '#1c2240', amb: 0.34, sun: 0, sc: '#8899ff', fog: '#1c2240' },
  { h: 6.2, top: '#3b5a8a', hor: '#f0a060', amb: 0.55, sun: 0.6, sc: '#ffb070', fog: '#d8a583' },
  { h: 9, top: '#4a8fe0', hor: '#bcd8f0', amb: 0.8, sun: 1.2, sc: '#fff2dd', fog: '#c9dcee' },
  { h: 13, top: '#3d86e0', hor: '#cfe3f5', amb: 0.85, sun: 1.35, sc: '#fffaf0', fog: '#d2e4f4' },
  { h: 17, top: '#4a85c8', hor: '#e8d6b8', amb: 0.75, sun: 1.1, sc: '#ffe2b0', fog: '#dccdb0' },
  { h: 18.3, top: '#35508a', hor: '#f08a50', amb: 0.55, sun: 0.6, sc: '#ff9a50', fog: '#d08a68' },
  { h: 19.5, top: '#10183a', hor: '#2a2a4a', amb: 0.36, sun: 0, sc: '#8899ff', fog: '#1a1f38' },
  { h: 24, top: '#04070f', hor: '#0b1428', amb: 0.32, sun: 0, sc: '#8899ff', fog: '#0b1428' },
];

function pip(pts, x, z) {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], zi = pts[i * 2 + 1], xj = pts[j * 2], zj = pts[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export class World {
  constructor(container, D, base) {
    this.D = D; this.base = base; this.container = container;
    this.T = D.terrain;
    this.CELL = D.meta.cell;
    this.X0 = D.meta.x0; this.Z0 = D.meta.z0;
    this.NX = Math.ceil((D.meta.x1 - D.meta.x0) / this.CELL);
    this.NZ = Math.ceil((D.meta.z1 - D.meta.z0) / this.CELL);
    this.quality = 'medium';
    this.satOn = true;
    this.R = 3;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    r.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 1.2, 5200);
    this.scene.add(this.camera);

    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x8a7a60, 0.8);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.2);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0xcfe0f0, 600, 2400);

    // sky dome with vertical gradient
    const sg = new THREE.SphereGeometry(4600, 24, 12);
    const cols = new Float32Array(sg.attributes.position.count * 3);
    sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.skyGeo = sg;
    this.sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this._makeMaterials();
    this.chunks = new Map();
    this.queue = [];
    this.pending = new Set();
    this.ready = [];
    this.colliders = new Map();
    this._indexSegments();
    this._buildCoarse();
    this._buildLandmarks();
    this.routeMesh = null; this.hlMesh = null; this.beacon = null;
    this.hour = 13; this.night = 0;
    this.setTime(13);
    this.setQuality('medium');
    this.signs = null;
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const c = this.container;
    this.renderer.setSize(c.clientWidth, c.clientHeight);
    this.camera.aspect = c.clientWidth / c.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.quality = q;
    this.R = q === 'low' ? 2 : q === 'high' ? 4 : 3;
    const far = (this.R + 1) * this.CELL * 1.25;
    this.scene.fog.near = far * 0.3; this.scene.fog.far = far;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : q === 'high' ? 2 : 1.5));
    this.resize();
  }

  setTime(h) {
    this.hour = h;
    let a = KF[0], b = KF[1];
    for (let i = 0; i < KF.length - 1; i++) if (h >= KF[i].h && h <= KF[i + 1].h) { a = KF[i]; b = KF[i + 1]; break; }
    const t = (h - a.h) / Math.max(0.001, b.h - a.h);
    const mix = (k) => new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
    const top = mix('top'), hor = mix('hor'), fog = mix('fog'), sc = mix('sc');
    this.hemi.intensity = lerp(a.amb, b.amb, t);
    this.sun.intensity = lerp(a.sun, b.sun, t);
    this.sun.color.copy(sc);
    this.scene.fog.color.copy(fog);
    this.night = clamp(1 - (this.hemi.intensity - 0.32) / 0.3, 0, 1);
    const ang = ((h - 6) / 12) * Math.PI;
    this.sunDir = new THREE.Vector3(Math.cos(ang) * 0.8, Math.max(0.12, Math.sin(ang)), 0.45).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(500);
    const pos = this.skyGeo.attributes.position, col = this.skyGeo.attributes.color;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = clamp(pos.getY(i) / 4600, -0.2, 1);
      c.copy(hor).lerp(top, Math.pow(Math.max(0, y), 0.55));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    this.renderer.setClearColor(hor);
    if (this.wallMat) this.wallMat.emissiveIntensity = this.night * 0.9;
  }

  _makeMaterials() {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#6d7d92'; g.fillRect(12, 14, 40, 32);
    g.fillStyle = '#9aa8ba'; g.fillRect(12, 14, 40, 3);
    g.fillStyle = '#e4e0d6'; g.fillRect(0, 56, 64, 8);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    const cv2 = document.createElement('canvas'); cv2.width = 64; cv2.height = 64;
    const g2 = cv2.getContext('2d');
    g2.fillStyle = '#000'; g2.fillRect(0, 0, 64, 64);
    g2.fillStyle = '#ffd98a'; g2.fillRect(12, 14, 40, 32);
    const tex2 = new THREE.CanvasTexture(cv2);
    tex2.wrapS = tex2.wrapT = THREE.RepeatWrapping; tex2.colorSpace = THREE.SRGBColorSpace;
    this.wallMat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, emissive: 0xffffff, emissiveMap: tex2, emissiveIntensity: 0, side: THREE.DoubleSide });
    this.roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.tunnelMat = new THREE.MeshLambertMaterial({ color: 0x3a3c42, side: THREE.DoubleSide, emissive: 0x15161a });
    this.coarseMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 });
    this.roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }

  _indexSegments() {
    this.segMap = new Map();
    const { roads } = this.D;
    for (let ri = 0; ri < roads.length; ri++) {
      const p = roads[ri].pts, n = p.length / 2;
      for (let si = 0; si < n - 1; si++) {
        const mx = (p[si * 2] + p[si * 2 + 2]) / 2, mz = (p[si * 2 + 1] + p[si * 2 + 3]) / 2;
        const cx = Math.floor((mx - this.X0) / this.CELL), cz = Math.floor((mz - this.Z0) / this.CELL);
        const k = cx * 1000 + cz;
        let a = this.segMap.get(k);
        if (!a) { a = []; this.segMap.set(k, a); }
        a.push(ri * 8192 + si);
      }
    }
  }

  _terrColor(out, ix, iz, h, slope) {
    const T = this.T;
    const n = hash2(ix * T.step, iz * T.step);
    const rock = clamp((slope - 0.18) / 0.5, 0, 1);
    out.copy(SAND).lerp(DRY, clamp((h - 280) / 250, 0, 0.6)).lerp(ROCK, rock);
    const v = 0.93 + n * 0.14;
    out.r *= v; out.g *= v; out.b *= v;
  }

  _terrainGeometry(ix0, iz0, n, stride, yOff) {
    const T = this.T, step = T.step * stride, W = n + 1;
    const pos = new Float32Array(W * W * 3), nor = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3);
    const c = new THREE.Color();
    for (let j = 0; j < W; j++) {
      for (let i = 0; i < W; i++) {
        const gx = ix0 + i * stride, gz = iz0 + j * stride, k = (j * W + i) * 3;
        const h = T.at(gx, gz);
        const dx = (T.at(gx + stride, gz) - T.at(gx - stride, gz)) / (2 * step);
        const dz = (T.at(gx, gz + stride) - T.at(gx, gz - stride)) / (2 * step);
        const l = Math.hypot(dx, 1, dz);
        pos[k] = T.x0 + gx * T.step; pos[k + 1] = h + yOff; pos[k + 2] = T.z0 + gz * T.step;
        nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
        this._terrColor(c, gx, gz, h, Math.hypot(dx, dz));
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
    }
    const uv = new Float32Array(W * W * 2);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { uv[(j * W + i) * 2] = i / n; uv[(j * W + i) * 2 + 1] = j / n; }
    const idx = new Uint32Array(n * n * 6);
    let q = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v00 = j * W + i, v10 = v00 + 1, v01 = v00 + W, v11 = v01 + 1;
        idx[q++] = v00; idx[q++] = v01; idx[q++] = v11;
        idx[q++] = v00; idx[q++] = v11; idx[q++] = v10;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }

  _buildCoarse() {
    const T = this.T, stride = 4;
    const nx = Math.floor((T.w - 1) / stride), nz = Math.floor((T.h - 1) / stride);
    // single square grid covering min dimension; for non-square, build as grid of nx x nz
    const W = nx + 1, H = nz + 1;
    const pos = new Float32Array(W * H * 3), nor = new Float32Array(W * H * 3), col = new Float32Array(W * H * 3);
    const c = new THREE.Color(), step = T.step * stride;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const gx = i * stride, gz = j * stride, k = (j * W + i) * 3, h = T.at(gx, gz);
        const dx = (T.at(gx + stride, gz) - T.at(gx - stride, gz)) / (2 * step);
        const dz = (T.at(gx, gz + stride) - T.at(gx, gz - stride)) / (2 * step);
        const l = Math.hypot(dx, 1, dz);
        pos[k] = T.x0 + gx * T.step; pos[k + 1] = h - 7; pos[k + 2] = T.z0 + gz * T.step;
        nor[k] = -dx / l; nor[k + 1] = 1 / l; nor[k + 2] = -dz / l;
        this._terrColor(c, gx, gz, h, Math.hypot(dx, dz));
        col[k] = c.r * 0.92; col[k + 1] = c.g * 0.92; col[k + 2] = c.b * 0.92;
      }
    }
    const idx = new Uint32Array(nx * nz * 6);
    let q = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const v00 = j * W + i, v10 = v00 + 1, v01 = v00 + W, v11 = v01 + 1;
        idx[q++] = v00; idx[q++] = v01; idx[q++] = v11;
        idx[q++] = v00; idx[q++] = v11; idx[q++] = v10;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.coarse = new THREE.Mesh(g, this.coarseMat);
    this.coarse.frustumCulled = false;
    this.scene.add(this.coarse);
    { // أرض واسعة خارج حدود الخريطة كي لا يظهر فراغ أبيض
      const B = this.T.heightAt(0, 0) - 7.6, pg = new THREE.PlaneGeometry(400000, 400000);
      pg.rotateX(-Math.PI / 2);
      const pm = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ color: 0xa89a7c }));
      pm.position.set((this.D.meta.x0 + this.D.meta.x1) / 2, B, (this.D.meta.z0 + this.D.meta.z1) / 2); pm.frustumCulled = false; this.scene.add(pm);
    }
  }

  _buildLandmarks() {
    const y0 = this.T.heightAt(0, 0);
    const grp = new THREE.Group();
    const kaaba = new THREE.Mesh(new THREE.BoxGeometry(12.5, 14.5, 10.5), new THREE.MeshLambertMaterial({ color: 0x141414 }));
    kaaba.position.set(0, y0 + 0.5 + 7.25, 0);
    const band = new THREE.Mesh(new THREE.BoxGeometry(12.7, 1.1, 10.7), new THREE.MeshLambertMaterial({ color: 0xc9a84c, emissive: 0x3a2f10 }));
    band.position.set(0, y0 + 0.5 + 10.6, 0);
    const mataf = new THREE.Mesh(new THREE.CircleGeometry(46, 48), new THREE.MeshLambertMaterial({ color: 0xece6d8 }));
    mataf.rotation.x = -Math.PI / 2; mataf.position.set(0, y0 + 0.4, 0);
    grp.add(mataf, kaaba, band);
    this.scene.add(grp);
    this.landmarkGroup = grp;
  }

  // ---------- chunks ----------
  _key(cx, cz) { return cx * 1000 + cz; }

  update(px, pz, dt) {
    this._acc = (this._acc || 0) + dt;
    if (this._acc >= 0.25 || !this._init) {
      this._acc = 0; this._init = true;
      const cx = Math.floor((px - this.X0) / this.CELL), cz = Math.floor((pz - this.Z0) / this.CELL), R = this.R;
      this.pc = [cx, cz];
      if (this.satOn) { let n = 0; for (const c of this.chunks.values()) { if (c.tm && !c.satBusy && n < 2) { const r = Math.max(Math.abs(c.cx - cx), Math.abs(c.cz - cz)); const want = r === 0 ? 1024 : r === 1 ? 512 : r === 2 ? 256 : 128; if ((c.satSize || 0) < want && c.satSize) { n++; this._applySat(c, c.tm, c.cx, c.cz); } } } }
      const want = new Set();
      for (let dz = -R - 1; dz <= R + 1; dz++) {
        for (let dx = -R - 1; dx <= R + 1; dx++) {
          const x = cx + dx, z = cz + dz;
          if (x < 0 || z < 0 || x >= this.NX || z >= this.NZ) continue;
          const d2 = dx * dx + dz * dz;
          if (d2 <= (R + 0.5) * (R + 0.5)) {
            want.add(this._key(x, z));
            const k = this._key(x, z);
            if (!this.chunks.has(k) && !this.queue.some((q) => q.k === k)) this.queue.push({ k, cx: x, cz: z, d: d2 });
          }
        }
      }
      this.queue = this.queue.filter((q) => want.has(q.k));
      this.queue.sort((a, b) => a.d - b.d);
      for (const [k, ch] of this.chunks) {
        const ddx = ch.cx - cx, ddz = ch.cz - cz;
        if (ddx * ddx + ddz * ddz > (R + 1.6) * (R + 1.6)) this._dispose(k);
      }
    }
    this.pump(5);
  }

  pump(budgetMs) {
    const t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      if (this.ready.length) { this._buildBuildings(this.ready.shift()); continue; }
      const q = this.queue.shift();
      if (!q) break;
      this._buildChunk(q);
    }
  }

  get busy() { return this.queue.length > 0 || this.ready.length > 0 || this.pending.size > 0; }

  // ---- صور الأقمار الصناعية (Esri World Imagery) تُفرش على أرض كل مربع، وتُحمَّل وقت التشغيل؛ عند الفشل تبقى الألوان العادية ----
  _tile(z, x, y) {
    this.tiles = this.tiles || new Map();
    const key = z + '/' + x + '/' + y; let p = this.tiles.get(key);
    if (!p) {
      p = new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x; });
      this.tiles.set(key, p);
      if (this.tiles.size > 400) this.tiles.delete(this.tiles.keys().next().value);
    }
    return p;
  }
  async _applySat(ch, mesh, cx, cz) {
    try {
      const { origin } = this.D.meta, R = 6371008.8, cos0 = Math.cos((origin.lat * Math.PI) / 180), N0 = 0;
      const x0 = this.X0 + cx * this.CELL, z0 = this.Z0 + cz * this.CELL, C = this.CELL;
      const toLL = (x, z) => [origin.lat - (z / R) * (180 / Math.PI), origin.lon + (x / (R * cos0)) * (180 / Math.PI)];
      const toXZ = (lat, lon) => [((lon - origin.lon) * Math.PI / 180) * R * cos0, -((lat - origin.lat) * Math.PI / 180) * R];
      const tx = (lon) => ((lon + 180) / 360) * N, ty = (lat) => { const s = Math.sin((lat * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * N; };
      const tlon = (X) => (X / N) * 360 - 180, tlat = (Y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * Y) / N))) * 180) / Math.PI;
      const [latA, lonA] = toLL(x0, z0), [latB, lonB] = toLL(x0 + C, z0 + C);
      const ring = this.pc ? Math.max(Math.abs(cx - this.pc[0]), Math.abs(cz - this.pc[1])) : 0;
      const Z = ring === 0 ? 18 : 17, N = 2 ** Z, size = ring === 0 ? 1024 : ring === 1 ? 512 : ring === 2 ? 256 : 128;
      const ix0 = Math.floor(tx(lonA)), ix1 = Math.floor(tx(lonB)), iy0 = Math.floor(ty(latA)), iy1 = Math.floor(ty(latB));
      const jobs = [];
      for (let X = ix0; X <= ix1; X++) for (let Y = iy0; Y <= iy1; Y++) jobs.push(this._tile(Z, X, Y).then((im) => [X, Y, im]));
      if ((ch.satSize || 0) >= size || ch.satBusy) return;
      ch.satBusy = true;
      const got = await Promise.all(jobs);
      ch.satBusy = false;
      if (ch.dead || !got.some((g) => g[2])) return;
      const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
      for (const [X, Y, im] of got) {
        if (!im) continue;
        const [xa, za] = toXZ(tlat(Y), tlon(X)), [xb, zb] = toXZ(tlat(Y + 1), tlon(X + 1));
        const k = size / C;
        g.drawImage(im, (xa - x0) * k, (za - z0) * k, (xb - xa) * k + 0.6, (zb - za) * k + 0.6);
      }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      const old = mesh.userData.sat ? mesh.material : null;
      const m = new THREE.MeshLambertMaterial({ map: t }); mesh.userData.sat = true; mesh.material = m; ch.satSize = size;
      if (old) { old.map && old.map.dispose(); old.dispose(); }
    } catch (e) { ch.satBusy = false; /* نبقى على الألوان */ }
  }
  _dispose(k) {
    const ch = this.chunks.get(k);
    if (!ch) return;
    this.scene.remove(ch.group);
    ch.dead = true;
    ch.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.userData.sat) { o.material.map && o.material.map.dispose(); o.material.dispose(); } });
    this.colliders.delete(k);
    this.chunks.delete(k);
  }

  _buildChunk({ k, cx, cz }) {
    const group = new THREE.Group();
    const ch = { cx, cz, group, k };
    const n = this.CELL / this.T.step;
    const tg = this._terrainGeometry(Math.round(cx * this.CELL / this.T.step), Math.round(cz * this.CELL / this.T.step), n, 1, 0);
    const tm = new THREE.Mesh(tg, this.terrainMat);
    group.add(tm);
    ch.tm = tm; ch.cx = cx; ch.cz = cz;
    if (this.satOn) this._applySat(ch, tm, cx, cz);
    const rg = this._roadGeometry(cx, cz);
    if (rg) { group.add(new THREE.Mesh(rg, this.roadMat)); if (rg.userData.tunnel) group.add(new THREE.Mesh(rg.userData.tunnel, this.tunnelMat)); }
    this.scene.add(group);
    this.chunks.set(k, ch);
    const bk = cx + '_' + cz;
    if (this.D.bcells.has(bk)) {
      this.pending.add(k);
      fetch(this.base + 'b/' + bk + '.json').then((r) => r.json()).then((list) => {
        this.pending.delete(k);
        if (this.chunks.get(k) === ch) this.ready.push({ ch, list });
      }).catch(() => this.pending.delete(k));
    }
  }

  _roadGeometry(cx, cz) {
    const list = this.segMap.get(cx * 1000 + cz);
    if (!list) return null;
    const { roads } = this.D, T = this.T;
    const pos = [], col = [], idx = [];
    const tp = [], tix = []; let tvc = 0; // أسقف وجدران الأنفاق
    const tq = (a, b, c, d) => { tp.push(...a, ...b, ...c, ...d); tix.push(tvc, tvc + 1, tvc + 2, tvc, tvc + 2, tvc + 3); tvc += 4; };
    let vc = 0;
    const quad = (ax, ay, az, bx, by, bz, cx2, cy, cz2, dx, dy, dz, c) => {
      pos.push(ax, ay, az, bx, by, bz, cx2, cy, cz2, dx, dy, dz);
      for (let i = 0; i < 4; i++) col.push(c.r, c.g, c.b);
      idx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
      vc += 4;
    };
    for (const v of list) {
      const ri = (v / 8192) | 0, si = v - ri * 8192, r = roads[ri];
      const p = r.pts, x0 = p[si * 2], z0 = p[si * 2 + 1], x1 = p[si * 2 + 2], z1 = p[si * 2 + 3];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.3) continue;
      const ux = (x1 - x0) / len, uz = (z1 - z0) / len, nx = -uz, nz = ux, hw = r.width / 2;
      const ext = Math.min(hw * 0.35, len * 0.4);
      const col0 = ROAD_COL[Math.min(r.t, 9)];
      const rank = (9 - Math.min(r.t, 9)) * 0.02;
      const pieces = Math.max(1, Math.ceil(len / 20));
      const ys = r.ys;
      const yAt = (x, z, t) => (ys ? ys[si] + (ys[si + 1] - ys[si]) * t + (r.fl & 3 ? 0.05 : 0.05 + rank) : T.heightAt(x, z) + 0.12 + rank);
      let prev = null;
      for (let s = 0; s <= pieces; s++) {
        const t = s / pieces;
        const e = s === 0 ? -ext : s === pieces ? ext : 0;
        const px = x0 + (x1 - x0) * t + ux * e, pz = z0 + (z1 - z0) * t + uz * e;
        const lx = px + nx * hw, lz = pz + nz * hw, rx = px - nx * hw, rz = pz - nz * hw;
        const cur = { lx, lz, rx, rz, ly: yAt(lx, lz, t), ry: yAt(rx, rz, t), px, pz, py: yAt(px, pz, t), t };
        if (prev) quad(prev.lx, prev.ly, prev.lz, cur.lx, cur.ly, cur.lz, cur.rx, cur.ry, cur.rz, prev.rx, prev.ry, prev.rz, col0);
        if (prev && (r.fl & 2) && r.ys) { const H = 5.2, o = 0.4;
          const L0 = [prev.lx + nx * o, prev.ly, prev.lz + nz * o], L1 = [cur.lx + nx * o, cur.ly, cur.lz + nz * o], R0 = [prev.rx - nx * o, prev.ry, prev.rz - nz * o], R1 = [cur.rx - nx * o, cur.ry, cur.rz - nz * o];
          const up = (p) => [p[0], p[1] + H, p[2]];
          tq(up(L0), up(L1), up(R1), up(R0)); tq(L0, L1, up(L1), up(L0)); tq(R0, up(R0), up(R1), R1); }
        if (prev && r.t <= 3) { // solid edge lines on major roads
          for (const sgn of [1, -1]) {
            const o = (hw - 0.55) * sgn, w2 = 0.09;
            const ax = prev.px + nx * o, az = prev.pz + nz * o, bx = cur.px + nx * o, bz = cur.pz + nz * o;
            const ay = (ys ? prev.py : T.heightAt(ax, az) + 0.12 + rank) + 0.04, by = (ys ? cur.py : T.heightAt(bx, bz) + 0.12 + rank) + 0.04;
            quad(ax + nx * w2, ay, az + nz * w2, bx + nx * w2, by, bz + nz * w2, bx - nx * w2, by, bz - nz * w2, ax - nx * w2, ay, az - nz * w2, MARK);
          }
        }
        prev = cur;
      }
      if (r.t <= 4 && !r.ow && r.width >= 8) { // dashed centre line
        const base = r.cum[si];
        let s0 = Math.ceil(base / 9) * 9 - base;
        for (let s = s0; s < len; s += 9) {
          const e = Math.min(len, s + 3.5);
          const ax = x0 + ux * s, az = z0 + uz * s, bx = x0 + ux * e, bz = z0 + uz * e;
          const ya = (ys ? ys[si] + (ys[si + 1] - ys[si]) * (s / len) : T.heightAt(ax, az) + 0.12 + rank) + 0.04;
          const yb = (ys ? ys[si] + (ys[si + 1] - ys[si]) * (e / len) : T.heightAt(bx, bz) + 0.12 + rank) + 0.04;
          quad(ax + nx * 0.12, ya, az + nz * 0.12, bx + nx * 0.12, yb, bz + nz * 0.12, bx - nx * 0.12, yb, bz - nz * 0.12, ax - nx * 0.12, ya, az - nz * 0.12, MARK);
        }
      }
    }
    if (!vc) return null;
    const g = new THREE.BufferGeometry();
    if (tvc) { const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tp), 3)); tg.setIndex(tix); tg.computeVertexNormals(); g.userData.tunnel = tg; }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setIndex(new THREE.BufferAttribute(vc > 65000 ? new Uint32Array(idx) : new Uint32Array(idx), 1));
    return g;
  }

  _buildBuildings({ ch, list }) {
    if (!this.chunks.has(ch.k)) return;
    const T = this.T;
    const wp = [], wn = [], wu = [], wc = [], wi = [];
    const rp = [], rn = [], rc = [], ri = [];
    let wv = 0, rv = 0;
    const colliders = [];
    const c = new THREE.Color();
    for (const b of list) {
      const pts = b.p, n = pts.length / 2;
      if (n < 3) continue;
      let area2 = 0, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, gmin = 1e9, gmax = -1e9;
      for (let i = 0; i < n; i++) {
        const x1 = pts[i * 2], z1 = pts[i * 2 + 1], x2 = pts[((i + 1) % n) * 2], z2 = pts[((i + 1) % n) * 2 + 1];
        area2 += x1 * z2 - x2 * z1;
        if (x1 < minX) minX = x1; if (x1 > maxX) maxX = x1; if (z1 < minZ) minZ = z1; if (z1 > maxZ) maxZ = z1;
        const g = T.heightAt(x1, z1);
        if (g < gmin) gmin = g; if (g > gmax) gmax = g;
      }
      if (b.k !== 1) { // لا مبنى فوق طريق: تجاهل أي مبنى تلمس بصمته طريقاً (عدا الأنفاق) كي لا يسدّ السيارة
        let onRoad = false;
        for (let i = 0; i < n && !onRoad; i++) {
          const x1 = pts[i * 2], z1 = pts[i * 2 + 1], x2 = pts[((i + 1) % n) * 2], z2 = pts[((i + 1) % n) * 2 + 1];
          for (const [qx, qz] of [[x1, z1], [(x1 + x2) / 2, (z1 + z2) / 2]]) {
            const nr = this.D.idx.nearest(qx, qz, 16, { drv: true });
            if (nr && nr.road.t <= 6 && !(nr.road.fl & 2) && nr.d < nr.road.width * 0.5 + 0.8) { onRoad = true; break; }
          }
        }
        if (!onRoad) { const nr = this.D.idx.nearest((minX + maxX) / 2, (minZ + maxZ) / 2, 16, { drv: true }); if (nr && nr.road.t <= 6 && !(nr.road.fl & 2) && nr.d < nr.road.width * 0.5) onRoad = true; }
        if (onRoad) continue;
      }
      if (b.k === 1) { // Masjid al-Haram complex: open plaza
        const y = T.heightAt(0, 0) + 0.3;
        c.set('#ebe5d6');
        const tri = THREE.ShapeUtils.triangulateShape(Array.from({ length: n }, (_, i) => new THREE.Vector2(pts[i * 2], pts[i * 2 + 1])), []);
        for (let i = 0; i < n; i++) { rp.push(pts[i * 2], y, pts[i * 2 + 1]); rn.push(0, 1, 0); rc.push(c.r, c.g, c.b); }
        for (const t of tri) {
          const [a, bb, cc] = t;
          const cr = (pts[bb * 2 + 1] - pts[a * 2 + 1]) * (pts[cc * 2] - pts[a * 2]) - (pts[bb * 2] - pts[a * 2]) * (pts[cc * 2 + 1] - pts[a * 2 + 1]);
          if (cr < 0) ri.push(rv + a, rv + bb, rv + cc); else ri.push(rv + a, rv + cc, rv + bb);
        }
        rv += n;
        continue;
      }
      let h = b.h;
      const cxm = (minX + maxX) / 2, czm = (minZ + maxZ) / 2, rnd = hash2(cxm, czm);
      if (!(h > 0)) {
        const dc = Math.hypot(cxm, czm);
        h = dc < 1500 ? 9 + rnd * rnd * 38 : 5 + rnd * 12;
        if (dc < 450) h += 10 + rnd * 25;
      }
      h = clamp(h, 3, 620);
      const base = gmin - 1.5, top = gmax + h;
      c.copy(BCOLS[Math.floor(hash2(cxm + 3, czm - 7) * BCOLS.length)]);
      const sh = 0.92 + hash2(cxm, czm + 11) * 0.14; c.r *= sh; c.g *= sh; c.b *= sh;
      let along = 0;
      const ccw = area2 < 0; // see winding derivation: area2<0 -> (p1,p2,p3)
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, x1 = pts[i * 2], z1 = pts[i * 2 + 1], x2 = pts[j * 2], z2 = pts[j * 2 + 1];
        const dx = x2 - x1, dz = z2 - z1, el = Math.hypot(dx, dz);
        if (el < 0.05) continue;
        let nx = ccw ? -dz / el : dz / el, nz = ccw ? dx / el : -dx / el;
        const u0 = along / 4.2, u1 = (along + el) / 4.2, v1 = (top - base) / 3.2;
        wp.push(x1, base, z1, x2, base, z2, x2, top, z2, x1, top, z1);
        for (let q = 0; q < 4; q++) { wn.push(nx, 0, nz); wc.push(c.r, c.g, c.b); }
        wu.push(u0, 0, u1, 0, u1, v1, u0, v1);
        if (ccw) wi.push(wv, wv + 1, wv + 2, wv, wv + 2, wv + 3); else wi.push(wv, wv + 2, wv + 1, wv, wv + 3, wv + 2);
        wv += 4; along += el;
      }
      // roof
      const tri = THREE.ShapeUtils.triangulateShape(Array.from({ length: n }, (_, i) => new THREE.Vector2(pts[i * 2], pts[i * 2 + 1])), []);
      const rc2 = c.clone().multiplyScalar(0.78);
      for (let i = 0; i < n; i++) { rp.push(pts[i * 2], top, pts[i * 2 + 1]); rn.push(0, 1, 0); rc.push(rc2.r, rc2.g, rc2.b); }
      for (const t of tri) {
        const [a, bb, cc] = t;
        const cr = (pts[bb * 2 + 1] - pts[a * 2 + 1]) * (pts[cc * 2] - pts[a * 2]) - (pts[bb * 2] - pts[a * 2]) * (pts[cc * 2 + 1] - pts[a * 2 + 1]);
        if (cr < 0) ri.push(rv + a, rv + bb, rv + cc); else ri.push(rv + a, rv + cc, rv + bb);
      }
      rv += n;
      colliders.push({ minX, maxX, minZ, maxZ, pts: Float32Array.from(pts) });
    }
    if (wv) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wp), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(wn), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(wc), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(wu), 2));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(wi), 1));
      ch.group.add(new THREE.Mesh(g, this.wallMat));
    }
    if (rv) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rp), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rn), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rc), 3));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(ri), 1));
      ch.group.add(new THREE.Mesh(g, this.roofMat));
    }
    this.colliders.set(ch.k, colliders);
  }

  hitBuilding(x, z) {
    const cx = Math.floor((x - this.X0) / this.CELL), cz = Math.floor((z - this.Z0) / this.CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const a = this.colliders.get(this._key(cx + dx, cz + dz));
        if (!a) continue;
        for (const b of a) if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && pip(b.pts, x, z)) return true;
      }
    }
    return false;
  }

  async preload(px, pz, onProgress) {
    this.update(px, pz, 1);
    const total = Math.max(1, this.queue.length);
    const t0 = performance.now();
    while ((this.busy) && performance.now() - t0 < 25000) {
      this.pump(30);
      if (onProgress) onProgress(1 - this.queue.length / total);
      await new Promise((r) => setTimeout(r, 16));
    }
  }

  // ---------- ribbons (route, highlight) ----------
  makeRibbon(polylines, width, yOff, color, opacity) {
    const pos = [], idx = [];
    let vc = 0;
    for (const pl of polylines) {
      const n = pl.length / 2;
      let prev = null;
      for (let k = 0; k < n; k++) {
        const x = pl[k * 2], z = pl[k * 2 + 1];
        let dx, dz;
        if (k < n - 1) { dx = pl[k * 2 + 2] - x; dz = pl[k * 2 + 3] - z; } else { dx = x - pl[k * 2 - 2]; dz = z - pl[k * 2 - 1]; }
        const l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, hw = width / 2;
        const y = this.D.groundAt(x, z) + yOff;
        pos.push(x + nx * hw, y, z + nz * hw, x - nx * hw, y, z - nz * hw);
        if (prev !== null) { idx.push(prev, prev + 1, vc + 1, prev, vc + 1, vc); }
        prev = vc; vc += 2;
      }
      prev = null;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.frustumCulled = false; m.renderOrder = 5;
    return m;
  }
  _densify(pts, step) {
    const out = [];
    for (let k = 0; k < pts.length / 2 - 1; k++) {
      const x0 = pts[k * 2], z0 = pts[k * 2 + 1], x1 = pts[k * 2 + 2], z1 = pts[k * 2 + 3];
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / step));
      for (let s = 0; s < n; s++) out.push(x0 + (x1 - x0) * s / n, z0 + (z1 - z0) * s / n);
    }
    out.push(pts[pts.length - 2], pts[pts.length - 1]);
    return out;
  }
  setRoute(route) {
    if (this.routeMesh) { this.scene.remove(this.routeMesh); this.routeMesh.geometry.dispose(); this.routeMesh = null; }
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon.geometry.dispose(); this.beacon = null; }
    if (!route) return;
    this.routeMesh = this.makeRibbon([this._densify(route.pts, 12)], 3.2, 0.3, 0xffc933, 0.92);
    this.scene.add(this.routeMesh);
    this.setBeacon(route.goal.x, route.goal.z);
  }
  setBeacon(x, z) {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon.geometry.dispose(); this.beacon = null; }
    const g = new THREE.CylinderGeometry(4, 4, 260, 16, 1, true);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffc933, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.set(x, this.D.groundAt(x, z) + 130, z);
    this.beacon = m; this.scene.add(m);
  }
  clearBeacon() { if (this.beacon) { this.scene.remove(this.beacon); this.beacon.geometry.dispose(); this.beacon = null; } }
  setHighlight(roadIdx) {
    if (this.hlMesh) { this.scene.remove(this.hlMesh); this.hlMesh.geometry.dispose(); this.hlMesh = null; }
    if (!roadIdx || !roadIdx.length) return;
    const lines = roadIdx.map((i) => this._densify(this.D.roads[i].pts, 15));
    this.hlMesh = this.makeRibbon(lines, 4, 0.4, 0x4da3ff, 0.9);
    this.scene.add(this.hlMesh);
  }

  project(x, y, z, out) {
    const v = out || new THREE.Vector3();
    v.set(x, y, z).project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, z: v.z };
  }

  render() {
    this.sky.position.copy(this.camera.position);
    this.sun.target.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
}

// ---------- street signs ----------
export class Signs {
  constructor(world, nav) {
    this.world = world; this.cache = new Map(); this.pool = [];
    const { D } = world;
    const roads = D.roads;
    this.grid = new Map();
    for (let g = 0; g < nav.G; g++) {
      const adj = nav.adj[g];
      if (!adj || adj.length < 2) continue;
      const names = [];
      let deg = 0;
      for (const ei of adj) {
        const e = nav.edges[ei], r = roads[e.ri];
        if (r.t > 7) continue;
        deg++;
        if (r.name && !names.includes(r.name)) names.push(r.name);
      }
      if (!names.length || deg < 2) continue;
      if (deg === 2 && names.length < 2) continue;
      const x = nav.nx[g], z = nav.nz[g];
      const k = Math.floor(x / 100) * 10000 + Math.floor(z / 100);
      let a = this.grid.get(k);
      if (!a) { a = []; this.grid.set(k, a); }
      a.push({ x, z, names: names.slice(0, 2) });
    }
    for (let i = 0; i < 38; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      s.visible = false; s.scale.set(8, 2, 1); s.renderOrder = 3;
      world.scene.add(s); this.pool.push(s);
    }
    this.enabled = true;
  }
  _tex(names) {
    const key = names.join('|');
    let t = this.cache.get(key);
    if (t) return t;
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = names.length > 1 ? 160 : 96;
    const g = cv.getContext('2d');
    g.fillStyle = '#0d5c3a'; g.strokeStyle = '#ffffff'; g.lineWidth = 6;
    const r = 18, w = cv.width, h = cv.height;
    g.beginPath(); g.moveTo(r, 3); g.arcTo(w - 3, 3, w - 3, h - 3, r); g.arcTo(w - 3, h - 3, 3, h - 3, r); g.arcTo(3, h - 3, 3, 3, r); g.arcTo(3, 3, w - 3, 3, r); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    const fs = names.length > 1 ? 44 : 54;
    g.font = `bold ${fs}px Tajawal, "Segoe UI", Tahoma, Arial, sans-serif`;
    names.forEach((nm, i) => {
      let size = fs;
      while (g.measureText(nm).width > w - 40 && size > 20) { size -= 3; g.font = `bold ${size}px Tajawal, "Segoe UI", Tahoma, Arial, sans-serif`; }
      g.fillText(nm, w / 2, names.length > 1 ? h * (0.3 + i * 0.4) : h / 2);
      g.font = `bold ${fs}px Tajawal, "Segoe UI", Tahoma, Arial, sans-serif`;
    });
    t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    t.aspect = w / h;
    this.cache.set(key, t);
    if (this.cache.size > 160) { const first = this.cache.keys().next().value; this.cache.get(first).dispose(); this.cache.delete(first); }
    return t;
  }
  update(px, pz) {
    if (!this.enabled) { for (const s of this.pool) s.visible = false; return; }
    const cx = Math.floor(px / 100), cz = Math.floor(pz / 100), list = [];
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const a = this.grid.get((cx + dx) * 10000 + (cz + dz));
      if (!a) continue;
      for (const j of a) { const d = Math.hypot(j.x - px, j.z - pz); if (d < 230) list.push([d, j]); }
    }
    list.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i], it = list[i];
      if (!it || it[0] < 18) { s.visible = false; continue; }
      const j = it[1], tex = this._tex(j.names);
      if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
      s.scale.set(8, 8 / tex.aspect, 1);
      s.position.set(j.x + 4, this.world.D.groundAt(j.x, j.z) + 5.5, j.z + 4);
      s.visible = true;
    }
  }
}

// يافطات المناطق/الأحياء: لوحات كبيرة بنية بإطار ذهبي، مميزة عن يافطات الشوارع الخضراء، ظاهرة دائماً (لا يحجبها شيء)
export class HoodSigns {
  constructor(world) {
    this.world = world; this.cache = new Map(); this.pool = [];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
      s.visible = false; s.renderOrder = 9; world.scene.add(s); this.pool.push(s);
    }
    this.enabled = true;
  }
  _tex(name) {
    let t = this.cache.get(name);
    if (t) return t;
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 200;
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, r = 30;
    g.beginPath(); g.moveTo(r, 4); g.arcTo(w - 4, 4, w - 4, h - 4, r); g.arcTo(w - 4, h - 4, 4, h - 4, r); g.arcTo(4, h - 4, 4, 4, r); g.arcTo(4, 4, w - 4, 4, r); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a5a1c'); gr.addColorStop(1, '#4a2d0c');
    g.fillStyle = gr; g.fill(); g.lineWidth = 10; g.strokeStyle = '#f2c35a'; g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#fff3c9'; g.strokeRect(22, 22, w - 44, h - 44);
    g.fillStyle = '#ffe9b0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.font = 'bold 34px Tajawal, "Segoe UI", Tahoma, Arial, sans-serif'; g.fillText('🏘 منطقة', w / 2, 52);
    let size = 76; g.font = `bold ${size}px Tajawal, "Segoe UI", Tahoma, Arial, sans-serif`;
    const nm = name.replace(/^حي\s+/, '');
    while (g.measureText(nm).width > w - 70 && size > 28) { size -= 4; g.font = `bold ${size}px Tajawal, "Segoe UI", Tahoma, Arial, sans-serif`; }
    g.fillStyle = '#fff'; g.fillText(nm, w / 2, 124);
    t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.aspect = w / h;
    this.cache.set(name, t);
    return t;
  }
  update(px, pz) {
    const D = this.world.D, list = [];
    if (this.enabled) for (const p of D.places) { const d = Math.hypot(p.x - px, p.z - pz); if (d < 2400) list.push([d, p]); }
    list.sort((a, b) => a[0] - b[0]);
    this.near = new Set();
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i], it = list[i];
      if (!it) { s.visible = false; continue; }
      const [d, p] = it, tex = this._tex(p.n);
      if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
      const w = clamp(26 + d * 0.05, 26, 80);
      s.scale.set(w, w / tex.aspect, 1);
      s.position.set(p.x, D.terrain.heightAt(p.x, p.z) + 38 + w * 0.2, p.z);
      s.visible = true; this.near.add(p.n);
    }
  }
}

// صور حقيقية للمعالم المشهورة (من ويكيبيديا وقت التشغيل، مع ذكر المصدر) كلوحات معلّقة فوق المعلم
export const FAMOUS = [
  { id: 'kaaba', n: 'الكعبة المشرفة', x: -2, z: -2, wiki: ['Kaaba'], ar: ['الكعبة'] },
  { id: 'haram', n: 'المسجد الحرام', x: 70, z: -150, wiki: ['Great_Mosque_of_Mecca', 'Masjid_al-Haram'], ar: ['المسجد_الحرام'] },
  { id: 'clock', n: 'أبراج البيت (برج الساعة)', x: -68, z: 490, wiki: ['Abraj_Al-Bait', 'Makkah_Royal_Clock_Tower'], ar: ['أبراج_البيت', 'برج_الساعة_الملكي_بمكة_المكرمة'] },
  { id: 'safa', n: 'الصفا والمروة (المسعى)', x: 113, z: -114, wiki: ['Safa_and_Marwa', 'Al-Safa_and_Al-Marwa'], ar: ['الصفا_والمروة'] },
  { id: 'nour', n: 'جبل النور', x: 3471, z: -3923, wiki: ['Jabal_al-Nour', 'Jabal_al-Noor'], ar: ['جبل_النور'] },
  { id: 'hira', n: 'غار حراء', x: 3415, z: -3877, wiki: ['Cave_of_Hira', 'Hira'], ar: ['غار_حراء'] },
  { id: 'thawr', n: 'جبل ثور وغار ثور', x: 2450, z: 5055, wiki: ['Jabal_Thawr', 'Thawr_Cave'], ar: ['جبل_ثور', 'غار_ثور'] },
  { id: 'jamarat', n: 'الجمرات (منى)', x: 4811, z: 191, wiki: ['Jamaraat_Bridge', 'Jamarat', 'Stoning_of_the_Devil'], ar: ['جسر_الجمرات', 'رمي_الجمرات'] },
  { id: 'muala', n: 'مقبرة المعلاة', x: 269, z: -1404, wiki: ["Jannat_al-Mu'alla"], ar: ['مقبرة_المعلاة'] },
  { id: 'qubays', n: 'جبل أبي قبيس', x: 238, z: 330, wiki: ['Jabal_Abu_Qubays', 'Abu_Qubays'], ar: ['جبل_أبي_قبيس'] },
  { id: 'jinn', n: 'مسجد الجن', x: 186, z: -943, wiki: ['Masjid_al-Jinn'], ar: ['مسجد_الجن'] },
  { id: 'library', n: 'مكتبة مكة المكرمة (مولد النبي ﷺ)', x: 386, z: -272, wiki: ["Makkah_Al-Mukarramah_Library", "Birthplace_of_Muhammad"], ar: ["مكتبة_مكة_المكرمة"] },
  { id: 'omar', n: 'جبل عمر (أبراج جبل عمر)', x: -459, z: 187, wiki: ["Jabal_Omar_Development", "Jabal_Omar"], ar: ["مشروع_جبل_عمر"] },
  { id: 'bayah', n: 'مسجد البيعة', x: 4274, z: -246, wiki: ["Masjid_al-Bay'ah", "Al-Bay'ah_Mosque"], ar: ["مسجد_البيعة"] },
  { id: 'quranm', n: 'متحف القرآن الكريم', x: 4491, z: -3776, wiki: ["Museum_of_the_Holy_Quran"], ar: ["متحف_القرآن_الكريم"] },
  { id: 'uqu', n: 'جامعة أم القرى', x: -1815, z: -1978, wiki: ["Umm_al-Qura_University"], ar: ["جامعة_أم_القرى"] },
  { id: 'kudai', n: 'أبراج كدي', x: 271, z: 2312, wiki: ["Abraj_Kudai"], ar: ["أبراج_كدي"] },
  { id: 'haramain', n: 'قطار الحرمين السريع', x: -3899, z: 538, wiki: ['Haramain_high-speed_railway'], ar: ['قطار_الحرمين_السريع'] },
];
export class LandmarkPhotos {
  constructor(world) { this.world = world; this.st = new Map(); this.pool = []; this.shownPos = []; this.enabled = true; this.t = 0;
    for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })); s.visible = false; s.renderOrder = 8; world.scene.add(s); this.pool.push(s); } }
  async _fetchInfo(f) {
    const tries = f.wiki.map((t) => ['en', t]).concat(f.ar.map((t) => ['ar', t]));
    for (const [lang, t] of tries) {
      try { // 1) واجهة REST الملخّص
        const r = await fetch('https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t));
        if (r.ok) { const j = await r.json(), src = j.thumbnail && j.thumbnail.source; if (src) return { src: src.replace(/\/(\d+)px-/, '/500px-') }; }
      } catch (e) { /* جرّب الطريقة التالية */ }
      try { // 2) واجهة MediaWiki (pageimages) كاحتياط
        const r = await fetch('https://' + lang + '.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=500&redirects=1&format=json&origin=*&titles=' + encodeURIComponent(t));
        if (r.ok) { const j = await r.json(), pg = j.query && j.query.pages; for (const k in pg || {}) if (pg[k].thumbnail) return { src: pg[k].thumbnail.source }; }
      } catch (e) { /* التالي */ }
    }
    return null;
  }
  _load(f) {
    const st = { state: 'loading', tex: null }; this.st.set(f.id, st);
    (async () => {
      let info = { src: 'img/landmarks/' + f.id + '.jpg', local: true }; // الصورة المحفوظة مع الموقع (سريعة وبلا اعتماد على ويكيبيديا)
      if (!(await new Promise((ok) => { const t = new Image(); t.onload = () => ok(true); t.onerror = () => ok(false); t.src = info.src; }))) info = await this._fetchInfo(f);
      if (!info) { st.state = 'fail'; st.err = 'no-image'; setTimeout(() => this.st.delete(f.id), 120000); return; } // نعيد المحاولة بعد دقيقتين
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const cv = document.createElement('canvas'); cv.width = 640; cv.height = 420; const g = cv.getContext('2d');
          g.fillStyle = '#3a2410'; g.fillRect(0, 0, 640, 420);
          const k = Math.max(616 / img.width, 330 / img.height), w = img.width * k, h = img.height * k;
          g.save(); g.beginPath(); g.rect(12, 12, 616, 330); g.clip(); g.drawImage(img, 12 + (616 - w) / 2, 12 + (330 - h) / 2, w, h); g.restore();
          g.lineWidth = 8; g.strokeStyle = '#f2c35a'; g.strokeRect(4, 4, 632, 412);
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.direction = 'rtl'; g.font = 'bold 40px Tajawal, "Segoe UI", Tahoma, sans-serif'; g.fillText(f.n, 320, 388);
          g.fillStyle = '#e8cf93'; g.font = '16px "Segoe UI", Tahoma, sans-serif'; g.fillText('الصورة: ويكيبيديا', 320, 408);
          const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; st.tex = t; st.state = 'ok';
        } catch (e) { st.state = 'fail'; }
      };
      img.onerror = () => { st.state = 'fail'; st.err = 'img'; setTimeout(() => this.st.delete(f.id), 120000); };
      img.src = info.src;
    })();
  }
  update(px, pz) {
    const T = this.world.D.terrain, list = []; this.shownPos = [];
    if (this.enabled) for (const f of FAMOUS) { const d = Math.hypot(f.x - px, f.z - pz); if (d < 9000) list.push([d, f]); }
    list.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.pool.length; i++) {
      const s = this.pool[i], it = list[i];
      if (!it || it[0] < 35) { s.visible = false; continue; }
      const [d, f] = it; let st = this.st.get(f.id);
      if (!st) { this._load(f); s.visible = false; continue; }
      if (st.state !== 'ok') { s.visible = false; continue; }
      if (s.material.map !== st.tex) { s.material.map = st.tex; s.material.needsUpdate = true; }
      const w = clamp(22 + d * 0.05, 22, 110);
      s.scale.set(w, w * 420 / 640, 1);
      s.position.set(f.x, T.heightAt(f.x, f.z) + 34 + w * 0.3, f.z);
      s.visible = true; this.shownPos.push([f.x, f.z]);
    }
  }
}
