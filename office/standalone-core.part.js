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
  var LS_SYNC_BACKUP = (CFG.storageKey || 'mdm1_office_v2') + '_sync_backup';

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
    lastProviderMode: null,
    lastModel: null,
    lastError: null
  };
  var settings = Object.assign({}, defaultSettings, readLS(LS_SETTINGS, {}));
  /* Older sessions could store a bare provider origin (e.g. https://api.groq.com)
     instead of the OpenAI-compatible API path. Repair it on load so model
     listing and chat calls use the real endpoint. */
  if (/^https:\/\/opencode\.ai\/?$/i.test(settings.zenBase)) settings.zenBase = defaultSettings.zenBase;
  if (/^https:\/\/api\.groq\.com\/?$/i.test(settings.groqBase)) settings.groqBase = defaultSettings.groqBase;
  if (/^https:\/\/openrouter\.ai\/?$/i.test(settings.openrouterBase)) settings.openrouterBase = defaultSettings.openrouterBase;
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
      /* Provable CEO decision trail: decision, evidence and override reason. */
      decisionLog: [],
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
    return mergeState(readLS(LS_STATE, null));
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
    settings.lastProviderMode = provider === 'opencode-zen' ? 'zen' : provider === 'opencode-local' ? 'local' : provider === 'cloud' ? 'demo' : provider;
    settings.lastModel = model;
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
  function quotaReserve(provider, cost) {
    var A = window.MDM1Auth;
    if (!A || typeof A.status !== 'function' || !A.status().googleReady) return Promise.resolve({ allowed: true, skipped: true });
    return secureRelay('quota_reserve', { provider: provider, cost: num(cost, 1) })
      .then(function (j) { return { allowed: j.allowed !== false, used: j.used, limit: j.limit, day: j.day }; })
      .catch(function (e) { return { allowed: true, skipped: true, error: e.message }; });
  }
  function quotaRelease(provider, cost) {
    var A = window.MDM1Auth;
    if (!A || typeof A.status !== 'function' || !A.status().googleReady) return Promise.resolve({ skipped: true });
    return secureRelay('quota_release', { provider: provider, cost: num(cost, 1) }).catch(function () { return { skipped: true }; });
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

  /* ── Supabase JWT/RLS state + encrypted cross-device sync ───────────────
     Google identity is verified server-side by office-relay. The server stores
     only an AES-256-GCM blob for the signed-in user; the browser derives the
     key from the user's own sync secret. No owner key, no plaintext state.   */
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
  function syncableState() {
    var copy = clone(state);
    delete copy.secretVault;
    Object.keys(copy).forEach(function (k) {
      if (/key|secret|password|token/i.test(k) && k !== 'telegramOutbox') delete copy[k];
    });
    return copy;
  }
  function mergeState(saved) {
    var base = initialState();
    if (!saved || typeof saved !== 'object') return base;
    var merged = Object.assign(base, saved);
    ['tasks', 'approvals', 'teamChat', 'internalMemos', 'kpiReviews', 'financialLedger', 'schedules', 'customers', 'votes', 'incidents', 'simulations', 'webhooks', 'auditLog', 'exports', 'sandboxFiles', 'customAgents', 'snapshots', 'telegramOutbox', 'qualityReports', 'requestLedger'].forEach(function (k) {
      if (!Array.isArray(merged[k])) merged[k] = base[k] || [];
    });
    ['directChats', 'agentStatuses', 'liveBubbles', 'gamification', 'memories', 'exportContents', 'knowledgeOverrides', 'modelUsage', 'modelBenchmarks', 'modelTraining'].forEach(function (k) {
      if (!merged[k] || typeof merged[k] !== 'object') merged[k] = base[k] || {};
    });
    if (!merged.usageStats) merged.usageStats = base.usageStats;
    (merged.approvals || []).forEach(function (a) {
      var serious = /دفع\s|تحويل\s|توقيع\s+عقد|نشر\s+عام|نشر\s+خارجي|منح\s+صلاحية|تغيير\s+صلاحية|بيانات\s+سرية|حذف\s+بيانات|webhook|api\s*key/i.test(stripNegated(String(a.title || '') + ' ' + String(a.details || '')));
      if (a.risk === 'high' && !serious) {
        a.risk = 'medium';
        a.securityNote = '🔎 تمت إعادة تصنيف هذا الطلب إلى متوسط الخطورة — المراجعة لا تعني أنه عالي الخطورة.';
      }
    });
    return merged;
  }
  function googleIdentity() {
    var A = window.MDM1Auth;
    if (!A || typeof A.requireGoogle !== 'function') return Promise.reject(new Error('طبقة هوية Google غير محمّلة.'));
    return A.requireGoogle();
  }
  function syncConfigured() {
    var A = window.MDM1Auth;
    return Boolean(secret('syncSecret') && A && typeof A.status === 'function' && A.status().googleReady);
  }
  function secureRelay(action, payload) {
    return googleIdentity().then(function (token) {
      var headers = {
        'content-type': 'application/json',
        apikey: String((CFG.auth && CFG.auth.publishableKey) || (CFG.messaging && CFG.messaging.anonKey) || ''),
        authorization: 'Bearer ' + token
      };
      // No owner/shared secret is ever sent by users; the Google JWT is the only
      // credential for protected actions on this device.
      return nativeFetch(settings.relayUrl, {
        method: 'POST', headers: headers, cache: 'no-store',
        body: JSON.stringify(Object.assign({ action: action }, payload || {}))
      });
    }).then(function (r) {
      return r.text().then(function (raw) {
        var j = safeJson(raw, {});
        if (!r.ok) throw new Error(j.error || j.message || ('HTTP ' + r.status));
        return j;
      });
    });
  }
  function backupLocalState(reason) {
    var backup = { at: nowIso(), reason: reason || 'sync', state: syncableState() };
    writeLS(LS_SYNC_BACKUP, backup);
    return backup;
  }
  function restoreSyncBackup() {
    var backup = readLS(LS_SYNC_BACKUP, null);
    if (!backup || !backup.state) return { ok: false, error: 'لا توجد نسخة محلية للتراجع بعد.' };
    backupLocalState('pre-restore');
    state = mergeState(backup.state);
    saveNow();
    logAudit('sync_conflict_rollback', 'ceo', 'Restored local state saved before cloud conflict (' + (backup.reason || 'sync') + ')');
    return { ok: true, at: backup.at };
  }
  function applyRemoteBlob(j, reason) {
    return decryptState(j.blob).then(function (plain) {
      if (!plain || typeof plain !== 'object' || !plain.meta) throw new Error('النسخة البعيدة غير صالحة أو أن سر المزامنة مختلف.');
      /* Never overwrite local work silently: keep a one-click rollback copy. */
      var backup = backupLocalState(reason || 'cloud');
      state = mergeState(plain);
      settings.syncVersion = num(j.version, 0);
      saveSettings(); saveNow();
      logAudit('sync_conflict_applied', 'ceo', 'Cloud state applied; local backup kept at ' + backup.at);
      return true;
    });
  }
  function syncPull(opts) {
    if (!syncConfigured()) return Promise.resolve({ configured: false });
    if (opts && opts.keepMine) {
      return secureRelay('state_get', {}).then(function (j) {
        settings.syncVersion = num(j.version, 0); saveSettings();
        return { configured: true, applied: false, keptLocal: true, version: settings.syncVersion };
      });
    }
    return secureRelay('state_get', {}).then(function (j) {
      settings.syncVersion = num(j.version, 0); saveSettings();
      if (!j.blob) return { configured: true, applied: false, version: settings.syncVersion };
      return applyRemoteBlob(j, 'sync_pull').then(function () { return { configured: true, applied: true, version: settings.syncVersion }; });
    });
  }
  function syncPush() {
    if (!syncConfigured()) return Promise.resolve({ configured: false });
    return encryptState(syncableState()).then(function (blob) {
      return secureRelay('state_put', { blob: blob, expected: num(settings.syncVersion, 0) })
        .then(function (j) {
          if (j.conflict && j.blob) {
            return applyRemoteBlob(j, 'sync_push_conflict').then(function () { return { ok: true, conflict: true, applied: true, version: settings.syncVersion, rollbackAvailable: true }; });
          }
          if (isFinite(j.version)) { settings.syncVersion = num(j.version, 0); saveSettings(); }
          return { ok: true, conflict: false, version: settings.syncVersion };
        });
    });
  }
  function queueAdd(payload, kind, runAfter) {
    return secureRelay('queue_add', { payload: payload || {}, kind: kind || 'office-task', runAfter: runAfter || null });
  }
  function queueList() { return secureRelay('queue_list', {}); }
  function queueComplete(id, result) { return secureRelay('queue_complete', { id: id, result: result || {} }); }

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
  /* Migrate any legacy plaintext keys out of localStorage into this session's
     memory vault. They are never synced, never sent to a server, and are
     persisted only if the user explicitly encrypts the vault with a passphrase. */
  SECRET_FIELDS.forEach(function (field) {
    if (settings[field]) {
      runtimeVault.data[field] = String(settings[field]);
      settings[field] = '';
    }
  });
  saveSettings();
  function secret(field) {
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
    state.agentStatuses[agentId] = state.tasks.some(function (t) { return t.agentId === agentId && (t.status === 'queued' || t.status === 'working'); }) ? 'working' : 'available';
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
    'accountant': { prompt: 'احسبي هامش ربح منتج سعره $99 وتكلفته $41 مع تكلفة API $6، واذكري الافتراضات والمخاطر المالية.', keywords: ['هامش', 'تكلفة', 'ربح', 'افتراض'], minLen: 90, expect: 'number' },
    'marketing-lead': { prompt: 'اكتب إعلاناً عربياً مختصراً لمنتج أتمتة مع دعوة لاتخاذ إجراء، وحدد جمهوراً وقناة نشر ومقياس نجاح.', keywords: ['جمهور', 'قناة', 'قياس', 'إعلان'], minLen: 90 },
    'security-officer': { prompt: 'راجع ربط webhook خارجي بمفتاح سري. صنّف الخطر واذكر الضوابط المطلوبة قبل الموافقة.', keywords: ['خطر', 'ضوابط', 'مفتاح', 'موافقة'], minLen: 90 },
    'web-research-team': { prompt: 'ابحث عن فرصة SaaS جديدة واذكر مصدراً ومعايير اختيار ومخاطرة واحدة على الأقل.', keywords: ['مصدر', 'معايير', 'فرصة', 'مخاطرة'], minLen: 90, expect: 'url' },
    'auditors-experts-devs': { prompt: 'راجع مقترح أتمتة تقنياً: ما المخاطر التقنية، ومتى يحتاج تعيين مطور جديد؟', keywords: ['تقني', 'مخاطر', 'مطور', 'تدقيق'], minLen: 90 }
  };
  function benchmarkSpec(role) {
    if (BENCHMARK_TASKS[role]) return BENCHMARK_TASKS[role];
    var isQa = /^qa-/.test(String(role || ''));
    return isQa
      ? { prompt: 'راجع مقترحاً تنفيذياً يتضمن رقماً غير مدعوم وإجراءً يتطلب موافقة. أثبت خطأً واحداً وأصدر حكماً وفق بروتوكول QA.', keywords: ['دليل', 'خطأ', 'حكم', 'موافقة'], minLen: 80, expect: 'qa' }
      : { prompt: 'حلل هذه المهمة الإدارية واقترح خطوات عملية ومخاطر ومؤشر نجاح.', keywords: ['خطوات', 'مخاطر', 'مؤشر', 'حل'], minLen: 80 };
  }
  function benchmarkScore(text, spec, live) {
    var t = String(text || '');
    var lower = t.toLowerCase();
    if (!live || /الوضع التجريبي|تعذر الوصول إلى النموذج|demo mode/i.test(t)) return { score: 0, heuristic: true, breakdown: 'رد تجريبي/غير حي — لا يُحتسب.' };
    var hits = (spec.keywords || []).filter(function (k) { return lower.indexOf(String(k).toLowerCase()) !== -1; }).length;
    var kwPts = Math.round(40 * hits / Math.max(1, (spec.keywords || []).length));
    var minLen = spec.minLen || 80;
    var lenPts = Math.min(25, Math.round(25 * t.length / minLen));
    var structurePts = /\n/.test(t) && /[-•١٢٣1-9]/.test(t) ? 15 : 6;
    var cleanPts = !/عذراً|لا أستطيع|غير قادر على (الوصول|الاتصال)/i.test(t) ? 20 : 8;
    /* Deterministic validation of task-specific facts, above keyword counting. */
    var expect = spec.expect || '';
    var semanticPts = 0;
    if (expect === 'number' && /(?:\$?\s*)(?:5[0-4])\b/.test(t)) semanticPts = 20;
    if (expect === 'qa' && /(PASS|FAIL|حكم|مقبول|مرفوض)/i.test(t)) semanticPts = 20;
    if (expect === 'url' && /https?:\/\//i.test(t)) semanticPts = 20;
    var score = Math.max(0, Math.min(100, kwPts + lenPts + structurePts + cleanPts + semanticPts));
    return {
      score: score, heuristic: true,
      breakdown: 'تقدير إرشادي: كلمات ' + kwPts + '/40 · طول ' + lenPts + '/25 · تنظيم ' + structurePts + '/15 · وضوح ' + cleanPts + '/20 · تحقق ' + semanticPts + '/20' + (expect ? ' (' + expect + ')' : '')
    };
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