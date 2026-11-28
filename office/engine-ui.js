/* MDM1 Decision Engine — UI (injected tab).
   Loaded by standalone.js after the runtime is ready. It waits for app.js, then adds
   the "🧠 محرك القرار" tab, so index.html and app.js need no edits. */
(function () {
  'use strict';
  var PANEL = `<section id="tab-engine" class="tab-panel">
          <div class="panel-header"><div><h2>🧠 محرك القرار: النتائج والتوقعات والإجراءات المُراقَبة</h2><p>مشاريع لها دورة حياة ونتائج مقيسة، وتوقعات مقفلة تُقاس بدقتها، ووسيط يمنع أي إجراء خارج السياسة.</p></div></div>
          <div id="engMsg" style="font-size:12px;min-height:16px;margin-bottom:8px;"></div>

          <div class="card-box" style="margin-bottom:16px;">
            <h3>📁 دفتر النتائج (المشاريع)</h3>
            <div class="sim-form-grid">
              <div><label>اسم المشروع</label><input type="text" id="engPrjTitle" placeholder="موقع لعميل جديد" /></div>
              <div><label>الميزانية (USD)</label><input type="number" id="engPrjBudget" min="0" step="1" placeholder="200" /></div>
              <div><label>موعد التسليم</label><input type="datetime-local" id="engPrjDue" /></div>
              <div style="display:flex;align-items:flex-end;"><button type="button" class="btn btn-primary" style="width:100%" onclick="engUiCreateProject()">➕ إنشاء مشروع</button></div>
            </div>
            <div id="engProjects" class="approvals-list" style="margin-top:12px;"></div>
          </div>

          <div class="card-box" style="margin-bottom:16px;">
            <h3>🗳️ برلمان التوقعات (مقفل ويُحاسَب بمقياس Brier)</h3>
            <p style="font-size:12px;color:var(--muted);margin:4px 0 10px;">يُسجَّل التوقع قبل التسليم ولا يمكن تعديله. لا يُقبل توقع من نموذج غير متصل (لا أرقام مختلقة).</p>
            <div class="sim-form-grid">
              <div><label>المشروع</label><select id="engFcProject"></select></div>
              <div style="grid-column:span 2;"><label>الأسئلة</label><div id="engFcQuestions" style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;"></div></div>
              <div style="display:flex;align-items:flex-end;"><button type="button" class="btn btn-cyan" style="width:100%" onclick="engUiCreateForecast()">🎲 اجمع التوقعات</button></div>
            </div>
            <div id="engForecasts" style="margin-top:12px;"></div>
            <h4 style="margin:14px 0 6px;">🏅 دقة الموظفين</h4>
            <div id="engLeaderboard" style="font-size:12px;"></div>
          </div>

          <div class="card-box" style="margin-bottom:16px;">
            <h3>🛡️ وسيط الإجراءات والسياسات</h3>
            <div id="engPolicy" style="font-size:12px;color:var(--muted);margin-bottom:10px;"></div>
            <div class="sim-form-grid">
              <div><label>نوع الإجراء</label><select id="engIntKind"></select></div>
              <div><label>الموظف</label><select id="engIntAgent"></select></div>
              <div><label>المبلغ (USD)</label><input type="number" id="engIntAmount" min="0" step="0.01" /></div>
              <div><label>الوجهة / المشروع</label><input type="text" id="engIntTarget" placeholder="اختياري" /></div>
              <div style="grid-column:span 3;"><label>النص / السبب</label><input type="text" id="engIntText" placeholder="مثال: اشتراك أداة تحليل" /></div>
              <div style="display:flex;align-items:flex-end;"><button type="button" class="btn btn-primary" style="width:100%" onclick="engUiSubmitIntent()">📨 قدّم الإجراء للوسيط</button></div>
            </div>
            <div style="margin:10px 0;"><button type="button" class="btn btn-secondary" onclick="engUiEditPolicy()">⚙️ حدود الإنفاق</button> <button type="button" class="btn btn-secondary" onclick="engUiVerify()">🔗 تحقق من سلسلة القرارات</button></div>
            <div id="engIntents" class="approvals-list"></div>
            <div id="engChain" style="font-size:11px;color:var(--muted);margin-top:10px;word-break:break-all;"></div>
          </div>
        </section>`;
  function inject() {
    if (document.getElementById('tab-engine')) return true;
    var anchorNav = document.querySelector('.nav-item[data-tab="incident"]');
    var anchorPanel = document.getElementById('tab-incident');
    if (!anchorNav || !anchorPanel) return false;
    var btn = document.createElement('button');
    btn.className = 'nav-item'; btn.setAttribute('data-tab', 'engine');
    btn.innerHTML = '<span class="nav-icon">🧠</span><span>محرك القرار</span>';
    anchorNav.parentNode.insertBefore(btn, anchorNav);
    anchorPanel.insertAdjacentHTML('beforebegin', PANEL);
    btn.addEventListener('click', function () { switchTab('engine'); });
    TAB_RENDERERS.engine = [renderEngine];
    /* The mobile “More” sheet is rebuilt from the sidebar once by app.js. Add
       the injected tab there too so it stays reachable on phones. */
    if (typeof buildMobileMore === 'function') buildMobileMore();
    return true;
  }
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var ready = typeof TAB_RENDERERS !== 'undefined' && typeof switchTab === 'function' && typeof api === 'function' && typeof D !== 'undefined';
    if (ready) { try { if (inject()) clearInterval(timer); } catch (e) { console.warn('engine ui', e); clearInterval(timer); } }
    else if (tries > 400) clearInterval(timer);   /* ~2 minutes, e.g. while the lock screen is up */
  }, 300);
})();

/* ===================== محرك القرار (Decision Engine) ===================== */
let ENG=null;
const ENG_ST={planned:'مخطَّط',active:'قيد التنفيذ',delivered:'سُلِّم',accepted:'مقبول',rejected:'مرفوض',cancelled:'ملغى'};
const ENG_Q={delivered_on_time:'التسليم في الموعد',accepted:'قبول التسليم',profitable:'الربحية',within_budget:'ضمن الميزانية',first_pass_quality:'جودة من أول مرة'};
const ENG_INT={denied:'🚫 مرفوض',pending_approval:'⏳ بانتظار موافقتك',approved:'✔️ معتمد',executed:'✅ نُفِّذ',rejected:'❌ رفضتَه',failed:'⚠️ فشل',expired:'⌛ انتهت القدرة'};
const ENG_KIND={read_report:'قراءة تقرير',spend:'إنفاق',send_message:'إرسال رسالة',publish:'نشر',update_price:'تعديل سعر',transfer_funds:'تحويل أموال'};
function engUiMsg(t,bad){const el=document.getElementById('engMsg');if(el){el.textContent=t||'';el.style.color=bad?'#ff6b6b':'var(--cyan)'}}
async function engUiCall(path,body){try{return await api(path,{method:'POST',body:JSON.stringify(body||{})})}catch(e){engUiMsg(e.message,true);return null}}
async function renderEngine(){
  if(!document.getElementById('tab-engine'))return;
  try{ENG=await api('/api/engine/state')}catch(e){engUiMsg('تعذّر تحميل المحرك: '+e.message,true);return}
  engRenderProjects();engRenderForecasts();engRenderBroker();
}
function engRenderProjects(){
  const el=document.getElementById('engProjects');if(!el)return;
  const list=ENG.projects||[];
  el.innerHTML=list.length?list.map(p=>{
    const m=p.metrics||{},t=m.tasks||{};
    const acts=[];
    if(p.status==='planned')acts.push(['active','▶️ ابدأ']);
    if(p.status==='active')acts.push(['delivered','📦 سلّم']);
    if(p.status==='delivered')acts.push(['accepted','✅ قُبل'],['rejected','❌ رُفض']);
    if(['planned','active','delivered'].includes(p.status))acts.push(['cancelled','🗑️ إلغاء']);
    const open=['planned','active','delivered'].includes(p.status);
    return `<div class="approval-card"><div style="flex:1">
      <strong>${esc(p.title)}</strong> <span style="font-size:11px;color:var(--cyan)">${esc(ENG_ST[p.status]||p.status)}</span>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">ميزانية $${esc(p.budgetUsd)} • تكلفة $${esc(m.costUsd)} • إيراد $${esc(m.revenueUsd)} • ربح $${esc(m.profitUsd)}${p.dueAt?' • الموعد '+esc(String(p.dueAt).slice(0,16).replace('T',' ')):''}</div>
      <div style="font-size:11px;color:var(--muted)">مهام: ${esc(t.done)} منجزة / ${esc(t.open)} مفتوحة / ${esc(t.failed)} فاشلة${m.onTime===null||m.onTime===undefined?'':(m.onTime?' • ✔️ في الموعد':' • ⏰ متأخر')}</div>
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">${acts.map(a=>`<button type="button" class="btn btn-secondary" onclick="engUiStatus('${jsAttr(p.id)}','${a[0]}')">${a[1]}</button>`).join('')}${p.status==='active'||p.status==='planned'?`<button type="button" class="btn btn-secondary" onclick="engUiAddTask('${jsAttr(p.id)}')">➕ مهمة</button>`:''}</div>
    </div></div>`}).join(''):'<div style="font-size:12px;color:var(--muted)">لا توجد مشاريع بعد.</div>';
  const sel=document.getElementById('engFcProject');
  if(sel){const keep=sel.value;sel.innerHTML=list.filter(p=>['planned','active'].includes(p.status)).map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');if(keep)sel.value=keep}
  const qs=document.getElementById('engFcQuestions');
  if(qs&&!qs.dataset.ready){qs.dataset.ready='1';qs.innerHTML=Object.keys(ENG.questions||ENG_Q).map((k,i)=>`<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" value="${esc(k)}" ${i<3?'checked':''}/> ${esc(ENG_Q[k]||k)}</label>`).join('')}
}
function engRenderForecasts(){
  const el=document.getElementById('engForecasts');if(!el)return;
  const title=id=>{const p=(ENG.projects||[]).find(x=>x.id===id);return p?p.title:id};
  const nm=id=>id==='ceo'?'المدير':((D.agents||[]).find(a=>a.id===id)||{}).name||id;
  el.innerHTML=(ENG.forecasts||[]).length?ENG.forecasts.map(f=>{
    const cons=f.questions.map(k=>{const c=f.consensus&&f.consensus[k];const o=f.resolved&&k in f.resolved;
      return `<div style="margin:4px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span>${esc(ENG_Q[k]||k)}</span><span>${c?Math.round(c.p*100)+'% (±'+Math.round(c.spread*100)+')':'—'}${o?' → النتيجة: '+(f.resolved[k]?'نعم':'لا'):''}</span></div><div style="height:6px;background:rgba(255,255,255,.1);border-radius:3px"><div style="height:6px;width:${c?Math.round(c.p*100):0}%;background:var(--cyan);border-radius:3px"></div></div></div>`}).join('');
    const rows=Object.keys(f.predictions).map(aid=>`<div style="font-size:11px;color:var(--muted)">${esc(nm(aid))}: ${f.questions.map(k=>typeof f.predictions[aid][k]==='number'?esc(ENG_Q[k]||k)+' '+Math.round(f.predictions[aid][k]*100)+'%'+(f.scores&&f.scores[aid]&&f.scores[aid][k]!==undefined?' (Brier '+f.scores[aid][k]+')':''):'').filter(Boolean).join(' • ')}</div>`).join('');
    const sk=(f.skipped||[]).length?`<div style="font-size:11px;color:#ffb86b">تعذّر: ${f.skipped.map(s=>esc(nm(s.agentId))+' ('+esc(s.reason)+')').join('، ')}</div>`:'';
    return `<div class="approval-card" style="display:block"><strong>${esc(title(f.projectId))}</strong> <span style="font-size:11px;color:var(--muted)">${f.status==='open'?'مفتوح':f.status==='resolved'?'محسوم':'ملغى'} • قفل ${esc(String(f.lockedAt||'').slice(0,16).replace('T',' '))} • ${esc(String(f.lockHash||'').slice(0,12))}…</div>${cons}${rows}${sk}</div>`}).join(''):'<div style="font-size:12px;color:var(--muted)">لا توجد توقعات بعد.</div>';
  const lb=document.getElementById('engLeaderboard');
  if(lb)lb.innerHTML=(ENG.leaderboard||[]).length?`<table style="width:100%;font-size:12px"><tr style="color:var(--muted)"><td>الموظف</td><td>السؤال</td><td>عدد</td><td>Brier</td><td>الوزن</td></tr>${ENG.leaderboard.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(ENG_Q[r.question]||r.question)}</td><td>${esc(r.n)}</td><td>${esc(r.meanBrier)}</td><td>${esc(r.weight)}</td></tr>`).join('')}</table><div style="font-size:11px;color:var(--muted);margin-top:4px">Brier أقل = أدق. 0.25 يعني كمن يجيب 50% دائماً. الوزن يتأثر بالسجل ويتقلّص نحو 1 عند قلة العينات.</div>`:'<div style="color:var(--muted)">تظهر الدقة بعد حسم أول مشروع له توقعات.</div>';
}
function engRenderBroker(){
  const pol=ENG.policy||{kinds:{}};
  const k=document.getElementById('engIntKind');
  if(k){const keep=k.value;k.innerHTML=Object.keys(pol.kinds).map(x=>`<option value="${esc(x)}" ${pol.kinds[x].enabled?'':'disabled'}>${esc(ENG_KIND[x]||x)}${pol.kinds[x].enabled?'':' (معطّل)'}</option>`).join('');if(keep)k.value=keep}
  const a=document.getElementById('engIntAgent');
  if(a&&!a.dataset.ready&&D.agents){a.dataset.ready='1';a.innerHTML=D.agents.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}
  const sp=pol.kinds.spend||{};
  const pe=document.getElementById('engPolicy');
  if(pe)pe.innerHTML=`الرفض هو الافتراضي. الإنفاق: حد الإجراء $${esc(sp.maxAmountUsd)} • السقف اليومي $${esc(sp.dailyCapUsd)} • المنفَّق اليوم $${esc(ENG.spentToday)} • كل إجراء له أثر يحتاج موافقتك وقدرة تُستهلك مرة واحدة.`;
  const il=document.getElementById('engIntents');
  if(il)il.innerHTML=(ENG.intents||[]).length?ENG.intents.map(i=>`<div class="approval-card"><div style="flex:1"><strong>${esc(ENG_KIND[i.kind]||i.kind)}</strong> ${i.amountUsd?'$'+esc(i.amountUsd):''} <span style="font-size:11px">${esc(ENG_INT[i.status]||i.status)}</span><div style="font-size:11px;color:var(--muted)">${esc(i.text||i.target||'')}</div><div style="font-size:11px;color:${i.verdict==='deny'?'#ff6b6b':'var(--muted)'}">${esc((i.reasons||[]).join(' '))} ${i.code?'['+esc(i.code)+']':''} • المصدر: ${esc(i.trust)}</div></div></div>`).join(''):'<div style="font-size:12px;color:var(--muted)">لا توجد إجراءات مقدّمة.</div>';
  const c=ENG.chain||{};
  const ce=document.getElementById('engChain');
  if(ce)ce.innerHTML=`${c.ok?'✅ السلسلة سليمة':'❌ السلسلة مكسورة عند #'+esc(c.brokenAt)} • ${esc(c.length)} حدث (آخر رقم ${esc(c.seq)}) • الرأس: ${esc(String(c.head||'').slice(0,24))}…`;
}
async function engUiCreateProject(){
  const title=document.getElementById('engPrjTitle').value.trim();if(!title)return engUiMsg('اكتب اسم المشروع.',true);
  const due=document.getElementById('engPrjDue').value;
  const r=await engUiCall('/api/engine/projects',{title,budgetUsd:Number(document.getElementById('engPrjBudget').value||0),dueAt:due?new Date(due).toISOString():null});
  if(r){document.getElementById('engPrjTitle').value='';engUiMsg('أُنشئ المشروع.');renderEngine()}
}
async function engUiStatus(id,status){
  const body={status};
  if(status==='accepted'){const v=prompt('الإيراد المحصَّل (USD)؟ اتركه 0 إن لم يوجد.','0');if(v===null)return;body.revenueUsd=Number(v)||0;body.firstPassQuality=confirm('هل اجتاز الناتج الجودة من أول مرة دون إعادة عمل؟')}
  if(status==='rejected')body.firstPassQuality=false;
  if(status==='cancelled'&&!confirm('إلغاء المشروع يُبطل توقعاته بلا احتساب. متأكد؟'))return;
  const r=await engUiCall('/api/engine/projects/'+encodeURIComponent(id)+'/status',body);
  if(r){engUiMsg(r.resolvedForecasts?`حُسمت ${r.resolvedForecasts} نتيجة توقع.`:'تم التحديث.');bootstrap();renderEngine()}
}
async function engUiAddTask(id){
  const title=prompt('عنوان المهمة؟');if(!title)return;
  const agentId=prompt('معرّف الموظف (مثل executive-assistant)',(D.agents&&D.agents[0]&&D.agents[0].id)||'executive-assistant');if(!agentId)return;
  const r=await engUiCall('/api/engine/projects/'+encodeURIComponent(id)+'/task',{title,agentId});
  if(r){engUiMsg('أُسندت المهمة.');bootstrap();renderEngine()}
}
async function engUiCreateForecast(){
  const projectId=document.getElementById('engFcProject').value;if(!projectId)return engUiMsg('اختر مشروعاً مخططاً أو جارياً.',true);
  const questions=[...document.querySelectorAll('#engFcQuestions input:checked')].map(x=>x.value);
  engUiMsg('جارٍ جمع التوقعات من الموظفين… قد يستغرق دقيقة.');
  const r=await engUiCall('/api/engine/forecasts',{projectId,questions});
  if(r){engUiMsg('قُفلت التوقعات.');renderEngine()}
}
async function engUiSubmitIntent(){
  const body={kind:document.getElementById('engIntKind').value,agentId:document.getElementById('engIntAgent').value,amountUsd:document.getElementById('engIntAmount').value,target:document.getElementById('engIntTarget').value,text:document.getElementById('engIntText').value,projectId:document.getElementById('engIntTarget').value};
  if(body.amountUsd==='')delete body.amountUsd;
  const r=await engUiCall('/api/engine/intents/ceo',body);
  if(r){const i=r.intent;engUiMsg(i.verdict==='deny'?'🚫 رفضه الوسيط: '+(i.reasons||[]).join(' '):i.verdict==='needs_approval'?'⏳ بانتظار موافقتك في تبويب الموافقات.':'✅ '+(i.status));bootstrap();renderEngine()}
}
async function engUiEditPolicy(){
  const sp=(ENG.policy.kinds.spend)||{};
  const a=prompt('حد المبلغ للإجراء الواحد (USD)',sp.maxAmountUsd);if(a===null)return;
  const d=prompt('السقف اليومي للإنفاق (USD)',sp.dailyCapUsd);if(d===null)return;
  const r=await engUiCall('/api/engine/policy',{kinds:{spend:{maxAmountUsd:Number(a),dailyCapUsd:Number(d)}}});
  if(r){engUiMsg('حُدّثت السياسة وسُجّل التغيير في السلسلة.');renderEngine()}
}
async function engUiVerify(){
  try{const r=await api('/api/engine/chain/verify');engUiMsg(r.ok?'✅ السلسلة سليمة ('+r.length+' حدث).':'❌ كُسرت السلسلة عند #'+r.brokenAt+' ('+r.reason+')',!r.ok)}catch(e){engUiMsg(e.message,true)}
}
