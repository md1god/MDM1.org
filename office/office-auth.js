/* ============================================================================
   MDM1 AI Office — browser identity layer (public, no secrets)
   ----------------------------------------------------------------------------
   Google / email sign-in and optional TOTP through Supabase Auth REST.
   This is an EXTRA layer: the private office passphrase is still required to
   open the page. Supabase publishable key and function URL are public by
   design; no service-role key, Google client secret or bot token is here.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.OFFICE_CONFIG || {};
  var AUTH = CFG.auth || {};
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  var storageKey = (CFG.storageKey || 'mdm1_office_v2') + '_auth';
  var pkceKey = storageKey + '_pkce';
  var enabled = AUTH.enabled !== false && Boolean(AUTH.supabaseUrl && AUTH.publishableKey);
  var authBase = String(AUTH.supabaseUrl || '').replace(/\/+$/, '') + '/auth/v1';
  var publicHeaders = {
    apikey: String(AUTH.publishableKey || ''),
    'content-type': 'application/json'
  };

  var listeners = [];
  var state = {
    session: null,
    user: null,
    factors: [],
    enroll: null,
    aal: 'aal1',
    nextLevel: 'aal1',
    requiresTotp: false,
    loading: true,
    error: null
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeJson(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }
  function b64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function bytesOfB64u(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function randomVerifier() {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return b64url(bytes);
  }
  function challengeOf(verifier) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (buf) {
      return b64url(new Uint8Array(buf));
    });
  }
  function jwtPayload(token) {
    var parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    return safeJson(new TextDecoder().decode(bytesOfB64u(parts[1])), null);
  }
  function redirectTo() {
    return AUTH.redirectTo || (location.origin + location.pathname);
  }
  function readStored() {
    return safeJson(localStorage.getItem(storageKey), null);
  }
  function storeSession(session) {
    try {
      if (session) localStorage.setItem(storageKey, JSON.stringify(session));
      else localStorage.removeItem(storageKey);
    } catch (e) { /* private mode / storage full: session stays in memory */ }
  }
  function emit() {
    listeners.slice().forEach(function (fn) {
      try { fn(status()); } catch (e) { console.warn('Auth listener failed:', e.message); }
    });
    updatePanelStatus();
  }
  function onChange(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  function api(path, opts) {
    if (!nativeFetch) return Promise.reject(new Error('هذا المتصفح لا يدعم fetch.'));
    opts = opts || {};
    var headers = Object.assign({}, publicHeaders);
    var token = opts.token || '';
    if (token) headers.Authorization = 'Bearer ' + token;
    var init = { method: opts.method || 'GET', headers: headers };
    if (opts.body) init.body = JSON.stringify(opts.body);
    if (opts.signal) init.signal = opts.signal;
    return nativeFetch(authBase + path, init).then(function (r) {
      return r.text().then(function (text) {
        var data = safeJson(text, {});
        if (!r.ok) {
          var msg = data.msg || data.message || data.error_description || data.error || ('HTTP ' + r.status);
          var err = new Error(String(msg));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  function computeAal() {
    var payload = jwtPayload(state.session && state.session.access_token) || {};
    state.aal = payload.aal || 'aal1';
    var verified = state.factors.filter(function (f) { return f.status === 'verified'; });
    state.nextLevel = verified.length ? 'aal2' : 'aal1';
    state.requiresTotp = state.nextLevel === 'aal2' && state.aal !== 'aal2';
  }
  function loadUser() {
    if (!state.session || !state.session.access_token) return Promise.resolve(null);
    return api('/user', { token: state.session.access_token }).then(function (user) {
      state.user = user || null;
      state.factors = Array.isArray(user && user.factors) ? user.factors : [];
      state.error = null;
      computeAal();
      emit();
      return user;
    }).catch(function (e) {
      if (e.status === 401 || e.status === 403) {
        clearSession();
        state.error = 'انتهت جلسة الحساب — سجّل الدخول مجدداً.';
      } else {
        state.error = e.message;
      }
      emit();
      return null;
    });
  }
  function adoptSession(session, skipUser) {
    if (!session || !session.access_token) return Promise.reject(new Error('لم يُرجع Supabase جلسة صالحة.'));
    var now = Math.floor(Date.now() / 1000);
    var expiresAt = Number(session.expires_at) || (now + (Number(session.expires_in) || 3600));
    var normalized = {
      access_token: session.access_token,
      refresh_token: session.refresh_token || (state.session && state.session.refresh_token) || '',
      token_type: session.token_type || 'bearer',
      expires_in: Number(session.expires_in) || Math.max(0, expiresAt - now),
      expires_at: expiresAt
    };
    state.session = normalized;
    state.error = null;
    storeSession(normalized);
    if (skipUser) { computeAal(); emit(); return Promise.resolve(normalized); }
    return loadUser().then(function () { return normalized; });
  }
  function clearSession() {
    state.session = null;
    state.user = null;
    state.factors = [];
    state.enroll = null;
    state.aal = 'aal1';
    state.nextLevel = 'aal1';
    state.requiresTotp = false;
    storeSession(null);
  }
  function ensureToken() {
    if (!enabled) return Promise.reject(new Error('تسجيل الدخول غير مفعّل في هذا النشر.'));
    if (!state.session) return Promise.reject(new Error('سجّل الدخول من زر «الحساب» أولاً.'));
    var until = Number(state.session.expires_at) * 1000 - Date.now();
    if (until > 60000 && state.session.access_token) return Promise.resolve(state.session.access_token);
    if (!state.session.refresh_token) return Promise.resolve(state.session.access_token);
    return api('/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: state.session.refresh_token }
    }).then(function (s) {
      return adoptSession(s, true).then(function () { return state.session.access_token; });
    });
  }

  function cleanupUrl() {
    try {
      var u = new URL(location.href);
      ['code', 'error', 'error_code', 'error_description', 'flow_id'].forEach(function (k) { u.searchParams.delete(k); });
      u.hash = '';
      history.replaceState(history.state, '', u.toString());
    } catch (e) { /* ignore */ }
  }

  function handleCallback() {
    var u = new URL(location.href);
    var code = u.searchParams.get('code');
    var hashParams = new URLSearchParams(u.hash.replace(/^#/, ''));
    var implicitToken = hashParams.get('access_token');
    if (!code && !implicitToken && !u.searchParams.get('error_description')) return false;

    if (u.searchParams.get('error') || u.searchParams.get('error_description')) {
      state.error = u.searchParams.get('error_description') || u.searchParams.get('error') || 'فشل تسجيل الدخول.';
      cleanupUrl();
      state.loading = false;
      emit();
      return true;
    }
    if (code) {
      var verifier = localStorage.getItem(pkceKey) || '';
      cleanupUrl();
      if (!verifier) {
        state.error = 'انتهت جلسة الدخول المؤقتة — حاول تسجيل الدخول مرة أخرى.';
        state.loading = false;
        emit();
        return true;
      }
      localStorage.removeItem(pkceKey);
      state.loading = true;
      return api('/token?grant_type=pkce', {
        method: 'POST',
        body: { auth_code: code, code_verifier: verifier }
      }).then(function (s) { return adoptSession(s); })
        .catch(function (e) { state.error = e.message; emit(); return null; })
        .then(function () { state.loading = false; emit(); return true; });
    }
    if (implicitToken) {
      var sess = {
        access_token: implicitToken,
        refresh_token: hashParams.get('refresh_token') || '',
        expires_in: Number(hashParams.get('expires_in')) || 3600,
        expires_at: Number(hashParams.get('expires_at')) || (Math.floor(Date.now() / 1000) + 3600),
        token_type: hashParams.get('token_type') || 'bearer'
      };
      cleanupUrl();
      state.loading = true;
      return adoptSession(sess).catch(function (e) { state.error = e.message; })
        .then(function () { state.loading = false; emit(); return true; });
    }
    return false;
  }

  function restore() {
    var saved = readStored();
    if (!saved || !saved.access_token) return Promise.resolve(false);
    state.session = saved;
    state.loading = true;
    var until = Number(saved.expires_at) * 1000 - Date.now();
    if (until <= 60000 && saved.refresh_token) {
      return api('/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: saved.refresh_token } })
        .then(function (s) { return adoptSession(s, true); })
        .catch(function () { clearSession(); state.error = 'تعذّر تجديد جلسة الحساب.'; return null; })
        .then(function () { return loadUser(); })
        .then(function () { state.loading = false; emit(); return true; });
    }
    if (until <= 0) { clearSession(); state.loading = false; emit(); return Promise.resolve(false); }
    return loadUser().then(function () { state.loading = false; emit(); return true; });
  }

  /* ── public actions ─────────────────────────────────────────────────────── */
  function signInWithGoogle() {
    if (!enabled) return Promise.reject(new Error('تسجيل الدخول غير مفعّل في هذا النشر.'));
    var verifier = randomVerifier();
    localStorage.setItem(pkceKey, verifier);
    return challengeOf(verifier).then(function (challenge) {
      var params = new URLSearchParams({
        provider: 'google',
        redirect_to: redirectTo(),
        code_challenge: challenge,
        code_challenge_method: 's256'
      });
      location.assign(authBase + '/authorize?' + params.toString());
      return { redirecting: true };
    });
  }
  function sendMagicLink(email) {
    if (!enabled) return Promise.reject(new Error('تسجيل الدخول غير مفعّل في هذا النشر.'));
    var address = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return Promise.reject(new Error('أدخل بريداً إلكترونياً صالحاً.'));
    var verifier = randomVerifier();
    localStorage.setItem(pkceKey, verifier);
    return challengeOf(verifier).then(function (challenge) {
      var url = '/otp?' + new URLSearchParams({ redirect_to: redirectTo() }).toString();
      return api(url, {
        method: 'POST',
        body: {
          email: address,
          create_user: true,
          code_challenge: challenge,
          code_challenge_method: 's256'
        }
      });
    }).then(function () {
      return { sent: true, message: 'أُرسل رابط الدخول إلى بريدك. افتحه على هذا الجهاز لإكمال الدخول.' };
    });
  }
  function signInWithPassword(email, password) {
    return api('/token?grant_type=password', {
      method: 'POST',
      body: { email: String(email || '').trim(), password: String(password || '') }
    }).then(function (s) { return adoptSession(s); });
  }
  function signUpWithPassword(email, password) {
    return api('/signup', {
      method: 'POST',
      body: { email: String(email || '').trim(), password: String(password || '') }
    }).then(function (data) {
      if (data && data.session) return adoptSession(data.session);
      return { needsConfirmation: true, message: 'أنشأنا الحساب — أكّد بريدك ثم سجّل الدخول بكلمة المرور.' };
    });
  }
  function signOut() {
    var token = state.session && state.session.access_token;
    clearSession();
    emit();
    if (!token) return Promise.resolve({ ok: true });
    return api('/logout?scope=local', { method: 'POST', token: token })
      .catch(function () { return { ok: true }; });
  }

  /* ── optional TOTP (Supabase MFA) ───────────────────────────────────────── */
  function enrollTotp() {
    return ensureToken().then(function (token) {
      return api('/factors', {
        method: 'POST',
        token: token,
        body: { factor_type: 'totp', friendly_name: 'MDM1 Office', issuer: 'MDM1 Office' }
      });
    }).then(function (factor) {
      state.enroll = factor;
      state.factors = [factor].concat(state.factors.filter(function (f) { return f.id !== factor.id; }));
      emit();
      return {
        id: factor.id,
        secret: factor.totp && factor.totp.secret,
        uri: factor.totp && factor.totp.uri,
        qrCode: factor.totp && factor.totp.qr_code
      };
    });
  }
  function verifyTotp(code, factorId) {
    var codeText = String(code || '').replace(/\D/g, '').slice(0, 6);
    if (codeText.length !== 6) return Promise.reject(new Error('أدخل رمزاً مكوّناً من 6 أرقام.'));
    var target = factorId || (state.enroll && state.enroll.id) ||
      (state.factors.filter(function (f) { return f.status === 'verified'; })[0] || {}).id ||
      (state.factors[0] || {}).id;
    if (!target) return Promise.reject(new Error('لا يوجد عامل مصادقة — فعّل TOTP أولاً.'));
    return ensureToken().then(function (token) {
      return api('/factors/' + encodeURIComponent(target) + '/challenge', { method: 'POST', token: token, body: {} });
    }).then(function (challenge) {
      return ensureToken().then(function (token) {
        return api('/factors/' + encodeURIComponent(target) + '/verify', {
          method: 'POST',
          token: token,
          body: { challenge_id: challenge.id, code: codeText }
        });
      });
    }).then(function (session) {
      state.enroll = null;
      return adoptSession(session);
    }).then(function () {
      return { ok: true, message: 'تم تفعيل/التحقق من المصادقة الثنائية.' };
    });
  }

  function status() {
    return {
      configured: enabled,
      loading: Boolean(state.loading),
      signedIn: Boolean(state.session && state.session.access_token),
      email: (state.user && state.user.email) || '',
      provider: ((state.user && state.user.app_metadata && state.user.app_metadata.provider) || 'email'),
      aal: state.aal,
      nextLevel: state.nextLevel,
      requiresTotp: Boolean(state.requiresTotp),
      factors: state.factors.length,
      verifiedFactors: state.factors.filter(function (f) { return f.status === 'verified'; }).length,
      messagingReady: enabled ? (Boolean(state.session && state.session.access_token) && !state.requiresTotp) : true,
      error: state.error || ''
    };
  }

  /* ── auth panel ─────────────────────────────────────────────────────────── */
  function injectPanelStyles() {
    if (document.getElementById('mdm1AuthStyles')) return;
    var css = document.createElement('style');
    css.id = 'mdm1AuthStyles';
    css.textContent = [
      '.office-modal-card.auth-card{max-width:540px;}',
      '.office-modal-card textarea{width:100%;box-sizing:border-box;background:#0b0b0e;border:1px solid #2a2a33;border-radius:9px;padding:9px 11px;color:#eef2ff;font-family:inherit;font-size:13px;}',
      '.auth-note{font-size:11.5px;color:#9aa3b2;line-height:1.8;border-right:2px solid rgba(201,168,76,.55);padding-right:10px;margin:12px 0;}',
      '.auth-qr{display:flex;justify-content:center;margin:10px 0;}',
      '.auth-qr img{width:168px;height:168px;background:#fff;border-radius:10px;padding:6px;box-sizing:border-box;}',
      '.auth-secret{direction:ltr;display:inline-block;font-family:ui-monospace,monospace;font-size:12px;color:#e8c96a;background:#0b0b0e;border:1px solid #2a2a33;border-radius:7px;padding:5px 8px;}',
      '.auth-provider{display:flex;align-items:center;justify-content:center;gap:8px;}'
    ].join('\n');
    document.head.appendChild(css);
  }
  function statusText() {
    var s = status();
    if (!s.configured) return '⚠️ تسجيل الدخول غير مهيّأ في هذا النشر.';
    if (s.loading) return '⏳ جارٍ استعادة جلسة الحساب...';
    if (s.error) return '⚠️ ' + s.error;
    if (!s.signedIn) return 'لا يوجد حساب مرتبط على هذا الجهاز.';
    if (s.requiresTotp) return '🔐 الحساب مرتبط (' + s.email + ') — مطلوب رمز المصادقة الثنائية لتفعيل الإرسال.';
    return '✅ الحساب مرتبط' + (s.email ? ' — ' + s.email : '') +
      (s.verifiedFactors ? ' · حماية ثنائية مفعّلة' : ' · حماية ثنائية غير مفعّلة');
  }
  function updatePanelStatus() {
    var el = document.getElementById('mdm1AuthStatus');
    if (!el) return;
    el.textContent = statusText();
    el.className = 'office-status' + (status().messagingReady && status().signedIn ? ' ok' : '');
  }
  function openPanel() {
    if (!enabled) {
      alert('تسجيل الدخول غير مهيّأ: أضف Supabase URL والمفتاح العام في office-config.js.');
      return;
    }
    injectPanelStyles();
    var existing = document.getElementById('mdm1AuthModal');
    if (existing) { existing.remove(); }
    var modal = document.createElement('div');
    modal.id = 'mdm1AuthModal';
    modal.className = 'office-modal';
    var s = status();
    var verified = s.verifiedFactors > 0;
    var enroll = state.enroll;
    var qr = enroll && enroll.totp && enroll.totp.qr_code;
    var secret = enroll && enroll.totp && enroll.totp.secret;
    modal.innerHTML =
      '<div class="office-modal-card auth-card">' +
      '<h2>👤 الحساب والهوية</h2>' +
      '<div class="auth-note">هذه طبقة هوية إضافية لتفعيل إرسال واتساب/تيليجرام والمزامنة. ' +
      'ما زالت كلمة سر المكتب مطلوبة لفتح الصفحة. الجلسة والرموز تبقى في هذا المتصفح فقط.</div>' +
      '<div id="mdm1AuthStatus" class="office-status"></div>' +
      '<label style="margin-top:14px;">الدخول بحساب Google</label>' +
      '<button class="office-btn primary auth-provider" id="mdm1AuthGoogle" type="button">🔵 متابعة عبر Google</button>' +
      '<label>أو بالبريد الإلكتروني</label>' +
      '<input id="mdm1AuthEmail" type="email" placeholder="name@example.com" autocomplete="email" />' +
      '<input id="mdm1AuthPass" type="password" placeholder="كلمة المرور (اختياري)" autocomplete="current-password" style="margin-top:7px;" />' +
      '<div class="office-actions">' +
      '<button class="office-btn" id="mdm1AuthMagic" type="button">✉️ إرسال رابط سحري</button>' +
      '<button class="office-btn" id="mdm1AuthLogin" type="button">🔑 دخول بكلمة المرور</button>' +
      '<button class="office-btn" id="mdm1AuthSignup" type="button">➕ إنشاء حساب</button>' +
      '</div>' +
      '<div id="mdm1AuthFormMsg" class="office-status quota">استخدم الرابط السحري إن لم يكن لديك حساب بكلمة مرور.</div>' +
      (s.signedIn ?
        '<label style="margin-top:16px;">🔐 المصادقة الثنائية (اختيارية — TOTP)</label>' +
        '<p>يمكنك تفعيل تطبيق مصادقة مثل Google Authenticator أو Authy. إن كان العامل مفعّلاً مسبقاً سيُطلب الرمز عند كل جلسة جديدة.</p>' +
        (qr ? '<div class="auth-qr"><img src="data:image/svg+xml;utf-8,' + encodeURIComponent(qr) + '" alt="QR" /></div>' +
          '<p>أو أدخل المفتاح يدوياً: <span class="auth-secret">' + esc(secret || '') + '</span></p>' : '') +
        '<input id="mdm1AuthCode" type="text" inputmode="numeric" maxlength="6" placeholder="رمز من 6 أرقام" />' +
        '<div class="office-actions">' +
        '<button class="office-btn" id="mdm1AuthEnroll" type="button">' + (verified ? '✅ ثنائي مفعّل' : 'تفعيل TOTP') + '</button>' +
        '<button class="office-btn" id="mdm1AuthVerify" type="button">تحقق من الرمز</button>' +
        '<button class="office-btn" id="mdm1AuthSignout" type="button">تسجيل الخروج</button>' +
        '</div>' : '') +
      '<div class="office-actions"><button class="office-btn primary" id="mdm1AuthClose" type="button">إغلاق</button></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('#mdm1AuthStatus').textContent = statusText();

    var q = function (id) { return modal.querySelector('#' + id); };
    function formMsg(text, cls) {
      var el = q('mdm1AuthFormMsg');
      if (!el) return;
      el.textContent = text;
      el.className = 'office-status quota ' + (cls || '');
    }
    function run(promise, doing) {
      formMsg(doing || 'جارٍ التنفيذ...', '');
      Promise.resolve(promise).then(function (r) {
        formMsg((r && r.message) || 'تمت العملية بنجاح.', 'ok');
        render();
      }).catch(function (e) { formMsg('❌ ' + e.message, 'err'); });
    }
    q('mdm1AuthGoogle').onclick = function () {
      run(signInWithGoogle(), 'جارٍ التحويل إلى Google...');
    };
    q('mdm1AuthMagic').onclick = function () {
      run(sendMagicLink(q('mdm1AuthEmail').value), 'جارٍ إرسال الرابط...');
    };
    q('mdm1AuthLogin').onclick = function () {
      run(signInWithPassword(q('mdm1AuthEmail').value, q('mdm1AuthPass').value), 'جارٍ الدخول...');
    };
    q('mdm1AuthSignup').onclick = function () {
      run(signUpWithPassword(q('mdm1AuthEmail').value, q('mdm1AuthPass').value), 'جارٍ إنشاء الحساب...');
    };
    if (q('mdm1AuthEnroll')) {
      q('mdm1AuthEnroll').onclick = function () {
        if (status().verifiedFactors) { formMsg('المصادقة الثنائية مفعّلة بالفعل.', ''); return; }
        run(enrollTotp(), 'جارٍ إنشاء سر المصادقة...');
      };
      q('mdm1AuthVerify').onclick = function () {
        run(verifyTotp(q('mdm1AuthCode').value), 'جارٍ التحقق من الرمز...');
      };
      q('mdm1AuthSignout').onclick = function () {
        run(signOut(), 'جارٍ تسجيل الخروج...');
      };
    }
    q('mdm1AuthClose').onclick = function () { modal.remove(); };
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
    function render() {
      var scroll = modal.querySelector('.office-modal-card').scrollTop;
      var code = q('mdm1AuthCode') ? q('mdm1AuthCode').value : '';
      var email = q('mdm1AuthEmail') ? q('mdm1AuthEmail').value : '';
      openPanel();
      var next = document.getElementById('mdm1AuthModal');
      if (!next) return;
      var card = next.querySelector('.office-modal-card');
      var nq = function (id) { return next.querySelector('#' + id); };
      if (nq('mdm1AuthCode')) nq('mdm1AuthCode').value = code;
      if (nq('mdm1AuthEmail')) nq('mdm1AuthEmail').value = email;
      card.scrollTop = scroll;
    }
  }

  function injectTopbarButton() {
    var actions = document.querySelector('.topbar-actions');
    if (!actions || document.getElementById('mdm1AuthBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'mdm1AuthBtn';
    btn.className = 'btn btn-secondary';
    btn.textContent = '👤 الحساب';
    btn.onclick = openPanel;
    actions.insertBefore(btn, actions.firstChild);
  }

  /* ── boot ───────────────────────────────────────────────────────────────── */
  var resolveReady;
  var readyPromise = new Promise(function (resolve) { resolveReady = resolve; });
  function init() {
    injectPanelStyles();
    injectTopbarButton();
    var handled;
    try { handled = handleCallback(); } catch (e) { handled = false; state.error = e.message; }
    Promise.resolve(handled).then(function (did) {
      if (did) return null;
      if (enabled) return restore();
      state.loading = false;
      emit();
      return null;
    }).catch(function (e) {
      state.error = e.message;
      state.loading = false;
      emit();
    }).then(function () {
      state.loading = false;
      emit();
      resolveReady();
    });
  }

  window.MDM1Auth = {
    ready: readyPromise,
    configured: function () { return enabled; },
    status: status,
    onChange: onChange,
    openPanel: openPanel,
    signInWithGoogle: signInWithGoogle,
    sendMagicLink: sendMagicLink,
    signInWithPassword: signInWithPassword,
    signUpWithPassword: signUpWithPassword,
    signOut: signOut,
    enrollTotp: enrollTotp,
    verifyTotp: verifyTotp,
    canSend: function () { return enabled ? Boolean(state.session && !state.requiresTotp) : true; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
