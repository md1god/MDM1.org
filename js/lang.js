/* MDM1 - world-language picker for every page.
   - Pages without their own selector get a floating globe button with a searchable list of ~110 languages.
   - Pages that ship their own translated copy (a #lang-select) keep it, and get every other language added
     to the same select (machine translation via the browser-side widget, loaded only after a choice).
   The page's source language ("ar") loads nothing extra. */
(function () {
  "use strict";
  if (document.getElementById("mdm1-lang-btn")) return;

  // [widget code, native name, English name] - most used first, then A-Z by English name
  var LANGS = [
    ["en", "English", "English"], ["iw", "עברית", "Hebrew"], ["ar", "العربية", "Arabic"], ["es", "Español", "Spanish"],
    ["fr", "Français", "French"], ["de", "Deutsch", "German"], ["pt", "Português", "Portuguese"], ["ru", "Русский", "Russian"],
    ["zh-CN", "简体中文", "Chinese (Simplified)"], ["zh-TW", "繁體中文", "Chinese (Traditional)"], ["hi", "हिन्दी", "Hindi"],
    ["tr", "Türkçe", "Turkish"], ["ja", "日本語", "Japanese"], ["ko", "한국어", "Korean"], ["it", "Italiano", "Italian"],
    ["id", "Bahasa Indonesia", "Indonesian"], ["nl", "Nederlands", "Dutch"], ["pl", "Polski", "Polish"],
    ["uk", "Українська", "Ukrainian"], ["fa", "فارسی", "Persian"], ["ur", "اردو", "Urdu"], ["bn", "বাংলা", "Bengali"],
    ["vi", "Tiếng Việt", "Vietnamese"], ["th", "ไทย", "Thai"],
    ["af", "Afrikaans", "Afrikaans"], ["sq", "Shqip", "Albanian"], ["am", "አማርኛ", "Amharic"], ["hy", "Հայերեն", "Armenian"],
    ["az", "Azərbaycanca", "Azerbaijani"], ["eu", "Euskara", "Basque"], ["be", "Беларуская", "Belarusian"],
    ["bs", "Bosanski", "Bosnian"], ["bg", "Български", "Bulgarian"], ["my", "မြန်မာ", "Burmese"], ["ca", "Català", "Catalan"],
    ["ceb", "Cebuano", "Cebuano"], ["ny", "Chichewa", "Chichewa"], ["co", "Corsu", "Corsican"], ["hr", "Hrvatski", "Croatian"],
    ["cs", "Čeština", "Czech"], ["da", "Dansk", "Danish"], ["eo", "Esperanto", "Esperanto"], ["et", "Eesti", "Estonian"],
    ["tl", "Filipino", "Filipino"], ["fi", "Suomi", "Finnish"], ["fy", "Frysk", "Frisian"], ["gl", "Galego", "Galician"],
    ["ka", "ქართული", "Georgian"], ["el", "Ελληνικά", "Greek"], ["gu", "ગુજરાતી", "Gujarati"],
    ["ht", "Kreyòl ayisyen", "Haitian Creole"], ["ha", "Hausa", "Hausa"], ["haw", "ʻŌlelo Hawaiʻi", "Hawaiian"],
    ["hmn", "Hmong", "Hmong"], ["hu", "Magyar", "Hungarian"], ["is", "Íslenska", "Icelandic"], ["ig", "Igbo", "Igbo"],
    ["ga", "Gaeilge", "Irish"], ["jw", "Basa Jawa", "Javanese"], ["kn", "ಕನ್ನಡ", "Kannada"], ["kk", "Қазақша", "Kazakh"],
    ["km", "ខ្មែរ", "Khmer"], ["rw", "Kinyarwanda", "Kinyarwanda"], ["ku", "Kurdî", "Kurdish"], ["ky", "Кыргызча", "Kyrgyz"],
    ["lo", "ລາວ", "Lao"], ["la", "Latina", "Latin"], ["lv", "Latviešu", "Latvian"], ["lt", "Lietuvių", "Lithuanian"],
    ["lb", "Lëtzebuergesch", "Luxembourgish"], ["mk", "Македонски", "Macedonian"], ["mg", "Malagasy", "Malagasy"],
    ["ms", "Bahasa Melayu", "Malay"], ["ml", "മലയാളം", "Malayalam"], ["mt", "Malti", "Maltese"], ["mi", "Māori", "Maori"],
    ["mr", "मराठी", "Marathi"], ["mn", "Монгол", "Mongolian"], ["ne", "नेपाली", "Nepali"], ["no", "Norsk", "Norwegian"],
    ["or", "ଓଡ଼ିଆ", "Odia"], ["ps", "پښتو", "Pashto"], ["pa", "ਪੰਜਾਬੀ", "Punjabi"], ["ro", "Română", "Romanian"],
    ["sm", "Gagana Samoa", "Samoan"], ["gd", "Gàidhlig", "Scots Gaelic"], ["sr", "Српски", "Serbian"],
    ["st", "Sesotho", "Sesotho"], ["sn", "Shona", "Shona"], ["sd", "سنڌي", "Sindhi"], ["si", "සිංහල", "Sinhala"],
    ["sk", "Slovenčina", "Slovak"], ["sl", "Slovenščina", "Slovenian"], ["so", "Soomaali", "Somali"],
    ["su", "Basa Sunda", "Sundanese"], ["sw", "Kiswahili", "Swahili"], ["sv", "Svenska", "Swedish"],
    ["tg", "Тоҷикӣ", "Tajik"], ["ta", "தமிழ்", "Tamil"], ["tt", "Татарча", "Tatar"], ["te", "తెలుగు", "Telugu"],
    ["tk", "Türkmençe", "Turkmen"], ["ug", "ئۇيغۇرچە", "Uyghur"], ["uz", "Oʻzbekcha", "Uzbek"], ["cy", "Cymraeg", "Welsh"],
    ["xh", "isiXhosa", "Xhosa"], ["yi", "ייִדיש", "Yiddish"], ["yo", "Yorùbá", "Yoruba"], ["zu", "isiZulu", "Zulu"]
  ];
  var SOURCE = "ar";
  var KEY = "mdm1_lang";
  var ALIAS = { he: "iw", nb: "no", nn: "no", fil: "tl", jv: "jw", "zh-hk": "zh-TW", "zh-tw": "zh-TW", "zh-hant": "zh-TW" };

  function get() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function set(v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} }
  function cookie(v) {
    var host = location.hostname, val = v ? "/" + SOURCE + "/" + v : "";
    var exp = v ? "" : ";expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "googtrans=" + val + ";path=/" + exp;
    document.cookie = "googtrans=" + val + ";path=/;domain=" + host + exp;
  }
  function translating() { return /(?:^|;\s*)googtrans=\/[^;]+/.test(document.cookie || ""); }
  function find(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0].toLowerCase() === String(code).toLowerCase()) return LANGS[i];
    return null;
  }
  function fromDevice() {                       // first supported language in the browser's preference list
    var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < prefs.length; i++) {
      var tag = String(prefs[i]).toLowerCase(), base = tag.split("-")[0];
      var hit = find(ALIAS[tag] || (tag.indexOf("zh") === 0 ? "zh-CN" : "") || ALIAS[base] || base);
      if (hit) return hit[0];
    }
    return "";
  }
  function load() {
    if (window.__mdm1Translate) return; window.__mdm1Translate = true;
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({ pageLanguage: SOURCE, autoDisplay: false }, "mdm1-gt");
    };
    var s = document.createElement("script");
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.head.appendChild(s);
  }
  function mount() {                            // hidden host element the widget needs
    if (document.getElementById("mdm1-gt")) return;
    var gt = document.createElement("div"); gt.id = "mdm1-gt"; document.body.appendChild(gt);
  }
  var css = document.createElement("style");
  css.textContent = ".goog-te-banner-frame,.skiptranslate>iframe{display:none!important}body{top:0!important}#mdm1-gt{display:none}" +
    "#mdm1-lang-btn{position:fixed;bottom:1.5rem;left:1.5rem;z-index:998;width:48px;height:48px;border-radius:50%;border:1px solid rgba(201,168,76,.5);background:rgba(0,0,0,.75);color:#c9a84c;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
    "#mdm1-lang-panel{position:fixed;bottom:5.5rem;left:1.5rem;z-index:998;width:min(86vw,280px);max-height:70vh;display:none;flex-direction:column;background:rgba(5,4,3,.97);border:1px solid rgba(201,168,76,.35);border-radius:12px;padding:.5rem}" +
    "#mdm1-lang-panel.open{display:flex}" +
    "#mdm1-lang-q{flex:none;width:100%;box-sizing:border-box;margin:0 0 .4rem;padding:.5rem .6rem;border-radius:8px;border:1px solid rgba(201,168,76,.35);background:rgba(255,255,255,.06);color:#e8d5a3;font:inherit;font-size:.9rem}" +
    "#mdm1-lang-list{overflow:auto;flex:1 1 auto}" +
    "#mdm1-lang-list button{display:flex;justify-content:space-between;gap:.6rem;width:100%;text-align:start;background:none;border:0;color:#e8d5a3;padding:.45rem .6rem;border-radius:6px;cursor:pointer;font:inherit;font-size:.9rem}" +
    "#mdm1-lang-list button small{opacity:.55;font-size:.75rem;align-self:center}" +
    "#mdm1-lang-list button:hover,#mdm1-lang-list button[aria-current=true]{background:rgba(201,168,76,.14)}";
  document.head.appendChild(css);

  var sel = document.getElementById("lang-select");
  var cur = get();

  if (sel) {
    /* ---- page with its own translated copy: keep it, add every other language to the same select ---- */
    var own = {};
    for (var i = 0; i < sel.options.length; i++) own[sel.options[i].value] = 1;
    var grp = document.createElement("optgroup"); grp.label = "More languages";
    LANGS.forEach(function (l) {
      if (own[l[0]] || l[0] === SOURCE) return;
      var o = document.createElement("option"); o.value = l[0]; o.textContent = l[1] + " · " + l[2]; grp.appendChild(o);
    });
    sel.appendChild(grp);
    mount();
    var forcing = false;
    sel.addEventListener("change", function () {
      if (forcing) return;
      var v = sel.value;
      if (own[v]) { if (translating()) { cookie(""); location.reload(); } return; }   // page script renders its own copy
      set(v); cookie(v); location.reload();
    });
    if (cur && !own[cur] && find(cur)) {
      // render the source-language copy first so the widget translates from the right text
      forcing = true; sel.value = SOURCE; sel.dispatchEvent(new Event("change")); forcing = false;
      set(cur); cookie(cur); sel.value = cur; load();
    } else if (!cur) {
      try {
        if (!localStorage.getItem(KEY + "_seen")) {
          localStorage.setItem(KEY + "_seen", "1");
          var d = fromDevice();
          if (d && d !== SOURCE && !own[d]) { set(d); cookie(d); location.reload(); }
        }
      } catch (e) {}
    }
    return;
  }

  /* ---- page without a selector: floating globe + searchable list ---- */
  mount();
  var btn = document.createElement("button"); btn.id = "mdm1-lang-btn"; btn.type = "button";
  btn.setAttribute("aria-label", "Language"); btn.setAttribute("aria-expanded", "false"); btn.textContent = "🌐"; btn.translate = false;
  var panel = document.createElement("div"); panel.id = "mdm1-lang-panel"; panel.setAttribute("translate", "no");
  var q = document.createElement("input"); q.id = "mdm1-lang-q"; q.type = "search"; q.placeholder = "Search language…";
  q.setAttribute("aria-label", "Search language"); q.autocomplete = "off";
  var list = document.createElement("div"); list.id = "mdm1-lang-list";
  var items = [];
  LANGS.forEach(function (l) {
    var b = document.createElement("button"); b.type = "button";
    var name = document.createElement("span"); name.textContent = l[1];
    var en = document.createElement("small"); en.textContent = l[2] === l[1] ? "" : l[2];
    b.appendChild(name); b.appendChild(en);
    if ((cur || SOURCE) === l[0]) b.setAttribute("aria-current", "true");
    b.onclick = function () { var v = l[0] === SOURCE ? "" : l[0]; set(v); cookie(v); location.reload(); };
    list.appendChild(b); items.push([b, (l[1] + " " + l[2] + " " + l[0]).toLowerCase()]);
  });
  q.addEventListener("input", function () {
    var t = q.value.trim().toLowerCase();
    items.forEach(function (it) { it[0].style.display = !t || it[1].indexOf(t) >= 0 ? "" : "none"; });
  });
  panel.appendChild(q); panel.appendChild(list);
  function toggle(open) {
    panel.classList[open ? "add" : "remove"]("open"); btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) q.focus();
  }
  btn.onclick = function (e) { e.stopPropagation(); toggle(!panel.classList.contains("open")); };
  document.addEventListener("click", function (e) { if (!panel.contains(e.target)) toggle(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });
  document.body.appendChild(btn); document.body.appendChild(panel);

  if (!cur) {                                   // first visit: follow the device language once (never forced afterwards)
    try {
      if (!localStorage.getItem(KEY + "_seen")) {
        localStorage.setItem(KEY + "_seen", "1");
        var dev = fromDevice();
        if (dev && dev !== SOURCE) { set(dev); cookie(dev); location.reload(); return; }
      }
    } catch (e) {}
  }
  if (cur) { cookie(cur); load(); }
})();
