/* MDM1 - site-wide sign-in button.
   Injected into every page at deploy time by scripts/inject_menu_and_card.py, so old pages and any page generated in
   the future get it automatically.

   - A round floating button like the site's other floating buttons: drag it anywhere, the spot is remembered.
   - A standard sign-in dialog: Continue with Google / Microsoft / email (link + 6-digit code).
   - Everything lives in a Shadow DOM, so no page stylesheet can restyle or overlap it.
   - Self-contained: loads supabase-js and js/supabase-client.js on demand, never throws into the host page, and does
     nothing on pages that already ship their own account panel (hub.html). */
(function () {
  "use strict";
  if (window.__mdm1AuthButton) return;
  window.__mdm1AuthButton = true;
  try {
    if (document.querySelector("[data-account-open], #account-panel")) return;
  } catch (e) { return; }

  var ar = /^ar/i.test(document.documentElement.getAttribute("lang") || "ar");
  var T = ar ? {
    btn: "تسجيل الدخول", title: "تسجيل الدخول", sub: "ادخل إلى MDM1 لحفظ مفضلاتك ومشاركة أفكارك",
    google: "المتابعة باستخدام Google", microsoft: "المتابعة باستخدام Microsoft", apple: "المتابعة باستخدام Apple", or: "أو", mail: "المتابعة بالبريد الإلكتروني",
    email: "البريد الإلكتروني", next: "متابعة", back: "رجوع", close: "إغلاق",
    codeTitle: "أدخل الكود", codeSub: "أرسلنا رابطاً وكوداً من 6 أرقام إلى", code: "كود الدخول", verify: "تأكيد", resend: "إرسال كود جديد",
    asTitle: "أنت مسجّل الدخول", out: "تسجيل الخروج",
    terms: "بالمتابعة فأنت توافق على", termsLink: "الشروط", and: "و", privacyLink: "الخصوصية",
    badEmail: "أدخل بريداً إلكترونياً صحيحاً", badCode: "الكود غير صحيح أو منتهي، اطلب كوداً جديداً",
    wait: "انتظر دقيقة ثم حاول مجدداً", fail: "تعذر إكمال الطلب، حاول لاحقاً", off: "هذا المزوّد غير مفعّل بعد، استخدم البريد الإلكتروني",
    expired: "انتهى الرابط أو استُخدم من قبل؛ اطلب رابطاً جديداً أو أدخل الكود من الإيميل", done: "تم تسجيل الدخول", unavailable: "تعذر الاتصال بالخدمة، تحقق من الإنترنت وحاول مرة أخرى", loading: "جارٍ التحميل…", sent: "تم الإرسال"
  } : {
    btn: "Sign in", title: "Sign in", sub: "Sign in to MDM1 to save favorites and share ideas",
    google: "Continue with Google", microsoft: "Continue with Microsoft", apple: "Continue with Apple", or: "or", mail: "Continue with email",
    email: "Email address", next: "Continue", back: "Back", close: "Close",
    codeTitle: "Enter the code", codeSub: "We sent a link and a 6-digit code to", code: "Sign-in code", verify: "Verify", resend: "Send a new code",
    asTitle: "You are signed in", out: "Sign out",
    terms: "By continuing you agree to the", termsLink: "Terms", and: "and", privacyLink: "Privacy",
    badEmail: "Enter a valid email address", badCode: "The code is wrong or expired, request a new one",
    wait: "Please wait a minute and try again", fail: "Could not complete the request, try again later", off: "This provider is not enabled yet, use email",
    expired: "The link expired or was already used; request a new one or enter the code from the email", done: "Signed in", unavailable: "Could not reach the service, check your connection and try again", loading: "Loading…", sent: "Sent"
  };
  var dir = ar ? "rtl" : "ltr";

  var ICON = {
    user: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
    google: '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
    ms: '<svg viewBox="0 0 23 23" width="20" height="20" aria-hidden="true"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>',
    apple: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#000" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'
  };

  var css =
    ":host{all:initial}" +
    "*{box-sizing:border-box}" +
    ".fab{position:fixed;left:1.5rem;bottom:9rem;width:48px;height:48px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;" +
    "border:1px solid rgba(201,168,76,.55);background:radial-gradient(circle at 35% 30%,rgba(201,168,76,.35),rgba(0,0,0,.82) 70%);color:#e8c96a;cursor:grab;" +
    "backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 0 16px rgba(201,168,76,.25);touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}" +
    ".fab:hover{border-color:#e8c96a;box-shadow:0 0 22px rgba(201,168,76,.45)}" +
    ".fab.drag{cursor:grabbing;transform:scale(1.08)}" +
    ".fab.orb{transform:translate3d(var(--o-x,0px),var(--o-y,0px),0) perspective(260px) rotateX(var(--o-rx,0deg)) rotateY(var(--o-ry,0deg)) scale(var(--o-s,1))!important;" +
    "background:radial-gradient(circle at var(--o-hx,38%) var(--o-hy,28%),rgba(255,238,178,.42),rgba(255,238,178,0) 46%),radial-gradient(circle at 50% 62%,rgba(58,40,9,.96),rgba(8,5,0,.94) 78%)!important;" +
    "border:1px solid rgba(240,192,96,.8)!important;box-shadow:0 12px 22px rgba(0,0,0,.62),0 2px 0 rgba(255,228,150,.38) inset,0 -7px 11px rgba(0,0,0,.55) inset,0 0 20px rgba(201,168,76,.26)!important;will-change:transform}" +
    ".fab .dot{position:absolute;top:6px;right:6px;width:9px;height:9px;border-radius:50%;background:#4ade80;border:1px solid #0b0905;display:none}" +
    ".fab.in .dot{display:block}" +
    ".ov{position:fixed;inset:0;background:rgba(0,0,0,.74);display:none;overflow:auto;padding:1rem;-webkit-overflow-scrolling:touch}" +
    ".ov.open{display:flex}" +
    ".card{position:relative;margin:auto;width:100%;max-width:380px;background:#0b0905;color:#f3ead2;border:1px solid rgba(201,168,76,.4);border-radius:18px;padding:1.6rem 1.4rem 1.2rem;" +
    "font-family:Tajawal,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;direction:" + dir + ";text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)}" +
    ".x{position:absolute;top:.6rem;" + (ar ? "left" : "right") + ":.75rem;width:34px;height:34px;border:0;background:none;color:#e8c96a;font-size:26px;line-height:1;cursor:pointer;border-radius:50%}" +
    ".x:hover{background:rgba(201,168,76,.12)}" +
    "h2{margin:0 0 .35rem;font-size:1.35rem;font-weight:700;color:#e8c96a}" +
    ".sub{margin:0 0 1.2rem;opacity:.75;font-size:.9rem}" +
    ".view{display:none}.view.on{display:block}" +
    ".b{display:flex;align-items:center;justify-content:center;gap:.7rem;width:100%;min-height:48px;margin:.55rem 0;padding:.6rem 1rem;border-radius:999px;font:600 .98rem/1.2 inherit;font-family:inherit;cursor:pointer;border:1px solid #dadce0;background:#fff;color:#1f1f1f}" +
    ".b:hover{background:#f3f3f3}" +
    ".b svg{flex:none}" +
    ".or{display:flex;align-items:center;gap:.8rem;margin:.7rem 0 .3rem;opacity:.6;font-size:.85rem}.or:before,.or:after{content:\"\";flex:1;height:1px;background:rgba(201,168,76,.35)}" +
    ".b.mail{background:transparent;color:#f3ead2;border-color:rgba(201,168,76,.55)}" +
    ".b.mail:hover{background:rgba(201,168,76,.12)}" +
    ".b.go{background:linear-gradient(135deg,#c9a84c,#8a6d1f);color:#1a1405;border:0}" +
    ".b.go:hover{filter:brightness(1.08)}" +
    ".in-f{display:block;width:100%;min-height:48px;margin:.55rem 0;padding:.6rem 1rem;border-radius:12px;border:1px solid rgba(201,168,76,.35);background:rgba(201,168,76,.06);color:#f3ead2;font:400 16px/1.2 inherit;font-family:inherit;direction:ltr;text-align:" + (ar ? "right" : "left") + ";outline:none}" +
    ".in-f:focus{border-color:#e8c96a}" +
    ".in-f.code{text-align:center;letter-spacing:.35em;font-size:20px}" +
    ".lnk{background:none;border:0;color:#e8c96a;font:inherit;font-family:inherit;font-size:.88rem;cursor:pointer;padding:.5rem;text-decoration:underline}" +
    ".note{margin:.4rem 0 0;font-size:.88rem;opacity:.8;word-break:break-all}" +
    ".msg{min-height:1.3rem;margin-top:.5rem;font-size:.9rem}.msg.err{color:#ff8a8a}.msg.ok{color:#8fe3a0}" +
    ".legal{margin:.9rem 0 0;font-size:.78rem;opacity:.6}.legal a{color:#e8c96a}";

  var host, root, fab, ov, signedEmail = "", pendingEmail = "", lastDragEnd = 0;

  function q(sel) { return root.querySelector(sel); }
  function msg(text, kind) { var m = q(".msg"); if (m) { m.textContent = text || ""; m.className = "msg" + (kind ? " " + kind : ""); } }
  function sb() { var c = window.supabase; return c && c.auth && typeof c.auth.getSession === "function" ? c : null; }
  function view(name) {
    root.querySelectorAll(".view").forEach(function (v) { v.classList.toggle("on", v.getAttribute("data-v") === name); });
    msg("", "");
    var f = q('.view.on input'); if (f && ov.classList.contains("open")) { try { f.focus(); } catch (e) {} }
  }

  function build() {
    // Custom tag name: generic page rules such as `div{...}` cannot match it; inline !important beats page !important.
    host = document.createElement("mdm1-auth-host");
    host.id = "mdm1a-host";
    [["all", "initial"], ["position", "fixed"], ["top", "0"], ["left", "0"], ["width", "0"], ["height", "0"], ["z-index", "99990"], ["display", "block"]]
      .forEach(function (d) { host.style.setProperty(d[0], d[1], "important"); });
    root = host.attachShadow({ mode: "open" });
    root.innerHTML =
      "<style>" + css + "</style>" +
      '<button type="button" class="fab" part="fab" aria-haspopup="dialog" title="' + T.btn + '" aria-label="' + T.btn + '">' + ICON.user + '<span class="dot"></span></button>' +
      '<div class="ov" role="dialog" aria-modal="true" aria-label="' + T.title + '"><div class="card">' +
      '<button type="button" class="x" aria-label="' + T.close + '">&times;</button>' +
      '<div class="view on" data-v="choose"><h2>' + T.title + '</h2><p class="sub">' + T.sub + '</p>' +
      '<button type="button" class="b" data-p="google">' + ICON.google + "<span>" + T.google + "</span></button>" +
      '<button type="button" class="b" data-p="microsoft">' + ICON.ms + "<span>" + T.microsoft + "</span></button>" +
      '<button type="button" class="b" data-p="apple">' + ICON.apple + "<span>" + T.apple + "</span></button>" +
      '<div class="or"><span>' + T.or + "</span></div>" +
      '<button type="button" class="b mail" data-go="email">' + ICON.mail + "<span>" + T.mail + "</span></button>" +
      '<p class="legal">' + T.terms + ' <a href="/terms.html">' + T.termsLink + "</a> " + T.and + ' <a href="/privacy.html">' + T.privacyLink + "</a></p></div>" +
      '<div class="view" data-v="email"><h2>' + T.mail + '</h2><p class="sub"></p>' +
      '<form data-f="email" novalidate><input class="in-f" type="email" name="email" autocomplete="email" inputmode="email" placeholder="' + T.email + '" aria-label="' + T.email + '">' +
      '<button type="submit" class="b go"><span>' + T.next + '</span></button></form>' +
      '<button type="button" class="lnk" data-go="choose">' + T.back + "</button></div>" +
      '<div class="view" data-v="code"><h2>' + T.codeTitle + '</h2><p class="sub">' + T.codeSub + '</p><p class="note" data-who></p>' +
      '<form data-f="code" novalidate><input class="in-f code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••" aria-label="' + T.code + '">' +
      '<button type="submit" class="b go"><span>' + T.verify + '</span></button></form>' +
      '<button type="button" class="lnk" data-resend>' + T.resend + '</button> <button type="button" class="lnk" data-go="email">' + T.back + "</button></div>" +
      '<div class="view" data-v="signed"><h2>' + T.asTitle + '</h2><p class="sub" data-me></p>' +
      '<button type="button" class="b go" data-signout><span>' + T.out + "</span></button></div>" +
      '<div class="msg" role="status" aria-live="polite"></div></div></div>';
    document.body.appendChild(host);
    fab = q(".fab"); ov = q(".ov");

    fab.addEventListener("click", function () { if (Date.now() - lastDragEnd < 400) return; open(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    q(".x").addEventListener("click", close);
    root.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    root.querySelectorAll("[data-p]").forEach(function (b) { b.addEventListener("click", function () { provider(b.getAttribute("data-p")); }); });
    root.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { view(b.getAttribute("data-go")); }); });
    q('[data-f="email"]').addEventListener("submit", function (e) { e.preventDefault(); sendLink(); });
    q('[data-f="code"]').addEventListener("submit", function (e) { e.preventDefault(); verifyCode(); });
    q("[data-resend]").addEventListener("click", function () { sendLink(true); });
    q("[data-signout]").addEventListener("click", signOut);
    drag(fab);
    orb(fab);
  }

  // Same floating-orb effect as the site's other round buttons (js/mdm1-3d.js can't reach into this shadow root):
  // idle sway, tilt and highlight that follow the finger/cursor. Only while the page's 3D effects are on.
  function orb(el) {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var rd = document.documentElement, ph = Math.random() * 6.283, S = { x: 0, y: 0, rx: 0, ry: 0, s: 1, hx: 38, hy: 28 };
    var P = { x: -9999, y: -9999 }, down = false, t0 = performance.now(), last = t0, R = 120;
    function cl(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function lp(a, b, k) { return a + (b - a) * k; }
    addEventListener("pointermove", function (e) { P.x = e.clientX; P.y = e.clientY; }, { passive: true });
    addEventListener("pointerdown", function (e) { P.x = e.clientX; P.y = e.clientY; }, { passive: true });
    addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") P.x = P.y = -9999; down = false; }, { passive: true });
    el.addEventListener("pointerdown", function () { down = true; });
    el.addEventListener("pointercancel", function () { down = false; });
    function frame(now) {
      requestAnimationFrame(frame);
      var on = !rd.classList.contains("m3d-off") && !!document.getElementById("m3d-toggle");
      if (el.classList.contains("orb") !== on) el.classList.toggle("orb", on);
      if (!on) return;
      var t = (now - t0) / 1000, dt = Math.min(.1, (now - last) / 1000), k = 1 - Math.exp(-dt * 9);
      last = now;
      var r = el.getBoundingClientRect(), cx = r.left + r.width / 2 - S.x, cy = r.top + r.height / 2 - S.y;
      var dx = P.x - cx, dy = P.y - cy, d = Math.hypot(dx, dy);
      var tx = Math.sin(t * .7 + ph * 2) * 1.4, ty = Math.sin(t * 1.1 + ph) * 2.8, ry = Math.sin(t * .9 + ph) * 7, rx = Math.cos(t * .8 + ph) * 6, sc = 1, hx = 38, hy = 28;
      if (d < R) {
        var c = 1 - d / R;
        tx += cl(dx * .22 * c, -6, 6); ty += cl(dy * .22 * c, -6, 6);
        ry = cl(dx / (r.width / 2), -1.2, 1.2) * 22 * (.35 + c * .65); rx = -cl(dy / (r.height / 2), -1.2, 1.2) * 22 * (.35 + c * .65);
        sc = 1 + .1 * c; hx = cl(50 + dx / r.width * 70, 15, 85); hy = cl(50 + dy / r.height * 70, 12, 85);
      }
      if (down) sc = .88;
      S.x = lp(S.x, tx, k); S.y = lp(S.y, ty, k); S.rx = lp(S.rx, rx, k); S.ry = lp(S.ry, ry, k);
      S.s = lp(S.s, sc, down ? 1 - Math.exp(-dt * 22) : k); S.hx = lp(S.hx, hx, k); S.hy = lp(S.hy, hy, k);
      var st = el.style;
      st.setProperty("--o-x", S.x.toFixed(2) + "px"); st.setProperty("--o-y", S.y.toFixed(2) + "px");
      st.setProperty("--o-rx", S.rx.toFixed(2) + "deg"); st.setProperty("--o-ry", S.ry.toFixed(2) + "deg");
      st.setProperty("--o-s", S.s.toFixed(3)); st.setProperty("--o-hx", S.hx.toFixed(1) + "%"); st.setProperty("--o-hy", S.hy.toFixed(1) + "%");
    }
    requestAnimationFrame(frame);
  }

  function open() { ov.classList.add("open"); view(signedEmail ? "signed" : "choose"); var b = q(".view.on .b, .view.on input"); if (b) { try { b.focus(); } catch (e) {} } }
  function close() { ov.classList.remove("open"); try { fab.focus(); } catch (e) {} }

  function paint() {
    fab.classList.toggle("in", !!signedEmail);
    q("[data-me]").textContent = signedEmail || "";
    if (ov.classList.contains("open") && signedEmail) view("signed");
  }

  /* ---- drag: same behaviour as the site's other floating buttons ---- */
  function drag(el) {
    var KEY = "mdm1a-pos", MARGIN = 6, TH = 7, st = null;
    function fit(x, y) {
      var w = el.offsetWidth || 48, h = el.offsetHeight || 48;
      return [Math.min(Math.max(x, MARGIN), Math.max(MARGIN, innerWidth - w - MARGIN)), Math.min(Math.max(y, MARGIN), Math.max(MARGIN, innerHeight - h - MARGIN))];
    }
    function put(x, y) {
      var p = fit(x, y);
      el.style.left = p[0] + "px"; el.style.top = p[1] + "px"; el.style.right = "auto"; el.style.bottom = "auto";
    }
    function restore() {
      try {
        var s = JSON.parse(localStorage.getItem(KEY) || "null");
        if (s && typeof s.fx === "number" && typeof s.fy === "number") {
          var w = el.offsetWidth || 48, h = el.offsetHeight || 48;
          put(s.fx * innerWidth - w / 2, s.fy * innerHeight - h / 2);
        }
      } catch (e) { /* storage blocked: keep default spot */ }
    }
    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      var r = el.getBoundingClientRect();
      st = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: el.offsetLeft || r.left, oy: el.offsetTop || r.top, drag: false };
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    });
    el.addEventListener("pointermove", function (e) {
      if (!st || e.pointerId !== st.id) return;
      var dx = e.clientX - st.sx, dy = e.clientY - st.sy;
      if (!st.drag && Math.abs(dx) + Math.abs(dy) < TH) return;
      st.drag = true; el.classList.add("drag");
      put(st.ox + dx, st.oy + dy);
      e.preventDefault();
    });
    function end(e) {
      if (!st || e.pointerId !== st.id) return;
      var was = st.drag; st = null;
      el.classList.remove("drag");
      try { el.releasePointerCapture(e.pointerId); } catch (x) {}
      if (!was) return;
      lastDragEnd = Date.now();
      try {
        var r = el.getBoundingClientRect();
        localStorage.setItem(KEY, JSON.stringify({ fx: (r.left + r.width / 2) / innerWidth, fy: (r.top + r.height / 2) / innerHeight }));
      } catch (x) {}
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    addEventListener("resize", restore);
    restore();
  }

  /* ---- backend ---- */
  var CDNS = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"
  ];
  function loadScript(src) {
    return new Promise(function (res) {
      var s = document.createElement("script"); s.src = src; s.async = false;
      s.onload = function () { res(true); }; s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
  }
  function libReady() { var l = window.supabase; return !!l && (typeof l.createClient === "function" || (l.auth && typeof l.auth.getSession === "function")); }
  function loadLib() {
    if (libReady()) return Promise.resolve(true);
    var i = 0;
    function next() {
      if (i >= CDNS.length) return Promise.resolve(false);
      return loadScript(CDNS[i++]).then(function () { return libReady() ? true : next(); });
    }
    return next();
  }
  // One shared load. Clicks that arrive before it finishes simply wait for it; a failed load can be retried.
  var backendP = null;
  function ensureBackend() {
    if (backendP) return backendP;
    backendP = loadLib().then(function (ok) {
      if (!ok) return false;
      if (!sb() || typeof window.signInWithProvider !== "function") return loadScript("/js/supabase-client.js");
      return true;
    }).then(function () { return !!sb() && typeof window.signInWithProvider === "function"; })
      .catch(function () { return false; });
    backendP.then(function (ok) { if (!ok) backendP = null; });
    return backendP;
  }
  function withBackend(fn) {
    msg(T.loading, "");
    ensureBackend().then(function (ok) {
      if (!ok) { msg(T.unavailable, "err"); return; }
      msg("", ""); fn();
    });
  }
  function refresh() {
    var c = sb(); if (!c) return;
    c.auth.getSession().then(function (r) {
      var u = r && r.data && r.data.session && r.data.session.user;
      signedEmail = u ? (u.email || (u.user_metadata && u.user_metadata.name) || "✓") : "";
      paint();
    }).catch(function () {});
  }

  function provider(name) { withBackend(function () { doProvider(name); }); }
  function doProvider(name) {
    window.signInWithProvider(name).then(function (r) {
      if (r && r.error) msg(/not enabled|unsupported provider/i.test(r.error.message || "") ? T.off : T.fail, "err");
    }).catch(function () { msg(T.fail, "err"); });
  }

  function sendLink(again) {
    var email = again ? pendingEmail : String(q('[data-f="email"] input').value || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg(T.badEmail, "err"); return; }
    withBackend(function () { doSend(email); });
  }
  function doSend(email) {
    window.sendMagicLink(email, {}).then(function (r) {
      if (!r || !r.error) {
        pendingEmail = email; q("[data-who]").textContent = email; view("code"); msg(T.sent, "ok");
        return;
      }
      var m = String(r.error.message || "") + String(r.error.code || "");
      msg(r.error.code === "cooldown" ? r.error.message : (/after \d+ seconds|rate limit|429/i.test(m) ? T.wait : T.fail), "err");
    }).catch(function () { msg(T.fail, "err"); });
  }

  function verifyCode() {
    var code = String(q('[data-f="code"] input').value || "").replace(/\s+/g, "");
    if (!/^\d{6,8}$/.test(code)) { msg(T.badCode, "err"); return; }
    withBackend(function () { doVerify(code); });
  }
  function doVerify(code) {
    window.verifyEmailCode(pendingEmail, code).then(function (r) {
      if (r && r.error) { msg(T.badCode, "err"); return; }
      msg(T.done, "ok"); refresh(); setTimeout(close, 700);
    }).catch(function () { msg(T.fail, "err"); });
  }

  function signOut() {
    var c = sb(); if (!c) return;
    c.auth.signOut().then(function () { signedEmail = ""; paint(); close(); }).catch(function () {});
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
          open(); view("choose");
          msg(/expired|invalid/i.test(String(window.mdm1AuthError.message || "")) ? T.expired : T.fail, "err");
        }
      });
    } catch (e) { /* never break the host page */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
