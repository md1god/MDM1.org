// Mecca 3D explorer — orchestration.
import { loadData } from './data.js';
import { Nav, routeProgress } from './nav.js';
import { World, Signs } from './world.js';
import { Car, Walker, CameraRig } from './entities.js';
import { Learn } from './learn.js';
import { Minimap, BigMap, Controls, Labels } from './ui.js';
import { $, clamp, store, fmtDist, fmtDistFine, bearingDeg, angDiff, norm } from './util.js';

const stage = $('stage');
if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
const settings = Object.assign({ hour: 14, quality: 'medium', mm: 1, signs: 1, hudn: 1, voice: 0 }, store.get('m3d_set', {}));
const saveSet = () => store.set('m3d_set', settings);

let toastT = 0;
function toast(msg, ms = 2400) {
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastT); toastT = setTimeout(() => (t.style.display = 'none'), ms);
}
const say = (txt) => {
  if (!settings.voice || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'ar-SA'; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
};

async function boot() {
  const D = await loadData('data/', (t, f) => { $('lt').textContent = t; $('lb').value = f; });
  $('lt').textContent = 'بناء العالم ثلاثي الأبعاد…';
  await new Promise((r) => setTimeout(r, 30));
  const nav = new Nav(D);
  const world = new World(stage, D, 'data/');
  world.setQuality(settings.quality); world.setTime(settings.hour);
  const signs = new Signs(world, nav); signs.enabled = !!settings.signs;
  const car = new Car(world), walker = new Walker(world);
  const rig = new CameraRig(world, car, walker);
  const learn = new Learn(D);
  const mini = new Minimap($('mini'), D);
  const labels = new Labels($('labels'), world);
  const ctl = new Controls(stage, rig);

  // ---------- state ----------
  const S = { mode: 'car', route: null, rIdx: 0, rStep: 0, off: 0, hl: null, curRoad: null, curDist: 99, curKey: null, curName: '', hood: '', lastSaved: 0, announced: -1, blind: false };
  const pos = () => (S.mode === 'walk' ? walker : S.mode === 'fly' ? { x: rig.fly.x, z: rig.fly.z, h: rig.fly.yaw } : car);

  function placeAll(x, z, h) {
    car.place(x, z, h);
    const [rx, rz] = [Math.cos(h), Math.sin(h)];
    walker.place(x + rx * 3, z + rz * 3, h);
    if (S.mode === 'fly') { rig.fly.x = x; rig.fly.z = z; }
    rig.snap = true; rig.camH = h; rig.yaw = h;
    world.update(x, z, 0); world.pump(60);
  }
  function roadHeading(x, z) {
    const n = D.idx.nearest(x, z, 300, { drv: true });
    if (!n) return 0;
    const p = n.road.pts, si = n.si;
    return (bearingDeg(p[si * 2 + 2] - p[si * 2], p[si * 2 + 3] - p[si * 2 + 1]) * Math.PI) / 180;
  }
  function teleport(x, z, snapRoad = true) {
    let tx = x, tz = z;
    if (snapRoad) { const n = D.idx.nearest(x, z, 150, { drv: true }); if (n) { tx = n.x; tz = n.z; } }
    placeAll(tx, tz, roadHeading(tx, tz));
    S.off = 0;
  }
  // start
  const saved = store.get('m3d_pos', null);
  if (saved && Math.abs(saved.x) < 6000 && Math.abs(saved.z) < 6000) { placeAll(saved.x, saved.z, saved.h || 0); }
  else {
    let b = null, bd = 1e18;
    for (const r of D.roads) {
      if (r.t > 5 || (r.fl & 3)) continue;
      for (let k = 0; k < r.pts.length; k += 2) { const d = Math.hypot(r.pts[k] - 150, r.pts[k + 1] - 350); if (d < bd) { bd = d; b = [r.pts[k], r.pts[k + 1]]; } }
    }
    teleport(b ? b[0] : 0, b ? b[1] : 260);
  }
  setTimeout(() => world.setTime(settings.hour), 0);

  // ---------- modes ----------
  function setMode(m) {
    if (m === S.mode) return;
    const prev = S.mode;
    if (m === 'walk') {
      if (prev === 'car' || prev === 'fly') {
        const base = prev === 'fly' ? { x: rig.fly.x, z: rig.fly.z, h: rig.fly.yaw } : car;
        if (prev === 'fly') car.place(base.x, base.z, base.h);
        walker.place(base.x + Math.cos(base.h) * 2.6, base.z + Math.sin(base.h) * 2.6, base.h);
      }
    } else if (m === 'car') {
      if (prev === 'walk') {
        const d = Math.hypot(walker.x - car.x, walker.z - car.z);
        if (d > 40) { car.place(walker.x - Math.cos(walker.h) * 4, walker.z - Math.sin(walker.h) * 4, walker.h); toast('🚗 تم استدعاء السيارة'); }
        else if (d > 9) { toast('اقترب من السيارة أو اضغط F مرة أخرى لاستدعائها'); S._call = true; return; }
        S._call = false;
      } else if (prev === 'fly') car.place(rig.fly.x, rig.fly.z, rig.fly.yaw);
    }
    rig.prevMode = prev; S.mode = m; rig.setMode(m);
    if (m === 'walk') rig.yaw = walker.h;
    refreshBar();
  }
  function onF() {
    if (S.mode === 'car') setMode('walk');
    else if (S.mode === 'walk') {
      if (S._call) { car.place(walker.x - Math.cos(walker.h) * 4, walker.z - Math.sin(walker.h) * 4, walker.h); S._call = false; }
      setMode('car');
    } else setMode('car');
  }
  function refreshBar() {
    $('b_mode').innerHTML = S.mode === 'walk' ? '🚶<small>مشي</small>' : '🚗<small>سيارة</small>';
    $('b_fly').classList.toggle('on', S.mode === 'fly');
  }

  // ---------- panels ----------
  const panels = ['gps', 'learn', 'set', 'help'];
  function openPanel(id) {
    for (const p of panels) $(p).style.display = p === id && $(p).style.display !== 'block' ? 'block' : 'none';
    $('b_gps').classList.toggle('on', $('gps').style.display === 'block');
    $('b_learn').classList.toggle('on', $('learn').style.display === 'block');
    if ($('learn').style.display === 'block') renderProgress();
    if ($('gps').style.display === 'block') renderSteps();
  }

  // ---------- big map ----------
  const big = new BigMap($('bmc'), D, { onSelect: (s) => {
    $('bmn').textContent = s.name || 'نقطة على الخريطة'; $('bmh').textContent = s.hood ? 'حي ' + s.hood.replace(/^حي\s+/, '') : '';
    $('bmcard').style.display = 'block';
  } });
  function openMap(o) {
    big.setOpen(o, pos().x, pos().z);
    $('bmcard').style.display = 'none'; big.sel = null;
  }
  $('bm_close').onclick = () => openMap(false);
  $('bm_me').onclick = () => { big.cx = pos().x; big.cz = pos().z; big.dirty = true; };
  $('bm_kaaba').onclick = () => { big.cx = 0; big.cz = 0; big.dirty = true; };
  $('bm_in').onclick = () => big.zoom(1.4); $('bm_out').onclick = () => big.zoom(1 / 1.4);
  $('bm_route').onclick = () => { if (big.sel) { openMap(false); routeTo({ x: big.sel.x, z: big.sel.z, name: big.sel.name || 'الوجهة' }); } };
  $('bm_tp').onclick = () => { if (big.sel) { teleport(big.sel.x, big.sel.z); openMap(false); toast('📍 تم الانتقال'); } };

  // ---------- routing ----------
  function routeTo(goal) {
    const p = pos(), foot = S.mode === 'walk';
    const r = nav.route({ x: p.x, z: p.z }, goal, foot);
    if (!r) { toast('تعذّر إيجاد طريق إلى هذه الوجهة'); return false; }
    setRoute(r, goal);
    return true;
  }
  function setRoute(r, goal) {
    S.route = r; S.rIdx = 0; S.rStep = 0; S.off = 0; S.announced = -1; S.goalInfo = goal;
    world.setRoute(r);
    renderSteps(); updateBanner(true);
    toast('🧭 ' + goal.name + ' — ' + fmtDist(r.total) + ' (~' + Math.max(1, Math.round(r.total / (S.mode === 'walk' ? 1.4 : 14) / 60)) + ' د)');
  }
  function clearRoute() { S.route = null; world.setRoute(null); $('banner').style.display = 'none'; renderSteps(); }
  $('bx').onclick = clearRoute; $('g_clear').onclick = clearRoute;
  $('g_voice').onclick = () => { settings.voice = settings.voice ? 0 : 1; saveSet(); $('g_voice').textContent = '🔊 الإرشاد الصوتي: ' + (settings.voice ? 'تشغيل' : 'إيقاف'); };
  $('g_voice').textContent = '🔊 الإرشاد الصوتي: ' + (settings.voice ? 'تشغيل' : 'إيقاف');
  $('g_here').onclick = () => {
    const p = pos(), r = nav.route({ x: 0, z: 60 }, { x: p.x, z: p.z, name: S.curName || 'موقعك' }, S.mode === 'walk');
    if (r) setRoute(r, { x: p.x, z: p.z, name: S.curName || 'موقعك' }); else toast('لا يوجد طريق');
  };
  function renderSteps() {
    const ul = $('steps'); ul.textContent = '';
    if (!S.route) { $('gpsinfo').textContent = 'لا يوجد مسار. ابحث عن وجهة أو اضغط على الخريطة الكبيرة (M) ثم «اتجاهات».'; return; }
    $('gpsinfo').textContent = 'إلى ' + S.goalInfo.name + ' — ' + fmtDist(S.route.total);
    S.route.steps.forEach((st, i) => {
      const li = document.createElement('li'); li.className = i < S.rStep ? 'done' : i === S.rStep ? 'cur' : '';
      const t = document.createElement('div'); t.textContent = st.text || 'استمر'; const d = document.createElement('span'); d.textContent = st.meters ? fmtDist(st.meters) : '';
      li.append(t, d); ul.appendChild(li);
    });
  }
  function updateBanner(force) {
    const r = S.route; if (!r) return;
    const steps = r.steps; let i = S.rStep;
    const along = S._along || 0;
    while (i < steps.length - 1 && steps[i + 1].dist <= along + 3 && steps[i].kind !== 'arrive') i++;
    // next maneuver is the first step ahead (dist > along)
    let nx = i + 1; while (nx < steps.length - 1 && steps[nx].text == null) nx++;
    nx = Math.min(nx, steps.length - 1);
    if (i !== S.rStep || force) { S.rStep = i; if (!force) renderSteps(); }
    const nxt = steps[nx], rem = Math.max(0, nxt.dist - along);
    $('banner').style.display = 'block';
    $('bt').textContent = (nxt.kind === 'arrive' ? '🏁 ' : arrow(nxt.kind) + ' ') + (nxt.text || 'استمر');
    $('bs').textContent = (nxt.kind === 'arrive' ? '' : 'بعد ' + fmtDistFine(rem) + ' — ') + 'المتبقي ' + fmtDist(Math.max(0, r.total - along));
    const bucket = rem < 40 ? 2 : rem < 220 ? 1 : 0, id = nx * 3 + bucket;
    if (id !== S.announced && nxt.text) { S.announced = id; if (bucket >= 1 || nxt.kind === 'arrive') say((bucket === 1 ? 'بعد ' + fmtDistFine(rem) + ' ' : '') + nxt.text); }
  }
  const arrow = (k) => ({ right: '↱', left: '↰', 'slight-right': '↗', 'slight-left': '↖', uturn: '↶', roundabout: '⟳', exit: '⟳', straight: '⬆', start: '▶' }[k] || '⬆');

  // ---------- search ----------
  const q = $('q'), res = $('res');
  const icon = { street: '🛣', hood: '🏘', landmark: '📌' };
  function doSearch() {
    const v = q.value.trim(); res.textContent = '';
    if (!v) { res.style.display = 'none'; return; }
    const items = D.searchItems(v, 9);
    if (!items.length) { res.style.display = 'block'; res.innerHTML = '<div class="ri"><div class="n"><small>لا نتائج في بيانات الخريطة</small></div></div>'; return; }
    res.style.display = 'block';
    for (const it of items) {
      const d = document.createElement('div'); d.className = 'ri';
      const n = document.createElement('div'); n.className = 'n';
      n.innerHTML = '<b></b><small></small>'; n.firstChild.textContent = icon[it.type] + ' ' + it.name;
      n.lastChild.textContent = (it.type === 'street' ? 'شارع' : it.type === 'hood' ? 'حي/منطقة' : 'معلم') + (it.hood ? ' — ' + it.hood : '');
      const b1 = document.createElement('button'); b1.textContent = '🧭'; b1.title = 'اتجاهات';
      const b2 = document.createElement('button'); b2.textContent = '📍'; b2.title = 'انتقال';
      const goal = () => {
        let g = { x: it.x, z: it.z, name: it.name };
        if (it.type === 'street') { const p = nav.nearestOnStreet(it.key, pos().x, pos().z); if (p) g = { x: p.x, z: p.z, name: it.name }; }
        return g;
      };
      b1.onclick = () => { routeTo(goal()); res.style.display = 'none'; q.blur(); };
      b2.onclick = () => { const g = goal(); teleport(g.x, g.z); res.style.display = 'none'; q.blur(); toast('📍 ' + it.name); };
      d.append(n, b1, b2); res.appendChild(d);
    }
  }
  q.addEventListener('input', doSearch);
  q.addEventListener('focus', doSearch);
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#sw')) res.style.display = 'none'; });

  // ---------- learning ----------
  const scopeSel = $('l_scope');
  scopeSel.innerHTML = '<option value="major">الشوارع والطرق الرئيسية</option><option value="all">كل الشوارع</option>';
  const hoodNames = Array.from(new Set(Array.from(D.streets.values()).filter((s) => s.hood && s.drv).map((s) => s.hood)));
  hoodNames.sort((a, b) => a.localeCompare(b, 'ar')).forEach((h) => { const o = document.createElement('option'); o.value = 'hood:' + h; o.textContent = 'حي: ' + h.replace(/^حي\s+/, ''); scopeSel.appendChild(o); });
  scopeSel.value = store.get('m3d_scope', 'major'); if (!scopeSel.value) scopeSel.value = 'major';
  $('l_assist').value = String(store.get('m3d_assist', 2));
  scopeSel.onchange = () => store.set('m3d_scope', scopeSel.value);
  $('l_assist').onchange = () => store.set('m3d_assist', +$('l_assist').value);

  document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    $('l_train').style.display = b.dataset.t === 'train' ? 'block' : 'none'; $('l_prog').style.display = b.dataset.t === 'prog' ? 'block' : 'none';
    if (b.dataset.t === 'prog') renderProgress();
  }));
  function renderProgress() {
    const t = learn.totals(), box = $('l_prog');
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    let h = `<h3>تقدّمك</h3><div class="hrow">شوارع أتقنتها: <b>${t.known}</b> / ${t.total} (${pct(t.known, t.total)}%)<div class="bar"><i style="width:${pct(t.known, t.total)}%"></i></div></div>
      <div class="hrow">شوارع زرتها: <b>${t.seen}</b> / ${t.total}<div class="bar"><i class="s" style="width:${pct(t.seen, t.total)}%"></i></div></div><h3 style="margin-top:12px">حسب الحي</h3>`;
    for (const r of learn.progress().slice(0, 30)) {
      h += `<div class="hrow">${r.hood.replace(/^حي\s+/, '')} — أتقنت ${r.known}/${r.total} · زرت ${r.seen}<div class="bar"><i style="width:${pct(r.known, r.total)}%"></i></div></div>`;
    }
    box.innerHTML = h;
  }
  function showTask() {
    const t = learn.task, card = $('task');
    if (!t) { card.style.display = 'none'; S.blind = false; world.clearBeacon(); if (!S.route) world.setRoute(null); return; }
    card.style.display = 'block';
    $('tk_a').style.display = t.type === 'name' ? 'block' : 'none';
    $('tk_show').style.display = t.type === 'name' ? 'none' : '';
    $('tk_t').textContent = t.type === 'goto' ? '🚗 اذهب إلى: ' + t.name : '❓ ما اسم الشارع الذي أنت فيه؟';
    $('tk_h').textContent = t.type === 'goto' && t.assist >= 3 ? learn.hintText(pos().x, pos().z) : '';
    S.blind = t.type === 'name';
  }
  function startTask(type) {
    const task = learn.startTask(scopeSel.value, type);
    if (!task) { toast('لا توجد شوارع كافية في هذا النطاق'); return; }
    task.assist = +$('l_assist').value;
    if (type === 'goto') {
      if (task.assist === 3) task.hints = Math.max(task.hints, 1);
      if (task.assist >= 4) task.hints = 2;
      if (task.assist >= 4) revealTask();
    } else {
      const p = nav.nearestOnStreet(task.key, pos().x, pos().z) || { x: task.street.mx, z: task.street.mz };
      if (S.mode === 'fly') setMode('car');
      teleport(p.x, p.z); clearRoute();
      $('tk_in').value = '';
    }
    showTask();
    if (type === 'goto') $('tk_h').textContent = task.assist >= 3 ? learn.hintText(pos().x, pos().z) : 'استخدم 💡 للتلميح عند الحاجة';
    if (window.innerWidth < 700) $('learn').style.display = 'block';
  }
  function revealTask() {
    const t = learn.task; if (!t) return;
    const p = nav.nearestOnStreet(t.key, pos().x, pos().z);
    if (p) { routeTo({ x: p.x, z: p.z, name: t.name }); world.setHighlight(t.street.ri); S.hl = t.street.ri; }
  }
  function finishTask(success) {
    const t = learn.task; if (!t) return;
    const r = learn.finish(success);
    const names = ['', 'ستعود قريباً', 'ممتاز', 'جيد جداً', 'متقن!', 'محفوظ تماماً'];
    toast((success ? '✅ ' : '❌ ') + t.name + (r ? ' — ' + (r.box >= 1 ? names[r.box] : 'سنكرّره قريباً') : ''), 3200);
    world.setHighlight(null); S.hl = null; learn.stopTask(); clearRoute(); showTask(); big.discDirty = true; renderProgress();
  }
  $('l_goto').onclick = () => startTask('goto');
  $('l_name').onclick = () => startTask('name');
  $('tk_hint').onclick = () => { const t = learn.task; if (!t) return; t.hints++; $('tk_h').textContent = '💡 ' + learn.hintText(pos().x, pos().z) + (t.type === 'name' && t.hints > 1 ? ' — يبدأ بـ «' + t.name.replace(/^(شارع|طريق)\s+/, '').slice(0, 3) + '…»' : ''); };
  $('tk_show').onclick = () => { const t = learn.task; if (!t) return; t.hints = 2; revealTask(); };
  $('tk_skip').onclick = () => { if (learn.task) { const ty = learn.task.type; learn.stopTask(); world.setHighlight(null); clearRoute(); startTask(ty); } };
  $('tk_end').onclick = () => { learn.stopTask(); world.setHighlight(null); S.hl = null; clearRoute(); showTask(); };
  const submitAns = () => {
    const t = learn.task; if (!t || t.type !== 'name') return;
    const v = $('tk_in').value; if (!v.trim()) return;
    if (learn.checkAnswer(v)) finishTask(true);
    else { t.hints = Math.max(t.hints, 2); toast('❌ ليست الإجابة الصحيحة — جرّب مرة أخرى أو اطلب تلميحاً', 2600); $('tk_in').select(); }
  };
  $('tk_ok').onclick = submitAns;
  $('tk_in').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAns(); e.stopPropagation(); });
  // "give up" for name task = hint level 3 reveal
  $('s_reset').onclick = () => { if (confirm('مسح كل تقدّم التعلّم والشوارع المكتشفة؟')) { learn.reset(); big.discDirty = true; renderProgress(); toast('تم المسح'); } };

  // ---------- settings ----------
  $('s_t').value = settings.hour; $('s_tv').textContent = fmtHour(settings.hour);
  $('s_t').oninput = (e) => { settings.hour = +e.target.value; $('s_tv').textContent = fmtHour(settings.hour); world.setTime(settings.hour); saveSet(); };
  function fmtHour(h) { const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60); return (hh % 12 || 12) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' ص' : ' م'); }
  $('s_q').value = settings.quality; $('s_q').onchange = (e) => { settings.quality = e.target.value; world.setQuality(settings.quality); saveSet(); };
  $('s_mm').value = String(settings.mm); $('s_mm').onchange = (e) => { settings.mm = +e.target.value; saveSet(); };
  const refreshToggles = () => { $('s_signs').textContent = '🪧 لوحات التقاطعات: ' + (settings.signs ? 'تشغيل' : 'إيقاف'); $('s_hudn').textContent = '🏷 اسم الشارع: ' + (settings.hudn ? 'ظاهر' : 'مخفي (تحدٍّ)'); };
  $('s_signs').onclick = () => { settings.signs = settings.signs ? 0 : 1; signs.enabled = !!settings.signs; saveSet(); refreshToggles(); };
  $('s_hudn').onclick = () => { settings.hudn = settings.hudn ? 0 : 1; saveSet(); refreshToggles(); };
  $('s_help').onclick = () => openPanel('help');
  refreshToggles();

  // ---------- buttons / keys ----------
  $('b_mode').onclick = onF; $('b_cam').onclick = () => rig.cycleView();
  $('b_fly').onclick = () => setMode(S.mode === 'fly' ? 'car' : 'fly');
  $('b_map').onclick = () => openMap(true);
  $('b_gps').onclick = () => openPanel('gps'); $('b_learn').onclick = () => openPanel('learn'); $('b_set').onclick = () => openPanel('set');
  const hold = (id, fn) => { const b = $(id); b.addEventListener('pointerdown', (e) => { fn(true); e.preventDefault(); }); b.addEventListener('pointerup', () => fn(false)); b.addEventListener('pointerleave', () => fn(false)); };
  hold('t_brake', (v) => (ctl.brakeBtn = v)); hold('t_run', (v) => (ctl.runBtn = v));
  $('t_f').onclick = onF;
  ctl.onAction = (k) => {
    if (big.open) { if (k === 'escape' || k === 'm') openMap(false); return; }
    if (k === 'f') onF(); else if (k === 'c') rig.cycleView(); else if (k === 'v') setMode(S.mode === 'fly' ? 'car' : 'fly');
    else if (k === 'm') openMap(true); else if (k === 'g') openPanel('gps'); else if (k === 'l') openPanel('learn');
    else if (k === 't') { teleport(0, 200); toast('🕋 الكعبة المشرفة'); } else if (k === 'escape') for (const p of panels) $(p).style.display = 'none';
    else if (k === 'h') openPanel('help');
  };
  if (!store.get('m3d_help', 0)) { store.set('m3d_help', 1); setTimeout(() => { $('help').style.display = 'block'; setTimeout(() => { $('help').style.display = 'none'; }, 9000); }, 800); }

  // ---------- main loop ----------
  $('load').style.display = 'none';
  let last = performance.now(), frame = 0, infoT = 0;
  const hdr = { street: $('st'), hood: $('hd'), sp: $('sp'), arrow: $('harrow'), hd: $('hdist') };
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; frame++;
    const inp = ctl.read();
    const camYaw = rig.mode === 'walk' ? rig.yaw : walker.h;
    car.update(dt, inp, S.mode === 'car');
    walker.update(dt, inp, rig.yaw, S.mode === 'walk');
    rig.update(dt, inp);
    const p = pos();
    world.update(p.x, p.z, dt);
    if (settings.signs && S.mode !== 'fly') signs.update(p.x, p.z);
    labels.update(p.x, p.z, dt);

    infoT += dt;
    if (infoT > 0.2) {
      infoT = 0;
      const n = D.idx.nearest(p.x, p.z, 30, { named: true });
      S.curRoad = n ? n.road : null; S.curDist = n ? n.d : 99; S.curKey = n ? n.road.key : null; S.curName = n ? n.road.name : '';
      const h = D.nearestHood(p.x, p.z); S.hood = h ? h.n : '';
      if (S.mode !== 'fly' && n && n.d <= n.road.width * 0.5 + 4 && n.road.t <= 7 && learn.markSeen(n.road.key)) big.discDirty = true;
      const hide = S.blind || !settings.hudn;
      hdr.street.textContent = hide ? '؟؟؟' : S.curName && S.curDist < 25 ? S.curName : '—';
      hdr.hood.textContent = hide ? '' : S.hood ? 'حي ' + S.hood.replace(/^حي\s+/, '') : '';
      const spd = S.mode === 'car' ? Math.abs(car.v) * 3.6 : S.mode === 'walk' ? Math.abs(walker.v) * 3.6 : 0;
      hdr.sp.textContent = S.mode === 'fly' ? '🛰 وضع علوي' : Math.round(spd) + ' كم/س' + (S.mode === 'car' && car.offRoad ? ' · خارج الطريق' : '');
      const bk = bearingDeg(-p.x, -p.z), hd = (rig.heading() * 180) / Math.PI;
      hdr.arrow.style.transform = `rotate(${angDiff(hd, bk)}deg)`; hdr.hd.textContent = 'الكعبة ' + fmtDist(Math.hypot(p.x, p.z));
      // route progress
      if (S.route) {
        const pr = routeProgress(S.route, p.x, p.z, S.rIdx);
        S.rIdx = pr.idx; S._along = pr.along;
        if (pr.off > 45 && S.mode !== 'fly') { S.off += 0.2; if (S.off > 2.5) { S.off = 0; const foot = S.mode === 'walk'; const r = nav.route({ x: p.x, z: p.z }, S.goalInfo, foot); if (r) { const g = S.goalInfo; setRoute(r, g); toast('↻ إعادة حساب المسار', 1500); } } } else S.off = 0;
        if (S.route && S.route.total - pr.along < 22) { toast('🏁 وصلت إلى ' + S.goalInfo.name, 3000); say('وصلت إلى وجهتك'); const t = learn.task; clearRoute(); if (t && t.type === 'goto') { /* goto success is street-based */ } }
        else updateBanner(false);
      }
      // learning
      const t = learn.task;
      if (t && t.type === 'goto') {
        if (learn.check(S.curKey, S.curDist) && S.mode !== 'fly') finishTask(true);
        else if (t.assist >= 3 || t.hints > 0) $('tk_h').textContent = learn.hintText(p.x, p.z);
      }
      if (frame % 150 === 0 || now - S.lastSaved > 5000) { S.lastSaved = now; store.set('m3d_pos', { x: Math.round(car.x), z: Math.round(car.z), h: +car.h.toFixed(2) }); }
    }
    if (frame % 2 === 0) {
      mini.scale = S.mode === 'car' ? clamp(0.55 - Math.abs(car.v) / 36 * 0.28, 0.25, 0.55) : S.mode === 'fly' ? 0.2 : 0.7;
      mini.draw(p.x, p.z, rig.heading(), S.route, S.hl, !!settings.mm && !S.blind);
    }
    if (big.open) big.draw({ x: p.x, z: p.z, h: S.mode === 'fly' ? rig.fly.yaw : p.h || 0, route: S.route, hl: S.hl, seen: learn.seen });
    world.render();
  }
  requestAnimationFrame(loop);
  window.__m3d = { D, world, car, walker, rig, nav, learn, S, teleport, setMode, routeTo };
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
}

boot().catch((e) => { console.error(e); $('lt').textContent = '⚠️ تعذّر تحميل المدينة: ' + e.message; $('lb').style.display = 'none'; });
