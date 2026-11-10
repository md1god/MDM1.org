(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const constrainedDevice = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
    || (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  const PROFILES = {
    auto: { label: 'تلقائي حسب الجهاز واللغة', model: null, languages: ['ar','en','fr','es','de','pt','tr','id','hi','ur','ru','zh','ja','ko'] },
    quick: { label: 'الوضع السريع الآمن', model: null, languages: ['*'] },
    multilingual: { label: 'Qwen متعدد اللغات · خفيف', model: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', languages: ['ar','en','fr','es','de','pt','tr','id','hi','ur','ru','zh','ja','ko'] },
    balanced: { label: 'Qwen3 متعدد اللغات · متوازن', model: 'Qwen3-1.7B-q4f16_1-MLC', languages: ['ar','en','fr','es','de','pt','tr','id','hi','ur','ru','zh','ja','ko'] },
    coding: { label: 'Qwen Coder · برمجة', model: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC', languages: ['en','ar','fr','es','de','pt','tr','id','hi','ur','ru','zh','ja','ko'] }
  };
  const LANGUAGE_NAMES = { ar:'العربية', en:'English', fr:'Français', es:'Español', de:'Deutsch', pt:'Português', tr:'Türkçe', id:'Bahasa Indonesia', hi:'हिन्दी', ur:'اردو', ru:'Русский', zh:'中文', ja:'日本語', ko:'한국어' };
  const WORDS = {
    ar: ['من','أريد','كيف','أداة','مساعد','مشروع','تطبيق','مجاني'], en: ['the','and','what','how','free','tool','assistant','project'],
    fr: ['le','une','avec','pour','outil','projet','bonjour','comment'], es: ['el','una','para','herramienta','proyecto','cómo','quiero'],
    de: ['der','die','und','für','werkzeug','projekt','wie','möchte'], pt: ['uma','para','ferramenta','projeto','como','quero','olá'],
    tr: ['bir','için','araç','proje','nasıl','istiyorum','ücretsiz'], id: ['dan','untuk','alat','proyek','bagaimana','ingin','gratis'],
    hi: ['मैं','है','के','लिए','उपकरण','परियोजना','कैसे','चाहिए'], ur: ['ہے','کے','لیے','آلہ','منصوبہ','کیسے','چاہتا'],
    ru: ['и','для','инструмент','проект','как','хочу','бесплатно'], zh: ['的','我','你','工具','项目','如何','免费'],
    ja: ['です','ます','ツール','プロジェクト','どう','無料'], ko: ['입니다','도구','프로젝트','어떻게','무료']
  };
  const state = { items: [], engine: null, webllm: null, modelLoading: false, busy: false, constrainedDevice, profile: 'auto', modelId: null, detectedLanguage: 'ar' };
  const escape = v => String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const normal = v => String(v || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const addMessage = (text, who = 'bot', html = false) => { const chat = $('#chat'); const row = document.createElement('div'); row.className = `message ${who}`; row.innerHTML = `<div class="avatar">${who === 'bot' ? '◈' : '●'}</div><div class="bubble"><strong>${who === 'bot' ? 'مساعد MDM1' : 'أنت'}</strong>${html ? text : `<p>${escape(text)}</p>`}</div>`; chat.appendChild(row); chat.scrollTop = chat.scrollHeight; };
  const detectLanguage = text => {
    const value = String(text || '');
    if (/\p{Script=Arabic}/u.test(value)) return /[گچپژ]/u.test(value) || /ہے|کے|لیے/.test(value) ? 'ur' : 'ar';
    if (/\p{Script=Devanagari}/u.test(value)) return 'hi';
    if (/\p{Script=Cyrillic}/u.test(value)) return 'ru';
    if (/\p{Script=Han}/u.test(value)) return 'zh';
    if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(value)) return 'ja';
    if (/\p{Script=Hangul}/u.test(value)) return 'ko';
    const words = normal(value).split(/[^a-zà-ÿ]+/).filter(Boolean); let best = 'en'; let score = 0;
    Object.entries(WORDS).forEach(([lang, list]) => { const n = list.reduce((sum, word) => sum + (words.includes(normal(word)) ? 1 : 0), 0); if (n > score) { best = lang; score = n; } });
    return best;
  };
  const classify = text => { const q = normal(text); if (/خصوص|امان|امن|privacy|security/.test(q)) return ['sec', 'tool']; if (/تعليم|درس|learn|study/.test(q)) return ['edu', 'app']; if (/تسويق|marketing|عمل|business/.test(q)) return ['mkt', 'tool']; if (/لعب|لعبة|game/.test(q)) return ['game', 'game']; if (/تطبيق|app|بناء|build|مشروع|project/.test(q)) return ['all', 'project']; return ['all', 'all']; };
  const recommend = text => { const [cat, kind] = classify(text); let hits = state.items.filter(x => { const tags = Array.isArray(x.tags) ? x.tags.join(' ') : String(x.tags || ''); const hay = normal([x.title, x.description, x.primaryCategory, x.type, tags].join(' ')); return (cat === 'all' || hay.includes(cat)) && (kind === 'all' || x.type === kind || (kind === 'project' && x.type === 'project_plan')); }); if (hits.length < 3) hits = state.items.filter(x => normal([x.title, x.description].join(' ')).includes(normal(text).split(/\s+/)[0])).slice(0, 3); return hits.slice(0, 3); };
  const cards = hits => hits.length ? `<div class="assistant-card-grid">${hits.map(x => `<article class="resource-card"><h4>${escape(x.title || 'مورد MDM1')}</h4><p>${escape(x.description || 'مورد مناسب للبدء والتجربة.')}</p><a href="${escape(x.url || '/discover/')}">افتح المورد ↗</a></article>`).join('')}</div>` : '<p>لم أجد تطابقاً مباشراً. جرّب وصفاً أبسط مثل: «أداة للخصوصية».</p>';
  const fallbackAnswer = text => { if (/من\s*أنت|من\s*انت|who\s+are\s+you/i.test(text)) return '<p>أنا مساعد MDM1 الشخصي. أساعدك في اكتشاف الأدوات والتطبيقات والمشاريع، وأقترح لك بداية عملية أو قالب كود مجاني.</p>'; const hits = recommend(text); const [cat] = classify(text); const plan = cat === 'all' ? 'ابدأ بالمورد الأول، ثم أخبرني ما الذي أعجبك لأقترح الخطوة التالية.' : 'خطتك السريعة: 1) اختر مورداً، 2) جرّبه 10 دقائق، 3) احفظه في المفضلة ثم عد لي بنتيجتك.'; return `<p>${escape(plan)}</p>${cards(hits)}`; };
  const profileFor = lang => { if (state.constrainedDevice || !navigator.gpu) return 'quick'; if (state.profile !== 'auto') return state.profile; return (navigator.deviceMemory >= 8 && navigator.hardwareConcurrency >= 8) ? 'balanced' : 'multilingual'; };
  const setLanguageUI = lang => { state.detectedLanguage = lang; const el = $('#detected-language'); if (el) el.textContent = `اللغة المكتشفة: ${LANGUAGE_NAMES[lang] || lang}`; };
  const setProfileUI = profile => { const el = $('#active-profile'); if (el) el.textContent = `الملف النشط: ${PROFILES[profile]?.label || PROFILES.auto.label}`; };
  const setModelProgress = info => { const progress = Math.max(0, Math.min(100, Math.round((Number(info?.progress) || 0) * 100))); $('#model-progress-bar').value = progress; $('#model-progress-value').textContent = `${progress}%`; $('#model-progress-label').textContent = info?.text || 'تحميل النموذج…'; };
  const askLocal = async (messages, maxTokens = 160, timeoutMs = 12000) => { if (!state.engine || state.constrainedDevice) return ''; try { const request = state.engine.chat.completions.create({ messages, temperature: .2, max_tokens: Math.min(maxTokens, 300) }); const result = await Promise.race([request, new Promise((_, reject) => setTimeout(() => reject(new Error('local inference timeout')), timeoutMs))]); return result.choices?.[0]?.message?.content?.trim() || ''; } catch (error) { try { state.engine.interruptGenerate?.(); } catch (_) {} console.warn('Local inference fallback', error); return ''; } };
  const loadLocalModel = async () => {
    const lang = state.detectedLanguage || 'ar'; const profile = profileFor(lang); const target = PROFILES[profile];
    if (profile === 'quick') { setProfileUI('quick'); $('#model-status').textContent = 'الهاتف أو الجهاز المحدود يستخدم الوضع السريع الآمن تلقائياً.'; $('#load-model-btn').textContent = 'الوضع السريع مفعّل'; return; }
    if (state.modelLoading || (state.engine && state.modelId === target.model)) return;
    state.modelLoading = true; $('#load-model-btn').disabled = true; $('#model-progress').hidden = false; $('#model-status').textContent = `جاري تجهيز ${target.label} للغة ${LANGUAGE_NAMES[lang] || lang}…`; setProfileUI(profile);
    try {
      state.webllm ||= await import('https://esm.run/@mlc-ai/web-llm');
      const supported = state.webllm.prebuiltAppConfig?.model_list?.some(x => x.model_id === target.model);
      if (!supported) throw new Error(`Unsupported model: ${target.model}`);
      if (state.engine?.reload) await state.engine.reload(target.model); else state.engine = await state.webllm.CreateMLCEngine(target.model, { initProgressCallback: setModelProgress });
      state.modelId = target.model; $('#model-status').textContent = `النموذج جاهز · ${LANGUAGE_NAMES[lang] || lang} · المعالجة داخل جهازك`; $('#load-model-btn').textContent = 'النموذج يعمل ✓';
    } catch (error) { state.engine = null; state.modelId = null; $('#model-status').textContent = 'تعذر تشغيل النموذج؛ عاد المساعد للوضع السريع الآمن.'; $('#load-model-btn').disabled = false; console.warn('Local LLM unavailable', error); } finally { state.modelLoading = false; }
  };
  const send = async text => { const value = text.trim(); if (!value || state.busy) return; state.busy = true; const lang = detectLanguage(value); setLanguageUI(lang); const wanted = profileFor(lang); if (wanted !== 'quick' && !state.engine && $('#auto-load-model')?.checked) await loadLocalModel(); addMessage(value, 'user'); $('#assistant-input').value = ''; let pending = null; try { if (state.engine && !state.constrainedDevice) { addMessage('أفكر محلياً…', 'bot'); pending = $('#chat').lastElementChild; const reply = await askLocal([{ role: 'system', content: `أنت مساعد MDM1. أجب بلغة المستخدم: ${LANGUAGE_NAMES[lang] || lang}. كن مختصراً وعملياً. لا تنفذ إجراءات خارجية.` }, { role: 'user', content: value }]); if (pending?.isConnected) pending.remove(); if (reply) { addMessage(`<p>${escape(reply).replace(/\n/g, '<br>')}</p>${cards(recommend(value))}`, 'bot', true); return; } } addMessage(fallbackAnswer(value), 'bot', true); } finally { if (pending?.isConnected) pending.remove(); state.busy = false; } };
  const stripFences = text => String(text || '').replace(/^```[a-zA-Z0-9+#-]*\s*/, '').replace(/```\s*$/, '').trim();
  const codeTemplate = (language, request) => { const safe = request.replace(/\*\//g, '* /'); if (language === 'html') return `<!doctype html>\n<html lang="ar" dir="rtl">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>مشروع MDM1</title></head><body><main><h1>${safe || 'مشروعي الجديد'}</h1><p>ابدأ من هذا القالب ثم عدّل المحتوى حسب حاجتك.</p></main></body>\n</html>`; if (language === 'javascript') return `// ${safe || 'مهمة JavaScript'}\nfunction startProject(options = {}) { return { ready: true, ...options }; }\nconsole.log(startProject({ name: 'my-project' }));`; if (language === 'python') return `"""${safe || 'مشروع Python'}"""\n\ndef main():\n    print('MDM1 project ready')\n\nif __name__ == '__main__':\n    main()`; return `-- ${safe || 'مخطط SQL'}\ncreate table if not exists projects (id bigint generated by default as identity primary key, name text not null);`; };
  const generateCode = async () => { const language = $('#code-language').value; const request = $('#code-request').value.trim() || 'مشروع صغير قابل للتوسعة'; const status = $('#code-status'); const lang = detectLanguage(request); setLanguageUI(lang); let code = ''; let usedLocal = false; if (state.engine && !state.constrainedDevice) { status.textContent = 'النموذج المحلي يكتب الكود…'; code = await askLocal([{ role: 'system', content: `أنت مولد كود. أعد كوداً صحيحاً فقط دون Markdown. اللغة: ${language}.` }, { role: 'user', content: request }], 220, 15000); usedLocal = Boolean(code); } code = stripFences(code) || codeTemplate(language, request); $('#code-output').textContent = code; status.textContent = usedLocal ? 'تم التوليد بالنموذج المحلي' : 'تم إنشاء قالب مجاني قابل للتعديل'; };
  const init = () => {
    const selector = $('#model-profile'); if (selector) selector.addEventListener('change', () => { state.profile = selector.value; setProfileUI(profileFor(state.detectedLanguage)); });
    setLanguageUI('ar'); setProfileUI(profileFor('ar'));
    if (state.constrainedDevice) { $('#model-status').textContent = 'الهاتف يستخدم الوضع السريع الآمن تلقائياً.'; $('#load-model-btn').textContent = 'الوضع السريع مفعّل'; }
    $('#load-model-btn').addEventListener('click', loadLocalModel); $('#assistant-form').addEventListener('submit', e => { e.preventDefault(); send($('#assistant-input').value); }); document.querySelectorAll('[data-prompt]').forEach(b => b.addEventListener('click', () => send(b.dataset.prompt))); $('#demo-btn').addEventListener('click', () => { $('#assistant-box').scrollIntoView({ behavior: 'smooth' }); window.setTimeout(() => send('أريد أداة مجانية لتنظيم مشروع'), 450); }); $('#share-btn').addEventListener('click', async () => { const shareUrl = `${location.origin}/assistant/?utm_source=share&utm_medium=referral&utm_campaign=global_assistant`; try { if (navigator.share) await navigator.share({ title: 'مساعد MDM1 الشخصي', text: 'مساعد مجاني لاكتشاف الأدوات وتوليد الأكواد', url: shareUrl }); else await navigator.clipboard.writeText(shareUrl); } catch (_) {} }); $('#clear-btn').addEventListener('click', () => { $('#chat').innerHTML = '<div class="message bot"><div class="avatar">◈</div><div class="bubble"><strong>مساعد MDM1</strong><p>محادثة جديدة جاهزة. ما الذي تريد إنجازه؟</p></div></div>'; }); $('#generate-code-btn').addEventListener('click', generateCode); $('#copy-code-btn').addEventListener('click', async () => { await navigator.clipboard?.writeText($('#code-output').textContent); $('#code-status').textContent = 'تم نسخ الكود'; }); $('#download-code-btn').addEventListener('click', () => { const lang = $('#code-language').value; const ext = { html: 'html', javascript: 'js', python: 'py', sql: 'sql' }[lang]; const blob = new Blob([$('#code-output').textContent], { type: 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mdm1-project.${ext}`; a.click(); URL.revokeObjectURL(a.href); });
    Promise.allSettled(['/data/catalog.json', '/data/tools.json', '/data/games.json'].map(url => fetch(url).then(r => r.ok ? r.json() : null))).then(results => { results.forEach((r, i) => { if (r.status !== 'fulfilled' || !r.value) return; const value = r.value; if (i === 0 && value.records) state.items.push(...value.records); if (i === 1 && value.tools) state.items.push(...value.tools); if (i === 2 && Array.isArray(value)) state.items.push(...value); }); state.items = state.items.map(x => ({ ...x, title: x.title || x.name || x.displayTitle, url: x.url || '#' })); });
  };
  init();
})();
