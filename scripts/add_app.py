#!/usr/bin/env python3
"""Publishes ONE client-side web app handed over by Scout (env APP_JSON), in the SITE'S OWN design.

APP_JSON = {slug,title,h1,description,body_html,css,script_js,faq[]}. The page is rendered with the same shell
as every other mdm1.org page (css/global.css, css/pages.css, js/global.js, navbar, gold theme); only the app's
own small markup/script (and a little extra CSS) is added, so pages stay light and look unified.
Gates: HTML parsed against a tag/attribute allowlist, no external resources, no network/storage/eval/navigation primitives in JS,
Arabic text, JS syntax, size caps. Only ADDS files.
"""
import datetime as dt, json, os, re, subprocess, sys, tempfile
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(__file__))
import trend_pages as T   # shared shell / helpers (main() is guarded)

SITE = T.SITE
E = T.E
D = T.D
ADS = ('<meta name="google-adsense-account" content="ca-pub-8270783733461099">\n'
       '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8270783733461099" crossorigin="anonymous"></script>\n')
BACK = (f"{SITE}/apps/", "كل التطبيقات")


def reject(why):
    print("handed-over app rejected:", why)
    sys.exit(0)


# --- Security gates (allowlist for HTML, hardened blocklist for CSS/JS) ---
ALLOWED_TAGS = {"div", "span", "p", "h2", "h3", "h4", "ul", "ol", "li", "label", "input", "select", "option", "optgroup", "textarea",
                "button", "canvas", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "br", "hr", "strong", "em", "b", "i",
                "u", "small", "code", "pre", "section", "article", "fieldset", "legend", "output", "details", "summary", "progress",
                "meter", "kbd", "sub", "sup", "mark", "a"}
ALLOWED_ATTRS = {"id", "class", "type", "name", "value", "min", "max", "step", "placeholder", "rows", "cols", "for", "checked", "selected",
                 "disabled", "readonly", "required", "maxlength", "minlength", "width", "height", "role", "title", "dir", "lang", "style",
                 "tabindex", "open", "multiple", "accept", "autocomplete", "inputmode", "pattern", "size", "colspan", "rowspan", "scope",
                 "href", "download", "rel", "low", "high", "optimum"}
BAD_SCHEME = re.compile(r"^(javascript|vbscript|data|blob|file):", re.I)
BAD_STYLE = re.compile(r"url\s*\(|expression\s*\(|@import|\\|behavior|-moz-binding|javascript:|<|/\*", re.I)


class _Allow(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.problem = None

    def _bad(self, why):
        if not self.problem: self.problem = why

    def handle_starttag(self, tag, attrs):
        if tag not in ALLOWED_TAGS: return self._bad("tag <%s> is not allowed" % tag)
        for name, val in attrs:
            name = (name or "").lower(); val = val or ""
            if name.startswith("on"): return self._bad("event attribute " + name)
            if not (name in ALLOWED_ATTRS or name.startswith("aria-") or name.startswith("data-")): return self._bad("attribute %s is not allowed" % name)
            flat = re.sub(r"[\s\x00-\x20]+", "", val)
            if BAD_SCHEME.match(flat): return self._bad("dangerous url scheme in " + name)
            if name == "href" and not (tag == "a" and val.startswith("#")): return self._bad("href must be an in-page #anchor on <a>")
            if name == "style" and BAD_STYLE.search(val): return self._bad("unsafe inline style")

    handle_startendtag = handle_starttag

    def handle_comment(self, data): self._bad("html comments are not allowed")
    def handle_decl(self, decl): self._bad("declarations are not allowed")
    def handle_pi(self, data): self._bad("processing instructions are not allowed")
    def unknown_decl(self, data): self._bad("cdata/conditional sections are not allowed")


RAW_DANGEROUS_TAG = re.compile(r"<\s*/?\s*(script|style|iframe|frame|frameset|object|embed|applet|link|meta|base|form|svg|math|template|noscript|img|video|audio|source|track|image|portal|dialog)\b", re.I)


def html_problem(body):
    m = RAW_DANGEROUS_TAG.search(body)
    if m: return "tag <%s> is not allowed" % m.group(1).lower()
    p = _Allow()
    try:
        p.feed(body); p.close()
    except Exception:
        return "html could not be parsed safely"
    return p.problem


def css_problem(css):
    m = BAD_STYLE.search(css)
    return ("unsafe css near '%s'" % m.group(0)[:20]) if m else None


JS_BLOCK = [
    r"\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|Worker|SharedWorker|BroadcastChannel|RTCPeerConnection|WebTransport|postMessage)\b",
    r"(?-i:\b(eval|Function|Reflect|Proxy|globalThis|__proto__|__defineGetter__|__defineSetter__)\b)",   # case-SENSITIVE: lowercase 'function' is plain JS
    r"\.\s*constructor\b",
    r"\b(localStorage|sessionStorage|indexedDB|openDatabase|cookieStore)\b|\bcaches\s*\.",
    r"\bdocument\s*\.\s*(cookie|domain|write|writeln|location)\b",
    r"\b(window|self|document|this)\s*\[",
    r"\bwindow\s*\.\s*(top|parent|opener|frames|open|name|location|history)\b",
    r"\blocation\b|\bopener\b|\bhistory\s*\.",
    r"\bnavigator\s*\.\s*(sendBeacon|serviceWorker|clipboard|geolocation|mediaDevices|credentials|permissions|share)\b",
    r"\bimport\s*[(.]",
    r"(?<![.\w])open\s*\(",
    r"\b(setTimeout|setInterval)\s*\(\s*[\"'`]",
    r"\bcreateElement\s*\(\s*[\"'`]\s*(script|iframe|frame|object|embed|link|meta|base|form|style)\b",
    r"\bsetAttribute\s*\(\s*[\"'`]\s*(on\w+|src|srcdoc|formaction|action|data)\b",
    r"\.\s*(srcdoc|contentWindow|contentDocument)\b",
    r"[\"'`]\s*(//|https?:|wss?:|ftp:|javascript:|vbscript:|data:text/html)",
    r"https?\s*:\s*/\s*/",
    r"</script|<!--",
]
JS_BLOCK_RE = [re.compile(x, re.I) for x in JS_BLOCK]


def js_problem(js):
    for rx in JS_BLOCK_RE:
        m = rx.search(js)
        if m: return "unsafe js: '%s' is not allowed" % re.sub(r"\s+", " ", m.group(0))[:30]
    return None


def validate(a, existing):
    if not isinstance(a, dict): reject("not an object")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+){0,5}", str(a.get("slug", ""))) or len(a["slug"]) > 40 or a["slug"] == "index": reject("slug")
    if a["slug"] in existing: reject("duplicate slug")
    for k in ("title", "h1", "description", "body_html", "script_js"):
        if not isinstance(a.get(k), str) or not a[k].strip(): reject("missing " + k)
    a["css"] = a.get("css") if isinstance(a.get("css"), str) else ""
    if len(a["body_html"]) > 40000 or len(a["script_js"]) > 40000 or len(a["css"]) > 9000: reject("size")
    faq = a.get("faq")
    if not isinstance(faq, list) or not 3 <= len(faq) <= 6 or not all(isinstance(x, dict) and x.get("q") and x.get("a") for x in faq): reject("faq")
    text = re.sub(r"<[^>]+>", " ", a["body_html"])
    if len(text) < 300 or not re.search(r"[؀-ۿ]", text + a["title"]): reject("body too thin / not Arabic")
    why = html_problem(a["body_html"])
    if why: reject("unsafe html: " + why)
    why = css_problem(a["css"])
    if why: reject(why)
    why = js_problem(a["script_js"])
    if why: reject(why)
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f: f.write(a["script_js"])
    if subprocess.run(["node", "--check", f.name], capture_output=True).returncode not in (0, 127): reject("js syntax")


def page(a):
    faq = "".join(f"<h3>{E(x['q'])}</h3><p>{E(x['a'])}</p>" for x in a["faq"])
    main = (f'<div class="tool app"><div class="card">{a["body_html"]}</div><div class="divider"></div>'
            f'<section class="faq"><h2 style="color:var(--gold-bright)">أسئلة شائعة</h2>{faq}</section>'
            f'<p style="margin-top:1.5rem"><a href="./" class="glow-gold">← كل التطبيقات</a> · <a href="../tools/" class="glow-gold">الأدوات</a></p></div>')
    canon = f"{SITE}/apps/{a['slug']}.html"
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebApplication", "name": a["h1"], "url": canon, "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any", "inLanguage": "ar", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": x["q"], "acceptedAnswer": {"@type": "Answer", "text": x["a"]}} for x in a["faq"]]}]}
    html = T.shell(a["title"], a["description"], canon, a["h1"], "MDM1 · تطبيقات مجانية", main,
                   f"<script>\n{a['script_js']}\n</script>", ld, f" · {D}", extra_css=APP_CSS + a["css"], back=BACK)
    return html


APP_CSS = """.app .card{padding:1.2rem}.app canvas{max-width:100%;height:auto;border-radius:10px;background:rgba(0,0,0,.4)}
.app .row{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin:.6rem 0}.app .row>*{flex:1 1 140px}
.app button.sec{background:transparent;border:1px solid var(--gold-dim);color:var(--light)}
.app input[type=range]{padding:0}.app input[type=file]{padding:.5rem}"""


def main():
    raw = os.environ.get("APP_JSON", "").strip()
    if not raw: return print("no APP_JSON")
    try: a = json.loads(raw)
    except ValueError: reject("invalid json")
    data = json.load(open("data/apps.json", encoding="utf-8")) if os.path.exists("data/apps.json") else {"apps": []}
    validate(a, {x["slug"] for x in data["apps"]})
    T.wr(f"apps/{a['slug']}.html", page(a))
    data["apps"].append({"slug": a["slug"], "title": a["title"], "h1": a["h1"], "description": a["description"], "date": D})
    os.makedirs("data", exist_ok=True)
    json.dump(data, open("data/apps.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    cards = "".join(f'<div class="card"><span class="card-icon">🧩</span><div class="card-title"><a href="{x["slug"]}.html" class="glow-gold">{E(x["h1"])}</a></div><div class="card-text">{E(x["description"])}</div></div>' for x in reversed(data["apps"]))
    T.wr("apps/index.html", T.shell("تطبيقات مجانية تعمل في متصفحك", "تطبيقات ويب مجانية تعمل داخل متصفحك بدون تسجيل: محررات ومنظمات وأدوات إنتاجية.",
         f"{SITE}/apps/", "تطبيقات مجانية", "MDM1 · التطبيقات", f'<div class="card-grid">{cards}</div>', foot=f" · {len(data['apps'])} تطبيق", back=BACK))
    urls = [("/apps/", D)] + [(f"/apps/{x['slug']}.html", x["date"]) for x in data["apps"]]
    T.wr("sitemap-apps.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
         + "".join(f"  <url><loc>{SITE}{u}</loc><lastmod>{m}</lastmod></url>\n" for u, m in urls) + "</urlset>\n")
    rb = open("robots.txt", encoding="utf-8").read()
    if "sitemap-apps.xml" not in rb: open("robots.txt", "w", encoding="utf-8").write(rb.rstrip("\n") + f"\nSitemap: {SITE}/sitemap-apps.xml\n")
    print("PUBLISHED apps/%s.html" % a["slug"])


main()
