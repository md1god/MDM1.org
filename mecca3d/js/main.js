// Mecca 3D explorer — orchestration.
import { loadData } from './data.js';
import { Nav, routeProgress } from './nav.js';
import { World, Signs, HoodSigns } from './world.js';
import { Car, Walker, CameraRig } from './entities.js';
import { Learn } from './learn.js';
import { Contrib, Pins } from './contrib.js';
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
  const hoodSigns = new HoodSigns(world);
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
  const panels = ['gps', 'learn', 'set', 'help', 'contrib'];
  function openPanel(id) {
    for (const p of panels) $(p).style.display = p === id && $(p).style.display !== 'block' ? 'block' : 'none';
    $('b_gps').classList.toggle('on', $('gps').style.display === 'block');
    $('b_learn').classList.toggle('on', $('learn').style.display === 'block');
    if ($('learn').style.display === 'block') renderProgress();
    if ($('gps').style.display === 'block') renderSteps();
    if ($('contrib').style.display === 'block') renderContrib();
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
  q.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const b = res.querySelector('.ri button'); if (b) b.click(); } });
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
  $('s_help').onclick = () => openPanel('help'); $('help').onclick = () => { $('help').style.display = 'none'; };
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
    else if (k === 'p') setAuto(!S.auto); else if (k === 'o') (S.tour ? setAuto(false) : startTour()); else if (k === 'k') openPanel('contrib'); else if (k === 'm') openMap(true); else if (k === 'g') openPanel('gps'); else if (k === 'l') openPanel('learn');
    else if (k === 't') { teleport(0, 200); toast('🕋 الكعبة المشرفة'); } else if (k === 'escape') for (const p of panels) $(p).style.display = 'none';
    else if (k === 'h') openPanel('help');
  };
  if (!store.get('m3d_help', 0)) { store.set('m3d_help', 1); setTimeout(() => { $('help').style.display = 'block'; setTimeout(() => { $('help').style.display = 'none'; }, 9000); }, 800); }



  // ---------- community contributions ----------
  const contrib = new Contrib(D);
  const pins = new Pins($('pins'), world, (it) => openPin(it));
  contrib.init();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KIND = { rename: '✏️ اسم مقترح', note: '💬 ملاحظة', photo: '📷 صورة' }, STAT = { pending: '⏳ قيد المراجعة', approved: '✅ معتمدة', rejected: '⛔ مرفوضة' };
  function openPin(it) {
    $('pci').style.display = it.url ? 'block' : 'none'; if (it.url) $('pci').src = it.url;
    $('pct').textContent = it.body; $('pcm').textContent = (KIND[it.kind] || '') + (it.street_name ? ' — ' + it.street_name : '') + ' · مساهمة من مستخدم';
    $('pcard').style.display = 'block';
  }
  $('pcx').onclick = () => { $('pcard').style.display = 'none'; };
  function ctLabels() {
    const k = $('ct_kind').value;
    $('ct_lab').textContent = k === 'rename' ? 'الاسم المقترح لهذا الشارع' : k === 'note' ? 'ملاحظتك' : 'وصف قصير للصورة';
    $('ct_pick').style.display = k === 'photo' ? '' : 'none';
    $('ct_text').placeholder = k === 'rename' ? 'مثال: شارع إبراهيم الخليل' : k === 'note' ? 'مثال: هذا التقاطع مزدحم بعد صلاة العشاء' : 'مثال: مدخل نفق أجياد من جهة الحرم';
  }
  $('ct_kind').onchange = ctLabels;
  $('ct_pick').onclick = () => $('ct_file').click();
  $('ct_file').onchange = () => { const f = $('ct_file').files[0]; $('ct_pick').textContent = f ? '📷 ' + f.name.slice(0, 22) : '📷 اختر / التقط صورة'; };
  async function renderContrib() {
    ctLabels();
    const p = pos();
    $('ct_where').textContent = 'موقعك: ' + (S.curName && S.curDist < 30 ? S.curName : 'خارج الشوارع المسمّاة') + (S.hood ? ' — حي ' + S.hood.replace(/^حي\s+/, '') : '');
    const near = contrib.nearby(p.x, p.z, 600).slice(0, 8);
    $('ct_near').innerHTML = !contrib.ready ? '<span style="color:var(--mu)">المساهمات المعتمدة ستظهر هنا عند تفعيل الخدمة.</span>' : near.length ? near.map(([d, it]) => `<div class="hrow">${KIND[it.kind]} — ${esc(it.body).slice(0, 80)} <span style="color:var(--mu)">(${fmtDist(d)})</span></div>`).join('') : '<span style="color:var(--mu)">لا مساهمات معتمدة قريبة بعد.</span>';
    try {
      const mine = await contrib.loadMine();
      $('ct_mine').innerHTML = mine.length ? mine.slice(0, 8).map((it) => `<div class="hrow">${KIND[it.kind]} — ${esc(it.body).slice(0, 60)} <span style="color:var(--mu)">${STAT[it.status] || ''}</span></div>`).join('') : '<span style="color:var(--mu)">لم ترسل شيئاً بعد.</span>';
    } catch (e) { $('ct_mine').innerHTML = '<span style="color:var(--mu)">سجّل الدخول لترى مساهماتك.</span>'; }
  }
  $('ct_send').onclick = async () => {
    const kind = $('ct_kind').value, body = $('ct_text').value.trim(), p = pos(), msg = $('ct_msg');
    if (!body) { msg.textContent = 'اكتب النص أولاً'; return; }
    if (kind === 'rename' && !(S.curKey && S.curDist < 30)) { msg.textContent = 'قف على الشارع المقصود أولاً ليُسجَّل اسمه'; return; }
    msg.textContent = 'جارٍ الإرسال…'; $('ct_send').disabled = true;
    try {
      const r = await Promise.race([new Promise((res) => setTimeout(() => res({ error: 'الخدمة غير متاحة الآن، حاول لاحقاً' }), 30000)), contrib.submit({ kind, body, x: p.x, z: p.z, street_key: S.curKey || null, street_name: S.curName || null, file: $('ct_file').files[0] })]);
      if (r.needLogin) {
        msg.textContent = 'سجّل الدخول أولاً من الزر الذهبي 👤 ثم أعد الإرسال';
        const host = document.getElementById('mdm1a-host'), fab = host && host.shadowRoot && host.shadowRoot.querySelector('.fab'); if (fab) fab.click();
      } else if (r.error) msg.textContent = r.error;
      else { msg.textContent = '✅ شكراً! وصلت مساهمتك وستظهر بعد المراجعة'; $('ct_text').value = ''; $('ct_file').value = ''; $('ct_pick').textContent = '📷 اختر / التقط صورة'; renderContrib(); }
    } catch (e) { msg.textContent = 'الخدمة غير متاحة الآن، حاول لاحقاً'; }
    $('ct_send').disabled = false;
  };
  $('b_contrib').onclick = () => openPanel('contrib');

  // ---------- autopilot ----------
  S.auto = false; S.cruise = false;
  const endsCache = new Map();
  function streetEnds(st) {
    if (endsCache.has(st.key)) return endsCache.get(st.key);
    const pts = [];
    for (const ri of st.ri) { const r = D.roads[ri]; if (r.t > 7 || r.pts.length < 4) continue; pts.push([r.pts[0], r.pts[1]], [r.pts[r.pts.length - 2], r.pts[r.pts.length - 1]]); if (pts.length > 60) break; }
    let a = null, b = null, bd = -1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d > bd) { bd = d; a = pts[i]; b = pts[j]; } }
    const res = a ? [{ x: a[0], z: a[1] }, { x: b[0], z: b[1] }] : null;
    endsCache.set(st.key, res); return res;
  }
  function stopTour() { S.tour = null; $('tourbar').style.display = 'none'; $('b_tour').classList.remove('on'); }
  function tourBar() { const T = S.tour; if (!T) return; $('tourbar').style.display = 'block'; $('tbt').textContent = '🌍 جولة شاملة — حي ' + (T.hood || '') + ' (' + Math.min(T.hoodsDone + 1, T.hoodsTotal) + '/' + T.hoodsTotal + ')' + (T.cur ? ' — ' + T.cur.name : ''); }
  // الجولة تمرّ على الأحياء حيًّا حيًّا (الأقرب أولاً) وفي كل حي أهم شوارعه، فتغطي المدينة كلها بدل أن تدور في منطقة واحدة
  function nextTourLeg() {
    const T = S.tour; if (!T) return false;
    const endD = (st) => { const e = streetEnds(st); return e ? Math.min(Math.hypot(e[0].x - car.x, e[0].z - car.z), Math.hypot(e[1].x - car.x, e[1].z - car.z)) : 1e9; };
    for (let attempt = 0; attempt < 12; attempt++) {
      if (T.stage === 1 && T.cur) { T.stage = 2; T.legT = S.simT; if (routeTo({ x: T.leg[1].x, z: T.leg[1].z, name: T.cur.name })) { tourBar(); return true; } T.done.add(T.cur.key); T.cur = null; T.stage = 0; continue; }
      if (T.stage === 2 && T.cur) { T.done.add(T.cur.key); learn.markSeen(T.cur.key); big.discDirty = true; T.cur = null; T.stage = 0; }
      // الشارع التالي داخل الحي الحالي (الأقرب لنهايتيه)
      let best = null, bd = 1e18;
      if (T.hood) for (const st of T.byHood.get(T.hood) || []) { if (T.done.has(st.key)) continue; const d = endD(st); if (d < bd) { bd = d; best = st; } }
      if (!best) {
        // الحي انتهى → أقرب حي لم يُزر بعد
        if (T.hood) { T.hoodsDone++; T.byHood.delete(T.hood); }
        let bh = null, hd = 1e18;
        for (const [h, list] of T.byHood) { for (const st of list) { if (T.done.has(st.key)) continue; const d = endD(st); if (d < hd) { hd = d; bh = h; } } }
        if (!bh) { toast('🎉 انتهت الجولة — زرنا ' + T.hoodsTotal + ' حيًّا و' + T.total + ' شارعًا', 5000); stopTour(); return false; }
        T.hood = bh; toast('📍 حي ' + bh, 2500); if (settings.voice) say('حي ' + bh);
        continue;
      }
      const e = streetEnds(best);
      if (!e) { T.done.add(best.key); continue; }
      const nearA = Math.hypot(e[0].x - car.x, e[0].z - car.z) <= Math.hypot(e[1].x - car.x, e[1].z - car.z);
      T.cur = best; T.leg = nearA ? [e[0], e[1]] : [e[1], e[0]]; T.legT = S.simT;
      T.stage = 1;
      if (Math.hypot(T.leg[0].x - car.x, T.leg[0].z - car.z) < 45) continue;
      if (routeTo({ x: T.leg[0].x, z: T.leg[0].z, name: 'بداية ' + best.name })) { tourBar(); return true; }
      T.done.add(best.key); T.cur = null; T.stage = 0;
    }
    return false;
  }
  function startTour() {
    if (S.mode !== 'car') { toast('الجولة بالسيارة — اضغط F للركوب أولاً'); return; }
    const scope = scopeSel.value, all = learn.pool(scope).filter((s) => { if (!s.drv || s.len < 120) return false; const e = streetEnds(s); return e && Math.hypot(e[0].x, e[0].z) < 9000 && Math.hypot(e[1].x, e[1].z) < 9000 && Math.hypot(e[0].x - e[1].x, e[0].z - e[1].z) < 7000; });
    if (!all.length) { toast('لا توجد شوارع في هذا النطاق'); return; }
    const byHood = new Map();
    for (const st of all) { const h = st.hood || 'أخرى'; if (!byHood.has(h)) byHood.set(h, []); byHood.get(h).push(st); }
    let total = 0;
    for (const [h, list] of byHood) { list.sort((a, b) => (a.minT - b.minT) || (b.len - a.len)); if (!scope.startsWith('hood:')) list.length = Math.min(list.length, 3); total += list.length; }
    clearRoute();
    S.tour = { byHood, done: new Set(), total, cur: null, stage: 0, leg: null, hood: null, hoodsDone: 0, hoodsTotal: byHood.size, legT: 0 };
    S.cruise = true; S.auto = true; $('b_auto').classList.add('on'); $('b_tour').classList.add('on'); wake(true);
    if (!nextTourLeg()) { setAuto(false); return; }
    toast('🌍 جولة شاملة: ' + byHood.size + ' حيًّا — السيارة تقود وأنت تتعلّم الأسماء (المس أي تحكم للإيقاف)', 4200);
    $('learn').style.display = 'none';
  }
  $('b_tour').onclick = () => (S.tour ? setAuto(false) : startTour());
  $('l_tour').onclick = startTour; $('tbx').onclick = () => setAuto(false);
  $('tbs').onclick = () => { const T = S.tour; if (!T) return; if (T.cur) { T.done.add(T.cur.key); T.cur = null; T.stage = 0; } clearRoute(); if (!pickCruise()) setAuto(false); };
  function pickCruise() {
    if (S.tour) return nextTourLeg();
    const pool = learn.pool('major'); if (!pool.length) return false;
    for (let i = 0; i < 6; i++) {
      const st = pool[Math.floor(Math.random() * pool.length)];
      const p = nav.nearestOnStreet(st.key, car.x, car.z);
      if (p && Math.hypot(p.x - car.x, p.z - car.z) > 600 && routeTo({ x: p.x, z: p.z, name: st.name })) return true;
    }
    return false;
  }
  function setAuto(on) {
    if (on && S.mode !== 'car') { toast('القيادة الآلية للسيارة فقط — اضغط F للركوب'); return; }
    S.auto = on; $('b_auto').classList.toggle('on', on); wake(on);
    if (on) {
      if (!S.route) { S.cruise = true; if (!pickCruise()) { S.auto = false; $('b_auto').classList.remove('on'); toast('تعذّر بدء الجولة'); return; } toast('🤖 جولة آلية — المس أي تحكم لإيقافها'); }
      else { S.cruise = false; toast('🤖 قيادة آلية إلى ' + S.goalInfo.name + ' — المس أي تحكم لإيقافها'); }
    } else { S.cruise = false; stopTour(); toast('تم إيقاف القيادة الآلية'); }
  }
  $('b_auto').onclick = () => setAuto(!S.auto);
  // منع انطفاء الشاشة أثناء القيادة الآلية / الجولة
  let wl = null;
  async function wake(on) {
    try {
      if (!on) { if (wl) { wl.release().catch(() => {}); wl = null; } return; }
      if (!('wakeLock' in navigator) || (wl && !wl.released)) return;
      wl = await navigator.wakeLock.request('screen');
      wl.addEventListener('release', () => { wl = null; });
    } catch (e) { wl = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.auto) wake(true); });
  S.simT = 0;
  function autoInput(inp, dt) {
    const r = S.route;
    // لو علقت السيارة (مبنى/جدار): لا تقدّم على المسار لمدة 7 ثوانٍ → رجوع للخلف، ثم وضعها على المسار، وإن تكرر تخطَّ هذا الشارع
    if (S.route && S._rec && S.simT < S._rec.until) { inp.throttle = -1; inp.steer = S._rec.steer; inp.brake = false; return; }
    if (r) {
      const p0 = routeProgress(r, car.x, car.z, S.rIdx);
      if (!S._prog || S._prog.r !== r || p0.along > S._prog.along + 6) S._prog = { r, along: p0.along, t: S.simT, n: 0 };
      else if (S.simT - S._prog.t > 7 && r.total - p0.along > 30) {
        S._prog.t = S.simT; const n = ++S._prog.n;
        if (n % 2 === 1 && n < 5) S._rec = { until: S.simT + 1.6, steer: n % 4 === 1 ? 1 : -1 };
        else if (n < 5) {
          const np = r.pts.length / 2, k = Math.min(p0.idx + 2, np - 2);
          car.place(r.pts[k * 2], r.pts[k * 2 + 1], Math.atan2(r.pts[k * 2 + 2] - r.pts[k * 2], -(r.pts[k * 2 + 3] - r.pts[k * 2 + 1])));
        } else {
          S._prog = null;
          if (S.cruise) { if (S.tour && S.tour.cur) { S.tour.done.add(S.tour.cur.key); S.tour.cur = null; S.tour.stage = 0; } clearRoute(); if (!pickCruise()) setAuto(false); }
        }
        return;
      }
    }
    if (S.cruise && S.route && S.tour && S.tour.cur && S.simT - S.tour.legT > 420) { S.tour.done.add(S.tour.cur.key); S.tour.cur = null; S.tour.stage = 0; clearRoute(); if (!pickCruise()) setAuto(false); return; }
    if (!r) { if (S.cruise) pickCruise(); else setAuto(false); return; }
    const pr = routeProgress(r, car.x, car.z, S.rIdx); S.rIdx = pr.idx;
    const rem = r.total - pr.along;
    if (rem < 24 && S.cruise) { clearRoute(); if (!pickCruise()) setAuto(false); return; }
    if (rem < 20) { inp.throttle = 0; inp.steer = 0; inp.brake = true; if (Math.abs(car.v) < 1) { if (S.cruise) { clearRoute(); pickCruise(); } else { clearRoute(); setAuto(false); toast('🏁 وصلنا'); } } return; }
    const look = 10 + Math.abs(car.v) * 0.9, n = r.pts.length / 2;
    const at = (d) => { let k = pr.idx; while (k < n - 1 && r.cum[k] < pr.along + d) k++; return [r.pts[k * 2], r.pts[k * 2 + 1]]; };
    const [tx, tz] = at(look), [fx, fz] = at(look + 35);
    const want = Math.atan2(tx - car.x, -(tz - car.z)), diff = Math.atan2(Math.sin(want - car.h), Math.cos(want - car.h));
    inp.steer = clamp(diff * 1.7, -1, 1);
    const w2 = Math.atan2(fx - car.x, -(fz - car.z)), bend = Math.abs(Math.atan2(Math.sin(w2 - want), Math.cos(w2 - want)));
    let vt = (S.curRoad && S.curRoad.t <= 3 ? (S.tour ? 25 : 20) : 12) - bend * 9 - Math.abs(diff) * 6;
    vt = Math.min(vt, 3 + rem * 0.35); vt = clamp(vt, 3, S.tour ? 28 : 22);
    if (S.tour) vt = Math.min(vt, S.curRoad && S.curRoad.t <= 3 ? 26 : 16);
    if (pr.off > 25) vt = Math.min(vt, 6);
    inp.brake = false;
    if (car.v < vt - 0.7) inp.throttle = clamp((vt - car.v) / 4, 0.25, 1);
    else if (car.v > vt + 2.5) { inp.throttle = -0.6; inp.brake = car.v > vt + 6; }
    else inp.throttle = 0.12;
  }

  // ---------- main loop ----------
  $('load').style.display = 'none';
  let last = performance.now(), frame = 0, infoT = 0;
  const hdr = { street: $('st'), hood: $('hd'), sp: $('sp'), arrow: $('harrow'), hd: $('hdist') };
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; frame++; S.simT += dt;
    const inp = ctl.read();
    if (S.auto) {
      if (S.mode !== 'car' || Math.abs(inp.throttle) > 0.3 || Math.abs(inp.steer) > 0.3 || inp.brake) setAuto(false); else autoInput(inp, dt);
    }
    const camYaw = rig.mode === 'walk' ? rig.yaw : walker.h;
    car.update(dt, inp, S.mode === 'car');
    walker.update(dt, inp, rig.yaw, S.mode === 'walk');
    rig.update(dt, inp);
    const p = pos();
    world.update(p.x, p.z, dt);
    if (settings.signs && S.mode !== 'fly') signs.update(p.x, p.z);
    hoodSigns.enabled = !!settings.signs && S.mode !== 'fly'; hoodSigns.update(p.x, p.z); labels.skip = hoodSigns.near;
    labels.update(p.x, p.z, dt);
    if (contrib.ready) pins.update(contrib, p.x, p.z, dt);

    infoT += dt;
    if (infoT > 0.2) {
      infoT = 0;
      const n = D.idx.nearest(p.x, p.z, 30, { named: true });
      S.curRoad = n ? n.road : null; S.curDist = n ? n.d : 99; S.curKey = n ? n.road.key : null; S.curName = n ? n.road.name : '';
      if (S.tour && settings.voice && S.curKey && S.curKey !== S._lastSay && S.curDist < 14) { S._lastSay = S.curKey; say(S.curName); }
      const h = D.nearestHood(p.x, p.z), nh = h ? h.n : '';
      if (nh && S.hood && nh !== S.hood && !S.blind) { toast('📍 دخلت حي ' + nh.replace(/^حي\s+/, ''), 2600); if (S.tour && settings.voice) say('حي ' + nh); }
      S.hood = nh;
      if (S.mode !== 'fly' && n && n.d <= n.road.width * 0.5 + 4 && n.road.t <= 7 && learn.markSeen(n.road.key)) big.discDirty = true;
      const hide = S.blind || !settings.hudn;
      hdr.street.textContent = hide ? '؟؟؟' : S.curName && S.curDist < 25 ? S.curName : '—';
      hdr.hood.textContent = hide ? '' : S.hood ? 'حي ' + S.hood.replace(/^حي\s+/, '') : '';
      const spd = S.mode === 'car' ? Math.abs(car.v) * 3.6 : S.mode === 'walk' ? Math.abs(walker.v) * 3.6 : 0;
      $('spv').textContent = Math.round(spd); $('speedo').style.display = S.mode === 'fly' ? 'none' : 'block';
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
  window.__m3d = { startTour, setAuto, D, world, car, walker, rig, nav, learn, S, teleport, setMode, routeTo };
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
}

boot().catch((e) => { console.error(e); $('lt').textContent = '⚠️ تعذّر تحميل المدينة: ' + e.message; $('lb').style.display = 'none'; });
