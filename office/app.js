let D = {
  agents:[], providerConfig:{}, knowledgeFiles:[], exports:[], auditLog:[], sandboxFiles:[], playbooks:[], snapshots:[], memoryStats:{totalMemories:0,byAgent:{}},
  outgoingWebhooks:{}, telegramEnabled:false,
  state:{ directChats:{}, teamChat:[], tasks:[], approvals:[], webhooks:[], usageStats:{totalTokens:0,totalCostUsd:0,byAgent:{}}, meetingActive:false, meetingAttendees:[], internalMemos:[], kpiReviews:[], financialLedger:[], schedules:[], gamification:{}, customers:[], votes:[], emergencyMode:false, incidents:[], simulations:[], requestLedger:[] }
};
let selectedAgentId = null;
let assistantSession = null;
let auditSearchTimer = null;
let staffQuery = '';
let lastPendingApprovalIds = null;
const BASE_TITLE = document.title;
const SL = { available:'متاح', working:'يعمل', waiting_approval:'ينتظر موافقة', offline:'غير متصل' };
const ROOMS = [
  { id:'exec-hr', title:'👑 الإدارة التنفيذية والموارد البشرية', zones:['executive','hr-training'] },
  { id:'fin-sec', title:'💰 قسم المالية والأمان', zones:['finance-security'] },
  { id:'mkt', title:'📣 ركن التسويق والنمو', zones:['marketing'] },
  { id:'res-eng', title:'🌐 مختبر البحث والخبراء والمطورين', zones:['research-lab','engineering-audit'] },
  { id:'legal', title:'⚖️ الشؤون القانونية والامتثال', zones:['legal'] }
];
const VP = { 'hr-manager':{pitch:1.15,rate:1}, 'ai-trainer':{pitch:1.1,rate:1.05}, 'executive-assistant':{pitch:1.2,rate:1.08}, 'accountant':{pitch:1.05,rate:.96}, 'marketing-lead':{pitch:.95,rate:1.08}, 'security-officer':{pitch:.8,rate:.94}, 'web-research-team':{pitch:1,rate:1.05}, 'auditors-experts-devs':{pitch:.88,rate:1}, 'legal-accountant':{pitch:1,rate:.95}, 'legal-advisor':{pitch:.9,rate:1} };

async function api(u,o={}){const r=await fetch(u,{headers:{'Content-Type':'application/json'},...o});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
const escAttr=esc;
/* Safe inside a double-quoted HTML attribute whose value also contains a
   single-quoted JavaScript string. HTML-escape first, then JS-escape. */
function jsAttr(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r|\n/g,' ')}
const activeTab=()=>document.querySelector('.nav-item.active')?.dataset.tab||'office';

async function bootstrap(){
  const prevIds=lastPendingApprovalIds||new Set((D.state.approvals||[]).filter(a=>a.status==='pending').map(a=>a.id));
  D=await api('/api/bootstrap');
  if(!selectedAgentId&&D.agents.length)selectedAgentId=D.agents[0].id;
  notifyNewApprovals(prevIds);
  renderGlobal();renderActiveTab(activeTab());
  try{const s=await api('/api/assistant/session');if(s.session){assistantSession=s.session;if(activeTab()==='chat')renderAssistantChat();}}catch(e){}
}
/* The runtime reports when a provider's real chat health changes (e.g. Zen
   lists models but CORS blocks generation). Refresh the badge/status from the
   new truth without reloading the whole app. */
window.addEventListener('mdm1-provider-change',()=>{bootstrap().catch(e=>console.warn('provider refresh',e))});

function notifyNewApprovals(prevIds){
  const pending=(D.state.approvals||[]).filter(a=>a.status==='pending');
  const fresh=pending.filter(a=>lastPendingApprovalIds&&!prevIds.has(a.id));
  lastPendingApprovalIds=new Set(pending.map(a=>a.id));
  if(fresh.length){
    document.title=`(${fresh.length}) ⏳ ${BASE_TITLE}`;
    try{window.MDM1Office?.showToast?.(`⏳ ${fresh.length} موافقة جديدة`,'info')}catch(e){}
    if('Notification' in window&&Notification.permission==='granted'){
      fresh.forEach(a=>{try{new Notification('⏳ موافقة جديدة',{body:String(a.agentName||'')+' — '+String(a.title||'')})}catch(e){}});
    }
  }else if(document.visibilityState==='visible')document.title=BASE_TITLE;
}

function renderGlobal(){
  renderTopBadges();renderStats();populateSelects();
  const input=document.getElementById('staffSearchInput');if(input&&input.value!==staffQuery)input.value=staffQuery;
}

const TAB_RENDERERS={
  office:[renderToday,renderOfficeRooms,renderTasks,renderWorkingTeam],
  chat:[renderChatAgentsList,renderDirectChat,renderTeamChat,renderAssistantChat,renderRequestLedger],
  approvals:[renderApprovals,renderHighRiskApprovals],
  votes:[renderVotes],crm:[renderCRM],kpi:[renderKPI,renderAgentBenchmarks,renderDecisionLog],memos:[renderMemos],
  pnl:[renderPnL],scheduler:[renderSchedules],knowledge:[renderKnowledge],sandbox:[renderSandbox],
  org:[renderOrgChart],audit:[renderAuditCost],integrations:[renderIntegrations],simulator:[renderSimulations],
  playbooks:[renderPlaybooks],snapshots:[renderSnapshots],incident:[renderIncidents],assistant:[renderAssistantChat]
};
function renderActiveTab(t){(TAB_RENDERERS[t]||[]).forEach(fn=>{try{fn()}catch(e){console.warn('render '+t,e)}})}

function renderAll(){renderGlobal();Object.keys(TAB_RENDERERS).forEach(renderActiveTab)}

function renderTopBadges(){
  const c=D.providerConfig||{}, st=D.providerStatus||{}, b=document.getElementById('providerBadge');
  const live=Boolean(st.hasKey||c.hasKey);
  b.className='provider-badge '+(live?'live':'offline');
  b.textContent=live?`🟢 ${String(c.provider||st.provider||'model').toUpperCase()} (${c.model||st.model||'auto'})`:'🔴 غير متصل — أضف API';
  b.title=live
    ? `المزود: ${c.provider||st.provider||'-'}\nالنموذج: ${c.model||st.model||'-'}\nاضغط لفتح إعدادات الاتصال.`
    : (st.lastError||'لا يوجد اتصال حي بنموذج. اضغط لفتح 🔑 إضافة API.');
  b.onclick=()=>window.MDM1Office&&window.MDM1Office.openConnectionPanel&&window.MDM1Office.openConnectionPanel({focus:'api'});
  const u=D.state.usageStats||{totalTokens:0,totalCostUsd:0};
  document.getElementById('costBadge').textContent=`🪙 ${u.totalTokens} tok | $${Number(u.totalCostUsd||0).toFixed(4)}`;
  document.getElementById('ragBadge').textContent=`🧠 ${(D.memoryStats&&D.memoryStats.totalMemories)||0} ذكرى`;
  document.getElementById('emergencyBanner').classList.toggle('hidden', !D.state.emergencyMode);
  renderProviderNotice(live, st);
}

function renderProviderNotice(live, st){
  const el=document.getElementById('providerNotice'); if(!el)return;
  if(live){el.classList.add('hidden');el.innerHTML='';return;}
  el.classList.remove('hidden');
  el.innerHTML='<span>⚠️ الردود الحالية تجريبية لأنه لا يوجد اتصال حي بنموذج. حالة الموظفين تظهر «غير متصل» إلى أن تُدخل مفتاحك أنت (Groq / OpenRouter / Zen) أو تشغّل OpenCode محلياً. مفاتيحك أنت فقط هي التي تُستخدم.</span><button type="button" class="btn btn-primary" id="noticeApiBtn">🔑 إضافة مفتاحي الآن</button>';
  const btn=document.getElementById('noticeApiBtn');
  if(btn)btn.onclick=()=>window.MDM1Office&&window.MDM1Office.openConnectionPanel&&window.MDM1Office.openConnectionPanel({focus:'api'});
}

function renderStats(){
  const c={available:0,working:0,waiting_approval:0};
  D.agents.forEach(a=>{c[a.status]=(c[a.status]||0)+1});
  const workingTasks=(D.state.tasks||[]).filter(t=>t.status==='working').length;
  document.getElementById('statAvailable').textContent=c.available;
  document.getElementById('statWorking').textContent=c.working||workingTasks;
  document.getElementById('statWaiting').textContent=c.waiting_approval;
  document.getElementById('statOffline').textContent=c.offline||0;
  document.getElementById('pendingCountBadge').textContent=D.state.approvals.filter(a=>a.status==='pending').length;
  document.getElementById('memoCountBadge').textContent=(D.state.internalMemos||[]).filter(m=>m.read!==true).length;
}

function renderOfficeRooms(){
  const mb=document.getElementById('meetingRoomBox'), ma=document.getElementById('meetingAvatars'), att=D.state.meetingAttendees||[];
  const q=staffQuery.trim().toLowerCase();
  const hit=a=>!q||(String(a.name||'')+' '+String(a.department||'')+' '+String(a.id||'')+' '+String(a.zone||'')).toLowerCase().includes(q);
  if(D.state.meetingActive&&att.length){mb.classList.remove('hidden');ma.innerHTML=att.map(id=>D.agents.find(a=>a.id===id)).filter(Boolean).filter(hit).map(a=>`<div class="meeting-seat" data-agent-id="${escAttr(a.id)}"><span style="font-size:20px">${esc(a.avatar)}</span><div><strong style="font-size:12px">${esc(a.name)}</strong><div style="font-size:10px;color:#67e8f9">في الاجتماع...</div></div></div>`).join('');}
  else mb.classList.add('hidden');
  document.getElementById('officeRooms').innerHTML=ROOMS.map(room=>{
    const ag=D.agents.filter(a=>room.zones.includes(a.zone)&&hit(a));
    return `<div class="office-room"><div class="room-title">${esc(room.title)}</div><div class="room-desks">${ag.map(a=>{
      const g=a.gamification||{points:0,rankTitle:'موظف تنفيذي'};
      return `<div class="desk-card" data-agent-id="${escAttr(a.id)}"><div class="desk-top"><div class="desk-avatar">${esc(a.avatar)}</div><span class="status-pill"><i class="dot ${escAttr(a.status)}"></i> ${esc(SL[a.status]||a.status)}</span></div><strong style="font-size:13px">${esc(a.name)}</strong><div style="font-size:11px;color:var(--cyan)">${esc(a.department||'')}</div><div class="rank-badge">🏆 ${esc(g.rankTitle)} (${esc(g.points)}ن) • 🧠 ${esc(a.memoryCount||0)}</div>${a.bubble?`<div class="speech-bubble">💬 ${esc(a.bubble)}</div>`:''}</div>`;
    }).join('')||'<div class="approval-card">لا يوجد موظفون مطابقون للبحث.</div>'}</div></div>`;
  }).join('');
}

async function endMeeting(){await api('/api/meeting/end',{method:'POST'});await bootstrap()}

const TASK_STATUS_LABEL={queued:'في الطابور',working:'قيد التنفيذ',done:'منجز',needs_review:'يحتاج مراجعة',failed:'فشل'};

function renderToday(){
  const el=document.getElementById('todayCommandCenter'); if(!el)return;
  const st=D.state||{}, tasks=st.tasks||[], approvals=st.approvals||[], memos=st.internalMemos||[];
  const pending=approvals.filter(a=>a.status==='pending').length;
  const unread=memos.filter(m=>m.read!==true).length;
  const queued=tasks.filter(t=>t.status==='queued').length;
  const working=tasks.filter(t=>t.status==='working').length;
  const done=tasks.filter(t=>t.status==='done').length;
  const ledger=st.financialLedger||[], cost=Number((st.usageStats||{}).totalCostUsd||0);
  const revenue=ledger.filter(e=>e.type==='revenue').reduce((s,e)=>s+Number(e.amountUsd||0),0);
  const expense=ledger.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amountUsd||0),0);
  const provider=(document.getElementById('providerBadge')?.textContent||'غير معروف').trim();
  el.innerHTML=`<div class="today-card"><span>🗓️ اليوم</span><strong>${esc(new Date().toLocaleDateString('ar'))}</strong><small>لوحة تشغيل واحدة لكل الأقسام</small></div>
    <button type="button" class="today-card" onclick="switchTab('approvals')"><span>⏳ موافقات</span><strong>${pending}</strong><small>${pending?'تحتاج قرارك':'لا يوجد معلّق'}</small></button>
    <button type="button" class="today-card" onclick="switchTab('memos')"><span>📨 بريد غير مقروء</span><strong>${unread}</strong><small>${unread?'افتح البريد الداخلي':'كل الرسائل مقروءة'}</small></button>
    <button type="button" class="today-card" onclick="switchTab('chat')"><span>🚀 المهام</span><strong>${working+queued}</strong><small>${queued} بالطابور • ${working} قيد التنفيذ • ${done} منجز</small></button>
    <div class="today-card"><span>📊 صافي الأعمال</span><strong>$${(revenue-expense-cost).toFixed(2)}</strong><small>إيراد ${revenue.toFixed(0)} − مصروف ${expense.toFixed(0)} − APIs ${cost.toFixed(2)}</small></div>
    <div class="today-card"><span>🔌 المزود الحي</span><strong style="font-size:13px;">${esc(provider)}</strong><small>الحالة من الاتصال الفعلي لا قيمة افتراضية</small></div>`;
}

async function completeTaskUI(id,status){
  try{await api(`/api/tasks/${encodeURIComponent(id)}/complete`,{method:'POST',body:JSON.stringify({status,result:status==='done'?'تم الإنجاز بواسطة المدير التنفيذي.':'سُجّل كعمل غير مكتمل.'})});await bootstrap();}
  catch(e){alert('❌ '+e.message)}
}

function renderTasks(){
  const g=document.getElementById('tasksGrid'), t=D.state.tasks||[];
  g.innerHTML=t.slice(0,8).map(t=>{
    const a=D.agents.find(x=>x.id===t.agentId), status=TASK_STATUS_LABEL[t.status]||esc(t.status||'جديد');
    const actionable=['queued','working','needs_review','failed'].includes(t.status);
    return `<div class="task-card"><div style="display:flex;justify-content:space-between;gap:8px;"><strong>${a?esc(a.avatar)+' '+esc(a.name):esc(t.agentId)}</strong><span class="status-pill">${esc(status)}</span></div><div>${esc(t.title)}</div><small>${esc(t.description||'')}</small>${t.result?`<small style="color:var(--muted);white-space:pre-wrap;">${esc(t.result)}</small>`:''}${actionable?`<div class="approval-actions"><button class="btn btn-approve" onclick="completeTaskUI('${jsAttr(t.id)}','done')">✓ تم التنفيذ</button><button class="btn btn-secondary" onclick="completeTaskUI('${jsAttr(t.id)}','needs_review')">مراجعة</button></div>`:''}</div>`;
  }).join('')||'<div class="task-card">لا توجد مهام حالياً.</div>';
}

function renderWorkingTeam(){
  const el=document.getElementById('workingTeamList'); if(!el)return;
  const tasks=D.state.tasks||[];
  const busy=t=>t.status==='queued'||t.status==='working';
  const active=(D.agents||[]).filter(a=>a.status==='working'||a.status==='waiting_approval'||tasks.some(t=>t.agentId===a.id&&busy(t)));
  if(!active.length){el.innerHTML='<div class="approval-card">لا يوجد فريق يعمل حالياً. كل الموظفين متاحون أو غير متصلين.</div>';return;}
  el.innerHTML=active.map(a=>{
    const mine=tasks.filter(t=>t.agentId===a.id&&busy(t)).slice(0,3);
    const what=mine.length?mine.map(t=>`${esc(t.title)} <small>(${esc(TASK_STATUS_LABEL[t.status]||t.status)})</small>`).join('؛ '):(a.status==='waiting_approval'?'بانتظار موافقتك على مقترح':esc(a.bubble||'لم يُسند إليه عمل محدد بعد'));
    return `<div class="working-team-card"><div class="working-team-head"><span>${esc(a.avatar)} <strong>${esc(a.name)}</strong></span><span class="status-pill"><i class="dot ${escAttr(a.status)}"></i> ${esc(SL[a.status]||a.status)}</span></div><div class="working-team-dept">${esc(a.department||'')}</div><div class="working-team-work">${what}</div></div>`;
  }).join('');
}

function openAgentChat(id){selectedAgentId=id;switchTab('chat');switchChatMode('direct');renderChatAgentsList();renderDirectChat()}
function selectDirectAgent(id){selectedAgentId=id;renderChatAgentsList();renderDirectChat()}

function renderChatAgentsList(){document.getElementById('chatAgentsList').innerHTML=D.agents.map(a=>`<button class="chat-agent-btn ${a.id===selectedAgentId?'active':''}" onclick="selectDirectAgent('${jsAttr(a.id)}')"><span>${esc(a.avatar)}</span><span style="flex:1">${esc(a.name)}</span><i class="dot ${escAttr(a.status)}"></i></button>`).join('')}

function renderDirectChat(){
  const a=D.agents.find(x=>x.id===selectedAgentId);if(!a)return;
  const g=a.gamification||{points:0,level:1,rankTitle:'موظف تنفيذي'};
  document.getElementById('directChatHeader').innerHTML=`${esc(a.avatar)} ${esc(a.name)} <small style="color:var(--muted);font-weight:400">(${esc(a.department)} | 🏆 ${esc(g.rankTitle)} • 🧠 ${a.memoryCount||0} ذكرى)</small>`;
  const h=D.state.directChats[a.id]||[], el=document.getElementById('directChatMessages');
  const fem=a.id==='executive-assistant';
  el.innerHTML=h.length===0?`<div class="msg assistant"><div class="msg-meta">${esc(a.name)}</div>مرحباً سيادة المدير! أنا ${esc(a.name)}، ${fem?'جاهزة':'جاهز'} لتلقي توجيهاتك.</div>`:h.map(m=>`<div class="msg ${escAttr(m.role)}"><div class="msg-meta">${m.role==='user'?'أنت (CEO)':esc(a.name)}${m.ragUsed?` • 🧠 استرجاع ${m.ragUsed} ذكرى`:''}${m.mode&&m.mode!=='live'?` • ⚠️ ${esc(SL[m.mode]||'رد تجريبي')}`:''}</div>${esc(m.text)}</div>`).join('');
  el.scrollTop=el.scrollHeight;
  document.getElementById('agentInspector').innerHTML=`<h4>ملف الموظف (${esc(a.id)})</h4><div class="inspector-block"><strong>الرتبة والنقاط (Gamification)</strong>المستوى: ${g.level} — ${esc(g.rankTitle)}\nالنقاط: ${g.points}\nالذاكرة المتجهة: ${a.memoryCount||0} ذكرى</div><div class="inspector-block"><strong>الصلاحيات</strong>الأدوات: ${esc((a.allowedTools||[]).join(', ')||'-')}\nموافقة: ${esc((a.requiresApprovalFor||[]).join(', ')||'-')}</div><div class="inspector-block"><strong>الدور</strong>${esc(a.roleMd.slice(0,320))}...</div><div class="inspector-block"><strong>المهارات</strong>${esc(a.skillsMd.slice(0,280))}...</div>`;
}

function renderTeamChat(){
  document.getElementById('attendeeCheckboxes').innerHTML=D.agents.map((a,i)=>`<label class="attendee-pill"><input type="checkbox" class="attendee-check" value="${escAttr(a.id)}" ${i<4?'checked':''} /><span>${esc(a.avatar)} ${esc(a.name)}</span></label>`).join('');
  const el=document.getElementById('teamChatMessages');
  el.innerHTML=(D.state.teamChat||[]).map(m=>`<div class="msg ${escAttr(m.role)}"><div class="msg-meta">${esc(m.senderAvatar||'')} ${esc(m.senderName)}</div>${esc(m.text)}</div>`).join('');
  el.scrollTop=el.scrollHeight;
}

function renderApprovals(){
  const c=document.getElementById('approvalsList'), l=(D.state.approvals||[]).filter(i=>i.risk!=='high');
  c.innerHTML=l.map(i=>`<div class="approval-card ${escAttr(i.status)}"><div style="flex:1"><div style="font-size:11px;color:var(--cyan);margin-bottom:3px;">الموظف: <strong>${esc(i.agentName)}</strong> • الخطورة: <strong>${esc(i.risk)}</strong> • الإجراء: <strong>${esc(i.actionType)}</strong></div><h4>${esc(i.title)}</h4><p style="font-size:12px;color:var(--muted);margin-top:3px;white-space:pre-wrap;">${esc(i.details)}</p>${i.securityNote?`<div style="font-size:11px;color:#fcd34d;margin-top:4px;">${esc(i.securityNote)}</div>`:''}${i.executionResult?`<div style="font-size:12px;color:#6ee7b7;margin-top:5px;">${esc(i.executionResult)}</div>`:''}</div><div class="approval-actions">${i.status==='pending'?`<button class="btn btn-approve" onclick="decideApproval('${jsAttr(i.id)}','approved')">✓ موافقة</button><button class="btn btn-reject" onclick="decideApproval('${jsAttr(i.id)}','rejected')">✕ رفض</button>`:`<span>${i.status==='approved'?'✅ معتمد ومنفّذ':'❌ مرفوض'}</span>`}</div></div>`).join('')||'<div class="approval-card">لا توجد طلبات متوسطة/منخفضة الخطورة حالياً.</div>';
}

function renderHighRiskApprovals(){
  const c=document.getElementById('highRiskApprovalsList'); if(!c)return;
  const l=(D.state.approvals||[]).filter(i=>i.risk==='high');
  c.innerHTML=l.map(i=>`<div class="approval-card high-risk-card ${escAttr(i.status)}"><div style="flex:1"><div style="font-size:11px;color:#fca5a5;margin-bottom:3px;">🛡️ عالي الخطورة • ${esc(i.agentName)} • ${esc(i.actionType)} • ${i.quality&&i.quality.status?`حكم الجودة: ${esc(i.quality.status)}`:'بانتظار حلقة الجودة'}</div><h4>${esc(i.title)}</h4><p style="font-size:12px;color:var(--muted);margin-top:3px;white-space:pre-wrap;">${esc(i.details)}</p>${i.securityNote?`<div style="font-size:11px;color:#fcd34d;margin-top:4px;">${esc(i.securityNote)}</div>`:''}${i.executionResult?`<div style="font-size:12px;color:#6ee7b7;margin-top:5px;">${esc(i.executionResult)}</div>`:''}</div><div class="approval-actions">${i.status==='pending'?`<button class="btn btn-approve" onclick="decideApproval('${jsAttr(i.id)}','approved',true)">⚠️ موافقة صريحة مع تجاوز</button><button class="btn btn-reject" onclick="decideApproval('${jsAttr(i.id)}','rejected')">✕ رفض</button>`:`<span>${i.status==='approved'?'✅ معتمد صريحاً':'❌ مرفوض'}</span>`}</div></div>`).join('')||'<div class="approval-card">لا توجد مقترحات عالية الخطورة حالياً.</div>';
}

async function decideApproval(id,d,override){
  const body={decision:d}; if(override===true)body.override=true;
  try{await api(`/api/approvals/${id}/decide`,{method:'POST',body:JSON.stringify(body)});await bootstrap();}
  catch(e){alert('❌ '+e.message)}
}

function renderVotes(){
  document.getElementById('voterCheckboxes').innerHTML=D.agents.map((a,i)=>`<label class="attendee-pill"><input type="checkbox" class="voter-check" value="${escAttr(a.id)}" ${['web-research-team','auditors-experts-devs','accountant','security-officer'].includes(a.id)?'checked':''} /><span>${esc(a.avatar)} ${esc(a.name)}</span></label>`).join('');
  const c=document.getElementById('votesList'), l=D.state.votes||[];
  c.innerHTML=l.map(v=>{
    const total=v.ballots.length||1;
    const bars=v.options.map(opt=>{
      const cnt=v.tally[opt]||0, pct=Math.round((cnt/total)*100);
      return `<div class="vote-bar-wrap"><div class="vote-bar-fill" style="width:${pct}%"></div><div class="vote-bar-label"><span>${esc(opt)} ${opt===v.winner?'🏆':''}</span><span>${cnt} أصوات (${pct}%)</span></div></div>`;
    }).join('');
    const details=v.ballots.map(b=>`<div style="font-size:11px;color:var(--muted);margin-top:4px;">${esc(b.avatar)} <strong>${esc(b.agentName)}</strong> ← اختار (<strong>${esc(b.choice)}</strong>): ${esc(b.reason)}</div>`).join('');
    return `<div class="approval-card" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div><span style="font-size:11px;color:var(--cyan);">🗳️ تصويت ديمقراطي • الفائز: <strong>${esc(v.winner)}</strong></span><h4>${esc(v.topic)}</h4></div>
        ${v.convertedToApproval?'<span style="font-size:12px;color:var(--green);">✅ مرفوع للموافقات</span>':`<button class="btn btn-approve" onclick="convertVoteToApproval('${jsAttr(v.id)}')">✓ رفع الفائز للاعتماد</button>`}
      </div>
      <div style="margin-top:8px;">${bars}</div>
      <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px;">${details}</div>
    </div>`;
  }).join('')||'<div class="approval-card">لم يتم إجراء تصويت ديمقراطي بعد.</div>';
}
async function convertVoteToApproval(id){await api(`/api/votes/${id}/to-approval`,{method:'POST'});await bootstrap();switchTab('approvals')}

function renderCRM(){
  const list=D.state.customers||[];
  const totalContract=list.reduce((s,c)=>s+(c.totalValueUsd||0),0);
  const totalPaid=list.reduce((s,c)=>s+(c.paidUsd||0),0);
  document.getElementById('crmSummary').innerHTML=`
    <div class="pnl-card net"><div>👥 إجمالي العملاء</div><div class="pnl-value">${list.length}</div></div>
    <div class="pnl-card api"><div>📄 قيمة العقود</div><div class="pnl-value">$${totalContract.toFixed(2)}</div></div>
    <div class="pnl-card revenue"><div>💵 المحصّل فعلياً</div><div class="pnl-value">$${totalPaid.toFixed(2)}</div></div>
  `;
  document.getElementById('customersList').innerHTML=list.map(c=>`
    <div class="approval-card">
      <div style="flex:1">
        <div style="font-size:11px;color:var(--cyan);">الحالة: <strong>${esc(c.stage)}</strong> • ${esc(c.contactName||'')} (${esc(c.email||'-')})</div>
        <h4>💼 ${esc(c.name)} — ${esc(c.projectTitle)}</h4>
        <div style="font-size:12px;color:var(--muted);margin-top:3px;">العقد: $${esc(c.totalValueUsd||0)} | المدفوع: <strong style="color:var(--green)">$${esc(c.paidUsd||0)}</strong> • ${esc(c.notes)}</div>
      </div>
      <div class="approval-actions">
        <a class="btn btn-cyan" style="text-decoration:none" href="portal.html?t=${encodeURIComponent(c.portalToken||'')}" target="_blank" rel="noopener">🔗 بوابة العميل</a>
        <button class="btn btn-approve" onclick="recordCustomerPayment('${jsAttr(c.id)}')">💵 دفعة مالية</button>
        <button class="btn btn-secondary" onclick="sendCustomerMarketing('${jsAttr(c.id)}')">📣 متابعة تسويقية</button>
      </div>
    </div>
  `).join('')||'<div class="approval-card">لا يوجد عملاء بعد.</div>';
}
async function recordCustomerPayment(id){
  const amt=prompt('أدخل قيمة الدفعة المستلمة بالدولار ($):','100');
  if(!amt||isNaN(amt)||Number(amt)<=0)return;
  await api(`/api/customers/${id}/payment`,{method:'POST',body:JSON.stringify({amountUsd:Number(amt)})});
  alert('✅ تم تسجيل الدفعة وتحديث لوحة الأرباح والخسائر والمحاسبة!');
  await bootstrap();
}
async function sendCustomerMarketing(id){
  await api(`/api/customers/${id}/marketing`,{method:'POST'});
  alert('📣 جهّز مسؤول التسويق رسالة المتابعة وأرسلها لقائمة "بانتظار الموافقة"!');
  await bootstrap();switchTab('approvals');
}

function renderKPI(){
  const sorted=[...D.agents].sort((a,b)=>(b.gamification?.points||0)-(a.gamification?.points||0));
  document.getElementById('leaderboardGrid').innerHTML=sorted.map((a,i)=>{
    const g=a.gamification||{points:0,level:1,rankTitle:'موظف تنفيذي',badges:[]};
    return `<div class="task-card"><strong>#${i+1} ${esc(a.avatar)} ${esc(a.name)}</strong><div class="rank-badge">المستوى ${esc(g.level)}: ${esc(g.rankTitle)}</div><div style="margin-top:5px;font-size:13px;color:var(--cyan)">⭐ ${esc(g.points)} نقطة</div><small>${(g.badges||[]).slice(-2).map(esc).join(' • ')}</small></div>`;
  }).join('');
  const l=D.state.kpiReviews||[];
  document.getElementById('kpiList').innerHTML=l.map(r=>`<div class="approval-card"><div><div style="font-size:11px;color:var(--cyan);">📈 ${esc(r.reviewerName)} • ${esc(r.timestamp?.slice(0,10)||'')}</div><p style="font-size:13px;white-space:pre-wrap;margin-top:5px;">${esc(r.report)}</p></div></div>`).join('')||'<div class="approval-card">لم يتم تشغيل تقييم المدربة بعد. اضغط "تشغيل تقييم المدربة الآن" لتوزيع النقاط والترقيات.</div>';
}

function renderDecisionLog(){
  const dl=document.getElementById('decisionLogList'); if(!dl)return;
  const decisions=(D.state.decisionLog||[]).slice(0,30);
  dl.innerHTML=decisions.map(d=>`<div class="approval-card"><div style="flex-direction:column;align-items:stretch;gap:4px;">
    <div style="font-size:11px;color:var(--muted);">🧾 ${esc(d.id)} • ${esc(d.at||'')} • ${d.decision==='approved'?'✅ اعتماد':'❌ رفض'} • خطورة: ${esc(d.risk||'medium')}</div>
    <strong>${esc(d.title||'')}</strong>
    <div style="font-size:12px;">🛡️ حارس المراجعة: <span style="color:${d.redTeam==='NOT_REQUIRED'?'var(--muted)':'#fcd34d'}">${esc(d.redTeam||'غير مسجّل')}</span></div>
    <div style="font-size:12px;">🔬 دليل الجودة: ${esc(d.qualityStatus||'no-qa-report')} ${(d.qualityVerdicts||[]).length?'— '+esc((d.qualityVerdicts||[]).join(' / ')):''}${d.override?' • ⚠️ override=true':''}</div>
    ${d.reason?`<small style="color:var(--muted)">السبب: ${esc(d.reason)}</small>`:''}
  </div></div>`).join('')||'<div class="approval-card">لا توجد قرارات موثّقة بعد. كل موافقة ستُسجَّل بدليل الجودة وسبب التجاوز إن وُجد.</div>';
}

function renderAgentBenchmarks(){
  const el=document.getElementById('agentBenchmarks'); if(!el)return;
  const rows=(D.providerStatus&&D.providerStatus.benchmarks)||[];
  el.innerHTML=D.agents.map(a=>{
    const best=rows.filter(r=>r.role===a.id).sort((x,y)=>(y.score||0)-(x.score||0))[0];
    if(!best)return `<div class="bench-card"><strong>${esc(a.avatar)} ${esc(a.name)}</strong><span style="color:var(--muted)">لم يُختبر نموذج لهذا الدور بعد.</span></div>`;
    return `<div class="bench-card"><strong>${esc(a.avatar)} ${esc(a.name)}</strong><div>${esc(best.provider)} / ${esc(best.model)}</div><div class="${best.passed?'pass':'fail'}">${best.passed?'✅ اجتاز':'❌ لم يجتز'} — ${Number(best.score||0)}/100 <span style="color:var(--muted)">(تقدير إرشادي)</span></div><small style="color:var(--muted)">${esc(String(best.breakdown||'').slice(0,90))}</small></div>`;
  }).join('');
}

function renderMemos(){
  const c=document.getElementById('memosList'), l=(D.state.internalMemos||[]).slice().reverse();
  c.innerHTML=l.map(m=>`<div class="approval-card ${m.read?'read':''}"><div style="flex:1"><div style="font-size:11px;color:var(--cyan);margin-bottom:3px;">${esc(m.fromAvatar)} ${esc(m.fromName)} ← إلى → ${esc(m.toAvatar)} ${esc(m.toName)} • ${esc(m.timestamp?.slice(0,10)||'')} • ${m.read?'✅ مقروء':'🔵 غير مقروء'}</div><h4>📨 ${esc(m.subject)}</h4><p style="font-size:12px;color:var(--muted);margin-top:3px;">${esc(m.body)}</p></div><div class="approval-actions"><button class="btn btn-secondary" onclick="forwardMemoToAssistant('${jsAttr(m.id)}')">🧠 أرسل للمساعد</button>${m.read?'':`<button class="btn btn-secondary" onclick="markMemoRead('${jsAttr(m.id)}')">✓ مقروء</button>`}</div></div>`).join('')||'<div class="approval-card">لا توجد مذكرات داخلية حالياً.</div>';
}

async function markMemoRead(id){
  try{await api('/api/memos/read',{method:'POST',body:JSON.stringify({id:id})});const m=(D.state.internalMemos||[]).find(x=>x.id===id);if(m)m.read=true;renderStats();renderMemos();}
  catch(e){alert('❌ '+e.message)}
}

async function markAllMemosRead(){
  const ids=(D.state.internalMemos||[]).filter(m=>m.read!==true).map(m=>m.id);
  if(!ids.length)return;
  try{await api('/api/memos/read',{method:'POST',body:JSON.stringify({ids:ids})});ids.forEach(id=>{const m=(D.state.internalMemos||[]).find(x=>x.id===id);if(m)m.read=true;});renderStats();renderMemos();}
  catch(e){alert('❌ '+e.message)}
}

async function forwardMemoToAssistant(id){
  const m=(D.state.internalMemos||[]).find(x=>x.id===id); if(!m)return;
  if(m.read!==true){try{await api('/api/memos/read',{method:'POST',body:JSON.stringify({id:id})});m.read=true;renderStats();renderMemos();}catch(e){}}
  const text='مذكرة داخلية من '+m.fromName+' إلى '+m.toName+' — الموضوع: '+m.subject+'\nالمحتوى: '+(m.body||'');
  switchTab('chat');switchChatMode('assistant');
  const inp=document.getElementById('assistantChatInput'); if(inp)inp.value='';
  await assistantSend(text);
}

function renderKnowledge(){
  document.getElementById('knowledgeEditorList').innerHTML=(D.knowledgeFiles||[]).map((k,i)=>`<div class="k-item"><strong>${esc(k.filename)}</strong><textarea id="k-content-${i}" rows="4">${esc(k.content)}</textarea><button class="btn btn-secondary" onclick="saveKnowledge('${jsAttr(k.filename)}',${i})">حفظ</button></div>`).join('');
  document.getElementById('exportsList').innerHTML=(D.exports||[]).map(ex=>`<div class="inspector-block"><strong>📄 ${esc(ex.filename)} (${ex.size} bytes)</strong>${esc(ex.preview)}</div>`).join('')||'<div class="inspector-block">لم يتم تصدير ملفات بعد.</div>';
}
async function saveKnowledge(fn,i){const c=document.getElementById(`k-content-${i}`).value;await api('/api/knowledge',{method:'POST',body:JSON.stringify({filename:fn,content:c})});alert(`تم حفظ ${fn}`);await bootstrap()}

function renderPnL(){
  const ledger=D.state.financialLedger||[], u=D.state.usageStats||{totalCostUsd:0};
  const totalRev=ledger.filter(e=>e.type==='revenue').reduce((s,e)=>s+e.amountUsd,0);
  const totalExp=ledger.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amountUsd,0);
  const apiCost=Number(u.totalCostUsd||0), net=totalRev-totalExp-apiCost;
  document.getElementById('pnlSummary').innerHTML=`
    <div class="pnl-card revenue"><div>💰 إجمالي الإيرادات</div><div class="pnl-value">$${totalRev.toFixed(2)}</div></div>
    <div class="pnl-card expense"><div>📉 إجمالي المصروفات</div><div class="pnl-value">$${totalExp.toFixed(2)}</div></div>
    <div class="pnl-card api"><div>🤖 تكاليف APIs</div><div class="pnl-value">$${apiCost.toFixed(4)}</div></div>
    <div class="pnl-card net"><div>📊 صافي الربح</div><div class="pnl-value">${net>=0?'+':''}$${net.toFixed(2)}</div></div>
  `;
  const canvas=document.getElementById('pnlChart'), ctx=canvas.getContext('2d');
  if(ctx){
    const w=canvas.width, h=canvas.height; ctx.clearRect(0,0,w,h);
    const bars=[{label:'إيرادات',val:totalRev,color:'#10b981'},{label:'مصروفات',val:totalExp,color:'#ef4444'},{label:'APIs',val:apiCost,color:'#f59e0b'},{label:'صافي',val:Math.abs(net),color:net>=0?'#06b6d4':'#ef4444'}];
    const maxVal=Math.max(...bars.map(b=>b.val),1), barW=w/bars.length-30;
    bars.forEach((b,i)=>{const bh=(b.val/maxVal)*(h-50),x=i*(barW+30)+20;ctx.fillStyle=b.color;ctx.globalAlpha=.75;ctx.fillRect(x,h-30-bh,barW,bh);ctx.globalAlpha=1;ctx.fillStyle='#eef2ff';ctx.font='bold 12px Cairo';ctx.textAlign='center';ctx.fillText(b.label,x+barW/2,h-14);ctx.fillText(`$${b.val.toFixed(2)}`,x+barW/2,h-32-bh)});
  }
  document.getElementById('ledgerList').innerHTML=ledger.slice().reverse().map(e=>`<div class="approval-card"><div><div style="font-size:11px;color:${e.type==='revenue'?'var(--green)':'var(--red)'};">${e.type==='revenue'?'💰 إيراد':'📉 مصروف'} • ${esc(e.date)}${e.project?` • 📁 ${esc(e.project)}`:''}</div><strong>${esc(e.title)}</strong> — $${Number(e.amountUsd||0).toFixed(2)}<br/><small style="color:var(--muted)">${esc(e.notes)}</small></div></div>`).join('')||'<div class="approval-card">لا توجد قيود مالية.</div>';
  const projects={};
  ledger.forEach(e=>{const key=e.project||'بدون مشروع';if(!projects[key])projects[key]={revenue:0,expense:0};projects[key][e.type==='revenue'?'revenue':'expense']+=Number(e.amountUsd||0);});
  const byAgent=D.state.usageStats?.byAgent||{};
  const apiByProject=Number(u.totalCostUsd||0);
  const projectCards=Object.keys(projects).map(name=>{const p=projects[name], share=p.revenue?Math.min(1,apiByProject/Math.max(1,Object.keys(projects).length)):0, net=p.revenue-p.expense-share;return `<div class="pnl-card"><div>📁 ${esc(name)}</div><div class="pnl-value">$${net.toFixed(2)}</div><small>إيراد ${p.revenue.toFixed(0)} − مصروف ${p.expense.toFixed(0)} − API ~$${share.toFixed(2)}</small></div>`;}).join('');
  const projectBox=document.getElementById('projectProfitability');
  if(projectBox)projectBox.innerHTML=`<h3 style="font-size:14px;margin:12px 0 8px;">🏷️ الربحية لكل مشروع</h3><div class="pnl-summary">${projectCards||'<div class="approval-card">أضف قيداً مالياً ومشروعاً لعرض الربحية.</div>'}</div><p style="font-size:11px;color:var(--muted);margin-top:6px;">تكلفة API موزّعة بالتساوي على المشاريع كتقدير شفاف؛ التكلفة الحقيقية تُسجَّل لكل نموذج في سجل التدقيق.</p>`;
  renderCostForecast();
}

function renderCostForecast(){
  const el=document.getElementById('costForecast'); if(!el)return;
  const now=new Date(), month=now.toISOString().slice(0,7);
  const created=new Date((D.state.meta&&D.state.meta.createdAt)||now.toISOString());
  const days=Math.max(1,(now-created)/86400000);
  const u=D.state.usageStats||{};
  const apiToday=Number(u.totalCostUsd||0);
  const monthlyApi=apiToday/days*30;
  const monthlyExpense=(D.state.financialLedger||[]).filter(e=>e.type==='expense'&&String(e.date||'').slice(0,7)===month).reduce((s,e)=>s+Number(e.amountUsd||0),0);
  const tokensPerDay=Number(u.totalTokens||0)/days;
  el.innerHTML=`<h3 style="font-size:14px;margin-bottom:8px;">📅 توقع تكاليف الشهر الحالي</h3><div class="pnl-summary"><div class="pnl-card api"><div>🤖 واجهات الذكاء</div><div class="pnl-value">$${monthlyApi.toFixed(2)}</div></div><div class="pnl-card expense"><div>📉 مصروفات هذا الشهر</div><div class="pnl-value">$${monthlyExpense.toFixed(2)}</div></div><div class="pnl-card"><div>🪙 توكنات/يوم</div><div class="pnl-value">${Math.round(tokensPerDay)}</div></div><div class="pnl-card net"><div>💵 إجمالي متوقع</div><div class="pnl-value">$${(monthlyApi+monthlyExpense).toFixed(2)}</div></div></div><p style="font-size:11px;color:var(--muted);margin-top:8px;">الحساب مبني على ${days.toFixed(1)} يوم من الاستخدام الفعلي. إذا لم تُسجَّل تكلفة حية فسيظهر $0 بدل رقم وهمي.</p>`;
}

function renderSchedules(){
  document.getElementById('schedulesList').innerHTML=(D.state.schedules||[]).map(s=>`<div class="approval-card"><div style="flex:1"><div style="font-size:11px;color:var(--cyan);">🕐 ${s.frequency==='daily'?'يومي الساعة '+esc(s.targetHour)+':00':'أسبوعي الساعة '+esc(s.targetHour)+':00'}</div><strong>${esc(s.name)}</strong><div style="font-size:12px;color:var(--muted);margin-top:3px;">آخر تشغيل: ${esc(s.lastRunAt||'لم يعمل بعد')} • الحالة: ${esc(s.lastStatus||'جاهز')}</div></div><div class="approval-actions"><label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" ${s.enabled?'checked':''} onchange="toggleSchedule('${jsAttr(s.id)}',this.checked)" />${s.enabled?'مفعّل':'معطّل'}</label><button class="btn btn-secondary" onclick="triggerSchedule('${jsAttr(s.id)}')">▶️ تشغيل الآن</button></div></div>`).join('');
}
async function toggleSchedule(id,enabled){await api('/api/schedules/toggle',{method:'POST',body:JSON.stringify({scheduleId:id,enabled})});await bootstrap()}
async function triggerSchedule(id){
  const btn=event?.target; if(btn){btn.disabled=true;btn.textContent='⏳...';}
  try{await api('/api/schedules/run-now',{method:'POST',body:JSON.stringify({scheduleId:id})});await bootstrap();}
  finally{if(btn){btn.disabled=false;btn.textContent='▶️ تشغيل الآن';}}
}
async function runHrWorkloadCheckNow(){
  const r=await api('/api/hr/check-workload',{method:'POST'});
  if(r.proposalsCount>0){alert(`👩‍💼 رصدت مديرة الموارد البشرية ضغط عمل وأضافت ${r.proposalsCount} مقترح توظيف في قائمة الموافقات!`);await bootstrap();switchTab('approvals');}
  else{alert('✅ جميع الأقسام متوازنة حالياً ولا يوجد ضغط عمل يتطلب توظيفاً إضافياً (أضف 2+ مهام لقسم معين لاختبار التوسع الذاتي).');}
}

function renderSandbox(){
  api('/api/sandbox/git').then(g=>{document.getElementById('gitInfo').innerHTML=`<div class="inspector-block"><strong>حالة Git</strong>${g.isGitRepo?`الفرع الحالي: <strong>${esc(g.branch)}</strong>\nالفروع: ${esc(g.branches.join(', ')||'-')}\nالتعديلات: ${g.changes.length||'لا يوجد'}`:'لا يوجد مستودع Git مهيأ.'}</div>`}).catch(()=>{});
  document.getElementById('sandboxFilesList').innerHTML=(D.sandboxFiles||[]).map(f=>`<div class="inspector-block"><strong>📝 ${esc(f.filename)} (${f.size} bytes)</strong>${esc(f.content.slice(0,300))}</div>`).join('')||'<div class="inspector-block">لا توجد ملفات تجريبية بعد.</div>';
}

function renderOrgChart(){document.getElementById('orgChartContainer').innerHTML=`<div class="org-ceo">👑 المدير التنفيذي (CEO - أنت)</div><div class="org-grid">${D.agents.map(a=>`<div class="org-node"><div style="font-size:20px;margin-bottom:4px;">${esc(a.avatar)}</div><strong>${esc(a.name)}</strong><div style="font-size:11px;color:var(--cyan);">${esc(a.department)}</div><div class="rank-badge">${esc(a.gamification?.rankTitle||'موظف تنفيذي')}</div></div>`).join('')}</div>`}

function renderAuditCost(){
  const ba=(D.state.usageStats&&D.state.usageStats.byAgent)||{};
  document.getElementById('costBreakdown').innerHTML=D.agents.map(a=>{const s=ba[a.id]||{tokens:0,costUsd:0};return `<div class="task-card"><strong>${esc(a.avatar)} ${esc(a.name)}</strong><div>${s.tokens} tokens</div><small>$${Number(s.costUsd).toFixed(5)}</small></div>`;}).join('');
  renderAuditRows(D.auditLog||[]);
}

function renderAuditRows(entries){
  const el=document.getElementById('auditLogList'); if(!el)return;
  el.innerHTML=(entries||[]).map(e=>`<div class="approval-card audit-hit"><div><div style="font-size:11px;color:var(--cyan);">${esc(e.timestamp)} • <strong class="audit-term">${esc(e.eventType)}</strong> • <span class="audit-term">${esc(e.actor)}</span></div><div style="font-size:12px;"><span class="audit-term">${esc(e.summary)}</span></div></div></div>`).join('')||'<div class="approval-card">لا توجد نتائج مطابقة.</div>';
}

async function searchAudit(q){
  try{const r=await api('/api/audit/search?q='+encodeURIComponent(q));renderAuditRows(r.entries||[]);}catch(e){renderAuditRows([])}
}

function renderIntegrations(){
  const o=D.outgoingWebhooks||{};
  document.getElementById('integrationsStatus').innerHTML=`
    <div class="webhook-card"><strong>📱 Telegram</strong><div style="font-size:12px;color:var(--muted);margin:4px 0;">${D.telegramEnabled?'🟢 متصل ونشط':'🟡 أضف TELEGRAM_BOT_TOKEN في .env'}</div></div>
    <div class="webhook-card"><strong>⚡ n8n / Make</strong><div style="font-size:12px;color:var(--muted);margin:4px 0;">${o.n8n?'🟢 مهيأ':'🟡 غير مهيأ'}</div><button class="btn btn-secondary" onclick="testWebhook('n8n')">اختبار</button></div>
    <div class="webhook-card"><strong>📣 التسويق</strong><div style="font-size:12px;color:var(--muted);margin:4px 0;">${o.marketing?'🟢 مهيأ':'🟡 غير مهيأ'}</div><button class="btn btn-secondary" onclick="testWebhook('marketing')">اختبار</button></div>
  `;
  document.getElementById('webhooksGrid').innerHTML=(D.state.webhooks||[]).map(w=>`<div class="webhook-card"><strong>${esc(w.name)}</strong><code>${esc(w.method)} ${esc(w.endpoint)}</code><div style="font-size:12px;color:var(--muted);">أمان: ${w.securityReviewed?'🛡️ معتمد':'⏳ بانتظار المراجعة'} • الحالة: <strong>${esc(w.status)}</strong></div></div>`).join('');
}
async function testWebhook(t){const r=await api('/api/webhooks/test',{method:'POST',body:JSON.stringify({target:t})});alert(r.dispatched?`✅ تم (${r.status})`:`⚠️ ${r.reason}`)}

function populateSelects(){
  const opts=D.agents.map(a=>`<option value="${escAttr(a.id)}">${esc(a.avatar)} ${esc(a.name)}</option>`).join('');
  document.getElementById('taskAgentSelect').innerHTML=opts;
  document.getElementById('memoFromSelect').innerHTML=opts;
  document.getElementById('memoToSelect').innerHTML=opts;
  document.getElementById('awardAgentSelect').innerHTML=opts;
}

function speakText(t,id){if(!document.getElementById('ttsToggle').checked||!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t.slice(0,350));u.lang='ar-SA';const p=VP[id]||{pitch:1,rate:1};u.pitch=p.pitch;u.rate=p.rate;window.speechSynthesis.speak(u)}
function startMic(inputId){const S=window.SpeechRecognition||window.webkitSpeechRecognition;if(!S)return alert('متصفحك لا يدعم التعرف على الصوت.');const r=new S();r.lang='ar-SA';r.onresult=e=>{document.getElementById(inputId).value=e.results[0][0].transcript};r.start()}

function switchTab(t){document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${t}`));renderActiveTab(t)}
function switchChatMode(m){
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.chatmode===m));
  document.getElementById('directChatView').classList.toggle('hidden',m!=='direct');
  document.getElementById('teamChatView').classList.toggle('hidden',m!=='team');
  const av=document.getElementById('assistantChatView'); if(av)av.classList.toggle('hidden',m!=='assistant');
  if(m==='assistant')renderAssistantChat();
}

function assistantList(items,empty){
  const a=(items||[]).filter(Boolean);
  return a.length?`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<span style="color:var(--muted)">${esc(empty||'—')}</span>`;
}

function renderAssistantChat(){
  const box=document.getElementById('assistantChatMessages'); if(!box)return;
  const send=document.getElementById('assistantSendBtn');
  if(!assistantSession){
    box.innerHTML='<div class="msg assistant"><div class="msg-meta">المساعد الذكي</div>اكتب طلبك بأي لهجة (مصرية، خليجية، شامية، مغربية أو فصحى). سأعرض ما فهمته أولاً، وأسأل عن النواقص، وأبحث في المهام الصعبة، ثم أوزّع الأدوار بعد موافقتك.</div>';
    if(send)send.textContent='افهم الطلب';
    return;
  }
  const s=assistantSession, u=s.understanding||{};
  let html=`<div class="msg user"><div class="msg-meta">أنت (CEO)</div>${esc(s.original||'')}</div>`;
  html+=`<div class="msg assistant understanding"><div class="msg-meta">🧠 ما فهمته — ${esc(s.mode==='live'?'فهم حي':'فهم محلي')} • ثقة ${Number(s.confidence||0)}%</div>`+
    `<strong>الهدف:</strong> ${esc(u.goal||'—')}\n<strong>النطاق:</strong> ${esc(u.scope||'—')}\n<strong>المخرجات:</strong> ${esc(u.deliverables||'—')}`+
    `\n<strong>القيود:</strong>${assistantList(u.constraints,'لا توجد قيود صريحة')}`+
    `\n<strong>المخاطر:</strong>${assistantList(u.risks,'لم تُذكر مخاطر')}`+
    `\n<strong>ما اقترحه:</strong>${assistantList(u.suggestions,'لا توجد مقترحات إضافية')}</div>`;
  const led=(D.state.requestLedger||[]).find(x=>x.id===s.ledgerId);
  if(led){
    html+=`<div class="msg assistant"><div class="msg-meta">📒 كل ما طلبته — عناصر الطلب</div><ul>${(led.items||[]).map(i=>`<li>${esc(i.text)} <small>(${esc(i.status==='executed'?'تم التنفيذ':i.status==='needs_approval'?'بانتظار موافقة':i.status==='unclear'?'غير واضح':'مفهوم')})</small></li>`).join('')||'<li>—</li>'}</ul></div>`;
    html+=`<div class="msg assistant"><div class="msg-meta">🚫 ما لم أفهمه${s.status!=='awaiting_confirmation'?' (قبل التأكيد)':''}</div>${assistantList(s.unresolved||led.unresolved,'لا يوجد — الطلب كان واضحاً.')}</div>`;
  }
  if(s.status==='awaiting_confirmation'){
    html+=`<div class="msg assistant"><div class="msg-meta">❓ أسئلة توضيحية قبل التنفيذ</div>${assistantList(s.questions,'لا توجد أسئلة — الطلب واضح بما يكفي.')}<div class="msg-actions"><button class="btn btn-approve" onclick="assistantConfirm()">✅ فهمت صح — أكمل البحث والتوزيع</button><button class="btn btn-secondary" onclick="assistantCancel()">✕ ألغِ الجلسة</button></div></div>`;
  }
  if((s.research||[]).length){
    html+=`<div class="msg assistant research"><div class="msg-meta">🔎 بحث في المهام الصعبة</div>`+s.research.map(r=>`<div style="margin-bottom:6px;"><strong>${esc(r.task||'')}</strong> — محرك: ${esc(r.engine||'unavailable')}${r.note?` • ${esc(r.note)}`:''}<ul>${(r.results||[]).map(x=>`<li><a href="${/^https?:\/\//i.test(x.url||'')?escAttr(x.url):'#'}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan)">${esc(x.title)}</a></li>`).join('')}</ul>${(r.solutions||[]).length?`<div><strong>مسارات الحل المقترحة:</strong>${assistantList(r.solutions,'—')}</div>`:''}</div>`).join('')+`</div>`;
  }
  if((s.plan||[]).length){
    html+=`<div class="msg assistant plan"><div class="msg-meta">👥 توزيع الأدوار المقترح</div><ul>${s.plan.map(p=>`<li><strong>${esc(p.avatar||'🤖')} ${esc(p.agentName)}</strong> — ${esc(p.taskTitle)} <small style="color:var(--muted)">(${esc(p.reason||'')})</small></li>`).join('')}</ul>`+
      (s.status==='awaiting_execution'?`<div class="msg-actions"><button class="btn btn-primary" onclick="assistantExecute()">🚀 اعتمد الخطة وأنفّذ المهام</button><button class="btn btn-secondary" onclick="assistantCancel()">✕ ألغِ</button></div>`:'')+`</div>`;
  }
  if(s.status==='done')html+=`<div class="msg assistant"><div class="msg-meta">✅ النتيجة</div>${esc(s.result||'تم تنفيذ الخطة.')}</div>`;
  if(s.status==='cancelled')html+=`<div class="msg assistant"><div class="msg-meta">تم الإلغاء</div>ألغيت الجلسة. اكتب طلباً جديداً متى شئت.</div>`;
  box.innerHTML=html; box.scrollTop=box.scrollHeight;
  if(send)send.textContent=s.status==='awaiting_confirmation'?'أضف تعديلاً':'افهم الطلب';
}

function renderRequestLedger(){
  const box=document.getElementById('requestLedger'); if(!box)return;
  const list=(D.state.requestLedger||[]);
  if(!list.length){box.innerHTML='<div class="approval-card">لم تصدر أي طلبات بعد. اكتب للموظف أو للفريق أو للمساعد وسيظهر هنا كل ما فهمته وما لم أفهمه.</div>';return;}
  const label=s=>s==='executed'?'تم التنفيذ':s==='needs_approval'?'بانتظار موافقة':s==='unclear'?'غير واضح':'مفهوم';
  box.innerHTML=list.slice(0,25).map(e=>{
    const items=(e.items||[]).map(i=>`<li class="ledger-${esc(i.status)}">${esc(i.text)} <small>(${esc(i.clarification?'توضيح مفهوم':label(i.status))}${i.taskId?' • '+esc(i.taskId):''}${i.approvalId?' • '+esc(i.approvalId):''}${i.result?' • '+esc(i.result):''})</small></li>`).join('')||'<li>—</li>';
    const unclear=(e.unresolved||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>لا يوجد</li>';
    const notes=(e.constraints||[]).length?`<div class="ledger-notes">🔎 قيود وتوضيحات: ${(e.constraints||[]).map(x=>esc(x)).join(' • ')}</div>`:'';
    return `<div class="ledger-entry"><div class="ledger-head"><strong>${esc(e.source)} • ${esc((e.createdAt||'').slice(0,19).replace('T',' '))}</strong><span>${e.executed?'✅ منفّذ':e.acknowledged?'⏳ أُقرّ بالفهم':'⏳ قيد المعالجة'}</span></div>`+
      `<div class="ledger-original">📝 ${esc(e.original||'')}</div>${notes}`+
      `<div class="ledger-cols"><div><strong>ما فهمته</strong><ul>${items}</ul></div><div><strong>ما لم أفهمه</strong><ul>${unclear}</ul></div></div>`+
      `${e.executionSummary?`<div class="ledger-result">${esc(e.executionSummary)}</div>`:''}</div>`;
  }).join('');
}

async function assistantSend(message){
  try{
    const route=assistantSession&&(assistantSession.status==='awaiting_confirmation'||assistantSession.status==='awaiting_execution')?'/api/assistant/confirm':'/api/assistant/start';
    const body=route.indexOf('confirm')!==-1?{sessionId:assistantSession.id,confirmed:false,answer:message}:{message:message};
    const r=await api(route,{method:'POST',body:JSON.stringify(body)});
    assistantSession=r.session; renderAssistantChat(); await bootstrap();
  }catch(e){alert('❌ '+e.message)}
}
async function assistantConfirm(){
  try{const r=await api('/api/assistant/confirm',{method:'POST',body:JSON.stringify({sessionId:assistantSession.id,confirmed:true})});assistantSession=r.session;renderAssistantChat();await bootstrap();}
  catch(e){alert('❌ '+e.message)}
}
async function assistantCancel(){
  if(!assistantSession)return;
  try{const r=await api('/api/assistant/cancel',{method:'POST',body:JSON.stringify({sessionId:assistantSession.id})});assistantSession=r.session;renderAssistantChat();}
  catch(e){alert('❌ '+e.message)}
}
async function assistantExecute(){
  try{const r=await api('/api/assistant/execute',{method:'POST',body:JSON.stringify({sessionId:assistantSession.id})});assistantSession=r.session;renderAssistantChat();await bootstrap();switchTab('office');}
  catch(e){alert('❌ '+e.message)}
}

// Listeners
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{
  if('Notification' in window&&Notification.permission==='default'){try{Notification.requestPermission()}catch(e){}}
  switchTab(b.dataset.tab);if(b.dataset.tab==='memos')markAllMemosRead();
}));
document.getElementById('staffSearchInput')?.addEventListener('input',e=>{staffQuery=e.target.value||'';renderOfficeRooms()});
document.getElementById('officeRooms')?.addEventListener('click',e=>{const card=e.target.closest?.('[data-agent-id]');if(card)openAgentChat(card.dataset.agentId)});
const TAB_HOTKEYS={'1':'office','2':'chat','3':'approvals','4':'votes','5':'crm','6':'kpi','7':'memos','8':'pnl','9':'scheduler','0':'org','q':'knowledge','w':'sandbox','e':'audit','r':'integrations','t':'simulator','y':'playbooks','u':'snapshots','i':'incident'};
document.addEventListener('keydown',e=>{
  if(!e.altKey||e.ctrlKey||e.metaKey)return;
  const t=TAB_HOTKEYS[String(e.key).toLowerCase()];if(!t)return;
  e.preventDefault();switchTab(t);
});
document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>switchChatMode(b.dataset.chatmode)));
document.getElementById('directMicBtn').onclick=()=>startMic('directChatInput');
document.getElementById('teamMicBtn').onclick=()=>startMic('teamChatInput');
document.getElementById('assistantMicBtn').onclick=()=>startMic('assistantChatInput');
document.getElementById('assistantChatForm').addEventListener('submit',async e=>{e.preventDefault();const inp=document.getElementById('assistantChatInput'),btn=document.getElementById('assistantSendBtn'),t=inp.value.trim();if(!t)return;inp.value='';btn.disabled=true;btn.textContent='⏳...';try{await assistantSend(t);}finally{btn.disabled=false;renderAssistantChat();}});
document.getElementById('smartAssistantBtn').onclick=()=>{switchTab('chat');switchChatMode('assistant');document.getElementById('assistantChatInput').focus();};

document.getElementById('quickHealthBtn').onclick=async()=>{
  const b=document.getElementById('quickHealthBtn'), box=document.getElementById('healthResult');
  b.disabled=true;b.textContent='⏳ جارٍ الفحص...';document.getElementById('healthModal').classList.remove('hidden');box.textContent='جارٍ الفحص...';
  try{
    const r=await api('/api/health/check',{method:'POST'});
    box.textContent=r.report||JSON.stringify(r,null,2);
  }catch(e){box.textContent='❌ '+e.message}
  finally{b.disabled=false;b.textContent='🩺 فحص الصحة'}
};
document.getElementById('closeHealthModalBtn').onclick=()=>document.getElementById('healthModal').classList.add('hidden');

document.getElementById('auditSearchInput').addEventListener('input',e=>{
  clearTimeout(auditSearchTimer);
  const q=e.target.value.trim();
  if(!q){renderAuditRows(D.auditLog||[]);return;}
  auditSearchTimer=setTimeout(()=>searchAudit(q),220);
});

document.getElementById('directChatForm').addEventListener('submit',async e=>{e.preventDefault();const inp=document.getElementById('directChatInput'),btn=document.getElementById('directSendBtn'),t=inp.value.trim();if(!t||!selectedAgentId)return;inp.value='';btn.disabled=true;btn.textContent='...';try{const r=await api('/api/chat/direct',{method:'POST',body:JSON.stringify({agentId:selectedAgentId,message:t})});await bootstrap();if(r.reply?.mode&&r.reply.mode!=='live'&&r.warning){window.MDM1Office?.showToast?.('⚠️ '+String(r.warning).slice(0,180),'err');}if(r.reply?.text)speakText(r.reply.text,selectedAgentId);}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='إرسال'}});
document.getElementById('teamChatForm').addEventListener('submit',async e=>{e.preventDefault();const inp=document.getElementById('teamChatInput'),btn=document.getElementById('teamSendBtn'),t=inp.value.trim();if(!t)return;const att=Array.from(document.querySelectorAll('.attendee-check:checked')).map(el=>el.value);inp.value='';btn.disabled=true;btn.textContent='جاري الاجتماع...';try{await api('/api/chat/team',{method:'POST',body:JSON.stringify({message:t,attendeeIds:att})});await bootstrap();}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='إرسال للفريق'}});
document.getElementById('dailyBriefBtn').onclick=async()=>{const b=document.getElementById('dailyBriefBtn');b.disabled=true;b.textContent='⏳...';try{const r=await api('/api/workflows/daily-brief',{method:'POST'});await bootstrap();switchTab('chat');switchChatMode('team');if(r.brief)speakText(r.brief,'executive-assistant');}finally{b.disabled=false;b.textContent='☀️ النشرة الصباحية'}};

document.getElementById('voteForm').addEventListener('submit',async e=>{
  e.preventDefault();const btn=document.getElementById('runVoteBtn');btn.disabled=true;btn.textContent='⏳ جاري التصويت...';
  try{
    const topic=document.getElementById('voteTopicInput').value.trim();
    const options=document.getElementById('voteOptionsInput').value.split(',').map(s=>s.trim()).filter(Boolean);
    const voterIds=Array.from(document.querySelectorAll('.voter-check:checked')).map(el=>el.value);
    await api('/api/votes',{method:'POST',body:JSON.stringify({topic,options,voterIds})});
    document.getElementById('voteForm').reset();await bootstrap();
  }catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='🗳️ بدء التصويت الآن'}
});

document.getElementById('webSearchTestForm').addEventListener('submit',async e=>{e.preventDefault();const q=document.getElementById('webSearchQueryInput').value.trim();if(!q)return;const r=await api('/api/tools/web-search',{method:'POST',body:JSON.stringify({query:q})});document.getElementById('webSearchResults').innerHTML=`<div>المحرك: <strong>${esc(r.engine)}</strong></div>`+(r.results.map(x=>`<div style="margin-top:5px;"><a href="${/^https?:\/\//i.test(x.url||'')?escAttr(x.url):'#'}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan)">${esc(x.title)}</a><br/><small style="color:var(--muted)">${esc(x.snippet)}</small></div>`).join('')||'لا توجد نتائج.')});

// Modals
document.getElementById('openWorkflowModalBtn').onclick=()=>document.getElementById('workflowModal').classList.remove('hidden');
document.getElementById('closeWorkflowModalBtn').onclick=()=>document.getElementById('workflowModal').classList.add('hidden');
document.getElementById('workflowForm').addEventListener('submit',async e=>{e.preventDefault();const b=document.getElementById('runWorkflowBtn');b.disabled=true;b.textContent='⏳ جاري...';try{await api('/api/workflows/project',{method:'POST',body:JSON.stringify({idea:document.getElementById('workflowIdeaInput').value})});document.getElementById('workflowModal').classList.add('hidden');document.getElementById('workflowForm').reset();await bootstrap();switchTab('approvals');}catch(e){alert(e.message)}finally{b.disabled=false;b.textContent='تشغيل المسار'}});

document.getElementById('openTaskModalBtn').onclick=()=>document.getElementById('taskModal').classList.remove('hidden');
document.getElementById('closeTaskModalBtn').onclick=()=>document.getElementById('taskModal').classList.add('hidden');
document.getElementById('taskForm').addEventListener('submit',async e=>{e.preventDefault();await api('/api/tasks',{method:'POST',body:JSON.stringify({agentId:document.getElementById('taskAgentSelect').value,title:document.getElementById('taskTitleInput').value,description:document.getElementById('taskDescInput').value,requiresApproval:document.getElementById('taskApprovalCheck').checked})});document.getElementById('taskModal').classList.add('hidden');document.getElementById('taskForm').reset();await bootstrap()});

document.getElementById('openHireModalBtn').onclick=()=>document.getElementById('hireModal').classList.remove('hidden');
document.getElementById('closeHireModalBtn').onclick=()=>document.getElementById('hireModal').classList.add('hidden');
document.getElementById('hireForm').addEventListener('submit',async e=>{e.preventDefault();await api('/api/agents/hire',{method:'POST',body:JSON.stringify({id:document.getElementById('hireIdInput').value,name:document.getElementById('hireNameInput').value,department:document.getElementById('hireDeptInput').value,avatar:document.getElementById('hireAvatarInput').value||'🤖',roleDescription:document.getElementById('hireRoleInput').value,skillsList:document.getElementById('hireSkillsInput').value})});document.getElementById('hireModal').classList.add('hidden');document.getElementById('hireForm').reset();await bootstrap()});

document.getElementById('memoForm').addEventListener('submit',async e=>{e.preventDefault();await api('/api/memos',{method:'POST',body:JSON.stringify({fromId:document.getElementById('memoFromSelect').value,toId:document.getElementById('memoToSelect').value,subject:document.getElementById('memoSubjectInput').value,body:document.getElementById('memoBodyInput').value})});document.getElementById('memoModal').classList.add('hidden');document.getElementById('memoForm').reset();await bootstrap()});
document.getElementById('ledgerForm').addEventListener('submit',async e=>{e.preventDefault();await api('/api/ledger/add',{method:'POST',body:JSON.stringify({type:document.getElementById('ledgerTypeSelect').value,title:document.getElementById('ledgerTitleInput').value,amountUsd:document.getElementById('ledgerAmountInput').value,project:document.getElementById('ledgerProjectInput').value,notes:document.getElementById('ledgerNotesInput').value})});document.getElementById('ledgerModal').classList.add('hidden');document.getElementById('ledgerForm').reset();await bootstrap()});
document.getElementById('customerForm').addEventListener('submit',async e=>{e.preventDefault();await api('/api/customers',{method:'POST',body:JSON.stringify({name:document.getElementById('custNameInput').value,contactName:document.getElementById('custContactInput').value,email:document.getElementById('custEmailInput').value,projectTitle:document.getElementById('custProjectInput').value,totalValueUsd:document.getElementById('custValueInput').value,stage:document.getElementById('custStageSelect').value,notes:document.getElementById('custNotesInput').value})});document.getElementById('customerModal').classList.add('hidden');document.getElementById('customerForm').reset();await bootstrap()});
document.getElementById('awardForm').addEventListener('submit',async e=>{e.preventDefault();await api('/api/gamification/award',{method:'POST',body:JSON.stringify({agentId:document.getElementById('awardAgentSelect').value,points:document.getElementById('awardPointsInput').value,reason:document.getElementById('awardReasonInput').value})});document.getElementById('awardModal').classList.add('hidden');document.getElementById('awardForm').reset();await bootstrap()});

document.getElementById('branchForm').addEventListener('submit',async e=>{e.preventDefault();const n=document.getElementById('branchNameInput').value.trim();if(!n)return;try{const r=await api('/api/sandbox/branch',{method:'POST',body:JSON.stringify({name:n})});alert(`تم إنشاء الفرع: ${r.branch}`);renderSandbox();}catch(e){alert(e.message)}});
document.getElementById('sandboxFileForm').addEventListener('submit',async e=>{e.preventDefault();const fn=document.getElementById('sandboxFilename').value.trim(), c=document.getElementById('sandboxContent').value;if(!fn)return;await api('/api/sandbox/file',{method:'POST',body:JSON.stringify({filename:fn,content:c})});document.getElementById('sandboxFileForm').reset();await bootstrap()});

function renderSimulations(){
  const l=D.state.simulations||[];
  document.getElementById('simulationsList').innerHTML=l.map(s=>`
    <div class="approval-card" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h4>🔮 ${esc(s.projectName)}</h4>
        <span style="font-size:12px;color:#fcd34d;">⚖️ نقطة التعادل: <strong>${s.breakEvenCustomers>=0?s.breakEvenCustomers+' عميل':'غير مجدٍ'}</strong> (هامش المساهمة $${s.contributionMargin}/عميل)</span>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">${esc(s.method||'سيناريوهات تقديرية قديمة')}</div>
      <div class="sim-scenarios">
        ${(s.scenarios||[]).map(sc=>`
          <div class="sim-box">
            <strong>${esc(sc.label)} ${sc.probabilityPct!=null?`(${esc(sc.probabilityPct)}%)`:''}</strong>
            <div>العملاء المتوقعون: <strong>${esc(sc.customers)}</strong> (كمية نطاق Monte Carlo)</div>
            <div>الإيرادات: <span style="color:var(--green)">$${esc(sc.revenue)}</span></div>
            <div>التكاليف الكلية: $${esc(sc.totalCost)} (APIs: $${esc(sc.totalApiCost)})</div>
            <div>صافي الربح: <strong style="color:${sc.netProfit>=0?'var(--cyan)':'var(--red)'}">${sc.netProfit>=0?'+':''}$${esc(sc.netProfit)}</strong> (ROI: ${esc(sc.roiPct)}%)</div>
          </div>
        `).join('')}
      </div>
      ${s.plannedVsActual?`<div style="font-size:12px;color:var(--muted);margin-top:8px;">📈 <strong>الخطة مقابل الواقع:</strong> متوقع $${esc(s.plannedVsActual.projectedNet)} • فعلي $${esc(s.plannedVsActual.actualNet)} (إيراد ${esc(s.plannedVsActual.actualRevenue)} − تكلفة ${esc(s.plannedVsActual.actualCost)}) — المصدر: ${esc(s.plannedVsActual.source)}</div>`:''}
      ${s.accountantNote?`<div style="font-size:12px;color:var(--muted);margin-top:8px;">💰 <strong>المحاسبة:</strong> ${esc(s.accountantNote)}</div>`:''}
      ${s.marketingNote?`<div style="font-size:12px;color:var(--muted);margin-top:4px;">📣 <strong>التسويق:</strong> ${esc(s.marketingNote)}</div>`:''}
    </div>
  `).join('')||'<div class="approval-card">لم تُجرَ محاكاة بعد. أدخل أرقام مشروعك بالأعلى.</div>';
}

function renderPlaybooks(){
  document.getElementById('playbooksGrid').innerHTML=(D.playbooks||[]).map(pb=>`
    <div class="webhook-card">
      <div style="font-size:22px;margin-bottom:4px;">${esc(pb.icon||'📖')}</div>
      <strong>${esc(pb.title)}</strong>
      <p style="font-size:12px;color:var(--muted);margin:6px 0;">${esc(pb.description)}</p>
      <div style="font-size:11px;color:var(--cyan);margin-bottom:10px;">${(pb.steps||[]).length} خطوات متتابعة بين الأقسام</div>
      <button class="btn btn-primary" onclick="runPlaybook('${jsAttr(pb.id)}')">▶️ تشغيل القالب الآن</button>
    </div>
  `).join('');
}
async function runPlaybook(id){
  const pt=document.getElementById('playbookProjectTitle').value.trim();
  await api('/api/playbooks/run',{method:'POST',body:JSON.stringify({playbookId:id,projectTitle:pt})});
  alert('✅ تم تشغيل القالب وتوزيع المهام والمذكرات بين الأقسام!');
  await bootstrap();switchTab('office');
}

function renderSnapshots(){
  document.getElementById('snapshotsList').innerHTML=(D.snapshots||[]).map(sn=>`
    <div class="approval-card">
      <div>
        <div style="font-size:11px;color:var(--cyan);">🔐 ${esc(sn.alg)} • ${esc(sn.fileCount)} ملف • ${Math.round(sn.size/1024)} KB • ${esc(sn.createdAt?.slice(0,16)||'')}</div>
        <h4>${esc(sn.label)}</h4>
      </div>
      <div class="approval-actions">
        <button class="btn btn-secondary" onclick="window.MDM1Office.downloadSnapshot('${jsAttr(sn.id)}')">⬇️ تحميل</button>
        <button class="btn btn-approve" onclick="restoreSnapshot('${jsAttr(sn.id)}')">⏪ استعادة (Time-Travel)</button>
      </div>
    </div>
  `).join('')||'<div class="approval-card">لا توجد نسخ احتياطية مشفرة بعد.</div>';
}
async function restoreSnapshot(id){
  const pass=prompt('أدخل كلمة مرور فك التشفير (اتركه فارغاً إذا استخدمت المفتاح الافتراضي):','');
  if(pass===null)return;
  try{
    const r=await api('/api/snapshots/restore',{method:'POST',body:JSON.stringify({id,passphrase:pass})});
    alert(`⏪ تمت الاستعادة بنجاح! (${r.restoredCount} ملف من نقطة ${r.snapshotDate})`);
    await bootstrap();
  }catch(e){alert('❌ '+e.message)}
}

function renderIncidents(){
  document.getElementById('incidentsList').innerHTML=(D.state.incidents||[]).map(inc=>`
    <div class="approval-card ${inc.status==='active'?'rejected':'approved'}" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;">
        <strong>🚨 ${esc(inc.reason)}</strong>
        <span style="font-size:11px;">${inc.status==='active'?'🔴 نشط':'✅ تم الحل'} • ${inc.triggeredAt?.slice(0,16)||''}</span>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:5px;white-space:pre-wrap;">🛡️ <strong>تقرير مسؤول الأمان:</strong>\n${esc(inc.securityReport)}</div>
    </div>
  `).join('')||'<div class="approval-card">✅ لا توجد حوادث طوارئ مسجلة — الشركة تعمل بأمان.</div>';
}

async function triggerKillSwitchQuick(){
  if(!confirm('🚨 هل أنت متأكد من تفعيل زر الطوارئ (Kill Switch)؟ سيتم إيقاف Webhooks والمهام المجدولة وتجميد الحملات التسويقية فوراً!'))return;
  const reason=prompt('سبب الطوارئ (اختياري):','إجراء وقائي فوري')||'إجراء وقائي فوري';
  await api('/api/incident/trigger',{method:'POST',body:JSON.stringify({reason})});
  await bootstrap();switchTab('incident');
}
async function recoverEmergency(){
  await api('/api/incident/recover',{method:'POST'});
  await bootstrap();
}

document.getElementById('simulatorForm').addEventListener('submit',async e=>{
  e.preventDefault();const b=document.getElementById('runSimBtn');b.disabled=true;b.textContent='⏳ جاري المحاكاة...';
  try{
    await api('/api/simulator/run',{method:'POST',body:JSON.stringify({
      projectName:document.getElementById('simName').value,
      fixedCostUsd:document.getElementById('simFixed').value,
      adBudgetUsd:document.getElementById('simAd').value,
      pricePerCustomerUsd:document.getElementById('simPrice').value,
      apiCostPerCustomerUsd:document.getElementById('simApi').value,
      conversionRatePct:document.getElementById('simConv').value,
      cpcUsd:document.getElementById('simCpc').value,
      probabilities:document.getElementById('simProbabilities').value
    })});
    await bootstrap();
  }catch(err){alert(err.message)}finally{b.disabled=false;b.textContent='🔮 تشغيل المحاكاة الآن'}
});

document.getElementById('snapshotForm').addEventListener('submit',async e=>{
  e.preventDefault();
  await api('/api/snapshots/create',{method:'POST',body:JSON.stringify({label:document.getElementById('snapLabel').value,passphrase:document.getElementById('snapPass').value})});
  document.getElementById('snapshotForm').reset();await bootstrap();
});

document.getElementById('snapshotImportForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const file=document.getElementById('snapshotImportFile').files[0], pass=document.getElementById('snapshotImportPass').value, btn=document.getElementById('importSnapshotBtn');
  if(!file)return;
  btn.disabled=true;btn.textContent='⏳ جارٍ التحقق...';
  try{
    const text=await file.text();
    const record=JSON.parse(text);
    const r=await api('/api/snapshots/import',{method:'POST',body:JSON.stringify({record:record,passphrase:pass})});
    alert(`✅ ${r.message}`);document.getElementById('snapshotImportForm').reset();await bootstrap();
  }catch(err){alert('❌ '+err.message)}
  finally{btn.disabled=false;btn.textContent='📥 استيراد والتحقق'}
});

document.getElementById('incidentForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const b=document.getElementById('triggerIncidentBtn');b.disabled=true;
  try{
    await api('/api/incident/trigger',{method:'POST',body:JSON.stringify({reason:document.getElementById('incidentReasonInput').value})});
    document.getElementById('incidentForm').reset();await bootstrap();
  }finally{b.disabled=false;}
});

bootstrap();
