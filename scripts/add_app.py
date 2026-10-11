#!/usr/bin/env python3
"""Publishes ONE self-contained client-side web app handed over by Scout (env APP_JSON).

APP_JSON = {"slug","title","description","html"}; html is a complete single-file page (inline CSS/JS).
Gates: no external requests/resources, no eval/Function/cookies/storage of secrets, size cap, Arabic UI,
JS syntax check. The page is then wrapped with site metadata (canonical, AdSense, back link) and listed in
apps/index.html + sitemap-apps.xml + data/apps.json. Only ADDS files.
"""
import datetime as dt, html as H, json, os, re, subprocess, sys, tempfile

SITE = "https://mdm1.org"
ADS = ('<meta name="google-adsense-account" content="ca-pub-8270783733461099">\n'
       '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8270783733461099" crossorigin="anonymous"></script>\n')
MAX = 120_000
D = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
E = H.escape


def reject(why):
    print("handed-over app rejected:", why)
    sys.exit(0)


def validate(a, existing):
    if not isinstance(a, dict): reject("not an object")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+){0,5}", str(a.get("slug", ""))) or len(a["slug"]) > 40 or a["slug"] == "index": reject("slug")
    if a["slug"] in existing: reject("duplicate slug")
    for k in ("title", "description", "html"):
        if not isinstance(a.get(k), str) or not a[k].strip(): reject("missing " + k)
    h = a["html"]
    if len(h) > MAX or len(h) < 3000: reject("size out of range")
    if not re.search(r"[؀-ۿ]", h): reject("not Arabic")
    if not re.search(r"<html|<body", h, re.I): reject("not a full page")
    if re.search(r"(src|href|action|data|poster)\s*=\s*[\"']?\s*(https?:)?//", h, re.I): reject("external resource")
    if re.search(r"url\(\s*[\"']?\s*(https?:)?//|@import|<iframe|<object|<embed|<link", h, re.I): reject("external resource in css/html")
    if re.search(r"fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|importScripts|import\s*\(|eval\s*\(|new Function|document\.cookie|window\.open|location\s*=|https?://", h, re.I): reject("unsafe js/network")
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", h, re.S | re.I)
    if not scripts or re.search(r"<script[^>]+src", h, re.I): reject("needs inline script only")
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f: f.write("\n;\n".join(scripts))
    if subprocess.run(["node", "--check", f.name], capture_output=True).returncode not in (0, 127): reject("js syntax")


def wrap(a):
    h = a["html"]
    canon = f"{SITE}/apps/{a['slug']}/"
    head = (f'<link rel="canonical" href="{canon}">\n<meta name="description" content="{E(a["description"], quote=True)}">\n'
            f'<meta property="og:title" content="{E(a["title"], quote=True)}">\n<meta property="og:description" content="{E(a["description"], quote=True)}">\n'
            f'<meta property="og:url" content="{canon}">\n{ADS}')
    h = re.sub(r"<meta[^>]+name=[\"']description[\"'][^>]*>", "", h, flags=re.I)
    h = re.sub(r"</head>", head + "</head>", h, count=1, flags=re.I) if re.search(r"</head>", h, re.I) else h
    nav = ('<div style="position:fixed;bottom:10px;left:10px;z-index:99;font:13px sans-serif;background:rgba(0,0,0,.65);'
           'padding:6px 10px;border-radius:20px"><a href="/apps/" style="color:#e6c66a;text-decoration:none">← MDM1 · كل التطبيقات</a></div>')
    return re.sub(r"</body>", nav + "</body>", h, count=1, flags=re.I)


def main():
    raw = os.environ.get("APP_JSON", "").strip()
    if not raw: return print("no APP_JSON")
    try: a = json.loads(raw)
    except ValueError: reject("invalid json")
    data = json.load(open("data/apps.json", encoding="utf-8")) if os.path.exists("data/apps.json") else {"apps": []}
    validate(a, {x["slug"] for x in data["apps"]})
    os.makedirs(f"apps/{a['slug']}", exist_ok=True)
    open(f"apps/{a['slug']}/index.html", "w", encoding="utf-8").write(wrap(a))
    data["apps"].append({"slug": a["slug"], "title": a["title"], "description": a["description"], "date": D})
    os.makedirs("data", exist_ok=True)
    json.dump(data, open("data/apps.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    cards = "".join(f'<a class="c" href="{x["slug"]}/"><b>{E(x["title"])}</b><span>{E(x["description"])}</span></a>' for x in reversed(data["apps"]))
    index = (f'<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
             f'<title>تطبيقات مجانية تعمل في متصفحك | MDM1</title><meta name="description" content="تطبيقات ويب مجانية بالعربية تعمل داخل متصفحك بدون تسجيل: محررات ومنظمات وأدوات إنتاجية.">'
             f'<link rel="canonical" href="{SITE}/apps/">{ADS}<style>body{{margin:0;background:#0b0b10;color:#eee;font:16px/1.7 system-ui,sans-serif;padding:24px}}'
             f'h1{{color:#e6c66a}}.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}}'
             f'.c{{display:block;background:#15151d;border:1px solid #3a3320;border-radius:12px;padding:16px;color:#eee;text-decoration:none}}'
             f'.c b{{display:block;color:#e6c66a;margin-bottom:6px}}.c span{{font-size:.9rem;opacity:.8}}a.h{{color:#e6c66a}}</style></head><body>'
             f'<p><a class="h" href="/">← MDM1</a> · <a class="h" href="/tools/">الأدوات</a></p><h1>تطبيقات مجانية</h1><div class="g">{cards}</div></body></html>')
    open("apps/index.html", "w", encoding="utf-8").write(index)
    urls = [("/apps/", D)] + [(f"/apps/{x['slug']}/", x["date"]) for x in data["apps"]]
    open("sitemap-apps.xml", "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{SITE}{u}</loc><lastmod>{m}</lastmod></url>\n" for u, m in urls) + "</urlset>\n")
    rb = open("robots.txt", encoding="utf-8").read()
    if "sitemap-apps.xml" not in rb: open("robots.txt", "w", encoding="utf-8").write(rb.rstrip("\n") + f"\nSitemap: {SITE}/sitemap-apps.xml\n")
    print("PUBLISHED apps/%s/" % a["slug"])


main()
