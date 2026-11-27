/* ============================================================================
   MDM1 AI Office — standalone browser runtime (no server)
   ----------------------------------------------------------------------------
   This file turns the existing office UI into a fully client-side app:
   • it intercepts every /api/* call the UI makes and answers it locally;
   • it keeps the company state in localStorage (export/import + encrypted snapshots);
   • it talks directly to the OpenCode app on this machine (local HTTP API) or to
     OpenCode Zen / Groq / OpenRouter when a key is supplied (free models only);
   • before any model is assigned to a role it can be benchmarked and "trained"
     (prompt calibration) in the in-page model lab;
   • every proposal passes a per-department quality gate (monitor → auditor →
     corrector) with rewards / penalties before the CEO can execute it;
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
    mode: 'auto',                    // auto | cloud | local | zen | groq | openrouter | demo
    localUrl: (CFG.localApi && CFG.localApi.url) || 'http://127.0.0.1:28894',
    localBridgeUrl: (CFG.localBridge && CFG.localBridge.url) || 'https://localhost:28895',
    localBase: '',
    localPassword: '',
    zenKey: '',
    zenBase: (CFG.zen && CFG.zen.baseUrl) || 'https://opencode.ai/zen/v1',
    groqKey: '',
    groqBase: (CFG.groq && CFG.groq.baseUrl) || 'https://api.groq.com/openai/v1',
    groqModel: 'llama-3.3-70b-versatile',
    openrouterKey: '',
    openrouterBase: (CFG.openrouter && CFG.openrouter.baseUrl) || 'https://openrouter.ai/api/v1',
    openrouterModel: 'baidu/ernie-5.5-flash-preview:free',
    freeOnly: true,
    modelOverrides: {},
    /* Model lab: only benchmark-passed models are auto-assigned to roles. */
    useBenchmarks: true,
    benchmarkThreshold: (CFG.quality && CFG.quality.threshold) || 70,
    /* Department-level monitor → auditor → corrector gate on every proposal. */
    qualityGate: CFG.quality ? CFG.quality.enabled !== false : true,
    vaultEnabled: false,
    telegramBot: (CFG.telegram && CFG.telegram.botUsername) || '',
    telegramChatId: '',
    relayUrl: (CFG.messaging && CFG.messaging.relayUrl) || (CFG.telegram && CFG.telegram.relayUrl) || '',
    relaySecret: '',
    whatsappTo: '',
    /* Optional encrypted Supabase sync: endpoint + browser-only secret. */
    syncUrl: (CFG.sync && CFG.sync.url) || '',
    syncSecret: '',
    syncEnabled: Boolean(CFG.sync && CFG.sync.enabled),
    syncVersion: 0,
    syncSalt: '',
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
        role: 'assistant', text: 'صباح الخير سيادة المدير! أنا السكرتيرة التنفيذية وجاهزة لتلقي توجيهاتك. حالة الاتصال الفعلية بالنموذج تظهر أعلى الصفحة، ويمكنك بدء اجتماع جماعي أو مسار مشروع تلقائي.',
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
      /* Per-model quota / cost telemetry, primary input to the 📊 panel. */
      modelUsage: {},
      /* Model lab: benchmark scores and prompt-calibration examples. */
      modelBenchmarks: {},
      modelTraining: {},
      /* Quality gate history: monitor → auditor → corrector verdicts. */
      qualityReports: [],
      /* AES-256-GCM encrypted secret vault (never stores the passphrase). */
      secretVault: null,
      meetingActive: false,
      meetingAttendees: [],
      internalMemos: [
        { id: 'memo-1', fromId: 'web-research-team', fromName: 'فريق البحث والتطوير', fromAvatar: '🌐', toId: 'accountant', toName: 'المحاسبة', toAvatar: '💰', subject: 'دراسة تكلفة أداة أتمتة مقترحة', body: 'تم رصد أداة أتمتة خدمة عملاء بتكلفة ترخيص $29/شهر وإمكانية بيعها بـ $99/شهر. يرجى مراجعة هامش الربح.', timestamp: now, read: false },
        { id: 'memo-2', fromId: 'auditors-experts-devs', fromName: 'المدققون والخبراء والمطورون', fromAvatar: '⚙️', toId: 'hr-manager', toName: 'مديرة الموارد البشرية', toAvatar: '👩‍💼', subject: 'توصية بتعيين مختص تكاملات API', body: 'مع توسع مشاريع n8n والربط الخارجي، نقترح تجهيز وصف وظيفي لمطور تكاملات عند الحاجة.', timestamp: now, read: false }
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
      requestLedger: [],
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
    ['tasks', 'approvals', 'teamChat', 'internalMemos', 'kpiReviews', 'financialLedger', 'schedules', 'customers', 'votes', 'incidents', 'simulations', 'webhooks', 'auditLog', 'exports', 'sandboxFiles', 'customAgents', 'snapshots', 'telegramOutbox', 'qualityReports', 'requestLedger'].forEach(function (k) {
      if (!Array.isArray(merged[k])) merged[k] = base[k] || [];
    });
    ['directChats', 'agentStatuses', 'liveBubbles', 'gamification', 'memories', 'exportContents', 'knowledgeOverrides', 'modelUsage', 'modelBenchmarks', 'modelTraining'].forEach(function (k) {
      if (!merged[k] || typeof merged[k] !== 'object') merged[k] = base[k] || {};
    });
    if (!merged.usageStats) merged.usageStats = base.usageStats;
    /* Clean up old approvals that were escalated to high only because the
       quality trio objected, even though the action itself was routine. */
    (merged.approvals || []).forEach(function (a) {
      var serious = /دفع\s|تحويل\s|توقيع\s+عقد|نشر\s+عام|نشر\s+خارجي|منح\s+صلاحية|تغيير\s+صلاحية|بيانات\s+سرية|حذف\s+بيانات|webhook|api\s*key/i.test(stripNegated(String(a.title || '') + ' ' + String(a.details || '')));
      if (a.risk === 'high' && !serious) {
        a.risk = 'medium';
        a.securityNote = '🔎 تمت إعادة تصنيف هذا الطلب إلى متوسط الخطورة — المراجعة لا تعني أنه عالي الخطورة.';
      }
    });
    return merged;
  }

  var saveTimer = null;
  function saveState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      writeLS(LS_STATE, state);
      scheduleSync();
    }, 120);
  }
  function saveNow() { writeLS(LS_STATE, state); }

  /* ── quota / cost telemetry (per model) ──────────────────────────────── */
  function usageKey(provider, model) { return String(provider || '?') + '::' + String(model || '?'); }
  function getUsage(provider, model) {
    var k = usageKey(provider, model);
    if (!state.modelUsage[k]) state.modelUsage[k] = { calls: 0, tokens: 0, lastAt: 0, lastError: '', limitedUntil: 0, retryAfterMs: 0 };
    return state.modelUsage[k];
  }
  function markUsage(provider, model, usage) {
    var u = getUsage(provider, model);
    u.calls += 1;
    u.tokens += num(usage && usage.totalTokens, 0);
    u.lastAt = Date.now();
    u.lastError = '';
    u.limitedUntil = 0;
    u.retryAfterMs = 0;
    settings.lastProvider = provider;
    settings.lastError = null;
    saveSettings();
    updateQuotaBadge();
  }
  function retryMsFrom(r, j) {
    var h = r && r.headers && (r.headers.get('retry-after') || r.headers.get('x-ratelimit-reset'));
    if (h) {
      var secs = Number(h);
      if (isFinite(secs) && secs > 0) return secs * 1000;
      var at = Date.parse(h);
      if (isFinite(at)) return Math.max(0, at - Date.now());
    }
    var v = (j && (j.retryAfterMs || j.retry_after_ms || (j.error && j.error.retryAfterMs))) || 0;
    return num(v, 0);
  }
  function markRateLimit(provider, model, retryMs, message) {
    var u = getUsage(provider, model);
    u.calls += 1;
    u.lastAt = Date.now();
    u.lastError = String(message || '429 rate limited').slice(0, 300);
    u.retryAfterMs = num(retryMs, 0);
    u.limitedUntil = Date.now() + Math.max(1000, u.retryAfterMs || 60000);
    settings.lastError = u.lastError;
    saveSettings();
    saveState();
    var wait = u.retryAfterMs ? ' — إعادة بعد ' + Math.ceil(u.retryAfterMs / 60000) + ' دقيقة' : '';
    showToast('⛔ الحصة انتهت للنموذج ' + model + wait + '. جرّب نموذجاً آخر من 🔌 الاتصال.', 'err');
    updateQuotaBadge();
  }
  function markModelError(provider, model, message) {
    var u = getUsage(provider, model);
    u.lastError = String(message || 'error').slice(0, 300);
    u.lastAt = Date.now();
  }
  function isModelLimited(provider, model) {
    return getUsage(provider, model).limitedUntil > Date.now();
  }
  function quotaSummary() {
    var limited = 0, calls = 0, tokens = 0;
    Object.keys(state.modelUsage || {}).forEach(function (k) {
      var u = state.modelUsage[k];
      if (u.limitedUntil > Date.now()) limited += 1;
      calls += num(u.calls, 0);
      tokens += num(u.tokens, 0);
    });
    return { limited: limited, calls: calls, tokens: tokens };
  }
  function updateQuotaBadge() {
    var el = document.getElementById('officeQuotaBadge');
    if (!el) return;
    var q = quotaSummary();
    el.textContent = q.limited ? ('⚠️ ' + q.limited + ' نموذج محظور') : ('📊 ' + q.calls + ' طلب');
    el.className = 'provider-badge ' + (q.limited ? 'demo' : 'live');
    el.title = 'إجمالي الطلبات: ' + q.calls + ' | التوكنز: ' + q.tokens;
  }
  function showToast(text, kind) {
    var box = document.getElementById('officeToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'officeToast';
      document.body.appendChild(box);
    }
    box.className = 'office-toast ' + (kind || '');
    box.textContent = text;
    box.style.display = 'block';
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.style.display = 'none'; }, 9000);
  }

  /* ── optional encrypted Supabase state sync ────────────────────────────
     The server never sees plaintext: AES-256-GCM keys are derived in the
     browser from a sync secret that stays in localStorage. The server only
     stores an opaque blob keyed by SHA-256(secret).                        */
  var SYNC_SALT = new TextEncoder().encode('mdm1-office-sync-v1');
  function bytesToB64u(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function syncKey() {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(secret('syncSecret')), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: SYNC_SALT, iterations: 120000, hash: 'SHA-256' }, base,
          { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }
  function encryptState(obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var plain = new TextEncoder().encode(JSON.stringify(obj));
    return syncKey().then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
    }).then(function (cipher) { return bytesToB64u(iv) + '.' + bytesToB64u(cipher); });
  }
  function decryptState(payload) {
    var parts = String(payload || '').split('.');
    if (parts.length !== 2) return Promise.resolve(null);
    return syncKey().then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64urlToBytes(parts[0]) }, key, b64urlToBytes(parts[1]));
    }).then(function (buf) { return safeJson(new TextDecoder().decode(buf), null); })
      .catch(function () { return null; });
  }
  function syncConfigured() {
    return Boolean(settings.syncEnabled && settings.syncUrl && secret('syncSecret') && messagingAuthOk());
  }
  function syncHeaders() { return { 'content-type': 'application/json', 'x-office-secret': secret('syncSecret') }; }
  function syncRow(j) { return Array.isArray(j) ? (j[0] || {}) : (j || {}); }
  function applyRemoteState(j) {
    return decryptState(j.state).then(function (plain) {
      if (!plain || typeof plain !== 'object' || !plain.meta) throw new Error('النسخة البعيدة غير صالحة أو أن سر المزامنة مختلف.');
      state = Object.assign(initialState(), plain);
      settings.syncVersion = num(j.version, 0);
      saveSettings();
      saveNow();
      return true;
    });
  }
  function syncPull() {
    if (!syncConfigured()) return Promise.resolve({ configured: false });
    return sha256Hex(secret('syncSecret')).then(function (workspace) {
      return nativeFetch(settings.syncUrl.replace(/\/$/, '') + '?workspace=' + encodeURIComponent(workspace), { headers: syncHeaders(), cache: 'no-store' });
    }).then(function (r) {
      if (!r.ok) throw new Error('Supabase sync HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var row = syncRow(j);
      if (!row.state) { settings.syncVersion = num(row.version, 0); saveSettings(); return { configured: true, applied: false }; }
      return applyRemoteState(row).then(function () { return { configured: true, applied: true, version: row.version }; });
    });
  }
  function syncPush() {
    if (!syncConfigured()) return Promise.resolve({ configured: false });
    return sha256Hex(secret('syncSecret')).then(function (workspace) {
      return encryptState(state).then(function (blob) {
        return nativeFetch(settings.syncUrl.replace(/\/$/, ''), {
          method: 'POST',
          headers: syncHeaders(),
          body: JSON.stringify({ workspace: workspace, state: blob, version: num(settings.syncVersion, 0) })
        });
      });
    }).then(function (r) {
      if (r.status === 409) {
        return r.json().then(function (j) {
          var row = syncRow(j);
          return applyRemoteState(row).then(function () { return { conflict: true, applied: true, version: row.version }; });
        });
      }
      if (!r.ok) throw new Error('Supabase sync HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var row = syncRow(j);
      if (isFinite(row.version)) { settings.syncVersion = num(row.version, 0); saveSettings(); }
      return { ok: true, version: settings.syncVersion, conflict: Boolean(row.conflict) };
    });
  }
  var syncTimer = null;
  function scheduleSync() {
    if (!syncConfigured()) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncTimer = null;
      syncPush().catch(function (e) { console.warn('Office sync failed:', e.message); });
    }, 1500);
  }

  /* ── encrypted secret vault (browser-only) ───────────────────────────────
     The scout can move every API key out of localStorage into an AES-256-GCM
     blob. The passphrase is never written anywhere: after a reload the user
     unlocks the vault in memory again. Nothing is sent to any server.      */
  var SECRET_FIELDS = ['localPassword', 'zenKey', 'groqKey', 'openrouterKey', 'relaySecret', 'syncSecret'];
  var runtimeVault = { key: null, data: {} };
  function secret(field) {
    if (settings[field]) return settings[field];
    return (runtimeVault.data && runtimeVault.data[field]) || '';
  }
  function vaultKey(passphrase, saltB64) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(String(passphrase || '')), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: b64urlToBytes(saltB64), iterations: 150000, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }
  function encryptSecrets(passphrase) {
    if (!passphrase) return Promise.resolve({ ok: false, error: 'أدخل كلمة مرور الخزنة أولاً.' });
    var fields = SECRET_FIELDS.filter(function (f) { return Boolean(secret(f)); });
    if (!fields.length) return Promise.resolve({ ok: false, error: 'لا توجد مفاتيح لتشفيرها.' });
    var payload = {};
    fields.forEach(function (f) { payload[f] = secret(f); });
    var salt = bytesToB64u(crypto.getRandomValues(new Uint8Array(16)));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return vaultKey(passphrase, salt).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(payload)))
        .then(function (cipher) {
          state.secretVault = {
            version: 1, salt: salt, iv: bytesToB64u(iv), data: bytesToB64u(cipher),
            fields: fields, at: nowIso(), algorithm: 'AES-256-GCM/PBKDF2-150k'
          };
          fields.forEach(function (f) { runtimeVault.data[f] = payload[f]; settings[f] = ''; });
          runtimeVault.key = key;
          settings.vaultEnabled = true;
          saveSettings(); saveState();
          logAudit('vault_encrypted', 'sec-scout', 'Encrypted ' + fields.length + ' secret fields locally', { fields: fields });
          return { ok: true, fields: fields };
        });
    }).catch(function (e) { return { ok: false, error: e.message }; });
  }
  function unlockVault(passphrase) {
    var v = state.secretVault;
    if (!v || !v.data) return Promise.resolve({ ok: false, error: 'لا توجد خزنة مشفّرة على هذا الجهاز.' });
    return vaultKey(passphrase, v.salt).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64urlToBytes(v.iv) }, key, b64urlToBytes(v.data))
        .then(function (buf) {
          var data = safeJson(new TextDecoder().decode(buf), null);
          if (!data || typeof data !== 'object') throw new Error('فشل فك التشفير — كلمة المرور غير صحيحة.');
          runtimeVault = { key: key, data: data };
          logAudit('vault_unlocked', 'sec-scout', 'Secret vault unlocked in memory', {});
          return { ok: true, fields: Object.keys(data) };
        });
    }).catch(function (e) { return { ok: false, error: e.message || 'كلمة المرور غير صحيحة.' }; });
  }
  function vaultStatus() {
    return {
      exists: Boolean(state.secretVault && state.secretVault.data),
      unlocked: Boolean(runtimeVault.key),
      algorithm: state.secretVault ? state.secretVault.algorithm : null,
      fields: state.secretVault ? (state.secretVault.fields || []) : []
    };
  }

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
  /* Penalty side of the quality contract: an error caught by the department
     trio costs points and can demote the author; never below zero. */
  function penalizePoints(agentId, points, reason) {
    var p = ensureProfile(agentId);
    var oldLevel = p.level;
    p.points = Math.max(0, p.points - Math.abs(num(points, 0)));
    var lvl = LEVELS[0];
    LEVELS.forEach(function (l) { if (p.points >= l.minPoints) lvl = l; });
    p.level = lvl.level;
    p.rankTitle = lvl.title;
    p.history.unshift({ points: -Math.abs(num(points, 0)), reason: reason, timestamp: nowIso() });
    p.history = p.history.slice(0, 15);
    var demoted = lvl.level < oldLevel;
    if (demoted) {
      p.badges.push('⚠️ تخفيض رتبة: ' + lvl.title);
      logAudit('agent_demoted', agentId, 'Demoted to Level ' + lvl.level + ': ' + lvl.title, { points: p.points });
      var ag = getAgent(agentId);
      state.teamChat.push({ id: uuid(), senderId: 'hr-manager', senderName: 'مديرة الموارد البشرية (إنذار ⚠️)', senderAvatar: '⚠️', role: 'assistant', text: 'تم تخفيض رتبة **' + (ag ? ag.name : agentId) + '** إلى **' + lvl.title + '** بعد خطأ رصدته حلقة الجودة.', timestamp: nowIso() });
    }
    return { profile: p, demoted: demoted, newLevel: lvl };
  }

  function getAgent(id) { return allAgents().find(function (a) { return a.id === id; }) || null; }
  function allAgents() {
    var custom = (state.customAgents || []).filter(function (a) { return !DATA.agents.some(function (x) { return x.id === a.id; }); });
    var qa = QA_AGENTS.filter(function (a) { return !DATA.agents.some(function (x) { return x.id === a.id; }); });
    var special = SPECIAL_AGENTS.filter(function (a) { return !DATA.agents.some(function (x) { return x.id === a.id; }); });
    return DATA.agents.concat(qa, special, custom);
  }

  function recomputeStatus(agentId) {
    if (state.approvals.some(function (a) { return a.agentId === agentId && a.status === 'pending'; })) { state.agentStatuses[agentId] = 'waiting_approval'; return; }
    state.agentStatuses[agentId] = state.tasks.some(function (t) { return t.agentId === agentId && t.status === 'working'; }) ? 'working' : 'available';
  }

  function unreadMemoCount() {
    return (state.internalMemos || []).filter(function (m) { return m.read !== true; }).length;
  }

  function markMemosRead(ids) {
    var wanted = {};
    (ids || []).forEach(function (id) { wanted[String(id)] = true; });
    (state.internalMemos || []).forEach(function (m) { if (wanted[m.id]) m.read = true; });
    saveState();
    return unreadMemoCount();
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
    var feminine = agent.id === 'executive-assistant' || agent.feminine === true;
    var genderLine = feminine
      ? '\nأنتِ السكرتيرة التنفيذية: تحدثي دائماً بصيغة الأنثى (أنتِ، جاهزة، سأجهّز، سأتابع، سأرسل). لا تستخدمي صيغة المذكر.\n'
      : '';
    return 'أنت تعمل داخل "MD1\u0075sd Company" (AI Virtual Office).\n' +
      'المستخدم هو المدير التنفيذي (CEO) وصاحب الشركة. أجب بالعربية الواضحة والعملية.' + genderLine + '\n\n' +
      '=== قاعدة معرفة الشركة ===\n' + (knowledgeContext() || 'لا توجد ملفات معرفة إضافية حالياً.') + '\n' + rag +
      '\n=== الدور ===\n' + (agent.roleMd || '') + '\n\n=== المهارات ===\n' + (agent.skillsMd || '') + '\n\n' +
      '=== الصلاحيات ===\n- القسم: ' + (agent.department || '') + '\n- الأدوات: ' + ((agent.allowedTools || []).join(', ') || 'لا يوجد') + '\n' +
      '- تتطلب موافقة المدير: ' + ((agent.requiresApprovalFor || []).join(', ') || 'لا يوجد') + '\n\n' +
      'تعليمات صارمة:\n' +
      '1. ابدأ ردك بالنتيجة أو بالخطوات العملية، ولا تكرر التحية أو عبارة "جاهز للخدمة" أبداً.\n' +
      '2. فكّك طلب المدير إلى عناصر واضحة وصف ما سيفعله كل عنصر؛ النظام ينشئ المهام تلقائياً بعد ردك، فلا تقل "لا أستطيع التنفيذ".\n' +
      '3. إن وجد عنصر غامض اكتب سطراً مستقلاً: "ما لم أفهمه: ..." واسأل سؤالاً محدداً، ولا تخترع معلومات.\n' +
      '4. لا تعدّد الردود النمطية ولا تكرر ما سبق أن قلته في نفس المحادثة.\n' +
      '5. إذا اقترحت إجراءً يتطلب موافقة المدير، أضف في نهاية ردك:\n' +
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
    'auditors-experts-devs': ['deepseek-v4.1-flash-free', 'flint-40b-free', 'big-pickle'],
    'dev-auto': ['deepseek-v4.1-flash-free', 'big-pickle', 'flint-40b-free'],
    'sec-scout': ['iceman-free', 'deepseek-v4.1-flash-free', 'flint-40b-free'],
    'legal-accountant': ['flint-40b-free', 'deepseek-v4.1-flash-free', 'big-pickle'],
    'legal-advisor': ['deepseek-v4.1-flash-free', 'iceman-free', 'big-pickle'],
    'qa-exec-monitor': ['iceman-free', 'deepseek-v4.1-flash-free'],
    'qa-fin-auditor': ['flint-40b-free', 'deepseek-v4.1-flash-free'],
    'qa-mkt-corrector': ['big-pickle', 'nemotron-3.5-lightning-free']
  };
  var FALLBACK_MODELS = ['big-pickle', 'deepseek-v4.1-flash-free', 'seaglass-alpha-free', 'tidepool-alpha-free', 'flint-40b-free', 'iceman-free', 'beam-free', 'mimo-v2.6-flash-free', 'nemotron-3.5-lightning-free', 'nemotron-3.5-super-vl-free', 'hy4-flash-free'];

  /* ── department quality trio (monitor / auditor / corrector) ─────────── */
  var QA_KINDS = {
    monitor: {
      title: 'المراقب المتخصص', avatar: '👁️',
      duties: 'تراقب كل مخرجات قسمك قبل اعتمادها. تبحث عن الأرقام غير المدعومة، والتناقضات، وتجاوز الصلاحيات، والادعاءات غير الموثقة، وتتبع مصدر كل معلومة. لا تثق في أي رد لمجرد أنه جاء من وكيل آخر — اطلب الدليل.',
      skills: '- كشف الشذوذ\n- تتبع المصادر\n- تصنيف الخطورة\n- منع التمرير العشوائي (rubber-stamping)'
    },
    auditor: {
      title: 'المدقق المتخصص', avatar: '🧾',
      duties: 'تعيد التحقق بشكل مستقل من الصفر: تفحص الحسابات والشروط والسياسات والقرارات السابقة، وتختبر ملاحظات المراقب بدلاً من تصديقها. ترفض أي إجراء غير مكتمل أو غامض أو عالي المخاطر بدون دليل.',
      skills: '- تدقيق مستقل\n- تحقق رقمي\n- مراجعة سياسات\n- إصدار حكم قابل للتتبع'
    },
    corrector: {
      title: 'المصحح المتخصص', avatar: '🛠️',
      duties: 'تصلح الأخطاء التي يكتشفها المراقب والمدقق بأقل تغيير ممكن مع الحفاظ على نية صاحب القرار. تكتب النسخة المصححة كاملة وتوضح كل تعديل بوسم [CORRECTION]، ثم تُعيد إصدار الحكم النهائي.',
      skills: '- تصحيح دقيق\n- إعادة صياغة\n- تقليل الأثر\n- توثيق التغييرات'
    }
  };
  var QA_PROTOCOL = '\n\n=== بروتوكول الإخراج الإلزامي ===\n' +
    'ابدأ بسطر واحد فقط: [QA verdict="PASS" أو "FAIL" confidence="0-1" issues="عدد"]\n' +
    'ثم اذكر الأدلة في سطرين إلى أربعة أسطر داخل [QA_DETAILS] ... [/QA_DETAILS].\n' +
    'المصحح فقط يضيف أيضاً [CORRECTION] النص المصحح كاملاً [/CORRECTION].\n' +
    'لا تكتب أي كلام خارج هذه الأوسمة. لا تمنح PASS بدون دليل واضح.';

  function qaAgent(id, zone, department, kind, focus) {
    var k = QA_KINDS[kind];
    return {
      id: id,
      name: k.title + ' — ' + focus,
      englishName: kind + '-' + zone,
      avatar: k.avatar,
      department: department,
      zone: zone,
      reportsTo: 'ceo',
      status: 'available',
      requiresApprovalFor: [],
      allowedTools: ['quality_review', 'audit', 'correction', 'priority_execution'],
      externalAccess: [],
      rankTitle: 'حارس جودة معتمد 💎',
      level: 3,
      roleMd: 'أنت **' + k.title + '** في قسم **' + department + '**. تخصصك الدقيق: ' + focus + '.\n' + k.duties + QA_PROTOCOL,
      skillsMd: k.skills
    };
  }
  var QA_AGENTS = [
    qaAgent('qa-exec-monitor', 'executive', 'الإدارة التنفيذية', 'monitor', 'التنسيق والقرارات التنفيذية'),
    qaAgent('qa-exec-auditor', 'executive', 'الإدارة التنفيذية', 'auditor', 'التنسيق والقرارات التنفيذية'),
    qaAgent('qa-exec-corrector', 'executive', 'الإدارة التنفيذية', 'corrector', 'التنسيق والقرارات التنفيذية'),
    qaAgent('qa-fin-monitor', 'finance-security', 'المالية والأمان', 'monitor', 'الأرقام والمدفوعات والصلاحيات'),
    qaAgent('qa-fin-auditor', 'finance-security', 'المالية والأمان', 'auditor', 'الأرقام والمدفوعات والصلاحيات'),
    qaAgent('qa-fin-corrector', 'finance-security', 'المالية والأمان', 'corrector', 'الأرقام والمدفوعات والصلاحيات'),
    qaAgent('qa-hr-monitor', 'hr-training', 'الإدارة والتطوير التنظيمي', 'monitor', 'التوظيف والتدريب وأحمال الفريق'),
    qaAgent('qa-hr-auditor', 'hr-training', 'الإدارة والتطوير التنظيمي', 'auditor', 'التوظيف والتدريب وأحمال الفريق'),
    qaAgent('qa-hr-corrector', 'hr-training', 'الإدارة والتطوير التنظيمي', 'corrector', 'التوظيف والتدريب وأحمال الفريق'),
    qaAgent('qa-mkt-monitor', 'marketing', 'التسويق والنمو', 'monitor', 'المحتوى والإعلانات والعملاء'),
    qaAgent('qa-mkt-auditor', 'marketing', 'التسويق والنمو', 'auditor', 'المحتوى والإعلانات والعملاء'),
    qaAgent('qa-mkt-corrector', 'marketing', 'التسويق والنمو', 'corrector', 'المحتوى والإعلانات والعملاء'),
    qaAgent('qa-res-monitor', 'research-lab', 'البحث والابتكار', 'monitor', 'مصادر البحث والفرص والتوصيات'),
    qaAgent('qa-res-auditor', 'research-lab', 'البحث والابتكار', 'auditor', 'مصادر البحث والفرص والتوصيات'),
    qaAgent('qa-res-corrector', 'research-lab', 'البحث والابتكار', 'corrector', 'مصادر البحث والفرص والتوصيات'),
    qaAgent('qa-legal-monitor', 'legal', 'الشؤون القانونية والامتثال', 'monitor', 'العقود والامتثال والضرائب'),
    qaAgent('qa-legal-auditor', 'legal', 'الشؤون القانونية والامتثال', 'auditor', 'العقود والامتثال والضرائب'),
    qaAgent('qa-legal-corrector', 'legal', 'الشؤون القانونية والامتثال', 'corrector', 'العقود والامتثال والضرائب')
  ];
  /* The core experts/auditors team (engineering-audit) is already the final
     authority for its own department, so it has no extra quality trio. */
  var QA_TEAM_BY_ZONE = {
    executive: { monitor: 'qa-exec-monitor', auditor: 'qa-exec-auditor', corrector: 'qa-exec-corrector' },
    'finance-security': { monitor: 'qa-fin-monitor', auditor: 'qa-fin-auditor', corrector: 'qa-fin-corrector' },
    'hr-training': { monitor: 'qa-hr-monitor', auditor: 'qa-hr-auditor', corrector: 'qa-hr-corrector' },
    marketing: { monitor: 'qa-mkt-monitor', auditor: 'qa-mkt-auditor', corrector: 'qa-mkt-corrector' },
    'research-lab': { monitor: 'qa-res-monitor', auditor: 'qa-res-auditor', corrector: 'qa-res-corrector' },
    legal: { monitor: 'qa-legal-monitor', auditor: 'qa-legal-auditor', corrector: 'qa-legal-corrector' }
  };
  function getQaTeam(agentId) {
    var ag = getAgent(agentId);
    var zone = ag && ag.zone;
    if (!zone || zone === 'engineering-audit') return null;
    return QA_TEAM_BY_ZONE[zone] || null;
  }

  /* Two core specialists: an auto-developer that proposes/applies safe fixes,
     and a secret/vulnerability hunter that finds exposed keys and encrypts them. */
  var SPECIAL_AGENTS = [
    {
      id: 'dev-auto', name: 'المطور التلقائي', englishName: 'Auto Developer', avatar: '🧑‍💻',
      department: 'الهندسة والتدقيق', zone: 'engineering-audit', reportsTo: 'ceo', status: 'available',
      requiresApprovalFor: ['deploy'], allowedTools: ['patch', 'refactor', 'priority_execution'], externalAccess: [],
      rankTitle: 'مهندس تحديث معتمد 💎', level: 4,
      roleMd: 'أنت **المطور التلقائي** في المكتب. مهمتك تحليل أخطاء التشغيل وحصص النماذج ونتائج المختبر، ثم إصدار تصحيح آمن قابل للتطبيق داخل المتصفح فقط.\n' +
        'القواعد: لا تلمس مفاتيح أو أسرار، لا تقترح حفظ سر في ملف عام، لا تضع شفرة قابلة للتنفيذ، ولا تخلق دوال جديدة. اقتصر على [DEV_PATCH target="اسم_الإعداد" value="قيمة"]وصف موجز[/DEV_PATCH] للإعدادات المسموح فقط (freeOnly, useBenchmarks, qualityGate, benchmarkThreshold, mode, groqModel, openrouterModel).\n' +
        'إن لم يكن هناك إصلاح آمن، اكتب [DEV_PATCH target="none" value="none"]لا يوجد إصلاح آمن تلقائي[/DEV_PATCH].',
      skillsMd: '- تحليل الأخطاء\n- ضبط الإعدادات\n- اقتراح تصحيحات آمنة\n- عدم كشف الأسرار'
    },
    {
      id: 'sec-scout', name: 'باحث الثغرات والمفاتيح المكشوفة', englishName: 'Secrets & Vulnerabilities Scout', avatar: '🕵️',
      department: 'الهندسة والتدقيق', zone: 'engineering-audit', reportsTo: 'ceo', status: 'available',
      requiresApprovalFor: ['security_change'], allowedTools: ['secret_scan', 'redact', 'encrypt'], externalAccess: [],
      rankTitle: 'حارس أسرار معتمد 💎', level: 4,
      roleMd: 'أنت **باحث الثغرات والمفاتيح المكشوفة**. تفحص الإعدادات العامة والتخزين المحلي والصور والنسخ الاحتياطية بحثاً عن أنماط مفاتيح (gsk_, sk-, sk-or-, ghp_, xoxb-, رموز تيليجرام الرقمية، أو مفتاح خاص EC في الحقل d).\n' +
        'القواعد الذهبية: لا تعرض السر كاملاً أبداً، اذكر آخر 4 أحرف فقط، صنّف الخطورة، وأوصِ بتشفير AES-256-GCM في خزنة محلية بكلمة مرور يدخلها المدير وحده.\n' +
        'أخرج النتائج بصيغة [SEC_FINDING severity="high|medium|low" where="المكان" kind="نوع السر"]وصف مختصر[/SEC_FINDING].',
      skillsMd: '- كشف المفاتيح المكشوفة\n- تعتيم الأسرار (redaction)\n- تقييم الثغرات\n- تشفير AES-256-GCM\n- تخزين آمن في المتصفح'
    },
    {
      id: 'legal-accountant', name: 'المحاسب القانوني', englishName: 'Legal Accountant', avatar: '🧾',
      department: 'الشؤون القانونية والامتثال', zone: 'legal', reportsTo: 'ceo', status: 'available',
      requiresApprovalFor: ['approve_tax_filing', 'sign_financial_statement', 'submit_zakat'],
      allowedTools: ['analyze_financials', 'tax_compliance', 'audit_invoices', 'generate_pnl_report', 'priority_execution'],
      externalAccess: [], rankTitle: 'محاسب قانوني معتمد ⚖️', level: 4,
      roleMd: 'أنت **المحاسب القانوني** في قسم الشؤون القانونية والامتثال. تجمع بين الدقة المحاسبية والالتزام القانوني والضريبي.\n' +
        'المسؤوليات: مراجعة الفواتير والعقود المالية، حساب الضرائب والزكاة، تجهيز القوائم المالية الجاهزة للاعتماد، والتنبيه لأي بند يحتاج موافقة قانونية قبل الدفع أو الإفصاح.\n' +
        'القواعد: لا توقّع ولا تقدّم أي إقرار ضريبي دون موافقة المدير؛ اذكر دائماً الأساس النظامي أو الافتراض المستخدم، وصنّف أي مخاطرة إلى high|medium|low.\n' +
        'الإخراج المفضل: جدول مختصر + [COMPLIANCE risk="high|medium|low"]ملخص[/COMPLIANCE].',
      skillsMd: '- المحاسبة القانونية والضريبية\n- مراجعة العقود المالية\n- إعداد القوائم المالية والتدفقات النقدية\n- الزكاة والضرائب\n- إدارة مخاطر الامتثال'
    },
    {
      id: 'legal-advisor', name: 'المستشار القانوني', englishName: 'Legal Advisor', avatar: '⚖️',
      department: 'الشؤون القانونية والامتثال', zone: 'legal', reportsTo: 'ceo', status: 'available',
      requiresApprovalFor: ['sign_contract', 'external_legal_submission', 'publish_policy'],
      allowedTools: ['review_contract', 'risk_assessment', 'policy_drafting', 'priority_execution'],
      externalAccess: [], rankTitle: 'مستشار قانوني معتمد ⚖️', level: 4,
      roleMd: 'أنت **المستشار القانوني** في المكتب. مهمتك حماية الشركة من المخاطر القانونية في العقود والسياسات والإعلانات والتعامل مع العملاء.\n' +
        'المسؤوليات: مراجعة العقود و بنود الخدمة وسياسة الخصوصية، تحذير من الالتزامات غير المتوازنة، صياغة مسودات سياسات، وتصنيف المخاطر القانونية قبل أي نشر أو توقيع.\n' +
        'القواعد: تقديم استشارة عامة لا تُعدّ رأياً قانونياً رسمياً، ولا توقع عن الشركة، ولا تفتح اتصالاً خارجياً دون موافقة. ارفع أي قرار عالي المخاطر بصيغة [LEGAL_RISK level="high"]السبب والتوصية[/LEGAL_RISK].',
      skillsMd: '- مراجعة العقود واتفاقيات الخدمة\n- سياسات الخصوصية والإعلانات\n- تقييم المخاطر القانونية\n- صياغة مسودات السياسات\n- التنسيق مع المحاسب القانوني'
    }
  ];

  function isFreeModel(m) {
    if (!m) return false;
    var id = String(m.id || '');
    if (/free/i.test(id)) return true;
    /* OpenRouter publishes pricing as {prompt, completion} strings. */
    if (m.pricing && m.pricing.prompt != null && m.pricing.completion != null) {
      var p = num(m.pricing.prompt, 1), c = num(m.pricing.completion, 1);
      return p === 0 && c === 0 && !/:batch/i.test(id);
    }
    var costs = Array.isArray(m.cost) ? m.cost : (m.cost ? [m.cost] : []);
    if (!costs.length) return false;
    return costs.every(function (c) {
      var input = num(c && c.input, 0);
      var output = num(c && c.output, 0);
      return input === 0 && output === 0;
    });
  }

  /* ── model lab: benchmark → calibration → assignment ─────────────────── */
  var BENCHMARK_TASKS = {
    'executive-assistant': { prompt: 'لديكِ ثلاث مهام متزاحمة: عرض عميل، تقرير مالي، وموافقة أمنية. ضعي جدولاً تنفيذياً بأولوياتكِ وحددّي ما يحتاج موافقة المدير.', keywords: ['أولوية', 'جدول', 'موافقة', 'مدير'], minLen: 100 },
    'hr-manager': { prompt: 'فريقك يعمل فوق طاقته أسبوعين متتاليين. اقترحي خطة توظيف أو إعادة توزيع مع مؤشرات قياس ومخاطر.', keywords: ['توظيف', 'مؤشر', 'مخاطر', 'فريق'], minLen: 100 },
    'ai-trainer': { prompt: 'صمّمي خطة تدريب أسبوعية لوكيل ضعيف في الرد على العملاء مع KPI واضح وطريقة قياس.', keywords: ['تدريب', 'مؤشر', 'قياس', 'أسبوع'], minLen: 100 },
    'accountant': { prompt: 'احسبي هامش ربح منتج سعره $99 وتكلفته $41 مع تكلفة API $6، واذكري الافتراضات والمخاطر المالية.', keywords: ['هامش', 'تكلفة', 'ربح', 'افتراض'], minLen: 90 },
    'marketing-lead': { prompt: 'اكتب إعلاناً عربياً مختصراً لمنتج أتمتة مع دعوة لاتخاذ إجراء، وحدد جمهوراً وقناة نشر ومقياس نجاح.', keywords: ['جمهور', 'قناة', 'قياس', 'إعلان'], minLen: 90 },
    'security-officer': { prompt: 'راجع ربط webhook خارجي بمفتاح سري. صنّف الخطر واذكر الضوابط المطلوبة قبل الموافقة.', keywords: ['خطر', 'ضوابط', 'مفتاح', 'موافقة'], minLen: 90 },
    'web-research-team': { prompt: 'ابحث عن فرصة SaaS جديدة واذكر مصدراً ومعايير اختيار ومخاطرة واحدة على الأقل.', keywords: ['مصدر', 'معايير', 'فرصة', 'مخاطرة'], minLen: 90 },
    'auditors-experts-devs': { prompt: 'راجع مقترح أتمتة تقنياً: ما المخاطر التقنية، ومتى يحتاج تعيين مطور جديد؟', keywords: ['تقني', 'مخاطر', 'مطور', 'تدقيق'], minLen: 90 }
  };
  function benchmarkSpec(role) {
    if (BENCHMARK_TASKS[role]) return BENCHMARK_TASKS[role];
    var isQa = /^qa-/.test(String(role || ''));
    return isQa
      ? { prompt: 'راجع مقترحاً تنفيذياً يتضمن رقماً غير مدعوم وإجراءً يتطلب موافقة. أثبت خطأً واحداً وأصدر حكماً وفق بروتوكول QA.', keywords: ['دليل', 'خطأ', 'حكم', 'موافقة'], minLen: 80 }
      : { prompt: 'حلل هذه المهمة الإدارية واقترح خطوات عملية ومخاطر ومؤشر نجاح.', keywords: ['خطوات', 'مخاطر', 'مؤشر', 'حل'], minLen: 80 };
  }
  function benchmarkScore(text, spec, live) {
    var t = String(text || '');
    var lower = t.toLowerCase();
    if (!live || /الوضع التجريبي|تعذر الوصول إلى النموذج|demo mode/i.test(t)) return { score: 0, breakdown: 'رد تجريبي/غير حي — لا يُحتسب.' };
    var hits = (spec.keywords || []).filter(function (k) { return lower.indexOf(String(k).toLowerCase()) !== -1; }).length;
    var kwPts = Math.round(40 * hits / Math.max(1, (spec.keywords || []).length));
    var minLen = spec.minLen || 80;
    var lenPts = Math.min(25, Math.round(25 * t.length / minLen));
    var structurePts = /\n/.test(t) && /[-•١٢٣1-9]/.test(t) ? 15 : 6;
    var cleanPts = !/عذراً|لا أستطيع|غير قادر على (الوصول|الاتصال)/i.test(t) ? 20 : 8;
    var score = Math.max(0, Math.min(100, kwPts + lenPts + structurePts + cleanPts));
    return { score: score, breakdown: 'كلمات مفتاحية ' + kwPts + '/40 · طول ' + lenPts + '/25 · تنظيم ' + structurePts + '/15 · وضوح ' + cleanPts + '/20' };
  }
  function labKey(provider, model, role) {
    return usageKey(provider, model) + '::' + String(role || '');
  }
  function qualifiedModelForRole(role, availableIds) {
    if (!settings.useBenchmarks) return null;
    var best = null;
    Object.keys(state.modelBenchmarks || {}).forEach(function (k) {
      var x = state.modelBenchmarks[k];
      if (!x || x.role !== role || !x.passed) return;
      if (availableIds && availableIds.length && availableIds.indexOf(x.model) === -1) return;
      if (!best || num(x.score, 0) > num(best.score, 0)) best = x;
    });
    return best ? best.model : null;
  }
  /* Known free-tier IDs. Groq's /models endpoint has no price field, so only
     these IDs are eligible; account limits still apply (429 is tracked). */
  var GROQ_FREE_TIER_MODELS = [
    'llama-3.3-70b-versatile', 'llama-3.1-8b-instant',
    'openai/gpt-oss-120b', 'openai/gpt-oss-20b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'qwen/qwen3-32b', 'moonshotai/kimi-k2-instruct-0905',
    'allam-2-7b', 'gemma2-9b-it'
  ];
  var GROQ_ROLE_MODELS = {
    'executive-assistant': ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
    'hr-manager': ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile'],
    'ai-trainer': ['openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
    'accountant': ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
    'marketing-lead': ['llama-3.1-8b-instant', 'openai/gpt-oss-20b'],
    'security-officer': ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
    'web-research-team': ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
    'auditors-experts-devs': ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
    'legal-accountant': ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
    'legal-advisor': ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile']
  };
  var OPENROUTER_ROLE_MODELS = {
    'executive-assistant': ['baidu/ernie-5.5-flash-preview:free', 'liquid/lfm-3-1.7b:free'],
    'hr-manager': ['nvidia/nemotron-3.5-lightning:free', 'liquid/lfm-3-1.7b:free'],
    'ai-trainer': ['google/gemma-4-26b-a4b-it:free', 'liquid/lfm-3-1.7b:free'],
    'accountant': ['baidu/ernie-5.5-flash-preview:free', 'recursive/flint-v1.0:free'],
    'marketing-lead': ['liquid/lfm-3-1.7b:free', 'nvidia/nemotron-3.5-lightning:free'],
    'security-officer': ['nvidia/nemotron-3-ultra-550b-a55b:free', 'baidu/ernie-5.5-flash-preview:free'],
    'web-research-team': ['nvidia/nemotron-3.5-super-vl:free', 'baidu/ernie-5.5-flash-preview:free'],
    'auditors-experts-devs': ['nvidia/nemotron-3-ultra-550b-a55b:free', 'baidu/ernie-5.5-flash-preview:free'],
    'legal-accountant': ['baidu/ernie-5.5-flash-preview:free', 'recursive/flint-v1.0:free'],
    'legal-advisor': ['nvidia/nemotron-3-ultra-550b-a55b:free', 'baidu/ernie-5.5-flash-preview:free']
  };
  function rolePreferenceMap(provider) {
    if (provider === 'groq') return GROQ_ROLE_MODELS;
    if (provider === 'openrouter') return OPENROUTER_ROLE_MODELS;
    return ROLE_MODELS;
  }
  function providerFallbacks(provider) {
    if (provider === 'cloud') return (providerCache.cloud && providerCache.cloud.free || []).concat(FALLBACK_MODELS);
    if (provider === 'groq') return GROQ_FREE_TIER_MODELS;
    if (provider === 'openrouter') return ['baidu/ernie-5.5-flash-preview:free', 'liquid/lfm-3-1.7b:free', 'nvidia/nemotron-3.5-lightning:free', 'google/gemma-4-26b-a4b-it:free'];
    return FALLBACK_MODELS;
  }
  function pickModel(agentId, availableIds, explicit, provider) {
    if (explicit && explicit !== 'auto') return explicit;
    var avail = availableIds || [];
    var qualified = qualifiedModelForRole(agentId, avail);
    if (qualified) return qualified;
    var map = rolePreferenceMap(provider);
    var preferred = map[agentId] || [];
    for (var i = 0; i < preferred.length; i++) if (avail.indexOf(preferred[i]) !== -1) return preferred[i];
    var fallbacks = providerFallbacks(provider);
    for (var j = 0; j < fallbacks.length; j++) if (avail.indexOf(fallbacks[j]) !== -1) return fallbacks[j];
    return avail[0] || fallbacks[0];
  }
  function fallbackChain(agentId, availableIds, first, provider) {
    var chain = [];
    if (first) chain.push(first);
    var map = rolePreferenceMap(provider);
    (map[agentId] || []).concat(providerFallbacks(provider), availableIds || []).forEach(function (id) {
      if ((availableIds || []).indexOf(id) !== -1 && chain.indexOf(id) === -1) chain.push(id);
    });
    if (!chain.length && availableIds && availableIds.length) chain.push(availableIds[0]);
    return chain;
  }
  /* Drop models already known to be rate-limited; keep at least one candidate. */
  function availableChain(agentId, availableIds, first, provider) {
    var full = fallbackChain(agentId, availableIds, first, provider);
    var ok = full.filter(function (id) { return !isModelLimited(provider, id); });
    return ok.length ? ok : full;
  }
  function roleAssignments(availableIds, provider) {
    var out = {};
    var roles = Object.keys(ROLE_MODELS)
      .concat(QA_AGENTS.map(function (a) { return a.id; }))
      .concat(SPECIAL_AGENTS.map(function (a) { return a.id; }));
    roles.forEach(function (id) { out[id] = pickModel(id, availableIds, settings.modelOverrides[id], provider); });
    return out;
  }

  /* ── provider layer ───────────────────────────────────────────────────── */
  var providerCache = { cloud: null, cloudAt: 0, local: null, localAt: 0, zen: null, zenAt: 0, groq: null, groqAt: 0, openrouter: null, openrouterAt: 0 };
  function basicAuth(password) {
    return 'Basic ' + btoa('opencode:' + password);
  }

  function listLocalModels(force) {
    if (!secret('localPassword')) return Promise.resolve({ connected: false, models: [], free: [], error: 'أدخل كلمة مرور خدمة OpenCode (service.json).' });
    if (!force && providerCache.local && Date.now() - providerCache.localAt < 30000) return Promise.resolve(providerCache.local);
    // Try the optional HTTPS/local bridge first (works from mdm1.org), then the direct app URL.
    var bases = [settings.localBridgeUrl, settings.localUrl].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var lastErr = '';
    function tryBase(i) {
      if (i >= bases.length) {
        var out = { connected: false, models: [], free: [], base: bases[0] || settings.localUrl, error: lastErr || 'تعذر الاتصال بالمزود المحلي.' };
        providerCache.local = out; providerCache.localAt = Date.now();
        return Promise.resolve(out);
      }
      var base = bases[i].replace(/\/$/, '');
      return nativeFetch(base + '/api/model', {
        headers: { authorization: basicAuth(secret('localPassword')), accept: 'application/json' },
        cache: 'no-store'
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (j) {
        var models = (j.data || []).filter(function (m) { return m.type === 'chat' && m.enabled !== false; });
        var free = models.filter(isFreeModel).map(function (m) { return m.id; });
        var out = { connected: true, models: models, free: free, base: base, error: null };
        settings.localBase = base; saveSettings();
        providerCache.local = out; providerCache.localAt = Date.now();
        return out;
      }).catch(function (e) {
        lastErr = e.message;
        return tryBase(i + 1);
      });
    }
    return tryBase(0);
  }

  function listZenModels(force) {
    if (!secret('zenKey')) return Promise.resolve({ connected: false, models: [], free: [], error: 'أدخل مفتاح OpenCode Zen.' });
    if (!force && providerCache.zen && Date.now() - providerCache.zenAt < 30000) return Promise.resolve(providerCache.zen);
    return nativeFetch(settings.zenBase.replace(/\/$/, '') + '/models', {
      headers: { authorization: 'Bearer ' + secret('zenKey'), accept: 'application/json' },
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

  function listGroqModels(force) {
    if (!secret('groqKey')) return Promise.resolve({ connected: false, models: [], free: [], error: 'أدخل مفتاح Groq (يُحفظ في متصفحك فقط).' });
    if (!force && providerCache.groq && Date.now() - providerCache.groqAt < 30000) return Promise.resolve(providerCache.groq);
    return nativeFetch(settings.groqBase.replace(/\/$/, '') + '/models', {
      headers: { authorization: 'Bearer ' + secret('groqKey'), accept: 'application/json' },
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var all = (j.data || []).filter(function (m) { return !m.type || m.type === 'chat'; });
      /* Groq does not publish a price field — restrict to the free-tier allowlist. */
      var ids = all.map(function (m) { return m.id; });
      var free = GROQ_FREE_TIER_MODELS.filter(function (id) { return ids.indexOf(id) !== -1; });
      var models = all.map(function (m) { return Object.assign({}, m, { freeTier: free.indexOf(m.id) !== -1 }); });
      var out = { connected: true, models: models, free: free, base: settings.groqBase, error: null };
      providerCache.groq = out; providerCache.groqAt = Date.now();
      return out;
    }).catch(function (e) {
      var out = { connected: false, models: [], free: [], base: settings.groqBase, error: e.message };
      providerCache.groq = out; providerCache.groqAt = Date.now();
      return out;
    });
  }

  function listOpenRouterModels(force) {
    if (!force && providerCache.openrouter && Date.now() - providerCache.openrouterAt < 30000) return Promise.resolve(providerCache.openrouter);
    var headers = { accept: 'application/json', 'HTTP-Referer': location.origin, 'X-Title': 'MDM1 AI Office' };
    if (secret('openrouterKey')) headers.authorization = 'Bearer ' + secret('openrouterKey');
    return nativeFetch(settings.openrouterBase.replace(/\/$/, '') + '/models', { headers: headers, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (j) {
        var all = (j.data || []).filter(function (m) { return !/:batch/i.test(String(m.id || '')); });
        var free = all.filter(isFreeModel).map(function (m) { return m.id; });
        var out = { connected: true, models: all, free: free, base: settings.openrouterBase, error: null };
        providerCache.openrouter = out; providerCache.openrouterAt = Date.now();
        return out;
      }).catch(function (e) {
        var out = { connected: false, models: [], free: [], base: settings.openrouterBase, error: e.message };
        providerCache.openrouter = out; providerCache.openrouterAt = Date.now();
        return out;
      });
  }

  function relayApi(action, payload) {
    if (!settings.relayUrl) return Promise.reject(new Error('أدخل Supabase Relay URL في لوحة الاتصال.'));
    var headers = { 'content-type': 'application/json' };
    var relaySecret = secret('relaySecret');
    /* The relay is reachable with the public Supabase anon JWT. An optional
       browser-entered relay secret is still sent when present, but it is no
       longer required for model listing/chat — a fresh visitor must be able to
       see connected models without hunting for a secret. */
    if (relaySecret) headers['x-office-secret'] = relaySecret;
    var anon = (CFG.messaging && CFG.messaging.anonKey) || '';
    if (anon) { headers.authorization = 'Bearer ' + anon; headers.apikey = anon; }
    return nativeFetch(settings.relayUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(Object.assign({ action: action }, payload || {})),
      cache: 'no-store'
    }).then(function (r) {
      return r.text().then(function (raw) {
        var j = safeJson(raw, {});
        if (!r.ok) throw new Error(j.error || j.message || ('HTTP ' + r.status));
        return j;
      });
    });
  }
  function cloudConfigured() { return Boolean(settings.relayUrl && ((CFG.messaging && CFG.messaging.anonKey) || secret('relaySecret'))); }
  function listCloudModels(force) {
    if (!cloudConfigured()) return Promise.resolve({ connected: false, models: [], free: [], providers: {}, modelProviders: {}, defaultProvider: '', error: 'أدخل Supabase Relay URL في لوحة الاتصال.' });
    if (!force && providerCache.cloud && Date.now() - providerCache.cloudAt < 30000) return Promise.resolve(providerCache.cloud);
    return relayApi('models', { refresh: Boolean(force) }).then(function (j) {
      var free = (j.free || []).map(String);
      var models = (j.models || []).map(function (id) {
        id = String(id);
        return { id: id, name: id, free: free.indexOf(id) !== -1 };
      });
      var out = {
        connected: Boolean(j.connected), models: models, free: free,
        providers: j.providers || {}, modelProviders: j.modelProviders || {},
        defaultProvider: j.defaultProvider || '', base: settings.relayUrl, error: null, raw: j
      };
      providerCache.cloud = out; providerCache.cloudAt = Date.now();
      return out;
    }).catch(function (e) {
      var out = { connected: false, models: [], free: [], providers: {}, modelProviders: {}, defaultProvider: '', base: settings.relayUrl, error: e.message };
      providerCache.cloud = out; providerCache.cloudAt = Date.now();
      return out;
    });
  }
  function providerConfigured(mode) {
    if (mode === 'supabase') mode = 'cloud';
    if (mode === 'cloud') return cloudConfigured();
    if (mode === 'local') return Boolean(secret('localPassword'));
    if (mode === 'zen') return Boolean(secret('zenKey'));
    if (mode === 'groq') return Boolean(secret('groqKey'));
    if (mode === 'openrouter') return Boolean(secret('openrouterKey'));
    return false;
  }
  function currentMode() {
    var mode = settings.mode === 'supabase' ? 'cloud' : settings.mode;
    if (mode !== 'auto') return mode;
    /* Prefer a provider that is both configured AND reachable. This stops the
       UI from reporting "available" while chat falls back because the first
       configured provider (often localhost) is not reachable from the site. */
    var order = ['cloud', 'local', 'zen', 'groq', 'openrouter'];
    var i, mode;
    for (i = 0; i < order.length; i++) {
      mode = order[i];
      if (providerConfigured(mode) && providerCache[mode] && providerCache[mode].connected) return mode;
    }
    for (i = 0; i < order.length; i++) {
      if (providerConfigured(order[i])) return order[i];
    }
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
    var parsed = parseRequestItems(userMessage || '');
    var items = (parsed.items || []).slice(0, 4).map(function (x) {
      return '• ' + x.text + ' [' + (x.status === 'understood' ? 'مفهوم' : 'غير واضح') + ']';
    }).join('\n');
    var unclear = (parsed.unresolved || []).slice(0, 3).map(function (x) { return '• ' + x; }).join('\n');
    return '⚠️ **رد غير حي — ليس من نموذج متصل** — ' + (warning || 'لا يوجد اتصال حي حالياً') + '\n\n' +
      '📝 **كل ما فهمته من طلبك:**\n' + (items || '• لم أستخرج طلباً قابلاً للتنفيذ بعد.') + '\n\n' +
      '❓ **ما لم أفهمه بعد:**\n' + (unclear || '• لا توجد أسئلة توضيحية عاجلة.') + '\n\n' +
      '🔧 افتح **🔌 الاتصال** أو **🔑 إضافة API** لتفعيل الرد الحي. المهام الواضحة أُنشئت تلقائياً في لوحة المهام حتى في هذا الوضع.';
  }

  function aiGenerateRaw(opts) {
    var agent = getAgent(opts.agentId) || { id: opts.agentId, name: opts.agentId, englishName: opts.agentId, roleMd: '', skillsMd: '', allowedTools: [], requiresApprovalFor: [], department: '' };
    var systemPrompt = opts.systemPrompt || buildSystemPrompt(agent, opts.extraContext || '', opts.memories || []);
    var messages = opts.messages || [];
    var mode = opts.forceProvider || currentMode();
    var forcedModel = opts.forceModel || ''; // used by the model lab for exact-model tests
    var lastUser = messages.length ? messages[messages.length - 1].text : '';

    function fallback(warning) {
      return { text: demoReply(agent, lastUser, warning), mode: 'fallback', provider: mode, model: 'demo', warning: warning || null, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 } };
    }

    if (mode === 'demo') return Promise.resolve(fallback(null));

    /* Shared OpenAI-compatible executor for Zen / Groq / OpenRouter.
       Free-only pool, per-role distribution, 429-aware fallback chain. */
    function runOpenAiChain(provider, listing, url, headers, pool) {
      var first = forcedModel || pickModel(agent.id, pool, settings.modelOverrides[agent.id], provider);
      var chain = forcedModel ? [forcedModel] : availableChain(agent.id, pool, first, provider).slice(0, 3);
      var errors = [];
      function attempt(i) {
        if (i >= chain.length) return fallback(errors.join('\n'));
        var id = chain[i];
        return nativeFetch(url, {
          method: 'POST',
          headers: headers,
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
              if (r.status === 429 || /rate limit|free usage limit/i.test(msg)) {
                markRateLimit(provider, id, retryMsFrom(r, j), msg);
                throw new Error('RATE_LIMIT');
              }
              if (r.status === 402 || /insufficient balance|insufficient_quota/i.test(msg)) throw new Error('NO_BALANCE');
              markModelError(provider, id, msg);
              return attempt(i + 1);
            }
            var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
            if (!text) { errors.push(id + ': رد فارغ'); markModelError(provider, id, 'رد فارغ'); return attempt(i + 1); }
            var out = { text: text, mode: 'live', provider: provider, model: id, usage: estimateUsage(systemPrompt, messages, text) };
            markUsage(provider, id, out.usage);
            return out;
          });
        }).catch(function (e) {
          if (e.message === 'RATE_LIMIT' || e.message === 'NO_BALANCE') throw e;
          errors.push(id + ': ' + e.message);
          markModelError(provider, id, e.message);
          return attempt(i + 1);
        });
      }
      return attempt(0).catch(function (e) {
        return fallback(errors.join('\n') || (e.message === 'NO_BALANCE' ? 'الرصيد غير كافٍ — استخدم النماذج المجانية فقط.' : e.message));
      });
    }

    if (mode === 'cloud') {
      return listCloudModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error || 'Supabase Relay غير متصل.');
        /* Cloud is free-tier only and must fail over across providers: Zen's
           free models often hit their quota while Groq/OpenRouter still work. */
        var pool = (listing.free && listing.free.length) ? listing.free : listing.models.map(function (m) { return m.id; });
        if (!pool.length) return fallback('لا توجد نماذج مجانية عبر Supabase Relay حالياً.');
        var first = pickModel(agent.id, pool, settings.modelOverrides[agent.id], 'cloud');
        var mp = listing.modelProviders || {};
        var groqPool = pool.filter(function (id) { return mp[id] === 'groq'; });
        var orPool = pool.filter(function (id) { return mp[id] === 'openrouter'; });
        var zenPool = pool.filter(function (id) { return mp[id] === 'zen'; });
        var ordered = groqPool.concat(orPool).concat(zenPool);
        ordered.forEach(function (id) { if (pool.indexOf(id) === -1) ordered.push(id); });
        if (first && ordered.indexOf(first) !== -1 && mp[first] === 'groq') {
          ordered = [first].concat(ordered.filter(function (id) { return id !== first; }));
        }
        var chain = forcedModel ? [forcedModel] : ordered.filter(function (id) { return !isModelLimited('cloud', id); }).slice(0, 10);
        if (!chain.length) chain = ordered.slice(0, 10);
        var errors = [];
        function attempt(i) {
          if (i >= chain.length) return fallback(errors.join('\n'));
          var id = chain[i];
          return relayApi('chat', {
            model: id,
            provider: 'auto',
            temperature: 0.7,
            messages: [{ role: 'system', content: systemPrompt }].concat(messages.map(function (m) {
              return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text };
            }))
          }).then(function (j) {
            var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
            if (!text) { errors.push(id + ': رد فارغ'); markModelError('cloud', id, 'رد فارغ'); return attempt(i + 1); }
            var out = {
              text: text, mode: 'live', provider: 'cloud', model: id,
              upstreamProvider: j.provider || '',
              usage: estimateUsage(systemPrompt, messages, text)
            };
            markUsage('cloud', id, out.usage);
            return out;
          }).catch(function (e) {
            var msg = e.message || String(e);
            errors.push(id + ': ' + msg);
            if (/429|rate limit|free usage limit/i.test(msg)) {
              /* One model/provider being out of free quota must not abort the
                 whole cloud chain: another free provider (e.g. Groq) may work. */
              markRateLimit('cloud', id, retryMsFrom(null, {}), msg);
              return attempt(i + 1);
            }
            if (/402|insufficient balance|insufficient_quota/i.test(msg)) return attempt(i + 1);
            markModelError('cloud', id, msg);
            return attempt(i + 1);
          });
        }
        return attempt(0).catch(function (e) {
          return fallback(errors.join('\n') || (e.message === 'NO_BALANCE' ? 'الرصيد غير كافٍ — استخدم النماذج المجانية فقط.' : e.message));
        });
      });
    }

    if (mode === 'local') {
      return listLocalModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        var pool = settings.freeOnly && listing.free.length ? listing.free : listing.models.map(function (m) { return m.id; });
        var first = forcedModel || pickModel(agent.id, pool, settings.modelOverrides[agent.id], 'local');
        var chain = forcedModel ? [forcedModel] : availableChain(agent.id, pool, first, 'opencode-local').slice(0, 3);
        var errors = [];
        function attempt(i) {
          if (i >= chain.length) return fallback(errors.join('\n'));
          var id = chain[i];
          return nativeFetch((listing.base || settings.localUrl).replace(/\/$/, '') + '/api/experimental/generate/text', {
            method: 'POST',
            headers: { authorization: basicAuth(secret('localPassword')), 'content-type': 'application/json' },
            body: JSON.stringify({ prompt: transcript(systemPrompt, messages), model: { id: id, providerID: 'opencode' } })
          }).then(function (r) {
            return r.text().then(function (raw) {
              var j = safeJson(raw, {});
              if (!r.ok) {
                var msg = j.message || (j.error && j.error.message) || raw.slice(0, 200) || ('HTTP ' + r.status);
                errors.push(id + ': ' + msg);
                if (r.status === 429 || /free usage limit|rate limit/i.test(msg)) {
                  markRateLimit('opencode-local', id, retryMsFrom(r, j), msg);
                  throw new Error('RATE_LIMIT');
                }
                markModelError('opencode-local', id, msg);
                return attempt(i + 1);
              }
              var text = (j.data && j.data.text) || '';
              if (!text) { errors.push(id + ': رد فارغ'); markModelError('opencode-local', id, 'رد فارغ'); return attempt(i + 1); }
              var out = { text: text, mode: 'live', provider: 'opencode-local', model: id, usage: estimateUsage(systemPrompt, messages, text) };
              markUsage('opencode-local', id, out.usage);
              return out;
            });
          }).catch(function (e) {
            if (e.message === 'RATE_LIMIT') throw e;
            errors.push(id + ': ' + e.message);
            markModelError('opencode-local', id, e.message);
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
        var first = forcedModel || pickModel(agent.id, pool, settings.modelOverrides[agent.id], 'zen');
        var chain = forcedModel ? [forcedModel] : availableChain(agent.id, pool, first, 'opencode-zen').slice(0, 3);
        var errors = [];
        function attempt(i) {
          if (i >= chain.length) return fallback(errors.join('\n'));
          var id = chain[i];
          return nativeFetch(settings.zenBase.replace(/\/$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer ' + secret('zenKey') },
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
                if (r.status === 429 || /free usage limit|rate limit/i.test(msg)) {
                  markRateLimit('opencode-zen', id, retryMsFrom(r, j), msg);
                  throw new Error('RATE_LIMIT');
                }
                markModelError('opencode-zen', id, msg);
                return attempt(i + 1);
              }
              var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
              if (!text) { errors.push(id + ': رد فارغ'); markModelError('opencode-zen', id, 'رد فارغ'); return attempt(i + 1); }
              var out = { text: text, mode: 'live', provider: 'opencode-zen', model: id, usage: estimateUsage(systemPrompt, messages, text) };
              markUsage('opencode-zen', id, out.usage);
              return out;
            });
          }).catch(function (e) {
            if (e.message === 'RATE_LIMIT') throw e;
            errors.push(id + ': ' + e.message);
            markModelError('opencode-zen', id, e.message);
            return attempt(i + 1);
          });
        }
        return attempt(0).catch(function (e) { return fallback(errors.join('\n') || e.message); });
      });
    }

    if (mode === 'groq') {
      if (!secret('groqKey')) return Promise.resolve(fallback('أدخل مفتاح Groq.'));
      return listGroqModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        if (!listing.free.length) return fallback('لا توجد نماذج Groq مجانية متاحة لحسابك حالياً.');
        var pool = forcedModel ? [forcedModel] : (settings.freeOnly && listing.free.length ? listing.free : listing.models.map(function (m) { return m.id; }));
        return runOpenAiChain('groq', listing, settings.groqBase.replace(/\/$/, '') + '/chat/completions',
          { 'content-type': 'application/json', authorization: 'Bearer ' + secret('groqKey') }, pool);
      });
    }

    if (mode === 'openrouter') {
      if (!secret('openrouterKey')) return Promise.resolve(fallback('أدخل مفتاح OpenRouter.'));
      return listOpenRouterModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        var pool = forcedModel ? [forcedModel] : (settings.freeOnly && listing.free.length ? listing.free : listing.models.map(function (m) { return m.id; }));
        if (!pool.length) return fallback('لا توجد نماذج مجانية على OpenRouter حالياً.');
        return runOpenAiChain('openrouter', listing, settings.openrouterBase.replace(/\/$/, '') + '/chat/completions',
          { 'content-type': 'application/json', authorization: 'Bearer ' + secret('openrouterKey'), 'HTTP-Referer': location.origin, 'X-Title': 'MDM1 AI Office' }, pool);
      });
    }

    return Promise.resolve(fallback('مزود غير معروف: ' + mode));
  }

  /* Single instrumented entry point for every runtime call. */
  function aiGenerate(opts) {
    return Promise.resolve().then(function () { return aiGenerateRaw(opts); }).then(function (r) {
      settings.lastProvider = r.provider || settings.lastProvider;
      saveSettings();
      if (r.mode !== 'live' && r.warning && /429|limit|حصة|RATE_LIMIT/i.test(r.warning)) {
        showToast('⚠️ تعذّر التوليد حياً: ' + String(r.warning).slice(0, 180), 'err');
      }
      updateQuotaBadge();
      return r;
    }).catch(function (e) {
      var agent = getAgent(opts && opts.agentId) || { name: opts && opts.agentId || 'المساعد', id: opts && opts.agentId || 'unknown' };
      return {
        text: demoReply(agent, '', e.message),
        mode: 'fallback', provider: currentMode(), model: 'demo',
        warning: e.message, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
      };
    });
  }

  /* ── model lab ────────────────────────────────────────────────────────── */
  function runBenchmark(provider, model, role) {
    var spec = benchmarkSpec(role);
    var ag = getAgent(role) || { id: role, name: role, roleMd: '', skillsMd: '' };
    return aiGenerate({
      agentId: role,
      forceProvider: provider,
      forceModel: model,
      systemPrompt: buildSystemPrompt(ag, '', []),
      messages: [{ role: 'user', text: spec.prompt }]
    }).then(function (r) {
      var sc = benchmarkScore(r.text, spec, r.mode === 'live');
      var rec = {
        provider: provider, model: model, role: role, score: sc.score, breakdown: sc.breakdown,
        passed: sc.score >= num(settings.benchmarkThreshold, 70), at: nowIso(), mode: r.mode,
        sample: String(r.text || '').slice(0, 400), warning: r.warning || null
      };
      state.modelBenchmarks[labKey(provider, model, role)] = rec;
      logAudit('model_benchmark', role, 'Benchmark ' + provider + '/' + model + ': ' + sc.score + ' (' + (rec.passed ? 'pass' : 'fail') + ')', { model: model, score: sc.score });
      saveState();
      return rec;
    });
  }
  function runTraining(provider, model, role) {
    var spec = benchmarkSpec(role);
    var ag = getAgent(role) || { id: role, name: role, roleMd: '', skillsMd: '' };
    var drills = [
      spec.prompt,
      spec.prompt + '\n\nأعد الإجابة بخطوات قصيرة واضحة مع مثال عملي.',
      spec.prompt + '\n\nأضف قائمة تحقق نهائية ومؤشر نجاح.'
    ];
    var results = [], chain = Promise.resolve();
    drills.forEach(function (prompt) {
      chain = chain.then(function () {
        return aiGenerate({
          agentId: role, forceProvider: provider, forceModel: model,
          systemPrompt: buildSystemPrompt(ag, 'هذا تمرين تدريبي (prompt calibration) على دورك.', []),
          messages: [{ role: 'user', text: prompt }]
        });
      }).then(function (r) {
        if (r.mode !== 'live') return;
        results.push({ text: String(r.text || '').slice(0, 700), score: benchmarkScore(r.text, spec, true).score });
      });
    });
    return chain.then(function () {
      var key = labKey(provider, model, role);
      var avg = results.length ? Math.round(results.reduce(function (a, x) { return a + x.score; }, 0) / results.length) : 0;
      var rec = {
        provider: provider, model: model, role: role, status: results.length ? 'trained' : 'offline',
        drills: results.length, avgScore: avg, trainedAt: nowIso(),
        examples: results.slice(-2).map(function (x) { return x.text; })
      };
      state.modelTraining[key] = rec;
      /* Training improves the stored benchmark when it produces a better pass. */
      var b = state.modelBenchmarks[key];
      if (results.length && (!b || avg > num(b.score, 0))) {
        state.modelBenchmarks[key] = {
          provider: provider, model: model, role: role, score: avg,
          breakdown: 'متوسط ' + results.length + ' تمرين تدريبي',
          passed: avg >= num(settings.benchmarkThreshold, 70), at: nowIso(), mode: 'live',
          sample: results[results.length - 1].text.slice(0, 400), warning: null
        };
      }
      logAudit('model_training', role, 'Calibrated ' + provider + '/' + model + ': ' + results.length + ' drills, avg ' + avg, { model: model });
      saveState();
      return rec;
    });
  }
  function assignQualifiedModels() {
    var count = 0;
    var roles = Object.keys(ROLE_MODELS).concat(QA_AGENTS.map(function (a) { return a.id; }));
    roles.forEach(function (role) {
      var best = null;
      Object.keys(state.modelBenchmarks || {}).forEach(function (k) {
        var x = state.modelBenchmarks[k];
        if (!x || x.role !== role || !x.passed) return;
        if (!best || num(x.score, 0) > num(best.score, 0)) best = x;
      });
      if (best) { settings.modelOverrides[role] = best.model; count++; }
    });
    if (count) { saveSettings(); logAudit('models_auto_assigned', 'model-lab', 'Assigned ' + count + ' benchmark-qualified models', {}); }
    return count;
  }
  function benchmarkReport() {
    return Object.keys(state.modelBenchmarks || {}).map(function (k) { return state.modelBenchmarks[k]; })
      .sort(function (a, b) { return num(b.score, 0) - num(a.score, 0); });
  }
  function trainingReport() {
    return Object.keys(state.modelTraining || {}).map(function (k) { return state.modelTraining[k]; });
  }

  /* ── department quality gate ──────────────────────────────────────────── */
  function qaVerdict(text) {
    var m = String(text || '').match(/\[QA\s+verdict\s*=\s*"(PASS|FAIL)"/i);
    return m ? m[1].toUpperCase() : null;
  }
  function qaTag(text, tag) {
    var m = String(text || '').match(new RegExp('\\[' + tag + '\\]([\\s\\S]*?)\\[\\/' + tag + '\\]', 'i'));
    return m ? m[1].trim() : '';
  }
  function qaCall(agentId, prompt, context) {
    var ag = getAgent(agentId);
    return aiGenerate({ agentId: agentId, extraContext: context || '', messages: [{ role: 'user', text: prompt }] });
  }
  function qualityGate(agentId, proposal) {
    if (!settings.qualityGate) return Promise.resolve({ status: 'disabled', enabled: false, findings: [] });
    var team = getQaTeam(agentId);
    if (!team) return Promise.resolve({ status: 'core-team', enabled: true, team: null, findings: [], note: 'فريق الخبراء والمدققين الأساسي هو المرجع النهائي لهذا القسم.' });
    var author = getAgent(agentId);
    var summary = 'المقترح: ' + String(proposal.title || '') + '\n' +
      'التفاصيل: ' + String(proposal.details || '') + '\n' +
      'الخطورة المعلنة: ' + String(proposal.risk || 'medium') + '\n' +
      'الإجراء: ' + String(proposal.actionType || 'agent_proposal');
    return qaCall(team.monitor,
      'أنت المراقب. راقب المقترح التالي قبل أي تنفيذ. اذكر عيباً واحداً على الأقل إن وُجد، ولا تمنح PASS إلا بوجود دليل واضح. لا تكرر كلام المقترح.\n\n' + summary,
      'مراقبة ما قبل التنفيذ — قسم ' + (author ? author.department : agentId)
    ).then(function (m) {
      return qaCall(team.auditor,
        'أنت المدقق. تحقق من المقترح ومن تقرير المراقب بشكل مستقل من الصفر. ارفض أي رقم أو صلاحية غير مؤكدة.\n\n' + summary + '\n\nتقرير المراقب:\n' + m.text,
        'تدقيق مستقل — قسم ' + (author ? author.department : agentId)
      ).then(function (a) {
        return qaCall(team.corrector,
          'أنت المصحح. أنتج النسخة المصححة الكاملة من المقترح بأقل تغيير، واذكر التعديلات داخل [CORRECTION]، ثم أصدر حكمك النهائي.\n\n' + summary + '\n\nالمراقب:\n' + m.text + '\n\nالمدقق:\n' + a.text,
          'تصحيح ما قبل التنفيذ — قسم ' + (author ? author.department : agentId)
        ).then(function (c) {
          var live = m.mode === 'live' && a.mode === 'live' && c.mode === 'live';
          var verdicts = [qaVerdict(m.text), qaVerdict(a.text), qaVerdict(c.text)];
          var failed = verdicts.indexOf('FAIL') !== -1;
          var correction = qaTag(c.text, 'CORRECTION');
          var status = !live ? 'inconclusive' : (failed ? 'flagged' : (correction ? 'corrected' : 'passed'));
          var findings = [qaTag(m.text, 'QA_DETAILS'), qaTag(a.text, 'QA_DETAILS')].filter(Boolean);
          var report = {
            at: nowIso(), author: agentId, team: team, status: status, live: live,
            verdicts: verdicts, findings: findings, correction: correction,
            summary: String(proposal.title || ''), models: [m.model, a.model, c.model]
          };
          if (live) {
            if (status === 'passed') {
              awardPoints(agentId, 6, 'اجتياز حلقة الجودة: ' + String(proposal.title || '').slice(0, 30));
              Object.keys(team).forEach(function (k) { awardPoints(team[k], 4, 'مراجعة مقترح سليم: ' + String(proposal.title || '').slice(0, 24)); });
            } else if (status === 'corrected') {
              penalizePoints(agentId, 4, 'خطأ صحيحه المصحح: ' + String(proposal.title || '').slice(0, 30));
              awardPoints(team.monitor, 5, 'رصد خطأ قبل التنفيذ');
              awardPoints(team.auditor, 5, 'تحقق مستقل من الخطأ');
              awardPoints(team.corrector, 8, 'تصحيح المقترح قبل التنفيذ');
            } else if (status === 'flagged') {
              penalizePoints(agentId, 10, 'مقترح مرفوض من حلقة الجودة: ' + String(proposal.title || '').slice(0, 30));
              awardPoints(team.monitor, 8, 'منع تنفيذ مقترح خاطئ');
              awardPoints(team.auditor, 8, 'رفض مقترح غير مؤكد');
              awardPoints(team.corrector, 5, 'محاولة تصحيح مقترح مرفوض');
            }
          } else {
            report.note = 'الردود كانت تجريبية/غير حي: لا توجد عقوبات أو مكافآت تلقائية.';
          }
          state.qualityReports.unshift(report);
          state.qualityReports = state.qualityReports.slice(0, 100);
          logAudit('quality_gate', agentId, 'Quality gate: ' + status + ' — ' + String(proposal.title || '').slice(0, 60), { team: team, verdicts: verdicts });
          saveState();
          return report;
        });
      });
    }).catch(function (e) {
      var report = { at: nowIso(), author: agentId, team: team, status: 'inconclusive', live: false, findings: [e.message], verdicts: [], correction: '' };
      state.qualityReports.unshift(report);
      state.qualityReports = state.qualityReports.slice(0, 100);
      logAudit('quality_gate_error', agentId, 'Quality gate unavailable: ' + e.message, {});
      saveState();
      return report;
    });
  }

  /* ── secret hunter + auto developer ───────────────────────────────────── */
  function redactSecret(value) {
    var s = String(value || '');
    if (s.length <= 8) return '***';
    return s.slice(0, 2) + '…' + s.slice(-4) + ' (' + s.length + 'char)';
  }
  var SECRET_PATTERNS = [
    { re: /gsk_[A-Za-z0-9_-]{12,}/g, kind: 'مفتاح Groq', severity: 'high' },
    { re: /sk-or-[A-Za-z0-9_-]{12,}/g, kind: 'مفتاح OpenRouter', severity: 'high' },
    { re: /sk-[A-Za-z0-9]{20,}/g, kind: 'مفتاح OpenAI/Zen', severity: 'high' },
    { re: /gh[pousr]_[A-Za-z0-9]{20,}/g, kind: 'رمز GitHub', severity: 'high' },
    { re: /xox[baprs]-[A-Za-z0-9-]{10,}/g, kind: 'رمز Slack', severity: 'high' },
    { re: /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/g, kind: 'رمز بوت تيليجرام', severity: 'high' },
    { re: /"d"\s*:\s*"[A-Za-z0-9_-]{30,}"/g, kind: 'مفتاح خاص ECDSA', severity: 'high' }
  ];
  function securityScan() {
    var sources = [
      { where: 'office-config.js (عام)', text: JSON.stringify(CFG) },
      { where: 'localStorage', text: Object.keys(localStorage).map(function (k) { return k + '=' + localStorage.getItem(k); }).join('\n') },
      { where: 'النسخ/الصادرات المحفوظة', text: JSON.stringify({ exports: state.exports, snapshots: state.snapshots, exportsContent: state.exportContents }) }
    ];
    var findings = [];
    sources.forEach(function (src) {
      SECRET_PATTERNS.forEach(function (p) {
        var m = String(src.text || '').match(p.re);
        if (!m) return;
        findings.push({ where: src.where, kind: p.kind, severity: p.severity, hint: redactSecret(m[0]), count: m.length });
      });
    });
    var v = vaultStatus();
    if (!v.exists && findings.length) {
      findings.push({ where: 'الخزنة', kind: 'لا توجد خزنة مشفّرة', severity: 'medium', hint: 'استخدم زر «تشفير المفاتيح» في لوحة الاتصال.', count: 1 });
    }
    state.securityFindings = findings;
    logAudit('security_scan', 'sec-scout', 'Scan found ' + findings.length + ' potential exposure(s)', { count: findings.length });
    saveState();
    return { findings: findings, vault: v, scannedAt: nowIso() };
  }
  var DEV_PATCH_ALLOWED = ['freeOnly', 'useBenchmarks', 'qualityGate', 'benchmarkThreshold', 'mode', 'groqModel', 'openrouterModel'];
  function autoDeveloperUpdate() {
    var diagnostics = {
      quota: quotaSummary(),
      recentErrors: (state.auditLog || []).filter(function (x) { return /error|fail|429|limit/i.test(String(x.eventType) + String(x.summary)); }).slice(0, 5),
      benchmarks: benchmarkReport().slice(0, 5),
      quality: (state.qualityReports || []).slice(0, 3)
    };
    return aiGenerate({
      agentId: 'dev-auto',
      extraContext: 'تشخيص تلقائي من المتصفح (لا ترسل أي مفتاح أو سر):\n' + JSON.stringify(diagnostics).slice(0, 2500),
      messages: [{ role: 'user', text: 'اقترح إصلاحاً تلقائياً آمناً أو صرّح بعدم وجود إصلاح، وفق صيغة [DEV_PATCH] المعتمدة.' }]
    }).then(function (r) {
      var patches = [];
      var clean = String(r.text || '').replace(/\[DEV_PATCH\s+target="([^"]+)"\s+value="([^"]+)"\]([\s\S]*?)\[\/DEV_PATCH\]/gi, function (_, target, value, desc) {
        patches.push({ target: String(target).trim(), value: String(value).trim(), description: String(desc || '').trim() });
        return '';
      });
      var applied = [];
      patches.forEach(function (p) {
        if (DEV_PATCH_ALLOWED.indexOf(p.target) === -1) return;
        if (['freeOnly', 'useBenchmarks', 'qualityGate'].indexOf(p.target) !== -1) {
          if (!/^(true|false)$/i.test(p.value)) return;
          settings[p.target] = p.value.toLowerCase() === 'true';
        } else if (p.target === 'benchmarkThreshold') {
          var n = num(p.value, NaN);
          if (!isFinite(n) || n < 40 || n > 95) return;
          settings[p.target] = Math.round(n);
        } else if (p.target === 'mode') {
          if (['auto', 'local', 'zen', 'groq', 'openrouter', 'demo'].indexOf(p.value) === -1) return;
          settings[p.target] = p.value;
        } else {
          if (!/^[A-Za-z0-9_.:/-]{1,120}$/.test(p.value)) return;
          settings[p.target] = p.value;
        }
        applied.push({ target: p.target, value: settings[p.target] === true || settings[p.target] === false ? String(settings[p.target]) : settings[p.target] });
      });
      if (applied.length) {
        saveSettings();
        awardPoints('dev-auto', 10, 'تطبيق تحديث تلقائي آمن');
        logAudit('auto_dev_patch', 'dev-auto', 'Applied ' + applied.length + ' safe setting patch(es)', { applied: applied });
      }
      return { ok: true, mode: r.mode, patches: patches, applied: applied, text: clean.trim() || String(r.text || '') };
    });
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
    /* Every other approval source (votes, HR, tasks, workflows) is gated too.
       processProposals already ran the gate and sets _skipQuality. */
    if (settings.qualityGate && !data._skipQuality) {
      qualityGate(item.agentId, item).then(function (qa) {
        item.quality = qa;
        if (qa.status === 'flagged') {
          /* A quality objection is a review note, not automatically a
             high-risk action. Only genuinely sensitive actions get the gate. */
          if (item.risk === 'high') {
            item.securityNote = '🚫 حلقة الجودة رفضت هذا المقترح — لا يُنفَّذ إلا بتأكيد صريح من المدير.';
          } else {
            item.risk = 'medium';
            item.securityNote = '🔎 حلقة الجودة طلبت مراجعة إضافية — المقترح متوسط الخطورة وليس عالي الخطورة.';
          }
        }
        saveState();
      }).catch(function () { /* gate failure is recorded in qualityReports */ });
    }
    return item;
  }

  /* No proposal reaches the CEO's approval queue before the department's
     monitor → auditor → corrector gate has finished. */
  function processProposals(agentId, agentName, agentAvatar, requests) {
    return Promise.all((requests || []).map(function (r) {
      if (r._type === 'memo') {
        var target = getAgent(r.toId);
        state.internalMemos.push({ id: 'memo-' + uuid().slice(0, 8), fromId: agentId, fromName: agentName, fromAvatar: agentAvatar, toId: r.toId, toName: target ? target.name : r.toId, toAvatar: target ? target.avatar : '🤖', subject: r.subject, body: r.body, timestamp: nowIso(), read: false });
        logAudit('internal_memo', agentId, 'Memo to ' + r.toId + ': ' + r.subject);
        return Promise.resolve(null);
      }
      return qualityGate(agentId, r).then(function (qa) {
        var payload = Object.assign({ agentId: agentId, agentName: agentName }, r, { _skipQuality: true });
        var corrected = qa.correction ? qa.correction : (qa.findings && qa.findings[0] ? qa.findings[0] : '');
        if (corrected) payload.details = String(payload.details || '') + '\n\n🔎 تقرير الجودة:\n' + String(corrected).slice(0, 700);
        if (qa.status === 'flagged' && payload.risk === 'high') payload.risk = 'high';
        var item = addApproval(payload);
        item.quality = qa;
        if (qa.status === 'flagged') {
          item.securityNote = item.risk === 'high'
            ? '🚫 حلقة الجودة رفضت هذا المقترح — لا يُنفَّذ إلا بتأكيد صريح من المدير.'
            : '🔎 حلقة الجودة طلبت مراجعة إضافية — المقترح متوسط الخطورة وليس عالي الخطورة.';
          if (item.risk === 'high') telegramNotify('🚫 *حلقة الجودة ترفض مقترحاً*\n' + item.title + '\n' + String(corrected).slice(0, 300));
        }
        return item;
      });
    })).catch(function (e) { console.warn('quality gate failed', e); return []; });
  }

  /* ── Telegram / WhatsApp relay (no token in the page) ─────────────────── */
  function messagingAuthOk() {
    var A = window.MDM1Auth;
    return !A || !A.configured() || A.canSend();
  }
  function authRequiredNotice() {
    showToast('👤 سجّل الدخول من زر «الحساب» (وأدخل رمز TOTP إن كان مفعّلاً) لتفعيل الإرسال والمزامنة.', 'err');
  }
  function authStatusLine() {
    var A = window.MDM1Auth;
    if (!A || !A.configured()) return '⚠️ تسجيل الدخول غير مهيّأ في هذا النشر.';
    var s = A.status();
    if (s.loading) return '⏳ جارٍ استعادة جلسة الحساب...';
    if (s.error) return '⚠️ ' + s.error;
    if (!s.signedIn) return '👤 لا يوجد حساب مرتبط — اضغط «تسجيل الدخول / الحساب».';
    if (s.requiresTotp) return '🔐 مطلوب رمز TOTP لتفعيل الإرسال والمزامنة.';
    return '✅ الحساب مرتبط' + (s.email ? ' — ' + esc(s.email) : '') +
      (s.verifiedFactors ? ' · ثنائي مفعّل' : ' · أضف TOTP اختيارياً من نافذة الحساب');
  }
  function renderAuthStatus() {
    var el = document.getElementById('ocAuthStatus');
    if (!el) return;
    el.textContent = authStatusLine();
    el.className = 'office-status' + (messagingAuthOk() && window.MDM1Auth && window.MDM1Auth.status().signedIn ? ' ok' : '');
  }
  function relaySend(text, channel, chatId, waTo) {
    var body = {
      text: String(text || '').slice(0, 4000),
      channel: channel || 'telegram',
      chatId: chatId || undefined,
      to: waTo || undefined,
      secret: secret('relaySecret') || undefined
    };
    if (!body.text) return Promise.resolve({ ok: false, error: 'الرسالة فارغة.' });
    if (!settings.relayUrl) return Promise.resolve({ ok: false, error: 'أدخل Supabase Relay URL في لوحة الاتصال.' });
    if (!messagingAuthOk()) { authRequiredNotice(); return Promise.resolve({ ok: false, error: 'identity required' }); }
    var relayHeaders = { 'content-type': 'application/json', 'x-office-secret': secret('relaySecret') || '' };
    var relayAnon = (CFG.messaging && CFG.messaging.anonKey) || '';
    if (relayAnon) { relayHeaders.authorization = 'Bearer ' + relayAnon; relayHeaders.apikey = relayAnon; }
    return nativeFetch(settings.relayUrl, {
      method: 'POST',
      headers: relayHeaders,
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) { return safeJson(t, {}); }).then(function (j) {
        if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      });
    });
  }
  function telegramNotify(text) {
    state.telegramOutbox.unshift({ id: uuid(), text: text, createdAt: nowIso(), sent: false });
    state.telegramOutbox = state.telegramOutbox.slice(0, 30);
    saveState();
    if (settings.relayUrl) relaySend(text, 'telegram', settings.telegramChatId, '').catch(function () { /* queued above */ });
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
  function localSolutions(query) {
    var text = String(query || '').toLowerCase().replace(/[أإآ]/g, 'ا');
    var out = [];
    function add(rx, s) { if (rx.test(text) && out.indexOf(s) === -1) out.push(s); }
    add(/تسعير|سعر|pricing/, 'قارن ثلاثة نماذج تسعير (شهري / حزمة / لكل مستخدم) مع جدول حساسية سعرية.');
    add(/امان|امن|security|صلاحيه|بيانات/, 'قائمة تحقق أمنية: أقل صلاحيات، تشفير، سجلات تدقيق، واختبار اختراق قبل النشر.');
    add(/قانون|ضريبه|ضريبة|امتثال|عقد|compliance/, 'اعرض البنود الحرجة على المستشار القانوني والمحاسب القانوني قبل أي توقيع أو نشر.');
    add(/ميزانيه|ميزانية|تكلفه|تكلفة|ربح|budget/, 'جهّز ثلاث سيناريوهات تكلفة (منخفض / متوسط / مرتفع) ونقطة التعادل.');
    add(/سوق|منافس|فرص|بحث|market/, 'اصنع مصفوفة مقارنة لثلاثة منافسين واستخرج ثلاث فرص قابلة للتنفيذ.');
    add(/منتج|تطبيق|موقع|saas/, 'حدّد عرض القيمة، تجربة مجانية، ومسار إطلاق أسبوعي بمخرجات قابلة للمراجعة.');
    if (!out.length) out.push('قسّم المهمة إلى ثلاث خطوات: مخرج واضح، مالك مسؤول، وموعد زمني قابل للقياس.');
    out.push('اربط كل مسار بدور مسؤول، وأضفه للوحة الموافقات إذا كانت المخاطر عالية.');
    return out.slice(0, 4);
  }

  function shortSearchQuery(q) {
    var raw = String(q || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase();
    var stop = /^(في|من|على|الي|إلى|مع|عن|قبل|بعد|هذا|هذه|التي|الذي|كل|كان|كانت|أن|ان|او|أو|لكن|ثم|قد|ال)$/u;
    var words = raw.match(/[a-z0-9\u0600-\u06ff]+/gu) || [];
    var picked = words.filter(function (w) { return w.length > 2 && !stop.test(w); }).slice(0, 4);
    return (picked.length ? picked : words.slice(0, 4)).join(' ');
  }

  function englishSearchQuery(q) {
    var t = String(q || '').toLowerCase();
    var map = [
      [/ساس|saas/, 'SaaS pricing strategy'],
      [/تسعير|سعر/, 'pricing strategy'],
      [/امان|امن|صلاحيه/, 'application security checklist'],
      [/قانون|ضريبه|ضريبة|امتثال/, 'legal compliance checklist'],
      [/ميزانيه|ميزانية|تكلفه|تكلفة/, 'startup budget forecasting'],
      [/سوق|منافس|فرص/, 'market research competitors']
    ];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(t)) return map[i][1];
    return '';
  }

  function wikiSearch(lang, query) {
    var fetcher = nativeFetch || (window.fetch ? window.fetch.bind(window) : null);
    if (!fetcher) return Promise.resolve({ engine: 'unavailable', results: [] });
    var url = 'https://' + lang + '.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
      encodeURIComponent(query) + '&gsrlimit=5&prop=extracts&exintro=1&explaintext=1&exchars=240&format=json&origin=*';
    return fetcher(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var pages = Object.keys((j.query && j.query.pages) || {}).map(function (k) { return j.query.pages[k]; });
      var results = pages.map(function (p) {
        return {
          title: p.title || query,
          snippet: String(p.extract || '').slice(0, 240),
          url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(String(p.title || query).replace(/\s+/g, '_'))
        };
      });
      return { engine: lang === 'ar' ? 'Wikipedia (ar)' : 'Wikipedia (en)', results: results.slice(0, 5) };
    }).catch(function () { return { engine: 'unavailable', results: [] }; });
  }

  function ddgSearch(query) {
    var fetcher = nativeFetch || (window.fetch ? window.fetch.bind(window) : null);
    if (!fetcher) return Promise.resolve({ engine: 'unavailable', results: [] });
    var url = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1';
    return fetcher(url, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var results = [];
      if (j.AbstractText) results.push({ title: j.Heading || query, snippet: j.AbstractText, url: j.AbstractURL || '' });
      (j.RelatedTopics || []).slice(0, 5).forEach(function (t) {
        if (t.Text && t.FirstURL) results.push({ title: t.Text.slice(0, 80), snippet: t.Text, url: t.FirstURL });
      });
      return { engine: results.length ? 'DuckDuckGo' : 'unavailable', results: results.slice(0, 5) };
    }).catch(function () { return { engine: 'unavailable', results: [] }; });
  }

  function webSearch(query) {
    var q = String(query || '').trim();
    if (!q) return Promise.resolve({ engine: 'none', results: [] });
    var queries = [];
    [englishSearchQuery(q), shortSearchQuery(q), q].forEach(function (x) {
      x = String(x || '').trim();
      if (x && queries.indexOf(x) === -1) queries.push(x);
    });
    if (!queries.length) queries = [q];
    var i = 0;
    function next() {
      if (i >= queries.length) return Promise.resolve({ engine: 'knowledge', results: [], suggestions: localSolutions(q) });
      var query = queries[i++];
      var latin = /^[a-z0-9\s-]+$/i.test(query);
      return wikiSearch(latin ? 'en' : 'ar', query).then(function (r) {
        return r.results.length ? r : wikiSearch(latin ? 'ar' : 'en', englishSearchQuery(query) || query);
      }).then(function (r) {
        return r.results.length ? r : ddgSearch(query);
      }).then(function (r) {
        return r.results.length ? r : next();
      }).catch(function () { return next(); });
    }
    return next();
  }

  /* ── request ledger: every ask, understood or not, with real execution ── */
  var REQUEST_ACTION_RX = /(أريد|اريد|أبغى|ابغى|عايز|عيز|بغيت|ودّي|ودي|أنفّذ|نفّذ|نفذ|اعمل|إعمل|سوي|سوّي|جهّز|جاهز|اكتب|حلّل|حلل|ابحث|دوّر|دور|فتّش|فتش|أنشئ|انشئ|أطلق|اطلق|أرسل|ارسل|انشر|ادفع|راجع|افحص|قارن|لخّص|لخص|عدّل|عدل|حدّث|حدث|أضف|أزل|احذف|استخرج|صدّر|احسب|خطّط|خطط|افهم|فهم)/iu;
  var REQUEST_OUTPUT_RX = /(تقرير|خطة|مخطط|منتج|تطبيق|موقع|صفحة|حملة|إعلان|عقد|اتفاقية|جدول|ميزانية|بحث|دراسة|تحليل|مراجعة|تقييم|مسودة|اقتراح|قائمة|نموذج|نظام|بوت|محتوى|رسالة|إشعار|تذكرة|حل|خطوات)/iu;
  var REQUEST_HIGH_RX = /(دفع\s|تحويل\s|مصروف|توقيع\s+عقد|إبرام\s+عقد|نشر\s+عام|نشر\s+خارجي|منح\s+صلاحية|تغيير\s+صلاحية|صلاحيات\s+جديدة|بيانات\s+سرية|حذف\s+بيانات|ربط\s+خارجي|webhook|api\s*key)/iu;
  var REQUEST_NEGATION_RX = /(?:مش|مو|ليس|لا|غير|بدون|عادي|مجرد)/iu;

  /* A phrase like "مش حملة نشر عام" is a clarification, not a dangerous
     order. Remove negated clauses before risk classification. */
  function stripNegated(text) {
    return String(text || '')
      .replace(/(?:مش|مو|ليس|لا|غير|بدون)\s+[^.؛;،,!?؟\n]+/giu, ' ')
      .trim();
  }

  function uniqueStrings(list) {
    var out = [];
    (list || []).forEach(function (x) {
      x = String(x || '').trim();
      if (x && out.indexOf(x) === -1) out.push(x);
    });
    return out;
  }

  function routeRequestAgent(text) {
    var t = normalizeDialect(text).normalized.toLowerCase();
    if (/قانون|عقد|ضريبه|ضريبة|امتثال|خصوصيه|خصوصية/.test(t)) return 'legal-advisor';
    if (/مال|ميزانيه|ميزانية|فاتوره|فاتورة|تكلفه|تكلفة|سعر|ربح|دفع/.test(t)) return 'accountant';
    if (/تسويق|اعلان|إعلان|حمله|حملة|عميل|crm/.test(t)) return 'marketing-lead';
    if (/بحث|سوق|منافس|فرص|مصادر/.test(t)) return 'web-research-team';
    if (/امان|امن|صلاحيه|صلاحية|بيانات|حمايه|حماية/.test(t)) return 'security-officer';
    if (/توظيف|فريق|تدريب|kpi|ضغط/.test(t)) return 'hr-manager';
    if (/كود|تطبيق|موقع|منصه|منصة|api|ساندبوكس|تطوير/.test(t)) return 'auditors-experts-devs';
    return 'executive-assistant';
  }

  function parseRequestItems(raw) {
    var original = String(raw || '').trim();
    var d = normalizeDialect(original);
    var norm = String(d.normalized || '').trim();
    var parts = original.split(/[.!?؟؛;\n]+|\s+و\s+/u).map(function (x) { return String(x || '').trim(); }).filter(function (x) { return x.length > 3; });
    if (!parts.length) parts = [original];
    var items = [];
    var constraints = [];
    parts.forEach(function (part) {
      var nd = normalizeDialect(part).normalized.replace(/^(?:ثم|بس|لكن|أو|او|فـ|ف)\s+/u, '').trim();
      var actionable = REQUEST_ACTION_RX.test(nd) || REQUEST_OUTPUT_RX.test(nd);
      var clarification = !actionable && REQUEST_NEGATION_RX.test(nd);
      var text = nd.replace(/^(?:أريد|اريد|أبغى|ابغى|عايز|عيز|بغيت|ودّي|ودي|أنفّذ|نفّذ|نفذ|اعمل|إعمل|سوي|سوّي)\s+/iu, '').trim() || nd;
      var riskText = stripNegated(nd);
      if (clarification) constraints.push('توضيح: ' + String(text).slice(0, 120));
      items.push({
        id: 'ri-' + uuid().slice(0, 6),
        text: String(text).slice(0, 240),
        status: actionable || clarification ? 'understood' : 'unclear',
        reason: clarification ? 'توضيح/قيد — لا يحتاج مهمة منفصلة.' : (actionable ? '' : 'لم أحدد فعلاً أو مخرجاً واضحاً في هذا الجزء.'),
        agentId: routeRequestAgent(nd),
        risk: REQUEST_HIGH_RX.test(riskText) ? 'high' : (/مال|ميزانيه|ميزانية|تكلفه|تكلفة|سعر|ربح|فاتوره|فاتورة/.test(riskText) ? 'medium' : 'low'),
        taskId: null,
        approvalId: null,
        result: clarification ? 'توضيح مفهوم — لا يُنفَّذ كأمر منفصل' : null,
        clarification: clarification === true
      });
    });
    var money = original.match(/(?:\$|usd|دولار|جنيه|ريال)\s*([0-9]+(?:[.,][0-9]+)?)/iu);
    if (money) constraints.push('الميزانية/الرقم: ' + money[0]);
    var time = original.match(/(خلال\s+(?:[0-9]+\s*)?(?:يوم|ايام|أسبوع|اسابيع|اسبوع|شهر|اشهر|شهور)|بكره|بكرا|غدا|الآن|دلوقتي)/iu);
    if (time) constraints.push('الإطار الزمني: ' + time[0]);
    var audience = original.match(/(للشركات|للعملاء|للأفراد|b2b|b2c|للموظفين)/iu);
    if (audience) constraints.push('الجمهور: ' + audience[0]);

    var unresolved = [];
    if (!items.some(function (x) { return x.status === 'understood'; })) unresolved.push('ما المخرج أو الإجراء المطلوب بالضبط؟');
    items.filter(function (x) { return x.status === 'unclear'; }).slice(0, 3).forEach(function (x) { unresolved.push('ماذا تريد من «' + x.text + '» تحديداً؟'); });
    if (/(ميزانيه|ميزانية|تكلفه|تكلفة|سعر|دفع)/iu.test(norm) && !money) unresolved.push('ما الميزانية القصوى أو الرقم المعتمد؟');
    if (/(خلال|بكره|بكرا|غدا|موعد|جدول)/iu.test(norm) && !time) unresolved.push('ما الموعد النهائي المطلوب؟');
    if (/(منتج|تطبيق|موقع|حمله|حملة)/iu.test(norm) && !audience) unresolved.push('من هو الجمهور المستهدف؟');
    if (/(هذا|كده|كذا|هيك|ذلك|اللي|التي|المادة|الشيء)/iu.test(norm)) unresolved.push('ما المقصود بالإشارة في الطلب؟');

    return { original: original, normalized: norm, items: items.slice(0, 10), constraints: constraints, unresolved: uniqueStrings(unresolved).slice(0, 5) };
  }

  function findLedgerEntry(id) {
    var found = null;
    (state.requestLedger || []).some(function (x) {
      if (x.id === id) { found = x; return true; }
      return false;
    });
    return found;
  }

  function recordRequestLedger(source, raw, opts) {
    opts = opts || {};
    var parsed = parseRequestItems(raw);
    var entry = {
      id: 'req-' + uuid().slice(0, 8),
      source: source,
      agentId: opts.agentId || null,
      agentName: opts.agentName || '',
      original: parsed.original,
      normalized: parsed.normalized,
      items: parsed.items,
      constraints: parsed.constraints,
      unresolved: parsed.unresolved,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      executed: false,
      executionSummary: '',
      mode: opts.mode || null,
      model: opts.model || null,
      warning: opts.warning || null,
      acknowledged: false
    };
    if (!Array.isArray(state.requestLedger)) state.requestLedger = [];
    state.requestLedger.unshift(entry);
    state.requestLedger = state.requestLedger.slice(0, 40);
    logAudit('request_understood', opts.agentId || 'ceo', 'Parsed ' + entry.items.length + ' request item(s) (' + source + ')', { id: entry.id, unclear: entry.unresolved.length });
    saveState();
    return entry;
  }

  function executeLedgerEntry(id) {
    var e = findLedgerEntry(id);
    if (!e) return Promise.resolve('');
    if (e.executed) return Promise.resolve(e.executionSummary || '');
    var done = [], approvals = [], unclear = [];
    (e.items || []).forEach(function (item) {
      if (item.clarification === true) { return; }
      if (item.status !== 'understood') { unclear.push(item.text); return; }
      var ag = getAgent(item.agentId) || getAgent('executive-assistant');
      if (!ag) return;
      if (item.risk === 'high') {
        var ap = addApproval({
          agentId: ag.id, agentName: ag.name, title: String(item.text).slice(0, 110),
          details: String(item.text) + '\n\nطلب صريح من المدير عبر الشات.',
          risk: 'high', actionType: 'request_execution',
          payload: { ledgerId: e.id, ledgerItemId: item.id }, _skipQuality: true
        });
        item.status = 'needs_approval';
        item.approvalId = ap.id;
        item.result = 'بانتظار موافقة صريحة (override)';
        approvals.push(ag.name + ': ' + String(item.text).slice(0, 70));
      } else {
        var task = {
          id: 'tsk-' + uuid().slice(0, 8), agentId: ag.id,
          title: String(item.text).slice(0, 110),
          description: String(item.text) + '\n\nمصدر الطلب: ' + e.source,
          status: 'working', createdAt: nowIso(),
          ledgerId: e.id, ledgerItemId: item.id
        };
        state.tasks.unshift(task);
        state.liveBubbles[ag.id] = 'مهمة جديدة: ' + String(item.text).slice(0, 34);
        recomputeStatus(ag.id);
        awardPoints(ag.id, 5, 'تنفيذ طلب المدير من الشات');
        item.status = 'executed';
        item.taskId = task.id;
        item.result = 'تم إنشاء مهمة لدى ' + ag.name;
        done.push(ag.name + ': ' + String(item.text).slice(0, 70));
      }
    });
    var lines = [];
    if (done.length) lines.push('✅ تم التنفيذ فعلياً: ' + done.join('؛ '));
    if (approvals.length) lines.push('🛡️ حوّلت للوحة المخاطر العالية (لا تُنفَّذ بلا تجاوز صريح): ' + approvals.join('؛ '));
    if (unclear.length) lines.push('❓ لم أفهم هذه الطلبات بعد: ' + unclear.join('؛ '));
    if ((e.unresolved || []).length) lines.push('❓ أسئلة توضيحية: ' + e.unresolved.slice(0, 3).join('؛ '));
    e.executionSummary = lines.join('\n');
    e.executed = true;
    e.updatedAt = nowIso();
    logAudit('request_executed', e.agentId || 'ceo', 'Executed ' + done.length + ' request item(s), ' + approvals.length + ' approval(s)', { id: e.id });
    saveState();
    return Promise.resolve(e.executionSummary);
  }

  /* ── advanced smart assistant (dialect → understanding → roles) ───────── */
  var assistantSession = null;

  var DIALECT_RULES = [
    [/\b(أبغى|ابغى|عايز|عيز|أريد|اريد|بغيت|ودّي|ودي|أبغاك|ابغاك)\b/gu, 'أريد'],
    [/\b(شيف|شوف|إعمل|اعمل|سوي|سوّي|نفّذ|نفذ)\b/gu, 'أنفّذ'],
    [/\b(بكره|بكرا|غدا)\b/gu, 'غداً'],
    [/\b(دلوقتي|دلوقت|هلوقتي|الآن)\b/gu, 'الآن'],
    [/\b(مزبون|زبون|عميل|كليانت)\b/gu, 'عميل'],
    [/\b(فلوس|فلاوس|مال|مصاريف)\b/gu, 'ميزانية'],
    [/\b(شغل|وظيفة|مهمة|task)\b/gu, 'مهمة'],
    [/\b(مفيش|مافي|ما عندي|مش عندي)\b/gu, 'لا يوجد'],
    [/\b(كده|كذا|هيك|هكذا)\b/gu, 'هكذا'],
    [/\b(قريب|قريبا|سريع|بسرعة|بالسرعة)\b/gu, 'بسرعة'],
    [/\b(اتصل|اتصلت|تواصل|راسل)\b/gu, 'تواصل'],
    [/\b(دوّر|دور|ابحث|ابحت|فتّش)\b/gu, 'ابحث']
  ];

  function normalizeDialect(message) {
    var raw = String(message || '').trim();
    var out = raw;
    var changes = [];
    DIALECT_RULES.forEach(function (rule) {
      if (rule[0].test(out)) { out = out.replace(rule[0], rule[1]); changes.push(rule[1]); }
    });
    out = out.replace(/[أإآ]/gu, 'ا').replace(/ة(?=\s|$)/gu, 'ه');
    return { raw: raw, normalized: out, changes: changes };
  }

  function jsonFromText(text) {
    var s = String(text || '').replace(/```(?:json)?/gi, '').trim();
    var start = s.indexOf('{'), end = s.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    return safeJson(s.slice(start, end + 1), null);
  }

  function fallbackUnderstanding(raw, norm) {
    var lower = String(norm || '').toLowerCase();
    var scope = 'عام — يحتاج تحديد نطاق أدق';
    if (/ساس|saas|منتج|تطبيق|موقع|متجر/i.test(lower)) scope = 'إطلاق منتج أو خدمة رقمية';
    else if (/تسويق|حمله|اعلان|إعلان|عميل|crm/i.test(lower)) scope = 'تسويق ونمو العملاء';
    else if (/مالي|محاسب|فاتوره|تكلفه|ربح|ضريبه/i.test(lower)) scope = 'مالية ومحاسبة';
    else if (/قانون|عقد|امتثال|خصوصيه|ضرائب/i.test(lower)) scope = 'الشؤون القانونية والامتثال';
    else if (/امان|امن|صلاحيه|بيانات/i.test(lower)) scope = 'الأمان وحماية البيانات';

    var deliverables = [];
    [/تقرير/g, /خطه|خطة/g, /منتج|تطبيق|موقع|صفحه/g, /حمله|حملة/g, /عقد|اتفاقيه/g, /جدول/g, /ميزانيه|ميزانية/g].forEach(function (rx) {
      var m = lower.match(rx); if (m && deliverables.indexOf(m[0]) === -1) deliverables.push(m[0]);
    });
    if (!deliverables.length) deliverables = ['مخرج قابل للمراجعة'];

    var constraints = [];
    var money = raw.match(/(?:\$|usd|دولار|جنيه|ريال)\s*([0-9]+(?:[.,][0-9]+)?)/i);
    if (money) constraints.push('ميزانية أو رقم مذكور: ' + money[0]);
    var time = raw.match(/(خلال\s+[0-9]+\s*(يوم|ايام|أسبوع|اسابيع|شهر|اشهر)|بكره|بكرا|غدا|الآن)/i);
    if (time) constraints.push('الإطار الزمني: ' + time[0]);

    var risks = [];
    if (/دفع|جات|تحويل|مصروف/i.test(lower)) risks.push('أي دفع مالي يحتاج موافقة صريحة');
    if (/نشر|اعلان|حمله/i.test(lower)) risks.push('النشر الخارجي يحتاج مراجعة مالية وقانونية');
    if (/عقد|قانون|ضريبه|خصوصيه/i.test(lower)) risks.push('مراجعة المستشار القانوني والمحاسب القانوني إلزامية');
    if (/بيانات|صلاحيه|امان/i.test(lower)) risks.push('مراجعة مسؤول الأمان قبل منح صلاحيات جديدة');

    var ambiguities = [];
    if (!money) ambiguities.push('ما هي الميزانية القصوى المسموح بها؟');
    if (!time) ambiguities.push('ما الموعد النهائي أو الإطار الزمني المتوقع؟');
    if (/منتج|تطبيق|موقع|حمله/i.test(lower) && !/للشركات|للعملاء|للأفراد|b2b|b2c/i.test(lower)) ambiguities.push('من هو الجمهور المستهدف بالضبط؟');

    return {
      goal: String(raw).slice(0, 240) || 'لم يُحدد الهدف بوضوح',
      scope: scope,
      deliverables: deliverables.join('، '),
      constraints: constraints,
      risks: risks,
      ambiguities: ambiguities,
      suggestions: [
        'أقترح benchmark مجاني لكل نموذج قبل تعيينه على الدور.',
        'أقترح تمرير كل مقترح عبر حلقة الجودة (مراقب ← مدقق ← مصحح).',
        'أقترح عرض خطة الأدوار عليك قبل إنشاء أي مهمة.'
      ],
      judgment: ambiguities.length ? 'الطلب مفهوم جزئياً؛ الأسئلة أعلاه ترفع دقة التنفيذ.' : 'الطلب واضح بما يكفي للانتقال لمرحلة البحث والتوزيع.',
      keywords: words(lower).slice(0, 18)
    };
  }

  function understandRequest(message) {
    var d = normalizeDialect(message);
    var prompt = 'الطلب الأصلي:\n' + d.raw + '\n\nالصيغة الموحّدة للهجة:\n' + d.normalized +
      '\n\nالتعليمات: افهم اللهجة العربية جيداً (مصرية، خليجية، شامية، مغربية، فصحى). لا تُنفّذ أي شيء الآن. أعد JSON صالحاً فقط بالشكل:' +
      '\n{"goal":"...","scope":"...","deliverables":"...","constraints":["..."],"risks":["..."],"ambiguities":["..."],"suggestions":["..."],"judgment":"..."}' +
      '\nاجعل الأسئلة في ambiguities عملية ومحددة، وأضف اقتراحاً واحداً على الأقل.';
    return aiGenerate({
      agentId: 'executive-assistant',
      systemPrompt: 'أنت محلل طلبات تنفيذي لشركة AI. تفهم اللهجات العربية وتعرض ما فهمته قبل أي تنفيذ. لا تستخدم أدوات ولا تنفذ أوامر. أعد JSON فقط.',
      messages: [{ role: 'user', text: prompt }]
    }).then(function (r) {
      var parsed = jsonFromText(r.text);
      var fb = fallbackUnderstanding(d.raw, d.normalized);
      if (!parsed) return { understanding: fb, mode: r.mode, normalized: d.normalized, changes: d.changes, live: r.mode === 'live' };
      var arr = function (k) { return Array.isArray(parsed[k]) ? parsed[k].map(String).slice(0, 6) : fb[k]; };
      var u = {
        goal: String(parsed.goal || fb.goal).slice(0, 400),
        scope: String(parsed.scope || fb.scope).slice(0, 300),
        deliverables: String(parsed.deliverables || fb.deliverables).slice(0, 400),
        constraints: arr('constraints'),
        risks: arr('risks'),
        ambiguities: arr('ambiguities'),
        suggestions: arr('suggestions'),
        judgment: String(parsed.judgment || fb.judgment).slice(0, 400),
        keywords: words(d.normalized).slice(0, 18)
      };
      if (!u.ambiguities.length && d.changes.length === 0) u.ambiguities = ['هل هناك قيد مالي أو زمني يجب أن ألتزم به؟'];
      return { understanding: u, mode: r.mode, normalized: d.normalized, changes: d.changes, live: r.mode === 'live' };
    });
  }

  function hardTasksFor(u, raw) {
    var text = [u.goal, u.scope, u.deliverables, raw].filter(Boolean).join('، ');
    var parts = String(text).split(/[،,؛;\n]+|\s+و\s+/).map(function (x) { return String(x).trim(); }).filter(function (x) { return x.length > 8; });
    var hardRx = /(بحث|دراسه|دراسة|منافس|تسعير|سعر|قانون|ضريبه|ضريبة|امتثال|امان|امن|تقني|api|منصه|منصة|سوق|تكلفه|تكلفة|ميزانيه|ميزانية|عقد|حمايه|حماية)/i;
    var picks = parts.filter(function (x) { return hardRx.test(x); }).slice(0, 4);
    if (!picks.length && hardRx.test(String(raw || ''))) picks = [String(raw).slice(0, 180)];
    return picks;
  }

  function researchHardTasks(tasks) {
    if (!tasks || !tasks.length) return Promise.resolve([]);
    return Promise.all(tasks.map(function (t) {
      return webSearch(t).then(function (r) {
        var engine = r && r.engine ? r.engine : 'unavailable';
        var solutions = (r && Array.isArray(r.suggestions) ? r.suggestions : []).map(String).slice(0, 4);
        if (!solutions.length) solutions = localSolutions(t);
        var note = engine === 'knowledge'
          ? 'لا يوجد بحث حي متاح — مسارات الحل أدناه مقترحة من المعرفة المحلية وليست مصدراً حياً.'
          : engine === 'unavailable'
            ? 'تعذّر البحث الحي؛ أعددت مسارات حل مقترحة بدلاً من ادّعاء نتيجة.'
            : 'بحث حي';
        return {
          task: t,
          engine: engine,
          note: note,
          solutions: solutions,
          results: (r && r.results ? r.results : []).slice(0, 4).map(function (x) {
            return { title: String(x.title || ''), url: String(x.url || ''), snippet: String(x.snippet || '').slice(0, 160) };
          })
        };
      }).catch(function (e) {
        return { task: t, engine: 'unavailable', note: String(e && e.message || 'تعذّر البحث'), solutions: localSolutions(t), results: [] };
      });
    }));
  }

  function distributeRoles(u, research) {
    var byAgent = {};
    var riskFlag = REQUEST_HIGH_RX.test([u.goal, u.deliverables, (u.risks || []).join(' ')].join(' '));
    var title = String(u.deliverables || u.goal || 'مهمة جديدة').split(/[،,]/)[0].trim().slice(0, 110) || 'تنفيذ طلب المدير';
    var researchLine = (research || []).map(function (r) { return r.task + ' (' + r.engine + ')'; }).slice(0, 3).join('؛ ');

    function add(agentId, reason, risk, suffix) {
      var ag = getAgent(agentId); if (!ag) return;
      if (!byAgent[agentId]) byAgent[agentId] = { agentId: agentId, agentName: ag.name, avatar: ag.avatar, taskTitle: title, details: [], reason: reason, risk: risk || 'medium' };
      if (suffix && byAgent[agentId].details.indexOf(suffix) === -1) byAgent[agentId].details.push(suffix);
    }

    var text = [u.goal, u.scope, u.deliverables, (u.keywords || []).join(' ')].join(' ').toLowerCase();
    add('executive-assistant', 'تنسيق عام ومتابعة التنفيذ', 'low', 'إعداد جدول متابعة وتلخيص الحالة للمدير.');
    if (/قانون|عقد|امتثال|خصوصيه|ضرائب/.test(text)) {
      add('legal-advisor', 'مراجعة العقود والامتثال', riskFlag ? 'high' : 'medium', 'مراجعة البنود القانونية وسياسة الخصوصية.');
      add('legal-accountant', 'الأثر الضريبي والمحاسبي', 'medium', 'مراجعة الضرائب والفواتير وتصنيف الإيرادات.');
    }
    if (/مالي|محاسب|فاتوره|تكلفه|ربح|ميزانيه/.test(text)) add('accountant', 'مراجعة التكاليف والعائد', 'medium', 'إعداد ميزانية وتقرير تكلفة/عائد.');
    if (/تسويق|اعلان|حمله|عميل|نمو/.test(text)) add('marketing-lead', 'بناء الحملة ورسائل العملاء', riskFlag ? 'high' : 'medium', 'جهّز خطة خطاب تسويقي قابلة للمراجعة.');
    if (/بحث|سوق|منافس|فرص|saas/.test(text)) add('web-research-team', 'بحث السوق والفرص', 'low', 'جمع مصادر حية وتلخيص 3 فرص قابلة للتنفيذ.');
    if (/تقني|تطبيق|موقع|منصه|api|ساندبوكس|كود/.test(text)) add('auditors-experts-devs', 'الجدوى والتنفيذ التقني', 'medium', 'تدقيق معماري وتنفيذ آمن ضمن بيئة الاختبار.');
    if (/امان|امن|صلاحيه|بيانات/.test(text)) add('security-officer', 'مراجعة المخاطر والصلاحيات', riskFlag ? 'high' : 'medium', 'إصدار رأي أمني قبل أي نشر أو ربط خارجي.');
    if (/توظيف|فريق|تدريب|kpi|ضغط/.test(text)) add('hr-manager', 'توزيع العمل ومراقبة الضغط', 'low', 'التحقق من جاهزية الفريق.');
    if (researchLine) add('web-research-team', 'دعم البحث الحي', 'low', 'مصادر البحث: ' + researchLine);

    /* Keep the working team small and explainable. QA trios review approvals
       rather than appearing as extra "working" employees on every request. */
    var priority = ['executive-assistant'];
    if (/تقني|تطبيق|موقع|منصه|منصة|api|ساندبوكس|كود|saas/.test(text)) priority.push('auditors-experts-devs');
    if (/بحث|سوق|منافس|فرص/.test(text) || researchLine) priority.push('web-research-team');
    if (/مالي|محاسب|فاتوره|تكلفه|ربح|ميزانيه/.test(text)) priority.push('accountant');
    if (/تسويق|اعلان|حمله|عميل|نمو/.test(text)) priority.push('marketing-lead');
    if (/قانون|عقد|امتثال|خصوصيه|ضرائب/.test(text)) priority.push('legal-advisor');
    if (/امان|امن|صلاحيه|بيانات/.test(text)) priority.push('security-officer');
    if (/توظيف|فريق|تدريب|kpi|ضغط/.test(text)) priority.push('hr-manager');
    var ordered = [];
    priority.forEach(function (id) { if (byAgent[id] && ordered.indexOf(id) === -1) ordered.push(id); });
    Object.keys(byAgent).forEach(function (id) { if (ordered.indexOf(id) === -1) ordered.push(id); });

    return ordered.slice(0, 5).map(function (id) {
      var x = byAgent[id];
      var qa = getQaTeam(id);
      var reviewers = qa ? Object.keys(qa).map(function (k) { return qa[k]; }) : [];
      return {
        agentId: x.agentId, agentName: x.agentName, avatar: x.avatar,
        taskTitle: x.taskTitle,
        details: x.details.join(' ') + (reviewers.length ? ' مراجعة الجودة: ' + reviewers.join('، ') + '.' : ''),
        reason: x.reason, risk: x.risk, reviewers: reviewers
      };
    });
  }

  function createAssistantSession(message) {
    var raw = String(message || '').trim();
    if (!raw) return Promise.reject(new Error('اكتب طلباً أولاً'));
    return understandRequest(raw).then(function (res) {
      var u = res.understanding;
      var ledger = recordRequestLedger('assistant', raw, { agentName: 'المساعد الذكي' });
      ledger.unresolved = uniqueStrings((ledger.unresolved || []).concat(u.ambiguities || [])).slice(0, 6);
      ledger.mode = res.mode;
      ledger.normalized = res.normalized;
      saveState();
      var questions = ledger.unresolved.slice(0, 4);
      if (!questions.length) questions = ['هل تريد تنفيذ الخطة فور اعتمادك أم مراجعة إضافية؟'];
      var confidence = Math.max(35, Math.min(98, (res.live ? 86 : 63) - ledger.unresolved.length * 7 + (u.goal ? 5 : 0)));
      var session = {
        id: 'asst-' + uuid().slice(0, 8),
        original: raw,
        normalized: res.normalized,
        understanding: u,
        confidence: confidence,
        mode: res.mode,
        status: 'awaiting_confirmation',
        ledgerId: ledger.id,
        items: ledger.items,
        unresolved: ledger.unresolved,
        questions: questions,
        confirmationText: 'هذا ما فهمته من طلبك. أؤكد أنني فهمت المطلوب قبل أي تنفيذ.',
        research: [],
        plan: [],
        result: '',
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      assistantSession = session;
      logAudit('assistant_understanding', 'ceo', 'Assistant understood request (' + res.mode + '): ' + raw.slice(0, 80), { sessionId: session.id });
      saveState();
      return clone(session);
    });
  }

  function confirmAssistant(id, confirmed, answer) {
    var s = assistantSession;
    if (!s || s.id !== id) return Promise.reject(new Error('جلسة المساعد غير موجودة'));
    if (!confirmed) {
      var extra = String(answer || '').trim();
      if (!extra) return Promise.resolve(clone(s));
      return createAssistantSession(s.original + '\n\nتعديل المدير: ' + extra);
    }
    if (s.status !== 'awaiting_confirmation') return Promise.resolve(clone(s));
    return researchHardTasks(hardTasksFor(s.understanding, s.original)).then(function (research) {
      s.research = research;
      s.plan = distributeRoles(s.understanding, research);
      s.status = 'awaiting_execution';
      s.updatedAt = nowIso();
      var led = findLedgerEntry(s.ledgerId);
      if (led) {
        led.acknowledged = true;
        led.items.forEach(function (x) {
          if (x.status === 'unclear') { x.status = 'understood'; x.result = 'أقرّ المدير بالفهم رغم الغموض.'; }
        });
        led.updatedAt = nowIso();
      }
      assistantSession = s;
      logAudit('assistant_plan_ready', 'ceo', 'Assistant distributed ' + s.plan.length + ' roles after confirmation', { sessionId: s.id });
      saveState();
      return clone(s);
    });
  }

  function cancelAssistant(id) {
    if (!assistantSession || assistantSession.id !== id) return Promise.reject(new Error('جلسة المساعد غير موجودة'));
    assistantSession.status = 'cancelled';
    assistantSession.updatedAt = nowIso();
    var cancelledLedger = findLedgerEntry(assistantSession.ledgerId);
    if (cancelledLedger) { cancelledLedger.executionSummary = 'تم إلغاء الجلسة — لم تُنفَّذ المهام.'; cancelledLedger.updatedAt = nowIso(); }
    logAudit('assistant_cancelled', 'ceo', 'Assistant session cancelled', { sessionId: id });
    saveState();
    return Promise.resolve(clone(assistantSession));
  }

  function executeAssistant(id) {
    var s = assistantSession;
    if (!s || s.id !== id) return Promise.reject(new Error('جلسة المساعد غير موجودة'));
    if (s.status !== 'awaiting_execution') return Promise.reject(new Error('يجب تأكيد الفهم أولاً قبل التنفيذ'));
    (s.plan || []).forEach(function (p) {
      state.tasks.unshift({ id: 'tsk-' + uuid().slice(0, 8), agentId: p.agentId, title: p.taskTitle, description: p.details + '\n\nالسبب: ' + p.reason, status: 'working', createdAt: nowIso(), ledgerId: s.ledgerId });
      state.liveBubbles[p.agentId] = 'خطة المساعد: ' + String(p.taskTitle).slice(0, 34);
      recomputeStatus(p.agentId);
      awardPoints(p.agentId, 8, 'تنفيذ خطة المساعد الذكي');
      if (p.risk === 'high') {
        var item = addApproval({
          agentId: p.agentId, agentName: p.agentName, title: 'موافقة صريحة: ' + p.taskTitle,
          details: p.details || p.reason, risk: 'high', actionType: 'assistant_plan',
          payload: { assistantSessionId: s.id, ledgerId: s.ledgerId }
        });
        item.securityNote = '🛡️ مهمة عالية الخطورة من خطة المساعد — لا تُنفّذ إلا بتأكيد تجاوز صريح من لوحة المخاطر العالية.';
      }
    });
    var teamNames = (s.plan || []).map(function (p) { return p.agentName + ' (' + p.taskTitle + ')'; }).join('؛ ');
    state.teamChat.push({ id: uuid(), senderId: 'executive-assistant', senderName: 'السكرتيرة التنفيذية (المساعد الذكي 🧠)', senderAvatar: '🧠', role: 'assistant', text: 'تم اعتماد خطة المساعد وتوزيع ' + s.plan.length + ' مهمة على الأقسام بعد تأكيد فهم الطلب.\nالفريق العامل الآن: ' + teamNames + (s.research.length ? '\nتم استخدام بحث حي في ' + s.research.length + ' مهمة صعبة.' : ''), timestamp: nowIso() });
    s.status = 'done';
    s.result = '✅ تم إنشاء ' + s.plan.length + ' مهمة وتوزيعها على ' + s.plan.length + ' دور.\nالفريق العامل الآن: ' + teamNames + '\nحلقة الجودة تراجع أي موافقة قبل تنفيذها، والمهام عالية الخطورة تنتقل للوحة الموافقات الصريحة.';
    s.updatedAt = nowIso();
    var doneLedger = findLedgerEntry(s.ledgerId);
    if (doneLedger) {
      doneLedger.executed = true;
      doneLedger.executionSummary = s.result;
      doneLedger.updatedAt = nowIso();
      (doneLedger.items || []).forEach(function (x) {
        x.status = 'executed';
        x.result = 'دخل في خطة المساعد الذكي';
      });
    }
    assistantSession = s;
    logAudit('assistant_plan_executed', 'ceo', 'Assistant plan executed: ' + s.plan.length + ' tasks', { sessionId: s.id });
    saveState();
    return Promise.resolve(clone(s));
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

  function importSnapshot(record, passphrase) {
    if (!record || !record.iv || !record.data || record.alg !== 'AES-256-GCM') {
      return Promise.reject(new Error('ملف النسخة غير صالح أو غير مشفّر بـ AES-256-GCM'));
    }
    return deriveKey(passphrase).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(record.iv) }, key, unb64(record.data));
    }).then(function (plain) {
      var payload = JSON.parse(new TextDecoder().decode(plain));
      if (!payload || typeof payload !== 'object') throw new Error('محتوى النسخة غير مقروء');
      var rec = {
        id: record.id && /^snap-[A-Za-z0-9-]+$/.test(record.id) ? record.id : 'snap-' + uuid().slice(0, 8),
        label: String(record.label || (payload.__snapshot && payload.__snapshot.label) || 'نسخة مستوردة'),
        alg: 'AES-256-GCM',
        fileCount: num(record.fileCount, 1),
        size: num(record.size, 0) || String(record.data || '').length,
        createdAt: record.createdAt || nowIso(),
        iv: record.iv,
        data: record.data
      };
      var snaps = readLS(LS_SNAPS, []);
      if (!snaps.some(function (s) { return s.id === rec.id; })) snaps.unshift(rec);
      snaps = snaps.slice(0, 5);
      writeLS(LS_SNAPS, snaps);
      state.snapshots = snaps.map(function (s) { return { id: s.id, label: s.label, alg: s.alg, fileCount: s.fileCount, size: s.size, createdAt: s.createdAt }; });
      logAudit('snapshot_imported', 'ceo', 'Imported and verified encrypted snapshot ' + rec.id);
      saveState();
      return rec;
    }).catch(function (e) {
      var detail = String((e && e.message) || '').trim() || 'فك التشفير غير صالح';
      throw new Error('فشل التحقق من كلمة المرور أو الملف: ' + detail);
    });
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
    return Promise.all([listLocalModels(), listZenModels(), listGroqModels(), listOpenRouterModels(), listCloudModels()]).then(function (results) {
      var local = results[0], zen = results[1], groq = results[2], or = results[3], cloud = results[4];
      var mode = currentMode();
      var listing = mode === 'cloud' ? cloud : mode === 'zen' ? zen : mode === 'groq' ? groq : mode === 'openrouter' ? or : local;
      var free = listing.free || [];
      var allIds = (listing.models || []).map(function (m) { return m.id; });
      if (!allIds.length && (mode === 'local' || mode === 'zen')) allIds = providerFallbacks(mode).slice();
      assignments = roleAssignments(allIds.length ? allIds : providerFallbacks(mode), mode === 'cloud' ? 'cloud' : mode === 'groq' ? 'groq' : mode === 'openrouter' ? 'openrouter' : mode);
      /* A public model listing (OpenRouter works without a key) is NOT the
         same as a usable chat connection. Require credentials before showing
         agents as connected; otherwise the bulbs lie about live replies. */
      var connected = mode === 'demo' ? false : (listing.connected && providerConfigured(mode));
      var modelLabel = settings.modelOverrides['*'] || (free[0] || (mode === 'groq' ? settings.groqModel : mode === 'openrouter' ? settings.openrouterModel : 'demo'));
      var agents = allAgents().map(function (a) {
        var g = ensureProfile(a.id);
        return Object.assign({}, a, {
          status: !connected ? 'offline' : (state.agentStatuses[a.id] || a.status || 'available'),
          bubble: state.liveBubbles[a.id] || '',
          gamification: g,
          memoryCount: (state.memories[a.id] || []).length,
          assignedModel: assignments[a.id] || null
        });
      });
      return {
        providerConfig: { provider: mode, model: modelLabel, hasKey: connected, baseUrl: mode === 'cloud' ? settings.relayUrl : (local.base || settings.localUrl) },
        providerStatus: {
          provider: mode,
          model: modelLabel,
          hasKey: connected,
          cloud: { connected: cloud.connected, baseUrl: settings.relayUrl, error: cloud.error, freeModels: cloud.free.length, defaultProvider: cloud.defaultProvider, providers: cloud.providers },
          local: { connected: local.connected, baseUrl: local.base || settings.localUrl, bridgeUrl: settings.localBridgeUrl, error: local.error, modelCount: local.models.length },
          zen: { connected: zen.connected, error: zen.error, modelCount: zen.models.length },
          groq: { connected: groq.connected, error: groq.error, freeModels: groq.free.length },
          openrouter: { connected: or.connected, error: or.error, freeModels: or.free.length },
          freeModels: free,
          quota: quotaSummary(),
          quality: { enabled: settings.qualityGate, reports: num(state.qualityReports && state.qualityReports.length, 0), lastStatus: (state.qualityReports && state.qualityReports[0] && state.qualityReports[0].status) || null },
          benchmarks: benchmarkReport().slice(0, 200),
          vault: vaultStatus(),
          sync: { enabled: syncConfigured(), version: settings.syncVersion || 0 },
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

  function healthCheck() {
    return Promise.all([
      listCloudModels(true), listLocalModels(true), listZenModels(true), listGroqModels(true), listOpenRouterModels(true)
    ]).then(function (r) {
      var mode = currentMode();
      var listing = mode === 'cloud' ? r[0] : mode === 'local' ? r[1] : mode === 'zen' ? r[2] : mode === 'groq' ? r[3] : mode === 'openrouter' ? r[4] : null;
      var connected = mode === 'demo' ? false : Boolean(listing && listing.connected && providerConfigured(mode));
      var auth = window.MDM1Auth && typeof window.MDM1Auth.status === 'function' ? window.MDM1Auth.status() : { signedIn: false };
      var vault = vaultStatus();
      var sec = securityScan();
      var q = quotaSummary();
      var providers = {
        cloud: { connected: Boolean(r[0].connected), error: r[0].error || null, freeModels: (r[0].free || []).length },
        local: { connected: Boolean(r[1].connected), error: r[1].error || null, models: (r[1].models || []).length },
        zen: { connected: Boolean(r[2].connected), error: r[2].error || null, models: (r[2].models || []).length },
        groq: { connected: Boolean(r[3].connected), error: r[3].error || null, freeModels: (r[3].free || []).length },
        openrouter: { connected: Boolean(r[4].connected), error: r[4].error || null, freeModels: (r[4].free || []).length }
      };
      var lines = [
        connected ? '🟢 النموذج الحي: متصل (' + mode + ')' : '🔴 النموذج الحي: غير متصل — الردود ستكون تجريبية/بديلة ومُسمّدة بوضوح.',
        '👤 الحساب: ' + authStatusLine(),
        '🔐 الخزنة: ' + (vault.enabled ? 'مفعّلة' : 'غير مفعّلة') + (vault.locked === false ? ' — مفتوحة' : ''),
        '🛡️ فحص الأمان: ' + (sec && Array.isArray(sec.findings) ? sec.findings.length + ' ملاحظة' : 'تم'),
        '📊 الحصة: ' + (q && q.requests != null ? q.requests + ' طلب' : 'لا توجد بيانات'),
        '☁️ السحابة: ' + (providers.cloud.connected ? 'متصلة' : 'غير متصلة') + (providers.cloud.error ? ' — ' + providers.cloud.error : ''),
        '🏠 المحلي: ' + (providers.local.connected ? 'متصل' : 'غير متصل') + (providers.local.error ? ' — ' + providers.local.error : ''),
        '🔄 المزامنة: ' + (settings.syncEnabled && syncConfigured() ? 'مفعّلة' : 'معطّلة')
      ];
      return {
        connected: connected,
        mode: mode,
        providers: providers,
        auth: auth,
        vault: vault,
        security: sec,
        quota: q,
        report: lines.join('\n')
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
    var qi = path.indexOf('?');
    if (qi >= 0) {
      try {
        var params = new URLSearchParams(path.slice(qi + 1));
        if (params.has('q')) b.q = params.get('q');
      } catch (e) { /* ignore malformed query */ }
      path = path.slice(0, qi);
    }

    if (method === 'GET' && path === '/api/bootstrap') {
      return buildBootstrap().then(function (d) { return jsonResponse(d); });
    }
    if (method === 'GET' && path === '/api/models') {
      return Promise.all([listLocalModels(true), listZenModels(true), listGroqModels(true), listOpenRouterModels(true), listCloudModels(true)]).then(function (r) {
        var mode = currentMode();
        var listing = mode === 'cloud' ? r[4] : mode === 'zen' ? r[1] : mode === 'groq' ? r[2] : mode === 'openrouter' ? r[3] : r[0];
        var ids = (listing.models || []).map(function (x) { return x.id; });
        return jsonResponse({
          connected: listing.connected,
          baseUrl: listing.base || settings.localUrl,
          error: listing.error,
          models: listing.models,
          freeModels: listing.free,
          providers: {
            cloud: { connected: r[4].connected, freeModels: r[4].free.length, error: r[4].error, defaultProvider: r[4].defaultProvider },
            local: { connected: r[0].connected, freeModels: r[0].free.length },
            zen: { connected: r[1].connected, freeModels: r[1].free.length },
            groq: { connected: r[2].connected, freeModels: r[2].free.length, error: r[2].error },
            openrouter: { connected: r[3].connected, freeModels: r[3].free.length, error: r[3].error }
          },
          assignments: roleAssignments(ids, mode),
          benchmarks: benchmarkReport(),
          trainings: trainingReport()
        });
      });
    }
    if (method === 'POST' && path === '/api/models/benchmark') {
      if (!b.provider || !b.model || !b.role) return Promise.resolve(jsonResponse({ error: 'provider, model and role are required' }, 400));
      return runBenchmark(b.provider, b.model, b.role).then(function (rec) { return jsonResponse(rec); });
    }
    if (method === 'POST' && path === '/api/models/train') {
      if (!b.provider || !b.model || !b.role) return Promise.resolve(jsonResponse({ error: 'provider, model and role are required' }, 400));
      return runTraining(b.provider, b.model, b.role).then(function (rec) { return jsonResponse(rec); });
    }
    if (method === 'POST' && path === '/api/models/auto-assign') {
      var assigned = assignQualifiedModels();
      saveSettings();
      return Promise.resolve(jsonResponse({ assigned: assigned, roleModels: roleAssignments([], currentMode()) }));
    }
    if (method === 'GET' && path === '/api/quality/report') {
      return Promise.resolve(jsonResponse({ enabled: settings.qualityGate, reports: state.qualityReports.slice(0, 100), benchmarks: benchmarkReport(), trainings: trainingReport() }));
    }
    if (method === 'POST' && path === '/api/dev/auto-update') {
      return autoDeveloperUpdate().then(function (r) { return jsonResponse(r); });
    }
    if (method === 'POST' && path === '/api/security/scan') {
      return Promise.resolve(jsonResponse(securityScan()));
    }
    if (method === 'POST' && path === '/api/security/encrypt') {
      return encryptSecrets(b.passphrase).then(function (r) { return jsonResponse(r); });
    }
    if (method === 'POST' && path === '/api/security/unlock') {
      return unlockVault(b.passphrase).then(function (r) { return jsonResponse(r); });
    }

    if (method === 'POST' && path === '/api/health/check') {
      return healthCheck().then(function (r) { return jsonResponse(r); }).catch(function (e) { return jsonResponse({ error: e.message }, 500); });
    }
    if (method === 'GET' && path === '/api/audit/search') {
      var q = String(b.q || '').trim().toLowerCase();
      var entries = !q ? state.auditLog.slice(0, 250) : state.auditLog.filter(function (e) {
        return [e.eventType, e.actor, e.summary, JSON.stringify(e.meta || {})].join(' ').toLowerCase().indexOf(q) !== -1;
      }).slice(0, 250);
      return Promise.resolve(jsonResponse({ query: q, count: entries.length, entries: entries }));
    }
    if (method === 'POST' && path === '/api/snapshots/import') {
      return importSnapshot(b.record, b.passphrase).then(function (rec) {
        return jsonResponse({ message: 'تم استيراد النسخة ' + rec.id + ' والتحقق من تشفيرها.', snapshot: { id: rec.id, label: rec.label, alg: rec.alg, createdAt: rec.createdAt } }, 201);
      }).catch(function (e) { return jsonResponse({ error: e.message }, 400); });
    }

    if (method === 'GET' && path === '/api/assistant/session') {
      return Promise.resolve(jsonResponse({ session: assistantSession ? clone(assistantSession) : null }));
    }
    if (method === 'POST' && path === '/api/assistant/start') {
      return createAssistantSession(b.message).then(function (s) { return jsonResponse({ session: s }); }).catch(function (e) { return jsonResponse({ error: e.message }, 400); });
    }
    if (method === 'POST' && path === '/api/assistant/confirm') {
      if (!b.sessionId) return Promise.resolve(jsonResponse({ error: 'sessionId required' }, 400));
      return confirmAssistant(b.sessionId, b.confirmed === true, b.answer).then(function (s) { return jsonResponse({ session: s }); }).catch(function (e) { return jsonResponse({ error: e.message }, 400); });
    }
    if (method === 'POST' && path === '/api/assistant/cancel') {
      if (!b.sessionId) return Promise.resolve(jsonResponse({ error: 'sessionId required' }, 400));
      return cancelAssistant(b.sessionId).then(function (s) { return jsonResponse({ session: s }); }).catch(function (e) { return jsonResponse({ error: e.message }, 400); });
    }
    if (method === 'POST' && path === '/api/assistant/execute') {
      if (!b.sessionId) return Promise.resolve(jsonResponse({ error: 'sessionId required' }, 400));
      return executeAssistant(b.sessionId).then(function (s) { return jsonResponse({ session: s }); }).catch(function (e) { return jsonResponse({ error: e.message }, 409); });
    }

    if (method === 'POST' && path === '/api/chat/direct') {
      var agent = getAgent(b.agentId);
      if (!agent) return Promise.resolve(jsonResponse({ error: 'Agent not found' }, 404));
      if (!state.directChats[agent.id]) state.directChats[agent.id] = [];
      var userMsg = String(b.message || '').trim();
      if (!userMsg) return Promise.resolve(jsonResponse({ error: 'message required' }, 400));
      var memories = retrieveMemories(agent.id, userMsg, 4);
      var ledger = recordRequestLedger('direct', userMsg, { agentId: agent.id, agentName: agent.name });
      state.directChats[agent.id].push({ id: uuid(), role: 'user', text: userMsg, timestamp: nowIso() });
      indexMemory(agent.id, 'user', userMsg, 'direct');
      var memos = state.internalMemos.filter(function (x) { return x.toId === agent.id; }).slice(-3);
      var extra = memos.length ? 'مذكرات داخلية:\n' + memos.map(function (x) { return 'من ' + x.fromName + ': ' + x.subject + ' — ' + x.body; }).join('\n') : '';
      extra += '\n=== ما سيُنفَّذ تلقائياً بعد ردك ===\n' +
        (ledger.items || []).map(function (x) { return '- ' + x.text + ' → ' + x.agentId + ' (' + x.risk + ')'; }).join('\n') +
        '\nما لم يفهمه النظام: ' + ((ledger.unresolved || []).join('؛ ') || 'لا يوجد');
      var history = state.directChats[agent.id].slice(-12);
      return aiGenerate({ agentId: agent.id, messages: history, memories: memories, extraContext: extra }).then(function (r) {
        return executeLedgerEntry(ledger.id).then(function (summary) {
          ledger.mode = r.mode; ledger.model = r.model; ledger.warning = r.warning || null;
          recordUsage(agent.id, r.usage);
          var ex = extractProposals(r.text);
          var replyText = String(ex.cleanText || r.text || '').trim() + (summary ? '\n\n' + summary : '');
          var assistantMsg = { id: uuid(), role: 'assistant', text: replyText, mode: r.mode, model: r.model, ragUsed: memories.length, ledgerId: ledger.id, timestamp: nowIso() };
          state.directChats[agent.id].push(assistantMsg);
          indexMemory(agent.id, 'assistant', replyText, 'direct');
          state.liveBubbles[agent.id] = replyText.slice(0, 42) + '...';
          awardPoints(agent.id, 5, 'إنجاز محادثة');
          processProposals(agent.id, agent.name, agent.avatar, ex.requests);
          recomputeStatus(agent.id);
          hrWorkloadCheck();
          logAudit('direct_chat', agent.id, 'Chat (' + (r.usage ? r.usage.totalTokens : 0) + ' tok)', { mode: r.mode, model: r.model, ledgerId: ledger.id });
          saveState();
          return jsonResponse({ reply: assistantMsg, ragUsed: memories.length, warning: r.warning || null, ledger: clone(ledger) });
        });
      });
    }

    if (method === 'POST' && path === '/api/chat/team') {
      var message = String(b.message || '').trim();
      if (!message) return Promise.resolve(jsonResponse({ error: 'message required' }, 400));
      var ids = Array.isArray(b.attendeeIds) && b.attendeeIds.length ? b.attendeeIds : ['executive-assistant', 'hr-manager', 'auditors-experts-devs'];
      var attendees = allAgents().filter(function (a) { return ids.indexOf(a.id) !== -1; });
      var ledger = recordRequestLedger('team', message, { agentName: 'الاجتماع الجماعي' });
      state.meetingActive = true;
      state.meetingAttendees = attendees.map(function (a) { return a.id; });
      state.teamChat.push({ id: uuid(), senderId: 'ceo', senderName: 'المدير التنفيذي (أنت)', senderAvatar: '👑', role: 'user', text: message, timestamp: nowIso() });
      var recent = state.teamChat.slice(-8).map(function (x) { return x.senderName + ': ' + x.text; }).join('\n');
      var teamContext = 'أنت في اجتماع جماعي (Stand-up). أجب باختصار (2-4 أسطر). لا تكرر التحية، وابدأ بمساهمة عملية محددة.\n' +
        '=== ما سيُنفَّذ تلقائياً ===\n' +
        (ledger.items || []).map(function (x) { return '- ' + x.text + ' → ' + x.agentId + ' (' + x.risk + ')'; }).join('\n') +
        '\nما لم يفهمه النظام: ' + ((ledger.unresolved || []).join('؛ ') || 'لا يوجد');
      return Promise.all(attendees.map(function (a) {
        return aiGenerate({ agentId: a.id, extraContext: teamContext, messages: [{ role: 'user', text: 'سياق:\n' + recent + '\n\nتوجيه المدير: ' + message }] }).then(function (r) { return { agent: a, r: r }; });
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
        return executeLedgerEntry(ledger.id).then(function (summary) {
          if (summary) state.teamChat.push({ id: uuid(), senderId: 'executive-assistant', senderName: 'المساعد الذكي 🧠', senderAvatar: '🧠', role: 'assistant', text: summary, timestamp: nowIso() });
          logAudit('team_meeting', 'ceo', 'Stand-up with ' + attendees.length + ' agents', { ledgerId: ledger.id });
          saveState();
          return jsonResponse({ ok: true, ledger: clone(ledger) });
        });
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
      var needsOverride = item.risk === 'high';
      if (b.decision === 'approved' && needsOverride && b.override !== true) {
        return Promise.resolve(jsonResponse({ error: 'هذا الإجراء عالي الخطورة أو مرفوض من حلقة الجودة. أرسل override=true من لوحة المخاطر العالية لتنفيذه على مسؤوليتك.', risk: item.risk, quality: item.quality }, 409));
      }
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
      logAudit('approval_' + b.decision, 'ui', b.decision.toUpperCase() + ': ' + item.title + (b.override === true ? ' (override=true)' : ''), { id: item.id, risk: item.risk, override: b.override === true });
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

    if (method === 'POST' && path === '/api/memos/read') {
      var ids = Array.isArray(b.ids) && b.ids.length ? b.ids : (b.id ? [b.id] : (b.all ? (state.internalMemos || []).map(function (m) { return m.id; }) : []));
      if (!ids.length) return Promise.resolve(jsonResponse({ error: 'id, ids or all required' }, 400));
      return Promise.resolve(jsonResponse({ ok: true, unread: markMemosRead(ids) }));
    }

    if (method === 'POST' && path === '/api/memos') {
      var from = getAgent(b.fromId), to = getAgent(b.toId);
      if (!from || !to || !b.subject) return Promise.resolve(jsonResponse({ error: 'fromId, toId, subject required' }, 400));
      var memo = { id: 'memo-' + uuid().slice(0, 8), fromId: from.id, fromName: from.name, fromAvatar: from.avatar, toId: to.id, toName: to.name, toAvatar: to.avatar, subject: String(b.subject).trim(), body: String(b.body || '').trim(), timestamp: nowIso(), read: false };
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
          state.internalMemos.push({ id: 'memo-' + uuid().slice(0, 8), fromId: ag2.id, fromName: ag2.name, fromAvatar: ag2.avatar, toId: step.memoTo, toName: tgt ? tgt.name : step.memoTo, toAvatar: tgt ? tgt.avatar : '🤖', subject: prefix + (step.memoSubject || step.taskTitle), body: 'تم جدولة الخطوة ضمن قالب (' + pb.title + '): ' + (step.taskDesc || step.taskTitle), timestamp: nowIso(), read: false });
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
  function decodeTokenPayload(token) {
    var parts = String(token || '').trim().split('.');
    if (parts.length !== 2) return null;
    return safeJson(new TextDecoder().decode(b64urlToBytes(parts[0])), null);
  }
  function verifyToken(token) {
    if (!CFG.publicKeyJwk) return Promise.resolve(false);
    var parts = String(token || '').trim().split('.');
    if (parts.length !== 2) return Promise.resolve(false);
    var payloadBytes = b64urlToBytes(parts[0]);
    var sig = b64urlToBytes(parts[1]);
    if (sig.length !== 64) return Promise.resolve(false); // raw IEEE-P1363 r||s
    var p = decodeTokenPayload(token);
    if (!p || p.sub !== 'mdm1-office') return Promise.resolve(false);
    var chat = Number(p.chat);
    var iat = Number(p.iat), exp = Number(p.exp);
    if (!isFinite(chat) || chat <= 0) return Promise.resolve(false);
    if (!isFinite(iat) || !isFinite(exp) || exp <= iat) return Promise.resolve(false);
    var maxTtl = num(CFG.maxTokenTtlHours, 6) * 3600 * 1000;
    if (exp - iat > maxTtl) return Promise.resolve(false);
    var now = Date.now();
    if (now > exp + 60000 || now + 60000 < iat) return Promise.resolve(false);
    return crypto.subtle.importKey('jwk', CFG.publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
      .then(function (key) { return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, payloadBytes); })
      .catch(function () { return false; });
  }
  function sha256Hex(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  /* Signed tokens are short-lived but still replayable until `exp`. Remember
     their hashes in this browser so one leaked token cannot unlock twice. */
  var LS_USED_TOKENS = LS_UNLOCK + '_used';
  function usedTokenList() {
    var list = readLS(LS_USED_TOKENS, []);
    if (!Array.isArray(list)) list = [];
    return list.filter(function (x) { return x && Number(x.exp) > Date.now(); });
  }
  function consumeToken(token, exp) {
    return sha256Hex(token).then(function (h) {
      var list = usedTokenList();
      if (list.some(function (x) { return x.h === h; })) return false;
      list.push({ h: h, exp: Number(exp) || (Date.now() + 3600000) });
      writeLS(LS_USED_TOKENS, list.slice(-200));
      return true;
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
      (CFG.brandImage ? '<img class="office-brand-logo" src="' + esc(CFG.brandImage) + '" alt="MD1&#117;sd Company" />' : '<div class="office-lock-logo">🏢</div>') +
      '<h1>MD1&#117;sd Company — دخول خاص</h1>' +
      '<p class="office-lock-sub">هذه الصفحة غير مرتبطة بالقائمة. الدخول بكلمة السر أو بالرمز الموقّع من بوت تيليجرام.</p>' +
      '<label>كلمة السر</label><input id="officePassInput" type="password" placeholder="كلمة سر المكتب..." autocomplete="current-password" />' +
      '<button id="officePassBtn" class="office-btn primary">دخول</button>' +
      '<button id="officeGoogleBtn" class="office-btn" type="button">🔵 متابعة عبر Google</button>' +
      '<div class="office-lock-or">أو</div>' +
      '<label>رمز تيليجرام (Secret Token)</label><input id="officeTokenInput" type="text" placeholder="الصق الرمز الذي أرسله البوت..." />' +
      '<button id="officeTokenBtn" class="office-btn">تحقق من الرمز</button>' +
      '<button id="officeInstallBtn" class="office-btn install-app-btn" type="button">💻 تثبيت التطبيق على الجهاز</button>' +
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
    var lockGoogle = overlay.querySelector('#officeGoogleBtn');
    if (lockGoogle) lockGoogle.onclick = function () {
      if (!window.MDM1Auth || !window.MDM1Auth.signInWithGoogle) { fail('وحدة الحساب غير محمّلة في هذه الصفحة.'); return; }
      Promise.resolve(window.MDM1Auth.signInWithGoogle()).catch(function (e) {
        fail('تعذر فتح Google: ' + e.message);
      });
    };
    overlay.querySelector('#officeTokenBtn').onclick = function () {
      var v = overlay.querySelector('#officeTokenInput').value;
      verifyToken(v).then(function (good) {
        if (!good) { fail('الرمز غير صالح أو منتهي (أو أُصدر بمفتاح قديم). اطلب رمزاً جديداً من البوت.'); return null; }
        var p = decodeTokenPayload(v) || {};
        return consumeToken(v, p.exp).then(function (fresh) {
          if (!fresh) { fail('هذا الرمز استُخدم بالفعل على هذا الجهاز. اطلب رمزاً جديداً.'); return null; }
          return p;
        });
      }).then(function (p) {
        if (!p) return;
        // Bind the unlocked session to the Telegram chat that requested the token.
        settings.telegramChatId = String(p.chat || '');
        saveSettings();
        var hours = Math.max(0.1, Math.min(num(CFG.maxTokenTtlHours, 6), (Number(p.exp) - Date.now()) / 3600000));
        unlockFor(hours);
        ok();
        showToast('🔐 تم الدخول برمز مرتبط بمحادثة تيليجرام #' + p.chat, 'ok');
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
      '#officeLock{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 50% 20%,#1b1608,#050403 70%);}',
      '.office-lock-card{width:min(440px,100%);background:rgba(17,15,11,.97);border:1px solid rgba(201,168,76,.45);border-radius:20px;padding:28px;box-shadow:0 30px 80px rgba(0,0,0,.65);color:#f2e6c8;font-family:Cairo,system-ui,sans-serif;text-align:right;}',
      '.office-lock-logo{font-size:44px;text-align:center;margin-bottom:6px;}',
      '.office-brand-logo{display:block;width:min(120px,32vw);max-height:96px;object-fit:contain;margin:0 auto 10px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.45);}',
      '.office-brand-card{display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;border:1px solid rgba(201,168,76,.3);background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(139,26,26,.12));margin-bottom:12px;}',
      '.office-brand-card img{width:64px;height:64px;object-fit:contain;border-radius:12px;flex:none;}',
      '.office-brand-card strong{display:block;color:#e8c96a;font-size:14px;}',
      '.office-brand-card span{display:block;color:#9aa3b2;font-size:11.5px;line-height:1.6;margin-top:3px;}',
      '.office-lock-card h1{font-size:21px;margin:0 0 6px;text-align:center;color:#e8c96a;}',
      '.office-lock-sub{font-size:12.5px;color:#9aa3b2;text-align:center;line-height:1.7;margin:0 0 18px;}',
      '.office-lock-card label{display:block;font-size:12px;color:#c9a84c;margin:12px 0 6px;}',
      '.office-lock-card input{width:100%;box-sizing:border-box;background:#0b0b0e;border:1px solid #2a2a33;border-radius:10px;padding:11px 13px;color:#eef2ff;font-family:inherit;font-size:14px;}',
      '.office-lock-card input:focus{outline:none;border-color:#c9a84c;box-shadow:0 0 0 3px rgba(201,168,76,.15);}',
      '.office-btn{width:100%;margin-top:9px;padding:11px;border-radius:10px;border:1px solid #3a3a46;background:#1a1a20;color:#eef2ff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;}',
      '.office-btn.primary{background:linear-gradient(135deg,#c9a84c,#8b6914);border:none;color:#0a0805;}',
      '.office-lock-or{text-align:center;color:#555;font-size:11px;margin:14px 0 2px;}',
      '.office-lock-msg{min-height:18px;margin-top:10px;font-size:12px;text-align:center;}',
      '.office-lock-msg.error{color:#ff8b8b;}.office-lock-msg.ok{color:#6ee7b7;}',
      '.office-lock-links{display:flex;gap:8px;justify-content:center;margin-top:14px;font-size:11px;color:#6b7280;}',
      '.office-lock-links a{color:#c9a84c;text-decoration:none;}',
      '#officeConnBtn{position:relative;}',
      '#officeQuotaBadge{font-size:11px;padding:5px 9px;border-radius:999px;white-space:nowrap;}',
      '.office-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99995;max-width:min(560px,90vw);padding:12px 18px;border-radius:12px;background:#141418;border:1px solid #c9a84c;color:#eef2ff;font-family:Cairo,system-ui,sans-serif;font-size:13px;line-height:1.7;box-shadow:0 18px 50px rgba(0,0,0,.6);display:none;text-align:center;}',
      '.office-toast.err{border-color:#ff8b8b;color:#ffc7c7;}.office-toast.ok{border-color:#6ee7b7;color:#bff6dc;}',
      '.office-status.quota{font-size:11.5px;max-height:180px;overflow:auto;white-space:pre-wrap;}',
      '.office-modal{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);}',
      '.office-modal-card{width:min(760px,100%);max-height:88vh;overflow:auto;background:#111114;border:1px solid rgba(201,168,76,.35);border-radius:18px;padding:22px;color:#eef2ff;font-family:Cairo,system-ui,sans-serif;direction:rtl;text-align:right;}',
      '.office-modal-card h2{font-size:18px;color:#e8c96a;margin:0 0 4px;}',
      '.office-modal-card p{font-size:12px;color:#9aa3b2;line-height:1.7;}',
      '.office-modal-card label{display:block;font-size:12px;color:#c9a84c;margin:12px 0 5px;}',
      '.office-modal-card input,.office-modal-card select,.office-modal-card textarea{width:100%;box-sizing:border-box;background:#0b0b0e;border:1px solid #2a2a33;border-radius:9px;padding:9px 11px;color:#eef2ff;font-family:inherit;font-size:13px;}',
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

  function openConnectionPanel(options) {
    if (document.getElementById('officeConnModal')) {
      applyConnectionFocus(options);
      return;
    }
    var modal = document.createElement('div');
    modal.id = 'officeConnModal';
    modal.className = 'office-modal';
    var agentOptions = allAgents().map(function (a) {
      return '<div class="office-model-row" data-agent="' + esc(a.id) + '"><span>' + a.avatar + ' ' + esc(a.name) + '</span><select data-model-for="' + esc(a.id) + '"></select></div>';
    }).join('');
    modal.innerHTML =
      '<div class="office-modal-card">' +
      '<h2>🔌 الاتصال بالنماذج وبوت تيليجرام</h2>' +
      (CFG.brandImage ? '<div class="office-brand-card"><img src="' + esc(CFG.brandImage) + '" alt="MD1&#117;sd Company" /><div><strong>MD1&#117;sd Company — AI Virtual Office</strong><span>صفحة خاصة لا تظهر في قائمة الموقع. كل البيانات والمفاتيح تبقى في متصفحك.</span></div></div>' : '') +
      '<p>اختر مزود النموذج. في الوضع السحابي تبقى مفاتيح النماذج في أسرار Supabase Edge ولا تُرسل إلى المتصفح؛ المتصفح يحتفظ فقط بسر الـ relay. النماذج المجانية فقط هي المسموح بها.</p>' +
      '<div class="office-grid2">' +
      '<div><label>المزود</label><select id="ocMode"><option value="auto">تلقائي (الأفضل المتاح)</option><option value="cloud">Supabase Cloud (مفاتيح على السيرفر)</option><option value="local">تطبيق OpenCode على هذا الجهاز</option><option value="zen">OpenCode Zen (سحابي)</option><option value="groq">Groq (مجاني/محدود الحصة)</option><option value="openrouter">OpenRouter (المجاني فقط)</option><option value="demo">تجريبي بدون نموذج</option></select></div>' +
      '<div><label>النماذج المجانية فقط</label><select id="ocFree"><option value="true">نعم — مجاني فقط</option><option value="false">لا — اسمح بالمدفوع</option></select></div>' +
      '</div>' +
      '<label>عنوان OpenCode المحلي</label><input id="ocLocalUrl" type="text" placeholder="http://127.0.0.1:28894" />' +
      '<label>جسر HTTPS المحلي (يعمل من mdm1.org — اختياري)</label><input id="ocBridge" type="text" placeholder="https://localhost:28895" />' +
      '<label>كلمة مرور خدمة OpenCode (من ~/.config/opencode/service.json)</label><input id="ocLocalPass" type="password" placeholder="الصق كلمة المرور..." />' +
      '<div class="office-grid2">' +
      '<div><label>مفتاح OpenCode Zen</label><input id="ocZenKey" type="password" placeholder="oc_..." /></div>' +
      '<div><label>عنوان Zen</label><input id="ocZenBase" type="text" /></div>' +
      '</div>' +
      '<div class="office-grid2">' +
      '<div><label>مفتاح Groq (اختياري)</label><input id="ocGroqKey" type="password" placeholder="gsk_..." /></div>' +
      '<div><label>عنوان Groq / النموذج المجاني</label><input id="ocGroqBase" type="text" /><input id="ocGroqModel" type="text" placeholder="llama-3.3-70b-versatile" style="margin-top:6px;" /></div>' +
      '</div>' +
      '<div class="office-grid2">' +
      '<div><label>مفتاح OpenRouter (اختياري)</label><input id="ocOrKey" type="password" placeholder="sk-or-..." /></div>' +
      '<div><label>موديل OpenRouter المجاني</label><input id="ocOrModel" type="text" placeholder="...:free" /></div>' +
      '</div>' +
      '<label>اسم بوت تيليجرام (بدون @)</label><input id="ocBot" type="text" placeholder="MD1_Office_bot" />' +
      '<div class="office-grid2">' +
      '<div><label>Supabase Relay URL (اختياري للإرسال التلقائي)</label><input id="ocRelay" type="text" placeholder="https://...supabase.co/functions/v1/office-relay" /></div>' +
      '<div><label>سر الـ Relay</label><input id="ocRelaySecret" type="password" /></div>' +
      '</div>' +
      '<div class="office-grid2">' +
      '<div><label>Supabase Sync URL (اختياري — حالة مشفّرة)</label><input id="ocSyncUrl" type="text" placeholder="https://...supabase.co/functions/v1/office-sync" /></div>' +
      '<div><label>سر المزامنة (يُحفظ في متصفحك فقط)</label><input id="ocSyncSecret" type="password" /></div>' +
      '</div>' +
      '<label>تفعيل المزامنة السحابية</label><select id="ocSyncEnabled"><option value="false">معطّلة — هذا الجهاز فقط</option><option value="true">مفعّلة — تشفير AES-256-GCM قبل الإرسال</option></select>' +
      '<div id="ocStatus" class="office-status">اضغط "اختبار الاتصال" لمعرفة النماذج المتاحة.</div>' +
      '<div id="ocQuota" class="office-status quota">📊 لم تُسجّل طلبات بعد.</div>' +
      '<label style="margin-top:16px;">🧪 مختبر النماذج — اختبار وتدريب قبل التعيين</label>' +
      '<p>اختبر النموذج على مهمة الدور، ثم درّبه بـ 3 تمارين ضبط توجيه (prompt calibration). النماذج التي تجتاز الاختبار فقط هي التي تُعيَّن تلقائياً. هذا لا يغيّر أوزان النموذج، بل يضبط طريقة توجيهه.</p>' +
      '<div class="office-grid2">' +
      '<div><label>المزود المراد اختباره</label><select id="ocLabProvider"><option value="cloud">Supabase Cloud (سحابي)</option><option value="local">OpenCode المحلي</option><option value="zen">OpenCode Zen</option><option value="groq">Groq (مجاني)</option><option value="openrouter">OpenRouter (مجاني)</option></select></div>' +
      '<div><label>الدور</label><select id="ocLabRole">' + allAgents().map(function (a) { return '<option value="' + esc(a.id) + '">' + a.avatar + ' ' + esc(a.name) + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<label>النموذج بالضبط</label><input id="ocLabModel" type="text" placeholder="اختر مزوداً لملء النموذج تلقائياً" />' +
      '<div class="office-actions"><button class="office-btn" id="ocLabTest">🧪 اختبار الكفاءة</button><button class="office-btn" id="ocLabTrain">🎓 تدريب/ضبط</button><button class="office-btn" id="ocLabAssign">✅ تعيين المؤهلين</button><button class="office-btn" id="ocLabReport">📋 النتائج</button></div>' +
      '<div id="ocLabOut" class="office-status quota">لم تُجرَّب أي نماذج بعد.</div>' +
      '<label style="margin-top:16px;">🛡️ باحث الأسرار والمطور التلقائي</label>' +
      '<p>يفحص الباحث الإعدادات والتخزين المحلي بحثاً عن مفاتيح مكشوفة ويعرضها مُعمّاة، ثم يشفّرها في خزنة AES-256-GCM بكلمة مرور تُدخلها أنت ولا تُحفظ. المطور التلقائي يقترح إصلاحات آمنة للإعدادات فقط.</p>' +
      '<label>كلمة مرور الخزنة (للتشفير أو فتح القفل بعد إعادة التحميل)</label><input id="ocVaultPass" type="password" placeholder="كلمة مرور الخزنة..." />' +
      '<div class="office-actions"><button class="office-btn" id="ocSecScan">🕵️ فحص المفاتيح</button><button class="office-btn" id="ocSecEncrypt">🔒 تشفير المفاتيح</button><button class="office-btn" id="ocSecUnlock">🔓 فتح الخزنة</button><button class="office-btn" id="ocDevUpdate">🧑‍💻 تحديث تلقائي آمن</button></div>' +
      '<div id="ocSecOut" class="office-status quota">🛡️ لم يُجرَ فحص أمني بعد.</div>' +
      '<label style="margin-top:16px;">توزيع الأدوار على النماذج</label>' +
      '<div id="ocModels">' + agentOptions + '</div>' +
      '<div class="office-actions"><button class="office-btn primary" id="ocSave">حفظ وإعادة الاتصال</button><button class="office-btn" id="ocTest">اختبار الاتصال</button><button class="office-btn" id="ocSyncPull">☁️ سحب الحالة</button><button class="office-btn" id="ocSyncPush">⬆️ رفع الحالة</button><button class="office-btn" id="ocClose">إغلاق</button></div>' +
      '<label style="margin-top:18px;">🔐 رابط السر عبر تيليجرام</label>' +
      '<p>أنشئ رمزاً وأرسله للبوت. سيرد البوت برمز موقّع يفتح الصفحة لمدة 6 ساعات كحد أقصى ويرتبط بمحادثتك.</p>' +
      '<div class="office-token-box"><input id="ocSecretLink" type="text" readonly placeholder="اضغط إنشاء" /><button class="office-btn" id="ocMakeSecret">إنشاء</button><button class="office-btn" id="ocCopySecret">نسخ</button></div>' +
      '<label style="margin-top:14px;">📤 صندوق رسائل تيليجرام (آخر 30)</label>' +
      '<div class="office-outbox" id="ocOutbox"></div>' +
      '<div class="office-actions"><button class="office-btn" id="ocShareLast">إرسال آخر رسالة عبر تيليجرام</button><button class="office-btn" id="ocClearOutbox">تفريغ الصندوق</button></div>' +
      '<label style="margin-top:18px;">📨 إرسال رسالة (واتساب / تيليجرام)</label>' +
      '<p>يُرسل عبر Supabase Edge Relay. المطلوب: تسجيل الدخول بحساب Google أو الإيميل، وتفعيل TOTP اختيارياً، ثم إدخال سر الـ relay في الأعلى.</p>' +
      '<div id="ocAuthStatus" class="office-status">جارٍ قراءة حالة الحساب...</div>' +
      '<div class="office-grid2">' +
      '<div><label>القناة</label><select id="ocMsgChannel"><option value="telegram">تيليجرام</option><option value="whatsapp">واتساب</option><option value="both">الاثنان معاً</option></select></div>' +
      '<div><label>رقم واتساب (مع رمز الدولة)</label><input id="ocWaTo" type="tel" placeholder="9665xxxxxxxx" /></div>' +
      '</div>' +
      '<label>نص الرسالة</label><textarea id="ocMsgText" rows="3" placeholder="اكتب رسالتك هنا..."></textarea>' +
      '<div class="office-actions"><button class="office-btn" id="ocOpenAuth">👤 تسجيل الدخول / الحساب</button><button class="office-btn primary" id="ocSendMsg">📤 إرسال</button></div>' +
      '<div id="ocMsgOut" class="office-status quota">لا توجد رسائل مرسلة بعد.</div>' +
      '</div>';
    document.body.appendChild(modal);

    var q = function (id) { return modal.querySelector('#' + id); };
    q('ocMode').value = settings.mode;
    q('ocFree').value = String(settings.freeOnly);
    q('ocLocalUrl').value = settings.localUrl;
    q('ocBridge').value = settings.localBridgeUrl;
    q('ocLocalPass').value = secret('localPassword');
    q('ocZenKey').value = secret('zenKey');
    q('ocZenBase').value = settings.zenBase;
    q('ocGroqKey').value = secret('groqKey');
    q('ocGroqBase').value = settings.groqBase;
    q('ocGroqModel').value = settings.groqModel;
    q('ocOrKey').value = secret('openrouterKey');
    q('ocOrModel').value = settings.openrouterModel;
    q('ocBot').value = settings.telegramBot;
    q('ocRelay').value = settings.relayUrl;
    q('ocRelaySecret').value = secret('relaySecret');
    q('ocWaTo').value = settings.whatsappTo || '';
    q('ocSyncUrl').value = settings.syncUrl;
    q('ocSyncSecret').value = secret('syncSecret');
    q('ocSyncEnabled').value = String(settings.syncEnabled);

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
      settings.localBridgeUrl = q('ocBridge').value.trim() || 'https://localhost:28895';
      settings.localPassword = q('ocLocalPass').value.trim();
      settings.zenKey = q('ocZenKey').value.trim();
      settings.zenBase = q('ocZenBase').value.trim() || 'https://opencode.ai/zen/v1';
      settings.groqKey = q('ocGroqKey').value.trim();
      settings.groqBase = q('ocGroqBase').value.trim() || 'https://api.groq.com/openai/v1';
      settings.groqModel = q('ocGroqModel').value.trim() || 'llama-3.3-70b-versatile';
      settings.openrouterKey = q('ocOrKey').value.trim();
      settings.openrouterModel = q('ocOrModel').value.trim() || 'baidu/ernie-5.5-flash-preview:free';
      settings.telegramBot = q('ocBot').value.trim().replace(/^@/, '');
      settings.relayUrl = q('ocRelay').value.trim();
      settings.relaySecret = q('ocRelaySecret').value.trim();
      settings.whatsappTo = q('ocWaTo').value.trim();
      settings.syncUrl = q('ocSyncUrl').value.trim();
      settings.syncSecret = q('ocSyncSecret').value.trim();
      settings.syncEnabled = q('ocSyncEnabled').value === 'true';
      settings.modelOverrides = {};
      modal.querySelectorAll('select[data-model-for]').forEach(function (sel) {
        if (sel.value) settings.modelOverrides[sel.getAttribute('data-model-for')] = sel.value;
      });
      saveSettings();
      providerCache.cloud = null; providerCache.local = null; providerCache.zen = null;
      providerCache.groq = null; providerCache.openrouter = null;
    }

    function status(text, cls) {
      var el = q('ocStatus');
      el.textContent = text;
      el.className = 'office-status ' + (cls || '');
    }

    function renderQuota() {
      var lines = Object.keys(state.modelUsage || {}).map(function (k) {
        var u = state.modelUsage[k];
        var left = u.limitedUntil > Date.now() ? ' — محظور حتى ' + new Date(u.limitedUntil).toLocaleTimeString() : '';
        return k + ' → ' + num(u.calls, 0) + ' طلب / ' + num(u.tokens, 0) + ' tok' + left +
          (u.lastError ? '\n   ⚠️ ' + String(u.lastError).slice(0, 120) : '');
      });
      var syncLine = syncConfigured()
        ? '\n☁️ المزامنة مفعّلة — الإصدار ' + num(settings.syncVersion, 0)
        : '\n☁️ المزامنة معطّلة (هذا الجهاز فقط)';
      q('ocQuota').textContent = (lines.length ? lines.join('\n') : '📊 لم تُسجّل طلبات بعد.') + syncLine;
    }

    function test() {
      readForm();
      renderQuota();
      status('جارٍ فحص الاتصال...', '');
      Promise.all([listLocalModels(true), listZenModels(true), listGroqModels(true), listOpenRouterModels(true), listCloudModels(true)]).then(function (r) {
        var mode = currentMode();
        var listing = mode === 'cloud' ? r[4] : mode === 'zen' ? r[1] : mode === 'groq' ? r[2] : mode === 'openrouter' ? r[3] : r[0];
        if (mode === 'demo') { status('الوضع التجريبي مفعّل: الواجهة تعمل بدون نموذج.', 'ok'); fillModels([], []); return; }
        var providerLine = 'Supabase Cloud: ' + (r[4].connected ? 'متصل (' + r[4].free.length + ' مجاني)' : 'غير متصل') +
          ' · OpenCode: ' + (r[0].connected ? 'متصل' : 'غير متصل') +
          ' · Zen: ' + (r[1].connected ? 'متصل' : 'غير متصل') +
          ' · Groq: ' + (r[2].connected ? 'متصل (' + r[2].free.length + ' مجاني)' : 'غير متصل') +
          ' · OpenRouter: ' + (r[3].connected ? 'متصل (' + r[3].free.length + ' مجاني)' : 'غير متصل');
        if (!listing.connected) { status('غير متصل بالمزود المختار: ' + (listing.error || 'تحقق من العنوان/كلمة المرور/المفتاح.') + '\n' + providerLine, 'err'); fillModels([], []); return; }
        var free = listing.free || [];
        status('✅ متصل — ' + listing.models.length + ' نموذج، منها ' + free.length + ' مجاني.\n' +
          (free.length ? 'المجاني: ' + free.slice(0, 8).join(', ') + (free.length > 8 ? '…' : '') : 'لا توجد نماذج مجانية في القائمة.') +
          '\n' + providerLine + '\nالعنوان الفعّال: ' + (listing.base || ''), 'ok');
        fillModels(listing.models, free);
      }).then(renderQuota);
    }

    function labDefaultModel(provider) {
      if (provider === 'cloud') return (providerCache.cloud && providerCache.cloud.free && providerCache.cloud.free[0]) || 'openai/gpt-oss-20b';
      if (provider === 'groq') return settings.groqModel || GROQ_FREE_TIER_MODELS[0];
      if (provider === 'openrouter') return settings.openrouterModel || 'baidu/ernie-5.5-flash-preview:free';
      if (provider === 'zen') return (providerCache.zen && providerCache.zen.free && providerCache.zen.free[0]) || 'auto';
      return (providerCache.local && providerCache.local.free && providerCache.local.free[0]) || 'big-pickle';
    }
    q('ocLabProvider').onchange = function () { q('ocLabModel').value = labDefaultModel(q('ocLabProvider').value); };
    q('ocLabModel').value = labDefaultModel(q('ocLabProvider').value);

    function labOut(text) { q('ocLabOut').textContent = text; }
    function secOut(text) { q('ocSecOut').textContent = text; }
    q('ocLabTest').onclick = function () {
      readForm();
      var p = q('ocLabProvider').value, m = q('ocLabModel').value.trim(), r = q('ocLabRole').value;
      if (!m) { labOut('أدخل اسم النموذج.'); return; }
      labOut('جارٍ اختبار ' + p + '/' + m + ' على دور ' + r + '...');
      runBenchmark(p, m, r).then(function (x) {
        labOut((x.passed ? '✅ نجح' : '❌ لم يجتز') + ' — ' + x.model + ' (' + x.role + '): ' + x.score + '/100\n' + x.breakdown + '\n' + String(x.sample || x.warning || '').slice(0, 220));
      }).catch(function (e) { labOut('فشل الاختبار: ' + e.message); });
    };
    q('ocLabTrain').onclick = function () {
      readForm();
      var p = q('ocLabProvider').value, m = q('ocLabModel').value.trim(), r = q('ocLabRole').value;
      if (!m) { labOut('أدخل اسم النموذج.'); return; }
      labOut('جارٍ تدريب/ضبط ' + m + ' على دور ' + r + ' (3 تمارين)...');
      runTraining(p, m, r).then(function (x) {
        labOut((x.status === 'trained' ? '✅ اكتمل الضبط' : '⚠️ لا يوجد اتصال حي — لم يُسجَّل تدريب') + ': ' + x.drills + ' تمارين، متوسط ' + x.avgScore + '/100');
      }).catch(function (e) { labOut('فشل التدريب: ' + e.message); });
    };
    q('ocLabAssign').onclick = function () {
      var n = assignQualifiedModels();
      labOut(n ? '✅ تم تعيين ' + n + ' نموذجاً مؤهلاً على الأدوار. اضغط «حفظ وإعادة الاتصال» لتطبيقه.' : 'لا توجد نماذج اجتازت الاختبار بعد — اختبر النماذج أولاً.');
      renderQuota();
    };
    q('ocLabReport').onclick = function () {
      var rows = benchmarkReport().map(function (x) {
        return (x.passed ? '✅' : '❌') + ' ' + x.provider + '/' + x.model + ' → ' + x.role + ': ' + x.score + '/100';
      });
      labOut(rows.length ? rows.slice(0, 40).join('\n') : 'لا توجد نتائج اختبار بعد.');
    };
    q('ocSecScan').onclick = function () {
      var r = securityScan();
      secOut(r.findings.length
        ? '🕵️ تم رصد ' + r.findings.length + ' مؤشر(ات):\n' + r.findings.map(function (f) { return f.severity + ' · ' + f.kind + ' @ ' + f.where + ' → ' + f.hint; }).join('\n')
        : '✅ لم يُرصد مفتاح مكشوف في المصادر التي يمكن للصفحة فحصها.');
    };
    q('ocSecEncrypt').onclick = function () {
      var pass = q('ocVaultPass').value;
      secOut('جارٍ تشفير المفاتيح في الخزنة المحلية...');
      encryptSecrets(pass).then(function (r) {
        if (!r.ok) { secOut('❌ ' + r.error); return; }
        secOut('✅ تم تشفير ' + r.fields.length + ' حقل(password/keys) داخل المتصفح وإزالتها من التخزين المقروء. احتفظ بكلمة المرور — ستحتاجها بعد إعادة التحميل.');
      });
    };
    q('ocSecUnlock').onclick = function () {
      var pass = q('ocVaultPass').value;
      unlockVault(pass).then(function (r) {
        secOut(r.ok ? '🔓 تم فتح الخزنة في ذاكرة هذه الجلسة: ' + r.fields.join(', ') : '❌ ' + r.error);
      });
    };
    q('ocDevUpdate').onclick = function () {
      secOut('🧑‍💻 المطور التلقائي يحلل التشخيص...');
      autoDeveloperUpdate().then(function (r) {
        secOut('الوضع: ' + r.mode + '\n' + (r.text || '').slice(0, 500) + '\n✅ إصلاحات مطبقة: ' + r.applied.length + '\n' + r.applied.map(function (a) { return a.target + '=' + a.value; }).join('\n'));
      }).catch(function (e) { secOut('فشل التحديث التلقائي: ' + e.message); });
    };

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
    q('ocOpenAuth').onclick = function () {
      if (window.MDM1Auth) window.MDM1Auth.openPanel();
      else alert('وحدة الحساب غير محمّلة في هذه الصفحة.');
    };
    q('ocSendMsg').onclick = function () {
      var out = q('ocMsgOut');
      var text = q('ocMsgText').value.trim();
      if (!text) {
        out.textContent = '❌ اكتب نص الرسالة أولاً.';
        out.className = 'office-status err';
        return;
      }
      readForm();
      out.textContent = 'جارٍ الإرسال عبر Supabase Relay...';
      out.className = 'office-status';
      relaySend(text, q('ocMsgChannel').value, settings.telegramChatId, q('ocWaTo').value.trim())
        .then(function (r) {
          var parts = [];
          if (r.telegram) parts.push('تيليجرام: ' + (r.telegram.ok ? '✅' : r.telegram.skipped ? '⏭️ ' + (r.telegram.reason || 'مهيّأ مسبقاً') : '❌ HTTP ' + (r.telegram.status || '')));
          if (r.whatsapp) parts.push('واتساب: ' + (r.whatsapp.ok ? '✅' : r.whatsapp.skipped ? '⏭️ ' + (r.whatsapp.reason || 'مهيّأ مسبقاً') : '❌ HTTP ' + (r.whatsapp.status || '')));
          out.textContent = '✅ حُفظ الرسالة في Supabase' + (parts.length ? ' · ' + parts.join(' · ') : '') +
            (r.error ? ' ⚠️ ' + r.error : '');
          out.className = 'office-status ok';
          q('ocMsgText').value = '';
          renderAuthStatus();
        }).catch(function (e) {
          out.textContent = '❌ فشل الإرسال: ' + e.message;
          out.className = 'office-status err';
        });
    };
    q('ocSyncPull').onclick = function () {
      readForm();
      status('جارٍ سحب الحالة المشفّرة...', '');
      syncPull().then(function (r) {
        if (!r.configured) return status('المزامنة غير مهيّأة. أدخل URL والسر ثم فعّلها.', 'err');
        status(r.applied ? '✅ تم سحب الحالة واستعادتها (إصدار ' + r.version + ').' : 'لا توجد نسخة بعيدة بعد.', r.applied ? 'ok' : '');
        renderQuota();
      }).catch(function (e) { status('فشل السحب: ' + e.message, 'err'); });
    };
    q('ocSyncPush').onclick = function () {
      readForm();
      status('جارٍ رفع الحالة المشفّرة...', '');
      syncPush().then(function (r) {
        if (!r.configured) return status('المزامنة غير مهيّأة. أدخل URL والسر ثم فعّلها.', 'err');
        status(r.conflict ? '⚠️ تعارض: سُحبت النسخة الأحدث، ثم أُعيد رفع حالتك.' : '✅ تم رفع الحالة (إصدار ' + r.version + ').', r.conflict ? '' : 'ok');
        renderQuota();
      }).catch(function (e) { status('فشل الرفع: ' + e.message, 'err'); });
    };
    function renderOutbox() {
      q('ocOutbox').innerHTML = state.telegramOutbox.map(function (x) { return '<div>' + esc(String(x.text).slice(0, 160)) + '</div>'; }).join('') || '<div>لا رسائل بعد.</div>';
    }
    renderOutbox();
    renderAuthStatus();
    watchAuth();
    test();
    applyConnectionFocus(options);
  }

  /* Lets the quick buttons jump straight to the API fields or the selected
     WhatsApp/Telegram messaging channel instead of dumping users at the top. */
  function applyConnectionFocus(options) {
    var modal = document.getElementById('officeConnModal');
    if (!modal) return;
    var o = typeof options === 'string' ? { focus: options } : (options || {});
    if (o.channel) {
      var channel = modal.querySelector('#ocMsgChannel');
      if (channel) channel.value = o.channel;
    }
    var targetId = o.focus === 'api' ? 'ocZenKey' : o.focus === 'messaging' ? 'ocMsgText' : '';
    if (!targetId) return;
    var target = modal.querySelector('#' + targetId);
    if (!target) return;
    window.setTimeout(function () {
      if (target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }, 60);
  }

  function openMessaging(channel) {
    var st = window.MDM1Auth && typeof window.MDM1Auth.status === 'function' ? window.MDM1Auth.status() : null;
    if (st && !st.messagingReady) {
      showToast('سجّل الدخول بحساب Google أو الإيميل أولاً لتفعيل المراسلة.', 'err');
      if (window.MDM1Auth) window.MDM1Auth.openPanel();
      return;
    }
    openConnectionPanel({ channel: channel || 'telegram', focus: 'messaging' });
  }

  function bindQuickButtons() {
    var api = document.getElementById('quickApiBtn');
    if (api) api.onclick = function () { openConnectionPanel({ focus: 'api' }); };
    var google = document.getElementById('quickGoogleBtn');
    if (google) google.onclick = function () {
      if (!window.MDM1Auth) { showToast('وحدة الحساب غير محمّلة في هذه الصفحة.', 'err'); return; }
      var st = typeof window.MDM1Auth.status === 'function' ? window.MDM1Auth.status() : {};
      if (st.signedIn) { window.MDM1Auth.openPanel(); return; }
      Promise.resolve(window.MDM1Auth.signInWithGoogle()).catch(function (e) {
        showToast('تعذر فتح Google: ' + e.message, 'err');
      });
    };
    var wa = document.getElementById('quickWhatsappBtn');
    if (wa) wa.onclick = function () { openMessaging('whatsapp'); };
    var tg = document.getElementById('quickTelegramBtn');
    if (tg) tg.onclick = function () { openMessaging('telegram'); };
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

  /* Identity changes unlock messaging/sync; re-check state without asking for
     the office passphrase again. Compliance notices are distinct from the
     generic auth prompt and are logged once per real state change. */
  var authWatchInstalled = false;
  var lastComplianceSig = null;
  function complianceSnapshot() {
    var A = window.MDM1Auth;
    var s = A && typeof A.status === 'function' ? A.status() : {};
    if (s.loading) return { text: '🔐 جارٍ فحص الحساب...', cls: '', sig: 'loading', ready: false, requiresTotp: false, verified: false };
    if (s.error) return { text: '⚠️ تحقق الحساب غير متاح', cls: 'err', sig: 'error', ready: false, requiresTotp: false, verified: false };
    if (!s.signedIn) return { text: '👤 بدون حساب — الإرسال مقفل', cls: '', sig: 'signed-out', ready: false, requiresTotp: false, verified: false };
    if (s.requiresTotp) return { text: '🔐 مطلوب TOTP للإرسال', cls: 'warn', sig: 'totp-required', ready: false, requiresTotp: true, verified: false };
    return {
      text: '✅ امتثال الحساب مكتمل' + (s.verifiedFactors ? ' · TOTP' : ''),
      cls: 'ok',
      sig: 'ready-' + Boolean(s.verifiedFactors) + '-' + Boolean(s.messagingReady),
      ready: Boolean(s.messagingReady),
      requiresTotp: false,
      verified: Boolean(s.verifiedFactors)
    };
  }
  function renderComplianceBadge() {
    var el = document.getElementById('complianceBadge'); if (!el) return;
    var c = complianceSnapshot();
    el.textContent = c.text;
    el.className = 'provider-badge' + (c.cls ? ' ' + c.cls : '');
    el.title = 'حالة الامتثال لحساب جوجل/الإيميل وTOTP؛ لا تؤثر على كلمة مرور المكتب الخاصة.';
    return c;
  }
  function watchAuth() {
    renderComplianceBadge();
    if (authWatchInstalled || !window.MDM1Auth || typeof window.MDM1Auth.onChange !== 'function') return;
    authWatchInstalled = true;
    window.MDM1Auth.onChange(function (s) {
      renderAuthStatus();
      var c = renderComplianceBadge() || complianceSnapshot();
      if (lastComplianceSig !== null && c.sig !== lastComplianceSig && c.sig !== 'loading') {
        logAudit('auth_compliance_change', 'ui', c.text, { sig: c.sig, messagingReady: c.ready, requiresTotp: c.requiresTotp, verifiedFactors: c.verified });
        showToast('🔐 تحديث الامتثال: ' + c.text, c.ready ? 'ok' : 'err');
      }
      lastComplianceSig = c.sig;
      if (s && s.messagingReady && settings.syncEnabled && settings.syncUrl && secret('syncSecret')) {
        syncPull().catch(function (e) { console.warn('Office sync pull after sign-in failed:', e.message); });
      }
    });
  }

  /* ── boot ─────────────────────────────────────────────────────────────── */
  var resolveReady;
  var readyPromise = new Promise(function (resolve) { resolveReady = resolve; });

  function boot() {
    injectStyles();
    watchAuth();
    buildLockScreen();
    loadCompanyData()
      .then(waitUnlock)
      .then(function () {
        return syncPull().catch(function (e) { console.warn('Office sync pull failed:', e.message); return { configured: false }; });
      })
      .then(function () {
        injectTopbarButton();
        bindQuickButtons();
        updateQuotaBadge();
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
    showToast: showToast,
    openConnectionPanel: openConnectionPanel,
    openMessaging: openMessaging,
    createSnapshot: createSnapshot,
    restoreSnapshot: restoreSnapshot,
    downloadSnapshot: downloadSnapshot,
    importSnapshot: importSnapshot,
    healthCheck: healthCheck,
    telegramSecretLink: telegramSecretLink,
    telegramShareLink: telegramShareLink,
    relaySend: relaySend,
    authStatusLine: authStatusLine,
    assistant: {
      start: createAssistantSession,
      confirm: confirmAssistant,
      cancel: cancelAssistant,
      execute: executeAssistant,
      current: function () { return assistantSession ? clone(assistantSession) : null; }
    },
    syncPull: syncPull,
    syncPush: syncPush,
    quotaSummary: quotaSummary,
    getUsage: getUsage,
    markRateLimit: markRateLimit,
    /* model lab / governance / security helpers */
    listCloudModels: listCloudModels,
    listGroqModels: listGroqModels,
    listOpenRouterModels: listOpenRouterModels,
    runBenchmark: runBenchmark,
    runTraining: runTraining,
    benchmarkScore: benchmarkScore,
    benchmarkReport: benchmarkReport,
    assignQualifiedModels: assignQualifiedModels,
    qualityGate: qualityGate,
    qualityReports: function () { return state.qualityReports; },
    securityScan: securityScan,
    encryptSecrets: encryptSecrets,
    unlockVault: unlockVault,
    vaultStatus: vaultStatus,
    autoDeveloperUpdate: autoDeveloperUpdate,
    reset: function () { localStorage.removeItem(LS_STATE); location.reload(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
