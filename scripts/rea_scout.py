#!/usr/bin/env python3
"""REA scout (additive). pick -> /tmp/target.json ; build -> /tmp/tool.json, validated with the repo's own gates.
Targets any software, app or tool (prefers paid / freemium). Clean-room: stage 1 writes a BEHAVIOR SPEC only,
stage 2 builds an original page from that spec alone. The studied product is named NOWHERE except the private Telegram report."""
import contextlib, datetime as dt, io, json, os, re, sys, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import trend_pages as T
import llm as LLM

# Source language of the generated pages. The site's own pipeline requires it: its validators reject pages with no Arabic text,
# and the new multilingual publisher (scripts/intl_tools.py) then translates them. Change it in ONE place only if that changes.
SRC = "Arabic"
LIMIT = 55000   # GitHub caps workflow_dispatch inputs at ~65k characters in total

def llm(msg):
    if os.environ.get("REA_MOCK"):   # offline test hook
        return json.load(open(os.environ["REA_MOCK"], encoding="utf-8")).get({"PICK": "pick", "SPEC": "spec"}.get(msg[:4], "tool"))
    return LLM.chat_json(msg, max_tokens=9000, temperature=0.4)   # OpenCode Zen free models first, GitHub Models as fallback (scripts/llm.py)

def app_slugs():
    try: return {a["slug"] for a in json.load(open("data/apps.json", encoding="utf-8"))["apps"]}
    except Exception: return set()

def norm(x): return re.sub(r"[^a-z0-9]", "", str(x).lower())

def pick():
    have = sorted({t["slug"] for t in T.load()["tools"]} | app_slugs())
    r = llm("PICK. Today is " + dt.date.today().isoformat() + ". Name ONE well-known software product, app or online tool of ANY kind and ANY domain "
            "(web app, desktop program, mobile app, utility, creative, business, education, media, developer tools, productivity, games...). "
            "Prefer well-known PAID or freemium products, but any is allowed. Do not pick the most obvious flagship: vary widely from day to day. "
            "Choose its single most valued feature that can be rebuilt as a small free client-side page (vanilla JS, no server, no account, no libraries, works offline). "
            "Avoid anything about passwords, payments, medical diagnosis or legal advice, and anything similar to these existing slugs: " + ", ".join(have) +
            '. Return ONLY JSON {"name":"product","url":"https://its-public-page","feature":"the one feature","kind":"tool or app"}. '
            "kind=tool for a calculator/converter/generator (form + result); kind=app for anything interactive (editor, planner, tracker, timer, canvas, mini game). "
            'If nothing fits return {"name":null}.')
    if not r or not r.get("name") or not str(r.get("url", "")).startswith("https://") or r.get("kind") not in ("tool", "app"):
        return print("no target")
    json.dump(r, open("/tmp/target.json", "w"), ensure_ascii=False)
    for secret in {str(r["name"]), re.sub(r"^https?://(www\.)?", "", r["url"]).split("/")[0]}: print("::add-mask::" + secret)   # public logs: never show the product
    print("target selected, kind=" + r["kind"])

def problem(r, kind, tg):
    """None if the repo's own gates accept it, else the reason (fed back to the model)."""
    if not isinstance(r, dict) or not isinstance(r.get("slug"), str): return "not a JSON object with a slug"
    if kind == "app":
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                import add_app   # runs main() on import: prints "no APP_JSON" and returns
                add_app.validate(dict(r), app_slugs())
        except SystemExit: return buf.getvalue().strip().split("rejected:")[-1].strip() or "rejected"
        r["css"] = r.get("css") if isinstance(r.get("css"), str) else ""
    else:
        r["pick"] = "evergreen:" + r["slug"]
        if not T.validate(r, [{"id": r["pick"], "name": r["slug"], "desc": "", "url": None}], T.load()): return T.LAST_REASON or "rejected"
        r.pop("pick", None)
    blob = " ".join(str(r.get(k, "")) for k in ("slug", "title", "h1", "description")) + " " + re.sub(r"<[^>]+>", " ", str(r.get("body_html", "")))
    words = {norm(w) for w in re.split(r"[^A-Za-z0-9]+", tg["name"])} | {norm(tg["name"])}
    if any(len(w) >= 4 and w in norm(blob) for w in words): return "mentions the original product name"
    if len(json.dumps(r, ensure_ascii=False)) > LIMIT: return "too large: keep the whole JSON under 50000 characters"
    return None

SHAPE = ('Return ONLY JSON {"slug":"ascii-kebab","title":"' + SRC + ' SEO title <=70 chars","h1":"' + SRC + ' heading","description":"' + SRC + ' meta description 110-160 chars",'
         '"body_html":"","script_js":"","faq":[{"q":"","a":""}  3-5 items]')

def build():
    if not os.path.exists("/tmp/target.json"): return print("no target today")
    note = lambda x: open("/tmp/outcome.txt", "w", encoding="utf-8").write(x)
    tg = json.load(open("/tmp/target.json", encoding="utf-8")); kind = tg["kind"]
    ev = open("/tmp/rea-evidence.txt", encoding="utf-8").read()[:12000] if os.path.exists("/tmp/rea-evidence.txt") else ""
    spec = llm("SPEC. Write a BEHAVIOR SPEC ONLY for ONE feature ('%s') of the product '%s', from its observable public behavior "
               "(the evidence below may be empty; then use general knowledge of what such a feature does). "
               'Return ONLY JSON {"purpose":"","inputs":[],"outputs":[],"rules":[],"edge_cases":[],"formats":[]}. '
               "No source code, no copied text, no brand names, no assets.\nEVIDENCE:\n%s" % (tg.get("feature", ""), tg["name"], ev))
    if not spec: note("failed|فشل كتابة وصف السلوك (نداء النموذج)"); return print("no spec")
    if kind == "app":
        rules = ('Build ONE original free client-side APP written in ' + SRC + ' (all visible text) (editor/planner/tracker/timer/canvas...) in vanilla JS: body_html has the markup with ids '
                 '(label/input/select/textarea/button/canvas, wrap results in <div class="out" id="out">), NO <script>/<style>/<link>/on* attributes/external URLs; '
                 'script_js wires the ids, no network, no eval, no http(s) strings; optional "css" string (no @import/url()). Intro paragraph >=80 words starting with a quick answer. '
                 'Whole JSON under 45000 characters. ' + SHAPE[:-1] + ',"css":""}.')
    else:
        rules = ('Build ONE original free client-side TOOL written in ' + SRC + ' (all visible text) in vanilla JS: no network, no <script> in body_html, wrap the result in <div class="out" id="out">, '
                 'intro paragraph >=80 words starting with a quick answer. ' + SHAPE + '}.')
    fb = ""
    for _ in range(3):
        r = llm("TOOL. Using ONLY this spec (never look at or mention the original product), new name, new code, new design.\nSPEC:\n" +
                json.dumps(spec, ensure_ascii=False) + "\n" + rules + (("\nPrevious answer rejected because: " + fb) if fb else ""))
        if not r: break
        fb = problem(r, kind, tg)
        if not fb:
            json.dump(r, open("/tmp/tool.json", "w"), ensure_ascii=False); note("built|%s|%s" % (kind, r["slug"])); return print("ready:", kind, r["slug"])
    note("failed|لم تنجح 3 محاولات بناء: " + str(fb)[:150]); print("no valid result today:", fb)


def tg_send(text):
    tok, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not (tok and chat): return print("telegram: secrets TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing, report skipped")
    try:
        body = json.dumps({"chat_id": chat, "text": text[:3900], "disable_web_page_preview": True}).encode()
        urllib.request.urlopen(urllib.request.Request("https://api.telegram.org/bot%s/sendMessage" % tok, body, {"Content-Type": "application/json"}), timeout=30).read()
        print("telegram: report sent")
    except Exception as e: print("telegram failed:", type(e).__name__)

def report():
    rd = lambda f: open(f, encoding="utf-8").read().strip() if os.path.exists(f) else ""
    lines = ["🔎 تقرير REA Scout — " + dt.date.today().isoformat()]
    if os.path.exists("/tmp/target.json"):
        tg = json.load(open("/tmp/target.json", encoding="utf-8"))
        size = os.path.getsize("/tmp/rea-evidence.txt") if os.path.exists("/tmp/rea-evidence.txt") else 0
        lines += ["المنتج المدروس: %s" % tg["name"], "الميزة المعاد بناؤها: %s" % tg.get("feature", ""),
                  "النوع: " + ("تطبيق" if tg["kind"] == "app" else "أداة"), "الصفحة العامة: %s" % tg["url"],
                  "REA: " + ("جمع أدلة من الصفحة (%d بايت)" % size if size > 200 else "لم يجمع أدلة، اعتمد الوصف على معرفة النموذج")]
        o = rd("/tmp/outcome.txt").split("|")
        if o[0] == "built":
            lines.append(("✅ بُني «%s» وسُلّم إلى مسار " % o[2] + ("add-app" if o[1] == "app" else "trend-pages") + " للنشر") if rd("/tmp/dispatched.txt") else "⚠️ بُني «%s» لكن فشل تسليمه للنشر" % o[2])
            lines.append("ملاحظة: النشر الفعلي يؤكده تشغيل المسار الثاني (فحص المتصفح قد يرفض الصفحة).")
        else: lines.append("❌ لم يُبنَ شيء: " + (o[1] if len(o) > 1 else "غير معروف"))
    else: lines.append("❌ لم يُختر منتج اليوم (فشل نداء النموذج، راجع لوج الخطوة 1).")
    tg_send("\n".join(lines))

if __name__ == "__main__": {"pick": pick, "build": build, "report": report}[sys.argv[1]]()
