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
      var portalToken = 'pl_' + bytesToB64u(crypto.getRandomValues(new Uint8Array(48)));
      var summary = {
        name: String(b.name).trim().slice(0, 80), projectTitle: String(b.projectTitle || 'مشروع جديد').trim().slice(0, 120),
        stage: b.stage || 'عميل محتمل', totalValueUsd: num(b.totalValueUsd, 0), paidUsd: 0, tasks: []
      };
      return secureRelay('portal_create', { token: portalToken, summary: summary, ttlHours: 72 }).then(function () {
        var cust = {
          id: 'cust-' + uuid().slice(0, 8), portalToken: portalToken, name: String(b.name).trim(), contactName: String(b.contactName || '').trim(),
          email: String(b.email || '').trim(), phone: String(b.phone || '').trim(), stage: b.stage || 'عميل محتمل', projectTitle: String(b.projectTitle || 'مشروع جديد').trim(),
          totalValueUsd: num(b.totalValueUsd, 0), paidUsd: 0, assignedTo: b.assignedTo || 'marketing-lead', notes: String(b.notes || '').trim(), createdAt: nowIso().slice(0, 10)
        };
        state.customers.unshift(cust);
        logAudit('crm_customer_added', 'ceo', 'Added customer ' + cust.name, { portalCreated: true });
        saveState();
        return jsonResponse({ customer: cust }, 201);
      }).catch(function (e) {
        return jsonResponse({ error: 'تعذّر إنشاء رابط البوابة في Supabase: ' + e.message }, 502);
      });
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
      /* Durable queue: GitHub Actions keeps deterministic work moving while the
         page is closed. Model work still requires the user's own device key. */
      queueAdd({ taskId: task.id, agentId: ag.id, title: task.title, action: 'mark_done' }, 'task', null).catch(function () { return null; });
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
      return relayApi('portal_get', { token: token }).then(function (j) {
        return jsonResponse(j.summary || j);
      }).catch(function (e) {
        return jsonResponse({ error: /expired|404|410/i.test(e.message) ? 'رابط البوابة غير صالح أو منتهي.' : e.message }, 404);
      });
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