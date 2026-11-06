#!/usr/bin/env python3
"""Builds data/catalog.json: one classified record per app, tool and project plan.

Inputs  : data/apps.json, pages-registry.json, pages/*.html, tools/*.html,
          data/catalog-rules.json (auto rules), data/catalog-overrides.json (reviewed classifications + groups),
          data/excluded-pages.json (quarantined pages).
Output  : data/catalog.json   (the data layer; static catalog pages are built from it by build_catalog_pages.py)

Rules of the catalog (see PR): no file is moved or deleted, URLs are never changed, a project plan is never
presented as a working app, and every auto classification carries a confidence and a review state.
Run:  python3 scripts/build_catalog.py
"""
from __future__ import annotations
import html
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://mdm1.org"
rd = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8"))

RULES = [(r["key"], re.compile(r["pattern"], re.I)) for r in rd("data/catalog-rules.json")["rules"]]
CATS = rd("data/catalog-rules.json")["categories"]
OVR = rd("data/catalog-overrides.json")
EXCLUDED = {Path(e["path"]).stem for e in rd("data/excluded-pages.json")["excluded"]}
BOILER = re.compile(r"[—-]?\s*خطة (?:تنفيذ كاملة|أصلية) لمشروع رقمي جديد:.*$")

# user-facing tags (value = Arabic label shown in the catalog)
TAGS = {
    "offline": ("يعمل دون اتصال", r"دون اتصال|بدون إنترنت|بلا إنترنت|دون إنترنت|offline|بدون خادم|بلا خادم|دون خادم"),
    "in-browser": ("يعمل داخل المتصفح", r"داخل المتصفح|في المتصفح|متصفحك|بالمتصفح"),
    "local-processing": ("يعالج الملفات محليًا", r"محليًا|محليا|محلي|على جهازك|داخل جهازك|دون رفع|بدون رفع|لا تغادر"),
    "arabic-rtl": ("عربي ويدعم RTL", r"عربي|العربية|عربية|RTL"),
    "no-account": ("لا يحتاج حسابًا", r"بدون حساب|بلا حساب|دون حساب|بدون تسجيل|بلا تسجيل"),
    "for-developers": ("للمطورين", r"مطور|برمج|\bAPI\b|GraphQL|Kubernetes|DevOps|\bMCP\b|CI/CD"),
    "for-merchants": ("لأصحاب المتاجر", r"متجر|متاجر|تجار|مخزون|كاشير|بائع|بائعين|مطعم|Shopify"),
    "for-creators": ("لصناع المحتوى", r"صناع المحتوى|صانع محتوى|يوتيوب|بودكاست|مدون|لينكدإن|تيك توك"),
    "educational": ("تعليمي", r"تعليم|تعلّم|تعلم|طلاب|مذاكرة|بطاقات مراجعة|دورة"),
}
TAGS = {k: (label, re.compile(p, re.I)) for k, (label, p) in TAGS.items()}


def tags_for(text: str) -> list[str]:
    return [k for k, (_, rx) in TAGS.items() if rx.search(text)]


def matches(text: str) -> list[str]:
    seen: list[str] = []
    for key, rx in RULES:
        if rx.search(text) and key not in seen:
            seen.append(key)
    return seen


def clean(s: str) -> str:
    return BOILER.sub("", s)


def page_text(path: Path) -> tuple[str, str, str, str]:
    """title, description, what (product line), audience snippet of a project-plan page."""
    s = path.read_text(encoding="utf-8", errors="ignore")
    t = re.search(r"<title>(.*?)</title>", s, re.S)
    d = re.search(r'<meta name="description" content="(.*?)"', s, re.S)
    b = re.search(r"<body.*", s, re.S)
    body = b.group(0) if b else s
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", body, flags=re.S)
    txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body)))
    w = re.search(r"خطة (?:منتج|مشروع)\s*[:：]\s*(.{5,200}?)\s*(?:[1١]\)|\d\.|•|$)", txt)
    a = re.search(r"1\)\s*[^•]{0,40}•\s*(.{10,160}?)\s*•", txt)
    return (html.unescape(t.group(1).strip()) if t else "", html.unescape(d.group(1).strip()) if d else "",
            w.group(1).strip() if w else "", a.group(1) if a else "")


def short(text: str, limit: int = 40) -> str:
    """First clause, cut at a word boundary (never mid-word)."""
    t = re.split(r"[.،:—؟?!]|[1١]\)", (text or "").strip())[0].strip()
    if len(t) <= limit:
        return t
    cut = t[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(" ،-") + "…"


def norm(name: str) -> str:
    n = re.sub(r"[ً-ْـ]", "", name)
    n = re.sub(r"·.*$", "", n)
    return re.sub(r"[«»\"'“” ]", "", n).lower().strip()


def state(method: str, conf: float) -> str:
    if method == "reviewed":
        return "reviewed"
    return "auto-high-confidence" if conf >= 0.85 else "auto-needs-review"


def build() -> dict:
    records: list[dict] = []
    group_of = {a: g["id"] for g in OVR["groups"] for a in g["apps"]}

    # ---- working apps (each passed scripts/smoke_app.js before it was added) ----
    for a in rd("data/apps.json")["apps"]:
        slug = a["slug"]
        text = f'{a["h1"]} {a["title"]} {a["description"]}'
        hits = matches(text)
        if slug in OVR["apps"]:
            primary, method, conf = OVR["apps"][slug], "reviewed", 1.0
        else:
            primary, method, conf = (hits[0] if hits else "prod"), "auto", (0.85 if len(hits) == 1 else 0.6)
        secondary = [h for h in hits if h != primary][:2]
        records.append({
            "type": "working_app", "status": "working", "slug": slug, "url": f"/apps/{slug}.html",
            "title": a["h1"], "displayTitle": a["h1"], "description": a["description"], "date": a["date"],
            "primaryCategory": primary, "secondaryCategories": secondary, "tags": tags_for(text),
            "group": group_of.get(slug), "classificationMethod": method, "classificationConfidence": conf,
            "reviewState": state(method, conf), "needsReview": method != "reviewed" and conf < 0.85,
            "indexable": True, "duplicateName": False,
        })

    # ---- tools (static calculators) ----
    TOOL_CAT = {"loan-installment-calculator": "fin", "net-salary-calculator": "fin", "end-of-service-calculator": "biz",
                "discount-calculator": "biz", "profit-margin-calculator": "biz", "split-bill-calculator": "fin",
                "percentage-calculator": "edu", "zakat-calculator": "fin", "gold-value-calculator": "fin",
                "inheritance-calculator": "fin", "missed-prayers-fasting-planner": "life", "hijri-gregorian-converter": "prod",
                "bmi-calculator": "life", "pregnancy-due-date-calculator": "life", "age-calculator": "prod",
                "date-difference-calculator": "prod", "arabic-text-counter": "prod", "password-generator": "sec",
                "unit-converter-arabic": "edu", "study-time-planner": "edu", "trip-fuel-cost-calculator": "life"}
    for f in sorted((ROOT / "tools").glob("*.html")):
        if f.stem == "index":
            continue
        title, desc, _, _ = page_text(f)
        title = re.sub(r"\s*\|\s*MDM1\s*$", "", title)
        cat = TOOL_CAT.get(f.stem) or (matches(title + " " + desc) or ["prod"])[0]
        records.append({
            "type": "tool", "status": "working", "slug": f.stem, "url": f"/tools/{f.stem}.html", "title": title,
            "displayTitle": title, "description": desc, "date": None, "primaryCategory": cat, "secondaryCategories": [],
            "tags": ["in-browser", "arabic-rtl"], "group": None,
            "classificationMethod": "reviewed" if f.stem in TOOL_CAT else "auto",
            "classificationConfidence": 1.0 if f.stem in TOOL_CAT else 0.6,
            "reviewState": "reviewed" if f.stem in TOOL_CAT else "auto-needs-review",
            "needsReview": f.stem not in TOOL_CAT, "indexable": True, "duplicateName": False,
        })

    # ---- project plans (NOT products: status is always under_construction) ----
    plans = []
    for r in rd("pages-registry.json"):
        if not r.get("scoutId"):
            continue
        slug = str(r["slug"])
        f = ROOT / "pages" / f"{slug}.html"
        if not f.exists():
            continue
        _, desc, what, aud = page_text(f)
        name = re.sub(r"\s*·\s*.*$", "", r["title"].replace(" — خطة مشروع كاملة", "")).strip("«» ")
        slogan = re.split(r"\s+—\s+خطة", desc)[0].strip()
        plans.append({"slug": slug, "name": name, "slogan": slogan, "what": what, "aud": aud, "date": r["date"][:10]})

    groups: dict[str, list[dict]] = defaultdict(list)
    for p in plans:
        groups[norm(p["name"])].append(p)

    for p in plans:
        slug = p["slug"]
        first = matches(clean(f'{p["name"]} {p["slogan"]} {p["what"]}'))
        broken = slug in EXCLUDED
        if slug in OVR["plans"]:
            primary, secondary, method, conf = OVR["plans"][slug], [h for h in first if h != OVR["plans"][slug]][:2], "reviewed", 1.0
        elif first:
            primary, secondary = first[0], first[1:3]
            method, conf = "auto", (0.9 if len(first) == 1 else 0.7)
        else:
            aud = matches(clean(p["aud"][:120]))
            primary, secondary = (aud[0] if aud else "prod"), aud[1:3]
            method, conf = "auto", (0.55 if aud else 0.3)
        dup = len(groups[norm(p["name"])]) > 1
        display, disamb = p["name"], None
        if dup:
            cand = short(p["what"] or p["slogan"])
            siblings = [short(q["what"] or q["slogan"]) for q in groups[norm(p["name"])] if q is not p]
            disamb = cand if cand and cand not in siblings else f"{cand or 'مشروع'} (#{slug})"
            display = f'{p["name"]} — {disamb}'
        records.append({
            "type": "project_plan", "status": "under_construction", "slug": slug, "url": f"/pages/{slug}.html",
            "title": p["name"], "displayTitle": display, "baseName": p["name"], "disambiguator": disamb,
            "description": p["slogan"], "what": p["what"], "date": p["date"],
            "primaryCategory": primary, "secondaryCategories": secondary,
            "tags": tags_for(f'{p["name"]} {p["slogan"]} {p["what"]} {p["aud"]}'), "group": None,
            "classificationMethod": method, "classificationConfidence": conf,
            "reviewState": state(method, conf), "needsReview": method != "reviewed" and conf < 0.85,
            "indexable": False, "duplicateName": dup, "excluded": broken,
            **({"excludedReason": "عنوان/وصف مكسور، معزول مؤقتًا (انظر data/excluded-pages.json)"} if broken else {}),
        })

    records.sort(key=lambda r: ({"working_app": 0, "tool": 1, "project_plan": 2}[r["type"]], r["slug"] if r["type"] != "project_plan" else int(r["slug"])))
    by_type = defaultdict(int)
    for r in records:
        by_type[r["type"]] += 1
    games = rd("data/games.json")
    return {
        "generated": date.today().isoformat(),
        "meaning": {
            "working_app": "تطبيق يعمل في المتصفح واجتاز اختبار التشغيل الآلي (scripts/smoke_app.js) قبل إضافته.",
            "tool": "أداة أو حاسبة ثابتة تعمل في المتصفح.",
            "project_plan": "خطة مشروع قيد البناء. ليست منتجًا جاهزًا ولا تظهر كتطبيق.",
        },
        "categories": CATS,
        "counts": {**by_type, "games_records": len(games)},
        "games": {
            "records": len(games),
            "unique_ids": len({g["id"] for g in games}),
            "meaning": "كل سجل لعبة HTML5 تابعة لطرف ثالث (GameMonetize) تُعرض بـ iframe من رابط الناشر. لها صفحات هبوط تُولَّد وقت النشر ولا تُحفظ في الريبو.",
        },
        "groups": OVR["groups"],
        "tagLabels": {k: v[0] for k, v in TAGS.items()},
        "records": records,
    }


if __name__ == "__main__":
    cat = build()
    (ROOT / "data/catalog.json").write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    c = cat["counts"]
    rs = cat["records"]
    print("records", len(rs), dict(c))
    print("reviewState", {k: sum(1 for r in rs if r["reviewState"] == k) for k in ("reviewed", "auto-high-confidence", "auto-needs-review")})
    print("duplicateName plans", sum(1 for r in rs if r.get("duplicateName")), "excluded", sum(1 for r in rs if r.get("excluded")))
