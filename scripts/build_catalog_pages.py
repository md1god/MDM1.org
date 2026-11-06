#!/usr/bin/env python3
"""Builds the static catalog pages from data/catalog.json (run scripts/build_catalog.py first).

Every link is real HTML in the source (nothing depends on JavaScript to be crawlable). JavaScript is only used for
the optional search box on /projects/.

Output (all new URLs, no existing URL changes):
  /catalog/index.html                  hub: counts per type, how to read statuses, links to everything
  /catalog/groups/index.html           similar-app groups with comparison tables (each tool keeps its own page/canonical)
  /categories/<slug>/index.html        5 category pages (ai, developer-tools, business, education, privacy-offline)
  /projects/index.html                 project plans under construction (separate from apps; noindex,follow)
  sitemap-catalog.xml                  indexable catalog pages only (no filters, no plans, no quarantined pages)

Run:  python3 scripts/build_catalog_pages.py
"""
from __future__ import annotations
import html
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://mdm1.org"
CAT = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))
RECS = CAT["records"]
CATS = CAT["categories"]
TAGL = CAT["tagLabels"]
UPDATED = CAT["generated"]
E = lambda s: html.escape(str(s if s is not None else ""), quote=True)
n_ar = lambda n: f"{n:,}"

APPS = [r for r in RECS if r["type"] == "working_app"]
TOOLS = [r for r in RECS if r["type"] == "tool"]
PLANS = [r for r in RECS if r["type"] == "project_plan" and not r.get("excluded")]
BYSLUG = {r["slug"]: r for r in APPS}

ADSENSE = '<meta name="google-adsense-account" content="ca-pub-8270783733461099">'


def head(title: str, desc: str, path: str, noindex: bool = False, jsonld: str = "") -> str:
    url = f"{BASE}{path}"
    robots = '<meta name="robots" content="noindex,follow">\n' if noindex else ""
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{robots}<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{url}">
<link rel="stylesheet" href="/css/global.css">
<link rel="stylesheet" href="/css/pages.css">
<style>{CSS}</style>
{ADSENSE}
{jsonld}</head>
<body>
<div id="particles"></div>
<nav class="navbar">
  <a href="/index.html" class="nav-logo">🦅 MDM1</a>
  <a href="/catalog/" class="nav-back">الكتالوج</a>
</nav>
"""


CSS = """
.cat-wrap{max-width:980px;margin:0 auto}
.cat-wrap ul,.cat-wrap ol{list-style:none;padding:0;margin:0}
.cat-wrap li::before{content:none!important}
.cat-intro{font-size:1.02rem;line-height:1.95}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:1.2rem 0}
.stat{display:block;text-decoration:none;color:var(--light);border:1px solid rgba(201,168,76,.25);border-radius:12px;padding:.9rem 1rem;background:rgba(201,168,76,.04)}
.stat b{display:block;font-size:1.7rem;color:var(--gold-bright);font-variant-numeric:tabular-nums}
.stat span{font-size:.9rem;opacity:.85;color:var(--light);text-decoration:none}
a.stat:hover{border-color:var(--gold)}
.legend{display:flex;flex-wrap:wrap;gap:.6rem 1.4rem;margin:.6rem 0 1rem;font-size:.92rem}
.items{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;margin:1rem 0 1.6rem}
.it{border:1px solid rgba(201,168,76,.2);border-radius:12px;padding:.8rem 1rem;background:rgba(0,0,0,.25);min-width:0}
.it h3{font-size:1.02rem;margin:0 0 .3rem!important;line-height:1.5}
.it h3 a{color:var(--gold-bright);text-decoration:none;overflow-wrap:anywhere}
.it h3 a:hover{text-decoration:underline}
.it p{font-size:.88rem!important;line-height:1.7!important;margin:0 0 .5rem!important;opacity:.8}
.chips{display:flex;flex-wrap:wrap;gap:.35rem}
.chip{font-size:.74rem;padding:.05rem .6rem;border-radius:999px;border:1px solid rgba(201,168,76,.3);color:var(--light);opacity:.85}
.chip.ok{color:#34d399;border-color:rgba(52,211,153,.4)}
.chip.wip{color:var(--gold-bright);border-color:rgba(201,168,76,.45)}
.chip.rv{opacity:.6}
.tbl{overflow-x:auto;margin:.8rem 0 1.6rem}
.tbl table{width:100%;border-collapse:collapse;min-width:640px;font-size:.92rem}
.tbl th,.tbl td{padding:.6rem .8rem;border-bottom:1px solid rgba(201,168,76,.15);text-align:start;vertical-align:top}
.tbl th{color:var(--gold-bright);font-weight:700}
.tbl a{color:var(--gold-bright)}
.links{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0}
.links a{border:1px solid rgba(201,168,76,.35);border-radius:999px;padding:.35rem 1rem;color:var(--gold-bright);text-decoration:none}
.links a:hover{background:rgba(201,168,76,.12)}
.note{font-size:.9rem;opacity:.75}
.cat-wrap input[type=search]{width:100%;padding:.75rem 1rem;border-radius:10px;border:1px solid rgba(201,168,76,.3);background:rgba(0,0,0,.4);color:var(--light);font:inherit;margin:.6rem 0 1rem}
.cat-wrap section{margin-bottom:1.8rem}
"""


def foot() -> str:
    return f"""<footer class="page-footer">✦ MDM1 · آخر تحديث للكتالوج: {UPDATED} ✦</footer>
<script src="/js/global.js"></script>
</body>
</html>
"""


def hero(label: str, title: str, sub: str) -> str:
    return f"""<header class="page-hero reveal">
  <div class="page-label">{E(label)}</div>
  <h1 class="page-title">{E(title)}</h1>
  <p class="page-sub">{E(sub)}</p>
</header>
"""


def chips(r: dict, show_review: bool = False) -> str:
    out = []
    if r["type"] == "project_plan":
        out.append('<span class="chip wip">قيد البناء</span><span class="chip wip">يحتاج مساهمين</span>')
    else:
        out.append('<span class="chip ok">يعمل الآن</span>')
    for t in r["tags"][:4]:
        out.append(f'<span class="chip">{E(TAGL[t])}</span>')
    if show_review and r.get("needsReview"):
        out.append('<span class="chip rv">تصنيف آلي قيد المراجعة</span>')
    return '<div class="chips">' + "".join(out) + "</div>"


def item(r: dict, review: bool = False, desc_len: int = 130) -> str:
    d = (r.get("description") or "").strip()
    d = d if len(d) <= desc_len else d[:desc_len].rsplit(" ", 1)[0] + "…"
    return (f'<li class="it"><h3><a href="{E(r["url"])}">{E(r["displayTitle"])}</a></h3>'
            f'<p>{E(d)}</p>{chips(r, review)}</li>')


def items(rs: list[dict], review: bool = False) -> str:
    return '<ul class="items">' + "".join(item(r, review) for r in rs) + "</ul>"


# ---------------------------------------------------------------- category pages
CATEGORY_PAGES = {
    "ai": {
        "title": "أدوات وتطبيقات الذكاء الاصطناعي والوكلاء",
        "desc": "تطبيقات عربية تعمل في المتصفح للذكاء الاصطناعي: قياس ظهور العلامة في الإجابات، تصميم الوكلاء، مراجعة النصوص، ومحاكاة المساعدين الصوتيين.",
        "intro": "هنا التطبيقات التي تتعامل مع نماذج الذكاء الاصطناعي ووكلائه: تحليل ما تقوله المساعدات الذكية عن علامتك، تصميم سير عمل الوكلاء، فحص النصوص الآلية، وبناء مساعد استقبال صوتي. كلها تعمل داخل المتصفح ويمكنك تجربتها مجانًا.",
        "plans": ["ai"],
        "pick": lambda r: r["primaryCategory"] == "ai",
        "how": "اخترنا التطبيق إذا كان الذكاء الاصطناعي هو موضوعه الأساسي (تصنيف راجعناه يدويًا)، لا إذا ذكره في الوصف فقط.",
    },
    "developer-tools": {
        "title": "أدوات المطورين: فحص، نشر، وصيانة داخل المتصفح",
        "desc": "أدوات للمطورين تعمل داخل المتصفح: فحص GraphQL، محاكاة النشر وKubernetes، مراقبة الأخطاء، تدقيق إعدادات الخوادم وإدارة إضافات المتصفح.",
        "intro": "أدوات صغيرة للمطور اليومي: نفحص استعلامات GraphQL، نحاكي خطوط النشر وKubernetes، نراقب الأخطاء داخل الصفحة، ونوثّق الأكواد. لا تحتاج تثبيتًا ولا حسابًا، وتعمل على جهازك.",
        "plans": ["dev"],
        "pick": lambda r: r["primaryCategory"] == "dev" or "for-developers" in r["tags"],
        "how": "ضممنا التطبيق إذا كان تصنيفه الأساسي أدوات المطورين، أو كان موجّهًا للمطورين صراحة في وصفه.",
    },
    "business": {
        "title": "أدوات الأعمال والمتاجر: فواتير، مخزون، مبيعات وتسويق",
        "desc": "تطبيقات عربية للأعمال الصغيرة تعمل دون خادم: كاشير ومخزون وفواتير وعملاء وموارد بشرية وتسويق، وحاسبات للربح والخصم ونهاية الخدمة.",
        "intro": "لصاحب المتجر أو المشروع الصغير: كاشير ومخزون وفواتير ومتابعة عملاء وموارد بشرية، مع أدوات للتسويق والمحتوى وحاسبات للربح والخصم. تُحفظ البيانات على جهازك ولا تُرسل إلى أي خادم.",
        "plans": ["biz", "fin", "mkt"],
        "pick": lambda r: r["primaryCategory"] in ("biz", "fin", "mkt") or "for-merchants" in r["tags"],
        "how": "ضممنا ما تصنيفه الأساسي أعمال أو مال أو تسويق، أو الموجّه لأصحاب المتاجر.",
    },
    "education": {
        "title": "التعليم والتعلّم: بطاقات، قواميس، لغات ومذاكرة",
        "desc": "تطبيقات تعليمية عربية تعمل دون اتصال: بطاقات مراجعة، قواميس، تعلّم اليابانية والصينية، آلة حاسبة علمية، ومخططات مذاكرة.",
        "intro": "أدوات للطالب والمتعلّم: بطاقات مراجعة متباعدة، قاموس عربي إنجليزي، تعلّم الحروف اليابانية والبينين، آلة حاسبة علمية وحاسبة رمزية، ومخطط للمذاكرة. للمصادر الخارجية المجانية انظر أيضًا مكتبة المذاكرة.",
        "plans": ["edu"],
        "pick": lambda r: r["primaryCategory"] == "edu" or "educational" in r["tags"],
        "how": "ضممنا ما تصنيفه الأساسي تعليم، أو وُصف بأنه تعليمي صراحة. صفحات التعلّم الأوسع في مكتبة المذاكرة وركن الصغار.",
        "extra": '<p class="note">انظر أيضًا: <a href="/learn/library.html">مكتبة المذاكرة</a> و<a href="/learn/kids.html">ركن الصغار</a>.</p>',
    },
    "privacy-offline": {
        "title": "أدوات تعمل دون اتصال وتحفظ بياناتك على جهازك",
        "desc": "تطبيقات تعمل دون إنترنت ولا ترسل بياناتك لأي خادم: مدير كلمات مرور، نسخ احتياطي محلي، فحص خصوصية، ومحررات تعالج ملفاتك محليًا.",
        "intro": "تطبيقات تعمل بعد تحميل الصفحة دون اتصال، وتبقي ملفاتك وبياناتك على جهازك. مناسبة لمن يهتم بالخصوصية أو يعمل في مكان إنترنته ضعيف.",
        "plans": ["sec"],
        "pick": lambda r: "offline" in r["tags"] or r["primaryCategory"] == "sec",
        "how": "ضممنا ما يذكر في وصفه أنه يعمل دون اتصال أو دون خادم، وما تصنيفه الأساسي الأمان والخصوصية.",
    },
}


def category_page(slug: str, cfg: dict) -> str:
    apps = [r for r in APPS if cfg["pick"](r)]
    tools = [r for r in TOOLS if cfg["pick"](r)]
    plans = [r for r in PLANS if r["primaryCategory"] in cfg["plans"]]
    top_plans = sorted(plans, key=lambda r: (-r["classificationConfidence"], r["date"]))[:12]
    gids = sorted({r["group"] for r in apps if r["group"]})
    groups = [g for g in CAT["groups"] if g["id"] in gids]
    path = f"/categories/{slug}/"
    jl = {"@context": "https://schema.org", "@type": "CollectionPage", "name": cfg["title"], "url": f"{BASE}{path}",
          "mainEntity": {"@type": "ItemList", "numberOfItems": len(apps),
                         "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{BASE}{r['url']}", "name": r["displayTitle"]} for i, r in enumerate(apps)]}}
    h = head(cfg["title"] + " | MDM1", cfg["desc"], path, jsonld=f'<script type="application/ld+json">{json.dumps(jl, ensure_ascii=False)}</script>\n')
    h += hero("MDM1 · الكتالوج", cfg["title"], cfg["desc"])
    h += '<main class="page-content cat-wrap">\n'
    h += f'<p class="cat-intro">{E(cfg["intro"])}</p>\n'
    tool_stat = f'<div class="stat"><b>{n_ar(len(tools))}</b><span>أداة وحاسبة</span></div>' if tools else ''
    h += (f'<div class="stats"><div class="stat"><b>{n_ar(len(apps))}</b><span>تطبيقًا يعمل الآن</span></div>'
          + tool_stat +
          f'<div class="stat"><b>{n_ar(len(plans))}</b><span>مشروعًا قيد البناء في هذا التصنيف</span></div></div>\n')
    h += f'<p class="note"><strong>كيف اخترنا العناصر:</strong> {E(cfg["how"])} آخر تحديث: {UPDATED}.</p>\n'
    if cfg.get("extra"):
        h += cfg["extra"] + "\n"
    h += f'<section><h2>تطبيقات تعمل الآن ({n_ar(len(apps))})</h2>{items(apps)}</section>\n'
    if tools:
        h += f'<section><h2>أدوات وحاسبات ({n_ar(len(tools))})</h2>{items(tools)}</section>\n'
    if groups:
        h += '<section><h2>مجموعات تطبيقات متشابهة</h2><p>إذا وجدت أكثر من تطبيق يبدو متشابهًا، فهذه مقارنة سريعة بينها:</p><div class="links">'
        h += "".join(f'<a href="/catalog/groups/#{E(g["id"])}">{E(g["title"])}</a>' for g in groups) + "</div></section>\n"
    if top_plans:
        h += ('<section><h2>مشاريع قيد البناء في هذا التصنيف</h2>'
              '<p>هذه <strong>ليست تطبيقات جاهزة</strong>. هي خطط مشاريع كاملة تحتاج مطورين ومراجعين وممولين. تصنيفها آلي وقيد المراجعة.</p>'
              + items(top_plans, review=True) +
              f'<p><a href="/projects/">كل المشاريع قيد البناء ({n_ar(len(PLANS))})</a></p></section>\n')
    h += '<p class="note">الفرق بين الجاهز وقيد البناء: <strong>يعمل الآن</strong> يعني أن التطبيق اجتاز اختبار تشغيل آلي ويمكنك استخدامه فورًا. <strong>قيد البناء</strong> يعني خطة فقط.</p>\n</main>\n'
    return h + foot()


# ---------------------------------------------------------------- hub
def hub_page() -> str:
    path = "/catalog/"
    nplans = len(PLANS)
    h = head("كتالوج MDM1: التطبيقات والأدوات والمشاريع قيد البناء", "ما الذي يمكنك استخدامه الآن في MDM1 وما الذي ما زال مشروعًا يحتاج مساهمين: تطبيقات تعمل، أدوات وحاسبات، ألعاب، ومشاريع قيد البناء.", path)
    h += hero("MDM1 · الكتالوج", "ماذا تستطيع استخدامه الآن؟", "وما الذي ما زال مشروعًا يحتاج مساهمين؟")
    h += '<main class="page-content cat-wrap">\n'
    h += (f'<p class="cat-intro">كتالوج واحد لكل ما في الموقع، مفصول بوضوح بين ما يعمل فعلًا وما هو خطة فقط. التطبيقات والأدوات مجانية وتعمل في المتصفح. المشاريع قيد البناء فرصة للمساهمة. آخر تحديث: {UPDATED}.</p>\n')
    h += ('<div class="stats">'
          f'<a class="stat" href="/apps/"><b>{n_ar(len(APPS))}</b><span>تطبيقًا يعمل الآن</span></a>'
          f'<a class="stat" href="/tools/"><b>{n_ar(len(TOOLS))}</b><span>أداة وحاسبة</span></a>'
          f'<a class="stat" href="/projects/"><b>{n_ar(nplans)}</b><span>فكرة أو مشروع قيد البناء</span></a>'
          f'<a class="stat" href="/games.html"><b>{n_ar(CAT["games"]["records"])}</b><span>لعبة HTML5 في الفهرس (روابط ناشرين)</span></a>'
          '</div>\n')
    h += ('<div class="legend"><span><span class="chip ok">يعمل الآن</span> اجتاز اختبار تشغيل آلي</span>'
          '<span><span class="chip wip">قيد البناء</span> خطة فقط، ليست منتجًا</span>'
          '<span><span class="chip wip">يحتاج مساهمين</span> تبحث عن مطورين أو مراجعين</span>'
          '<span><span class="chip rv">تصنيف آلي قيد المراجعة</span> التصنيف غير نهائي</span></div>\n')
    h += '<section><h2>تصفّح حسب الموضوع</h2><div class="links">'
    for slug, cfg in CATEGORY_PAGES.items():
        h += f'<a href="/categories/{slug}/">{E(cfg["title"].split(":")[0])}</a>'
    h += '<a href="/catalog/groups/">مجموعات التطبيقات المتشابهة</a></div></section>\n'
    # all categories as a plain table (no thin pages)
    byc_a, byc_p = defaultdict(int), defaultdict(int)
    for r in APPS:
        byc_a[r["primaryCategory"]] += 1
    for r in PLANS:
        byc_p[r["primaryCategory"]] += 1
    h += '<section><h2>كل التصنيفات</h2><div class="tbl"><table><thead><tr><th>التصنيف</th><th>تطبيقات تعمل</th><th>مشاريع قيد البناء</th></tr></thead><tbody>'
    for k, label in CATS.items():
        h += f'<tr><td>{E(label)}</td><td>{n_ar(byc_a[k])}</td><td>{n_ar(byc_p[k])}</td></tr>'
    h += '</tbody></table></div><p class="note">التطبيقات صُنّفت يدويًا. تصنيف المشاريع آلي في معظمه ويُراجع تدريجيًا، لذلك لا نعتبره نهائيًا.</p></section>\n'
    h += ('<section><h2>عن الألعاب</h2><p>الرقم يمثل ' + n_ar(CAT["games"]["records"]) + ' سجل لعبة HTML5 من ناشر خارجي. كل لعبة تُشغَّل من رابط الناشر داخل صفحتنا، ولسنا مطوريها.</p></section>\n')
    h += '</main>\n'
    return h + foot()


# ---------------------------------------------------------------- groups
def first_sentence(t: str, n: int = 110) -> str:
    t = re.split(r"[.:؟!]", (t or "").strip())[0].strip()
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"


def groups_page() -> str:
    path = "/catalog/groups/"
    h = head("مقارنة التطبيقات المتشابهة | كتالوج MDM1", "عندما يكون لدينا أكثر من تطبيق للفكرة نفسها، نضع بينها جدول مقارنة: لمن يناسب كل تطبيق، وظيفته الأساسية، وهل يعمل محليًا.", path)
    h += hero("MDM1 · الكتالوج", "مجموعات التطبيقات المتشابهة", "كل تطبيق له صفحته الخاصة، وهنا نشرح الفرق بينها.")
    h += '<main class="page-content cat-wrap">\n<p class="cat-intro">بعض الأفكار بنيناها أكثر من مرة بزوايا مختلفة. بدل أن تظهر متنافسة بلا تفسير، جمعناها هنا مع مقارنة سريعة. لا نحذف أيًا منها، وكل صفحة تحتفظ بعنوانها الأصلي.</p>\n'
    h += '<div class="links">' + "".join(f'<a href="#{E(g["id"])}">{E(g["title"])}</a>' for g in CAT["groups"]) + "</div>\n"
    for g in CAT["groups"]:
        rows = ""
        for s in g["apps"]:
            r = BYSLUG.get(s)
            if not r:
                continue
            who = "، ".join(TAGL[t] for t in r["tags"] if t in ("for-developers", "for-merchants", "for-creators", "educational")) or "الاستخدام العام"
            local = "نعم" if ("offline" in r["tags"] or "local-processing" in r["tags"]) else "داخل المتصفح"
            rows += (f'<tr><td><a href="{E(r["url"])}">{E(r["displayTitle"])}</a></td><td>{E(who)}</td>'
                     f'<td>{E(first_sentence(r["description"]))}</td><td>{local}</td><td><span class="chip ok">يعمل الآن</span></td></tr>')
        h += (f'<section id="{E(g["id"])}"><h2>{E(g["title"])}</h2><div class="tbl"><table><thead><tr>'
              '<th>الأداة</th><th>مناسبة لـ</th><th>أهم وظيفة</th><th>تعمل محليًا؟</th><th>الحالة</th></tr></thead><tbody>'
              f'{rows}</tbody></table></div></section>\n')
    h += '<p class="note">«مناسبة لـ» و«تعمل محليًا» مستخرجتان من وصف كل تطبيق، وليستا اختبارًا مستقلًا.</p>\n</main>\n'
    return h + foot()


# ---------------------------------------------------------------- projects (noindex: plans are not products)
def projects_page() -> str:
    path = "/projects/"
    h = head("مشاريع قيد البناء | كتالوج MDM1", "خطط مشاريع رقمية كاملة قيد البناء تبحث عن مطورين ومراجعين وممولين. ليست تطبيقات جاهزة.", path, noindex=True)
    h += hero("MDM1 · الكتالوج", "مشاريع قيد البناء", f"{n_ar(len(PLANS))} خطة مشروع. ليست منتجات جاهزة وتحتاج مساهمين.")
    h += ('<main class="page-content cat-wrap">\n<p class="cat-intro">كل صفحة هنا خطة كاملة: الجمهور، الفكرة، النطاق الأول، النموذج الربحي والمخاطر. لم يُبنَ أي منها بعد. '
          'إن أعجبتك فكرة وتريد المساهمة بالتطوير أو المراجعة أو التمويل، افتح صفحتها. تصنيف هذه الخطط آلي في معظمه وقيد المراجعة.</p>\n'
          '<input type="search" id="q" placeholder="ابحث باسم المشروع أو فكرته" aria-label="بحث في المشاريع">\n<p class="note" id="cnt"></p>\n')
    by = defaultdict(list)
    for r in PLANS:
        by[r["primaryCategory"]].append(r)
    for k, label in CATS.items():
        if not by[k]:
            continue
        rs = sorted(by[k], key=lambda r: int(r["slug"]))
        h += f'<section class="grp" id="c-{k}"><h2>{E(label)} ({n_ar(len(rs))})</h2>{items(rs, review=True)}</section>\n'
    h += """<script>
(function(){var q=document.getElementById('q'),c=document.getElementById('cnt');
function run(){var v=q.value.trim().toLowerCase(),n=0;
document.querySelectorAll('.grp').forEach(function(g){var any=false;
g.querySelectorAll('li.it').forEach(function(li){var ok=!v||li.textContent.toLowerCase().indexOf(v)>=0;li.hidden=!ok;if(ok){any=true;n++}});g.hidden=!any});
c.textContent=v?n+' نتيجة':''}
q.addEventListener('input',run)})();
</script>
</main>
"""
    return h + foot()


# ---------------------------------------------------------------- sitemap
def write_sitemap(paths: list[str]) -> None:
    body = "".join(f"  <url>\n    <loc>{BASE}{p}</loc>\n    <lastmod>{UPDATED}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n" for p in paths)
    (ROOT / "sitemap-catalog.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "</urlset>\n", encoding="utf-8")
    robots = ROOT / "robots.txt"
    txt = robots.read_text(encoding="utf-8")
    line = f"Sitemap: {BASE}/sitemap-catalog.xml"
    if line not in txt:
        robots.write_text(txt.rstrip("\n") + "\n" + line + "\n", encoding="utf-8")


def put(path: str, content: str) -> None:
    f = ROOT / path.strip("/") / "index.html"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    indexable = ["/catalog/", "/catalog/groups/"]
    put("/catalog/", hub_page())
    put("/catalog/groups/", groups_page())
    for slug, cfg in CATEGORY_PAGES.items():
        put(f"/categories/{slug}/", category_page(slug, cfg))
        indexable.append(f"/categories/{slug}/")
    put("/projects/", projects_page())
    write_sitemap(indexable)
    print("pages:", len(indexable) + 1, "| sitemap-catalog urls:", len(indexable))
    for slug, cfg in CATEGORY_PAGES.items():
        print(slug, "apps", sum(1 for r in APPS if cfg["pick"](r)), "tools", sum(1 for r in TOOLS if cfg["pick"](r)),
              "plans", sum(1 for r in PLANS if r["primaryCategory"] in cfg["plans"]))
