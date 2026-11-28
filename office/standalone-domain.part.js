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

  /* Model output is untrusted text. Tags can only create structured proposals
     with bounded, plain-text fields — never markup or executable identifiers. */
  function tagValue(value, fallback, maxLen, pattern) {
    var s = String(value == null ? '' : value)
      .replace(/[\[\]<>]/g, '')
      .replace(/[\u0000-\u001f]/g, ' ')
      .trim().slice(0, maxLen || 120);
    if (pattern && !pattern.test(s)) s = fallback;
    return s || fallback;
  }
  function safeAgentId(value) {
    return tagValue(value, 'agent-' + uuid().slice(0, 6), 40, /^[A-Za-z0-9_-]{2,40}$/);
  }
  function safeRisk(value) {
    var r = String(value || '').toLowerCase();
    return ['low', 'medium', 'high'].indexOf(r) >= 0 ? r : 'medium';
  }

  function extractProposals(text) {
    var requests = [];
    var clean = String(text || '');
    clean = clean.replace(/\[APPROVAL_REQUEST\s+title="([^"]+)"(?:\s+risk="([^"]+)")?(?:\s+action="([^"]+)")?\]([\s\S]*?)\[\/APPROVAL_REQUEST\]/g, function (_, title, risk, action, details) {
      requests.push({
        title: tagValue(title, 'مقترح من وكيل', 120),
        risk: safeRisk(risk),
        actionType: tagValue(action, 'agent_proposal', 40, /^[a-z][a-z0-9_]{1,39}$/i),
        details: tagValue(details, '', 2000),
        payload: {}
      });
      return '';
    });
    clean = clean.replace(/\[HIRE_AGENT\s+id="([^"]+)"\s+name="([^"]+)"(?:\s+department="([^"]+)")?(?:\s+avatar="([^"]+)")?\]([\s\S]*?)\[\/HIRE_AGENT\]/g, function (_, id, name, dept, avatar, details) {
      var safeName = tagValue(name, 'موظف جديد', 60);
      var safeDept = tagValue(dept, 'فريق جديد', 80);
      var safeAvatar = tagValue(avatar, '🤖', 8);
      var safeDetails = tagValue(details, 'موظف ذكاء اصطناعي متخصص.', 2000);
      requests.push({ title: 'تعيين موظف جديد: ' + safeName, risk: 'medium', actionType: 'hire_agent', details: safeDetails, payload: { id: safeAgentId(id), name: safeName, department: safeDept, avatar: safeAvatar, roleDescription: safeDetails } });
      return '';
    });
    clean = clean.replace(/\[UPDATE_SKILLS\s+target="([^"]+)"(?:\s+title="([^"]+)")?\]([\s\S]*?)\[\/UPDATE_SKILLS\]/g, function (_, target, title, additions) {
      var safeTarget = safeAgentId(target);
      var safeAdditions = tagValue(additions, '', 2000);
      requests.push({ title: tagValue(title, 'تحديث مهارات ' + safeTarget, 120), risk: 'medium', actionType: 'update_skills', details: safeAdditions, payload: { targetAgentId: safeTarget, skillsAddition: safeAdditions } });
      return '';
    });
    clean = clean.replace(/\[MEMO\s+to="([^"]+)"(?:\s+subject="([^"]+)")?\]([\s\S]*?)\[\/MEMO\]/g, function (_, to, subject, body) {
      requests.push({ _type: 'memo', toId: safeAgentId(to), subject: tagValue(subject, 'مذكرة داخلية', 120), body: tagValue(body, '', 2000) });
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
    var payload = {
      text: String(text || '').slice(0, 4000),
      channel: channel || 'telegram',
      chatId: chatId || undefined,
      to: waTo || undefined
    };
    if (!payload.text) return Promise.resolve({ ok: false, error: 'الرسالة فارغة.' });
    if (!settings.relayUrl) return Promise.resolve({ ok: false, error: 'أدخل Supabase Relay URL في لوحة الاتصال.' });
    if (!messagingAuthOk()) { authRequiredNotice(); return Promise.resolve({ ok: false, error: 'identity required' }); }
    /* Always use the signed-in Google user's JWT. No anon token and no owner
       key is used for messaging — identities belong to the current account. */
    return secureRelay('message', payload);
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

  /* ── simulator: deterministic Monte Carlo instead of fixed multipliers ── */
  function seededRng(seedText) {
    var seed = 2166136261;
    String(seedText || '').split('').forEach(function (ch) { seed = (seed ^ ch.charCodeAt(0)) * 16777619 >>> 0; });
    if (!seed) seed = 0x9e3779b9;
    return function () {
      seed ^= seed << 13; seed >>>= 0;
      seed ^= seed >> 17;
      seed ^= seed << 5; seed >>>= 0;
      return seed / 4294967296;
    };
  }
  function triangular(rng, min, max) {
    return min + (max - min) * ((rng() + rng() + rng()) / 3);
  }
  function simulationScenario(key, label, customers, probabilityPct, fixed, ad, price, apiCost) {
    var revenue = Number((customers * price).toFixed(2));
    var totalApiCost = Number((customers * apiCost).toFixed(2));
    var totalCost = Number((fixed + ad + totalApiCost).toFixed(2));
    var netProfit = Number((revenue - totalCost).toFixed(2));
    return {
      key: key, label: label, customers: customers, probabilityPct: probabilityPct,
      revenue: revenue, totalApiCost: totalApiCost, totalCost: totalCost,
      netProfit: netProfit, roiPct: totalCost > 0 ? Number(((netProfit / totalCost) * 100).toFixed(1)) : 0
    };
  }
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
    var baseCustomers = Math.max(1, Math.round((ad / cpc) * conv));

    var rawProbs = Array.isArray(input.probabilities) ? input.probabilities : String(input.probabilities || '25,50,25').split(/[,،\s]+/);
    var probs = [0, 1, 2].map(function (i) { return Math.max(0, num(rawProbs[i], [25, 50, 25][i])); });
    var probTotal = probs.reduce(function (a, b) { return a + b; }, 0) || 100;
    probs = probs.map(function (p) { return Math.round(p / probTotal * 100); });

    var bands = [
      { key: 'conservative', label: 'متحفظ 🐢', min: 0.35, max: 0.8 },
      { key: 'realistic', label: 'واقعي ⚖️', min: 0.8, max: 1.25 },
      { key: 'optimistic', label: 'متفائل 🚀', min: 1.25, max: 2.0 }
    ];
    var rng = seededRng([fixed, ad, price, apiCost, cpc, conv, probs.join('-')].join('|'));
    var trials = 600, samples = [];
    for (var i = 0; i < trials; i++) {
      var u = rng() * 100, band = bands[2], cumulative = probs[0] + probs[1];
      if (u < probs[0]) band = bands[0];
      else if (u < cumulative) band = bands[1];
      var customers = Math.max(1, Math.round(baseCustomers * triangular(rng, band.min, band.max)));
      var revenue = customers * price;
      var cost = fixed + ad + customers * apiCost;
      samples.push({ customers: customers, net: Number((revenue - cost).toFixed(2)), band: band.key });
    }
    samples.sort(function (a, b) { return a.customers - b.customers; });
    function quantile(q) { return samples[Math.min(samples.length - 1, Math.floor(q * samples.length))].customers; }
    var q10 = quantile(0.1), q50 = quantile(0.5), q90 = quantile(0.9);
    var scenarios = bands.map(function (band, idx) {
      return simulationScenario(band.key, band.label, [q10, q50, q90][idx], probs[idx], fixed, ad, price, apiCost);
    });
    var actualRevenue = (state.financialLedger || []).filter(function (e) { return e.type === 'revenue'; }).reduce(function (a, e) { return a + num(e.amountUsd, 0); }, 0);
    var actualCost = (state.financialLedger || []).filter(function (e) { return e.type === 'expense'; }).reduce(function (a, e) { return a + num(e.amountUsd, 0); }, 0) + num(state.usageStats && state.usageStats.totalCostUsd, 0);
    return {
      projectName: input.projectName || 'مشروع جديد',
      inputs: { fixed: fixed, ad: ad, price: price, apiCost: apiCost, cpc: cpc, conversionRatePct: conv * 100, probabilities: probs },
      method: 'Monte Carlo — ' + trials + ' تجربة بمولّد عشوائي ثابت (P10 / P50 / P90)',
      contributionMargin: Number(contributionMargin.toFixed(2)),
      breakEvenCustomers: breakEven,
      scenarios: scenarios,
      plannedVsActual: {
        projectedNet: scenarios[1].netProfit,
        actualRevenue: Number(actualRevenue.toFixed(2)),
        actualCost: Number(actualCost.toFixed(2)),
        actualNet: Number((actualRevenue - actualCost).toFixed(2)),
        source: 'financialLedger + usageStats'
      },
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
  var REQUEST_ACTION_RX = /(أريد|اريد|أبغى|ابغى|عايز|عيز|بغيت|ودّي|ودي|أنفّذ|نفّذ|نفذ|اعمل|إعمل|سوي|سوّي|جهّز|جاهز|نجهز|نجّز|نجهّز|اكتب|نكتب|حلّل|حلل|نحلّل|نحلل|ابحث|دوّر|دور|فتّش|فتش|أنشئ|انشئ|أطلق|اطلق|أرسل|ارسل|نرسل|انشر|ننشر|ادفع|ندفع|راجع|نراجع|افحص|قارن|لخّص|لخص|عدّل|عدل|نعدّل|نعدل|حدّث|حدث|نحدّث|نحدث|أضف|نضيف|أزل|احذف|استخرج|صدّر|احسب|نحسب|خطّط|خطط|نخطّط|نخطط|افهم|فهم)/iu;
  var REQUEST_OUTPUT_RX = /(تقرير|خطة|مخطط|منتج|تطبيق|موقع|صفحة|حملة|إعلان|عقد|اتفاقية|جدول|ميزانية|بحث|دراسة|تحليل|مراجعة|تقييم|مسودة|اقتراح|قائمة|نموذج|نظام|بوت|محتوى|رسالة|إشعار|تذكرة|حل|خطوات)/iu;
  var REQUEST_HIGH_RX = /(دفع\s|تحويل\s|مصروف|توقيع\s+عقد|إبرام\s+عقد|نشر\s+عام|نشر\s+خارجي|منح\s+صلاحية|تغيير\s+صلاحية|صلاحيات\s+جديدة|بيانات\s+سرية|حذف\s+بيانات|ربط\s+خارجي|webhook|api\s*key)/iu;
  var REQUEST_NEGATION_RX = /(?<![\p{L}\p{N}])(?:مش|مو|ليس|لا|غير|بدون|عادي|مجرد)(?![\p{L}\p{N}])/iu;

  /* A phrase like "مش حملة نشر عام" is a clarification, not a dangerous
     order. Remove negated clauses before risk classification. */
  function stripNegated(text) {
    return String(text || '')
      .replace(/(?<![\p{L}\p{N}])(?:مش|مو|ليس|لا|غير|بدون)(?![\p{L}\p{N}])\s+[^.؛;،,!?؟\n]{0,80}/giu, ' ')
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
    /* A dot inside a decimal ($49.99) or domain (md1usd.com) is not a
       sentence boundary. */
    var parts = original.split(/(?<![0-9])\.(?![0-9])|[?؟؛;\n،,]+|\s+و\s+/u).map(function (x) { return String(x || '').trim(); }).filter(function (x) { return x.length > 3; });
    if (!parts.length) parts = [original];
    var items = [];
    var constraints = [];
    parts.forEach(function (part) {
      var stripLead = /^(?:و\s*|ثم\s+|بس\s+|لكن\s+|أو\s+|او\s+|فـ\s+|ف\s+)/u;
      var rawPart = String(part).replace(stripLead, '').trim();
      var nd = normalizeDialect(rawPart).normalized.trim();
      var actionable = REQUEST_ACTION_RX.test(nd) || REQUEST_OUTPUT_RX.test(nd);
      var context = /^(?:يا|أيها|ايها)\s+/u.test(nd);
      var clarification = !actionable && (REQUEST_NEGATION_RX.test(nd) || context);
      /* Preserve the user's original spelling in the ledger and task title. */
      var text = rawPart.replace(/^(?:أريد|اريد|أبغى|ابغى|عايز|عيز|بغيت|ودّي|ودي|لازم|لازمه|أنفّذ|نفّذ|نفذ|اعمل|إعمل|سوي|سوّي)\s+/iu, '').trim() || rawPart;
      var riskText = stripNegated(nd);
      if (clarification) constraints.push((context ? 'السياق: ' : 'توضيح: ') + String(text).slice(0, 120));
      items.push({
        id: 'ri-' + uuid().slice(0, 6),
        text: String(text).slice(0, 240),
        status: actionable || clarification ? 'understood' : 'unclear',
        reason: clarification ? 'توضيح/سياق — لا يحتاج مهمة منفصلة.' : (actionable ? '' : 'لم أحدد فعلاً أو مخرجاً واضحاً في هذا الجزء.'),
        agentId: routeRequestAgent(nd),
        risk: REQUEST_HIGH_RX.test(riskText) ? 'high' : (/مال|ميزانيه|ميزانية|تكلفه|تكلفة|سعر|ربح|فاتوره|فاتورة/.test(riskText) ? 'medium' : 'low'),
        taskId: null,
        approvalId: null,
        result: clarification ? (context ? 'سياق مفهوم — لا يُنفَّذ كأمر منفصل' : 'توضيح مفهوم — لا يُنفَّذ كأمر منفصل') : null,
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
          status: 'queued', createdAt: nowIso(),
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
    if (typeof startTaskRunner === 'function') startTaskRunner();
    return Promise.resolve(e.executionSummary);
  }

  /* ── advanced smart assistant (dialect → understanding → roles) ───────── */
  var assistantSession = null;

  /* \b is ASCII-only; Arabic words need Unicode letter/number boundaries. */
  function arabicWordRx(words) {
    return new RegExp('(?<![\\p{L}\\p{N}_])(?:' + words + ')(?![\\p{L}\\p{N}_])', 'giu');
  }
  var DIALECT_RULES = [
    [arabicWordRx('أبغى|ابغى|عايز|عيز|أريد|اريد|بغيت|ودّي|ودي|أبغاك|ابغاك'), 'أريد'],
    [arabicWordRx('شيف|شوف|إعمل|اعمل|سوي|سوّي|نفّذ|نفذ'), 'أنفّذ'],
    [arabicWordRx('بكره|بكرا|غدا'), 'غداً'],
    [arabicWordRx('دلوقتي|دلوقت|هلوقتي|الآن'), 'الآن'],
    [arabicWordRx('مزبون|زبون|عميل|كليانت'), 'عميل'],
    [arabicWordRx('فلوس|فلاوس|مال|مصاريف'), 'ميزانية'],
    [arabicWordRx('شغل|وظيفة|مهمة|task'), 'مهمة'],
    [arabicWordRx('مفيش|مافي|ما عندي|مش عندي'), 'لا يوجد'],
    [arabicWordRx('كده|كذا|هيك|هكذا'), 'هكذا'],
    [arabicWordRx('قريب|قريبا|سريع|بسرعة|بالسرعة'), 'بسرعة'],
    [arabicWordRx('اتصل|اتصلت|تواصل|راسل'), 'تواصل'],
    [arabicWordRx('دوّر|دور|ابحث|ابحت|فتّش'), 'ابحث']
  ];

  /* `normalized` is only for analysis/routing. Callers must display/store
     `raw` for task titles and ledger text so dialect spelling is not lost. */
  function normalizeDialect(message) {
    var raw = String(message || '').trim();
    var out = raw;
    var changes = [];
    DIALECT_RULES.forEach(function (rule) {
      var next = out.replace(rule[0], rule[1]);
      if (next !== out) { out = next; changes.push(rule[1]); }
    });
    var analysis = out.replace(/[أإآ]/gu, 'ا').replace(/ة(?=\s|$)/gu, 'ه');
    return { raw: raw, normalized: analysis, changes: changes };
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
    var riskLower = String(stripNegated(norm || '')).toLowerCase();
    if (/دفع|جات|تحويل|مصروف/i.test(riskLower)) risks.push('أي دفع مالي يحتاج موافقة صريحة');
    if (/نشر|اعلان/i.test(riskLower)) risks.push('النشر الخارجي يحتاج مراجعة مالية وقانونية');
    if (/عقد|قانون|ضريبه|خصوصيه/i.test(riskLower)) risks.push('مراجعة المستشار القانوني والمحاسب القانوني إلزامية');
    if (/بيانات|صلاحيه|امان/i.test(riskLower)) risks.push('مراجعة مسؤول الأمان قبل منح صلاحيات جديدة');

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
    var picks = uniqueStrings(parts.filter(function (x) { return hardRx.test(x); })).slice(0, 4);
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

  function distributeRoles(u, research, ledgerItems) {
    var byAgent = {};
    var riskText = [u.goal, u.deliverables, (u.risks || []).join(' ')]
      .map(function (x) { return stripNegated(String(x || '')); }).join(' ');
    var riskFlag = REQUEST_HIGH_RX.test(riskText);
    var title = String(u.deliverables || u.goal || 'مهمة جديدة').split(/[،,]/)[0].trim().slice(0, 110) || 'تنفيذ طلب المدير';
    var researchLine = (research || []).map(function (r) { return r.task + ' (' + r.engine + ')'; }).slice(0, 3).join('؛ ');
    var itemTitles = {};
    (ledgerItems || []).forEach(function (it) {
      if (it && it.status === 'understood' && it.clarification !== true && it.agentId && !itemTitles[it.agentId]) {
        itemTitles[it.agentId] = String(it.text || '').slice(0, 110);
      }
    });

    function riskRank(r) { return r === 'high' ? 3 : (r === 'medium' ? 2 : 1); }
    function add(agentId, reason, risk, suffix) {
      var ag = getAgent(agentId); if (!ag) return;
      if (!byAgent[agentId]) byAgent[agentId] = { agentId: agentId, agentName: ag.name, avatar: ag.avatar, taskTitle: itemTitles[agentId] || title, details: [], reason: reason, risk: risk || 'medium' };
      if (risk && riskRank(risk) > riskRank(byAgent[agentId].risk)) byAgent[agentId].risk = risk;
      if (suffix && byAgent[agentId].details.indexOf(suffix) === -1 && suffix !== byAgent[agentId].taskTitle) byAgent[agentId].details.push(suffix);
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
    /* Every understood item from the CEO's own words must appear in the plan,
       even when the live model's summary did not mention that department. */
    (ledgerItems || []).forEach(function (it) {
      if (!it || it.status !== 'understood' || it.clarification === true || !it.agentId) return;
      var t = stripNegated(String(it.text || ''));
      var itemRisk = REQUEST_HIGH_RX.test(t) ? 'high' : (/مال|ميزانيه|ميزانية|تكلفه|تكلفة|سعر|ربح|فاتوره|فاتورة/.test(t) ? 'medium' : 'low');
      add(it.agentId, 'مهمة طلبها المدير صراحةً', itemRisk, String(it.text || '').slice(0, 110));
    });

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
      s.plan = distributeRoles(s.understanding, research, s.items);
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
      state.tasks.unshift({ id: 'tsk-' + uuid().slice(0, 8), agentId: p.agentId, title: p.taskTitle, description: p.details + '\n\nالسبب: ' + p.reason, status: 'queued', createdAt: nowIso(), ledgerId: s.ledgerId });
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
    if (typeof startTaskRunner === 'function') startTaskRunner();
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
  var SNAPSHOT_VERSION = '2.1.0';
  var LEGACY_SNAPSHOT_SALT = 'mdm1-office-salt-v1';
  /* Passphrase is mandatory. New snapshots get a random 16-byte salt stored
     with the record; the fixed legacy salt is only for decrypting old files. */
  function deriveKey(passphrase, saltBytes, iterations) {
    var pass = String(passphrase || '');
    if (!pass) return Promise.reject(new Error('كلمة مرور النسخة مطلوبة — لا توجد كلمة افتراضية'));
    var enc = new TextEncoder();
    var salt = saltBytes && saltBytes.length ? saltBytes : enc.encode(LEGACY_SNAPSHOT_SALT);
    return crypto.subtle.importKey('raw', enc.encode(pass), { name: 'PBKDF2' }, false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: iterations || 150000, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
    });
  }
  function snapshotSalt(rec) {
    return rec && rec.salt ? unb64(rec.salt) : null;
  }
  /* Old snapshots used the fixed salt and 120k iterations. Try both so the
     security upgrade never strands existing backup files. */
  function decryptSnapshotRecord(rec, passphrase) {
    var iv = unb64(rec.iv), data = unb64(rec.data), salt = snapshotSalt(rec);
    return deriveKey(passphrase, salt, 150000).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
    }).catch(function (e) {
      if (salt) throw e;
      return deriveKey(passphrase, null, 120000).then(function (legacyKey) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, legacyKey, data);
      });
    });
  }
  function createSnapshot(label, passphrase) {
    var payload = clone(state);
    delete payload.snapshots;
    payload.__snapshot = { label: label, createdAt: nowIso(), version: SNAPSHOT_VERSION };
    var json = JSON.stringify(payload);
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return deriveKey(passphrase, salt).then(function (key) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(json)).then(function (cipher) {
        var record = {
          id: 'snap-' + uuid().slice(0, 8),
          label: label || 'نسخة احتياطية',
          alg: 'AES-256-GCM',
          fileCount: 1,
          size: cipher.byteLength,
          createdAt: nowIso(),
          version: SNAPSHOT_VERSION,
          salt: b64(salt),
          iv: b64(iv),
          data: b64(cipher)
        };
        var snaps = readLS(LS_SNAPS, []);
        snaps.unshift(record);
        snaps = snaps.slice(0, 5);
        writeLS(LS_SNAPS, snaps);
        state.snapshots = snaps.map(function (s) { return { id: s.id, label: s.label, alg: s.alg, fileCount: s.fileCount, size: s.size, createdAt: s.createdAt }; });
        logAudit('snapshot_created', 'ceo', 'Encrypted snapshot ' + record.id + ' (salt per snapshot, PBKDF2 150k)');
        saveState();
        return record;
      });
    });
  }
  function restoreSnapshot(id, passphrase) {
    var snaps = readLS(LS_SNAPS, []);
    var rec = snaps.find(function (s) { return s.id === id; });
    if (!rec) return Promise.reject(new Error('النسخة غير موجودة'));
    return decryptSnapshotRecord(rec, passphrase).then(function (plain) {
      var payload = JSON.parse(new TextDecoder().decode(plain));
      var snapVersion = (payload.__snapshot && payload.__snapshot.version) || '1.0.0';
      var snapsMeta = state.snapshots;
      /* Always keep a rollback point before time-travel replaces state. */
      return createSnapshot('نقطة تراجع تلقائية قبل استعادة ' + id, passphrase).then(function (rollback) {
        state = Object.assign(initialState(), payload);
        state.snapshots = snapsMeta;
        saveNow();
        logAudit('snapshot_restored', 'ceo', 'Time-travel rollback to ' + id + (snapVersion !== SNAPSHOT_VERSION ? ' (compat ' + snapVersion + ')' : '') + ' — rollback ' + rollback.id);
        return { restoredCount: 1, snapshotDate: rec.createdAt, version: snapVersion, rollbackId: rollback.id };
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
    return decryptSnapshotRecord(record, passphrase).then(function (plain) {
      var payload = JSON.parse(new TextDecoder().decode(plain));
      if (!payload || typeof payload !== 'object') throw new Error('محتوى النسخة غير مقروء');
      var rec = {
        id: record.id && /^snap-[A-Za-z0-9-]+$/.test(record.id) ? record.id : 'snap-' + uuid().slice(0, 8),
        label: String(record.label || (payload.__snapshot && payload.__snapshot.label) || 'نسخة مستوردة'),
        alg: 'AES-256-GCM',
        fileCount: num(record.fileCount, 1),
        size: num(record.size, 0) || String(record.data || '').length,
        createdAt: record.createdAt || nowIso(),
        version: record.version || (payload.__snapshot && payload.__snapshot.version) || '1.0.0',
        salt: record.salt || null,
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
      var doneTasks = (state.tasks || []).filter(function (t) { return t.agentId === a.id && (t.status === 'done' || t.status === 'completed'); }).length;
      var approved = (state.approvals || []).filter(function (ap) { return ap.agentId === a.id && ap.status === 'approved'; }).length;
      var rejected = (state.approvals || []).filter(function (ap) { return ap.agentId === a.id && ap.status === 'rejected'; }).length;
      /* Points now follow evidence of completed work and clean approvals —
         chat volume alone never earns an automatic promotion. */
      var earned = Math.max(0, Math.min(50, doneTasks * 6 + approved * 4 - rejected * 3));
      var res = earned ? awardPoints(a.id, earned, 'KPI أسبوعي مبني على ' + doneTasks + ' مهمة منجزة و' + approved + ' موافقة') : { profile: ensureProfile(a.id) };
      return '- ' + a.name + ': +' + earned + ' نقطة (' + doneTasks + ' مهمة منجزة، ' + approved + ' موافقة، ' + rejected + ' رفض) — الإجمالي: ' + res.profile.points + ' | ' + res.profile.rankTitle;
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
        '🔐 الخزنة: ' + (vault.exists ? 'مفعّلة' : 'غير مفعّلة') + (vault.unlocked ? ' — مفتوحة' : vault.exists ? ' — مقفلة' : ''),
        '🛡️ فحص الأمان: ' + (sec && Array.isArray(sec.findings) ? sec.findings.length + ' ملاحظة' : 'تم'),
        '📊 الحصة: ' + (q && q.calls != null ? q.calls + ' طلب / ' + (q.tokens || 0) + ' tok' : 'لا توجد بيانات'),
        '☁️ السحابة: معطّلة (مفاتيحك أنت فقط)',
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