/* Draggable floating buttons, shared by mdm1.org (bundled into js/mdm1-3d.js) and md1usd.com (src/utils/drag.ts copy).
 *
 * Every matching fixed-position button (menu, language, music, 3D toggle ...) can be dragged anywhere on screen
 * with a finger or the mouse. A plain tap or click still works exactly as before; moving more than a few pixels
 * starts a drag and the click that follows it is swallowed. Positions are remembered between pages and visits
 * (as fractions of the viewport, so they survive rotation / resizing) and are always clamped inside the screen.
 *
 * Panels that belong to a button (menu list, language picker) are re-anchored next to the button every time they
 * open or the button moves: they open upward or downward depending on the free space, are aligned to the side the
 * button is on, and get a max-height that fits the screen, so the whole list is always reachable.
 *
 * Independent of the 3D effects toggle and of prefers-reduced-motion (moving a control is an accessibility
 * feature, not decoration).
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const KEY = 'mdm1-btn-pos';
const MARGIN = 6;
const GAP = 8;
const THRESHOLD = 7;

const CSS = `
.m3d-drag{touch-action:none;-webkit-user-select:none;user-select:none;cursor:grab;-webkit-touch-callout:none}
.m3d-dragging{cursor:grabbing!important;z-index:1000!important}
`;

export function initDrag(opts = {}) {
  if (typeof window === 'undefined' || window.__m3dDrag) return;
  window.__m3dDrag = true;

  const doc = document;
  const sel = opts.sel || '[data-drag]';
  const panelFor = opts.panels || {};       // button id -> panel selector

  const st = doc.createElement('style');
  st.id = 'm3d-drag-css'; st.textContent = CSS;
  doc.head.appendChild(st);

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* private mode */ } };

  const items = new Map();                  // button -> id
  const watched = new WeakSet();            // panels already observed
  const idOf = (el) => el.id || el.getAttribute('data-drag');

  function put(el, x, y) {
    const s = el.style;
    s.setProperty('left', `${Math.round(x)}px`, 'important');
    s.setProperty('top', `${Math.round(y)}px`, 'important');
    s.setProperty('right', 'auto', 'important');
    s.setProperty('bottom', 'auto', 'important');
  }

  function fit(el, x, y) {
    const w = el.offsetWidth || 48, h = el.offsetHeight || 48;
    return [clamp(x, MARGIN, Math.max(MARGIN, innerWidth - w - MARGIN)), clamp(y, MARGIN, Math.max(MARGIN, innerHeight - h - MARGIN))];
  }

  function restore(el) {
    const p = saved[idOf(el)];
    if (!p) return;
    const w = el.offsetWidth || 48, h = el.offsetHeight || 48;
    const [x, y] = fit(el, p.fx * innerWidth - w / 2, p.fy * innerHeight - h / 2);
    put(el, x, y);
  }

  /* ---------------------------------------------------------------- panels */
  function place(btn) {
    const pSel = panelFor[idOf(btn)];
    const panel = pSel && doc.querySelector(pSel);
    if (!panel) return;
    if (getComputedStyle(panel).display === 'none') return;           // not open yet: the next class change places it
    const r = btn.getBoundingClientRect();
    if (r.width < 4) return;
    const cs = getComputedStyle(panel);
    const pw = panel.offsetWidth || Math.min(innerWidth * 0.78, 260);
    const s = panel.style;
    const rightSide = r.left + r.width / 2 > innerWidth / 2;
    const left = clamp(rightSide ? r.right - pw : r.left, MARGIN, Math.max(MARGIN, innerWidth - pw - MARGIN));
    const above = r.top - GAP - MARGIN, below = innerHeight - r.bottom - GAP - MARGIN;
    const up = above >= below;
    const room = Math.max(140, Math.floor(up ? above : below));
    s.setProperty('left', `${Math.round(left)}px`, 'important');
    s.setProperty('right', 'auto', 'important');
    if (up) { s.setProperty('bottom', `${Math.round(innerHeight - r.top + GAP)}px`, 'important'); s.setProperty('top', 'auto', 'important'); }
    else { s.setProperty('top', `${Math.round(r.bottom + GAP)}px`, 'important'); s.setProperty('bottom', 'auto', 'important'); }
    s.setProperty('max-height', `${room}px`, 'important');
    s.setProperty('height', 'auto', 'important');          // page-level `nav{height:..}` rules must not squash the list
    s.setProperty('min-height', '0', 'important');
    s.setProperty('z-index', '1001', 'important');         // above every floating button, including the one being dragged
    if (cs.overflowY === 'visible') s.setProperty('overflow-y', 'auto', 'important');
  }

  function watchPanel(btn) {
    const pSel = panelFor[idOf(btn)];
    const panel = pSel && doc.querySelector(pSel);
    if (!panel || watched.has(panel)) return;
    watched.add(panel);
    new MutationObserver(() => place(btn)).observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  /* ---------------------------------------------------------------- dragging */
  function adopt(el) {
    if (items.has(el) || el.hidden || !idOf(el)) return;
    items.set(el, idOf(el));
    el.classList.add('m3d-drag');
    restore(el);
    watchPanel(el);

    let g = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      g = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, ox: el.offsetLeft, oy: el.offsetTop, moved: false };
      // A mouse leaves a 48px button on the very first move; capture from the start so the drag keeps receiving events.
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* old browsers */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (!g || e.pointerId !== g.pid) return;
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      if (!g.moved) {
        if (Math.hypot(dx, dy) < THRESHOLD) return;
        g.moved = true;
        el.classList.add('m3d-dragging');
      }
      const [x, y] = fit(el, g.ox + dx, g.oy + dy);
      put(el, x, y);
      place(el);
    });
    const end = (e) => {
      if (!g || e.pointerId !== g.pid) return;
      const { moved, sx, sy, ox, oy } = g;
      g = null;
      el.classList.remove('m3d-dragging');
      if (!moved) return;
      // Browsers coalesce pointermove events; on a fast flick the last move may never arrive, so use the release point.
      const [fx, fy] = fit(el, ox + (e.clientX - sx), oy + (e.clientY - sy));
      put(el, fx, fy); place(el);
      const w = el.offsetWidth || 48, h = el.offsetHeight || 48;
      saved[idOf(el)] = { fx: +((el.offsetLeft + w / 2) / innerWidth).toFixed(4), fy: +((el.offsetTop + h / 2) / innerHeight).toFixed(4) };
      persist();
      const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 120);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function scan() {
    doc.querySelectorAll(sel).forEach(adopt);
    items.forEach((_, el) => { if (!el.isConnected) items.delete(el); else watchPanel(el); });
  }

  scan();
  new MutationObserver(scan).observe(doc.body, { childList: true });
  [500, 1500, 4000].forEach((ms) => setTimeout(scan, ms));      // buttons injected late by other scripts
  addEventListener('resize', () => items.forEach((_, el) => { restore(el); place(el); }), { passive: true });
  addEventListener('orientationchange', () => setTimeout(() => items.forEach((_, el) => { restore(el); place(el); }), 250));
}
