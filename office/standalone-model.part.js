  var providerCache = { cloud: null, cloudAt: 0, local: null, localAt: 0, zen: null, zenAt: 0, groq: null, groqAt: 0, openrouter: null, openrouterAt: 0 };
  /* A provider can list models successfully yet be unable to execute a chat
     call from this origin (Zen/CORS). Track real chat health separately so the
     badge and auto fallback never advertise a provider that cannot generate. */
  var providerChatHealth = {};
  var providerHealthDirty = false;
  function markChatHealth(provider, ok, error) {
    if (!provider) return;
    var prev = providerChatHealth[provider];
    if (prev && prev.ok === ok && (!error || prev.error === String(error).slice(0, 200))) return;
    providerChatHealth[provider] = { ok: Boolean(ok), error: error ? String(error).slice(0, 200) : null, at: Date.now() };
    providerHealthDirty = true;
  }
  function chatUsable(provider) {
    var h = providerChatHealth[provider];
    return !(h && h.ok === false && Date.now() - h.at < 15 * 60 * 1000);
  }
  /* ── browser-local WebGPU model (same engine as /assistant/) ─────────────
     The old local HTTP bridge and its service password are gone. On capable
     desktops the WebLLM engine runs a small Qwen model inside this tab; on
     phones or without WebGPU we use a clearly labeled quick mode. No key and
     no server are involved, and no model is invented by us — the IDs below
     are the approved profiles from the owner's own assistant site. */
  var WEBLLM_MODULE_URL = (CFG.webllm && CFG.webllm.moduleUrl) || 'https://esm.run/@mlc-ai/web-llm';
  var BROWSER_PROFILES = {
    auto: { label: 'تلقائي حسب الجهاز واللغة', model: null },
    quick: { label: 'الوضع السريع الآمن', model: null },
    multilingual: { label: 'Qwen متعدد اللغات · خفيف', model: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' },
    balanced: { label: 'Qwen3 متعدد اللغات · متوازن', model: 'Qwen3-1.7B-q4f16_1-MLC' },
    coding: { label: 'Qwen Coder · برمجة', model: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC' }
  };
  var WEBLLM = { module: null, engine: null, modelId: null, loading: null };
  var CONSTRAINED_DEVICE = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
    || (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  function detectLanguage(text) {
    var v = String(text || '');
    if (/\p{Script=Arabic}/u.test(v)) return 'ar';
    if (/\p{Script=Devanagari}/u.test(v)) return 'hi';
    if (/\p{Script=Cyrillic}/u.test(v)) return 'ru';
    if (/\p{Script=Han}/u.test(v)) return 'zh';
    if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(v)) return 'ja';
    if (/\p{Script=Hangul}/u.test(v)) return 'ko';
    return 'en';
  }
  function profileFor(lang) {
    if (CONSTRAINED_DEVICE || !navigator.gpu) return 'quick';
    if (settings.browserProfile && settings.browserProfile !== 'auto') return settings.browserProfile;
    return (navigator.deviceMemory >= 8 && navigator.hardwareConcurrency >= 8) ? 'balanced' : 'multilingual';
  }
  function loadWebLLMModule() {
    if (WEBLLM.module) return Promise.resolve(WEBLLM.module);
    return import(WEBLLM_MODULE_URL).then(function (mod) { WEBLLM.module = mod; return mod; });
  }
  function browserProfileModel(lang) {
    var p = profileFor(lang || 'ar');
    return BROWSER_PROFILES[p] ? BROWSER_PROFILES[p].model : null;
  }
  function listLocalModels(force) {
    if (!force && providerCache.local && Date.now() - providerCache.localAt < 30000) return Promise.resolve(providerCache.local);
    var out = { connected: false, models: [], free: [], quick: true, webgpu: Boolean(navigator.gpu), base: WEBLLM_MODULE_URL, error: null };
    if (CONSTRAINED_DEVICE || !navigator.gpu) {
      out.error = 'الجهاز يستخدم الوضع السريع الآمن — النموذج المحلي يحتاج WebGPU.';
      providerCache.local = out; providerCache.localAt = Date.now();
      return Promise.resolve(out);
    }
    return loadWebLLMModule().then(function (mod) {
      var list = (mod.prebuiltAppConfig && mod.prebuiltAppConfig.model_list) || [];
      var ids = Object.keys(BROWSER_PROFILES).map(function (k) { return BROWSER_PROFILES[k].model; }).filter(Boolean);
      var models = ids.filter(function (id) {
        return list.some(function (x) { return x && x.model_id === id; });
      }).map(function (id) { return { id: id, name: id }; });
      out.connected = true;
      out.models = models;
      out.free = models.map(function (m) { return m.id; });
      out.quick = profileFor('ar') === 'quick';
      providerCache.local = out; providerCache.localAt = Date.now();
      return out;
    }).catch(function (e) {
      out.error = e.message || 'تعذر تحميل محرك النموذج المحلي.';
      providerCache.local = out; providerCache.localAt = Date.now();
      return out;
    });
  }
  function ensureBrowserEngine(progressCb, lang) {
    var modelId = browserProfileModel(lang || 'ar');
    if (!modelId) return Promise.resolve({ ok: false, quick: true, error: 'الوضع السريع الآمن — لا يوجد نموذج محلي على هذا الجهاز.' });
    if (WEBLLM.engine && WEBLLM.modelId === modelId) return Promise.resolve({ ok: true, modelId: modelId, engine: WEBLLM.engine });
    if (WEBLLM.loading) return WEBLLM.loading;
    WEBLLM.loading = loadWebLLMModule().then(function (mod) {
      var list = (mod.prebuiltAppConfig && mod.prebuiltAppConfig.model_list) || [];
      if (!list.some(function (x) { return x && x.model_id === modelId; })) throw new Error('النموذج غير متاح في قائمة WebLLM.');
      var cb = typeof progressCb === 'function' ? function (info) {
        progressCb({ progress: Number(info && info.progress) || 0, text: (info && info.text) || 'تحميل النموذج…' });
      } : undefined;
      if (WEBLLM.engine && typeof WEBLLM.engine.reload === 'function') return WEBLLM.engine.reload(modelId).then(function () { return WEBLLM.engine; });
      return mod.CreateMLCEngine(modelId, cb ? { initProgressCallback: cb } : undefined);
    }).then(function (engine) {
      WEBLLM.engine = engine; WEBLLM.modelId = modelId; WEBLLM.loading = null;
      return { ok: true, modelId: modelId, engine: engine };
    }).catch(function (e) {
      WEBLLM.loading = null; WEBLLM.engine = null; WEBLLM.modelId = null;
      return { ok: false, quick: true, error: e.message };
    });
    return WEBLLM.loading;
  }
  function quickLocalReply(agent, warning) {
    return {
      text: '⚡ **الوضع السريع الآمن** — يعمل محلياً داخل متصفحك دون خادم أو مفتاح. ' +
        (warning ? String(warning) + '\n\n' : '') +
        'لتفعيل النموذج اللغوي المحلي الكامل، افتح 🔌 الاتصال واضغط «تحميل النموذج المحلي» على جهاز يدعم WebGPU.',
      mode: 'fallback', provider: 'browser-quick', model: 'quick', warning: warning || 'quick_mode',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
    };
  }
  function generateLocal(opts, systemPrompt, messages, listing) {
    var lang = detectLanguage((messages.length ? messages[messages.length - 1].text : '') || '');
    var modelId = browserProfileModel(lang);
    if (!modelId || CONSTRAINED_DEVICE || !navigator.gpu || (!WEBLLM.engine && settings.browserAutoLoad === false)) {
      return Promise.resolve(quickLocalReply(getAgent(opts.agentId), listing && listing.error));
    }
    return ensureBrowserEngine(null, lang).then(function (r) {
      if (!r.ok || !r.engine) return quickLocalReply(getAgent(opts.agentId), r.error || (listing && listing.error));
      var lastUser = messages.length ? messages[messages.length - 1].text : '';
      var req = r.engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }].concat(messages.map(function (m) {
          return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text };
        })),
        temperature: 0.2,
        max_tokens: 300
      });
      return Promise.race([
        req,
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error('انتهت مهلة النموذج المحلي.')); }, 20000); })
      ]).then(function (res) {
        var text = res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
        if (!text) return quickLocalReply(getAgent(opts.agentId), 'رد فارغ من النموذج المحلي.');
        var out = { text: String(text), mode: 'live', provider: 'browser-webllm', model: r.modelId,
          usage: estimateUsage(systemPrompt, messages, String(text), modelById(listing, r.modelId)) };
        out.usage.costUsd = 0;
        markChatHealth('local', true, null);
        markUsage('browser-webllm', r.modelId, out.usage);
        return out;
      }).catch(function (e) {
        try { r.engine.interruptGenerate && r.engine.interruptGenerate(); } catch (_) {}
        markChatHealth('local', false, e.message);
        return quickLocalReply(getAgent(opts.agentId), e.message);
      });
    });
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
      /* Show every live Groq model. Free status comes only from live metadata;
         where Groq omits pricing we mark it unknown instead of hiding it. */
      /* Groq publishes no pricing in /models, so isFreeModel() could never match and
         the free-only mode left Groq with zero usable models. Groq has a no-card free
         plan (over-limit requests get 429, they are not billed); only chat models are
         offered — speech, TTS and guard models are excluded. */
      var chat = all.filter(function (m) { return !/whisper|tts|playai|orpheus|guard|safeguard|embed/i.test(String(m.id)); });
      var free = chat.map(function (m) { return m.id; });
      var models = all.map(function (m) { return Object.assign({}, m, { freeTier: free.indexOf(m.id) !== -1 }); });
      var out = { connected: true, models: models, free: free, base: settings.groqBase, error: null,
        note: 'Groq لا يعلن الأسعار: الباقة المجانية بلا بطاقة، وتُحاسَب فقط إن رقّيت حسابك لخطة مدفوعة.' };
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
    if (mode === 'local') return true; // WebGPU full mode or labeled quick mode
    if (typeof vaultLocked === 'function' && vaultLocked()) return false;
    if (mode === 'zen') return Boolean(secret('zenKey'));
    if (mode === 'groq') return Boolean(secret('groqKey'));
    if (mode === 'openrouter') return Boolean(secret('openrouterKey'));
    return false;
  }
  function currentMode() {
    var mode = settings.mode === 'supabase' || settings.mode === 'cloud' ? 'demo' : settings.mode;
    if (mode !== 'auto') return mode;
    /* Owner keys are never used. Order: browser-local WebGPU/quick, then the
       user's own Zen / Groq / OpenRouter keys on this device only. */
    var order = ['local', 'zen', 'groq', 'openrouter'];
    var i, mode;
    for (i = 0; i < order.length; i++) {
      mode = order[i];
      if (providerConfigured(mode) && chatUsable(mode) && providerCache[mode] && providerCache[mode].connected) return mode;
    }
    for (i = 0; i < order.length; i++) {
      if (providerConfigured(order[i]) && chatUsable(order[i])) return order[i];
    }
    return 'demo';
  }

  function transcript(systemPrompt, messages) {
    var lines = ['[تعليمات النظام]\n' + systemPrompt];
    (messages || []).forEach(function (m) { lines.push((m.role === 'assistant' ? 'المساعد' : 'المدير') + ': ' + m.text); });
    lines.push('المساعد:');
    return lines.join('\n\n');
  }

  function modelPrice(meta) {
    var p = (meta && (meta.pricing || meta.cost)) || {};
    return {
      input: num(p.prompt != null ? p.prompt : (p.input != null ? p.input : (p.inputCostPerToken != null ? p.inputCostPerToken : p.inputCost)), 0),
      output: num(p.completion != null ? p.completion : (p.output != null ? p.output : (p.outputCostPerToken != null ? p.outputCostPerToken : p.outputCost)), 0)
    };
  }
  function modelById(listing, id) {
    var models = (listing && listing.models) || [];
    for (var i = 0; i < models.length; i++) if (models[i] && models[i].id === id) return models[i];
    return null;
  }
  function estimateUsage(systemPrompt, messages, text, meta) {
    var inputChars = (systemPrompt || '').length + (messages || []).reduce(function (a, m) { return a + String(m.text || '').length; }, 0);
    var inputTokens = Math.max(1, Math.ceil(inputChars / 4));
    var outputTokens = Math.max(1, Math.ceil(String(text || '').length / 4));
    var price = modelPrice(meta);
    var costUsd = Math.round(((inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output) * 1000000) / 1000000;
    return { inputTokens: inputTokens, outputTokens: outputTokens, totalTokens: inputTokens + outputTokens, costUsd: costUsd };
  }
  function poolFor(listing, forcedModel) {
    if (forcedModel) return [forcedModel];
    if (!settings.freeOnly) return (listing.models || []).map(function (m) { return m.id; });
    return (listing.free || []).map(String);
  }

  function demoReply(agent, userMessage, warning) {
    return '⚠️ لا يوجد نموذج ذكاء اصطناعي متصل حالياً، لذلك لا أستطيع الرد بذكاء ولا تحليل طلبك. ' + (warning ? '(' + warning + ') ' : '') +
      'اضغط **🔑 إضافة API** وأضف مفتاحك (Groq أو OpenRouter أو OpenCode Zen — فيه خيارات مجانية) وسأرد فوراً.';
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

    /* Auto mode must survive a provider that lists models successfully but
       cannot execute a chat call from this origin (e.g. Zen/CORS). Try every
       configured live provider in order before showing a labeled fallback. */
    if (!opts.forceProvider && settings.mode === 'auto') {
      var order = ['local', 'zen', 'groq', 'openrouter'];
      var autoChain = order.filter(function (m) {
        return providerConfigured(m) && chatUsable(m) && providerCache[m] && providerCache[m].connected;
      });
      if (!autoChain.length) autoChain = order.filter(function (m) { return providerConfigured(m) && chatUsable(m); });
      if (autoChain.length > 1) {
        function tryAuto(i, errors) {
          if (i >= autoChain.length) return Promise.resolve(fallback(errors.join('\n')));
          var nextOpts = {};
          Object.keys(opts).forEach(function (k) { nextOpts[k] = opts[k]; });
          nextOpts.forceProvider = autoChain[i];
          return aiGenerateRaw(nextOpts).then(function (out) {
            if (out && out.mode === 'live') return out;
            var w = out && out.warning ? String(out.warning) : '';
            if (w) errors.push(autoChain[i] + ': ' + w.slice(0, 200));
            return tryAuto(i + 1, errors);
          }).catch(function (e) {
            errors.push(autoChain[i] + ': ' + (e.message || String(e)).slice(0, 200));
            return tryAuto(i + 1, errors);
          });
        }
        return tryAuto(0, []);
      }
    }

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
              } else if (r.status === 402 || /insufficient balance|insufficient_quota/i.test(msg)) {
                markModelError(provider, id, msg);
              } else {
                markModelError(provider, id, msg);
              }
              /* A limited/paid-out model must not abort the whole chain. */
              return attempt(i + 1);
            }
            var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
            if (!text) { errors.push(id + ': رد فارغ'); markModelError(provider, id, 'رد فارغ'); return attempt(i + 1); }
            var out = { text: text, mode: 'live', provider: provider, model: id, usage: estimateUsage(systemPrompt, messages, text, modelById(listing, id)) };
            markChatHealth(provider, true, null);
            markUsage(provider, id, out.usage);
            return out;
          });
        }).catch(function (e) {
          errors.push(id + ': ' + e.message);
          markModelError(provider, id, e.message);
          markChatHealth(provider, false, e.message);
          return attempt(i + 1);
        });
      }
      return attempt(0).catch(function (e) {
        return fallback(errors.join('\n') || e.message);
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
              usage: estimateUsage(systemPrompt, messages, text, modelById(listing, id))
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
        return generateLocal(opts, systemPrompt, messages, listing);
      });
    }

    if (mode === 'zen') {
      return listZenModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        var pool = poolFor(listing, forcedModel);
        if (!pool.length) return fallback('وضع المجاني فقط مفعّل ولا توجد نماذج مجانية متاحة — لم أستخدم نموذجاً مدفوعاً.');
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
                if (r.status === 429 || /free usage limit|rate limit/i.test(msg)) markRateLimit('opencode-zen', id, retryMsFrom(r, j), msg);
                else markModelError('opencode-zen', id, msg);
                return attempt(i + 1);
              }
              var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
              if (!text) { errors.push(id + ': رد فارغ'); markModelError('opencode-zen', id, 'رد فارغ'); return attempt(i + 1); }
              var out = { text: text, mode: 'live', provider: 'opencode-zen', model: id, usage: estimateUsage(systemPrompt, messages, text, modelById(listing, id)) };
              markChatHealth('zen', true, null);
              markUsage('opencode-zen', id, out.usage);
              return out;
            });
          }).catch(function (e) {
            errors.push(id + ': ' + e.message);
            markModelError('opencode-zen', id, e.message);
            markChatHealth('zen', false, e.message);
            return attempt(i + 1);
          });
        }
        return attempt(0).catch(function (e) { return fallback(errors.join('\n') || e.message); });
      });
    }

    if (mode === 'groq') {
      if (!secret('groqKey')) return Promise.resolve(fallback('أدخل مفتاح Groq.'));
      var reservedGroq = false;
      return quotaReserve('groq', 1).then(function (q) {
        if (!q.allowed) return fallback('انتهت الحصة اليومية لمزود Groq على حسابك — جرّب مزوداً آخر أو غداً.');
        reservedGroq = q.skipped !== true;
        return listGroqModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        if (!listing.free.length) return fallback('لا توجد نماذج Groq مجانية متاحة لحسابك حالياً.');
        var pool = poolFor(listing, forcedModel);
        if (!pool.length) return fallback('وضع المجاني فقط مفعّل ولا توجد نماذج مجانية متاحة — لم أستخدم نموذجاً مدفوعاً.');
        return runOpenAiChain('groq', listing, settings.groqBase.replace(/\/$/, '') + '/chat/completions',
          { 'content-type': 'application/json', authorization: 'Bearer ' + secret('groqKey') }, pool);
        });
      }).then(function (out) {
        if (reservedGroq && out.mode !== 'live') quotaRelease('groq', 1);
        return out;
      }, function (e) {
        if (reservedGroq) quotaRelease('groq', 1);
        throw e;
      });
    }

    if (mode === 'openrouter') {
      if (!secret('openrouterKey')) return Promise.resolve(fallback('أدخل مفتاح OpenRouter.'));
      var reservedOr = false;
      return quotaReserve('openrouter', 1).then(function (q) {
        if (!q.allowed) return fallback('انتهت الحصة اليومية لمزود OpenRouter على حسابك — جرّب مزوداً آخر أو غداً.');
        reservedOr = q.skipped !== true;
        return listOpenRouterModels().then(function (listing) {
        if (!listing.connected) return fallback(listing.error);
        var pool = poolFor(listing, forcedModel);
        if (!pool.length) return fallback(settings.freeOnly ? 'وضع المجاني فقط مفعّل ولا توجد نماذج مجانية متاحة — لم أستخدم نموذجاً مدفوعاً.' : 'لا توجد نماذج متاحة على OpenRouter حالياً.');
        return runOpenAiChain('openrouter', listing, settings.openrouterBase.replace(/\/$/, '') + '/chat/completions',
          { 'content-type': 'application/json', authorization: 'Bearer ' + secret('openrouterKey'), 'HTTP-Referer': location.origin, 'X-Title': 'MDM1 AI Office' }, pool);
        });
      }).then(function (out) {
        if (reservedOr && out.mode !== 'live') quotaRelease('openrouter', 1);
        return out;
      }, function (e) {
        if (reservedOr) quotaRelease('openrouter', 1);
        throw e;
      });
    }

    return Promise.resolve(fallback('مزود غير معروف: ' + mode));
  }

  /* Single instrumented entry point for every runtime call. */
  function aiGenerate(opts) {
    if (typeof state !== 'undefined' && state.emergencyMode && !(opts && opts.allowDuringEmergency)) {
      return Promise.resolve({
        text: '🚨 وضع الطوارئ نشط — تم إيقاف التوليد والتنفيذ مؤقتاً. استعد التشغيل من لوحة إدارة الأزمات.',
        mode: 'fallback', provider: currentMode(), model: 'emergency-hold',
        warning: 'emergency_mode_active', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
      });
    }
    if (opts && !opts._urlDone) {
      var _msgs = opts.messages || [];
      var _last = _msgs.length ? String(_msgs[_msgs.length - 1].text || '') : '';
      if (extractUrls(_last).length) {
        return urlsContextFor(_last).then(function (ctx) {
          var o2 = Object.assign({}, opts, { _urlDone: true });
          if (ctx) o2.extraContext = (opts.extraContext ? opts.extraContext + '\n\n' : '') + ctx;
          return aiGenerate(o2);
        });
      }
    }
    function flushProviderHealth() {
      if (!providerHealthDirty) return;
      providerHealthDirty = false;
      try { window.dispatchEvent(new Event('mdm1-provider-change')); } catch (e) {}
    }
    return Promise.resolve().then(function () { return aiGenerateRaw(opts); }).then(function (r) {
      settings.lastProvider = r.provider || settings.lastProvider;
      saveSettings();
      if (r.mode !== 'live' && r.warning && /429|limit|حصة|RATE_LIMIT/i.test(r.warning)) {
        showToast('⚠️ تعذّر التوليد حياً: ' + String(r.warning).slice(0, 180), 'err');
      }
      updateQuotaBadge();
      flushProviderHealth();
      return r;
    }).catch(function (e) {
      var agent = getAgent(opts && opts.agentId) || { name: opts && opts.agentId || 'المساعد', id: opts && opts.agentId || 'unknown' };
      flushProviderHealth();
      return {
        text: demoReply(agent, '', e.message),
        mode: 'fallback', provider: currentMode(), model: 'demo',
        warning: e.message, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
      };
    });
  }

  /* ── model lab ────────────────────────────────────────────────────────── */