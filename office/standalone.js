/* ============================================================================
   MDM1 AI Office — standalone browser runtime (no server)
   ----------------------------------------------------------------------------
   This file turns the existing office UI into a fully client-side app:
   • it intercepts every /api/* call the UI makes and answers it locally;
   • it keeps the company state in localStorage (export/import + encrypted snapshots);
   • it talks directly to the OpenCode app on this machine (local HTTP API) or to
     OpenCode Zen / OpenRouter when a key is supplied;
   • it never contains a bot token or a model key. The Telegram bot only sends
     signed secret tokens; the page verifies them with a public key.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.OFFICE_CONFIG || {};
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  var LS_STATE = CFG.storageKey || 'mdm1_office_v2_state';
  var LS_SETTINGS = (CFG.storageKey || 'mdm1_office_v2') + '_settings';
  var LS_UNLOCK = (CFG.storageKey || 'mdm1_office_v2') + '_unlock';
  var LS_SNAPS = (CFG.storageKey || 'mdm1_office_v2') + '_snapshots';
  var LS_EXPORTS = (CFG.storageKey || 'mdm1_office_v2') + '_exports';

  /* ── tiny helpers ─────────────────────────────────────────────────────── */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function nowIso() { return new Date().toISOString(); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function safeJson(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function words(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(function (w) { return w.length > 2; }); }

  function readLS(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function writeLS(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('localStorage full or blocked', e); return false; }
  }

  /* ── settings (connection, models, telegram) ──────────────────────────── */
  var defaultSettings = {
    mode: 'auto',                    // auto | local | zen | openrouter | demo
    localUrl: (CFG.localApi && CFG.localApi.url) || 'http://127.0.0.1:28894',
    localPassword: '',
    zenKey: '',
    zenBase: (CFG.zen && CFG.zen.baseUrl) || 'https://opencode.ai/zen/v1',
    openrouterKey: '',
    openrouterModel: 'openai/gpt-4o-mini:free',
    freeOnly: true,
    modelOverrides: {},
    telegramBot: (CFG.telegram && CFG.telegram.botUsername) || '',
    telegramChatId: '',
    relayUrl: (CFG.telegram && CFG.telegram.relayUrl) || '',
    relaySecret: '',
    lastProvider: null,
    lastError: null
  };
  var settings = Object.assign({}, defaultSettings, readLS(LS_SETTINGS, {}));
  function saveSettings() { writeLS(LS_SETTINGS, settings); }

  /* ── company data (agents / knowledge / playbooks) ────────────────────── */
  var DATA = { agents: [], knowledge: [], playbooks: [] };
  var dataReady = null;

  function loadCompanyData() {
    if (dataReady) return dataReady;
    dataReady = (nativeFetch ? nativeFetch('data.json', { cache: 'no-store' }) : Promise.reject(new Error('no fetch')))
      .then(function (r) { if (!r.ok) throw new Error('data.json HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        DATA.agents = Array.isArray(j.agents) ? j.agents : [];
        DATA.knowledge = Array.isArray(j.knowledge) ? j.knowledge : [];
        DATA.playbooks = Array.isArray(j.playbooks) ? j.playbooks : [];
        return DATA;
      })
      .catch(function (e) {
        console.warn('Company data could not be loaded:', e.message);
        DATA.agents = fallbackAgents();
        DATA.knowledge = [];
        DATA.playbooks = [];
        return DATA;
      });
    return dataReady;
  }

  function fallbackAgents() {
    return [
      { id: 'executive-assistant', name: 'السكرتيرة التنفيذية', englishName: 'Executive Assistant', avatar: '📋', department: 'الإدارة التنفيذية', zone: 'executive', roleMd: 'تدير أجندة المدير وتنسق بين الأقسام.', skillsMd: '- التنسيق\n- إعداد النشرات', allowedTools: ['calendar'], requiresApprovalFor: ['external_action'] },
      { id: 'hr-manager', name: 'مديرة الموارد البشرية', englishName: 'HR Manager', avatar: '👩‍💼', department: 'الموارد البشرية', zone: 'hr-training', roleMd: 'تتابع أداء الفريق والتوسع.', skillsMd: '- التوظيف\n- تقييم الأداء', allowedTools: ['hr'], requiresApprovalFor: ['hire_agent'] },
      { id: 'accountant', name: 'المحاسبة', englishName: 'Accountant', avatar: '💰', department: 'المالية', zone: 'finance-security', roleMd: 'تحلل التكاليف والأرباح.', skillsMd: '- الميزانية\n- التسعير', allowedTools: ['ledger'], requiresApprovalFor: ['payment'] },
      { id: 'marketing-lead', name: 'مسؤول التسويق', englishName: 'Marketing Lead', avatar: '📣', department: 'التسويق', zone: 'marketing', roleMd: 'يبني الحملات ورسائل العملاء.', skillsMd: '- الحملات\n- المحتوى', allowedTools: ['publish'], requiresApprovalFor: ['publish_marketing'] },
      { id: 'security-officer', name: 'مسؤول الأمان', englishName: 'Security Officer', avatar: '🛡️', department: 'الأمان', zone: 'finance-security', roleMd: 'يقيّم المخاطر ويحمي البيانات.', skillsMd: '- تقييم المخاطر', allowedTools: ['audit'], requiresApprovalFor: ['external_action'] },
      { id: 'web-research-team', name: 'فريق البحث والتطوير', englishName: 'Web Research Team', avatar: '🌐', department: 'البحث', zone: 'research-lab', roleMd: 'يرصد الفرص والأدوات.', skillsMd: '- البحث\n- التحليل', allowedTools: ['web_search'], requiresApprovalFor: [] },
      { id: 'auditors-experts-devs', name: 'المدققون والخبراء والمطورون', englishName: 'Auditors & Developers', avatar: '⚙️', department: 'الهندسة والتدقيق', zone: 'engineering-audit', roleMd: 'يقيّم الجدوى التقنية ويبني الحلول.', skillsMd: '- التدقيق\n- التطوير', allowedTools: ['code'], requiresApprovalFor: ['deploy'] },
      { id: 'ai-trainer', name: 'المدربة', englishName: 'AI Trainer', avatar: '🎓', department: 'التدريب', zone: 'hr-training', roleMd: 'تقيّم الأداء وتطور المهارات.', skillsMd: '- KPI\n- التدريب', allowedTools: ['kpi'], requiresApprovalFor: [] }
    ];
  }

  /* ── company state ────────────────────────────────────────────────────── */
  function initialState() {
    var now = nowIso();
    return {
      directChats: {},
      teamChat: [{
        id: uuid(), senderId: 'executive-assistant', senderName: 'السكرتيرة التنفيذية', senderAvatar: '📋',
        role: 'assistant', text: 'صباح الخير سيادة المدير! جميع الأقسام متصلة وجاهزة. يمكنك بدء اجتماع جماعي أو إطلاق مسار مشروع تلقائي بين الأقسام.',
        timestamp: now
      }],
      tasks: [
        { id: uuid(), agentId: 'web-research-team', title: 'رصد 3 أدوات AI قابلة لإعادة البيع (White-label)', description: 'البحث على الويب عن أدوات أتمتة وتسويق يمكن استخدامها أو بيعها للعملاء.', status: 'working', createdAt: now },
        { id: uuid(), agentId: 'accountant', title: 'إعداد مسودة ميزانية الشهر الأول وتكاليف APIs', description: 'مراجعة التكاليف التقديرية لمزودي الذكاء الاصطناعي والأدوات.', status: 'available', createdAt: now }
      ],
      approvals: [
        { id: 'apr-initial-1', agentId: 'marketing-lead', agentName: 'مسؤول التسويق', title: 'إطلاق حملة إعلانية تجريبية لمنتج الشركة الأول', details: 'خطة حملة مبدئية بميزانية مقترحة $50 لاختبار معدل التحويل على منصات التواصل.', risk: 'medium', securityNote: '🛡️ فحص مسؤول الأمان: تعديل تشغيلي أو مالي متوسط الأثر — مسموح بعد موافقة المدير.', actionType: 'publish_marketing', payload: {}, status: 'pending', createdAt: now, resolvedAt: null },
        { id: 'apr-initial-2', agentId: 'security-officer', agentName: 'مسؤول الأمان', title: 'تفعيل بوابة Webhooks للأدوات الخارجية', details: 'مراجعة أمنية لتفعيل نقطة استقبال /api/webhooks/incoming مع التحقق من التوقيع السري.', risk: 'low', securityNote: '🛡️ فحص مسؤول الأمان: توقيع WEBHOOK_SECRET مفعّل.', actionType: 'enable_new_webhook', payload: {}, status: 'pending', createdAt: now, resolvedAt: null }
      ],
      agentStatuses: { 'web-research-team': 'working', 'marketing-lead': 'waiting_approval', 'security-officer': 'waiting_approval' },
      liveBubbles: {
        'web-research-team': 'أبحث في الويب عن فرص SaaS...',
        'accountant': 'جاهزة لمراجعة الأرباح والخسائر',
        'marketing-lead': 'بانتظار اعتماد الحملة الإعلانية',
        'security-officer': 'أراقب صلاحيات الـ Webhooks'
      },
      usageStats: { totalTokens: 0, totalCostUsd: 0, byAgent: {} },
      meetingActive: false,
      meetingAttendees: [],
      internalMemos: [
        { id: 'memo-1', fromId: 'web-research-team', fromName: 'فريق البحث والتطوير', fromAvatar: '🌐', toId: 'accountant', toName: 'المحاسبة', toAvatar: '💰', subject: 'دراسة تكلفة أداة أتمتة مقترحة', body: 'تم رصد أداة أتمتة خدمة عملاء بتكلفة ترخيص $29/شهر وإمكانية بيعها بـ $99/شهر. يرجى مراجعة هامش الربح.', timestamp: now },
        { id: 'memo-2', fromId: 'auditors-experts-devs', fromName: 'المدققون والخبراء والمطورون', fromAvatar: '⚙️', toId: 'hr-manager', toName: 'مديرة الموارد البشرية', toAvatar: '👩‍💼', subject: 'توصية بتعيين مختص تكاملات API', body: 'مع توسع مشاريع n8n والربط الخارجي، نقترح تجهيز وصف وظيفي لمطور تكاملات عند الحاجة.', timestamp: now }
      ],
      kpiReviews: [],
      financialLedger: [
        { id: 'fin-1', type: 'revenue', title: 'اشتراك عميل تجريبي — باقة الأتمتة', amountUsd: 199, date: now.slice(0, 10), notes: 'دفعة شهرية أولى' },
        { id: 'fin-2', type: 'expense', title: 'استضافة وخوادم تجريبية', amountUsd: 25, date: now.slice(0, 10), notes: 'بنية تحتية شهرية' }
      ],
      schedules: [
        { id: 'daily-morning-brief', name: 'النشرة الصباحية التنفيذية (السكرتيرة -> تيليجرام)', agentId: 'executive-assistant', frequency: 'daily', targetHour: 9, enabled: true, lastRunAt: null, lastStatus: 'جاهز' },
        { id: 'weekly-saas-research', name: 'تقرير 3 فرص SaaS أسبوعي (فريق البحث)', agentId: 'web-research-team', frequency: 'weekly', targetDay: 1, targetHour: 10, enabled: true, lastRunAt: null, lastStatus: 'جاهز' },
        { id: 'weekly-trainer-kpi', name: 'تقييم الأداء الأسبوعي واقتراح مهارات (المدربة)', agentId: 'ai-trainer', frequency: 'weekly', targetDay: 4, targetHour: 14, enabled: true, lastRunAt: null, lastStatus: 'جاهز' },
        { id: 'daily-hr-workload', name: 'مراقبة ضغط العمل والتوسع الذاتي (HR Manager)', agentId: 'hr-manager', frequency: 'daily', targetHour: 16, enabled: true, lastRunAt: null, lastStatus: 'جاهز' }
      ],
      gamification: {},
      customers: [
        { id: 'cust-1', portalToken: 'portal-elite-trade-01', name: 'شركة النخبة للتجارة', contactName: 'أحمد العتيبي', email: 'ahmed@elite-trade.example', phone: '+96650000001', stage: 'نشط', projectTitle: 'أتمتة خدمة العملاء عبر واتساب', totalValueUsd: 450, paidUsd: 199, assignedTo: 'marketing-lead', notes: 'عميل نشط يدفع باقة شهرية — مهتم بباقة التسويق الآلي.', createdAt: now.slice(0, 10) },
        { id: 'cust-2', portalToken: 'portal-rowad-store-02', name: 'متجر رواد الرقمي', contactName: 'سارة المنصور', email: 'sara@rowad-store.example', phone: '+96650000002', stage: 'قيد التفاوض', projectTitle: 'نظام تقارير مالية بالذكاء الاصطناعي', totalValueUsd: 320, paidUsd: 0, assignedTo: 'accountant', notes: 'بانتظار عرض السعر النهائي وخطة التنفيذ.', createdAt: now.slice(0, 10) }
      ],
      votes: [],
      emergencyMode: false,
      incidents: [],
      simulations: [],
      webhooks: [
        { id: 'wh-incoming', name: 'Incoming Automation Webhook (n8n / Make / Zapier)', endpoint: '/api/webhooks/incoming', method: 'POST', securityReviewed: true, status: 'ready' },
        { id: 'wh-email', name: 'Email & Calendar Sync Connector', endpoint: '/api/webhooks/email', method: 'POST', securityReviewed: false, status: 'planned' },
        { id: 'wh-sheets', name: 'Google Sheets Financial Export', endpoint: '/api/webhooks/sheets', method: 'POST', securityReviewed: false, status: 'planned' }
      ],
      memories: {},
      auditLog: [],
      exports: [],
      exportContents: {},
      sandboxFiles: [],
      customAgents: [],
      knowledgeOverrides: {},
      snapshots: [],
      telegramOutbox: [],
      meta: { createdAt: now, version: '2.0.0' }
    };
  }

  var state = loadState();

  function loadState() {
    var base = initialState();
    var saved = readLS(LS_STATE, null);
    if (!saved || typeof saved !== 'object') return base;
    var merged = Object.assign(base, saved);
    // Ensure arrays/objects that older saves may miss.
    ['tasks', 'approvals', 'teamChat', 'internalMemos', 'kpiReviews', 'financialLedger', 'schedules', 'customers', 'votes', 'incidents', 'simulations', 'webhooks', 'auditLog', 'exports', 'sandboxFiles', 'customAgents', 'snapshots', 'telegramOutbox'].forEach(function (k) {
      if (!Array.isArray(merged[k])) merged[k] = base[k] || [];
    });
    ['directChats', 'agentStatuses', 'liveBubbles', 'gamification', 'memories', 'exportContents', 'knowledgeOverrides'].forEach(function (k) {
      if (!merged[k] || typeof merged[k] !== 'object') merged[k] = base[k] || {};
    });
    if (!merged.usageStats) merged.usageStats = base.usageStats;
    return merged;
  }

  var saveTimer = null;
  function saveState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      writeLS(LS_STATE, state);
    }, 120);
  }
  function saveNow() { writeLS(LS_STATE, state); }

  /* ── audit / points / status ──────────────────────────────────────────── */
  function logAudit(eventType, actor, summary, meta) {
    state.auditLog.unshift({ id: uuid(), timestamp: nowIso(), eventType: eventType, actor: actor, summary: summary, meta: meta || null });
    state.auditLog = state.auditLog.slice(0, 250);
  }

  var LEVELS = [
    { level: 1, minPoints: 0, title: 'موظف تنفيذي' },
    { level: 2, minPoints: 80, title: 'أخصائي معتمد 🥈' },
    { level: 3, minPoints: 180, title: 'أخصائي أول 🥇' },
    { level: 4, minPoints: 320, title: 'مدير قسم 👑' },
    { level: 5, minPoints: 500, title: 'مستشار استراتيجي 💎' }
  ];
  function ensureProfile(agentId) {
    if (!state.gamification[agentId]) {
      state.gamification[agentId] = { points: 20, level: 1, rankTitle: LEVELS[0].title, badges: ['🌟 بداية موفقة'], history: [] };
    }
    return state.gamification[agentId];
  }
  function awardPoints(agentId, points, reason) {
    var p = ensureProfile(agentId);
    var oldLevel = p.level;
    p.points += num(points, 0);
    var lvl = LEVELS[0];
    LEVELS.forEach(function (l) { if (p.points >= l.minPoints) lvl = l; });
    p.level = lvl.level;
    p.rankTitle = lvl.title;
    p.history.unshift({ points: points, reason: reason, timestamp: nowIso() });
    p.history = p.history.slice(0, 15);
    if (lvl.level > oldLevel) {
      p.badges.push('🏆 ترقية: ' + lvl.title);
      logAudit('agent_promoted', agentId, 'Promoted to Level ' + lvl.level + ': ' + lvl.title, { points: p.points });
      var ag = getAgent(agentId);
      state.teamChat.push({ id: uuid(), senderId: 'hr-manager', senderName: 'مديرة الموارد البشرية (ترقية 🏆)', senderAvatar: '🏆', role: 'assistant', text: 'تهانينا! تمت ترقية **' + (ag ? ag.name : agentId) + '** إلى رتبة **' + lvl.title + '** بمجموع ' + p.points + ' نقطة!', timestamp: nowIso() });
      return { profile: p, promoted: true, newLevel: lvl };
    }
    return { profile: p, promoted: false, newLevel: lvl };
  }

  function getAgent(id) { return DATA.agents.find(function (a) { return a.id === id; }) || null; }
  function allAgents() {
    var custom = (state.customAgents || []).filter(function (a) { return !DATA.agents.some(function (x) { return x.id === a.id; }); });
    return DATA.agents.concat(custom);
  }

  function recomputeStatus(agentId) {
    if (state.approvals.some(function (a) { return a.agentId === agentId && a.status === 'pending'; })) { state.agentStatuses[agentId] = 'waiting_approval'; return; }
    state.agentStatuses[agentId] = state.tasks.some(function (t) { return t.agentId === agentId && t.status === 'working'; }) ? 'working' : 'available';
  }

  /* ── memory (lightweight RAG) ─────────────────────────────────────────── */
  function indexMemory(agentId, role, text, source) {
    if (!state.memories[agentId]) state.memories[agentId] = [];
    state.memories[agentId].push({ id: uuid(), role: role, text: String(text || '').slice(0, 1200), source: source || 'chat', timestamp: nowIso() });
    state.memories[agentId] = state.memories[agentId].slice(-120);
  }
  function retrieveMemories(agentId, query, k) {
    var list = state.memories[agentId] || [];
    var q = words(query);
    if (!q.length) return list.slice(-k);
    var scored = list.map(function (m) {
      var t = words(m.text);
      var hits = 0;
      q.forEach(function (w) { if (t.indexOf(w) !== -1) hits++; });
      return { m: m, score: hits };
    }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, k).map(function (x) { return x.m; });
  }
  function memoryStats() {
    var byAgent = {};
    var total = 0;
    Object.keys(state.memories).forEach(function (id) { byAgent[id] = state.memories[id].length; total += byAgent[id]; });
    return { totalMemories: total, byAgent: byAgent };
  }

  /* ── system prompt ────────────────────────────────────────────────────── */
  function knowledgeContext() {
    return DATA.knowledge.map(function (k) {
      var content = state.knowledgeOverrides[k.filename] != null ? state.knowledgeOverrides[k.filename] : k.content;
      return '### ' + k.filename + '\n' + content;
    }).join('\n\n');
  }
  function buildSystemPrompt(agent, extraContext, ragMemories) {
    var rag = (ragMemories && ragMemories.length)
      ? '\n=== ذاكرة محادثات ذات صلة ===\n' + ragMemories.map(function (m) { return '- [' + String(m.timestamp || '').slice(0, 10) + '] (' + (m.role === 'user' ? 'المدير' : agent.name) + '): ' + m.text; }).join('\n') + '\n'
      : '';
    return 'أنت تعمل داخل "المكتب الافتراضي للذكاء الاصطناعي" (AI Virtual Office).\n' +
      'المستخدم هو المدير التنفيذي (CEO) وصاحب الشركة. أجب بالعربية الواضحة والعملية.\n\n' +
      '=== قاعدة معرفة الشركة ===\n' + (knowledgeContext() || 'لا توجد ملفات معرفة إضافية حالياً.') + '\n' + rag +
      '\n=== الدور ===\n' + (agent.roleMd || '') + '\n\n=== المهارات ===\n' + (agent.skillsMd || '') + '\n\n' +
      '=== الصلاحيات ===\n- القسم: ' + (agent.department || '') + '\n- الأدوات: ' + ((agent.allowedTools || []).join(', ') || 'لا يوجد') + '\n' +
      '- تتطلب موافقة المدير: ' + ((agent.requiresApprovalFor || []).join(', ') || 'لا يوجد') + '\n\n' +
      'تعليمات:\n' +
      '1. التزم بدورك وشخصيتك المهنية.\n' +
      '2. إذا اقترحت إجراءً يتطلب موافقة المدير، أضف في نهاية ردك:\n' +
      '[APPROVAL_REQUEST title="عنوان مختصر" risk="medium" action="publish_marketing"]\nوصف القرار المطلوب اعتماده.\n[/APPROVAL_REQUEST]\n' +
      '- مديرة الموارد البشرية: [HIRE_AGENT id="agent-id" name="الاسم" department="القسم" avatar="🤖"]وصف الدور[/HIRE_AGENT]\n' +
      '- المدربة: [UPDATE_SKILLS target="agent-id" title="تحديث المهارات"]- مهارة[/UPDATE_SKILLS]\n' +
      (extraContext ? '\n=== سياق إضافي ===\n' + extraContext : '');
  }

  /* ── model routing ────────────────────────────────────────────────────── */
  var ROLE_MODELS = {
    'executive-assistant': ['big-pickle', 'seaglass-alpha-free', 'tidepool-alpha-free'],
    'hr-manager': ['mimo-v2.6-flash-free', 'big-pickle', 'beam-free'],
    'ai-trainer': ['beam-free', 'nemotron-3.5-lightning-free', 'flint-40b-free'],
    'accountant': ['flint-40b-free', 'deepseek-v4.1-flash-free', 'big-pickle'],
    'marketing-lead': ['nemotron-3.5-lightning-free', 'seaglass-alpha-free', 'mimo-v2.6-flash-free'],
    'security-officer': ['iceman-free', 'deepseek-v4.1-flash-free', 'flint-40b-free'],
    'web-research-team': ['seaglass-alpha-free', 'tidepool-alpha-free', 'nemotron-3.5-super-vl-free'],
    'auditors-experts-devs': ['deepseek-v4.1-flash-free', 'flint-40b-free', 'big-pickle']
  };
  var FALLBACK_MODELS = ['big-pickle', 'deepseek-v4.1-flash-free', 'seaglass-alpha-free', 'tidepool-alpha-free', 'flint-40b-free', 'iceman-free', 'beam-free', 'mimo-v2.6-flash-free', 'nemotron-3.5-lightning-free', 'nemotron-3.5-super-vl-free', 'hy4-flash-free'];

  function isFreeModel(m) {
    if (!m) return false;
    var id = String(m.id || '');
    if (/free/i.test(id)) return true;
    var costs = Array.isArray(m.cost) ? m.cost : (m.cost ? [m.cost] : []);
    if (!costs.length) return false;
    return costs.every(function (c) {
      var input = num(c && c.input, 0);
      var output = num(c && c.output, 0);
      return input === 0 && output === 0;
    });
  }
  function pickModel(agentId, availableIds, explicit) {
    if (explicit && explicit !== 'auto') return explicit;
    var avail = availableIds || [];
    var preferred = ROLE_MODELS[agentId] || [];
    for (var i = 0; i < preferred.length; i++) if (avail.indexOf(preferred[i]) !== -1) return preferred[i];
    for (var j = 0; j < FALLBACK_MODELS.length; j++) if (avail.indexOf(FALLBACK_MODELS[j]) !== -1) return FALLBACK_MODELS[j];
    return avail[0] || 'big-pickle';
  }
  function fallbackChain(agentId, availableIds, first) {
    var chain = [];
    if (first) chain.push(first);
    (ROLE_MODELS[agentId] || []).concat(FALLBACK_MODELS).forEach(function (id) {
      if ((availableIds || []).indexOf(id) !== -1 && chain.indexOf(id) === -1) chain.push(id);
    });
    if (!chain.length && availableIds && availableIds.length) chain.push(availableIds[0]);
    return chain;
  }
  function roleAssignments(availableIds) {
    var out = {};
    Object.keys(ROLE_MODELS).forEach(function (id) { out[id] = pickModel(id, availableIds, settings.modelOverrides[id]); });
    return out;
  }

  /* ── provider layer ───────────────────────────────────────────────────── */
  var providerCache = { local: null, localAt: 0, zen: null, zenAt: 0 };
  function basicAuth(password) {
    return 'Basic ' + btoa('opencode:' + password);
  }

  function listLocalModels(force) {
    if (!settings.localPassword) return Promise.resolve({ connected: false, models: [], free: [], error: 'أدخل كلمة مرور خدمة OpenCode (service.json).' });
    if (!force && providerCache.local && Date.now() - providerCache.localAt < 30000) return Promise.resolve(providerCache.local);
    return nativeFetch(settings.localUrl.replace(/\/$/, '') + '/api/model', {
      headers: { authorization: basicAuth(settings.localPassword), accept: 'application/json' },
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var models = (j.data || []).filter(function (m) { return m.type === 'chat' && m.enabled !== false; });
      var free = models.filter(isFreeModel).map(function (m) { return m.id; });
      var out = { connected: true, models: models, free: free, error: null };
      providerCache.local = out; providerCache.localAt = Date.now();
      return out;
    }).catch(function (e) {
      var out = { connected: false, models: [], free: [], error: e.message };
      providerCache.local = out; providerCache.localAt = Date.now();
      return out;
    });
  }

  function listZenModels(force) {
    if (!settings.zenKey) return Promise.resolve({ connected: false, models: [], free: [], error: 'أدخل مفتاح OpenCode Zen.' });
    if (!force && providerCache.zen && Date.now() - providerCache.zenAt < 30000) return Promise.resolve(providerCache.zen);
    return nativeFetch(settings.zenBase.replace(/\/$/, '') + '/models', {
      headers: { authorization: 'Bearer ' + settings.zenKey, accept: 'application/json' },
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var models = (j.data || []).filter(function (m) { return !m.type || m.type === 'chat'; });
      var free = models.filter(isFreeModel).map(function (m) { return m.id; });
      var out = { connected: true, models: models, free: free, error: null };
      providerCache.zen = out; providerCache.zenAt = Date.now();
      return out;
    }).catch(function (e) {
      var out = { connected: false, models: [], free: [], error: e.message };
      providerCache.zen = out; providerCache.zenAt = Date.now();
      return out;
    });
  }

  function currentMode() {
    if (settings.mode !== 'auto') return settings.mode;
    if (settings.localPassword) return 'local';
    if (settings.zenKey) return 'zen';
    if (settings.openrouterKey) return 'openrouter';
    return 'demo';
  }

  function transcript(systemPrompt, messages) {
    var lines = ['[تعليمات النظام]\n' + systemPrompt];
    (messages || []).forEach(function (m) { lines.push((m.role === 'assistant' ? 'المساعد' : 'المدير') + ': ' + m.text); });
    lines.push('المساعد:');
    return lines.join('\n\n');
  }

  function estimateUsage(systemPrompt, messages, text) {
    var inputChars = (systemPrompt || '').length + (messages || []).reduce(function (a, m) { return a + String(m.text || '').length; }, 0);
    var inputTokens = Math.max(1, Math.ceil(inputChars / 4));
    var outputTokens = Math.max(1, Math.ceil(String(text || '').length / 4));
    return { inputTokens: inputTokens, outputTokens: outputTokens, totalTokens: inputTokens + outputTokens, costUsd: 0 };
  }

  function demoReply(agent, userMessage, warning) {
    return 'مرحباً سيادة المدير! أنا **' + agent.name + '** (' + (agent.englishName || agent.id) + ').\n\n' +
      'استلمت توجيهك: "' + String(userMessage || '').slice(0, 160) + '"\n\n' +
      (warning
        ? '⚠️ **تعذر الوصول إلى النموذج الآن:**\n' + warning + '\n\nيمكنك تغيير المزود أو النموذج من زر **🔌 الاتصال** أعلى الصفحة.'
        : '⚠️ **الوضع التجريبي:** لم يتم توصيل نموذج بعد. افتح **🔌 الاتصال** وأدخل كلمة مرور تطبيق OpenCode أو مفتاح OpenCode Zen.') +
      '\n\nكل بياناتك محفوظة محلياً في متصفحك.';
  }

  function aiGenerate(opts) {
    var agent = getAgent(opts.agentId) || { id: opts.agentId, name: opts.agentId, englishName: opts.agentId, roleMd: '', skillsMd: '', allowedTools: [], requiresApprovalFor: [], department: '' };
    var systemPrompt = opts.systemPrompt || buildSystemPrompt(agent, opts.extraContext || '', opts.memories || []);
    var messages = opts.messages || [];
    var mode = currentMode();
    var lastUser = messages.length ? messages[messages.length - 1].text : '';

    function fallback(warning) {
      return { text: demoReply(agent, lastUser, warning), mode: 'fallback', provider: mode, model: 'demo', warning: warning || null, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 } };
    }

    if (mode === 'demo') return Promise.resolve(fallback(null));

    if (mode === 'local') {
      return listLocalModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        var pool = settings.freeOnly && listing.free.length ? listing.free : listing.models.map(function (m) { return m.id; });
        var first = pickModel(agent.id, pool, settings.modelOverrides[agent.id]);
        var chain = fallbackChain(agent.id, pool, first).slice(0, 3);
        var errors = [];
        function attempt(i) {
          if (i >= chain.length) return fallback(errors.join('\n'));
          var id = chain[i];
          return nativeFetch(settings.localUrl.replace(/\/$/, '') + '/api/experimental/generate/text', {
            method: 'POST',
            headers: { authorization: basicAuth(settings.localPassword), 'content-type': 'application/json' },
            body: JSON.stringify({ prompt: transcript(systemPrompt, messages), model: { id: id, providerID: 'opencode' } })
          }).then(function (r) {
            return r.text().then(function (raw) {
              var j = safeJson(raw, {});
              if (!r.ok) {
                var msg = j.message || (j.error && j.error.message) || raw.slice(0, 200) || ('HTTP ' + r.status);
                errors.push(id + ': ' + msg);
                if (r.status === 429 && /free usage limit/i.test(msg)) throw new Error('RATE_LIMIT');
                return attempt(i + 1);
              }
              var text = (j.data && j.data.text) || '';
              if (!text) { errors.push(id + ': رد فارغ'); return attempt(i + 1); }
              return { text: text, mode: 'live', provider: 'opencode-local', model: id, usage: estimateUsage(systemPrompt, messages, text) };
            });
          }).catch(function (e) {
            if (e.message === 'RATE_LIMIT') throw e;
            errors.push(id + ': ' + e.message);
            return attempt(i + 1);
          });
        }
        return attempt(0).catch(function (e) {
          return fallback(errors.join('\n') || e.message);
        });
      });
    }

    if (mode === 'zen') {
      return listZenModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        var pool = settings.freeOnly && listing.free.length ? listing.free : listing.models.map(function (m) { return m.id; });
        var first = pickModel(agent.id, pool, settings.modelOverrides[agent.id]);
        var chain = fallbackChain(agent.id, pool, first).slice(0, 3);
        var errors = [];
        function attempt(i) {
          if (i >= chain.length) return fallback(errors.join('\n'));
          var id = chain[i];
          return nativeFetch(settings.zenBase.replace(/\/$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer ' + settings.zenKey },
            body: JSON.stringify({
              model: id,
              messages: [{ role: 'system', content: systemPrompt }].concat(messages.map(function (m) { return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }; })),
              temperature: 0.7
            })
          }).then(function (r) {
            return r.text().then(function (raw) {
              var j = safeJson(raw, {});
              if (!r.ok) {
                var msg = (j.error && j.error.message) || j.message || raw.slice(0, 200) || ('HTTP ' + r.status);
                errors.push(id + ': ' + msg);
                if (r.status === 429) throw new Error('RATE_LIMIT');
                return attempt(i + 1);
              }
              var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
              if (!text) { errors.push(id + ': رد فارغ'); return attempt(i + 1); }
              return { text: text, mode: 'live', provider: 'opencode-zen', model: id, usage: estimateUsage(systemPrompt, messages, text) };
            });
          }).catch(function (e) {
            if (e.message === 'RATE_LIMIT') throw e;
            errors.push(id + ': ' + e.message);
            return attempt(i + 1);
          });
        }
        return attempt(0).catch(function (e) { return fallback(errors.join('\n') || e.message); });
      });
    }

    if (mode === 'openrouter') {
      if (!settings.openrouterKey) return Promise.resolve(fallback('أدخل مفتاح OpenRouter.'));
      return nativeFetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + settings.openrouterKey, 'HTTP-Referer': location.origin, 'X-Title': 'MDM1 AI Office' },
        body: JSON.stringify({
          model: settings.openrouterModel || 'openai/gpt-4o-mini:free',
          messages: [{ role: 'system', content: systemPrompt }].concat(messages.map(function (m) { return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }; })),
          temperature: 0.7
        })
      }).then(function (r) {
        return r.text().then(function (raw) {
          var j = safeJson(raw, {});
          if (!r.ok) return fallback((j.error && j.error.message) || raw.slice(0, 200));
          var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
          if (!text) return fallback('رد فارغ');
          return { text: text, mode: 'live', provider: 'openrouter', model: settings.openrouterModel, usage: estimateUsage(systemPrompt, messages, text) };
        });
      }).catch(function (e) { return fallback(e.message); });
    }

    return Promise.resolve(fallback('مزود غير معروف: ' + mode));
  }

  /* ── structured tags from agent replies ───────────────────────────────── */
  function riskNote(risk) {
    if (risk === 'high') return '🛡️ فحص مسؤول الأمان: إجراء عالي الخطورة — يتطلب مراجعة يدوية صريحة.';
    if (risk === 'low') return '🛡️ فحص مسؤول الأمان: إجراء منخفض الخطورة.';
    return '🛡️ فحص مسؤول الأمان: تعديل تشغيلي أو مالي متوسط الأثر — مسموح بعد موافقة المدير.';
  }

  function extractProposals(text) {
    var requests = [];
    var clean = String(text || '');
    clean = clean.replace(/\[APPROVAL_REQUEST\s+title="([^"]+)"(?:\s+risk="([^"]+)")?(?:\s+action="([^"]+)")?\]([\s\S]*?)\[\/APPROVAL_REQUEST\]/g, function (_, title, risk, action, details) {
      requests.push({ title: title.trim(), risk: (risk || 'medium').trim(), actionType: (action || 'agent_proposal').trim(), details: details.trim(), payload: {} });
      return '';
    });
    clean = clean.replace(/\[HIRE_AGENT\s+id="([^"]+)"\s+name="([^"]+)"(?:\s+department="([^"]+)")?(?:\s+avatar="([^"]+)")?\]([\s\S]*?)\[\/HIRE_AGENT\]/g, function (_, id, name, dept, avatar, details) {
      requests.push({ title: 'تعيين موظف جديد: ' + name, risk: 'medium', actionType: 'hire_agent', details: details.trim(), payload: { id: id.trim(), name: name.trim(), department: (dept || 'فريق جديد').trim(), avatar: (avatar || '🤖').trim(), roleDescription: details.trim() } });
      return '';
    });
    clean = clean.replace(/\[UPDATE_SKILLS\s+target="([^"]+)"(?:\s+title="([^"]+)")?\]([\s\S]*?)\[\/UPDATE_SKILLS\]/g, function (_, target, title, additions) {
      requests.push({ title: (title || ('تحديث مهارات ' + target)).trim(), risk: 'medium', actionType: 'update_skills', details: additions.trim(), payload: { targetAgentId: target.trim(), skillsAddition: additions.trim() } });
      return '';
    });
    clean = clean.replace(/\[MEMO\s+to="([^"]+)"(?:\s+subject="([^"]+)")?\]([\s\S]*?)\[\/MEMO\]/g, function (_, to, subject, body) {
      requests.push({ _type: 'memo', toId: to.trim(), subject: (subject || 'مذكرة داخلية').trim(), body: body.trim() });
      return '';
    });
    return { cleanText: clean.trim(), requests: requests };
  }

  function addApproval(data) {
    var item = {
      id: 'apr-' + uuid().slice(0, 8),
      agentId: data.agentId,
      agentName: data.agentName,
      title: data.title,
      details: data.details || '',
      risk: data.risk || 'medium',
      securityNote: riskNote(data.risk || 'medium'),
      actionType: data.actionType || 'agent_proposal',
      payload: data.payload || {},
      status: 'pending',
      createdAt: nowIso(),
      resolvedAt: null,
      executionResult: null
    };
    state.approvals.unshift(item);
    recomputeStatus(item.agentId);
    logAudit('approval_created', item.agentId, 'Created approval: ' + item.title, { id: item.id });
    telegramNotify('⏳ *طلب موافقة جديد*\n\n👤 ' + item.agentName + '\n📌 ' + item.title + '\n⚠️ ' + item.risk + '\n📝 ' + String(item.details || '').slice(0, 500));
    return item;
  }

  function processProposals(agentId, agentName, agentAvatar, requests) {
    (requests || []).forEach(function (r) {
      if (r._type === 'memo') {
        var target = getAgent(r.toId);
        state.internalMemos.push({ id: 'memo-' + uuid().slice(0, 8), fromId: agentId, fromName: agentName, fromAvatar: agentAvatar, toId: r.toId, toName: target ? target.name : r.toId, toAvatar: target ? target.avatar : '🤖', subject: r.subject, body: r.body, timestamp: nowIso() });
        logAudit('internal_memo', agentId, 'Memo to ' + r.toId + ': ' + r.subject);
      } else {
        addApproval(Object.assign({ agentId: agentId, agentName: agentName }, r));
      }
    });
  }

  /* ── Telegram (queue + share links; no token in the page) ─────────────── */
  function telegramNotify(text) {
    if (settings.relayUrl) {
      nativeFetch(settings.relayUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text, chatId: settings.telegramChatId || undefined, secret: settings.relaySecret || undefined })
      }).catch(function () { /* queue below */ });
    }
    state.telegramOutbox.unshift({ id: uuid(), text: text, createdAt: nowIso(), sent: false });
    state.telegramOutbox = state.telegramOutbox.slice(0, 30);
    saveState();
  }
  function telegramShareLink(text) {
    var bot = (settings.telegramBot || '').replace(/^@/, '');
    if (!bot) return null;
    return 'https://t.me/' + encodeURIComponent(bot) + '?text=' + encodeURIComponent(String(text || '').slice(0, 3500));
  }
  function telegramSecretLink() {
    var bot = (settings.telegramBot || '').replace(/^@/, '');
    if (!bot) return null;
    var code = String(Math.floor(100000 + Math.random() * 900000));
    return { code: code, url: 'https://t.me/' + encodeURIComponent(bot) + '?start=' + code };
  }

  /* ── simulator (ported from lib/simulator.js) ─────────────────────────── */
  function runSimulation(input) {
    var fixed = num(input.fixedCostUsd, 0);
    var ad = num(input.adBudgetUsd, 0);
    var price = Math.max(1, num(input.pricePerCustomerUsd, 49));
    var apiCost = Math.max(0, num(input.apiCostPerCustomerUsd, 0));
    var cpc = Math.max(0.05, num(input.cpcUsd, 0.8));
    var conv = Math.max(0.1, num(input.conversionRatePct, 2.5)) / 100;
    var contributionMargin = price - apiCost;
    var totalUpfrontCost = fixed + ad;
    var breakEven = contributionMargin > 0 ? Math.ceil(totalUpfrontCost / contributionMargin) : -1;
    var baseClicks = ad / cpc;
    var baseCustomers = Math.max(1, Math.round(baseClicks * conv));
    var scenarios = [
      { key: 'conservative', label: 'متحفظ 🐢', multiplier: 0.6 },
      { key: 'realistic', label: 'واقعي ⚖️', multiplier: 1.0 },
      { key: 'optimistic', label: 'متفائل 🚀', multiplier: 1.7 }
    ].map(function (s) {
      var customers = Math.max(1, Math.round(baseCustomers * s.multiplier));
      var revenue = Number((customers * price).toFixed(2));
      var totalApiCost = Number((customers * apiCost).toFixed(2));
      var totalCost = Number((fixed + ad + totalApiCost).toFixed(2));
      var netProfit = Number((revenue - totalCost).toFixed(2));
      var roiPct = totalCost > 0 ? Number(((netProfit / totalCost) * 100).toFixed(1)) : 0;
      return { key: s.key, label: s.label, customers: customers, revenue: revenue, totalApiCost: totalApiCost, totalCost: totalCost, netProfit: netProfit, roiPct: roiPct };
    });
    return {
      projectName: input.projectName || 'مشروع جديد',
      inputs: { fixed: fixed, ad: ad, price: price, apiCost: apiCost, cpc: cpc, conversionRatePct: conv * 100 },
      contributionMargin: Number(contributionMargin.toFixed(2)),
      breakEvenCustomers: breakEven,
      scenarios: scenarios,
      createdAt: nowIso()
    };
  }

  /* ── web search (optional, no key) ────────────────────────────────────── */
  function webSearch(query) {
    var q = String(query || '').trim();
    if (!q) return Promise.resolve({ engine: 'none', results: [] });
    // Wikipedia supports CORS with origin=*, so it works directly from a static page.
    var wiki = 'https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
      encodeURIComponent(q) + '&gsrlimit=6&prop=extracts&exintro=1&explaintext=1&exchars=320&format=json&origin=*';
    return nativeFetch(wiki, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var pages = Object.keys((j.query && j.query.pages) || {}).map(function (k) { return j.query.pages[k]; });
      var results = pages.map(function (p) {
        return {
          title: p.title || q,
          snippet: String(p.extract || '').slice(0, 320),
          url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(p.title || q).replace(/\s+/g, '_'))
        };
      });
      if (results.length) return { engine: 'Wikipedia', results: results.slice(0, 6) };
      throw new Error('empty');
    }).catch(function () {
      // Fallback: DuckDuckGo instant answers (some browsers block its CORS).
      var ddg = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1';
      return nativeFetch(ddg, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        var results = [];
        if (j.AbstractText) results.push({ title: j.Heading || q, snippet: j.AbstractText, url: j.AbstractURL || '' });
        (j.RelatedTopics || []).slice(0, 6).forEach(function (t) {
          if (t.Text && t.FirstURL) results.push({ title: t.Text.slice(0, 80), snippet: t.Text, url: t.FirstURL });
        });
        return { engine: results.length ? 'DuckDuckGo' : 'unavailable', results: results.slice(0, 6) };
      }).catch(function () { return { engine: 'unavailable', results: [] }; });
    });
  }

  /* ── snapshots (AES-GCM, browser only) ────────────────────────────────── */
  function b64(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function deriveKey(passphrase) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(passphrase || 'mdm1-office-default'), { name: 'PBKDF2' }, false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('mdm1-office-salt-v1'), iterations: 120000, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
    });
  }
  function createSnapshot(label, passphrase) {
    var payload = clone(state);
    delete payload.snapshots;
    payload.__snapshot = { label: label, createdAt: nowIso(), version: '2.0.0' };
    var json = JSON.stringify(payload);
    return deriveKey(passphrase).then(function (key) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(json)).then(function (cipher) {
        var record = {
          id: 'snap-' + uuid().slice(0, 8),
          label: label || 'نسخة احتياطية',
          alg: 'AES-256-GCM',
          fileCount: 1,
          size: cipher.byteLength,
          createdAt: nowIso(),
          iv: b64(iv),
          data: b64(cipher)
        };
        var snaps = readLS(LS_SNAPS, []);
        snaps.unshift(record);
        snaps = snaps.slice(0, 5);
        writeLS(LS_SNAPS, snaps);
        state.snapshots = snaps.map(function (s) { return { id: s.id, label: s.label, alg: s.alg, fileCount: s.fileCount, size: s.size, createdAt: s.createdAt }; });
        logAudit('snapshot_created', 'ceo', 'Encrypted snapshot ' + record.id);
        saveState();
        return record;
      });
    });
  }
  function restoreSnapshot(id, passphrase) {
    var snaps = readLS(LS_SNAPS, []);
    var rec = snaps.find(function (s) { return s.id === id; });
    if (!rec) return Promise.reject(new Error('النسخة غير موجودة'));
    return deriveKey(passphrase).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.data)).then(function (plain) {
        var payload = JSON.parse(new TextDecoder().decode(plain));
        var snapsMeta = state.snapshots;
        state = Object.assign(initialState(), payload);
        state.snapshots = snapsMeta;
        saveNow();
        logAudit('snapshot_restored', 'ceo', 'Time-travel rollback to ' + id);
        return { restoredCount: 1, snapshotDate: rec.createdAt };
      });
    });
  }

  function downloadSnapshot(id) {
    var snaps = readLS(LS_SNAPS, []);
    var rec = snaps.find(function (s) { return s.id === id; });
    if (!rec) return Promise.reject(new Error('النسخة غير موجودة'));
    var blob = new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = rec.id + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    return Promise.resolve(rec);
  }

  /* ── exports / knowledge ──────────────────────────────────────────────── */
  function writeExport(filename, content) {
    state.exportContents[filename] = String(content || '');
    var keys = Object.keys(state.exportContents);
    if (keys.length > 12) delete state.exportContents[keys[0]];
    state.exports.unshift({ filename: filename, size: String(content || '').length, preview: String(content || '').slice(0, 400) });
    state.exports = state.exports.slice(0, 20);
  }

  /* ── HR workload (self-expansion) ─────────────────────────────────────── */
  function hrWorkloadCheck() {
    var byAgent = {};
    state.tasks.forEach(function (t) {
      if (t.status !== 'working' && t.status !== 'pending') return;
      byAgent[t.agentId] = (byAgent[t.agentId] || 0) + 1;
    });
    var proposals = [];
    Object.keys(byAgent).forEach(function (agentId) {
      if (byAgent[agentId] < 3) return;
      var agent = getAgent(agentId);
      if (!agent) return;
      var already = state.approvals.some(function (a) { return a.status === 'pending' && a.actionType === 'hire_agent' && a.payload && a.payload.forAgent === agentId; });
      if (already) return;
      var proposal = addApproval({
        agentId: 'hr-manager',
        agentName: 'مديرة الموارد البشرية',
        title: 'مقترح توسع: مساند لقسم ' + agent.department,
        details: 'رصدت ضغط عمل مرتفعاً (' + byAgent[agentId] + ' مهام جارية). أقترح تعيين مساعد متخصص لتخفيف الحمل عن ' + agent.name + '.',
        risk: 'medium',
        actionType: 'hire_agent',
        payload: { id: 'assistant-' + agentId + '-' + Date.now().toString(36), name: 'مساعد ' + agent.name, department: agent.department, avatar: '🤖', roleDescription: 'مساند لقسم ' + agent.department + ' تحت إشراف ' + agent.name, forAgent: agentId }
      });
      proposals.push(proposal);
    });
    return proposals;
  }

  /* ── schedules ────────────────────────────────────────────────────────── */
  function runDailyBrief() {
    var ea = getAgent('executive-assistant');
    if (!ea) return Promise.resolve('');
    var pending = state.approvals.filter(function (a) { return a.status === 'pending'; }).length;
    var tasks = state.tasks.slice(0, 5).map(function (t) { return '- ' + t.title + ' (' + t.status + ')'; }).join('\n');
    return aiGenerate({
      agentId: ea.id,
      messages: [{ role: 'user', text: 'أعدّي النشرة الصباحية التنفيذية:\n- الموافقات المعلقة: ' + pending + '\n- المهام:\n' + tasks + '\n- العملاء: ' + state.customers.length + '\n- التوكنز: ' + state.usageStats.totalTokens }]
    }).then(function (r) {
      recordUsage(ea.id, r.usage);
      state.teamChat.push({ id: uuid(), senderId: ea.id, senderName: 'السكرتيرة التنفيذية (النشرة الصباحية ☀️)', senderAvatar: '☀️', role: 'assistant', text: r.text, timestamp: nowIso() });
      state.liveBubbles[ea.id] = 'أصدرت النشرة الصباحية ☀️';
      telegramNotify('☀️ *النشرة الصباحية التنفيذية*\n\n' + String(r.text).slice(0, 1200));
      logAudit('daily_brief', 'scheduler', 'Morning brief sent');
      saveState();
      return r.text;
    });
  }

  function runWeeklyResearch() {
    var agent = getAgent('web-research-team');
    if (!agent) return Promise.resolve('');
    return webSearch('best new AI SaaS tools 2026 automation white-label').then(function (search) {
      var ctx = search.results.map(function (r) { return '- ' + r.title + ': ' + r.snippet + ' (' + r.url + ')'; }).join('\n') || 'لم تتوفر نتائج. اقترح من معرفتك.';
      return aiGenerate({ agentId: agent.id, extraContext: 'نتائج بحث ويب:\n' + ctx, messages: [{ role: 'user', text: 'أعد تقريراً أسبوعياً عن 3 أدوات/فرص SaaS جديدة قابلة للاستخدام أو إعادة البيع.' }] });
    }).then(function (r) {
      recordUsage(agent.id, r.usage);
      var ex = extractProposals(r.text);
      state.teamChat.push({ id: uuid(), senderId: agent.id, senderName: 'فريق البحث (تقرير أسبوعي 📊)', senderAvatar: '📊', role: 'assistant', text: ex.cleanText || r.text, timestamp: nowIso() });
      state.liveBubbles[agent.id] = 'أنجزت التقرير الأسبوعي 📊';
      awardPoints(agent.id, 20, 'تقرير فرص SaaS الأسبوعي');
      writeExport('weekly-saas-' + Date.now() + '.md', '# تقرير فرص SaaS الأسبوعي\n\n' + (ex.cleanText || r.text) + '\n');
      processProposals(agent.id, agent.name, agent.avatar, ex.requests);
      telegramNotify('📊 *تقرير فرص SaaS الأسبوعي*\n\n' + String(ex.cleanText || r.text).slice(0, 1200));
      saveState();
      return ex.cleanText || r.text;
    });
  }

  function runWeeklyKpi() {
    var trainer = getAgent('ai-trainer');
    if (!trainer) return Promise.resolve('');
    var summaries = allAgents().map(function (a) {
      var chatCount = (state.directChats[a.id] || []).length;
      var done = state.approvals.filter(function (ap) { return ap.agentId === a.id && ap.status === 'approved'; }).length;
      var earned = 15 + Math.min(35, chatCount * 2 + done * 10);
      var res = awardPoints(a.id, earned, 'تقييم الأداء الأسبوعي (KPI)');
      return '- ' + a.name + ': +' + earned + ' نقطة (الإجمالي: ' + res.profile.points + ' | ' + res.profile.rankTitle + ')';
    }).join('\n');
    return aiGenerate({ agentId: trainer.id, messages: [{ role: 'user', text: 'أعدّي تقييم الأداء الأسبوعي (KPI) لجميع الموظفين واقترحي تحسينات على skills.md:\n\n' + summaries }] }).then(function (r) {
      recordUsage(trainer.id, r.usage);
      var ex = extractProposals(r.text);
      state.kpiReviews.unshift({ id: 'kpi-' + uuid().slice(0, 8), reviewerId: trainer.id, reviewerName: trainer.name, report: (ex.cleanText || r.text) + '\n\n📊 ملخص النقاط:\n' + summaries, timestamp: nowIso() });
      state.teamChat.push({ id: uuid(), senderId: trainer.id, senderName: 'المدربة (تقييم الأداء الأسبوعي 📈)', senderAvatar: '📈', role: 'assistant', text: ex.cleanText || r.text, timestamp: nowIso() });
      state.liveBubbles[trainer.id] = 'أنجزت تقييم الأداء والنقاط 📈';
      processProposals(trainer.id, trainer.name, trainer.avatar, ex.requests);
      saveState();
      return ex.cleanText || r.text;
    });
  }

  function recordUsage(agentId, usage) {
    if (!usage || !usage.totalTokens) return;
    state.usageStats.totalTokens += usage.totalTokens;
    state.usageStats.totalCostUsd = Number((state.usageStats.totalCostUsd + (usage.costUsd || 0)).toFixed(6));
    if (!state.usageStats.byAgent[agentId]) state.usageStats.byAgent[agentId] = { tokens: 0, costUsd: 0 };
    state.usageStats.byAgent[agentId].tokens += usage.totalTokens;
    state.usageStats.byAgent[agentId].costUsd = Number((state.usageStats.byAgent[agentId].costUsd + (usage.costUsd || 0)).toFixed(6));
  }

  /* ── bootstrap payload ────────────────────────────────────────────────── */
  function buildBootstrap() {
    var assignments = roleAssignments([]);
    return Promise.all([listLocalModels(), listZenModels()]).then(function (results) {
      var local = results[0], zen = results[1];
      var mode = currentMode();
      var free = mode === 'zen' ? zen.free : local.free;
      var allIds = (mode === 'zen' ? zen.models : local.models).map(function (m) { return m.id; });
      if (mode === 'local' && !allIds.length) allIds = FALLBACK_MODELS.slice();
      if (mode === 'zen' && !allIds.length) allIds = FALLBACK_MODELS.slice();
      assignments = roleAssignments(allIds.length ? allIds : FALLBACK_MODELS);
      var connected = mode === 'demo' ? false : (mode === 'zen' ? zen.connected : (mode === 'openrouter' ? Boolean(settings.openrouterKey) : local.connected));
      var modelLabel = settings.modelOverrides['*'] || (mode === 'local' || mode === 'zen' ? (free[0] || 'auto') : (mode === 'openrouter' ? settings.openrouterModel : 'demo'));
      var agents = allAgents().map(function (a) {
        var g = ensureProfile(a.id);
        return Object.assign({}, a, {
          status: state.agentStatuses[a.id] || a.status || 'available',
          bubble: state.liveBubbles[a.id] || '',
          gamification: g,
          memoryCount: (state.memories[a.id] || []).length,
          assignedModel: assignments[a.id] || null
        });
      });
      return {
        providerConfig: { provider: mode, model: modelLabel, hasKey: connected, baseUrl: settings.localUrl },
        providerStatus: {
          provider: mode,
          model: modelLabel,
          hasKey: connected,
          local: { connected: local.connected, baseUrl: settings.localUrl, error: local.error, modelCount: local.models.length },
          zen: { connected: zen.connected, error: zen.error, modelCount: zen.models.length },
          freeModels: free,
          lastError: settings.lastError
        },
        models: free,
        roleModels: assignments,
        telegramEnabled: Boolean(settings.telegramBot || settings.relayUrl),
        outgoingWebhooks: { n8n: false, marketing: false, email: false, sheets: false },
        agents: agents,
        knowledgeFiles: DATA.knowledge.map(function (k) { return { filename: k.filename, content: state.knowledgeOverrides[k.filename] != null ? state.knowledgeOverrides[k.filename] : k.content }; }),
        exports: state.exports,
        auditLog: state.auditLog.slice(0, 50),
        sandboxFiles: state.sandboxFiles,
        memoryStats: memoryStats(),
        playbooks: DATA.playbooks,
        snapshots: state.snapshots,
        state: state
      };
    });
  }

  /* ── API router ───────────────────────────────────────────────────────── */
  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  function handleApi(method, path, body) {
    var b = body || {};
    var m;

    if (method === 'GET' && path === '/api/bootstrap') {
      return buildBootstrap().then(function (d) { return jsonResponse(d); });
    }
    if (method === 'GET' && path === '/api/models') {
      return Promise.all([listLocalModels(true), listZenModels(true)]).then(function (r) {
        var mode = currentMode();
        var listing = mode === 'zen' ? r[1] : r[0];
        return jsonResponse({
          connected: listing.connected,
          baseUrl: mode === 'zen' ? settings.zenBase : settings.localUrl,
          error: listing.error,
          models: listing.models,
          freeModels: listing.free,
          assignments: roleAssignments(listing.models.map(function (x) { return x.id; }))
        });
      });
    }

    if (method === 'POST' && path === '/api/chat/direct') {
      var agent = getAgent(b.agentId);
      if (!agent) return Promise.resolve(jsonResponse({ error: 'Agent not found' }, 404));
      if (!state.directChats[agent.id]) state.directChats[agent.id] = [];
      var userMsg = String(b.message || '').trim();
      if (!userMsg) return Promise.resolve(jsonResponse({ error: 'message required' }, 400));
      var memories = retrieveMemories(agent.id, userMsg, 4);
      state.directChats[agent.id].push({ id: uuid(), role: 'user', text: userMsg, timestamp: nowIso() });
      indexMemory(agent.id, 'user', userMsg, 'direct');
      var memos = state.internalMemos.filter(function (x) { return x.toId === agent.id; }).slice(-3);
      var extra = memos.length ? 'مذكرات داخلية:\n' + memos.map(function (x) { return 'من ' + x.fromName + ': ' + x.subject + ' — ' + x.body; }).join('\n') : '';
      var history = state.directChats[agent.id].slice(-12);
      return aiGenerate({ agentId: agent.id, messages: history, memories: memories, extraContext: extra }).then(function (r) {
        recordUsage(agent.id, r.usage);
        var ex = extractProposals(r.text);
        var replyText = ex.cleanText || r.text;
        var assistantMsg = { id: uuid(), role: 'assistant', text: replyText, mode: r.mode, model: r.model, ragUsed: memories.length, timestamp: nowIso() };
        state.directChats[agent.id].push(assistantMsg);
        indexMemory(agent.id, 'assistant', replyText, 'direct');
        state.liveBubbles[agent.id] = replyText.slice(0, 42) + '...';
        awardPoints(agent.id, 5, 'إنجاز محادثة');
        processProposals(agent.id, agent.name, agent.avatar, ex.requests);
        recomputeStatus(agent.id);
        hrWorkloadCheck();
        logAudit('direct_chat', agent.id, 'Chat (' + (r.usage ? r.usage.totalTokens : 0) + ' tok)', { mode: r.mode, model: r.model });
        saveState();
        return jsonResponse({ reply: assistantMsg, ragUsed: memories.length, warning: r.warning || null });
      });
    }

    if (method === 'POST' && path === '/api/chat/team') {
      var message = String(b.message || '').trim();
      if (!message) return Promise.resolve(jsonResponse({ error: 'message required' }, 400));
      var ids = Array.isArray(b.attendeeIds) && b.attendeeIds.length ? b.attendeeIds : ['executive-assistant', 'hr-manager', 'auditors-experts-devs'];
      var attendees = allAgents().filter(function (a) { return ids.indexOf(a.id) !== -1; });
      state.meetingActive = true;
      state.meetingAttendees = attendees.map(function (a) { return a.id; });
      state.teamChat.push({ id: uuid(), senderId: 'ceo', senderName: 'المدير التنفيذي (أنت)', senderAvatar: '👑', role: 'user', text: message, timestamp: nowIso() });
      var recent = state.teamChat.slice(-8).map(function (x) { return x.senderName + ': ' + x.text; }).join('\n');
      return Promise.all(attendees.map(function (a) {
        return aiGenerate({ agentId: a.id, extraContext: 'أنت في اجتماع جماعي (Stand-up). أجب باختصار (2-4 أسطر).', messages: [{ role: 'user', text: 'سياق:\n' + recent + '\n\nتوجيه المدير: ' + message }] }).then(function (r) { return { agent: a, r: r }; });
      })).then(function (replies) {
        replies.forEach(function (x) {
          var ex = extractProposals(x.r.text);
          state.teamChat.push({ id: uuid(), senderId: x.agent.id, senderName: x.agent.name, senderAvatar: x.agent.avatar, role: 'assistant', text: ex.cleanText || x.r.text, mode: x.r.mode, timestamp: nowIso() });
          indexMemory(x.agent.id, 'assistant', ex.cleanText || x.r.text, 'team');
          state.liveBubbles[x.agent.id] = (ex.cleanText || x.r.text).slice(0, 40) + '...';
          recordUsage(x.agent.id, x.r.usage);
          awardPoints(x.agent.id, 10, 'مشاركة في اجتماع الفريق');
          processProposals(x.agent.id, x.agent.name, x.agent.avatar, ex.requests);
          recomputeStatus(x.agent.id);
        });
        logAudit('team_meeting', 'ceo', 'Stand-up with ' + attendees.length + ' agents');
        saveState();
        return jsonResponse({ ok: true });
      });
    }

    if (method === 'POST' && path === '/api/meeting/end') {
      state.meetingActive = false; state.meetingAttendees = []; saveState();
      return Promise.resolve(jsonResponse({ ok: true }));
    }

    if (method === 'POST' && path === '/api/votes') {
      var topic = String(b.topic || '').trim();
      var options = Array.isArray(b.options) ? b.options.map(String).map(function (s) { return s.trim(); }).filter(Boolean) : [];
      if (!topic || options.length < 2) return Promise.resolve(jsonResponse({ error: 'يرجى إدخال الموضوع وخيارين على الأقل' }, 400));
      var voterIds = Array.isArray(b.voterIds) && b.voterIds.length >= 2 ? b.voterIds : ['web-research-team', 'auditors-experts-devs', 'accountant', 'security-officer'];
      var voters = allAgents().filter(function (a) { return voterIds.indexOf(a.id) !== -1; });
      return Promise.all(voters.map(function (a, idx) {
        return aiGenerate({
          agentId: a.id,
          extraContext: 'أنت تشارك في تصويت ديمقراطي. اختر خياراً واحداً فقط وأنهِ ردك بالوسم:\n[VOTE choice="اسم الخيار بالضبط"]سبب الاختيار في سطرين[/VOTE]',
          messages: [{ role: 'user', text: 'موضوع التصويت: ' + topic + '\nالخيارات:\n' + options.map(function (o, i) { return (i + 1) + '. ' + o; }).join('\n') }]
        }).then(function (r) {
          recordUsage(a.id, r.usage);
          var mm = r.text.match(/\[VOTE\s+choice="([^"]+)"\]([\s\S]*?)\[\/VOTE\]/);
          var choice = mm ? mm[1].trim() : null;
          var reason = mm ? mm[2].trim() : r.text;
          if (!choice || options.indexOf(choice) === -1) {
            choice = options.find(function (o) { return r.text.indexOf(o) !== -1; }) || options[idx % options.length];
            if (!mm) reason = 'توصية ' + a.name + ' بناءً على تخصص (' + a.department + '): الأنسب هو "' + choice + '".';
          }
          awardPoints(a.id, 10, 'تصويت على: ' + topic.slice(0, 25));
          return { agentId: a.id, agentName: a.name, avatar: a.avatar, department: a.department, choice: choice, reason: reason };
        });
      })).then(function (ballots) {
        var tally = {};
        options.forEach(function (o) { tally[o] = 0; });
        ballots.forEach(function (x) { tally[x.choice] = (tally[x.choice] || 0) + 1; });
        var winner = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0] || options[0];
        var vote = { id: 'vote-' + uuid().slice(0, 8), topic: topic, options: options, ballots: ballots, tally: tally, winner: winner, convertedToApproval: false, createdAt: nowIso() };
        state.votes.unshift(vote);
        logAudit('democratic_vote', 'ceo', 'Vote "' + topic + '" -> Winner: ' + winner, tally);
        saveState();
        return jsonResponse({ vote: vote }, 201);
      });
    }

    m = path.match(/^\/api\/votes\/([^/]+)\/to-approval$/);
    if (method === 'POST' && m) {
      var vote = state.votes.find(function (v) { return v.id === m[1]; });
      if (!vote) return Promise.resolve(jsonResponse({ error: 'Vote not found' }, 404));
      vote.convertedToApproval = true;
      var summary = vote.ballots.map(function (x) { return '- ' + x.avatar + ' ' + x.agentName + ' صوّت لـ (' + x.choice + '): ' + x.reason; }).join('\n');
      var apr = addApproval({ agentId: 'executive-assistant', agentName: 'المجلس الديمقراطي للشركة', title: 'اعتماد نتيجة التصويت: ' + vote.winner + ' (' + vote.topic + ')', details: 'الفائز بالأغلبية: **' + vote.winner + '**\n\nتفاصيل الأصوات:\n' + summary, risk: 'low', actionType: 'project_decision', payload: { voteId: vote.id, winner: vote.winner } });
      saveState();
      return Promise.resolve(jsonResponse({ approval: apr }));
    }

    if (method === 'POST' && path === '/api/customers') {
      if (!String(b.name || '').trim()) return Promise.resolve(jsonResponse({ error: 'اسم العميل مطلوب' }, 400));
      var cust = {
        id: 'cust-' + uuid().slice(0, 8), portalToken: 'portal-' + uuid().slice(0, 10), name: String(b.name).trim(), contactName: String(b.contactName || '').trim(),
        email: String(b.email || '').trim(), phone: String(b.phone || '').trim(), stage: b.stage || 'عميل محتمل', projectTitle: String(b.projectTitle || 'مشروع جديد').trim(),
        totalValueUsd: num(b.totalValueUsd, 0), paidUsd: 0, assignedTo: b.assignedTo || 'marketing-lead', notes: String(b.notes || '').trim(), createdAt: nowIso().slice(0, 10)
      };
      state.customers.unshift(cust);
      logAudit('crm_customer_added', 'ceo', 'Added customer ' + cust.name);
      saveState();
      return Promise.resolve(jsonResponse({ customer: cust }, 201));
    }

    m = path.match(/^\/api\/customers\/([^/]+)\/payment$/);
    if (method === 'POST' && m) {
      var amt = num(b.amountUsd, 0);
      if (amt <= 0) return Promise.resolve(jsonResponse({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, 400));
      var c = state.customers.find(function (x) { return x.id === m[1]; });
      if (!c) return Promise.resolve(jsonResponse({ error: 'العميل غير موجود' }, 404));
      c.paidUsd = Number((c.paidUsd + amt).toFixed(2));
      if (c.paidUsd >= c.totalValueUsd && c.totalValueUsd > 0) c.stage = 'مكتمل';
      else if (c.stage === 'عميل محتمل' || c.stage === 'قيد التفاوض') c.stage = 'نشط';
      state.financialLedger.push({ id: 'fin-' + uuid().slice(0, 8), type: 'revenue', title: 'دفعة عميل: ' + c.name + ' (' + c.projectTitle + ')', amountUsd: amt, date: nowIso().slice(0, 10), notes: b.notes || 'مسجلة عبر نظام CRM' });
      awardPoints('accountant', 15, 'تحصيل دفعة من ' + c.name);
      logAudit('crm_payment_recorded', 'accountant', 'Recorded $' + amt + ' from ' + c.name);
      saveState();
      return Promise.resolve(jsonResponse({ customer: c }));
    }

    m = path.match(/^\/api\/customers\/([^/]+)\/marketing$/);
    if (method === 'POST' && m) {
      var c2 = state.customers.find(function (x) { return x.id === m[1]; });
      if (!c2) return Promise.resolve(jsonResponse({ error: 'العميل غير موجود' }, 404));
      return aiGenerate({ agentId: 'marketing-lead', messages: [{ role: 'user', text: 'اكتب رسالة متابعة وعرض بيعي احترافية للعميل "' + c2.name + '" (جهة الاتصال: ' + c2.contactName + ') بخصوص مشروع "' + c2.projectTitle + '" (المرحلة: ' + c2.stage + ').' }] }).then(function (r) {
        recordUsage('marketing-lead', r.usage);
        var ex = extractProposals(r.text);
        var apr2 = addApproval({ agentId: 'marketing-lead', agentName: 'مسؤول التسويق', title: 'رسالة متابعة تسويقية للعميل: ' + c2.name, details: ex.cleanText || r.text, risk: 'low', actionType: 'publish_marketing', payload: { customerId: c2.id } });
        awardPoints('marketing-lead', 10, 'إعداد متابعة للعميل ' + c2.name);
        saveState();
        return jsonResponse({ approval: apr2 });
      });
    }

    if (method === 'POST' && path === '/api/hr/check-workload') {
      var proposals = hrWorkloadCheck();
      saveState();
      return Promise.resolve(jsonResponse({ proposalsCount: proposals.length, proposals: proposals }));
    }

    if (method === 'POST' && path === '/api/gamification/award') {
      if (!b.agentId || !b.points) return Promise.resolve(jsonResponse({ error: 'agentId and points required' }, 400));
      var resAward = awardPoints(b.agentId, num(b.points, 0), b.reason || 'مكافأة من المدير التنفيذي');
      saveState();
      return Promise.resolve(jsonResponse(resAward));
    }

    if (method === 'POST' && path === '/api/workflows/project') {
      var idea = String(b.idea || '').trim();
      if (!idea) return Promise.resolve(jsonResponse({ error: 'idea required' }, 400));
      var pipeline = ['web-research-team', 'auditors-experts-devs', 'accountant', 'security-officer'];
      state.meetingActive = true; state.meetingAttendees = pipeline;
      return webSearch(idea).then(function (search) {
        var searchSummary = search.results.length ? search.results.map(function (r) { return '- ' + r.title + ': ' + r.snippet + ' (' + r.url + ')'; }).join('\n') : 'لم تتوفر نتائج ويب — اعتمد تحليلك.';
        var stages = [
          { id: 'web-research-team', prompt: 'ابحث وحلل فرصة المشروع بالاعتماد على نتائج الويب:\n' + searchSummary + '\n\nالفكرة: ' + idea },
          { id: 'auditors-experts-devs', prompt: 'بناءً على تحليل فريق البحث:\n{PREV}\n\nقيّم الجدوى التقنية وهل نحتاج تعيين موظف جديد من HR؟' },
          { id: 'accountant', prompt: 'بناءً على المعطيات:\n{PREV}\n\nاحسب التكلفة التقديرية، نموذج التسعير، والعائد المتوقع.' },
          { id: 'security-officer', prompt: 'بناءً على الخطة:\n{PREV}\n\nأصدر تقييم المخاطر الأمنية (Low/Medium/High) وضوابط حماية البيانات.' }
        ];
        var outputs = [];
        var chain = Promise.resolve();
        stages.forEach(function (stage) {
          chain = chain.then(function () {
            var ag = getAgent(stage.id);
            if (!ag) return;
            var prev = outputs.map(function (s) { return '[' + s.name + ']: ' + s.text; }).join('\n\n');
            return aiGenerate({ agentId: ag.id, extraContext: 'أجب باختصار مركز (4 أسطر كحد أقصى) كجزء من سلسلة عمل.', messages: [{ role: 'user', text: stage.prompt.replace('{PREV}', prev.slice(-1800)) }] }).then(function (r) {
              recordUsage(ag.id, r.usage);
              state.liveBubbles[ag.id] = r.text.slice(0, 38) + '...';
              awardPoints(ag.id, 15, 'مشاركة في مسار مشروع');
              outputs.push({ id: ag.id, name: ag.name, avatar: ag.avatar, text: r.text });
              state.teamChat.push({ id: uuid(), senderId: ag.id, senderName: ag.name + ' (مسار المشروع)', senderAvatar: ag.avatar, role: 'assistant', text: r.text, timestamp: nowIso() });
            });
          });
        });
        return chain.then(function () {
          var combined = outputs.map(function (s) { return '### ' + s.avatar + ' ' + s.name + '\n' + s.text; }).join('\n\n');
          writeExport('workflow-' + Date.now() + '.md', '# دراسة مشروع: ' + idea + '\n\n' + combined + '\n');
          addApproval({ agentId: 'auditors-experts-devs', agentName: 'تحالف الأقسام', title: 'اعتماد إطلاق مشروع: ' + idea.slice(0, 50), details: combined.slice(0, 900), risk: 'medium', actionType: 'project_decision', payload: { idea: idea } });
          logAudit('project_workflow', 'ceo', '4-agent workflow: ' + idea.slice(0, 60));
          saveState();
          return jsonResponse({ ok: true, steps: outputs });
        });
      });
    }

    if (method === 'POST' && path === '/api/workflows/daily-brief') {
      return runDailyBrief().then(function (brief) { return jsonResponse({ ok: true, brief: brief || '' }); });
    }

    if (method === 'POST' && path === '/api/tasks') {
      var ag = getAgent(b.agentId);
      if (!ag || !b.title) return Promise.resolve(jsonResponse({ error: 'agentId and title required' }, 400));
      var task = { id: 'tsk-' + uuid().slice(0, 8), agentId: ag.id, title: String(b.title).trim(), description: String(b.description || '').trim(), status: 'working', createdAt: nowIso() };
      state.tasks.unshift(task);
      state.liveBubbles[ag.id] = 'أعمل على: ' + task.title.slice(0, 30);
      if (b.requiresApproval) addApproval({ agentId: ag.id, agentName: ag.name, title: 'اعتماد مهمة: ' + task.title, details: task.description || 'مهمة مسندة.', risk: 'medium', actionType: 'task_execution', payload: { taskId: task.id } });
      recomputeStatus(ag.id);
      hrWorkloadCheck();
      logAudit('task_assigned', 'ceo', 'Assigned "' + task.title + '" to ' + ag.id);
      saveState();
      return Promise.resolve(jsonResponse({ task: task }, 201));
    }

    m = path.match(/^\/api\/approvals\/([^/]+)\/decide$/);
    if (method === 'POST' && m) {
      if (['approved', 'rejected'].indexOf(b.decision) === -1) return Promise.resolve(jsonResponse({ error: 'decision must be approved or rejected' }, 400));
      var item = state.approvals.find(function (a) { return a.id === m[1]; });
      if (!item) return Promise.resolve(jsonResponse({ error: 'Not found' }, 404));
      item.status = b.decision;
      item.resolvedAt = nowIso();
      if (b.decision === 'approved') {
        var execResult = '✅ تم الاعتماد والتنفيذ في المكتب السحابي.';
        if (item.actionType === 'hire_agent' && item.payload) {
          var newId = item.payload.id || ('agent-' + uuid().slice(0, 6));
          if (!getAgent(newId)) {
            state.customAgents.push({
              id: newId, name: item.payload.name || 'موظف جديد', englishName: newId, avatar: item.payload.avatar || '🤖',
              department: item.payload.department || 'فريق جديد', zone: 'engineering-audit', reportsTo: 'hr-manager', status: 'available',
              requiresApprovalFor: ['external_action'], allowedTools: ['general_analysis'], externalAccess: [], rankTitle: 'موظف تنفيذي', level: 1,
              roleMd: item.payload.roleDescription || 'موظف ذكاء اصطناعي متخصص.', skillsMd: '- تنفيذ المهام المسندة'
            });
            execResult = '✅ تم تعيين **' + (item.payload.name || newId) + '** وإضافته إلى الهيكل التنظيمي.';
          }
        } else if (item.actionType === 'update_skills' && item.payload) {
          var target = getAgent(item.payload.targetAgentId);
          if (target) target.skillsMd = String(target.skillsMd || '') + '\n\n## تحديثات معتمدة\n' + item.payload.skillsAddition;
          execResult = '✅ تم تحديث مهارات ' + (target ? target.name : item.payload.targetAgentId) + '.';
        } else if (item.actionType === 'publish_marketing') {
          execResult = '✅ تم اعتماد المحتوى التسويقي — أرسله إلى قناة النشر أو تيليجرام.';
        } else if (item.actionType === 'project_decision') {
          execResult = '✅ تم اعتماد قرار المشروع وبدء التنفيذ.';
        }
        item.executionResult = execResult;
        state.liveBubbles[item.agentId] = 'تم تنفيذ: ' + item.title.slice(0, 28) + '...';
        awardPoints(item.agentId, 25, 'اعتماد وتنفيذ: ' + item.title.slice(0, 30));
        telegramNotify('✅ *تم الاعتماد*\n' + item.title + '\n' + execResult);
      } else {
        item.executionResult = '❌ تم رفض الطلب من قبل المدير التنفيذي.';
        state.liveBubbles[item.agentId] = 'تم رفض الطلب';
      }
      recomputeStatus(item.agentId);
      state.teamChat.push({ id: uuid(), senderId: 'executive-assistant', senderName: 'نظام القرارات (المكتب)', senderAvatar: b.decision === 'approved' ? '✅' : '❌', role: 'assistant', text: 'قرار المدير حول "' + item.title + '": ' + item.executionResult, timestamp: nowIso() });
      logAudit('approval_' + b.decision, 'ui', b.decision.toUpperCase() + ': ' + item.title, { id: item.id });
      saveState();
      return Promise.resolve(jsonResponse({ approval: item }));
    }

    if (method === 'POST' && path === '/api/agents/hire') {
      if (!b.id || !b.name) return Promise.resolve(jsonResponse({ error: 'id and name required' }, 400));
      var safeId = String(b.id).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (getAgent(safeId)) return Promise.resolve(jsonResponse({ error: 'Agent already exists' }, 400));
      var na = {
        id: safeId, name: b.name, englishName: b.englishName || safeId, avatar: b.avatar || '🤖', department: b.department || 'فريق جديد',
        zone: b.zone || 'engineering-audit', reportsTo: b.reportsTo || 'hr-manager', status: 'available',
        requiresApprovalFor: b.requiresApprovalFor || ['external_action'], allowedTools: ['general_analysis'], externalAccess: [],
        rankTitle: 'موظف تنفيذي', level: 1, roleMd: b.roleDescription || 'موظف ذكاء اصطناعي متخصص.', skillsMd: b.skillsList || '- تنفيذ المهام المسندة'
      };
      state.customAgents.push(na);
      ensureProfile(safeId);
      logAudit('hr_hire_manual', 'ceo', 'Hired ' + safeId);
      saveState();
      return Promise.resolve(jsonResponse({ agent: na }, 201));
    }

    if (method === 'POST' && path === '/api/knowledge') {
      if (!b.filename) return Promise.resolve(jsonResponse({ error: 'filename required' }, 400));
      var fn = String(b.filename).replace(/[^a-zA-Z0-9._\u0600-\u06FF-]/g, '_');
      state.knowledgeOverrides[fn] = String(b.content || '');
      var existing = DATA.knowledge.find(function (k) { return k.filename === fn; });
      if (!existing) DATA.knowledge.push({ filename: fn, content: String(b.content || '') });
      logAudit('knowledge_updated', 'ceo', 'Saved knowledge/' + fn);
      saveState();
      return Promise.resolve(jsonResponse({ filename: fn }));
    }

    if (method === 'POST' && path === '/api/memos') {
      var from = getAgent(b.fromId), to = getAgent(b.toId);
      if (!from || !to || !b.subject) return Promise.resolve(jsonResponse({ error: 'fromId, toId, subject required' }, 400));
      var memo = { id: 'memo-' + uuid().slice(0, 8), fromId: from.id, fromName: from.name, fromAvatar: from.avatar, toId: to.id, toName: to.name, toAvatar: to.avatar, subject: String(b.subject).trim(), body: String(b.body || '').trim(), timestamp: nowIso() };
      state.internalMemos.push(memo);
      awardPoints(from.id, 5, 'إرسال مذكرة تنسيق');
      logAudit('internal_memo', from.id, 'Memo to ' + to.id + ': ' + b.subject);
      saveState();
      return Promise.resolve(jsonResponse({ memo: memo }, 201));
    }

    if (method === 'POST' && path === '/api/schedules/toggle') {
      var sched = state.schedules.find(function (s) { return s.id === b.scheduleId; });
      if (!sched) return Promise.resolve(jsonResponse({ error: 'Schedule not found' }, 404));
      sched.enabled = Boolean(b.enabled);
      logAudit('schedule_toggled', 'ceo', sched.name + ' -> ' + (sched.enabled ? 'ON' : 'OFF'));
      saveState();
      return Promise.resolve(jsonResponse({ schedule: sched }));
    }

    if (method === 'POST' && path === '/api/schedules/run-now') {
      var handlers = {
        'daily-morning-brief': runDailyBrief,
        'weekly-saas-research': runWeeklyResearch,
        'weekly-trainer-kpi': runWeeklyKpi,
        'daily-hr-workload': function () { hrWorkloadCheck(); saveState(); return Promise.resolve(); }
      };
      var h = handlers[b.scheduleId];
      if (!h) return Promise.resolve(jsonResponse({ error: 'Unknown schedule' }, 404));
      return h().then(function () {
        var sc = state.schedules.find(function (s) { return s.id === b.scheduleId; });
        if (sc) { sc.lastRunAt = nowIso(); sc.lastStatus = 'تم التشغيل'; }
        saveState();
        return jsonResponse({ ok: true });
      });
    }

    if (method === 'POST' && path === '/api/ledger/add') {
      if (!b.type || !b.title || b.amountUsd == null) return Promise.resolve(jsonResponse({ error: 'type, title, amountUsd required' }, 400));
      var entry = { id: 'fin-' + uuid().slice(0, 8), type: b.type, title: b.title, amountUsd: num(b.amountUsd, 0), date: nowIso().slice(0, 10), notes: b.notes || '' };
      state.financialLedger.push(entry);
      logAudit('ledger_entry', 'ceo', b.type + ': ' + b.title + ' ($' + b.amountUsd + ')');
      saveState();
      return Promise.resolve(jsonResponse({ entry: entry }));
    }

    if (method === 'GET' && path === '/api/sandbox/git') {
      return Promise.resolve(jsonResponse({ isGitRepo: false, branch: '', branches: [], changes: [] }));
    }

    if (method === 'POST' && path === '/api/sandbox/branch') {
      return Promise.resolve(jsonResponse({ error: 'Git غير متاح في النسخة السحابية الثابتة. استخدم التصدير/الاستيراد بدلاً منه.' }, 400));
    }

    if (method === 'POST' && path === '/api/sandbox/file') {
      var sf = { filename: String(b.filename || 'file.txt').replace(/[^a-zA-Z0-9._-]/g, '_'), content: String(b.content || ''), size: String(b.content || '').length, createdAt: nowIso() };
      state.sandboxFiles.unshift(sf);
      state.sandboxFiles = state.sandboxFiles.slice(0, 30);
      logAudit('sandbox_file', 'auditors-experts-devs', 'Wrote sandbox/' + sf.filename);
      saveState();
      return Promise.resolve(jsonResponse(sf));
    }

    if (method === 'POST' && path === '/api/tools/web-search') {
      return webSearch(b.query).then(function (r) {
        logAudit('web_search', 'web-research-team', 'Searched: ' + b.query, { engine: r.engine });
        return jsonResponse(r);
      });
    }

    if (method === 'POST' && path === '/api/webhooks/test') {
      return Promise.resolve(jsonResponse({ dispatched: false, target: b.target, reason: 'الـ Webhooks الخارجية غير مفعّلة في النسخة السحابية الثابتة. استخدم بوت تيليجرام أو Supabase Relay.' }));
    }

    if (method === 'POST' && path === '/api/webhooks/incoming') {
      return Promise.resolve(jsonResponse({ error: 'Incoming webhooks require a backend. Use the Supabase relay.' }, 501));
    }

    m = path.match(/^\/api\/portal\/([^/]+)$/);
    if (method === 'GET' && m) {
      var token = decodeURIComponent(m[1]);
      var pc = state.customers.find(function (c) { return c.portalToken === token; });
      if (!pc) return Promise.resolve(jsonResponse({ error: 'Portal not found' }, 404));
      return Promise.resolve(jsonResponse({ name: pc.name, projectTitle: pc.projectTitle, stage: pc.stage, totalValueUsd: pc.totalValueUsd, paidUsd: pc.paidUsd, tasks: [] }));
    }

    if (method === 'POST' && path === '/api/simulator/run') {
      var calc = runSimulation(b);
      var acc = getAgent('accountant'), mkt = getAgent('marketing-lead');
      var summaryText = 'مشروع: ' + calc.projectName + ' | نقطة التعادل: ' + calc.breakEvenCustomers + ' عميل | السيناريو الواقعي: ربح $' + calc.scenarios[1].netProfit + ' (ROI ' + calc.scenarios[1].roiPct + '%)';
      return Promise.all([
        acc ? aiGenerate({ agentId: acc.id, extraContext: 'قدّمي تعليقاً مالياً مختصراً (3 أسطر) على محاكاة نقطة التعادل.', messages: [{ role: 'user', text: summaryText }] }) : null,
        mkt ? aiGenerate({ agentId: mkt.id, extraContext: 'قدّم تعليقاً تسويقياً مختصراً (3 أسطر) لتحسين التحويل وتقليل تكلفة الاستحواذ.', messages: [{ role: 'user', text: summaryText }] }) : null
      ]).then(function (res) {
        if (res[0]) recordUsage('accountant', res[0].usage);
        if (res[1]) recordUsage('marketing-lead', res[1].usage);
        var sim = Object.assign({}, calc, { id: 'sim-' + uuid().slice(0, 8), accountantNote: res[0] ? res[0].text : '', marketingNote: res[1] ? res[1].text : '' });
        state.simulations.unshift(sim);
        state.simulations = state.simulations.slice(0, 15);
        logAudit('what_if_simulation', 'ceo', 'Simulated "' + calc.projectName + '" (BE=' + calc.breakEvenCustomers + ')');
        saveState();
        return jsonResponse({ simulation: sim });
      });
    }

    if (method === 'POST' && path === '/api/incident/trigger') {
      state.emergencyMode = true;
      state.schedules.forEach(function (s) { s.enabled = false; });
      state.webhooks.forEach(function (w) { w.prevStatus = w.status; w.status = 'frozen'; });
      var frozen = 0;
      state.approvals.forEach(function (a) {
        if (a.status === 'pending' && (a.actionType === 'publish_marketing' || a.actionType === 'launch_paid_campaign')) {
          a.status = 'rejected'; a.executionResult = '🚨 تم التجميد الفوري بواسطة زر الطوارئ (Kill Switch).'; frozen++;
        }
      });
      var sec = getAgent('security-officer');
      return aiGenerate({ agentId: 'security-officer', extraContext: 'حالة طوارئ فعلية: اكتب تقرير استجابة للحادثة وخطوات الفحص الفورية في 4 نقاط.', messages: [{ role: 'user', text: 'تم تفعيل زر الطوارئ. السبب: ' + (b.reason || 'إجراء وقائي') }] }).then(function (r) {
        if (sec) { recordUsage(sec.id, r.usage); state.liveBubbles[sec.id] = '🚨 وضع الطوارئ نشط — جاري التحقيق!'; }
        var inc = { id: 'inc-' + uuid().slice(0, 8), reason: b.reason || 'تفعيل يدوي لزر الطوارئ', frozenCampaigns: frozen, securityReport: r.text, status: 'active', triggeredAt: nowIso(), recoveredAt: null };
        state.incidents.unshift(inc);
        state.teamChat.push({ id: uuid(), senderId: 'security-officer', senderName: 'مسؤول الأمان (🚨 وضع الطوارئ)', senderAvatar: '🚨', role: 'assistant', text: 'تم تفعيل وضع الطوارئ! تجميد Webhooks والمهام المجدولة (' + frozen + ' حملة).\n\n' + r.text, timestamp: nowIso() });
        logAudit('kill_switch_triggered', 'ceo', 'Emergency mode ON: ' + inc.reason);
        telegramNotify('🚨 *تحذير: تفعيل زر الطوارئ*\nالسبب: ' + inc.reason);
        saveState();
        return jsonResponse({ incident: inc });
      });
    }

    if (method === 'POST' && path === '/api/incident/recover') {
      state.emergencyMode = false;
      state.webhooks.forEach(function (w) { if (w.status === 'frozen') w.status = w.prevStatus || 'ready'; });
      state.incidents.forEach(function (i) { if (i.status === 'active') { i.status = 'resolved'; i.recoveredAt = nowIso(); } });
      state.liveBubbles['security-officer'] = '✅ تم إنهاء وضع الطوارئ واستئناف الأمان';
      logAudit('incident_recovered', 'ceo', 'Emergency mode OFF — normal operations resumed');
      saveState();
      return Promise.resolve(jsonResponse({ ok: true }));
    }

    if (method === 'POST' && path === '/api/snapshots/create') {
      return createSnapshot(b.label, b.passphrase).then(function (snap) {
        return jsonResponse({ snapshot: { id: snap.id, label: snap.label, alg: snap.alg, fileCount: snap.fileCount, size: snap.size, createdAt: snap.createdAt } }, 201);
      }).catch(function (e) { return jsonResponse({ error: e.message }, 500); });
    }

    if (method === 'POST' && path === '/api/snapshots/restore') {
      if (!b.id) return Promise.resolve(jsonResponse({ error: 'snapshot id required' }, 400));
      return restoreSnapshot(b.id, b.passphrase).then(function (r) { return jsonResponse(r); }).catch(function (e) { return jsonResponse({ error: 'فشل فك التشفير: ' + e.message }, 400); });
    }

    m = path.match(/^\/api\/snapshots\/([^/]+)\/download$/);
    if (method === 'GET' && m) {
      var snaps = readLS(LS_SNAPS, []);
      var rec = snaps.find(function (s) { return s.id === m[1]; });
      if (!rec) return Promise.resolve(jsonResponse({ error: 'Snapshot not found' }, 404));
      return Promise.resolve(new Response(JSON.stringify(rec), { status: 200, headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="' + rec.id + '.json"' } }));
    }

    if (method === 'POST' && path === '/api/playbooks/run') {
      var pb = DATA.playbooks.find(function (p) { return p.id === b.playbookId; });
      if (!pb) return Promise.resolve(jsonResponse({ error: 'Playbook not found' }, 404));
      var prefix = b.projectTitle && b.projectTitle.trim() ? '[' + b.projectTitle.trim() + '] ' : '';
      (pb.steps || []).forEach(function (step) {
        var ag2 = getAgent(step.agentId);
        if (!ag2) return;
        state.tasks.unshift({ id: 'tsk-' + uuid().slice(0, 8), agentId: ag2.id, title: prefix + step.taskTitle, description: step.taskDesc || '', status: 'working', createdAt: nowIso() });
        state.liveBubbles[ag2.id] = 'SOP: ' + String(step.taskTitle).slice(0, 28);
        recomputeStatus(ag2.id);
        awardPoints(ag2.id, 10, 'تنفيذ قالب: ' + pb.title);
        if (step.memoTo) {
          var tgt = getAgent(step.memoTo);
          state.internalMemos.push({ id: 'memo-' + uuid().slice(0, 8), fromId: ag2.id, fromName: ag2.name, fromAvatar: ag2.avatar, toId: step.memoTo, toName: tgt ? tgt.name : step.memoTo, toAvatar: tgt ? tgt.avatar : '🤖', subject: prefix + (step.memoSubject || step.taskTitle), body: 'تم جدولة الخطوة ضمن قالب (' + pb.title + '): ' + (step.taskDesc || step.taskTitle), timestamp: nowIso() });
        }
      });
      state.teamChat.push({ id: uuid(), senderId: 'executive-assistant', senderName: 'السكرتيرة التنفيذية (Playbooks 📚)', senderAvatar: pb.icon || '📚', role: 'assistant', text: 'تم تشغيل قالب الإجراءات القياسية "' + pb.title + '" ' + prefix + 'وتوزيع ' + (pb.steps || []).length + ' مهام ومذكرات مترابطة بين الأقسام!', timestamp: nowIso() });
      logAudit('playbook_executed', 'ceo', 'Ran playbook ' + pb.id + ' (' + (pb.steps || []).length + ' steps)');
      saveState();
      return Promise.resolve(jsonResponse({ ok: true, playbook: pb }));
    }

    return Promise.resolve(jsonResponse({ error: 'API endpoint not found: ' + path }, 404));
  }

  /* ── fetch interception ───────────────────────────────────────────────── */
  if (nativeFetch) {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var path = url;
        if (url.indexOf(location.origin) === 0) path = url.slice(location.origin.length);
        if (path.indexOf('/api/') === 0) {
          var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          var body = {};
          if (init && init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
          return init && init.signal && init.signal.aborted
            ? Promise.reject(new DOMException('Aborted', 'AbortError'))
            : handleApi(method, path, body);
        }
      } catch (e) { /* fall through */ }
      return nativeFetch(input, init);
    };
  }

  /* ── unlock gate ──────────────────────────────────────────────────────── */
  function b64urlToBytes(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function verifyToken(token) {
    if (!CFG.publicKeyJwk) return Promise.resolve(false);
    var parts = String(token || '').trim().split('.');
    if (parts.length !== 2) return Promise.resolve(false);
    var payloadBytes = b64urlToBytes(parts[0]);
    var sig = b64urlToBytes(parts[1]);
    var payload = safeJson(new TextDecoder().decode(payloadBytes), null);
    if (!payload || !payload.exp || Date.now() > Number(payload.exp)) return Promise.resolve(false);
    return crypto.subtle.importKey('jwk', CFG.publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
      .then(function (key) { return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, payloadBytes); })
      .catch(function () { return false; });
  }
  function sha256Hex(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function isUnlocked() {
    if (!CFG.requireUnlock) return true;
    var until = Number(localStorage.getItem(LS_UNLOCK) || 0);
    return until > Date.now();
  }
  var unlockWaiters = [];
  function waitUnlock() {
    if (isUnlocked()) return Promise.resolve();
    return new Promise(function (resolve) { unlockWaiters.push(resolve); });
  }
  function unlockFor(hours) {
    localStorage.setItem(LS_UNLOCK, String(Date.now() + (hours || CFG.tokenTtlHours || 24) * 3600 * 1000));
    var waiters = unlockWaiters.splice(0);
    waiters.forEach(function (resolve) { resolve(); });
  }

  function buildLockScreen() {
    if (!CFG.requireUnlock || isUnlocked()) return;
    var overlay = document.createElement('div');
    overlay.id = 'officeLock';
    overlay.innerHTML =
      '<div class="office-lock-card">' +
      '<div class="office-lock-logo">🏢</div>' +
      '<h1>المكتب الافتراضي — دخول خاص</h1>' +
      '<p class="office-lock-sub">هذه الصفحة غير مرتبطة بالقائمة. الدخول بكلمة السر أو بالرمز الموقّع من بوت تيليجرام.</p>' +
      '<label>كلمة السر</label><input id="officePassInput" type="password" placeholder="كلمة سر المكتب..." autocomplete="current-password" />' +
      '<button id="officePassBtn" class="office-btn primary">دخول</button>' +
      '<div class="office-lock-or">أو</div>' +
      '<label>رمز تيليجرام (Secret Token)</label><input id="officeTokenInput" type="text" placeholder="الصق الرمز الذي أرسله البوت..." />' +
      '<button id="officeTokenBtn" class="office-btn">تحقق من الرمز</button>' +
      '<div id="officeLockMsg" class="office-lock-msg"></div>' +
      '<div class="office-lock-links"><a id="officeBotLink" href="#" target="_blank" rel="noopener">افتح بوت تيليجرام</a><span>•</span><a href="https://mdm1.org/" target="_blank" rel="noopener">mdm1.org</a></div>' +
      '</div>';
    document.body.appendChild(overlay);
    var msg = overlay.querySelector('#officeLockMsg');
    function fail(t) { msg.textContent = t; msg.className = 'office-lock-msg error'; }
    function ok() { msg.textContent = 'تم الدخول...'; msg.className = 'office-lock-msg ok'; setTimeout(function () { overlay.remove(); }, 400); }
    overlay.querySelector('#officePassBtn').onclick = function () {
      var v = overlay.querySelector('#officePassInput').value;
      sha256Hex(v + '|' + (CFG.passphraseSalt || '')).then(function (h) {
        if (h === CFG.passphraseHash) { unlockFor(24); ok(); } else fail('كلمة السر غير صحيحة.');
      });
    };
    overlay.querySelector('#officeTokenBtn').onclick = function () {
      var v = overlay.querySelector('#officeTokenInput').value;
      verifyToken(v).then(function (good) {
        if (good) { unlockFor(24); ok(); } else fail('الرمز غير صالح أو منتهي. اطلب رمزاً جديداً من البوت.');
      });
    };
    var bot = (settings.telegramBot || '').replace(/^@/, '');
    var link = overlay.querySelector('#officeBotLink');
    if (bot) link.href = 'https://t.me/' + encodeURIComponent(bot); else { link.style.opacity = '.45'; link.href = '#'; }
    var input = overlay.querySelector('#officePassInput');
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') overlay.querySelector('#officePassBtn').click(); });
  }

  /* ── connection panel ─────────────────────────────────────────────────── */
  function injectStyles() {
    var css = document.createElement('style');
    css.textContent = [
      '#officeLock{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 50% 20%,#1b1608,#050505 70%);}',
      '.office-lock-card{width:min(440px,100%);background:rgba(17,17,20,.96);border:1px solid rgba(201,168,76,.45);border-radius:20px;padding:28px;box-shadow:0 30px 80px rgba(0,0,0,.65);color:#eef2ff;font-family:Cairo,system-ui,sans-serif;text-align:right;}',
      '.office-lock-logo{font-size:44px;text-align:center;margin-bottom:6px;}',
      '.office-lock-card h1{font-size:21px;margin:0 0 6px;text-align:center;color:#e8c96a;}',
      '.office-lock-sub{font-size:12.5px;color:#9aa3b2;text-align:center;line-height:1.7;margin:0 0 18px;}',
      '.office-lock-card label{display:block;font-size:12px;color:#c9a84c;margin:12px 0 6px;}',
      '.office-lock-card input{width:100%;box-sizing:border-box;background:#0b0b0e;border:1px solid #2a2a33;border-radius:10px;padding:11px 13px;color:#eef2ff;font-family:inherit;font-size:14px;}',
      '.office-lock-card input:focus{outline:none;border-color:#c9a84c;box-shadow:0 0 0 3px rgba(201,168,76,.15);}',
      '.office-btn{width:100%;margin-top:9px;padding:11px;border-radius:10px;border:1px solid #3a3a46;background:#1a1a20;color:#eef2ff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;}',
      '.office-btn.primary{background:linear-gradient(135deg,#c9a84c,#8b6cff);border:none;color:#0a0a0c;}',
      '.office-lock-or{text-align:center;color:#555;font-size:11px;margin:14px 0 2px;}',
      '.office-lock-msg{min-height:18px;margin-top:10px;font-size:12px;text-align:center;}',
      '.office-lock-msg.error{color:#ff8b8b;}.office-lock-msg.ok{color:#6ee7b7;}',
      '.office-lock-links{display:flex;gap:8px;justify-content:center;margin-top:14px;font-size:11px;color:#6b7280;}',
      '.office-lock-links a{color:#c9a84c;text-decoration:none;}',
      '#officeConnBtn{position:relative;}',
      '.office-modal{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);}',
      '.office-modal-card{width:min(760px,100%);max-height:88vh;overflow:auto;background:#111114;border:1px solid rgba(201,168,76,.35);border-radius:18px;padding:22px;color:#eef2ff;font-family:Cairo,system-ui,sans-serif;direction:rtl;text-align:right;}',
      '.office-modal-card h2{font-size:18px;color:#e8c96a;margin:0 0 4px;}',
      '.office-modal-card p{font-size:12px;color:#9aa3b2;line-height:1.7;}',
      '.office-modal-card label{display:block;font-size:12px;color:#c9a84c;margin:12px 0 5px;}',
      '.office-modal-card input,.office-modal-card select{width:100%;box-sizing:border-box;background:#0b0b0e;border:1px solid #2a2a33;border-radius:9px;padding:9px 11px;color:#eef2ff;font-family:inherit;font-size:13px;}',
      '.office-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
      '@media(max-width:640px){.office-grid2{grid-template-columns:1fr;}}',
      '.office-model-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1f1f26;font-size:12px;}',
      '.office-model-row span:first-child{flex:1;color:#cfd6e4;}',
      '.office-model-row select{width:210px;}',
      '.office-actions{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;}',
      '.office-actions .office-btn{width:auto;padding:10px 16px;margin:0;}',
      '.office-status{font-size:12px;padding:8px 10px;border-radius:8px;background:#0b0b0e;border:1px solid #2a2a33;margin-top:10px;white-space:pre-wrap;}',
      '.office-status.ok{border-color:rgba(110,231,183,.4);color:#6ee7b7;}.office-status.err{border-color:rgba(255,139,139,.4);color:#ff8b8b;}',
      '.office-token-box{display:flex;gap:6px;align-items:center;margin-top:6px;}.office-token-box input{flex:1;}',
      '.office-token-box .office-btn{width:auto;margin:0;padding:8px 12px;}',
      '.office-outbox{max-height:180px;overflow:auto;margin-top:8px;font-size:11.5px;}',
      '.office-outbox div{padding:7px 8px;border-bottom:1px solid #1f1f26;color:#b9c2d0;}'
    ].join('\n');
    document.head.appendChild(css);
  }

  function openConnectionPanel() {
    if (document.getElementById('officeConnModal')) return;
    var modal = document.createElement('div');
    modal.id = 'officeConnModal';
    modal.className = 'office-modal';
    var agentOptions = allAgents().map(function (a) {
      return '<div class="office-model-row" data-agent="' + esc(a.id) + '"><span>' + a.avatar + ' ' + esc(a.name) + '</span><select data-model-for="' + esc(a.id) + '"></select></div>';
    }).join('');
    modal.innerHTML =
      '<div class="office-modal-card">' +
      '<h2>🔌 الاتصال بالنماذج وبوت تيليجرام</h2>' +
      '<p>اختر مزود النموذج. لا تُحفظ أي مفاتيح على أي سيرفر: تبقى في متصفحك فقط وتُرسل مباشرة إلى المزود.</p>' +
      '<div class="office-grid2">' +
      '<div><label>المزود</label><select id="ocMode"><option value="auto">تلقائي (الأفضل المتاح)</option><option value="local">تطبيق OpenCode على هذا الجهاز</option><option value="zen">OpenCode Zen (سحابي)</option><option value="openrouter">OpenRouter</option><option value="demo">تجريبي بدون نموذج</option></select></div>' +
      '<div><label>النماذج المجانية فقط</label><select id="ocFree"><option value="true">نعم — مجاني فقط</option><option value="false">لا — اسمح بالمدفوع</option></select></div>' +
      '</div>' +
      '<label>عنوان OpenCode المحلي</label><input id="ocLocalUrl" type="text" placeholder="http://127.0.0.1:28894" />' +
      '<label>كلمة مرور خدمة OpenCode (من ~/.config/opencode/service.json)</label><input id="ocLocalPass" type="password" placeholder="الصق كلمة المرور..." />' +
      '<div class="office-grid2">' +
      '<div><label>مفتاح OpenCode Zen</label><input id="ocZenKey" type="password" placeholder="oc_..." /></div>' +
      '<div><label>عنوان Zen</label><input id="ocZenBase" type="text" /></div>' +
      '</div>' +
      '<div class="office-grid2">' +
      '<div><label>مفتاح OpenRouter (اختياري)</label><input id="ocOrKey" type="password" placeholder="sk-or-..." /></div>' +
      '<div><label>موديل OpenRouter</label><input id="ocOrModel" type="text" placeholder="openai/gpt-4o-mini:free" /></div>' +
      '</div>' +
      '<label>اسم بوت تيليجرام (بدون @)</label><input id="ocBot" type="text" placeholder="MD1_Office_bot" />' +
      '<div class="office-grid2">' +
      '<div><label>Supabase Relay URL (اختياري للإرسال التلقائي)</label><input id="ocRelay" type="text" placeholder="https://...supabase.co/functions/v1/office-relay" /></div>' +
      '<div><label>سر الـ Relay</label><input id="ocRelaySecret" type="password" /></div>' +
      '</div>' +
      '<div id="ocStatus" class="office-status">اضغط "اختبار الاتصال" لمعرفة النماذج المتاحة.</div>' +
      '<label style="margin-top:16px;">توزيع الأدوار على النماذج</label>' +
      '<div id="ocModels">' + agentOptions + '</div>' +
      '<div class="office-actions"><button class="office-btn primary" id="ocSave">حفظ وإعادة الاتصال</button><button class="office-btn" id="ocTest">اختبار الاتصال</button><button class="office-btn" id="ocClose">إغلاق</button></div>' +
      '<label style="margin-top:18px;">🔐 رابط السر عبر تيليجرام</label>' +
      '<p>أنشئ رمزاً وأرسله للبوت. سيرد البوت برمز موقّع يفتح الصفحة لمدة 24 ساعة.</p>' +
      '<div class="office-token-box"><input id="ocSecretLink" type="text" readonly placeholder="اضغط إنشاء" /><button class="office-btn" id="ocMakeSecret">إنشاء</button><button class="office-btn" id="ocCopySecret">نسخ</button></div>' +
      '<label style="margin-top:14px;">📤 صندوق رسائل تيليجرام (آخر 30)</label>' +
      '<div class="office-outbox" id="ocOutbox"></div>' +
      '<div class="office-actions"><button class="office-btn" id="ocShareLast">إرسال آخر رسالة عبر تيليجرام</button><button class="office-btn" id="ocClearOutbox">تفريغ الصندوق</button></div>' +
      '</div>';
    document.body.appendChild(modal);

    var q = function (id) { return modal.querySelector('#' + id); };
    q('ocMode').value = settings.mode;
    q('ocFree').value = String(settings.freeOnly);
    q('ocLocalUrl').value = settings.localUrl;
    q('ocLocalPass').value = settings.localPassword;
    q('ocZenKey').value = settings.zenKey;
    q('ocZenBase').value = settings.zenBase;
    q('ocOrKey').value = settings.openrouterKey;
    q('ocOrModel').value = settings.openrouterModel;
    q('ocBot').value = settings.telegramBot;
    q('ocRelay').value = settings.relayUrl;
    q('ocRelaySecret').value = settings.relaySecret;

    function fillModels(models, free) {
      var ids = (models || []).map(function (m) { return m.id; });
      var pool = settings.freeOnly && free && free.length ? free : ids;
      modal.querySelectorAll('select[data-model-for]').forEach(function (sel) {
        var agentId = sel.getAttribute('data-model-for');
        var current = settings.modelOverrides[agentId] || '';
        sel.innerHTML = '<option value="">تلقائي — ' + esc(pickModel(agentId, pool)) + '</option>' + pool.map(function (id) {
          return '<option value="' + esc(id) + '"' + (current === id ? ' selected' : '') + '>' + esc(id) + '</option>';
        }).join('');
      });
    }

    function readForm() {
      settings.mode = q('ocMode').value;
      settings.freeOnly = q('ocFree').value === 'true';
      settings.localUrl = q('ocLocalUrl').value.trim() || 'http://127.0.0.1:28894';
      settings.localPassword = q('ocLocalPass').value.trim();
      settings.zenKey = q('ocZenKey').value.trim();
      settings.zenBase = q('ocZenBase').value.trim() || 'https://opencode.ai/zen/v1';
      settings.openrouterKey = q('ocOrKey').value.trim();
      settings.openrouterModel = q('ocOrModel').value.trim() || 'openai/gpt-4o-mini:free';
      settings.telegramBot = q('ocBot').value.trim().replace(/^@/, '');
      settings.relayUrl = q('ocRelay').value.trim();
      settings.relaySecret = q('ocRelaySecret').value.trim();
      settings.modelOverrides = {};
      modal.querySelectorAll('select[data-model-for]').forEach(function (sel) {
        if (sel.value) settings.modelOverrides[sel.getAttribute('data-model-for')] = sel.value;
      });
      saveSettings();
      providerCache.local = null; providerCache.zen = null;
    }

    function status(text, cls) {
      var el = q('ocStatus');
      el.textContent = text;
      el.className = 'office-status ' + (cls || '');
    }

    function test() {
      readForm();
      status('جارٍ فحص الاتصال...', '');
      Promise.all([listLocalModels(true), listZenModels(true)]).then(function (r) {
        var mode = currentMode();
        var listing = mode === 'zen' ? r[1] : r[0];
        if (mode === 'demo') { status('الوضع التجريبي مفعّل: الواجهة تعمل بدون نموذج.', 'ok'); fillModels([], []); return; }
        if (mode === 'openrouter') { status(settings.openrouterKey ? 'OpenRouter جاهز (سيُختبر عند أول رسالة).' : 'أدخل مفتاح OpenRouter.', settings.openrouterKey ? 'ok' : 'err'); fillModels([], []); return; }
        if (!listing.connected) { status('غير متصل: ' + (listing.error || 'تحقق من العنوان/كلمة المرور/المفتاح.'), 'err'); fillModels([], []); return; }
        var free = listing.free;
        status('✅ متصل — ' + listing.models.length + ' نموذج، منها ' + free.length + ' مجاني.\n' + (free.length ? 'المجاني: ' + free.join(', ') : 'لا توجد نماذج مجانية في القائمة.'), 'ok');
        fillModels(listing.models, free);
      });
    }

    q('ocSave').onclick = function () { readForm(); modal.remove(); bootstrap(); };
    q('ocTest').onclick = test;
    q('ocClose').onclick = function () { modal.remove(); };
    q('ocMakeSecret').onclick = function () {
      var s = telegramSecretLink();
      if (!s) { q('ocSecretLink').value = 'أدخل اسم بوت تيليجرام أولاً.'; return; }
      q('ocSecretLink').value = s.url;
      q('ocSecretLink').dataset.code = s.code;
    };
    q('ocCopySecret').onclick = function () {
      var v = q('ocSecretLink').value;
      if (v && navigator.clipboard) navigator.clipboard.writeText(v).catch(function () {});
    };
    q('ocShareLast').onclick = function () {
      var last = state.telegramOutbox[0];
      if (!last) return;
      var link = telegramShareLink(last.text);
      if (link) window.open(link, '_blank', 'noopener');
      else alert('أدخل اسم بوت تيليجرام أولاً.');
    };
    q('ocClearOutbox').onclick = function () { state.telegramOutbox = []; saveState(); renderOutbox(); };
    function renderOutbox() {
      q('ocOutbox').innerHTML = state.telegramOutbox.map(function (x) { return '<div>' + esc(String(x.text).slice(0, 160)) + '</div>'; }).join('') || '<div>لا رسائل بعد.</div>';
    }
    renderOutbox();
    test();
  }

  function injectTopbarButton() {
    var actions = document.querySelector('.topbar-actions');
    if (!actions || document.getElementById('officeConnBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'officeConnBtn';
    btn.className = 'btn btn-secondary';
    btn.textContent = '🔌 الاتصال';
    btn.onclick = openConnectionPanel;
    actions.insertBefore(btn, actions.firstChild);
  }

  /* ── boot ─────────────────────────────────────────────────────────────── */
  var resolveReady;
  var readyPromise = new Promise(function (resolve) { resolveReady = resolve; });

  function boot() {
    injectStyles();
    buildLockScreen();
    loadCompanyData()
      .then(waitUnlock)
      .then(function () {
        injectTopbarButton();
        resolveReady();
      });
  }

  // Expose a few helpers for debugging / the console.
  window.MDM1Office = {
    ready: readyPromise,
    get state() { return state; },
    get data() { return DATA; },
    settings: settings,
    saveSettings: saveSettings,
    aiGenerate: aiGenerate,
    openConnectionPanel: openConnectionPanel,
    createSnapshot: createSnapshot,
    restoreSnapshot: restoreSnapshot,
    downloadSnapshot: downloadSnapshot,
    telegramSecretLink: telegramSecretLink,
    telegramShareLink: telegramShareLink,
    reset: function () { localStorage.removeItem(LS_STATE); location.reload(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
