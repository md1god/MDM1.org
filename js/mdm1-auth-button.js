/* MDM1 - site-wide sign-in button.
   Injected into every page at deploy time by scripts/inject_menu_and_card.py, so old pages and any page generated in
   the future get it automatically. Self-contained: loads supabase-js and js/supabase-client.js on demand, never throws
   into the host page, and does nothing on pages that already ship their own account panel (hub.html). */
(function () {
  "use strict";
  if (window.__mdm1AuthButton) return;
  window.__mdm1AuthButton = true;
  try {
    if (document.querySelector("[data-account-open], #account-panel")) return;   // page has its own account UI
  } catch (e) { return; }

  var ar = /^ar/i.test(document.documentElement.getAttribute("lang") || "ar");
  var T = ar ? {
    btn: "تسجيل الدخول", btnIn: "حسابي", title: "تسجيل الدخول إلى MDM1", close: "إغلاق",
    google: "الدخول بحساب Google", microsoft: "الدخول بحساب Microsoft", or: "أو بالبريد الإلكتروني",
    email: "بريدك الإلكتروني", send: "إرسال رابط وكود الدخول", code: "كود الدخول (6 أرقام)", verify: "تأكيد الكود",
    out: "تسجيل الخروج", as: "مسجّل الدخول باسم", sent: "أرسلنا الرابط والكود إلى بريدك",
    badEmail: "أدخل بريداً إلكترونياً صحيحاً", badCode: "الكود غير صحيح أو منتهي، اطلب كوداً جديداً",
    wait: "انتظر دقيقة ثم حاول مجدداً", fail: "تعذر إكمال الطلب، حاول لاحقاً", off: "هذا المزوّد غير مفعّل بعد، استخدم البريد الإلكتروني",
    expired: "انتهى الرابط أو استُخدم من قبل؛ اطلب رابطاً جديداً أو أدخل الكود من الإيميل", done: "تم تسجيل الدخول", unavailable: "الخدمة غير متاحة الآن"
  } : {
    btn: "Sign in", btnIn: "My account", title: "Sign in to MDM1", close: "Close",
    google: "Continue with Google", microsoft: "Continue with Microsoft", or: "or use your email",
    email: "Your email", send: "Send sign-in link and code", code: "Sign-in code (6 digits)", verify: "Verify code",
    out: "Sign out", as: "Signed in as", sent: "We sent a link and a code to your email",
    badEmail: "Enter a valid email address", badCode: "The code is wrong or expired, request a new one",
    wait: "Please wait a minute and try again", fail: "Could not complete the request, try again later", off: "This provider is not enabled yet, use email",
    expired: "The link expired or was already used; request a new one or enter the code from the email", done: "Signed in", unavailable: "Service unavailable right now"
  };

  var dir = ar ? "rtl" : "ltr";
  var css = "#mdm1a-btn{position:fixed;left:1.5rem;bottom:8.5rem;z-index:999;padding:.55rem 1rem;border-radius:999px;border:1px solid rgba(201,168,76,.55);background:rgba(0,0,0,.78);backdrop-filter:blur(8px);color:#e8c96a;font:600 .85rem/1 Tajawal,system-ui,sans-serif;cursor:pointer;box-shadow:0 0 14px rgba(201,168,76,.18)}" +
    "#mdm1a-btn:hover{border-color:#e8c96a}" +
    "#mdm1a-ov{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center;padding:1rem}" +
    "#mdm1a-ov.open{display:flex}" +
    "#mdm1a-card{width:100%;max-width:380px;max-height:92vh;overflow:auto;background:#0b0905;color:#f3ead2;border:1px solid rgba(201,168,76,.45);border-radius:16px;padding:1.25rem;font:400 .95rem/1.5 Tajawal,system-ui,sans-serif;direction:" + dir + ";position:relative}" +
    "#mdm1a-card h2{margin:0 0 .9rem;font-size:1.1rem;color:#e8c96a}" +
    "#mdm1a-card button.p,#mdm1a-card button.s{width:100%;padding:.7rem;margin:.3rem 0;border-radius:10px;border:1px solid rgba(201,168,76,.5);background:rgba(201,168,76,.12);color:#f3ead2;font:600 .95rem Tajawal,system-ui,sans-serif;cursor:pointer}" +
    "#mdm1a-card button.s{background:linear-gradient(135deg,#c9a84c,#8a6d1f);color:#1a1405;border:0}" +
    "#mdm1a-card input{width:100%;box-sizing:border-box;padding:.7rem;margin:.3rem 0;border-radius:10px;border:1px solid rgba(201,168,76,.3);background:rgba(201,168,76,.05);color:#f3ead2;font:400 1rem Tajawal,system-ui,sans-serif;direction:ltr;text-align:" + (ar ? "right" : "left") + "}" +
    "#mdm1a-card .x{position:absolute;top:.5rem;" + (ar ? "left" : "right") + ":.7rem;background:none;border:0;color:#e8c96a;font-size:1.5rem;cursor:pointer}" +
    "#mdm1a-card .sep{text-align:center;opacity:.6;margin:.7rem 0 .3rem;font-size:.85rem}" +
    "#mdm1a-msg{min-height:1.4rem;margin-top:.5rem;font-size:.9rem;text-align:center}" +
    "#mdm1a-msg.err{color:#ff7a7a}#mdm1a-msg.ok{color:#8fe3a0}";

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function $(id) { return document.getElementById(id); }
  function msg(text, kind) { var m = $("mdm1a-msg"); if (m) { m.textContent = text || ""; m.className = kind || ""; } }
  function sb() { var c = window.supabase; return c && c.auth && typeof c.auth.getSession === "function" ? c : null; }

  var btn, ov, signedEmail = "";

  function build() {
    var style = el("style", null, css); document.head.appendChild(style);
    btn = el("button", { id: "mdm1a-btn", type: "button", "aria-haspopup": "dialog" }, T.btn);
    ov = el("div", { id: "mdm1a-ov", role: "dialog", "aria-modal": "true", "aria-label": T.title });
    ov.innerHTML =
      '<div id="mdm1a-card"><button type="button" class="x" aria-label="' + T.close + '">&times;</button>' +
      "<h2>" + T.title + "</h2>" +
      '<div id="mdm1a-out">' +
      '<button type="button" class="p" data-p="google">' + T.google + "</button>" +
      '<button type="button" class="p" data-p="microsoft">' + T.microsoft + "</button>" +
      '<div class="sep">' + T.or + "</div>" +
      '<input id="mdm1a-email" type="email" autocomplete="email" placeholder="' + T.email + '">' +
      '<button type="button" class="s" id="mdm1a-send">' + T.send + "</button>" +
      '<div id="mdm1a-code-row" style="display:none">' +
      '<input id="mdm1a-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="' + T.code + '">' +
      '<button type="button" class="s" id="mdm1a-verify">' + T.verify + "</button></div></div>" +
      '<div id="mdm1a-in" style="display:none"><p id="mdm1a-who"></p><button type="button" class="s" id="mdm1a-signout">' + T.out + "</button></div>" +
      '<div id="mdm1a-msg" role="status"></div></div>';
    document.body.appendChild(btn);
    document.body.appendChild(ov);
    btn.addEventListener("click", open);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector(".x").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    ov.querySelectorAll("[data-p]").forEach(function (b) { b.addEventListener("click", function () { provider(b.getAttribute("data-p")); }); });
    $("mdm1a-send").addEventListener("click", sendLink);
    $("mdm1a-verify").addEventListener("click", verifyCode);
    $("mdm1a-signout").addEventListener("click", signOut);
  }

  function open() { ov.classList.add("open"); var i = $("mdm1a-email"); if (i && !signedEmail) i.focus(); }
  function close() { ov.classList.remove("open"); }

  function paint() {
    $("mdm1a-out").style.display = signedEmail ? "none" : "";
    $("mdm1a-in").style.display = signedEmail ? "" : "none";
    $("mdm1a-who").textContent = signedEmail ? T.as + " " + signedEmail : "";
    btn.textContent = signedEmail ? T.btnIn : T.btn;
  }

  function loadScript(src) {
    return new Promise(function (res) {
      var s = document.createElement("script"); s.src = src; s.async = false;
      s.onload = function () { res(true); }; s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
  }

  // supabase-js (CDN) then the shared client, only when the page has not already loaded them.
  function ensureBackend() {
    var p = Promise.resolve();
    if (!sb() && !(window.supabase && typeof window.supabase.createClient === "function")) p = p.then(function () { return loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"); });
    p = p.then(function () { if (!sb() || typeof window.signInWithProvider !== "function") return loadScript("/js/supabase-client.js"); });
    return p.then(function () { return !!sb() && typeof window.signInWithProvider === "function"; });
  }

  function refresh() {
    var c = sb(); if (!c) return;
    c.auth.getSession().then(function (r) {
      var u = r && r.data && r.data.session && r.data.session.user;
      signedEmail = u ? (u.email || u.user_metadata && u.user_metadata.name || "✓") : "";
      paint();
    }).catch(function () {});
  }

  function provider(name) {
    if (typeof window.signInWithProvider !== "function") { msg(T.unavailable, "err"); return; }
    window.signInWithProvider(name).then(function (r) {
      if (r && r.error) msg(/not enabled|unsupported provider/i.test(r.error.message || "") ? T.off : T.fail, "err");
    }).catch(function () { msg(T.fail, "err"); });
  }

  function sendLink() {
    var email = String($("mdm1a-email").value || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg(T.badEmail, "err"); return; }
    if (typeof window.sendMagicLink !== "function") { msg(T.unavailable, "err"); return; }
    msg("…", "");
    window.sendMagicLink(email, {}).then(function (r) {
      if (!r || !r.error) { msg(T.sent, "ok"); $("mdm1a-code-row").style.display = ""; $("mdm1a-code").focus(); return; }
      var m = String(r.error.message || "") + String(r.error.code || "");
      msg(r.error.code === "cooldown" ? r.error.message : (/after \d+ seconds|rate limit|429/i.test(m) ? T.wait : T.fail), "err");
    }).catch(function () { msg(T.fail, "err"); });
  }

  function verifyCode() {
    var email = String($("mdm1a-email").value || "").trim().toLowerCase();
    var code = String($("mdm1a-code").value || "").replace(/\s+/g, "");
    if (!/^\d{6,8}$/.test(code)) { msg(T.badCode, "err"); return; }
    window.verifyEmailCode(email, code).then(function (r) {
      if (r && r.error) { msg(T.badCode, "err"); return; }
      msg(T.done, "ok"); refresh(); setTimeout(close, 700);
    }).catch(function () { msg(T.fail, "err"); });
  }

  function signOut() {
    var c = sb(); if (!c) return;
    c.auth.signOut().then(function () { signedEmail = ""; paint(); msg("", ""); close(); }).catch(function () {});
  }

  function start() {
    try {
      if (!document.body) return;
      build(); paint();
      ensureBackend().then(function (ok) {
        if (!ok) return;
        refresh();
        try { sb().auth.onAuthStateChange(function () { refresh(); }); } catch (e) {}
        if (window.mdm1AuthError) {
          open();
          msg(/expired|invalid/i.test(String(window.mdm1AuthError.message || "")) ? T.expired : T.fail, "err");
        }
      });
    } catch (e) { /* never break the host page */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
