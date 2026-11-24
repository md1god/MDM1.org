// Community contributions: street-name suggestions, notes and photos (moderated; see supabase/migrations/007).
import { norm } from './util.js';

const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const BUCKET = 'mecca-photos';
let sbP = null;

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = false; const to = setTimeout(() => rej(new Error('timeout ' + src)), 9000); s.onload = () => { clearTimeout(to); res(); }; s.onerror = () => { clearTimeout(to); rej(new Error('load ' + src)); }; document.head.appendChild(s); });
}
export function getSb() {
  if (sbP) return sbP;
  sbP = (async () => {
    const ok = () => window.supabase && typeof window.supabase.from === 'function' && window.supabase.auth;
    if (ok()) return window.supabase;
    for (let i = 0; i < 20 && !ok(); i++) await new Promise((r) => setTimeout(r, 150)); // the site's sign-in button may be loading it
    if (ok()) return window.supabase;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') await loadScript(LIB);
    await loadScript('../js/supabase-client.js');
    if (!ok()) throw new Error('supabase unavailable');
    return window.supabase;
  })().catch((e) => { sbP = null; throw e; });
  return sbP;
}

function resizeImage(file, maxSide = 1280, q = 0.78) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h); // re-encoding drops EXIF/GPS metadata
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

export class Contrib {
  constructor(D) { this.D = D; this.items = []; this.mine = []; this.ready = false; this.failed = false; }

  async init() {
    try {
      const sb = await getSb();
      const { data, error } = await sb.from('mecca_contrib').select('id,kind,street_key,street_name,body,x,z,photo_path,status,created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      this.items = data.map((r) => this._wrap(sb, r));
      this.ready = true;
      this._applyRenames();
    } catch (e) { this.failed = true; }
    return this.ready;
  }
  _wrap(sb, r) {
    if (r.photo_path) r.url = sb.storage.from(BUCKET).getPublicUrl(r.photo_path).data.publicUrl;
    return r;
  }
  _applyRenames() {
    const D = this.D;
    for (const it of this.items) {
      if (it.kind !== 'rename' || !it.street_key) continue;
      const st = D.streets.get(it.street_key);
      if (!st) continue;
      D.search.push({ type: 'street', name: it.body, en: '', nn: norm(it.body), ne: '', x: st.mx, z: st.mz, key: st.key, hood: st.hood, alias: true });
    }
  }
  async session() {
    try { const sb = await getSb(); const { data } = await sb.auth.getSession(); return data && data.session ? data.session : null; } catch (e) { return null; }
  }
  async loadMine() {
    const s = await this.session(); if (!s) { this.mine = []; return []; }
    const sb = await getSb();
    const { data, error } = await sb.from('mecca_contrib').select('id,kind,street_key,street_name,body,x,z,photo_path,status,created_at').eq('user_id', s.user.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    this.mine = data.map((r) => this._wrap(sb, r));
    return this.mine;
  }
  async submit({ kind, body, x, z, street_key, street_name, file }) {
    const s = await this.session();
    if (!s) return { needLogin: true };
    const sb = await getSb();
    let photo_path = null;
    if (kind === 'photo') {
      if (!file) return { error: 'اختر صورة أولاً' };
      const blob = await resizeImage(file);
      if (blob.size > 1000000) return { error: 'الصورة كبيرة، جرّب صورة أخرى' };
      photo_path = s.user.id + '/' + (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')) + '.jpg';
      const up = await sb.storage.from(BUCKET).upload(photo_path, blob, { contentType: 'image/jpeg', upsert: false });
      if (up.error) return { error: 'تعذّر رفع الصورة' };
    }
    const row = { kind, body: body.trim().slice(0, 500), x: Math.round(x), z: Math.round(z), street_key: street_key || null, street_name: street_name || null, photo_path };
    const { error } = await sb.from('mecca_contrib').insert(row);
    if (error) {
      if (photo_path) sb.storage.from(BUCKET).remove([photo_path]).catch(() => {});
      return { error: /limit/i.test(error.message || '') ? 'وصلت للحد اليومي للمساهمات' : 'تعذّر الحفظ، حاول لاحقاً' };
    }
    return { ok: true };
  }
  nearby(x, z, radius = 500) {
    const out = [];
    for (const it of this.items) { const d = Math.hypot(it.x - x, it.z - z); if (d <= radius) out.push([d, it]); }
    out.sort((a, b) => a[0] - b[0]);
    return out;
  }
}

export class Pins {
  constructor(layer, world, onOpen) { this.layer = layer; this.world = world; this.onOpen = onOpen; this.els = new Map(); this.t = 0; this.list = []; }
  update(contrib, px, pz, dt) {
    this.t += dt;
    if (this.t > 1.5) {
      this.t = 0;
      this.list = contrib.nearby(px, pz, 450).filter(([, it]) => it.kind !== 'rename').slice(0, 14).map(([, it]) => it);
      const keep = new Set(this.list.map((i) => i.id));
      for (const [id, el] of this.els) if (!keep.has(id)) { el.remove(); this.els.delete(id); }
      for (const it of this.list) {
        if (this.els.has(it.id)) continue;
        const b = document.createElement('button'); b.className = 'pin'; b.textContent = it.kind === 'photo' ? '📷' : '💬';
        b.onclick = () => this.onOpen(it); this.layer.appendChild(b); this.els.set(it.id, b);
      }
    }
    for (const it of this.list) {
      const el = this.els.get(it.id); if (!el) continue;
      const y = this.world.D.groundAt(it.x, it.z) + 6, s = this.world.project(it.x, y, it.z);
      if (s.z > 1 || s.x < -40 || s.x > innerWidth + 40 || s.y < 60 || s.y > innerHeight - 60) { el.style.display = 'none'; continue; }
      el.style.display = 'block'; el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-50%)`;
    }
  }
}
