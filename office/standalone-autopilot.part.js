  /* ==========================================================================
     Autopilot ("أتمتة العمل") + Start-here guide + live page reading (pwa35)
     --------------------------------------------------------------------------
     • Reads real web pages the CEO mentions (e.g. https://mdm1.org/) and hands
       the extracted text to the agent, so answers rest on what is really there.
     • Autopilot runs cycles by itself while the app is open and resumes from
       where it stopped when it is reopened. Every cycle does real work with the
       user's own model key: discover real projects -> analyse one -> save leads
       found by live search -> write the campaign file -> open an approval for
       anything that leaves the company. It never takes a permission silently:
       when a key or an account link is missing it says so and waits.
     ========================================================================== */
  var AP_DEFAULT_SITE = 'https://mdm1.org/';
  /* Products the CEO confirmed are real and sell best as a service (custom setup,
     installation, training, support) — they are analysed first. */
  var AP_SEEDS = [
    'https://mdm1.org/apps/offline-invoice-crm.html',
    'https://mdm1.org/apps/offline-store-catalog.html',
    'https://mdm1.org/apps/seo-atlas-local.html'
  ];
  var AP_GAP_MS = 4 * 60 * 1000;          // between cycles while there is work
  var AP_ROUND_GAP_MS = 60 * 60 * 1000;   // after a full round, look for news hourly
  var apBusy = false, apTimer = null, apWake = null;

  function apState() {
    if (!state.autopilot || typeof state.autopilot !== 'object') {
      state.autopilot = { enabled: false, goal: '', cycle: 0, nextAt: 0, projects: [], analyzed: {}, log: [], needs: '', startedAt: null, leads: 0, campaigns: 0 };
    }
    var a = state.autopilot;
    if (!Array.isArray(a.projects)) a.projects = [];
    if (!Array.isArray(a.log)) a.log = [];
    if (!a.everAnalyzed || typeof a.everAnalyzed !== 'object') a.everAnalyzed = {};
    if (!a.analyzed || typeof a.analyzed !== 'object') a.analyzed = {};
    return a;
  }
  function apLog(msg, kind) {
    var a = apState();
    a.log.unshift({ t: nowIso(), m: String(msg).slice(0, 320), k: kind || 'info' });
    a.log = a.log.slice(0, 60);
    saveState();
    apRender();
  }

  /* ── reading real pages ─────────────────────────────────────────────── */
  function extractUrls(text) {
    var out = [], t = String(text || '');
    t.replace(/https?:\/\/[^\s<>"'،)]+/gi, function (u) {
      u = u.replace(/[.,;:!?؟]+$/, '');
      if (out.indexOf(u) === -1) out.push(u);
      return u;
    });
    t.replace(/(?:^|[\s(])((?:[a-z0-9-]+\.)+(?:org|com|net|io|app|ai|dev))(?=$|[\s),.،؟?!/])/gi, function (m, d) {
      if (!out.some(function (x) { return x.toLowerCase().indexOf(d.toLowerCase()) !== -1; })) out.push('https://' + d + '/');
      return m;
    });
    return out.slice(0, 2);
  }
  function fetchTextWithTimeout(url, ms, headers) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? window.setTimeout(function () { ctl.abort(); }, ms || 15000) : null;
    return fetch(url, { cache: 'no-store', headers: headers || {}, signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (timer) window.clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }, function (e) { if (timer) window.clearTimeout(timer); throw e; });
  }
  /* Same-origin pages (mdm1.org) are read directly; other sites go through a
     free public reader that returns plain text — no key, no account. */
  function fetchPage(url) {
    return fetchTextWithTimeout(url, 15000).then(function (html) {
      return parsePage(html, url);
    }).catch(function (firstErr) {
      return fetchTextWithTimeout('https://r.jina.ai/' + url, 25000, { Accept: 'text/plain' }).then(function (txt) {
        var title = (txt.match(/^Title:\s*(.+)$/m) || [])[1] || url;
        return { url: url, title: title.trim(), description: '', headings: [], links: [], text: txt.replace(/^(Title|URL Source|Markdown Content):.*$/gm, '').trim().slice(0, 4500) };
      }).catch(function () { throw new Error(firstErr && firstErr.message || 'تعذّر فتح الصفحة'); });
    });
  }
  function parsePage(html, url) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var base; try { base = new URL(url); } catch (e) { base = null; }
    var meta = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
    var links = [];
    Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) {
      try {
        var u = new URL(a.getAttribute('href'), url);
        if (base && u.host !== base.host) return;
        if (!/^https?:$/.test(u.protocol)) return;
        u.hash = '';
        var href = u.href;
        if (/\.(?:png|jpe?g|webp|svg|css|js|json|zip|pdf|ico|woff2?)$/i.test(u.pathname)) return;
        if (/(login|signin|signup|logout|privacy|terms|cookies|policy|account|admin|\/office\/?$)/i.test(u.pathname)) return;
        if (u.pathname === '/' || u.pathname === (base && base.pathname)) return;
        var text = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!links.some(function (l) { return l.href === href; })) links.push({ href: href, text: text });
      } catch (e) { /* ignore bad href */ }
    });
    Array.prototype.forEach.call(doc.querySelectorAll('script,style,noscript,svg,iframe,nav,footer'), function (n) { n.remove(); });
    var heads = Array.prototype.map.call(doc.querySelectorAll('h1,h2,h3'), function (h) { return (h.textContent || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean).slice(0, 14);
    return {
      url: url,
      title: ((doc.title || '') + '').trim() || url,
      description: meta ? (meta.getAttribute('content') || '').trim() : '',
      headings: heads,
      links: links.slice(0, 40),
      text: ((doc.body && doc.body.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 4500)
    };
  }
  function pageContext(p) {
    return '— ' + p.url + '\nالعنوان: ' + p.title + (p.description ? '\nالوصف: ' + p.description : '') +
      (p.headings.length ? '\nالعناوين: ' + p.headings.join(' | ') : '') +
      (p.links.length ? '\nروابط داخلية: ' + p.links.slice(0, 20).map(function (l) { return (l.text || '·') + ' → ' + l.href; }).join(' ; ') : '') +
      '\nالنص: ' + p.text.slice(0, 2600);
  }
  /* Called by aiGenerate: adds what was really read from the pages the CEO named. */
  function urlsContextFor(text) {
    var urls = extractUrls(text);
    if (!urls.length) return Promise.resolve('');
    return Promise.all(urls.map(function (u) {
      return fetchPage(u).then(function (p) { return pageContext(p); }).catch(function (e) {
        return '— ' + u + '\nتعذّر سحب هذه الصفحة (' + e.message + '). لا تدّعِ أنك قرأتها.';
      });
    })).then(function (parts) {
      return '=== محتوى صفحات سُحب فعلاً الآن (اعتمد عليه) ===\n' + parts.join('\n\n');
    });
  }

  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item'; }
  function parseJsonLoose(t) {
    var m = String(t || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
  }

  /* ── cycle steps ────────────────────────────────────────────────────── */
  function apSite() { var u = extractUrls(apState().goal)[0]; return u || AP_DEFAULT_SITE; }

  function apDiscover() {
    var a = apState(), site = apSite();
    apLog('أسحب الموقع ' + site + ' لحصر المشاريع الحقيقية...');
    return fetchPage(site).then(function (home) {
      var seen = {}, cands = [];
      AP_SEEDS.concat(home.links.slice(0, 14).map(function (l) { return l.href; })).forEach(function (h) {
        if (site.indexOf('mdm1.org') === -1 && AP_SEEDS.indexOf(h) !== -1) return;
        if (!seen[h]) { seen[h] = true; cands.push({ href: h, text: '' }); }
      });
      return Promise.all(cands.map(function (l) {
        return fetchPage(l.href).then(function (p) {
          return { title: (p.title || l.text || l.href).slice(0, 90), url: l.href, summary: (p.description || p.text).slice(0, 260) };
        }).catch(function () { return null; });
      })).then(function (rows) {
        var projects = rows.filter(function (x) { return x && x.summary; });
        if (!projects.length) projects = [{ title: home.title.slice(0, 90), url: site, summary: (home.description || home.text).slice(0, 260) }];
        a.projects = projects;
        a.analyzed = Object.assign({}, a.everAnalyzed);
        var md = '# مشاريع ' + site + ' (مسحوبة فعلياً)\n\n' + projects.map(function (p, i) { return (i + 1) + '. [' + p.title + '](' + p.url + ')\n   ' + p.summary; }).join('\n') + '\n';
        writeExport('autopilot-projects.md', md);
        state.teamChat.push({ id: uuid(), senderId: 'web-research-team', senderName: 'فريق البحث (الأتمتة 🤖)', senderAvatar: '🤖', role: 'assistant', text: '📚 حصرت ' + projects.length + ' صفحة/مشروع من ' + site + ':\n' + projects.map(function (p) { return '• ' + p.title + ' — ' + p.url; }).join('\n'), timestamp: nowIso() });
        apLog('حصرت ' + projects.length + ' صفحة/مشروع حقيقي من الموقع.', 'ok');
      });
    });
  }

  function apAnalyze(p) {
    var a = apState();
    var agent = getAgent('web-research-team');
    apLog('أحلّل: ' + p.title);
    return fetchPage(p.url).catch(function () { return { url: p.url, title: p.title, description: p.summary, headings: [], links: [], text: p.summary }; }).then(function (page) {
      var prompt = 'حلّل هذا المشروع الحقيقي لتحقيق مبيعات وأرباح. أعد JSON فقط بدون أي نص آخر بالشكل:\n' +
        '{"offer":"عرض بيع واضح بجملتين","audience":"الجمهور المناسب لهذا المشروع تحديداً","priceUsd":رقم تقديري لرسوم الإعداد لمرة واحدة,"supportUsd":رقم تقديري اختياري للدعم الشهري أو 0,"services":["تخصيص","تركيب","تدريب","دعم"],"channels":["قناة1","قناة2"],"queries":["عبارة بحث إنجليزية عن عملاء محتملين","عبارة ثانية"],"outreach":"رسالة تواصل جاهزة قصيرة","post":"منشور ترويج جاهز","fit":رقم من 1 إلى 10,"why":"سبب التقييم بجملة"}\n\n' +
        'قواعد النموذج التجاري: هذه المنتجات أدوات تعمل محلياً في المتصفح (تحقق من نص الصفحة). أفضل مسار ربح هو بيع إعداد مخصص للنشاط (اسم وشعار وحقول وتقارير) مع التركيب والتدريب والدعم، وليس ادعاء أنها خدمة SaaS باشتراك شهري إلا إذا أثبتت الصفحة وجود حسابات وخادم. الأسعار تقديرية وصرّح بذلك، ولا تذكر مبيعات أو عملاء سابقين غير موثقين.\n\n' +
        'هدف المدير: ' + (a.goal || 'تحقيق أرباح من مشاريع موقعنا') + '\nالمشروع: ' + p.title + '\n' + pageContext(page);
      return aiGenerate({ agentId: agent ? agent.id : 'web-research-team', messages: [{ role: 'user', text: prompt }], _urlDone: true });
    }).then(function (r) {
      recordUsage('web-research-team', r.usage);
      if (r.mode !== 'live') throw new Error('النموذج غير متصل — ' + (r.warning || 'تحقق من المفتاح'));
      var j = parseJsonLoose(r.text) || {};
      var offer = j.offer || String(r.text || '').slice(0, 400);
      var qs = (Array.isArray(j.queries) ? j.queries : []).slice(0, 2);
      return Promise.all(qs.map(function (q) { return webSearch(q).catch(function () { return { results: [] }; }); })).then(function (found) {
        var added = 0;
        found.forEach(function (f) {
          (f.results || []).forEach(function (x) {
            if (added >= 4 || !x.url || /wikipedia\.org|wikimedia/i.test(x.url)) return;
            if (state.customers.some(function (c) { return String(c.notes || '').indexOf(x.url) !== -1; })) return;
            state.customers.unshift({
              id: 'cust-' + uuid().slice(0, 8), portalToken: 'pl_' + uuid().replace(/-/g, ''), name: String(x.title || x.url).slice(0, 80), contactName: '', email: '', phone: '',
              stage: 'عميل محتمل', projectTitle: p.title, totalValueUsd: 0, paidUsd: 0, assignedTo: 'marketing-lead',
              notes: 'المصدر: ' + x.url + '\n' + String(x.snippet || '').slice(0, 200), createdAt: nowIso().slice(0, 10)
            });
            added++;
          });
        });
        a.leads = (a.leads || 0) + added;
        var md = '# حملة: ' + p.title + '\n\nالرابط: ' + p.url + '\n\n## العرض\n' + offer + '\n\n## الجمهور\n' + (j.audience || '—') + '\n\n## الخدمات\n' + (Array.isArray(j.services) ? j.services.join('، ') : '—') + '\n\n## السعر التقديري (إعداد لمرة واحدة)\n' + (j.priceUsd ? '$' + j.priceUsd : '—') + (j.supportUsd ? ' + دعم شهري اختياري $' + j.supportUsd : '') +
          '\n\n## القنوات\n' + (Array.isArray(j.channels) ? j.channels.join('، ') : '—') + '\n\n## رسالة التواصل\n' + (j.outreach || '—') + '\n\n## منشور الترويج\n' + (j.post || '—') +
          '\n\n## التقييم\n' + (j.fit || '—') + '/10 — ' + (j.why || '') + '\n';
        writeExport('campaign-' + slug(p.title) + '.md', md);
        addApproval({
          agentId: 'marketing-lead', agentName: 'مسؤول التسويق', title: 'اعتماد حملة ترويج: ' + p.title,
          details: offer + '\n\nرسالة التواصل:\n' + (j.outreach || '—') + '\n\nمنشور:\n' + (j.post || '—') + '\n\nلا يُرسل شيء للخارج قبل اعتمادك.',
          risk: 'medium', actionType: 'publish_marketing', _skipQuality: true
        });
        a.campaigns = (a.campaigns || 0) + 1;
        a.analyzed[p.url] = true; a.everAnalyzed[p.url] = true; a.sinceReport = (a.sinceReport || 0) + 1;
        awardPoints('web-research-team', 5, 'دورة أتمتة: تحليل مشروع حقيقي وإعداد حملة');
        state.liveBubbles['web-research-team'] = 'حلّلت: ' + p.title.slice(0, 30);
        telegramNotify('🤖 *الأتمتة*: حلّلت «' + p.title + '» وجهّزت حملة بانتظار اعتمادك (' + (j.fit || '?') + '/10).');
        apLog('«' + p.title + '»: تقييم ' + (j.fit || '?') + '/10، حملة جاهزة، ' + added + ' عميل محتمل مضاف' + (added ? '' : ' (لا نتائج بحث حي كافية — الحملة جاهزة للتوزيع اليدوي)') + '.', 'ok');
      });
    });
  }

  function apSummarize() {
    var a = apState();
    var ea = getAgent('executive-assistant');
    var done = a.projects.map(function (p) { return '- ' + p.title; }).join('\n');
    return aiGenerate({
      agentId: ea ? ea.id : 'executive-assistant', _urlDone: true,
      messages: [{ role: 'user', text: 'أنهت الأتمتة دورة كاملة على مشاريع الموقع:\n' + done + '\n\nعملاء محتملون مضافون: ' + (a.leads || 0) + '، حملات جاهزة بانتظار اعتمادي: ' + (a.campaigns || 0) + '.\nاكتبي لي تقرير نتائج مختصراً: أي مشروع أبدأ به أولاً ولماذا، وأول 3 خطوات ملموسة هذا الأسبوع لأحقق أول إيراد.' }]
    }).then(function (r) {
      recordUsage('executive-assistant', r.usage);
      if (r.mode !== 'live') return;
      state.teamChat.push({ id: uuid(), senderId: 'executive-assistant', senderName: 'السكرتيرة التنفيذية (تقرير الأتمتة 🤖)', senderAvatar: '📋', role: 'assistant', text: r.text, timestamp: nowIso() });
      writeExport('autopilot-report-' + Date.now() + '.md', '# تقرير الأتمتة\n\n' + r.text + '\n');
      telegramNotify('📋 *تقرير الأتمتة*\n\n' + String(r.text).slice(0, 1200));
      apLog('أصدرت تقرير النتائج وبدأت جولة بحث جديدة عن مستجدات الموقع.', 'ok');
    });
  }

  /* A real model: the user's own key, or a browser model that is really loaded
     (the labeled quick mode has no model, so it does not count). */
  function apModelReady() {
    var m = currentMode();
    if (m === 'demo') return false;
    if (m === 'local') { var l = providerCache.local; return Boolean(l && l.connected && !l.quick); }
    return providerConfigured(m);
  }
  function apCycle() {
    var a = apState();
    if (apBusy) return Promise.resolve();
    if (!apModelReady()) {
      if (a.needs !== 'key') apLog('أحتاج مفتاح نموذج ذكاء اصطناعي من حسابك لأكمل. أضفه من «إضافة API» وسأكمل تلقائياً.', 'warn');
      a.needs = 'key'; a.nextAt = Date.now() + 30000; saveState(); apRender();
      return Promise.resolve();
    }
    a.needs = '';
    apBusy = true; apRender();
    var todo = a.projects.filter(function (p) { return !a.analyzed[p.url]; })[0];
    var job;
    if (!a.projects.length) job = apDiscover();
    else if (todo) job = apAnalyze(todo);
    else if (a.sinceReport > 0) job = apSummarize().then(function () { a.sinceReport = 0; a.projects = []; a.roundDone = true; });
    else job = Promise.resolve().then(function () { apLog('لا جديد في الموقع حالياً؛ سأعيد الفحص بعد ساعة.', 'info'); a.projects = []; a.roundDone = true; });
    return job.then(function () {
      a.cycle = (a.cycle || 0) + 1;
      a.nextAt = Date.now() + (a.roundDone ? AP_ROUND_GAP_MS : AP_GAP_MS);
      a.roundDone = false;
    }).catch(function (e) {
      apLog('تعذّرت الخطوة: ' + e.message + ' — سأعيد المحاولة تلقائياً.', 'err');
      a.nextAt = Date.now() + 2 * 60 * 1000;
    }).then(function () {
      apBusy = false; saveState(); apRender();
    });
  }

  function apTick() {
    var a = apState();
    if (!a.enabled || apBusy || state.emergencyMode) return;
    if (typeof isUnlocked === 'function' && !isUnlocked()) return;
    if (Date.now() >= (a.nextAt || 0)) apCycle();
  }
  function apWakeLock() {
    try {
      if (navigator.wakeLock && !apWake && document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then(function (l) { apWake = l; l.addEventListener('release', function () { apWake = null; }); }).catch(function () { /* optional */ });
      }
    } catch (e) { /* optional */ }
  }
  function apStart(goal) {
    var a = apState();
    a.goal = String(goal || a.goal || '').trim();
    a.enabled = true; a.nextAt = 0; a.startedAt = a.startedAt || nowIso();
    logAudit('autopilot_started', 'ceo', 'Autopilot started', { goal: a.goal.slice(0, 120) });
    apLog('بدأت الأتمتة. الهدف: ' + (a.goal || 'مشاريع الموقع'), 'ok');
    apWakeLock();
    apTick();
  }
  function apStop() {
    var a = apState();
    a.enabled = false;
    apLog('تم إيقاف الأتمتة. تستأنف من نفس النقطة عند التشغيل.', 'info');
  }

  /* ── autopilot panel ────────────────────────────────────────────────── */
  function apRender() {
    var box = document.getElementById('apModal');
    if (!box) return;
    var a = apState();
    var st = box.querySelector('#apStatus');
    if (st) {
      st.className = 'ap-status ' + (a.needs ? 'warn' : a.enabled ? 'ok' : '');
      st.textContent = a.needs === 'key' ? '🔑 متوقفة مؤقتاً: أضف مفتاح نموذج من حسابك لتكمل.' :
        apBusy ? '⚙️ تعمل الآن على خطوة...' : a.enabled ? '🟢 تعمل — الخطوة التالية خلال ' + Math.max(0, Math.round(((a.nextAt || 0) - Date.now()) / 1000)) + ' ث' : '⚪ متوقفة';
    }
    var stats = box.querySelector('#apStats');
    if (stats) stats.innerHTML = '<span>📚 مشاريع: ' + a.projects.length + '</span><span>✅ محلَّلة: ' + Object.keys(a.analyzed).length + '</span><span>👥 عملاء محتملون: ' + (a.leads || 0) + '</span><span>📣 حملات بانتظارك: ' + (a.campaigns || 0) + '</span><span>🔁 دورات: ' + (a.cycle || 0) + '</span>';
    var log = box.querySelector('#apLog');
    if (log) log.innerHTML = a.log.slice(0, 25).map(function (x) { return '<div class="ap-line ' + esc(x.k) + '"><small>' + esc(String(x.t).slice(11, 19)) + '</small> ' + esc(x.m) + '</div>'; }).join('') || '<div class="ap-line">لم تبدأ بعد.</div>';
    var tgl = box.querySelector('#apToggle');
    if (tgl) tgl.textContent = a.enabled ? '⏹️ إيقاف الأتمتة' : '▶️ تشغيل الأتمتة';
  }
  function openAutopilot() {
    if (document.getElementById('apModal')) return;
    var a = apState();
    var m = document.createElement('div');
    m.id = 'apModal'; m.className = 'office-modal';
    m.innerHTML = '<div class="office-modal-card">' +
      '<h2>🤖 أتمتة العمل</h2>' +
      '<p>تعمل المنظومة لوحدها: تسحب مشاريع موقعك الحقيقية، تحلّل كل مشروع، تجهّز حملة وعرض بيع وتبحث عن عملاء، وتفتح لك طلب اعتماد قبل أي شيء يخرج من الشركة. لا تأخذ أي صلاحية دون موافقتك، وتطلب منك الربط (مفتاح نموذج/تليجرام) عند الحاجة فقط. تعمل طالما التطبيق مفتوح، وتستأنف من مكانها عند فتحه من جديد.</p>' +
      '<label>الهدف (يمكنك ذكر رابط موقعك)</label>' +
      '<textarea id="apGoal" rows="3" placeholder="مثال: روّج لمشاريع https://mdm1.org/ وحقق أول مبيعات">' + esc(a.goal || 'روّج لمنتجات https://mdm1.org/ الحقيقية وبِع إعدادات مخصصة مع التركيب والتدريب والدعم') + '</textarea>' +
      '<div id="apStatus" class="ap-status"></div><div id="apStats" class="ap-stats"></div>' +
      '<div class="ap-actions"><button type="button" class="btn btn-primary" id="apToggle"></button>' +
      '<button type="button" class="btn btn-secondary" id="apNow">⚡ نفّذ خطوة الآن</button>' +
      '<button type="button" class="btn btn-secondary" id="apKey">🔑 إضافة مفتاح</button>' +
      '<button type="button" class="btn btn-secondary" id="apApprovals">⏳ الموافقات</button>' +
      '<button type="button" class="btn btn-secondary" id="apClose">إغلاق</button></div>' +
      '<div id="apLog" class="ap-log"></div></div>';
    document.body.appendChild(m);
    function close() { window.clearInterval(refresh); m.remove(); }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.querySelector('#apClose').onclick = close;
    m.querySelector('#apToggle').onclick = function () {
      if (apState().enabled) apStop(); else apStart(m.querySelector('#apGoal').value);
    };
    m.querySelector('#apNow').onclick = function () { apState().goal = m.querySelector('#apGoal').value.trim(); apState().nextAt = 0; if (!apState().enabled) apStart(apState().goal); else apTick(); };
    m.querySelector('#apKey').onclick = function () { close(); openConnectionPanel({ focus: 'api' }); };
    m.querySelector('#apApprovals').onclick = function () { close(); shGoTab('approvals'); };
    var refresh = window.setInterval(apRender, 1000);
    apRender();
  }

  /* ── start-here guide: every tick comes from real state ─────────────── */
  var shIdentity = { at: 0, v: null };
  function shLinkedTelegram() {
    var A = window.MDM1Auth;
    if (!A || !A.status || !A.status().googleReady) return Promise.resolve(false);
    if (Date.now() - shIdentity.at < 20000 && shIdentity.v !== null) return Promise.resolve(shIdentity.v);
    return A.relay('identity_get', {}).then(function (r) {
      var i = (r && r.identities) || r || {};
      shIdentity = { at: Date.now(), v: Boolean(i.telegram) };
      return shIdentity.v;
    }).catch(function () { return false; });
  }
  function shGoTab(tab) {
    var b = document.querySelector('.nav-item[data-tab="' + tab + '"]');
    if (b) b.click();
  }
  function shSteps(tg) {
    var A = window.MDM1Auth, st = A && A.status ? A.status() : {};
    var live = apModelReady();
    var chatted = state.teamChat.some(function (x) { return x.role === 'user'; }) || Object.keys(state.directChats || {}).some(function (k) { return (state.directChats[k] || []).length; });
    var backup = ''; try { backup = localStorage.getItem('mdm1_office_v2_last_backup') || ''; } catch (e) { /* none */ }
    var ap = apState();
    return [
      { t: 'سجّل الدخول بحساب Google', d: 'هويتك تحمي بياناتك، ولا يستخدم أحد مفاتيح غيرك.', done: Boolean(st.googleReady), b: 'الحساب', run: function () { if (A) A.openPanel(); } },
      { t: 'أضف مفتاح ذكاء اصطناعي خاص بك', d: 'Groq أو OpenRouter أو OpenCode Zen — فيها خيارات مجانية. يُخزَّن مشفّراً على جهازك فقط.', done: live, b: 'إضافة API', run: function () { openConnectionPanel({ focus: 'api' }); } },
      { t: 'أعطِ الموظفين أول مهمة حقيقية', d: 'اكتب في «المحادثات» ما تريد، وسيردّون بحلول وتنفيذ.', done: chatted, b: 'المحادثات', run: function () { shGoTab('chat'); } },
      { t: 'شغّل «أتمتة العمل»', d: 'تبحث وتحلّل وتجهّز الحملات وتجمع العملاء لوحدها.', done: Boolean(ap.enabled || ap.cycle), b: 'فتح الأتمتة', run: openAutopilot },
      { t: 'أضف أول عميل حقيقي', d: 'من «العملاء (CRM)» أضف عميلاً وقيمة العقد.', done: state.customers.length > 0, b: 'العملاء', run: function () { shGoTab('crm'); } },
      { t: 'سجّل أول إيراد أو مصروف', d: 'من «الأرباح والخسائر» لتظهر أرباحك الفعلية.', done: state.financialLedger.length > 0, b: 'الأرباح', run: function () { shGoTab('pnl'); } },
      { t: 'اربط تليجرام لتصلك النتائج (اختياري)', d: 'إشعار بكل حملة ونتيجة تجهزها الأتمتة.', done: Boolean(tg), b: 'ربط تليجرام', run: function () { openMessaging('telegram'); } },
      { t: 'خذ نسخة احتياطية', d: 'بياناتك في متصفحك؛ النسخة تحميها من الفقد.', done: Boolean(backup), b: 'النسخ الاحتياطي', run: function () { shGoTab('backup'); } }
    ];
  }
  function openStartHere() {
    var old = document.getElementById('shModal'); if (old) old.remove();
    shLinkedTelegram().then(function (tg) {
      if (document.getElementById('shModal')) return;
      var steps = shSteps(tg), done = steps.filter(function (s) { return s.done; }).length;
      var next = steps.findIndex(function (s) { return !s.done; });
      var m = document.createElement('div');
      m.id = 'shModal'; m.className = 'office-modal';
      m.innerHTML = '<div class="office-modal-card"><h2>🚀 ابدأ هنا</h2><p>' + done + ' من ' + steps.length + ' مكتملة. العلامات تُحسب من حالة مكتبك الفعلية.</p>' +
        '<div class="sh-bar"><i style="width:' + Math.round(done / steps.length * 100) + '%"></i></div>' +
        steps.map(function (s, i) {
          return '<div class="sh-step ' + (s.done ? 'done' : i === next ? 'next' : '') + '"><span class="sh-mark">' + (s.done ? '✅' : i === next ? '👉' : '⬜') + '</span><div><strong>' + (i + 1) + '. ' + esc(s.t) + '</strong><small>' + esc(s.d) + '</small></div>' +
            (s.done ? '' : '<button type="button" class="btn btn-secondary" data-i="' + i + '">' + esc(s.b) + '</button>') + '</div>';
        }).join('') +
        '<div class="ap-actions"><button type="button" class="btn btn-primary" id="shClose">إغلاق</button></div></div>';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
      m.querySelector('#shClose').onclick = function () { m.remove(); };
      Array.prototype.forEach.call(m.querySelectorAll('button[data-i]'), function (b) {
        b.onclick = function () { var s = steps[Number(b.getAttribute('data-i'))]; m.remove(); s.run(); };
      });
    });
  }

  function autopilotInit() {
    var a = apState();
    var b1 = document.getElementById('quickStartBtn'); if (b1) b1.onclick = openStartHere;
    var b2 = document.getElementById('autopilotBtn'); if (b2) b2.onclick = openAutopilot;
    if (apTimer) return;
    apTimer = window.setInterval(apTick, 30000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { apWakeLock(); apTick(); } });
    if (a.enabled) { apLog('استأنفت الأتمتة بعد فتح التطبيق.', 'info'); apWakeLock(); window.setTimeout(apTick, 5000); }
    if (!settings.onboardingSeen) {
      settings.onboardingSeen = true; saveSettings();
      window.setTimeout(openStartHere, 1500);
    }
  }
