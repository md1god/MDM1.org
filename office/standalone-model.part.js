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
    /* No owner/shared secret is ever sent. Model listing uses the public
       Supabase publishable key; protected actions use the signed-in user's JWT. */
    var publicKey = (CFG.auth && CFG.auth.publishableKey) || (CFG.messaging && CFG.messaging.anonKey) || '';
    if (publicKey) headers.apikey = publicKey;
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
  function cloudConfigured() { return false; }
  function listCloudModels(force) {
    return Promise.resolve({ connected: false, models: [], free: [], providers: {}, modelProviders: {}, defaultProvider: '',
      userKeysRequired: true,
      error: 'المكتب يستخدم مفاتيحك أنت فقط. أدخل مفتاحك في 🔌 الاتصال: OpenCode المحلي أو Zen أو Groq أو OpenRouter.' });
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
    if (mode === 'cloud' || mode === 'supabase') return false;
    if (mode === 'local') return Boolean(secret('localPassword'));
    if (mode === 'zen') return Boolean(secret('zenKey'));
    if (mode === 'groq') return Boolean(secret('groqKey'));
    if (mode === 'openrouter') return Boolean(secret('openrouterKey'));
    return false;
  }
  function currentMode() {
    var mode = settings.mode === 'supabase' || settings.mode === 'cloud' ? 'demo' : settings.mode;
    if (mode !== 'auto') return mode;
    /* Owner keys are never used. Order: local OpenCode (HTTPS bridge first),
       then user-owned Zen / Groq / OpenRouter keys on this device only. */
    var order = ['local', 'zen', 'groq', 'openrouter'];
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
      return Promise.resolve(fallback('المكتب يستخدم مفاتيحك أنت فقط — استخدم مفتاحك الخاص من 🔌 الاتصال.'));
      /* legacy shared-key relay path intentionally disabled */
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
      return quotaReserve('groq', 1).then(function (q) {
        if (!q.allowed) return fallback('انتهت الحصة اليومية لمزود Groq على حسابك — جرّب مزوداً آخر أو غداً.');
        return listGroqModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        if (!listing.free.length) return fallback('لا توجد نماذج Groq مجانية متاحة لحسابك حالياً.');
        var pool = forcedModel ? [forcedModel] : (settings.freeOnly && listing.free.length ? listing.free : listing.models.map(function (m) { return m.id; }));
        return runOpenAiChain('groq', listing, settings.groqBase.replace(/\/$/, '') + '/chat/completions',
          { 'content-type': 'application/json', authorization: 'Bearer ' + secret('groqKey') }, pool);
        });
      });
    }

    if (mode === 'openrouter') {
      if (!secret('openrouterKey')) return Promise.resolve(fallback('أدخل مفتاح OpenRouter.'));
      return quotaReserve('openrouter', 1).then(function (q) {
        if (!q.allowed) return fallback('انتهت الحصة اليومية لمزود OpenRouter على حسابك — جرّب مزوداً آخر أو غداً.');
        return listOpenRouterModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        var pool = forcedModel ? [forcedModel] : (settings.freeOnly && listing.free.length ? listing.free : listing.models.map(function (m) { return m.id; }));
        if (!pool.length) return fallback('لا توجد نماذج مجانية على OpenRouter حالياً.');
        return runOpenAiChain('openrouter', listing, settings.openrouterBase.replace(/\/$/, '') + '/chat/completions',
          { 'content-type': 'application/json', authorization: 'Bearer ' + secret('openrouterKey'), 'HTTP-Referer': location.origin, 'X-Title': 'MDM1 AI Office' }, pool);
        });
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