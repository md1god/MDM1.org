/* MDM1 page effects, shared by mdm1.org (bundled into js/mdm1-3d.js) and md1usd.com (src/utils/fx.ts copy).
 *
 *   1. Falling text: paragraphs and headings that start below the fold drop in from above, word by word,
 *      driven by scroll position (calm, eased, and always settle fully so they stay easy to read).
 *   2. 360 media: large images and videos can be dragged to spin around the vertical axis with inertia,
 *      tilt toward the pointer on hover, spring back to face the viewer, and double-click for a full spin.
 *
 * Self-contained (no dependencies, injects its own CSS). Safe by construction:
 *   - content already on screen when the page loads is never hidden (no flash);
 *   - prefers-reduced-motion disables everything; html.m3d-off (the 3D toggle) makes everything static;
 *   - React-managed sites pass { words: false }: text is then animated as whole blocks, so no text node
 *     that a framework owns is ever replaced.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const CSS = `
.m3d-w{display:inline-block;transform-origin:50% 0}
.m3d-spin{touch-action:pan-y;cursor:grab;-webkit-user-select:none;user-select:none;-webkit-user-drag:none;will-change:transform;transform-origin:50% 50%}
.m3d-spin.m3d-grab{cursor:grabbing}
html.m3d-off .m3d-w{opacity:1!important;transform:none!important}
html.m3d-off .m3d-spin{transform:none!important;cursor:auto}
@media (prefers-reduced-motion:reduce){.m3d-w{opacity:1!important;transform:none!important}.m3d-spin{transform:none!important;cursor:auto}}
`;

const TEXT_SKIP = 'nav,header,footer,aside,form,table,pre,code,kbd,samp,script,style,noscript,textarea,select,button,svg,canvas,iframe,label,'
  + '[role="navigation"],[role="dialog"],[role="menu"],[contenteditable],[aria-hidden="true"],#mdm1m-panel,#mdm1-hub3d,#mdm1-lang-panel,.m3d-no,[data-no-fx]';
const TEXT_BLOCKS = 'h1,h2,h3,h4,p,li,blockquote,figcaption,dd,dt';
const NESTED_BLOCK = 'p,li,h1,h2,h3,h4,blockquote,figcaption,dd,dt,ul,ol,table,form';
const INLINE_SPLIT = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'MARK', 'SMALL', 'FONT', 'BIG']);
const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LATIN_RE = /[A-Za-z0-9À-ɏ]/;

const MEDIA_SKIP = 'nav,header,footer,a,button,label,[role="button"],[role="navigation"],#mdm1m-panel,#mdm1-hub3d,#mdm1-lang-panel,'
  + '[class*="carousel"],[class*="slider"],[class*="swiper"],[class*="slick"],.m3d-no,[data-no-fx]';
const MEDIA_NAME_SKIP = /logo|icon|avatar|emoji|badge|favicon|sprite|flag|\bbg\b|background|backdrop|wallpaper|qr/i;

export function initFx(options = {}) {
  const opts = Object.assign({ text: true, media: true, words: true, maxText: 1600, maxMedia: 60 }, options);
  if (typeof window === 'undefined' || !window.matchMedia || window.__m3dFx) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.__m3dFx = true;

  const doc = document, html = doc.documentElement;
  const off = () => html.classList.contains('m3d-off');
  const st = doc.createElement('style');
  st.id = 'm3d-fx-css'; st.textContent = CSS;
  doc.head.appendChild(st);

  /* ------------------------------------------------------------ 1. falling text */
  const pending = [];              // prepared blocks that are still animating in
  let seen = 0;
  const dist = innerWidth < 600 ? 22 : 34;

  function splitInto(node, units, rtl) {
    for (const ch of Array.from(node.childNodes)) {
      if (ch.nodeType === 3) {
        const raw = ch.nodeValue;
        if (!raw || !raw.trim()) continue;
        const tokens = raw.split(/(\s+)/).filter((t) => t !== '');
        // In mixed Arabic/Latin text every word becomes an isolated inline-block, which would reverse the order of
        // consecutive Latin words inside an RTL line. Keep each run of Latin words (and the glue between) as one unit.
        const groups = [];
        for (const t of tokens) {
          const ws = /^\s+$/.test(t);
          const kind = ws ? 'w' : RTL_RE.test(t) ? 'r' : LATIN_RE.test(t) ? 'l' : 'n';
          const last = groups[groups.length - 1];
          if (rtl && last && last.merge && (kind === 'w' || kind === 'l' || kind === 'n')) {
            last.text += t; if (kind === 'l') last.lastLatin = last.text.length; continue;
          }
          groups.push({ text: t, kind, merge: rtl && kind === 'l', lastLatin: t.length });
        }
        const frag = doc.createDocumentFragment();
        for (const g of groups) {
          let body = g.text, tail = '';
          if (g.merge && g.lastLatin < g.text.length) { body = g.text.slice(0, g.lastLatin); tail = g.text.slice(g.lastLatin); }
          if (g.kind === 'w') { frag.appendChild(doc.createTextNode(g.text)); continue; }
          const s = doc.createElement('span');
          s.className = 'm3d-w'; s.textContent = body; units.push(s); frag.appendChild(s);
          if (tail) frag.appendChild(doc.createTextNode(tail));
        }
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) {
        const tag = ch.tagName;
        if (tag === 'A') {
          if (!ch.querySelector('img,svg,video') && (ch.textContent.match(/\S+/g) || []).length <= 6) { ch.classList.add('m3d-w'); units.push(ch); }
        } else if (INLINE_SPLIT.has(tag)) splitInto(ch, units, rtl);
      }
    }
  }

  function styleUnit(u, e) {
    const k = 1 - e;
    u.style.opacity = e.toFixed(3);
    u.style.transform = k < 0.002 ? 'none' : `perspective(520px) translate3d(0,${(-k * dist).toFixed(2)}px,0) rotateX(${(-k * 38).toFixed(2)}deg)`;
  }

  function prepare(el) {
    if (el.__m3d) return;
    el.__m3d = 1;
    if (seen >= opts.maxText) return;
    const r = el.getBoundingClientRect();
    if (r.height < 4 || r.top < innerHeight * 0.92) return;          // already on screen: leave it alone
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text' || /rgba\(0, 0, 0, 0\)|transparent/.test(cs.webkitTextFillColor || '')) return;
    if (el.querySelector(NESTED_BLOCK)) return;
    const text = el.textContent || '';
    const n = (text.match(/\S+/g) || []).length;
    if (!n) return;
    const rtl = RTL_RE.test(text);
    const blk = { el, units: [], whole: false, active: false, cur: [], offY: 0 };
    if (opts.words && n <= 170) {
      splitInto(el, blk.units, rtl);
    }
    if (!blk.units.length) {                                         // long block, or framework-managed text: animate the whole element
      if (cs.animationName !== 'none' || cs.transform !== 'none' || /m3d-(rv|tilt)/.test(el.className)) return;
      blk.whole = true; blk.units = [el];
      el.style.transition = 'none'; el.style.willChange = 'transform,opacity';
    }
    blk.cur = blk.units.map(() => 0);
    blk.units.forEach((u) => styleUnit(u, 0));
    seen++;
    pending.push(blk);
    wake();
  }

  function finish(blk) {
    blk.units.forEach((u) => { u.style.removeProperty('opacity'); u.style.removeProperty('transform'); });
    if (blk.whole) { blk.el.style.removeProperty('transition'); blk.el.style.removeProperty('will-change'); }
  }

  function stepText(dt) {
    const k = 1 - Math.exp(-dt * 7);
    const vh = innerHeight;
    const maxScroll = Math.max(0, html.scrollHeight - vh);
    const atBottom = scrollY >= maxScroll - 2;
    let moving = false;
    for (let b = pending.length - 1; b >= 0; b--) {
      const blk = pending[b];
      if (!blk.el.isConnected) { pending.splice(b, 1); continue; }
      const instant = off();
      let p = 1;
      if (!instant && !atBottom) {
        const r = blk.el.getBoundingClientRect();
        const top = blk.whole ? r.top - blk.offY : r.top;           // remove our own offset so the trigger does not feed back
        // Blocks near the end of the page can never scroll up to the usual trigger line, so shorten the range for them.
        const minTop = top + scrollY - maxScroll;
        const endTop = Math.min(Math.max(vh * 0.48, minTop + 8), vh * 0.9 - 24);
        p = clamp((vh * 0.9 - top) / (vh * 0.9 - endTop), 0, 1);
      }
      if (p <= 0 && !blk.active) continue;                          // not reached yet: nothing to draw
      const n = blk.units.length;
      let done = p >= 1;
      for (let i = 0; i < n; i++) {
        const start = n > 1 ? (i / (n - 1)) * 0.6 : 0;
        const target = instant ? 1 : clamp((p - start) / 0.4, 0, 1);
        const prev = blk.cur[i];
        const c = blk.cur[i] = instant ? 1 : lerp(prev, target, k);
        if (Math.abs(c - prev) > 0.0005) moving = true;
        if (c < 0.99) done = false;
        styleUnit(blk.units[i], easeOut(c < 0.99 ? c : 1));
      }
      blk.active = true;
      if (blk.whole) blk.offY = -(1 - easeOut(blk.cur[0])) * dist;
      if (done) { finish(blk); pending.splice(b, 1); }
    }
    return moving;
  }

  /* ------------------------------------------------------------ 2. 360 media */
  const spinners = new Set();
  const live = new Set();            // spinners that are not at rest

  function mediaOk(m) {
    if (m.__m3dSpin || m.closest(MEDIA_SKIP)) return false;
    const cs = getComputedStyle(m);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || cs.position === 'absolute') return false;
    if (cs.transform !== 'none' || (cs.animationName && cs.animationName !== 'none')) return false;
    const r = m.getBoundingClientRect();
    if (r.width < 140 || r.height < 110) return false;
    if (r.width > innerWidth * 0.98 && r.height > innerHeight * 0.7) return false;
    if (MEDIA_NAME_SKIP.test(`${m.className} ${m.getAttribute('src') || ''} ${m.getAttribute('alt') || ''}`)) return false;
    return true;
  }

  function adoptMedia(m) {
    if (spinners.size >= opts.maxMedia || !mediaOk(m)) return;
    const s = { el: m, yaw: 0, pitch: 0, vyaw: 0, hx: 0, hy: 0, hover: false, drag: false, lx: 0, lt: 0, moved: 0, rest: performance.now(), peeked: false, rested: true };
    m.__m3dSpin = s;
    spinners.add(s);
    m.classList.add('m3d-spin');
    m.setAttribute('draggable', 'false');
    const kick = () => { s.rested = false; live.add(s); wake(); };

    m.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { s.hover = true; kick(); } });
    m.addEventListener('pointerleave', () => { s.hover = false; s.rest = performance.now(); kick(); });
    m.addEventListener('pointermove', (e) => {
      const r = m.getBoundingClientRect();
      s.hx = (e.clientX - r.left) / r.width - 0.5; s.hy = (e.clientY - r.top) / r.height - 0.5;
      if (s.drag) {
        const now = performance.now(), dx = e.clientX - s.lx;
        s.yaw += dx * 0.55;
        s.vyaw = lerp(s.vyaw, (dx * 0.55) / Math.max(0.008, (now - s.lt) / 1000), 0.5);
        s.moved += Math.abs(dx); s.lx = e.clientX; s.lt = now;
      }
      kick();
    });
    m.addEventListener('pointerdown', (e) => {
      if (off() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (m.tagName === 'VIDEO' && m.controls) { const r = m.getBoundingClientRect(); if (e.clientY > r.bottom - 48) return; }
      s.drag = true; s.moved = 0; s.lx = e.clientX; s.lt = performance.now(); s.vyaw = 0;
      m.classList.add('m3d-grab');
      try { m.setPointerCapture(e.pointerId); } catch (_) { /* old browsers */ }
      kick();
    });
    const release = () => {
      if (!s.drag) return;
      s.drag = false; s.rest = performance.now(); m.classList.remove('m3d-grab');
      if (s.moved > 6) {                                               // it was a drag, not a click: do not follow links / toggle playback
        const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
        m.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => m.removeEventListener('click', swallow, { capture: true }), 60);
      }
      kick();
    };
    m.addEventListener('pointerup', release);
    m.addEventListener('pointercancel', release);
    m.addEventListener('dblclick', () => { if (!off()) { s.vyaw += (s.yaw > 0 ? -1 : 1) * 820; s.rest = performance.now(); kick(); } });

    // A small one-time wiggle the first time it scrolls into view, so people discover that it can be turned.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        es.forEach((en) => {
          if (en.isIntersecting && !s.peeked && !off()) {
            s.peeked = true; s.vyaw = 170; s.rest = performance.now(); kick(); io.disconnect();
          }
        });
      }, { threshold: 0.6 });
      io.observe(m);
    }
  }

  function stepMedia(dt, now, t) {
    live.forEach((s) => {
      if (!s.el.isConnected) { live.delete(s); spinners.delete(s); return; }
      if (off()) { s.yaw = s.pitch = s.vyaw = 0; s.el.style.removeProperty('transform'); live.delete(s); return; }
      let pitchT = 0, sway = 0;
      if (s.hover || s.drag) { pitchT = -s.hy * 10; sway = (s.hx * 9) + Math.sin(t * 0.9) * 2; }
      if (!s.drag) {
        s.yaw += s.vyaw * dt;
        s.vyaw *= Math.exp(-dt * 2.2);
        if (Math.abs(s.vyaw) < 20 && now - s.rest > 900) {            // settle to the nearest "front" orientation
          s.yaw = lerp(s.yaw, Math.round(s.yaw / 360) * 360, 1 - Math.exp(-dt * 4.5));
        }
      }
      s.pitch = lerp(s.pitch, pitchT, 1 - Math.exp(-dt * 8));
      const yaw = s.yaw + (s.drag ? 0 : sway);
      const rested = !s.hover && !s.drag && Math.abs(s.vyaw) < 20
        && Math.abs(s.yaw - Math.round(s.yaw / 360) * 360) < 0.05 && Math.abs(s.pitch) < 0.05;
      if (rested) {
        s.yaw = 0;
        s.el.style.removeProperty('transform'); s.rested = true; live.delete(s); return;
      }
      s.el.style.transform = `perspective(900px) rotateX(${s.pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`;
    });
  }

  /* ------------------------------------------------------------ discovery */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
    es.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); prepare(en.target); } });
  }, { rootMargin: '0px 0px 45% 0px' }) : null;

  function scan(rootEl) {
    if (opts.text && io) {
      rootEl.querySelectorAll(TEXT_BLOCKS).forEach((el) => {
        if (el.__m3dQ || el.closest(TEXT_SKIP)) return;
        el.__m3dQ = 1; io.observe(el);
      });
    }
    if (opts.media) {
      rootEl.querySelectorAll('img,video').forEach((m) => {
        if (m.__m3dSpin || m.__m3dWait) return;
        if (m.tagName === 'IMG' && !m.complete) { m.__m3dWait = 1; m.addEventListener('load', () => { m.__m3dWait = 0; adoptMedia(m); }, { once: true }); return; }
        adoptMedia(m);
      });
    }
  }

  let scanQueued = false;
  function queueScan() {
    if (scanQueued) return; scanQueued = true;
    setTimeout(() => { scanQueued = false; scan(doc.body); }, 120);
  }
  new MutationObserver(queueScan).observe(doc.body, { childList: true, subtree: true });
  addEventListener('load', () => setTimeout(() => scan(doc.body), 400));

  /* ------------------------------------------------------------ shared frame loop */
  let raf = 0, last = 0, quiet = 0;
  function frame(now) {
    raf = 0;
    if (doc.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    let moving = false;
    if (pending.length) moving = stepText(dt);
    if (live.size) stepMedia(dt, now, now / 1000);
    quiet = moving || live.size ? 0 : quiet + 1;
    if (quiet < 14) raf = requestAnimationFrame(frame); else last = 0;     // sleeps until the next scroll / pointer event
  }
  function wake() { quiet = 0; if (!raf && !doc.hidden) raf = requestAnimationFrame(frame); }
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', wake, { passive: true });
  doc.addEventListener('visibilitychange', wake);

  scan(doc.body);
}
