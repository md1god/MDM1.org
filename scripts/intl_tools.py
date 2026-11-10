#!/usr/bin/env python3
"""MDM1 - real per-language pages for tools/ and apps/ (20 languages). ADDITIVE: writes only intl/, i18n-tools/,
sitemap-intl.xml and (one line, if missing) robots.txt. It never touches the existing 50-language system (/{lang}/ folders).
Source pages stay Arabic (the site's source language); every page is translated segment by segment, so HTML structure,
element ids and JavaScript logic are never rewritten - only visible text. Names of studied products never appear here."""
import datetime as dt, hashlib, html, json, os, re, subprocess, sys, tempfile, urllib.error, urllib.request
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import llm as LLM

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://mdm1.org"
# (code, hreflang, English name for the prompt, rtl). Order = priority: a whole language is rolled out before the next one.
LANGS = [("en", "en", "English", 0), ("es", "es", "Spanish", 0), ("pt", "pt", "Portuguese", 0), ("fr", "fr", "French", 0),
         ("de", "de", "German", 0), ("tr", "tr", "Turkish", 0), ("ru", "ru", "Russian", 0), ("hi", "hi", "Hindi", 0),
         ("id", "id", "Indonesian", 0), ("zh", "zh-CN", "Simplified Chinese", 0), ("ja", "ja", "Japanese", 0), ("ko", "ko", "Korean", 0),
         ("it", "it", "Italian", 0), ("vi", "vi", "Vietnamese", 0), ("pl", "pl", "Polish", 0), ("nl", "nl", "Dutch", 0),
         ("th", "th", "Thai", 0), ("fa", "fa", "Persian", 1), ("ur", "ur", "Urdu", 1), ("bn", "bn", "Bengali", 0)]
AR = re.compile(r"[\u0600-\u06FF]")
MAX_CALLS = int(os.environ.get("INTL_MAX_CALLS", "80"))
MODELS = ["openai/gpt-4.1-mini", "openai/gpt-4o-mini", "openai/gpt-4.1"]
STATE = {"calls": 0, "stop": ""}

# ---------------------------------------------------------------- model call (OpenCode Zen free models first, GitHub Models fallback: scripts/llm.py)
def translate(segs, lang_name):
    if os.environ.get("INTL_MOCK"): return ["[%s] %s" % (lang_name[:2], re.sub(r"[\u0600-\u06FF]+", "x", s)) for s in segs]
    prompt = ("Translate these user-interface strings from Arabic to %s. Natural, concise wording for a free web tool. Keep numbers, emojis, punctuation, "
              "and any {placeholders} or %%s unchanged. Do not add brand names. Return ONLY JSON {\"t\": [...]} with exactly %d strings in the same order.\n"
              % (lang_name, len(segs))) + json.dumps(segs, ensure_ascii=False)
    for _ in range(2):   # a reply with the wrong number of strings is retried once
        r = LLM.chat_json(prompt, max_tokens=4000, temperature=0.2)
        out = r.get("t") if isinstance(r, dict) else None
        if isinstance(out, list) and len(out) == len(segs) and all(isinstance(x, str) and x.strip() for x in out): return out
        if r is None and LLM.LAST["code"] == 429: STATE["stop"] = "حد استخدام النماذج (429)"; return None
    return None

# ---------------------------------------------------------------- parse a source page into segments + template
def parse(path):
    try: h = path.read_text(encoding="utf-8")
    except Exception: return None
    g = lambda p: (re.search(p, h, re.S) or [None, None])[1]
    title, desc, h1, label, main, style = (g(r"<title>(.*?)</title>"), g(r'<meta name="description" content="(.*?)">'), g(r'<h1 class="page-title">(.*?)</h1>'),
        g(r'<div class="page-label">(.*?)</div>'), g(r'<main class="page-content">(.*?)</main>'), g(r"<style>(.*?)</style>"))
    if None in (title, desc, h1, label, main, style) or "<script" in main or "<style" in main: return None
    tail = h.rsplit("</footer>", 1)[-1]
    js = "\n".join(re.findall(r"<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>(.*?)</script>", tail, re.S)).strip()
    main = re.sub(r'<section class="related".*?<!--related:end-->', "", main, flags=re.S)
    main = re.sub(r'<section class="related".*?</section>', "", main, flags=re.S)
    title = html.unescape(title); title = re.sub(r"\s*\|\s*MDM1\s*$", "", title)
    segs = [title, html.unescape(desc), html.unescape(h1), html.unescape(label)]
    def text_cb(m):
        t = m.group(1)
        if not AR.search(t): return t
        segs.append(html.unescape(t.strip())); return "\x00%d\x00" % (len(segs) - 1)
    def attr_cb(m):
        if not AR.search(m.group(2)): return m.group(0)
        segs.append(html.unescape(m.group(2))); return m.group(1) + "\x00%d\x00" % (len(segs) - 1) + m.group(3)
    tmpl = re.sub(r"(?<=>)([^<>]+)(?=<)", text_cb, main)
    tmpl = re.sub(r'(\b(?:placeholder|title|aria-label|alt)=")([^"]*)(")', attr_cb, tmpl)
    n_html = len(segs)
    jtok = js_tokens(js, segs) if js else []
    return {"segs": segs, "tmpl": tmpl, "jtok": jtok, "js": js, "style": style, "n_html": n_html, "hash": hashlib.sha1(json.dumps(segs, ensure_ascii=False).encode()).hexdigest()[:16]}


# ---------------------------------------------------------------- JavaScript: translate only string/template literals that contain Arabic
SIMPLE_ESC = {"\\\\": "\\", "\\'": "'", '\\"': '"', "\\n": "\n", "\\t": "\t", "\\`": "`"}
def dec(raw):
    if re.search(r"\\(?![\\'\"nt`])", raw): return None                         # exotic escapes: leave the literal alone
    return re.sub(r"\\([\\'\"nt`])", lambda m: SIMPLE_ESC["\\" + m.group(1)], raw)
def enc(t, q):
    t = t.replace("\\", "\\\\").replace(q, "\\" + q).replace("\r", "").replace("\n", "\\n")
    return t.replace("${", "\\${") if q == "`" else t

def scan_js(js):
    toks, buf, i, n, prev = [], [], 0, len(js), ""
    def flush():
        nonlocal buf
        if buf: toks.append(("code", "".join(buf))); buf = []
    while i < n:
        c, d = js[i], js[i + 1:i + 2]
        if c == "/" and d == "/": j = js.find("\n", i); j = n if j < 0 else j; buf.append(js[i:j]); i = j; continue
        if c == "/" and d == "*": j = js.find("*/", i + 2); j = n if j < 0 else j + 2; buf.append(js[i:j]); i = j; continue
        if c in "'\"":
            j = i + 1
            while j < n and js[j] != c and js[j] != "\n": j += 2 if js[j] == "\\" else 1
            if j >= n or js[j] != c: buf.append(c); i += 1; continue
            flush(); toks.append(("str", c, js[i + 1:j], None)); i, prev = j + 1, ")"; continue
        if c == "`":
            j, parts, cur = i + 1, [], []
            while j < n and js[j] != "`":
                if js[j] == "\\": cur.append(js[j:j + 2]); j += 2; continue
                if js[j] == "$" and js[j + 1:j + 2] == "{":
                    depth, k = 1, j + 2
                    while k < n and depth: depth += (js[k] == "{") - (js[k] == "}"); k += 1
                    parts += ["".join(cur), js[j + 2:k - 1]]; cur = []; j = k; continue
                cur.append(js[j]); j += 1
            if j >= n: buf.append(c); i += 1; continue
            parts.append("".join(cur)); flush(); toks.append(("tpl", parts, None)); i, prev = j + 1, ")"; continue
        if c == "/" and (prev == "" or prev in "(,=:[!&|?{};+-*%<>~^"):
            j, cls = i + 1, False
            while j < n and js[j] != "\n" and (js[j] != "/" or cls):
                if js[j] == "\\": j += 2; continue
                cls = True if js[j] == "[" else (False if js[j] == "]" else cls); j += 1
            buf.append(js[i:j + 1]); i, prev = j + 1, ")"; continue
        buf.append(c); i += 1
        if not c.isspace(): prev = c
    flush(); return toks

def js_tokens(js, segs):
    """Tokens with translatable literals registered in segs (index stored in the token)."""
    out = []
    for t in scan_js(js):
        if t[0] == "str" and AR.search(t[2]) and dec(t[2]) is not None:
            segs.append(dec(t[2])); t = ("str", t[1], t[2], len(segs) - 1)
        elif t[0] == "tpl" and any(AR.search(x) for x in t[1][0::2]) and not any("\\" in x for x in t[1][0::2]):
            st, ex = t[1][0::2], t[1][1::2]; txt = st[0]
            for k, e in enumerate(ex): txt += "\u27e6%d\u27e7" % k + st[k + 1]
            segs.append(txt); t = ("tpl", t[1], len(segs) - 1)
        out.append(t)
    return out

def build_js(toks, tr):
    o = []
    for t in toks:
        if t[0] == "code": o.append(t[1])
        elif t[0] == "str": o.append(t[1] + (enc(tr[t[3]], t[1]) if t[3] is not None else t[2]) + t[1])
        else:
            parts, idx = t[1], t[2]
            if idx is not None:
                found = sorted(int(x) for x in re.findall(r"\u27e6(\d+)\u27e7", tr[idx]))
                if found == list(range((len(parts) - 1) // 2)):
                    pieces = re.split(r"\u27e6(\d+)\u27e7", tr[idx]); s = ""
                    for k, pc in enumerate(pieces): s += enc(pc, "`") if k % 2 == 0 else "${" + parts[1::2][int(pc)] + "}"
                    o.append("`" + s + "`"); continue
            o.append("`" + "".join(x if k % 2 == 0 else "${" + x + "}" for k, x in enumerate(parts)) + "`")
    return "".join(o)

def fill(tmpl, tr, mark, esc):
    return re.sub(mark + r"(\d+)" + mark, lambda m: esc(tr[int(m.group(1))]), tmpl)

_NODE = {}
def js_ok(code):
    """Syntax check through ONE long-lived node process (vm.Script), so thousands of pages stay fast."""
    try:
        if "p" not in _NODE or _NODE["p"].poll() is not None:
            _NODE["p"] = subprocess.Popen(["node", "-e", "const vm=require('vm');require('readline').createInterface({input:process.stdin}).on('line',l=>{let ok=1;try{new vm.Script(JSON.parse(l))}catch(e){ok=0}console.log(ok)})"],
                                          stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8")
        _NODE["p"].stdin.write(json.dumps(code) + "\n"); _NODE["p"].stdin.flush()
        return _NODE["p"].stdout.readline().strip() == "1"
    except Exception: return False

# ---------------------------------------------------------------- translation with quality gate
def good(tr, src, rtl_script):
    if not rtl_script and sum(len(AR.findall(x)) for x in tr) > 3: return False      # still Arabic = not translated
    if any(a.strip() == b.strip() for a, b in zip(tr[:3], src[:3])): return False
    return len(tr[0]) <= 140 and len(tr[2]) <= 160

def chunks(segs):
    cur, size, out = [], 0, []
    for i, s in enumerate(segs):
        if cur and (size + len(s) > 2600 or len(cur) >= 70): out.append(cur); cur, size = [], 0
        cur.append(i); size += len(s)
    return out + ([cur] if cur else [])

def ensure(kind, slug, page, lang, counters):
    cache = ROOT / "i18n-tools" / kind / slug / (lang[0] + ".json")
    if cache.exists():
        try:
            d = json.loads(cache.read_text(encoding="utf-8"))
            if d.get("hash") == page["hash"]: return d["t"]
        except Exception: pass
    if STATE["stop"] or STATE["calls"] >= MAX_CALLS: return None
    segs, tr = page["segs"], [None] * len(page["segs"])
    for idx in chunks(segs):
        if STATE["calls"] >= MAX_CALLS: return None
        STATE["calls"] += 1
        out = translate([segs[i] for i in idx], lang[2])
        if not out: counters["failed"] += 1; return None
        for i, t in zip(idx, out): tr[i] = t
    if not good(tr, segs, bool(lang[3])): counters["rejected"] += 1; return None
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({"hash": page["hash"], "t": tr}, ensure_ascii=False), encoding="utf-8")
    counters["new"] += 1; counters["by_lang"][lang[0]] = counters["by_lang"].get(lang[0], 0) + 1
    return tr

# ---------------------------------------------------------------- render
SKIP_MARK = ('<!-- generated by scripts/intl_tools.py. The hidden ids make the deploy-time injector skip its Arabic menu/music here. -->\n'
             '<span id="mdm1m-btn" hidden></span><audio id="bg-music" preload="none"></audio><button id="music-btn" type="button" aria-label="Music" style="display:none">🔇</button>')
E = lambda s: html.escape(s, quote=True)

def clip(s, n): s = re.sub(r"\s+", " ", s).strip(); return s if len(s) <= n else s[:n - 1].rsplit(" ", 1)[0] + "…"

def alts_for(kind, slug, avail):
    a = [("ar", "%s/%s/%s.html" % (ORIGIN, kind, slug))] + [(l[1], "%s/intl/%s/%s/%s.html" % (ORIGIN, l[0], kind, slug)) for l in LANGS if l[0] in avail]
    d = dict(a).get("en") or a[0][1]
    return a + [("x-default", d)]

def render(kind, slug, lang, page, tr, avail, date):
    code, hl, _, rtl = lang
    script = page["js"]
    if page["jtok"]:
        cand = build_js(page["jtok"], tr)
        if cand != page["js"] and js_ok(cand): script = cand
    main = fill(page["tmpl"], tr, "\x00", lambda s: html.escape(s, quote=False))
    d = "rtl" if rtl else "ltr"
    style = re.sub(r"direction:\s*rtl;\s*text-align:\s*right", "direction:%s;text-align:%s" % (d, "right" if rtl else "left"), page["style"])
    u = "%s/intl/%s/%s/%s.html" % (ORIGIN, code, kind, slug)
    title = clip(tr[0] + " | MDM1", 70) if len(tr[0]) < 60 else clip(tr[0], 70)
    desc = clip(tr[1], 155)
    links = "\n".join('<link rel="alternate" hreflang="%s" href="%s">' % (h, x) for h, x in alts_for(kind, slug, avail))
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": tr[0], "description": desc, "inLanguage": hl, "url": u,
          "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}
    return f'''<!DOCTYPE html>
<html lang="{hl}" dir="{d}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{u}">
{links}
<meta property="og:type" content="website">
<meta property="og:site_name" content="MDM1">
<meta property="og:title" content="{E(clip(tr[0], 90))}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{u}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False).replace("<", "\\u003c")}</script>
<link rel="stylesheet" href="/css/global.css">
<link rel="stylesheet" href="/css/pages.css">
<style>{style}</style>
<meta name="google-adsense-account" content="ca-pub-8270783733461099">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8270783733461099" crossorigin="anonymous"></script>
</head>
<body>
{SKIP_MARK}
<nav class="navbar">
  <a href="/{code}/" class="nav-logo">👁️ MDM1</a>
  <a href="/intl/{code}/" class="nav-back">{E(tr[3])}</a>
</nav>
<header class="page-hero reveal">
  <div class="page-label">{E(tr[3])}</div>
  <h1 class="page-title">{E(tr[2])}</h1>
  <p class="page-sub">{E(desc)}</p>
</header>
<main class="page-content">
{main}
</main>
<footer class="page-footer">✦ MDM1 · {date} ✦</footer>
<script src="/js/global.js"></script>
{("<script>" + script + "</script>") if script else ""}
</body>
</html>
'''

def write(rel, content):
    f = ROOT / rel; f.parent.mkdir(parents=True, exist_ok=True); f.write_text(content, encoding="utf-8")

# ---------------------------------------------------------------- telegram (report only; never writes product names anywhere)
def telegram(text):
    tok, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not (tok and chat): print("telegram: secrets missing, report skipped"); return
    try:
        body = json.dumps({"chat_id": chat, "text": text[:3900], "disable_web_page_preview": True}).encode()
        urllib.request.urlopen(urllib.request.Request("https://api.telegram.org/bot%s/sendMessage" % tok, body, {"Content-Type": "application/json"}), timeout=30).read()
    except Exception as e: print("telegram failed:", type(e).__name__)

def main():
    today = dt.date.today().isoformat()
    items = []
    for kind, f in (("apps", "data/apps.json"), ("tools", "data/tools.json")):
        try: lst = json.loads((ROOT / f).read_text(encoding="utf-8"))[kind]
        except Exception: continue
        for x in lst:
            p = ROOT / kind / (x["slug"] + ".html")
            if p.exists(): items.append((x.get("date") or "", kind, x["slug"], p))
    items.sort(reverse=True)
    pages, skipped = {}, 0
    for d, kind, slug, p in items:
        pg = parse(p)
        if pg and len(pg["segs"]) <= 400: pages[(kind, slug)] = (pg, d)
        else: skipped += 1
    counters = {"new": 0, "failed": 0, "rejected": 0, "by_lang": {}}
    done = {}                                  # (kind, slug) -> {code: translation}
    for lang in LANGS:                         # priority: finish a language across all items before the next one
        for d, kind, slug, p in items:
            if (kind, slug) not in pages: continue
            tr = ensure(kind, slug, pages[(kind, slug)][0], lang, counters)
            if tr: done.setdefault((kind, slug), {})[lang[0]] = tr
        if STATE["stop"] or STATE["calls"] >= MAX_CALLS: break
    # also pick up anything translated on earlier days (cache is the source of truth)
    for (kind, slug), (pg, d) in pages.items():
        for lang in LANGS:
            c = ROOT / "i18n-tools" / kind / slug / (lang[0] + ".json")
            if lang[0] in done.get((kind, slug), {}) or not c.exists(): continue
            try:
                dd = json.loads(c.read_text(encoding="utf-8"))
                if dd.get("hash") == pg["hash"]: done.setdefault((kind, slug), {})[lang[0]] = dd["t"]
            except Exception: pass
    for old in (ROOT / "intl").glob("**/*.html") if (ROOT / "intl").exists() else []: old.unlink()   # regenerate from cache
    total, sm, per_lang = 0, [], {}
    for (kind, slug), langs in done.items():
        pg, d = pages[(kind, slug)]
        for lang in LANGS:
            if lang[0] in langs:
                write("intl/%s/%s/%s.html" % (lang[0], kind, slug), render(kind, slug, lang, pg, langs[lang[0]], set(langs), d or today)); total += 1
                per_lang.setdefault(lang[0], []).append((kind, slug, langs[lang[0]][0], d))
        al = alts_for(kind, slug, set(langs))
        xl = "".join('<xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (h, x) for h, x in al)
        for h, x in al:
            if h != "x-default": sm.append('<url><loc>%s</loc><lastmod>%s</lastmod>%s</url>' % (x, d or today, xl))
    for lang in LANGS:                          # crawlable per-language index
        rows = per_lang.get(lang[0])
        if not rows: continue
        rows.sort(key=lambda r: r[3], reverse=True)
        lis = "".join('<li style="margin:.5rem 0"><a href="/intl/%s/%s/%s.html" style="color:var(--gold-bright)">%s</a></li>' % (lang[0], k, s, E(t)) for k, s, t, _ in rows)
        t0 = done[(rows[0][0], rows[0][1])][lang[0]]
        idx = render("tools", "index", lang, {"tmpl": "<ul style=\"list-style:none;padding:0;line-height:1.8\">" + lis + "</ul>", "jtok": [], "js": "", "style": ""},
                     [t0[3], t0[3], t0[3], t0[3]], {lang[0]}, today)
        idx = re.sub(r'<link rel="alternate"[^>]*>\n', "", idx).replace("%s/intl/%s/tools/index.html" % (ORIGIN, lang[0]), "%s/intl/%s/" % (ORIGIN, lang[0]))
        write("intl/%s/index.html" % lang[0], idx)
    if sm:
        write("sitemap-intl.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(sm) + "\n</urlset>\n")
        rb = ROOT / "robots.txt"
        if rb.exists() and "sitemap-intl.xml" not in rb.read_text(encoding="utf-8"):
            t = rb.read_text(encoding="utf-8"); rb.write_text(t.replace("Sitemap: https://mdm1.org/sitemap-apps.xml", "Sitemap: https://mdm1.org/sitemap-apps.xml\nSitemap: https://mdm1.org/sitemap-intl.xml", 1) if "sitemap-apps.xml" in t else t.rstrip("\n") + "\nSitemap: https://mdm1.org/sitemap-intl.xml\n", encoding="utf-8")
    want = len(pages) * len(LANGS)
    lines = ["🌍 تقرير ترجمة الأدوات والتطبيقات — " + today,
             "✅ ترجمات جديدة اليوم: %d" % counters["new"] + ((" (" + "، ".join("%s×%d" % kv for kv in counters["by_lang"].items()) + ")") if counters["by_lang"] else ""),
             "📚 المنشور الآن: %d صفحة مترجمة من أصل %d (%d عنصراً × %d لغة)" % (total, want, len(pages), len(LANGS)),
             "🔁 نداءات النموذج المستخدمة: %d من %d" % (STATE["calls"], MAX_CALLS)]
    if counters["failed"] or counters["rejected"]: lines.append("⚠️ فشل: %d ، رُفض لجودة الترجمة: %d" % (counters["failed"], counters["rejected"]))
    if skipped: lines.append("⏭ عناصر ببنية غير مدعومة تُركت بالعربية: %d" % skipped)
    if STATE["stop"]: lines.append("⛔ توقف مبكراً: " + STATE["stop"])
    elif want > total: lines.append("▶ المتبقي: %d صفحة، يكملها التشغيل التالي" % (want - total))
    print("\n".join(lines)); telegram("\n".join(lines))

if __name__ == "__main__": main()
