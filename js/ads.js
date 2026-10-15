/* صفحة الإعلانات المجانية — pages/ads.html
   ضع هنا رابط مشروع Supabase ومفتاح anon (العام) فقط.
   مفتاح anon مصمم ليكون ظاهراً في الموقع، والأمان يأتي من سياسات RLS في supabase/ads.sql.
   لا تضع مفتاح service_role هنا أبداً. */
const ADS_SUPABASE_URL = 'PASTE_SUPABASE_URL_HERE';
const ADS_SUPABASE_ANON_KEY = 'PASTE_SUPABASE_ANON_KEY_HERE';

const CAT = { services:'خدمات وصيانة', jobs:'وظائف', food:'أكل بيتي', goods:'سلع', education:'تعليم ودروس', other:'أخرى' };
const TYPE = { offer:'أعرض', request:'أطلب' };
const $ = (id) => document.getElementById(id);
let sb = null;

function configured() {
  return ADS_SUPABASE_URL.indexOf('http') === 0 && ADS_SUPABASE_ANON_KEY.length > 40 && window.supabase;
}
function clientId() {
  try {
    let v = localStorage.getItem('mdm1_cid');
    if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem('mdm1_cid', v); }
    return v;
  } catch (e) { return 'anon-' + Math.random().toString(36).slice(2, 12); }
}
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function myAds() { try { return JSON.parse(localStorage.getItem('mdm1_my_ads') || '{}'); } catch (e) { return {}; } }
function saveMyAds(o) { try { localStorage.setItem('mdm1_my_ads', JSON.stringify(o)); } catch (e) {} }
function say(el, text, bad) { el.textContent = text; el.style.color = bad ? 'var(--blood-bright)' : 'var(--gold-bright)'; }
function ago(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'اليوم' : d === 1 ? 'أمس' : 'منذ ' + d + ' أيام';
}

function adCard(a, mine) {
  const el = document.createElement('article');
  el.className = 'ad-card';
  const top = document.createElement('div'); top.className = 'ad-top';
  const t = document.createElement('span'); t.className = 'ad-badge ' + a.type; t.textContent = TYPE[a.type] || a.type;
  const c = document.createElement('span'); c.className = 'ad-badge cat'; c.textContent = CAT[a.category] || a.category;
  const w = document.createElement('span'); w.className = 'ad-when'; w.textContent = ago(a.created_at);
  top.append(t, c, w);
  const h = document.createElement('h3'); h.textContent = a.title;
  const p = document.createElement('p'); p.className = 'ad-body'; p.textContent = a.body;
  const loc = document.createElement('div'); loc.className = 'ad-loc'; loc.textContent = '📍 ' + a.country + (a.city ? ' — ' + a.city : '');
  const ct = document.createElement('div'); ct.className = 'ad-contact';
  const lab = document.createElement('span'); lab.textContent = 'للتواصل: ';
  const val = document.createElement('bdi'); val.textContent = a.contact;
  ct.append(lab, val);
  const row = document.createElement('div'); row.className = 'ad-actions';
  if (mine) {
    const del = document.createElement('button'); del.textContent = 'احذف إعلاني';
    del.onclick = async () => {
      del.disabled = true;
      const { data, error } = await sb.rpc('delete_my_ad', { p_ad_id: a.id, p_token: mine });
      if (error || !data) { del.disabled = false; del.textContent = 'تعذر الحذف'; return; }
      const m = myAds(); delete m[a.id]; saveMyAds(m); el.remove();
    };
    row.append(del);
  } else {
    const rep = document.createElement('button'); rep.className = 'report'; rep.textContent = '⚠ إبلاغ عن مخالفة';
    rep.onclick = async () => {
      rep.disabled = true;
      const { error } = await sb.rpc('report_ad', { p_ad_id: a.id, p_reporter: clientId(), p_reason: null });
      rep.textContent = error ? 'تعذر الإبلاغ' : 'شكراً، تم الإبلاغ';
    };
    row.append(rep);
  }
  el.append(top, h, p, loc, ct, row);
  return el;
}

async function loadAds() {
  const list = $('ads-list');
  list.textContent = 'جارٍ التحميل...';
  let q = sb.from('ads').select('id,type,category,title,body,country,city,contact,created_at')
    .order('created_at', { ascending: false }).limit(60);
  const ft = $('f-type').value, fc = $('f-cat').value, fk = $('f-country').value.trim();
  if (ft) q = q.eq('type', ft);
  if (fc) q = q.eq('category', fc);
  if (fk) q = q.ilike('country', '%' + fk.replace(/[%_,()]/g, '') + '%');
  const { data, error } = await q;
  list.textContent = '';
  if (error) { list.textContent = 'تعذر تحميل الإعلانات الآن. حاول لاحقاً.'; return; }
  if (!data.length) { list.textContent = 'لا توجد إعلانات بهذه الشروط بعد. كن أول من ينشر!'; return; }
  const mine = myAds();
  data.forEach(a => list.append(adCard(a, mine[a.id] || null)));
}

async function postAd(e) {
  e.preventDefault();
  const msg = $('post-msg');
  if ($('hp').value) return;
  if (!$('agree').checked) return say(msg, 'وافق على إخلاء المسؤولية أولاً.', true);
  try {
    const last = Number(localStorage.getItem('mdm1_last_post') || 0);
    if (Date.now() - last < 60000) return say(msg, 'انتظر دقيقة بين كل إعلان والذي بعده.', true);
  } catch (err) {}
  const token = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)) + '-' + Date.now();
  const adId = (crypto.randomUUID ? crypto.randomUUID() : null);
  if (!adId) return say(msg, 'متصفحك قديم ولا يدعم النشر. حدّثه وحاول مرة أخرى.', true);
  const row = {
    id: adId, type: $('p-type').value, category: $('p-cat').value,
    title: $('p-title').value.trim(), body: $('p-body').value.trim(),
    country: $('p-country').value.trim(), city: $('p-city').value.trim() || null,
    contact: $('p-contact').value.trim(), owner_hash: await sha256Hex(token)
  };
  $('p-submit').disabled = true;
  say(msg, 'جارٍ النشر...');
  const { error } = await sb.from('ads').insert(row);
  $('p-submit').disabled = false;
  if (error) return say(msg, 'تعذر النشر. راجع الحقول: العنوان 3 أحرف على الأقل، والوصف 10 أحرف على الأقل.', true);
  say(msg, 'تم النشر. سيظهر إعلانك خلال لحظات، ويبقى 30 يوماً.');
  try { localStorage.setItem('mdm1_last_post', String(Date.now())); } catch (err) {}
  const m = myAds(); m[adId] = token; saveMyAds(m);
  $('post-form').reset();
  setTimeout(loadAds, 400);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!configured()) {
    $('not-ready').hidden = false;
    $('ads-main').hidden = true;
    return;
  }
  sb = window.supabase.createClient(ADS_SUPABASE_URL, ADS_SUPABASE_ANON_KEY);
  ['f-type', 'f-cat'].forEach(id => $(id).addEventListener('change', loadAds));
  $('f-country').addEventListener('input', () => { clearTimeout(window._t); window._t = setTimeout(loadAds, 350); });
  $('post-form').addEventListener('submit', postAd);
  loadAds();
});
