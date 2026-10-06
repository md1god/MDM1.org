#!/usr/bin/env python3
"""Daily: trending idea -> ORIGINAL static tool page on mdm1.org (stdlib only).
Only ADDS files (tools/, data/tools.json, sitemap-tools.xml) + injects list entries; never edits old pages.
Kill switch: set "enabled": false in data/tools.json."""
import datetime as dt, html, json, os, re, subprocess, sys, tempfile, urllib.error, urllib.parse, urllib.request

SITE, KEY, DATA = "https://mdm1.org", "14aaa353c0894bc3f8a8e7855831190e", "data/tools.json"
MODELS = ["openai/gpt-4o", "openai/gpt-4o-mini"]
TODAY = dt.datetime.now(dt.timezone.utc)
D = TODAY.strftime("%Y-%m-%d")
E = html.escape

ZAKAT = dict(slug="zakat-calculator", date="2026-10-07", source=None, source_url=None,
 title="حاسبة زكاة المال والذهب والفضة — مجانية ودقيقة",
 h1="حاسبة زكاة المال",
 description="احسب زكاة مالك وذهبك وفضتك وعروض التجارة في ثوانٍ: النصاب والديون ومقدار الزكاة 2.5%. مجانية وتعمل في متصفحك بدون تسجيل.",
 faq=[{"q": "ما هو نصاب الزكاة؟", "a": "نصاب الذهب 85 جرامًا ونصاب الفضة 595 جرامًا، وتجب الزكاة بمقدار 2.5% إذا بلغ صافي المال النصاب وحال عليه الحول الهجري."},
      {"q": "هل تُخصم الديون قبل حساب الزكاة؟", "a": "يرى كثير من أهل العلم خصم الديون الحالّة المستحقة، وفي التفاصيل خلاف. الأداة تعين على الحساب ولا تغني عن سؤال جهة الفتوى المعتمدة عندك."},
      {"q": "هل تُرسل بياناتي لأي خادم؟", "a": "لا، كل الحساب يتم داخل متصفحك ولا يُخزَّن شيء."}],
 body_html=r'''<p><b>الجواب السريع:</b> تجب الزكاة بنسبة <b>2.5%</b> من صافي المال إذا بلغ النصاب (85 جرام ذهب أو 595 جرام فضة) ومرّ عليه سنة هجرية. أدخل أرقامك بعملتك، وكل الحساب داخل متصفحك.</p>
<label>سعر جرام الذهب (عيار 24) بعملتك</label><input id="gp" type="number" min="0" step="any" inputmode="decimal">
<label>سعر جرام الفضة بعملتك</label><input id="sp" type="number" min="0" step="any" inputmode="decimal">
<label>النصاب المعتمد</label><select id="nis"><option value="gold">نصاب الذهب (85 جرام) — الأشهر حاليًا</option><option value="silver">نصاب الفضة (595 جرام) — الأحوط للفقراء</option></select>
<label>النقد والأرصدة البنكية</label><input id="cash" type="number" min="0" step="any" inputmode="decimal" value="0">
<label>وزن الذهب المدّخر (جرام عيار 24 أو ما يعادله)</label><input id="gg" type="number" min="0" step="any" inputmode="decimal" value="0">
<label>وزن الفضة المدّخرة (جرام)</label><input id="sg" type="number" min="0" step="any" inputmode="decimal" value="0">
<label>قيمة عروض التجارة والبضائع</label><input id="trade" type="number" min="0" step="any" inputmode="decimal" value="0">
<label>ديون مرجوّة السداد لك</label><input id="rec" type="number" min="0" step="any" inputmode="decimal" value="0">
<label>ديون حالّة عليك</label><input id="debt" type="number" min="0" step="any" inputmode="decimal" value="0">
<button id="go" type="button">احسب الزكاة</button>
<div class="out" id="out" style="display:none" aria-live="polite"></div>''',
 script_js=r'''function zakat(v){const n=k=>Math.max(0,parseFloat(v[k])||0);
const net=n('cash')+n('gg')*n('gp')+n('sg')*n('sp')+n('trade')+n('rec')-n('debt');
const nisab=v.nis==='gold'?85*n('gp'):595*n('sp');
return {net,nisab,due:nisab>0&&net>=nisab?net*0.025:0,ok:nisab>0};}
document.getElementById('go').onclick=()=>{const v={};
['gp','sp','nis','cash','gg','sg','trade','rec','debt'].forEach(i=>v[i]=document.getElementById(i).value);
const r=zakat(v),o=document.getElementById('out'),f=x=>x.toLocaleString('ar-EG',{maximumFractionDigits:2});
o.style.display='block';
o.innerHTML=!r.ok?'أدخل سعر الجرام للمعدن الذي اخترته نصابًا.':'صافي المال: <b>'+f(r.net)+'</b><br>النصاب: <b>'+f(r.nisab)+'</b><br>'+
(r.due>0?'الزكاة الواجبة (2.5%):<div class="big">'+f(r.due)+'</div><small>بشرط مرور الحول الهجري.</small>':'<b>لم يبلغ مالك النصاب، فلا زكاة عليك الآن.</b>');};''')

CSS = """.tool label{display:block;margin:.9rem 0 .25rem;color:var(--gold)}
.tool input,.tool select,.tool textarea{width:100%;padding:.7rem;border-radius:8px;border:1px solid var(--gold-dim);background:rgba(0,0,0,.55);color:var(--light);font:inherit}
.tool button{margin-top:1rem;width:100%;padding:.85rem;border:0;border-radius:50px;background:linear-gradient(135deg,#c9a84c,#8b6914);color:#000;font:inherit;font-weight:700;cursor:pointer}
.tool .out{margin-top:1rem;padding:1rem;border:1px solid var(--gold-dim);border-radius:10px;background:rgba(201,168,76,.05)}
.tool .big{font-size:1.8rem;color:var(--gold-bright);font-weight:700}
.tool .faq h3{color:var(--gold-bright);font-size:1.05rem;margin-top:1.2rem}.tool .src{margin-top:2rem;font-size:.85rem;opacity:.7}"""

def shell(title, desc, canon, h1, label, main, script="", ld=None, foot=""):
    ldj = f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>' if ld else ""
    return f'''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{E(title)} | MDM1</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{canon}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{canon}">
<link rel="stylesheet" href="../css/global.css">
<link rel="stylesheet" href="../css/pages.css">
<style>{CSS}</style>
{ldj}
</head>
<body>
<div id="particles"></div>
<nav class="navbar">
  <a href="https://mdm1.org/index.html" class="nav-logo">👁️ MDM1</a>
  <a href="https://mdm1.org/tools/" class="nav-back">كل الأدوات</a>
</nav>
<header class="page-hero reveal">
  <div class="page-label">{label}</div>
  <h1 class="page-title">{E(h1)}</h1>
  <p class="page-sub">{E(desc)}</p>
</header>
<main class="page-content">
{main}
</main>
<footer class="page-footer">✦ MDM1{foot} ✦</footer>
<script src="../js/global.js"></script>
{script}
</body>
</html>
'''

def tool_page(t):
    faq = "".join(f"<h3>{E(x['q'])}</h3><p>{E(x['a'])}</p>" for x in t["faq"])
    src = (f'<p class="src">فكرة الأداة مستوحاة من اتجاه رائج: <a href="{E(t["source_url"])}" rel="nofollow noopener" target="_blank">{E(t["source"])}</a> — الكود والتصميم مكتوبان من الصفر.</p>'
           if t.get("source") else "")
    main = f'<div class="tool"><div class="card">{t["body_html"]}</div><div class="divider"></div><section class="faq"><h2 style="color:var(--gold-bright)">أسئلة شائعة</h2>{faq}</section>{src}<p style="margin-top:1.5rem"><a href="./" class="glow-gold">← كل الأدوات</a> · <a href="../pages/index.html" class="glow-gold">كل الصفحات</a></p></div>'
    canon = f"{SITE}/tools/{t['slug']}.html"
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebApplication", "name": t["h1"], "url": canon, "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any", "inLanguage": "ar", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": x["q"], "acceptedAnswer": {"@type": "Answer", "text": x["a"]}} for x in t["faq"]]}]}
    return shell(t["title"], t["description"], canon, t["h1"], "MDM1 · أدوات مجانية", main, f"<script>\n{t['script_js']}\n</script>", ld, f" · {t['date']}")

def wr(path, s):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    if os.path.exists(path) and open(path, encoding="utf-8").read() == s: return False
    open(path, "w", encoding="utf-8").write(s); return True

def load():
    d = json.load(open(DATA, encoding="utf-8")) if os.path.exists(DATA) else {}
    d.setdefault("enabled", True); d.setdefault("tools", []); d.setdefault("seen", [])
    return d

def publish_files(d):
    for t in d["tools"]:
        if t["slug"] == "zakat-calculator": wr(f"tools/{t['slug']}.html", tool_page(ZAKAT))
    cards = "".join(f'<div class="card"><span class="card-icon">🧰</span><div class="card-title"><a href="{t["slug"]}.html" class="glow-gold">{E(t["h1"] if "h1" in t else t["title"])}</a></div><div class="card-text">{E(t["description"])}</div></div>' for t in reversed(d["tools"]))
    wr("tools/index.html", shell("أدوات مجانية مفيدة", "أدوات عربية مجانية تعمل في متصفحك بدون تسجيل.", f"{SITE}/tools/", "أدوات مجانية", "MDM1 · الأدوات", f'<div class="card-grid">{cards}</div>', foot=f" · {len(d['tools'])} أداة"))
    urls = [("/tools/", D)] + [(f"/tools/{t['slug']}.html", t["date"]) for t in d["tools"]]
    wr("sitemap-tools.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>{SITE}{u}</loc><lastmod>{m}</lastmod></url>\n" for u, m in urls) + "</urlset>\n")
    wr(f"{KEY}.txt", KEY)
    # list entries: pages/index.html (inject, idempotent) + pages-registry.json (so a future generator run keeps them)
    p = "pages/index.html"; s = open(p, encoding="utf-8").read()
    for t in d["tools"]:
        if f'data-tool="{t["slug"]}"' in s: continue
        li = f'      <li class="tl-item" data-tool="{t["slug"]}">\n        <div class="tl-date">أداة</div>\n        <div class="tl-title"><a href="../tools/{t["slug"]}.html" class="glow-gold">{E(t.get("h1") or t["title"])}</a></div>\n        <div class="tl-text">{t["date"]}</div>\n      </li>\n'
        s = s.replace('<ul class="timeline reveal">\n', '<ul class="timeline reveal">\n' + li, 1)
    wr(p, s)
    reg = json.load(open("pages-registry.json", encoding="utf-8"))
    for t in d["tools"]:
        if not any(r.get("slug") == f"../tools/{t['slug']}" for r in reg):
            reg.append({"number": "أداة", "slug": f"../tools/{t['slug']}", "title": t.get("h1") or t["title"], "date": t["date"] + "T07:00:00.000Z", "kind": "tool"})
    wr("pages-registry.json", json.dumps(reg, ensure_ascii=False, indent=2))

def get(url, token=None):
    r = urllib.request.Request(url, headers={"User-Agent": "mdm1-trend", **({"Authorization": f"Bearer {token}"} if token else {})})
    return json.load(urllib.request.urlopen(r, timeout=60))

def candidates(seen):
    tok, out = os.environ.get("GITHUB_TOKEN"), []
    try:
        q = f"stars:>150 pushed:>{(TODAY - dt.timedelta(days=45)):%Y-%m-%d} created:>{(TODAY - dt.timedelta(days=400)):%Y-%m-%d}"
        for r in get("https://api.github.com/search/repositories?" + urllib.parse.urlencode({"q": q, "sort": "stars", "per_page": 30}), tok)["items"]:
            if not r["archived"] and r["description"]: out.append({"id": "gh:" + r["full_name"], "name": r["full_name"], "desc": r["description"], "url": r["html_url"]})
    except Exception as e: print("::warning::github search failed:", e)
    try:
        ts = int((TODAY - dt.timedelta(days=30)).timestamp())
        for h in get(f"https://hn.algolia.com/api/v1/search?tags=show_hn&numericFilters=points>120,created_at_i>{ts}&hitsPerPage=20")["hits"]:
            out.append({"id": "hn:" + h["objectID"], "name": h["title"], "desc": h["title"], "url": "https://news.ycombinator.com/item?id=" + h["objectID"]})
    except Exception as e: print("::warning::hn fetch failed:", e)
    return [c for c in out if c["id"] not in seen][:14]

PROMPT = """You are building ONE original, genuinely useful, single-page Arabic web tool for mdm1.org, inspired by the IDEA behind one trending project below.
Pick the one candidate that can be built as a fully working CLIENT-SIDE tool (HTML form + vanilla JS, no server, no network, no external libs). If none fits, answer {"pick":null}.
Rules: write everything from scratch; never copy code, names, branding or text of the source; do not put the source name in title/slug; Arabic UI text; the tool must really work.
Return ONLY JSON: {"pick":"<candidate id>","slug":"ascii-kebab-3-40","title":"Arabic SEO title <=70 chars","h1":"Arabic heading","description":"Arabic meta description 110-160 chars",
"body_html":"intro paragraph (>=80 words, starts with a quick answer) + form/inputs/button/output. Elements need ids; wrap result in <div class=\\"out\\" id=\\"out\\">; use <label>,<input>,<select>,<textarea>,<button>; NO <script>, NO external src/href",
"script_js":"vanilla JS wiring the ids above","faq":[{"q":"..","a":".."}  (3-5 items)]}
Candidates:\\n"""

def ask(cands):
    if os.environ.get("TREND_MOCK_LLM"): return json.load(open(os.environ["TREND_MOCK_LLM"], encoding="utf-8"))
    msg = PROMPT + "\n".join(f"- {c['id']} | {c['name']} | {c['desc'][:160]}" for c in cands)
    for m in MODELS:
        try:
            body = json.dumps({"model": m, "temperature": 0.4, "max_tokens": 3800, "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": msg}]}).encode()
            r = urllib.request.Request("https://models.github.ai/inference/chat/completions", body, {"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"], "Content-Type": "application/json"})
            return json.loads(json.load(urllib.request.urlopen(r, timeout=180))["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e: print(f"::warning::{m}: HTTP {e.code} {e.read()[:200]}")
        except Exception as e: print(f"::warning::{m}: {e}")
    return None

def validate(r, cands, d):
    c = next((x for x in cands if x["id"] == r.get("pick")), None)
    bad = lambda why: print("rejected:", why) or None
    if not c: return bad("pick not in candidates")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+){0,5}", r.get("slug", "")) or len(r["slug"]) > 40 or any(t["slug"] == r["slug"] for t in d["tools"]) or r["slug"] in ("index",): return bad("slug")
    for k in ("title", "h1", "description", "body_html", "script_js"):
        if not isinstance(r.get(k), str) or not r[k].strip(): return bad("missing " + k)
    if not 3 <= len(r.get("faq", [])) <= 6 or not all(x.get("q") and x.get("a") for x in r["faq"]): return bad("faq")
    if len(re.sub(r"<[^>]+>", " ", r["body_html"])) < 500 or 'id="out"' not in r["body_html"]: return bad("body too thin / no #out")
    if not re.search(r"[\u0600-\u06FF]", r["title"] + r["body_html"]): return bad("not Arabic")
    if re.search(r"<script|<iframe|<link|<style|\son\w+\s*=|(src|href|action)\s*=\s*[\"']?(https?:)?//", r["body_html"], re.I): return bad("unsafe html")
    if re.search(r"fetch\s*\(|XMLHttpRequest|WebSocket|import\s*\(|eval\s*\(|new Function|document\.cookie|https?://|</script", r["script_js"], re.I): return bad("unsafe js")
    names = {c["name"].split("/")[-1].lower()} - {""}
    if any(n in (r["title"] + r["slug"]).lower() for n in names if len(n) > 3): return bad("contains source name")
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f: f.write(r["script_js"])
    if subprocess.run(["node", "--check", f.name], capture_output=True).returncode not in (0, 127): return bad("js syntax")
    return c

def indexnow(d):
    urls = [f"{SITE}/tools/", f"{SITE}/pages/index.html"] + [f"{SITE}/tools/{t['slug']}.html" for t in d["tools"][-3:]]
    body = json.dumps({"host": "mdm1.org", "key": KEY, "keyLocation": f"{SITE}/{KEY}.txt", "urlList": urls}).encode()
    try:
        r = urllib.request.urlopen(urllib.request.Request("https://api.indexnow.org/indexnow", body, {"Content-Type": "application/json; charset=utf-8"}), timeout=30)
        print("IndexNow HTTP", r.status)
    except urllib.error.HTTPError as e: print("IndexNow HTTP", e.code)

def main():
    d = load()
    if not any(t["slug"] == "zakat-calculator" for t in d["tools"]):
        d["tools"].append({k: ZAKAT[k] for k in ("slug", "title", "h1", "description", "date", "source", "source_url")})
    if "--indexnow" in sys.argv: return indexnow(d)
    if d["enabled"] and not os.environ.get("DRY"):
        cands = candidates(set(d["seen"]))
        r = ask(cands) if cands else None
        d["seen"] = (d["seen"] + [c["id"] for c in cands])[-2000:]
        c = validate(r, cands, d) if r and r.get("pick") else None
        if c:
            t = {k: r[k] for k in ("slug", "title", "h1", "description", "body_html", "script_js", "faq")}
            t.update(date=D, source=c["name"], source_url=c["url"])
            wr(f"tools/{t['slug']}.html", tool_page(t))
            d["tools"].append({k: t[k] for k in ("slug", "title", "h1", "description", "date", "source", "source_url")})
            print("PUBLISHED tools/%s.html from %s" % (t["slug"], c["id"]))
        else: print("no tool published today")
    publish_files(d)
    wr(DATA, json.dumps(d, ensure_ascii=False, indent=1))

main()
