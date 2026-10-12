/* MDM1 — language button for the whole site (loaded on every page that has no selector of its own).
   Uses the browser-side translation widget only after a language is chosen; Arabic (the source) loads nothing extra. */
(function () {
  "use strict";
  if (document.getElementById("lang-select") || document.getElementById("mdm1-lang-btn")) return;
  var LANGS = [["ar", "العربية"], ["en", "English"], ["es", "Español"], ["pt", "Português"], ["id", "Bahasa Indonesia"],
    ["tr", "Türkçe"], ["fr", "Français"], ["de", "Deutsch"], ["hi", "हिन्दी"], ["ru", "Русский"], ["zh-CN", "中文"],
    ["ja", "日本語"], ["ko", "한국어"], ["it", "Italiano"], ["fa", "فارسی"], ["ur", "اردو"], ["bn", "বাংলা"], ["vi", "Tiếng Việt"]];
  var KEY = "mdm1_lang";
  function get() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function set(v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} }
  function cookie(v) {
    var host = location.hostname, val = v ? "/ar/" + v : "";
    var exp = v ? "" : ";expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "googtrans=" + val + ";path=/" + exp;
    document.cookie = "googtrans=" + val + ";path=/;domain=" + host + exp;
  }
  function load() {
    if (window.__mdm1Translate) return; window.__mdm1Translate = true;
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({ pageLanguage: "ar", autoDisplay: false }, "mdm1-gt");
    };
    var s = document.createElement("script");
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.head.appendChild(s);
  }
  var css = document.createElement("style");
  css.textContent = "#mdm1-lang-btn{position:fixed;bottom:1.5rem;left:1.5rem;z-index:998;width:48px;height:48px;border-radius:50%;border:1px solid rgba(201,168,76,.5);background:rgba(0,0,0,.75);color:#c9a84c;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
    "#mdm1-lang-panel{position:fixed;bottom:5.5rem;left:1.5rem;z-index:998;width:min(70vw,220px);max-height:60vh;overflow:auto;background:rgba(5,4,3,.96);border:1px solid rgba(201,168,76,.35);border-radius:12px;padding:.5rem;display:none}" +
    "#mdm1-lang-panel.open{display:block}#mdm1-lang-panel button{display:block;width:100%;text-align:start;background:none;border:0;color:#e8d5a3;padding:.5rem .6rem;border-radius:6px;cursor:pointer;font:inherit;font-size:.9rem}" +
    "#mdm1-lang-panel button:hover{background:rgba(201,168,76,.12)}" +
    ".goog-te-banner-frame,.skiptranslate>iframe{display:none!important}body{top:0!important}#mdm1-gt{display:none}";
  document.head.appendChild(css);
  var gt = document.createElement("div"); gt.id = "mdm1-gt"; document.body.appendChild(gt);
  var btn = document.createElement("button"); btn.id = "mdm1-lang-btn"; btn.type = "button";
  btn.setAttribute("aria-label", "Language / اللغة"); btn.textContent = "🌐"; btn.translate = false;
  var panel = document.createElement("div"); panel.id = "mdm1-lang-panel"; panel.setAttribute("translate", "no");
  LANGS.forEach(function (l) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = l[1];
    b.onclick = function () { var v = l[0] === "ar" ? "" : l[0]; set(v); cookie(v); location.reload(); };
    panel.appendChild(b);
  });
  btn.onclick = function (e) { e.stopPropagation(); panel.classList.toggle("open"); };
  document.addEventListener("click", function (e) { if (!panel.contains(e.target)) panel.classList.remove("open"); });
  document.body.appendChild(btn); document.body.appendChild(panel);
  var cur = get();
  if (!cur) {                                   // first visit: follow the device language once (never forced afterwards)
    try {
      if (!localStorage.getItem(KEY + "_seen")) {
        localStorage.setItem(KEY + "_seen", "1");
        var d = (navigator.language || "ar").toLowerCase().split("-")[0];
        var hit = LANGS.filter(function (l) { return l[0].toLowerCase().split("-")[0] === d; })[0];
        if (hit && hit[0] !== "ar") { set(hit[0]); cookie(hit[0]); location.reload(); return; }
      }
    } catch (e) {}
  }
  if (cur) { cookie(cur); load(); }
})();
