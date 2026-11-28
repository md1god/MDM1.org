/* ============================================================================
   MDM1 Decision Engine (part 5 of 6)
   1) Outcome ledger  — projects with a real lifecycle and measured results
   2) Forecast parliament — locked probability forecasts scored with Brier
   3) Action broker + policy engine — default-deny, deterministic, one-shot
      capabilities, SHA-256 hash-chained decision log
   Evaluated inside the same closure as the other parts. No network calls are
   made here except through aiGenerate / telegramNotify, which already exist.
   ========================================================================== */

  var ENGINE_ZERO = new Array(65).join('0');
  var ENGINE_QUESTIONS = {
    delivered_on_time: 'هل سيُسلَّم المشروع في الموعد المحدد أو قبله؟',
    accepted: 'هل سيقبل العميل أو المدير التسليم النهائي؟',
    profitable: 'هل سيكون صافي الربح (الإيراد - التكلفة المسجلة) أكبر من صفر؟',
    within_budget: 'هل ستبقى التكلفة الفعلية ضمن الميزانية المحددة؟',
    first_pass_quality: 'هل سيجتاز الناتج فحص الجودة من أول مرة دون إعادة عمل؟'
  };
  var ENGINE_PROJECT_STATES = ['planned', 'active', 'delivered', 'accepted', 'rejected', 'cancelled'];
  var ENGINE_TRANSITIONS = {
    planned: ['active', 'cancelled'],
    active: ['delivered', 'cancelled'],
    delivered: ['accepted', 'rejected', 'cancelled'],
    accepted: [], rejected: [], cancelled: []
  };
  var ENGINE_DEFAULT_POLICY = {
    version: 1,
    global: { maxIntentsPerHour: 30, duplicateWindowMin: 10, capabilityTtlMin: 15 },
    kinds: {
      read_report:    { effect: 'read', enabled: true, auto: true },
      spend:          { effect: 'money', enabled: true, auto: false, maxAmountUsd: 50, dailyCapUsd: 25 },
      send_message:   { effect: 'external', enabled: true, auto: false, maxPerHour: 10, allowedChannels: ['telegram'] },
      publish:        { effect: 'external', enabled: true, auto: false, allowedTargets: [] },
      update_price:   { effect: 'write', enabled: false, auto: false, maxChangePct: 15, minPrice: 0.01 },
      transfer_funds: { effect: 'money', enabled: false, auto: false, maxAmountUsd: 0, dailyCapUsd: 0 }
    }
  };
  var engineChainQueue = Promise.resolve();

  function engineState() {
    if (!state.engine || typeof state.engine !== 'object') state.engine = {};
    var e = state.engine;
    ['projects', 'forecasts', 'intents', 'capabilities', 'chain'].forEach(function (k) { if (!Array.isArray(e[k])) e[k] = []; });
    ['reputation', 'spent'].forEach(function (k) { if (!e[k] || typeof e[k] !== 'object') e[k] = {}; });
    if (!e.policy || typeof e.policy !== 'object' || !e.policy.kinds) e.policy = clone(ENGINE_DEFAULT_POLICY);
    if (typeof e.chainHead !== 'string') e.chainHead = ENGINE_ZERO;
    if (typeof e.chainBase !== 'string') e.chainBase = ENGINE_ZERO;
    if (typeof e.chainSeq !== 'number') e.chainSeq = 0;
    return e;
  }

  /* ---------- hashing & the decision chain (real SHA-256) ---------- */
  function engineCanon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(engineCanon).join(',') + ']';
    return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + engineCanon(v[k]); }).join(',') + '}';
  }
  function engineSha256(text) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('WebCrypto غير متاح (يلزم HTTPS).'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text))).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function engineChainEntryHash(prev, entry) {
    return engineSha256(prev + '|' + entry.seq + '|' + entry.ts + '|' + entry.type + '|' + engineCanon(entry.data));
  }
  function engineChain(type, data) {
    var frozen = clone(data || {});            /* snapshot now: later mutations must not break the hash */
    engineChainQueue = engineChainQueue.then(function () {
      var e = engineState();
      var entry = { seq: e.chainSeq + 1, ts: nowIso(), type: type, data: frozen, prev: e.chainHead };
      return engineChainEntryHash(e.chainHead, entry).then(function (h) {
        entry.hash = h;
        e.chainHead = h; e.chainSeq = entry.seq; e.chain.push(entry);
        while (e.chain.length > 400) e.chainBase = e.chain.shift().hash;
        saveState();
        return entry;
      });
    }).catch(function () { return null; });
    return engineChainQueue;
  }
  function engineVerifyChain() {
    return engineChainQueue.then(engineVerifyChainNow);   /* wait for pending appends */
  }
  function engineVerifyChainNow() {
    var e = engineState(), prev = e.chainBase, i = 0;
    function step() {
      if (i >= e.chain.length) return Promise.resolve({ ok: true, length: e.chain.length, head: e.chainHead });
      var entry = e.chain[i];
      if (entry.prev !== prev) return Promise.resolve({ ok: false, brokenAt: entry.seq, reason: 'prev_mismatch' });
      return engineChainEntryHash(prev, entry).then(function (h) {
        if (h !== entry.hash) return { ok: false, brokenAt: entry.seq, reason: 'hash_mismatch' };
        prev = entry.hash; i++;
        return step();
      });
    }
    return step().then(function (r) {
      if (r.ok && e.chain.length && e.chain[e.chain.length - 1].hash !== e.chainHead) return { ok: false, brokenAt: e.chainSeq, reason: 'head_mismatch' };
      return r;
    });
  }

  /* ---------- 1) outcome ledger: projects ---------- */
  function engineFindProject(id) { return engineState().projects.find(function (p) { return p.id === id; }) || null; }
  function engineLedgerFor(p) {
    return (state.financialLedger || []).filter(function (x) { return x.project === p.id || x.project === p.title; });
  }
  function engineMetrics(p) {
    var led = engineLedgerFor(p), cost = 0, revenue = 0;
    led.forEach(function (x) {
      var a = num(x.amountUsd, 0);
      if (x.type === 'expense') cost += a; else revenue += a;
    });
    var tasks = (state.tasks || []).filter(function (t) { return t.projectId === p.id; });
    var count = function (s) { return tasks.filter(function (t) { return t.status === s; }).length; };
    var onTime = null;
    if (p.deliveredAt && p.dueAt) onTime = Date.parse(p.deliveredAt) <= Date.parse(p.dueAt);
    return {
      costUsd: Number(cost.toFixed(2)), revenueUsd: Number(revenue.toFixed(2)), profitUsd: Number((revenue - cost).toFixed(2)),
      tasks: { total: tasks.length, done: count('done'), failed: count('failed'), needsReview: count('needs_review'), open: count('queued') + count('working') },
      onTime: onTime
    };
  }
  function engineOutcomes(p) {
    var m = engineMetrics(p), o = {};
    var closed = p.status === 'accepted' || p.status === 'rejected';
    if (p.deliveredAt && p.dueAt) o.delivered_on_time = m.onTime ? 1 : 0;
    if (closed) {
      o.accepted = p.status === 'accepted' ? 1 : 0;
      o.profitable = m.profitUsd > 0 ? 1 : 0;
      if (num(p.budgetUsd, 0) > 0) o.within_budget = m.costUsd <= num(p.budgetUsd, 0) ? 1 : 0;
      if (typeof p.firstPassQuality === 'boolean') o.first_pass_quality = p.firstPassQuality ? 1 : 0;
    }
    return o;
  }
  function engineCreateProject(b) {
    var title = tagValue(b.title, '', 120);
    if (!title) return { error: 'title required', status: 400 };
    var budget = Number(b.budgetUsd == null ? 0 : b.budgetUsd);
    if (!isFinite(budget) || budget < 0 || budget > 1e9) return { error: 'budgetUsd invalid', status: 400 };
    var due = null;
    if (b.dueAt) { var t = Date.parse(b.dueAt); if (!isFinite(t)) return { error: 'dueAt invalid', status: 400 }; due = new Date(t).toISOString(); }
    var p = {
      id: 'prj-' + uuid().slice(0, 8), title: title, description: tagValue(b.description, '', 600),
      customerId: tagValue(b.customerId, '', 60), budgetUsd: budget, dueAt: due, status: 'planned',
      createdAt: nowIso(), startedAt: null, deliveredAt: null, closedAt: null, firstPassQuality: null, reworkCount: 0, history: [{ at: nowIso(), status: 'planned' }]
    };
    engineState().projects.unshift(p);
    logAudit('project_created', 'ceo', title.slice(0, 80), { id: p.id });
    engineChain('project_created', { id: p.id, title: title, budgetUsd: budget, dueAt: due });
    saveState();
    return { project: p, status: 201 };
  }
  function engineSetStatus(id, b) {
    var p = engineFindProject(id);
    if (!p) return { error: 'Project not found', status: 404 };
    var next = String(b.status || '');
    if (ENGINE_PROJECT_STATES.indexOf(next) < 0) return { error: 'status invalid', status: 400 };
    if (ENGINE_TRANSITIONS[p.status].indexOf(next) < 0) return { error: 'transition ' + p.status + ' → ' + next + ' غير مسموح', status: 409 };
    var revenue = b.revenueUsd == null ? 0 : Number(b.revenueUsd);
    if (!isFinite(revenue) || revenue < 0 || revenue > 1e9) return { error: 'revenueUsd invalid', status: 400 };
    if (next === 'accepted' && revenue > 0) {
      state.financialLedger.push({ id: 'fin-' + uuid().slice(0, 8), type: 'revenue', title: tagValue('إيراد مشروع: ' + p.title, 'إيراد', 120), project: p.id, amountUsd: revenue, date: nowIso().slice(0, 10), notes: 'مسجّل عند قبول التسليم' });
    }
    p.status = next;
    p.history.push({ at: nowIso(), status: next });
    if (next === 'active') p.startedAt = nowIso();
    if (next === 'delivered') p.deliveredAt = nowIso();
    if (next === 'accepted' || next === 'rejected' || next === 'cancelled') p.closedAt = nowIso();
    if (typeof b.firstPassQuality === 'boolean') p.firstPassQuality = b.firstPassQuality;
    if (b.reworkCount != null && isFinite(Number(b.reworkCount))) p.reworkCount = Math.max(0, Math.min(99, Math.floor(Number(b.reworkCount))));
    logAudit('project_' + next, 'ceo', p.title.slice(0, 80), { id: p.id });
    var metrics = engineMetrics(p);
    engineChain('project_' + next, { id: p.id, metrics: metrics });
    return engineResolveForecasts(p).then(function (resolved) {
      saveState();
      return { project: p, metrics: metrics, resolvedForecasts: resolved, status: 200 };
    });
  }
  function engineAddTask(id, b) {
    var p = engineFindProject(id);
    if (!p) return { error: 'Project not found', status: 404 };
    if (p.status === 'cancelled' || p.status === 'accepted' || p.status === 'rejected') return { error: 'المشروع مغلق', status: 409 };
    var ag = getAgent(b.agentId);
    var title = tagValue(b.title, '', 160);
    if (!ag || !title) return { error: 'agentId and title required', status: 400 };
    var task = { id: 'tsk-' + uuid().slice(0, 8), agentId: ag.id, title: title, description: tagValue(b.description, '', 800), status: 'queued', createdAt: nowIso(), projectId: p.id };
    state.tasks.unshift(task);
    recomputeStatus(ag.id);
    logAudit('project_task', 'ceo', p.title.slice(0, 40) + ' ← ' + title.slice(0, 60), { id: p.id, taskId: task.id });
    saveState();
    if (typeof startTaskRunner === 'function') startTaskRunner();
    return { task: task, status: 201 };
  }

  /* ---------- 2) forecast parliament ---------- */
  function engineParseForecast(text, keys) {
    var s = String(text || '').replace(/```(?:json)?/gi, '');
    var a = s.indexOf('{'), z = s.lastIndexOf('}');
    if (a < 0 || z <= a) return null;
    var obj;
    try { obj = JSON.parse(s.slice(a, z + 1)); } catch (err) { return null; }
    var out = {}, any = false;
    keys.forEach(function (k) {
      var v = Number(obj && obj[k]);
      if (!isFinite(v)) return;
      if (v > 1 && v <= 100) v = v / 100;           /* "75" means 75% */
      if (v < 0 || v > 1) return;
      out[k] = Math.min(0.99, Math.max(0.01, v));  /* no certainty claims */
      any = true;
    });
    return any ? out : null;
  }
  function engineReputationWeight(agentId, key) {
    var r = engineState().reputation[agentId];
    var rec = r && r[key];
    if (!rec || !rec.n) return 1;
    var mean = rec.sumBrier / rec.n, skill = 1 - mean / 0.25;       /* 0.25 = always saying 50% */
    return Math.max(0.1, Math.min(2, 1 + skill * Math.min(1, rec.n / 8)));
  }
  function engineConsensus(f) {
    var out = {};
    f.questions.forEach(function (k) {
      var ps = [], ws = [];
      Object.keys(f.predictions).forEach(function (aid) {
        if (typeof f.predictions[aid][k] === 'number') { ps.push(f.predictions[aid][k]); ws.push(engineReputationWeight(aid, k)); }
      });
      if (!ps.length) { out[k] = null; return; }
      var wsum = ws.reduce(function (a, b) { return a + b; }, 0);
      var mean = ps.reduce(function (a, p, i) { return a + p * ws[i]; }, 0) / wsum;
      var plain = ps.reduce(function (a, b) { return a + b; }, 0) / ps.length;
      var sd = Math.sqrt(ps.reduce(function (a, p) { return a + Math.pow(p - plain, 2); }, 0) / ps.length);
      out[k] = { p: Number(mean.toFixed(3)), spread: Number(sd.toFixed(3)), n: ps.length };
    });
    return out;
  }
  function engineForecastDigest(f) {
    return engineSha256(engineCanon({ projectId: f.projectId, questions: f.questions, predictions: f.predictions, lockedAt: f.lockedAt }));
  }
  function engineCreateForecast(b) {
    var p = engineFindProject(b.projectId);
    if (!p) return Promise.resolve({ error: 'Project not found', status: 404 });
    if (p.status !== 'planned' && p.status !== 'active') return Promise.resolve({ error: 'التوقع يُسجَّل قبل التسليم فقط', status: 409 });
    var keys = (Array.isArray(b.questions) && b.questions.length ? b.questions : ['delivered_on_time', 'accepted', 'profitable']).filter(function (k) { return ENGINE_QUESTIONS[k]; });
    keys = keys.filter(function (k, i) { return keys.indexOf(k) === i; });
    if (!keys.length) return Promise.resolve({ error: 'questions invalid', status: 400 });
    var voters = (Array.isArray(b.voterIds) && b.voterIds.length ? b.voterIds : ['accountant', 'marketing-lead', 'auditors-experts-devs', 'web-research-team', 'security-officer']).slice(0, 8)
      .filter(function (id, i, arr) { return getAgent(id) && arr.indexOf(id) === i; });
    var f = { id: 'fcs-' + uuid().slice(0, 8), projectId: p.id, questions: keys, createdAt: nowIso(), lockedAt: null, status: 'open', predictions: {}, skipped: [], resolved: {}, scores: {}, lockHash: null };
    var facts = 'المشروع: ' + p.title + '\nالوصف: ' + (p.description || '—') + '\nالميزانية: $' + p.budgetUsd + '\nالموعد النهائي: ' + (p.dueAt || 'غير محدد');
    var qtext = keys.map(function (k) { return '- ' + k + ': ' + ENGINE_QUESTIONS[k]; }).join('\n');
    var chain = Promise.resolve();
    voters.forEach(function (aid) {
      chain = chain.then(function () {
        var ag = getAgent(aid);
        var prompt = 'قدّم توقعاً احتمالياً مستقلاً بصفتك ' + ag.name + '.\n' + facts + '\n\nالأسئلة (أجب بقيمة بين 0 و1 لكل مفتاح):\n' + qtext +
          '\n\nأجب بكائن JSON واحد فقط بهذه المفاتيح وبلا أي نص آخر. لا تخترع أرقاماً غير مبنية على المعطيات؛ إن كنت غير متأكد فاذكر احتمالاً صادقاً قريباً من 0.5.';
        return aiGenerate({ agentId: aid, extraContext: 'مرحلة توقعات مستقلة — لا ترَ إجابات الآخرين.', messages: [{ role: 'user', text: prompt }] }).then(function (r) {
          if (r && r.usage) recordUsage(aid, r.usage);
          if (!r || r.mode !== 'live') { f.skipped.push({ agentId: aid, reason: 'no_live_model' }); return; }
          var parsed = engineParseForecast(r.text, keys);
          if (!parsed) { f.skipped.push({ agentId: aid, reason: 'invalid_json' }); return; }
          f.predictions[aid] = parsed;
        }).catch(function () { f.skipped.push({ agentId: aid, reason: 'error' }); });
      });
    });
    /* The CEO may also lock his own numbers; they count as a voter named "ceo". */
    if (b.manual && typeof b.manual === 'object') {
      var man = {};
      keys.forEach(function (k) { var v = Number(b.manual[k]); if (isFinite(v) && v >= 0 && v <= 1) man[k] = Math.min(0.99, Math.max(0.01, v)); });
      if (Object.keys(man).length) f.predictions.ceo = man;
    }
    return chain.then(function () {
      if (!Object.keys(f.predictions).length) return { error: 'لا توجد توقعات صالحة (النماذج غير متصلة أو لم تُرجع JSON صالحاً).', skipped: f.skipped, status: 422 };
      f.lockedAt = nowIso();
      return engineForecastDigest(f).then(function (h) {
        f.lockHash = h;
        engineState().forecasts.unshift(f);
        engineChain('forecast_locked', { id: f.id, projectId: p.id, lockHash: h });
        logAudit('forecast_locked', 'ceo', p.title.slice(0, 60), { id: f.id });
        saveState();
        return { forecast: f, consensus: engineConsensus(f), status: 201 };
      });
    });
  }
  function engineResolveForecasts(p) {
    var e = engineState(), outcomes = engineOutcomes(p), touched = 0;
    e.forecasts.forEach(function (f) {
      if (f.projectId !== p.id || f.status === 'resolved' || f.status === 'void') return;
      if (p.status === 'cancelled') { f.status = 'void'; touched++; return; }
      var pending = 0;
      f.questions.forEach(function (k) {
        if (k in f.resolved) return;
        if (typeof outcomes[k] !== 'number') { pending++; return; }
        f.resolved[k] = outcomes[k];
        Object.keys(f.predictions).forEach(function (aid) {
          if (typeof f.predictions[aid][k] !== 'number') return;
          var br = Math.pow(f.predictions[aid][k] - outcomes[k], 2);
          (f.scores[aid] = f.scores[aid] || {})[k] = Number(br.toFixed(4));
          var rep = (e.reputation[aid] = e.reputation[aid] || {});
          var rec = (rep[k] = rep[k] || { n: 0, sumBrier: 0 });
          rec.n += 1; rec.sumBrier = Number((rec.sumBrier + br).toFixed(6));
        });
        touched++;
      });
      if (!pending) f.status = 'resolved';
    });
    /* Evidence-based reward: only forecasters who beat the 50% baseline earn points. */
    var jobs = [];
    e.forecasts.forEach(function (f) {
      if (f.projectId !== p.id || f.rewarded || f.status !== 'resolved') return;
      f.rewarded = true;
      Object.keys(f.scores).forEach(function (aid) {
        var vals = Object.keys(f.scores[aid]).map(function (k) { return f.scores[aid][k]; });
        var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        if (mean < 0.15 && aid !== 'ceo' && typeof awardPoints === 'function') awardPoints(aid, 10, 'توقع دقيق (Brier ' + mean.toFixed(3) + ')');
      });
      jobs.push(engineChain('forecast_resolved', { id: f.id, resolved: f.resolved, scores: f.scores }));
    });
    return Promise.all(jobs).then(function () { return touched; });
  }
  function engineLeaderboard() {
    var rep = engineState().reputation, rows = [];
    Object.keys(rep).forEach(function (aid) {
      Object.keys(rep[aid]).forEach(function (k) {
        var r = rep[aid][k];
        if (r.n) rows.push({ agentId: aid, name: aid === 'ceo' ? 'المدير' : (getAgent(aid) ? getAgent(aid).name : aid), question: k, n: r.n, meanBrier: Number((r.sumBrier / r.n).toFixed(3)), weight: Number(engineReputationWeight(aid, k).toFixed(2)) });
      });
    });
    return rows.sort(function (a, b) { return a.meanBrier - b.meanBrier; });
  }

  /* ---------- 3) action broker + policy engine ---------- */
  function engineTodayKey() { return new Date().toISOString().slice(0, 10); }
  function engineSecretLike(text) {
    return /(sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9]{16,}|bearer\s+[A-Za-z0-9._-]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|[A-Fa-f0-9]{40,})/i.test(String(text || ''));
  }
  function engineFiniteField(obj, name, out) {
    if (!(name in obj) || obj[name] === null || obj[name] === undefined || obj[name] === '') return true;
    if (typeof obj[name] !== 'number' && typeof obj[name] !== 'string') return false;
    var v = Number(obj[name]);
    if (!isFinite(v) || v < 0 || v > 1e9) return false;
    out[name] = v;
    return true;
  }
  /* Pure decision function: no side effects, same input → same verdict. */
  function enginePolicyEvaluate(intent, ctx) {
    var pol = ctx.policy, kp = pol.kinds[intent.kind], reasons = [];
    function deny(code, msg) { return { verdict: 'deny', code: code, reasons: reasons.concat([msg]) }; }
    if (ctx.emergency) return deny('EMERGENCY_FREEZE', 'وضع الطوارئ نشط — كل الإجراءات مجمّدة.');
    if (!kp || kp.enabled !== true) return deny('UNKNOWN_OR_DISABLED_KIND', 'نوع الإجراء غير معروف أو غير مفعّل (الرفض هو الافتراضي).');
    var nums = {};
    if (!engineFiniteField(intent, 'amountUsd', nums) || !engineFiniteField(intent, 'currentPrice', nums) || !engineFiniteField(intent, 'newPrice', nums)) {
      return deny('INVALID_NUMBER', 'قيمة رقمية غير صالحة (NaN أو سالبة أو ضخمة).');
    }
    if (engineSecretLike(intent.text) || engineSecretLike(intent.target)) return deny('SECRET_IN_PAYLOAD', 'النص يحتوي ما يشبه مفتاحاً أو رمزاً سرياً.');
    if (ctx.recentCount >= pol.global.maxIntentsPerHour) return deny('RATE_LIMIT', 'تجاوز الحد الأقصى للطلبات في الساعة.');
    if (ctx.duplicate) return deny('DUPLICATE', 'طلب مطابق نُفّذ أو قُدّم خلال النافذة الزمنية.');
    if (kp.effect === 'money') {
      var amt = nums.amountUsd;
      if (!(amt > 0)) return deny('AMOUNT_REQUIRED', 'يجب تحديد مبلغ أكبر من صفر.');
      if (amt > Number(kp.maxAmountUsd || 0)) return deny('AMOUNT_LIMIT', 'المبلغ $' + amt + ' يتجاوز حد الإجراء $' + (kp.maxAmountUsd || 0) + '.');
      if (ctx.spentToday + amt > Number(kp.dailyCapUsd || 0)) return deny('DAILY_CAP', 'يتجاوز السقف اليومي $' + (kp.dailyCapUsd || 0) + ' (المنفَّق اليوم $' + ctx.spentToday.toFixed(2) + ').');
    }
    if (intent.kind === 'update_price') {
      var cur = nums.currentPrice, nw = nums.newPrice;
      if (!(cur > 0) || !(nw >= Number(kp.minPrice || 0))) return deny('INVALID_PRICE', 'السعر الحالي أو الجديد غير صالح.');
      var pct = Math.abs((nw - cur) / cur) * 100;
      if (pct > Number(kp.maxChangePct || 0)) return deny('PRICE_CHANGE_LIMIT', 'التغيير ' + pct.toFixed(1) + '% يتجاوز الحد ' + (kp.maxChangePct || 0) + '% (في الاتجاهين).');
    }
    if (intent.kind === 'send_message') {
      if ((kp.allowedChannels || []).indexOf(String(intent.channel || 'telegram')) < 0) return deny('CHANNEL_NOT_ALLOWED', 'قناة الإرسال غير مسموحة.');
      if (!String(intent.text || '').trim()) return deny('TEXT_REQUIRED', 'نص الرسالة مطلوب.');
      if (ctx.recentSameKind >= Number(kp.maxPerHour || 0)) return deny('KIND_RATE_LIMIT', 'تجاوز حد الرسائل في الساعة.');
    }
    if (intent.kind === 'publish') {
      var allow = kp.allowedTargets || [];
      if (allow.length && allow.indexOf(String(intent.target || '')) < 0) return deny('TARGET_NOT_ALLOWED', 'وجهة النشر ليست في القائمة البيضاء.');
      if (!String(intent.text || '').trim()) return deny('TEXT_REQUIRED', 'محتوى النشر مطلوب.');
    }
    /* Trust is assigned by the broker, never read from the request. */
    if (kp.effect === 'read' && kp.auto === true) return { verdict: 'allow_auto', code: 'READ_ONLY', reasons: ['قراءة فقط — لا أثر خارجي.'] };
    return { verdict: 'needs_approval', code: 'WRITE_NEEDS_APPROVAL', reasons: ['إجراء له أثر (' + kp.effect + ') — يتطلب موافقة صريحة وقدرة لمرة واحدة.'] };
  }
  function engineIntentFingerprint(i) {
    return engineCanon({ kind: i.kind, agentId: i.agentId, amountUsd: i.amountUsd == null ? null : Number(i.amountUsd), target: i.target || '', channel: i.channel || '', text: i.text || '', newPrice: i.newPrice == null ? null : Number(i.newPrice), projectId: i.projectId || '' });
  }
  function engineSubmitIntent(b, channel) {
    var e = engineState(), now = Date.now();
    var intent = {
      id: 'int-' + uuid().slice(0, 8), agentId: tagValue(b.agentId, 'unknown', 60), kind: tagValue(b.kind, '', 40),
      amountUsd: b.amountUsd, currentPrice: b.currentPrice, newPrice: b.newPrice,
      target: tagValue(b.target, '', 160), channel: tagValue(b.channel, '', 30), text: String(b.text == null ? '' : b.text).slice(0, 1200),
      projectId: tagValue(b.projectId, '', 60), trust: channel === 'ceo_form' ? 'DIRECT_USER' : 'UNTRUSTED_AGENT',
      createdAt: nowIso(), status: 'evaluating', verdict: null, reasons: [], capabilityId: null, result: null
    };
    var fp = engineIntentFingerprint(intent);
    intent.fingerprint = fp;
    var winMs = Number(e.policy.global.duplicateWindowMin || 10) * 60000;
    var recent = e.intents.filter(function (x) { return x.status !== 'denied' && now - Date.parse(x.createdAt) < 3600000; });
    var ctx = {
      policy: e.policy, emergency: Boolean(state.emergencyMode),
      recentCount: recent.length, recentSameKind: recent.filter(function (x) { return x.kind === intent.kind; }).length,
      duplicate: e.intents.some(function (x) { return x.fingerprint === fp && ['denied', 'rejected', 'expired', 'failed'].indexOf(x.status) < 0 && now - Date.parse(x.createdAt) < winMs; }),
      spentToday: Number(e.spent[engineTodayKey()] || 0)
    };
    var d = enginePolicyEvaluate(intent, ctx);
    intent.verdict = d.verdict; intent.code = d.code; intent.reasons = d.reasons;
    if (d.verdict === 'deny') intent.status = 'denied';
    else if (d.verdict === 'allow_auto') intent.status = 'approved';
    else intent.status = 'pending_approval';
    e.intents.unshift(intent);
    if (e.intents.length > 200) e.intents.length = 200;
    var ag = getAgent(intent.agentId);
    var after = Promise.resolve();
    if (d.verdict === 'needs_approval') {
      var risk = (e.policy.kinds[intent.kind].effect === 'money' || e.policy.kinds[intent.kind].effect === 'external') ? 'high' : 'medium';
      var apr = addApproval({
        agentId: ag ? ag.id : 'executive-assistant', agentName: ag ? ag.name : intent.agentId,
        title: 'إجراء مُراقَب: ' + intent.kind + (intent.amountUsd ? ' ($' + Number(intent.amountUsd) + ')' : ''),
        details: (intent.text || intent.target || 'بلا تفاصيل').slice(0, 400) + '\n\nالسياسة: ' + d.reasons.join(' '),
        risk: risk, actionType: 'broker_intent', payload: { intentId: intent.id }, _skipQuality: true
      });
      intent.approvalId = apr && apr.id ? apr.id : null;
    } else if (d.verdict === 'allow_auto') {
      after = engineExecute(intent.id);
    }
    engineChain('intent_' + intent.status, { id: intent.id, kind: intent.kind, agentId: intent.agentId, trust: intent.trust, code: intent.code, fingerprint: fp });
    saveState();
    return after.then(function () { return { intent: intent, status: 201 }; });
  }
  function engineFindIntent(id) { return engineState().intents.find(function (x) { return x.id === id; }) || null; }
  function engineIssueCapability(intent) {
    var e = engineState(), ttl = Number(e.policy.global.capabilityTtlMin || 15) * 60000;
    var cap = { id: 'cap-' + uuid().slice(0, 8), intentId: intent.id, kind: intent.kind, maxAmountUsd: Number(intent.amountUsd || 0), issuedAt: nowIso(), expiresAt: new Date(Date.now() + ttl).toISOString(), used: false };
    e.capabilities.unshift(cap);
    if (e.capabilities.length > 100) e.capabilities.length = 100;
    intent.capabilityId = cap.id;
    return cap;
  }
  var ENGINE_EXECUTORS = {
    read_report: function () { return Promise.resolve({ ok: true, summary: 'قراءة فقط — لا أثر.' }); },
    spend: function (i) {
      var entry = { id: 'fin-' + uuid().slice(0, 8), type: 'expense', title: tagValue('إنفاق مُراقَب: ' + (i.text || i.target || i.kind), 'إنفاق', 120), project: i.projectId || '', amountUsd: Number(i.amountUsd), date: nowIso().slice(0, 10), notes: 'intent ' + i.id };
      state.financialLedger.push(entry);
      var e = engineState(), k = engineTodayKey();
      e.spent[k] = Number(((e.spent[k] || 0) + entry.amountUsd).toFixed(2));
      return Promise.resolve({ ok: true, ledgerId: entry.id });
    },
    send_message: function (i) {
      return Promise.resolve(telegramNotify(String(i.text).slice(0, 900))).then(function () { return { ok: true, summary: 'أُرسلت عبر قناة الإشعارات.' }; });
    }
  };
  function engineExecute(intentId) {
    var e = engineState(), intent = engineFindIntent(intentId);
    if (!intent) return Promise.resolve({ ok: false, code: 'NOT_FOUND' });
    if (intent.status !== 'approved') return Promise.resolve({ ok: false, code: 'NOT_APPROVED' });
    var cap = intent.capabilityId ? e.capabilities.find(function (c) { return c.id === intent.capabilityId; }) : null;
    var kp = e.policy.kinds[intent.kind];
    if (!cap && kp && kp.effect !== 'read') return Promise.resolve({ ok: false, code: 'NO_CAPABILITY' });
    if (cap) {
      if (cap.used) return Promise.resolve({ ok: false, code: 'CAPABILITY_USED' });
      if (Date.parse(cap.expiresAt) < Date.now()) { intent.status = 'expired'; return Promise.resolve({ ok: false, code: 'CAPABILITY_EXPIRED' }); }
      cap.used = true;                                  /* one-shot: consumed before any effect */
    }
    /* Re-check the policy at execution time: limits or the kill switch may have changed. */
    var recheck = enginePolicyEvaluate(intent, { policy: e.policy, emergency: Boolean(state.emergencyMode), recentCount: 0, recentSameKind: 0, duplicate: false, spentToday: Number(e.spent[engineTodayKey()] || 0) });
    if (recheck.verdict === 'deny') {
      intent.status = 'denied'; intent.code = recheck.code; intent.reasons = recheck.reasons;
      engineChain('intent_blocked_at_execution', { id: intent.id, code: recheck.code });
      saveState();
      return Promise.resolve({ ok: false, code: recheck.code });
    }
    var run = ENGINE_EXECUTORS[intent.kind];
    if (!run) { intent.status = 'failed'; intent.result = { ok: false, code: 'NO_EXECUTOR' }; saveState(); return Promise.resolve(intent.result); }
    return run(intent).then(function (res) {
      intent.status = 'executed'; intent.result = res; intent.executedAt = nowIso();
      engineChain('intent_executed', { id: intent.id, kind: intent.kind, result: res });
      logAudit('intent_executed', intent.agentId, intent.kind + ' ' + (intent.amountUsd || ''), { id: intent.id });
      saveState();
      return res;
    }).catch(function (err) {
      intent.status = 'failed'; intent.result = { ok: false, code: 'EXECUTION_ERROR', message: String(err && err.message || err).slice(0, 160) };
      engineChain('intent_failed', { id: intent.id, code: 'EXECUTION_ERROR' });
      saveState();
      return intent.result;
    });
  }
  /* Called by the approvals route after the CEO decides. */
  function engineOnApproval(item) {
    if (!item || item.actionType !== 'broker_intent' || !item.payload) return Promise.resolve(null);
    var intent = engineFindIntent(item.payload.intentId);
    if (!intent || intent.status !== 'pending_approval') return Promise.resolve(null);
    if (item.status === 'rejected') {
      intent.status = 'rejected';
      engineChain('intent_rejected', { id: intent.id });
      saveState();
      return Promise.resolve({ ok: false, code: 'REJECTED' });
    }
    intent.status = 'approved';
    engineIssueCapability(intent);
    engineChain('capability_issued', { id: intent.id, capability: intent.capabilityId });
    return engineExecute(intent.id).then(function (res) {
      if (res && res.ok) item.executionResult = '✅ نُفِّذ عبر الوسيط: ' + (res.summary || res.ledgerId || 'تم');
      else item.executionResult = '⛔ أوقفه الوسيط عند التنفيذ: ' + ((res && (res.code || res.message)) || 'غير معروف');
      return res;
    });
  }
  var ENGINE_POLICY_NUMERIC = { maxAmountUsd: 1e6, dailyCapUsd: 1e6, maxChangePct: 100, minPrice: 1e6, maxPerHour: 1000 };
  function engineUpdatePolicy(b) {
    var e = engineState(), next = clone(e.policy), changed = [];
    if (b.global && typeof b.global === 'object') {
      ['maxIntentsPerHour', 'duplicateWindowMin', 'capabilityTtlMin'].forEach(function (k) {
        if (b.global[k] == null) return;
        var v = Number(b.global[k]);
        if (isFinite(v) && v >= 1 && v <= 1440) { next.global[k] = Math.floor(v); changed.push('global.' + k); }
      });
    }
    if (b.kinds && typeof b.kinds === 'object') {
      Object.keys(b.kinds).forEach(function (kind) {
        if (!next.kinds[kind] || !b.kinds[kind] || typeof b.kinds[kind] !== 'object') return;
        var src = b.kinds[kind];
        if (typeof src.enabled === 'boolean') { next.kinds[kind].enabled = src.enabled; changed.push(kind + '.enabled'); }
        Object.keys(ENGINE_POLICY_NUMERIC).forEach(function (f) {
          if (src[f] == null) return;
          var v = Number(src[f]);
          if (isFinite(v) && v >= 0 && v <= ENGINE_POLICY_NUMERIC[f]) { next.kinds[kind][f] = v; changed.push(kind + '.' + f); }
        });
        if (Array.isArray(src.allowedTargets)) { next.kinds[kind].allowedTargets = src.allowedTargets.slice(0, 20).map(function (t) { return tagValue(t, '', 160); }).filter(Boolean); changed.push(kind + '.allowedTargets'); }
        /* `auto` is deliberately not editable over the API: only read kinds run unattended. */
      });
    }
    if (!changed.length) return Promise.resolve({ error: 'لا تغييرات صالحة', status: 400 });
    e.policy = next;
    engineChain('policy_updated', { changed: changed });
    logAudit('policy_updated', 'ceo', changed.join(', ').slice(0, 120));
    saveState();
    return Promise.resolve({ policy: next, changed: changed, status: 200 });
  }

  /* ---------- routes ---------- */
  function engineSnapshot() {
    var e = engineState();
    var today = engineTodayKey();
    return engineVerifyChain().then(function (chk) {
      return {
        projects: e.projects.map(function (p) { return Object.assign({}, p, { metrics: engineMetrics(p), outcomes: engineOutcomes(p) }); }),
        forecasts: e.forecasts.slice(0, 30).map(function (f) { return Object.assign({}, f, { consensus: engineConsensus(f) }); }),
        leaderboard: engineLeaderboard(),
        questions: ENGINE_QUESTIONS,
        intents: e.intents.slice(0, 30),
        capabilities: e.capabilities.filter(function (c) { return !c.used && Date.parse(c.expiresAt) > Date.now(); }),
        policy: e.policy, spentToday: Number(e.spent[today] || 0),
        chain: { ok: chk.ok, length: e.chain.length, seq: e.chainSeq, head: e.chainHead, brokenAt: chk.brokenAt || null, tail: e.chain.slice(-8).reverse() }
      };
    });
  }
  function engineRoute(method, path, b) {
    if (path.indexOf('/api/engine/') !== 0) return null;
    function out(r) {
      var status = r.status || 200; delete r.status;
      return jsonResponse(r, status);
    }
    var m;
    if (method === 'GET' && path === '/api/engine/state') return engineSnapshot().then(function (s) { return jsonResponse(s); });
    if (method === 'GET' && path === '/api/engine/chain/verify') return engineVerifyChain().then(function (r) { return jsonResponse(r); });
    if (method === 'POST' && path === '/api/engine/projects') return Promise.resolve(out(engineCreateProject(b)));
    m = path.match(/^\/api\/engine\/projects\/([^/]+)\/status$/);
    if (method === 'POST' && m) return Promise.resolve(engineSetStatus(m[1], b)).then(out);
    m = path.match(/^\/api\/engine\/projects\/([^/]+)\/task$/);
    if (method === 'POST' && m) return Promise.resolve(out(engineAddTask(m[1], b)));
    if (method === 'POST' && path === '/api/engine/forecasts') return engineCreateForecast(b).then(out);
    /* Channel is fixed by the route: a request body can never claim to be the CEO. */
    if (method === 'POST' && path === '/api/engine/intents') return engineSubmitIntent(b, 'agent_output').then(out);
    if (method === 'POST' && path === '/api/engine/intents/ceo') return engineSubmitIntent(b, 'ceo_form').then(out);
    if (method === 'POST' && path === '/api/engine/policy') return engineUpdatePolicy(b).then(out);
    return Promise.resolve(jsonResponse({ error: 'Engine endpoint not found' }, 404));
  }

  /* ---------- self-install: wrap the existing API dispatcher (no edits to the api part) ---------- */
  (function installDecisionEngine() {
    var original = handleApi;
    handleApi = function (method, path, body) {
      var p = String(path || ''), qi = p.indexOf('?');
      if (qi >= 0) p = p.slice(0, qi);
      if (p.indexOf('/api/engine/') === 0) {
        if (CFG.requireUnlock && typeof isUnlocked === 'function' && !isUnlocked()) {
          return Promise.resolve(jsonResponse({ error: 'المكتب مقفل — أدخل كلمة السر أولاً.' }, 401));
        }
        if (state.emergencyMode && method !== 'GET') {
          return Promise.resolve(jsonResponse({ error: '🚨 وضع الطوارئ نشط — تنفيذ العمليات متوقف مؤقتاً.' }, 423));
        }
        return engineRoute(method, p, body || {});
      }
      var res = original(method, path, body);
      var m = p.match(/^\/api\/approvals\/([^/]+)\/decide$/);
      if (method === 'POST' && m) {
        /* A CEO decision on a broker intent issues (or withholds) a one-shot capability. */
        return Promise.resolve(res).then(function (resp) {
          if (!resp || !resp.ok) return resp;
          var item = (state.approvals || []).find(function (a) { return a.id === m[1]; });
          if (!item || item.actionType !== 'broker_intent' || item.status === 'pending') return resp;
          return engineOnApproval(item).then(function () { saveState(); return jsonResponse({ approval: item }); });
        });
      }
      return res;
    };
  })();
