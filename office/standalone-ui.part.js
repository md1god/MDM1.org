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
  /* A stored timestamp is editable from DevTools, so it is not a lock.
     The unlocked state lives only in this page's memory and is cleared on
     reload. Every /api/* call is gated on it (see standalone-api.part.js). */
  var unlockedInMemory = false;
  function isUnlocked() {
    if (!CFG.requireUnlock) return true;
    return unlockedInMemory;
  }
  var unlockWaiters = [];
  function waitUnlock() {
    if (isUnlocked()) return Promise.resolve();
    return new Promise(function (resolve) { unlockWaiters.push(resolve); });
  }
  function unlockFor(hours) {
    unlockedInMemory = true;
    var waiters = unlockWaiters.splice(0);
    waiters.forEach(function (resolve) { resolve(); });
  }

  /* A verified Google session IS the unlock. The lock itself lives only in this
     page's memory (a full-page redirect to Google resets it), so after coming
     back from Google we open the page as soon as the server-verified session
     (/auth/v1/user) is known. Errors from the return trip are shown on the lock. */
  function autoUnlockForGoogle() {
    var A = window.MDM1Auth;
    if (!CFG.requireUnlock || !A || typeof A.status !== 'function') return;
    function check(s) {
      s = s || A.status();
      var overlay = document.getElementById('officeLock');
      if (isUnlocked()) { if (overlay) overlay.remove(); return; }
      if (s.googleReady) {
        unlockFor(24);
        if (overlay) overlay.remove();
        return;
      }
      var msg = overlay && overlay.querySelector('#officeLockMsg');
      if (msg && s.error) { msg.textContent = s.error; msg.className = 'office-lock-msg error'; }
      else if (msg && s.loading) { msg.textContent = 'جارٍ التحقق من حساب Google...'; msg.className = 'office-lock-msg'; }
    }
    if (typeof A.onChange === 'function') A.onChange(check);
    if (A.ready && typeof A.ready.then === 'function') A.ready.then(function () { check(); });
    check();
  }

  function buildLockScreen() {
    if (!CFG.requireUnlock || isUnlocked()) return;
    var overlay = document.createElement('div');
    overlay.id = 'officeLock';
    overlay.innerHTML =
      '<div class="office-lock-card">' +
      (CFG.brandImage ? '<img class="office-brand-logo" src="' + esc(CFG.brandImage) + '" alt="MD1&#117;sd Company" />' : '<div class="office-lock-logo">🏢</div>') +
      '<h1>MD1&#117;sd Company — دخول خاص</h1>' +
      '<p class="office-lock-sub">هذه الصفحة غير مرتبطة بالقائمة. الدخول بكلمة السر الخاصة بك أو بحساب Google؛ لا تُستخدم مفاتيح مشتركة.</p>' +
      '<label>كلمة السر</label><input id="officePassInput" type="password" placeholder="كلمة سر المكتب..." autocomplete="current-password" />' +
      '<button id="officePassBtn" class="office-btn primary">دخول</button>' +
      '<button id="officeGoogleBtn" class="office-btn" type="button">🔵 متابعة عبر Google</button>' +
      '<button id="officeInstallBtn" class="office-btn install-app-btn" type="button">💻 تثبيت التطبيق على الجهاز</button>' +
      '<div id="officeLockMsg" class="office-lock-msg"></div>' +
      '<div class="office-lock-links"><a href="https://mdm1.org/" target="_blank" rel="noopener">mdm1.org</a></div>' +
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
    var input = overlay.querySelector('#officePassInput');
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') overlay.querySelector('#officePassBtn').click(); });
  }

  /* ── encrypted vault gate (after the office passphrase) ───────────────── */
  var vaultWaiters = [];
  function waitVaultUnlock() {
    var v = vaultStatus();
    if (!v.exists && !v.pendingMigration && !v.hasKeys) return Promise.resolve();
    if (!v.needsUnlock && !v.pendingMigration) return Promise.resolve();
    return new Promise(function (resolve) { vaultWaiters.push(resolve); });
  }
  function resolveVaultWaiters() {
    var list = vaultWaiters.splice(0);
    list.forEach(function (resolve) { resolve(); });
  }
  function buildVaultGate() {
    var v = vaultStatus();
    if (!v.exists && !v.pendingMigration && !v.hasKeys) return;
    if (!v.needsUnlock && !v.pendingMigration) return;
    if (document.getElementById('officeVaultGate')) return;
    var creating = !v.exists;
    var overlay = document.createElement('div');
    overlay.id = 'officeVaultGate';
    overlay.className = 'office-vault-gate';
    overlay.innerHTML =
      '<div class="office-lock-card">' +
      '<div class="office-lock-logo">🔐</div>' +
      '<h1>' + (creating ? 'أنشئ خزنة مفاتيحك' : 'الخزنة مقفلة') + '</h1>' +
      '<p class="office-lock-sub">' + (creating
        ? 'وجدنا مفاتيح تحتاج حماية. اختر كلمة مرور للخزنة — لا تُحفظ ولا تُرسل لأي خادم. ستحتاجها بعد كل إعادة تحميل.'
        : 'مفاتيحك محفوظة مشفّرة على هذا الجهاز. أدخل كلمة مرور الخزنة لفتحها في ذاكرة هذه الجلسة.') + '</p>' +
      '<label>كلمة مرور الخزنة</label><input id="officeVaultPass" type="password" placeholder="كلمة مرور الخزنة..." autocomplete="current-password" />' +
      (creating ? '<label>تأكيد كلمة المرور</label><input id="officeVaultPass2" type="password" placeholder="أعد كتابتها..." autocomplete="new-password" />' : '') +
      '<button id="officeVaultBtn" class="office-btn primary">' + (creating ? '🔒 إنشاء الخزنة وحفظ المفاتيح' : '🔓 فتح الخزنة') + '</button>' +
      '<button id="officeVaultDisconnect" class="office-btn" type="button">🗑️ فصل كل المفاتيح وحذف الخزنة</button>' +
      '<div id="officeVaultMsg" class="office-lock-msg"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    var msg = overlay.querySelector('#officeVaultMsg');
    function fail(t) { msg.textContent = t; msg.className = 'office-lock-msg error'; }
    function done() { msg.textContent = 'تم...'; msg.className = 'office-lock-msg ok'; setTimeout(function () { overlay.remove(); resolveVaultWaiters(); }, 350); }
    overlay.querySelector('#officeVaultBtn').onclick = function () {
      var pass = overlay.querySelector('#officeVaultPass').value;
      if (!pass) { fail('أدخل كلمة مرور الخزنة.'); return; }
      if (creating) {
        var pass2 = overlay.querySelector('#officeVaultPass2').value;
        if (pass !== pass2) { fail('كلمتا المرور غير متطابقتين.'); return; }
        encryptSecrets(pass).then(function (r) { r.ok ? done() : fail('❌ ' + r.error); });
      } else {
        unlockVault(pass, true).then(function (r) { r.ok ? done() : fail('❌ ' + r.error); });
      }
    };
    overlay.querySelector('#officeVaultDisconnect').onclick = function () {
      if (!window.confirm('سيُحذف كل المفاتيح والخزنة من هذا الجهاز. هل أنت متأكد؟')) return;
      disconnectProvider('all').then(function () { done(); });
    };
    overlay.querySelector('#officeVaultPass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') overlay.querySelector('#officeVaultBtn').click();
    });
  }
  function showVaultGate() { buildVaultGate(); }

  /* ── connection panel ─────────────────────────────────────────────────── */
  function injectStyles() { /* runtime CSS lives in styles.css (pwa21) */ }

  function openConnectionPanel(options) {
    if (document.getElementById('officeConnModal')) {
      applyConnectionFocus(options);
      return;
    }
    var modal = document.createElement('div');
    modal.id = 'officeConnModal';
    modal.className = 'office-modal';
    var agentOptions = allAgents().map(function (a) {
      return '<div class="office-model-row" data-agent="' + escAttr(a.id) + '"><span>' + esc(a.avatar) + ' ' + esc(a.name) + '</span><select data-model-for="' + escAttr(a.id) + '"></select></div>';
    }).join('');
    modal.innerHTML =
      '<div class="office-modal-card">' +
      '<h2>🔌 الاتصال بالنماذج وبوت تيليجرام</h2>' +
      (CFG.brandImage ? '<div class="office-brand-card"><img src="' + esc(CFG.brandImage) + '" alt="MD1&#117;sd Company" /><div><strong>MD1&#117;sd Company — AI Virtual Office</strong><span>صفحة خاصة لا تظهر في قائمة الموقع. كل البيانات والمفاتيح تبقى في متصفحك.</span></div></div>' : '') +
      '<p>مفاتيحك أنت فقط هي التي تُستخدم، وتُحفظ في خزنة مشفّرة تبقى بعد إعادة التحميل ولا تُحذف إلا عند «الفصل». النموذج المحلي يعمل داخل متصفحك عبر WebGPU مثل مساعد MDM1 في /assistant/. كل النماذج المعروضة تأتي من القائمة الحية للمزود — اختر ما تريد.</p>' +
      '<div class="office-grid2">' +
      '<div><label>المزود</label><select id="ocMode"><option value="auto">تلقائي (مفاتيحك أنت فقط)</option><option value="local">محلي — WebGPU داخل المتصفح</option><option value="zen">OpenCode Zen (مفتاحك أنت)</option><option value="groq">Groq (مفتاحك أنت)</option><option value="openrouter">OpenRouter (مفتاحك أنت)</option><option value="demo">بدون نموذج حي</option></select></div>' +
      '<div><label>تفضيل النماذج المجانية</label><select id="ocFree"><option value="true">نعم — مجاني حيث عُرف</option><option value="false">اعرض كل النماذج المتاحة</option></select></div>' +
      '</div>' +
      '<div id="ocBrowserBox" class="office-browser-box">' +
      '<div class="office-grid2"><div><label>ملف النموذج المحلي</label><select id="ocBrowserProfile"><option value="auto">تلقائي حسب الجهاز واللغة</option><option value="quick">الوضع السريع الآمن</option><option value="multilingual">Qwen متعدد اللغات · خفيف</option><option value="balanced">Qwen3 · متوازن</option><option value="coding">Qwen Coder · برمجة</option></select></div>' +
      '<div><label class="office-check"><input id="ocBrowserAutoLoad" type="checkbox" checked /> حمّل النموذج المحلي عند الحاجة</label></div></div>' +
      '<div class="office-actions"><button class="office-btn" id="ocBrowserLoad" type="button">🧠 تحميل النموذج المحلي</button></div>' +
      '<div id="ocBrowserStatus" class="office-status">لم يُحمّل النموذج المحلي بعد.</div>' +
      '<progress id="ocBrowserProgress" max="100" value="0" class="office-progress"></progress>' +
      '</div>' +
      '<div class="office-grid2">' +
      '<div><label>مفتاح OpenCode Zen</label><input id="ocZenKey" type="password" placeholder="اتركه فارغاً للإبقاء على المفتاح المحفوظ" /><button class="office-btn tiny" data-disconnect="zen" type="button">فصل Zen</button></div>' +
      '<div><label>عنوان Zen</label><input id="ocZenBase" type="text" /></div>' +
      '</div>' +
      '<div class="office-grid2">' +
      '<div><label>مفتاح Groq</label><input id="ocGroqKey" type="password" placeholder="اتركه فارغاً للإبقاء على المفتاح المحفوظ" /><button class="office-btn tiny" data-disconnect="groq" type="button">فصل Groq</button></div>' +
      '<div><label>عنوان Groq</label><input id="ocGroqBase" type="text" /><label>النموذج من القائمة الحية</label><select id="ocGroqModel"><option value="">اختبر الاتصال أولاً</option></select></div>' +
      '</div>' +
      '<div class="office-grid2">' +
      '<div><label>مفتاح OpenRouter</label><input id="ocOrKey" type="password" placeholder="اتركه فارغاً للإبقاء على المفتاح المحفوظ" /><button class="office-btn tiny" data-disconnect="openrouter" type="button">فصل OpenRouter</button></div>' +
      '<div><label>النموذج من القائمة الحية</label><select id="ocOrModel"><option value="">اختبر الاتصال أولاً</option></select></div>' +
      '</div>' +
      '<label>اسم بوت تيليجرام (بدون @)</label><input id="ocBot" type="text" placeholder="MD1_Office_bot" />' +
      '<div class="office-grid2">' +
      '<div><label>Supabase Relay URL (اختياري للإرسال التلقائي)</label><input id="ocRelay" type="text" placeholder="https://...supabase.co/functions/v1/office-relay" /></div>' +
      '<div><label>هوية الإرسال</label><div class="office-status">تسجيل الدخول بحساب Google يفعّل الإرسال والمزامنة؛ لا تُدخل أي سر مشترك.</div></div>' +
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
      '<div><label>المزود المراد اختباره</label><select id="ocLabProvider"><option value="local">محلي — WebGPU</option><option value="zen">OpenCode Zen (مفتاحك)</option><option value="groq">Groq (مفتاحك)</option><option value="openrouter">OpenRouter (مفتاحك)</option></select></div>' +
      '<div><label>الدور</label><select id="ocLabRole">' + allAgents().map(function (a) { return '<option value="' + escAttr(a.id) + '">' + esc(a.avatar) + ' ' + esc(a.name) + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<label>النموذج بالضبط</label><input id="ocLabModel" type="text" placeholder="اختر مزوداً لملء النموذج تلقائياً" />' +
      '<div class="office-actions"><button class="office-btn" id="ocLabTest">🧪 اختبار الكفاءة</button><button class="office-btn" id="ocLabTrain">🎓 تدريب/ضبط</button><button class="office-btn" id="ocLabAssign">✅ تعيين المؤهلين</button><button class="office-btn" id="ocLabReport">📋 النتائج</button></div>' +
      '<div id="ocLabOut" class="office-status quota">لم تُجرَّب أي نماذج بعد.</div>' +
      '<label style="margin-top:16px;">🛡️ باحث الأسرار والمطور التلقائي</label>' +
      '<p>يفحص الباحث الإعدادات والتخزين المحلي بحثاً عن مفاتيح مكشوفة ويعرضها مُعمّاة، ثم يشفّرها في خزنة AES-256-GCM بكلمة مرور تُدخلها أنت ولا تُحفظ. المطور التلقائي يقترح إصلاحات آمنة للإعدادات فقط.</p>' +
      '<label>كلمة مرور الخزنة (للتشفير أو فتح القفل بعد إعادة التحميل)</label><input id="ocVaultPass" type="password" placeholder="كلمة مرور الخزنة..." />' +
      '<div class="office-actions"><button class="office-btn" id="ocSecScan">🕵️ فحص المفاتيح</button><button class="office-btn" id="ocSecEncrypt">🔒 إنشاء/تحديث الخزنة</button><button class="office-btn" id="ocSecUnlock">🔓 فتح الخزنة</button><button class="office-btn" id="ocSecLock">🔒 قفل الخزنة في الذاكرة</button><button class="office-btn" id="ocSecDisconnectAll">🗑️ فصل كل المفاتيح</button><button class="office-btn" id="ocDevUpdate">🧑‍💻 تحديث تلقائي آمن</button></div>' +
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
      '<p>يُرسل عبر Supabase Edge Relay بهويتك ومفاتيحك أنت فقط. المطلوب: تسجيل الدخول بحساب Google؛ لا يُطلب أي سر مشترك.</p>' +
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
    if (settings.mode === 'cloud' || settings.mode === 'supabase') settings.mode = 'auto';
    q('ocMode').value = settings.mode;
    q('ocFree').value = String(settings.freeOnly);
    q('ocBrowserProfile').value = settings.browserProfile || 'auto';
    q('ocBrowserAutoLoad').checked = settings.browserAutoLoad !== false;
    function maskKey(id, field) {
      var el = q(id), s = secret(field);
      el.value = '';
      el.placeholder = s ? '••••' + s.slice(-4) + ' — اتركه فارغاً للإبقاء' : 'الصق مفتاحك هنا';
      el.title = s ? 'مفتاح محفوظ في الخزنة — اترك الحقل فارغاً للإبقاء عليه' : '';
    }
    maskKey('ocZenKey', 'zenKey');
    maskKey('ocGroqKey', 'groqKey');
    maskKey('ocOrKey', 'openrouterKey');
    q('ocZenBase').value = settings.zenBase;
    q('ocGroqBase').value = settings.groqBase;
    q('ocBot').value = settings.telegramBot;
    q('ocRelay').value = settings.relayUrl;
    q('ocWaTo').value = settings.whatsappTo || '';
    q('ocSyncUrl').value = settings.syncUrl;
    q('ocSyncSecret').value = secret('syncSecret');
    q('ocSyncEnabled').value = String(settings.syncEnabled);

    function liveOptions(cache, selected) {
      var listing = cache || {};
      var all = (listing.models || []).map(function (m) { return m.id; });
      var free = listing.free || [];
      var ids = all.length ? all : (free || []);
      var opts = '<option value="">' + (ids.length ? 'اختر من القائمة الحية' : 'لا توجد نماذج حية — اختبر الاتصال أولاً') + '</option>' +
        ids.map(function (id) {
          var tag = free.indexOf(id) !== -1 ? ' ✓ مجاني' : '';
          return '<option value="' + escAttr(id) + '"' + (selected === id ? ' selected' : '') + '>' + esc(id) + tag + '</option>';
        }).join('');
      return { html: opts, ids: ids };
    }
    function fillModels(models, free) {
      var ids = (models || []).map(function (m) { return m.id; });
      var pool = ids;
      var g = liveOptions(providerCache.groq, settings.groqModel);
      var o = liveOptions(providerCache.openrouter, settings.openrouterModel);
      if (q('ocGroqModel')) q('ocGroqModel').innerHTML = g.html;
      if (q('ocOrModel')) q('ocOrModel').innerHTML = o.html;
      var lab = q('ocLabProvider') ? q('ocLabProvider').value : 'local';
      var labCache = lab === 'local' ? providerCache.local : lab === 'zen' ? providerCache.zen : lab === 'groq' ? providerCache.groq : providerCache.openrouter;
      if (q('ocLabModel')) q('ocLabModel').innerHTML = liveOptions(labCache, q('ocLabModel').value).html;
      modal.querySelectorAll('select[data-model-for]').forEach(function (sel) {
        var agentId = sel.getAttribute('data-model-for');
        var current = settings.modelOverrides[agentId] || '';
        sel.innerHTML = '<option value="">تلقائي — ' + esc(pickModel(agentId, pool) || '—') + '</option>' + pool.map(function (id) {
          return '<option value="' + escAttr(id) + '"' + (current === id ? ' selected' : '') + '>' + esc(id) + '</option>';
        }).join('');
        if (!sel.dataset.modelBound) {
          sel.dataset.modelBound = '1';
          sel.addEventListener('change', function () { sel.dataset.touched = '1'; });
        }
      });
    }

    function readForm() {
      settings.mode = q('ocMode').value;
      settings.freeOnly = q('ocFree').value === 'true';
      settings.browserProfile = q('ocBrowserProfile').value || 'auto';
      settings.browserAutoLoad = Boolean(q('ocBrowserAutoLoad').checked);
      settings.zenBase = q('ocZenBase').value.trim() || 'https://opencode.ai/zen/v1';
      settings.groqBase = q('ocGroqBase').value.trim() || 'https://api.groq.com/openai/v1';
      settings.groqModel = q('ocGroqModel').value.trim() || '';
      settings.openrouterModel = q('ocOrModel').value.trim() || '';
      settings.telegramBot = q('ocBot').value.trim().replace(/^@/, '');
      settings.relayUrl = q('ocRelay').value.trim();
      settings.whatsappTo = q('ocWaTo').value.trim();
      settings.syncUrl = q('ocSyncUrl').value.trim();
      settings.syncEnabled = q('ocSyncEnabled').value === 'true';
      /* Blank key inputs mean "keep the stored key" — never delete a key. */
      var changed = false;
      function take(id, field) {
        var v = q(id) ? q(id).value.trim() : '';
        if (v && typeof setSecret === 'function' && setSecret(field, v)) changed = true;
      }
      take('ocZenKey', 'zenKey');
      take('ocGroqKey', 'groqKey');
      take('ocOrKey', 'openrouterKey');
      take('ocSyncSecret', 'syncSecret');
      /* Only an explicit user change updates an override. */
      modal.querySelectorAll('select[data-model-for]').forEach(function (sel) {
        if (sel.dataset.touched !== '1') return;
        var agentId = sel.getAttribute('data-model-for');
        if (sel.value) settings.modelOverrides[agentId] = sel.value;
        else delete settings.modelOverrides[agentId];
      });
      saveSettings();
      providerCache.cloud = null; providerCache.local = null; providerCache.zen = null;
      providerCache.groq = null; providerCache.openrouter = null;
      if (changed && runtimeVault.key) persistSecrets();
      else if (changed && !runtimeVault.key) showVaultGate();
      return changed;
    }

    function status(text, cls) {
      var el = q('ocStatus');
      el.textContent = text;
      el.className = 'office-status ' + (cls || '');
    }
    function showSyncRollback() {
      var old = q('ocSyncRollback'); if (old) old.remove();
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'office-btn'; btn.id = 'ocSyncRollback';
      btn.textContent = '↩️ استعادة نسختي قبل التعارض';
      btn.onclick = function () {
        var r = restoreSyncBackup();
        status(r.ok ? '✅ تمت استعادة حالتك المحلية من قبل التعارض.' : '❌ ' + (r.error || 'تعذّرت الاستعادة.'), r.ok ? 'ok' : 'err');
        btn.remove(); renderQuota();
      };
      q('ocStatus').appendChild(document.createTextNode(' '));
      q('ocStatus').appendChild(btn);
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

    function chatStateLabel(mode, connected) {
      var h = providerChatHealth[mode];
      if (!connected) return 'غير متصل';
      if (h && h.ok === false && Date.now() - h.at < 15 * 60 * 1000) return 'متصل للقائمة فقط — التنفيذ محجوب';
      return 'متصل';
    }
    function test(opts) {
      /* Event handlers pass the click event; only skip form reads when the
         panel is first opened (fields may still be vault-locked/empty). */
      if (!(opts && opts.read === false)) readForm();
      renderQuota();
      status('جارٍ فحص الاتصال...', '');
      Promise.all([listLocalModels(true), listZenModels(true), listGroqModels(true), listOpenRouterModels(true), listCloudModels(true)]).then(function (r) {
        var mode = currentMode();
        var listing = mode === 'cloud' ? r[4] : mode === 'zen' ? r[1] : mode === 'groq' ? r[2] : mode === 'openrouter' ? r[3] : r[0];
        if (mode === 'demo') { status('وضع بدون نموذج: الواجهة تعمل بدون نموذج.', 'ok'); fillModels([], []); return; }
        var localLabel = r[0].quick ? 'وضع سريع آمن' : chatStateLabel('local', r[0].connected);
        var providerLine = 'Cloud: معطّل (مفاتيحك أنت فقط)' +
          ' · محلي WebGPU: ' + localLabel +
          ' · Zen: ' + chatStateLabel('zen', r[1].connected) +
          ' · Groq: ' + chatStateLabel('groq', r[2].connected) + (r[2].connected ? ' (' + r[2].models.length + ' نموذج)' : '') +
          ' · OpenRouter: ' + chatStateLabel('openrouter', r[3].connected) + (r[3].connected ? ' (' + r[3].models.length + ' نموذج)' : '');
        var vaultLine = vaultStatus().needsUnlock ? '\n🔐 الخزنة مقفلة — افتحها لتفعيل المفاتيح.' : '';
        if (!listing.connected && !(mode === 'local' && r[0].quick)) {
          status('غير متصل بالمزود المختار: ' + (listing.error || 'تحقق من المفتاح.') + '\n' + providerLine + vaultLine, 'err'); fillModels([], []); return;
        }
        var free = listing.free || [];
        status((mode === 'local' && r[0].quick ? '🟡 الوضع السريع الآمن — بلا نموذج محلي على هذا الجهاز.' : '✅ متصل — ' + listing.models.length + ' نموذج، منها ' + free.length + ' مجاني.') + '\n' +
          (free.length ? 'المجاني: ' + free.slice(0, 8).join(', ') + (free.length > 8 ? '…' : '') : 'لا توجد أسعار منشورة — جميع النماذج المعروضة حية.') +
          '\n' + providerLine + vaultLine + '\nالعنوان الفعّال: ' + (listing.base || ''), mode === 'local' && r[0].quick ? '' : 'ok');
        fillModels(listing.models, free);
      }).then(renderQuota);
    }

    function labDefaultModel(provider) {
      var key = provider === 'local' ? 'local' : provider;
      var cache = providerCache[key];
      var live = (cache && (cache.free && cache.free.length ? cache.free : (cache.models || []).map(function (m) { return m.id; }))) || [];
      if (provider === 'groq' && settings.groqModel && live.indexOf(settings.groqModel) !== -1) return settings.groqModel;
      if (provider === 'openrouter' && settings.openrouterModel && live.indexOf(settings.openrouterModel) !== -1) return settings.openrouterModel;
      return live[0] || '';
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
    function vaultSecLine() {
      var v = vaultStatus();
      return '🔐 الخزنة: ' + (v.exists ? (v.unlocked ? 'مفتوحة' : 'مقفلة') : 'غير منشأة') +
        (v.fields.length ? ' — الحقول: ' + v.fields.join(', ') : '') +
        (v.needsUnlock ? ' — افتحها لتفعيل المفاتيح.' : '');
    }
    secOut(vaultSecLine());
    window.addEventListener('mdm1-vault-change', function () {
      if (document.body.contains(modal)) {
        secOut(vaultSecLine());
        maskKey('ocZenKey', 'zenKey'); maskKey('ocGroqKey', 'groqKey'); maskKey('ocOrKey', 'openrouterKey');
      }
    });
    q('ocSecLock').onclick = function () { lockVault(); secOut(vaultSecLine()); };
    q('ocSecDisconnectAll').onclick = function () {
      if (!window.confirm('سيُحذف كل المفاتيح من الخزنة. هل أنت متأكد؟')) return;
      disconnectProvider('all').then(function () { secOut(vaultSecLine()); });
    };
    modal.querySelectorAll('[data-disconnect]').forEach(function (btn) {
      btn.onclick = function () {
        var p = btn.getAttribute('data-disconnect');
        if (!window.confirm('فصل ' + p + ' وحذف مفتاحه من الخزنة؟')) return;
        disconnectProvider(p).then(function () { secOut(vaultSecLine()); maskKey(p === 'zen' ? 'ocZenKey' : p === 'groq' ? 'ocGroqKey' : 'ocOrKey', p + 'Key'); });
      };
    });
    q('ocBrowserLoad').onclick = function () {
      var btn = q('ocBrowserLoad'), bar = q('ocBrowserProgress'), st = q('ocBrowserStatus');
      btn.disabled = true; st.textContent = 'جارٍ تحميل النموذج المحلي...';
      ensureBrowserEngine(function (info) {
        bar.value = Math.max(0, Math.min(100, Math.round((Number(info.progress) || 0) * 100)));
        st.textContent = info.text || 'تحميل النموذج…';
      }, detectLanguage(q('ocMsgText') ? q('ocMsgText').value : 'مرحباً')).then(function (r) {
        btn.disabled = false;
        st.textContent = r.ok ? '✅ النموذج المحلي جاهز: ' + r.modelId : '⚠️ ' + (r.error || 'الوضع السريع الآمن');
      });
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
        if (r.applied) showSyncRollback();
        renderQuota();
      }).catch(function (e) { status('فشل السحب: ' + e.message, 'err'); });
    };
    q('ocSyncPush').onclick = function () {
      readForm();
      status('جارٍ رفع الحالة المشفّرة...', '');
      syncPush().then(function (r) {
        if (!r.configured) return status('المزامنة غير مهيّأة. أدخل URL والسر ثم فعّلها.', 'err');
        status(r.conflict ? '⚠️ تعارض: سُحبت النسخة الأحدث؛ احتفظت بنسخة محلية للتراجع.' : '✅ تم رفع الحالة (إصدار ' + r.version + ').', r.conflict ? '' : 'ok');
        if (r.conflict) showSyncRollback();
        renderQuota();
      }).catch(function (e) { status('فشل الرفع: ' + e.message, 'err'); });
    };
    function renderOutbox() {
      q('ocOutbox').innerHTML = state.telegramOutbox.map(function (x) { return '<div>' + esc(String(x.text).slice(0, 160)) + '</div>'; }).join('') || '<div>لا رسائل بعد.</div>';
    }
    renderOutbox();
    renderAuthStatus();
    watchAuth();
    test({ read: false });
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
    if (!s.signedIn) return { text: '👤 بدون حساب — المكتب مقفل', cls: '', sig: 'signed-out', ready: false, requiresTotp: false, verified: false };
    if (!s.googleReady) return { text: '⛔ فقط حساب Google مسموح داخل المكتب', cls: 'err', sig: 'google-required', ready: false, requiresTotp: false, verified: false };
    if (s.requiresTotp) return { text: '🔐 مطلوب TOTP للإرسال', cls: 'warn', sig: 'totp-required', ready: false, requiresTotp: true, verified: false };
    return {
      text: '✅ هوية Google موثّقة' + (s.verifiedFactors ? ' · TOTP' : ''),
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
      if (s && s.googleReady && secret('syncSecret')) {
        syncPull().catch(function (e) { console.warn('Office secure sync pull after sign-in failed:', e.message); });
      }
    });
  }

  /* ── boot ─────────────────────────────────────────────────────────────── */
  var resolveReady;
  var readyPromise = new Promise(function (resolve) { resolveReady = resolve; });
  function waitGoogleIdentity() {
    return new Promise(function (resolve) {
      var A = window.MDM1Auth;
      /* Offline / no encrypted sync: never block the whole office on Google. */
      if (!syncConfigured() || !secret('syncSecret')) return resolve(false);
      if (!A || typeof A.status !== 'function') return resolve(false);
      if (A.status().googleReady) return resolve(true);
      var settled = false;
      function done(value) { if (settled) return; settled = true; resolve(value); }
      var timer = window.setTimeout(function () { done(false); }, 2500);
      var stop = A.onChange(function (s) {
        if (s && s.googleReady) { window.clearTimeout(timer); if (stop) stop(); done(true); }
      });
    });
  }

  var loopsStarted = false;
  function startBackgroundLoops() {
    if (loopsStarted) return;
    loopsStarted = true;
    window.setTimeout(function () { runDueSchedules().catch(function () { return null; }); }, 4000);
    window.setInterval(function () {
      if (state.emergencyMode) return;
      startTaskRunner();
      runDueSchedules().catch(function () { return null; });
      processDurableQueue().catch(function () { return null; });
    }, 60000);
  }

  function boot() {
    injectStyles();
    watchAuth();
    buildLockScreen();
    autoUnlockForGoogle();
    loadCompanyData()
      .then(waitUnlock)
      .then(function () { buildVaultGate(); return waitVaultUnlock(); })
      .then(waitGoogleIdentity)
      .then(function () {
        return syncPull().catch(function (e) { console.warn('Office secure sync pull failed:', e.message); return { configured: false }; });
      })
      .then(function () {
        /* Local memory is device-only: restore it AFTER secure sync so a cloud
           pull can never overwrite it, then mirror the merged list back. */
        if (typeof memoryRestore === 'function') {
          memoryRestore().then(function (added) { if (added) { saveState(); memoryMirror(); } }).catch(function () {});
        }
        if (typeof quarantineUnapprovedAssistantTasks === 'function') quarantineUnapprovedAssistantTasks();
        injectTopbarButton();
        bindQuickButtons();
        autopilotInit();
        updateQuotaBadge();
        startBackgroundLoops();
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
    runSelfTests: runSelfTests,
    /* Local Arabic memory — stored in this browser only, with explicit forget. */
    localMemory: {
      list: function () { return activeLocalMemories().map(function (m) { return clone(m); }); },
      add: addLocalMemory,
      forget: forgetLocalMemory,
      clear: clearLocalMemories,
      restore: memoryRestore,
      mirror: memoryMirror
    },
    sanitizeContext: sanitizeContextText,
    redTeamDrill: redTeamDrill,
    /* Short-lived local undo and signed SOP packs */
    approvalUndo: {
      list: function () { return (state.approvalUndo || []).map(function (u) { return clone(u); }); },
      activeFor: activeUndoFor,
      run: undoApprovalLocal
    },
    sop: {
      templates: sopTemplates,
      buildPack: buildSopPack,
      verifyPack: verifySopPack
    },
    listBrowserModels: listLocalModels,
    ensureBrowserEngine: ensureBrowserEngine,
    vaultStatus: vaultStatus,
    createVault: encryptSecrets,
    unlockVault: unlockVault,
    lockVault: lockVault,
    disconnectProvider: disconnectProvider,
    disconnectAll: function () { return disconnectProvider('all'); },
    waitVaultUnlock: waitVaultUnlock,
    showVaultGate: showVaultGate,
    get modelCatalog() { return { local: providerCache.local && providerCache.local.models, zen: providerCache.zen && providerCache.zen.models, groq: providerCache.groq && providerCache.groq.models, openrouter: providerCache.openrouter && providerCache.openrouter.models }; },
    autopilot: { start: apStart, stop: apStop, cycle: apCycle, status: apState, openPanel: openAutopilot, startHere: openStartHere, readPages: urlsContextFor },
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
    restoreSyncBackup: restoreSyncBackup,
    queueAdd: queueAdd,
    queueList: queueList,
    queueComplete: queueComplete,
    processDurableQueue: processDurableQueue,
    runDueSchedules: runDueSchedules,
    completeTask: completeTask,
    quotaRelease: quotaRelease,
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
