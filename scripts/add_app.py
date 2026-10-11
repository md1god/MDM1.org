#!/usr/bin/env python3
"""Publishes ONE client-side web app handed over by Scout (env APP_JSON), in the SITE'S OWN design.

APP_JSON = {slug,title,h1,description,body_html,css,script_js,faq[]}. The page is rendered with the same shell
as every other mdm1.org page (css/global.css, css/pages.css, js/global.js, navbar, gold theme); only the app's
own small markup/script (and a little extra CSS) is added, so pages stay light and look unified.
Gates: no external resources, no network/eval, Arabic text, JS syntax, size caps. Only ADDS files.
"""
import datetime as dt, json, os, re, subprocess, sys, tempfile

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
    if re.search(r"<script|<iframe|<object|<embed|<link|<style|\son\w+\s*=|(src|href|action|data|poster)\s*=\s*[\"']?(https?:)?//", a["body_html"], re.I): reject("unsafe html")
    if re.search(r"@import|url\(\s*[\"']?\s*(https?:)?//|expression\(|</style", a["css"], re.I): reject("unsafe css")
    if re.search(r"fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|importScripts|import\s*\(|eval\s*\(|new Function|document\.cookie|window\.open|location\s*=|https?://|</script", a["script_js"], re.I): reject("unsafe js")
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
    return html.replace("</head>", ADS + "</head>", 1)


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
    T.wr("apps/index.html", T.shell("تطبيقات مجانية تعمل في متصفحك", "تطبيقات ويب مجانية بالعربية تعمل داخل متصفحك بدون تسجيل: محررات ومنظمات وأدوات إنتاجية.",
         f"{SITE}/apps/", "تطبيقات مجانية", "MDM1 · التطبيقات", f'<div class="card-grid">{cards}</div>', foot=f" · {len(data['apps'])} تطبيق", back=BACK).replace("</head>", ADS + "</head>", 1))
    urls = [("/apps/", D)] + [(f"/apps/{x['slug']}.html", x["date"]) for x in data["apps"]]
    T.wr("sitemap-apps.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
         + "".join(f"  <url><loc>{SITE}{u}</loc><lastmod>{m}</lastmod></url>\n" for u, m in urls) + "</urlset>\n")
    rb = open("robots.txt", encoding="utf-8").read()
    if "sitemap-apps.xml" not in rb: open("robots.txt", "w", encoding="utf-8").write(rb.rstrip("\n") + f"\nSitemap: {SITE}/sitemap-apps.xml\n")
    print("PUBLISHED apps/%s.html" % a["slug"])


main()
