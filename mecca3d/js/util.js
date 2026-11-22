// Shared helpers for the Mecca 3D explorer.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function norm(s) {
  return (s || '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
// "شارع الستين" and "طريق الستين" are treated as the same street for learning.
export function streetKey(name) {
  return norm(name).replace(/^(شارع|طريق|ش)\s+/, '');
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

export function hash2(x, z) {
  let h = (Math.imul(Math.floor(x * 10) | 0, 374761393) + Math.imul(Math.floor(z * 10) | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function fmtDist(m) {
  if (m < 950) return Math.max(10, Math.round(m / 10) * 10) + ' م';
  return (m / 1000).toFixed(1) + ' كم';
}
export function fmtDistFine(m) {
  if (m < 60) return Math.max(10, Math.round(m / 10) * 10) + ' م';
  if (m < 950) return Math.round(m / 50) * 50 + ' م';
  return (m / 1000).toFixed(1) + ' كم';
}

// 0 = north, clockwise. World: x east, z south.
export function bearingDeg(dx, dz) {
  return (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
}
export function angDiff(a, b) { // signed shortest difference b - a in degrees
  return ((b - a + 540) % 360) - 180;
}
const DIRS8 = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
export function dirName(deg) { return DIRS8[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }

export function $(id) { return document.getElementById(id); }
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
