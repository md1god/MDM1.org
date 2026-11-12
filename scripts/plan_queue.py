#!/usr/bin/env python3
"""Daily queue: turns the project PLANS in pages-registry.json into client-side apps, a few per day.

- Plans = registry entries whose title contains "خطة مشروع كاملة"; their text is read from pages/<number>.html.
- Position in the queue lives in data/plan-queue.json (done / skipped / failed, with reasons). Nothing is built twice.
- For each plan: the model writes an app spec (or says it cannot be a client-side app), the spec goes through the SAME gates as
  every other app (scripts/add_app.py validate), then is handed to .github/workflows/add-app.yml (which tests it in a browser and publishes).
- Environment: PLAN_PER_DAY (default 3), PLAN_DRY=1 (no dispatch, no state write), PLAN_MOCK=<json file> (offline test of the model answer).
"""
import contextlib, datetime as dt, io, json, os, re, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import llm as LLM
import trend_pages as T

REG, STATE = os.path.join(ROOT, "pages-registry.json"), os.path.join(ROOT, "data", "plan-queue.json")
MARK = "خطة مشروع كاملة"
PER_DAY = int(os.environ.get("PLAN_PER_DAY", "3"))
LIMIT = 55000          # GitHub caps workflow_dispatch inputs at ~65k characters
ATTEMPTS = 2           # model tries per plan before it is marked failed
ARABIC = "Arabic"


def plans():
    """Ordered list of (number, title) for every plan page, oldest first."""
    reg = json.load(open(REG, encoding="utf-8"))
    out = [(str(x["number"]), x["title"]) for x in reg if MARK in str(x.get("title", ""))]
    return sorted(out, key=lambda p: int(p[0]) if p[0].isdigit() else 10**9)


def plan_text(num):
    """Visible Arabic text of the plan page, scripts and styles removed, capped for the prompt."""
    try: h = open(os.path.join(ROOT, "pages", num + ".html"), encoding="utf-8").read()
    except OSError: return ""
    h = re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S)
    m = re.search(r'<main[^>]*class="page-content"[^>]*>(.*?)</main>', h, re.S)
    t = T.html.unescape(re.sub(r"<[^>]+>", " ", m.group(1) if m else h))
    return re.sub(r"\s+", " ", t).strip()[:6000]


def load_state():
    try: return json.load(open(STATE, encoding="utf-8"))
    except (OSError, ValueError): return {"done": {}}


def app_slugs():
    try: return {a["slug"] for a in json.load(open(os.path.join(ROOT, "data", "apps.json"), encoding="utf-8"))["apps"]}
    except Exception: return set()


def gate(r):
    """None when the repo's own app gates accept the spec, else the reason (fed back to the model)."""
    if not isinstance(r, dict) or not isinstance(r.get("slug"), str): return "not a JSON object with a slug"
    import add_app
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            add_app.validate(dict(r), app_slugs())
    except SystemExit:
        return buf.getvalue().strip().split("rejected:")[-1].strip() or "rejected"
    r["css"] = r.get("css") if isinstance(r.get("css"), str) else ""
    if len(json.dumps(r, ensure_ascii=False)) > LIMIT: return "too large: keep the whole JSON under 50000 characters"
    return None


PROMPT = """You are turning ONE project plan (a written business/product plan in Arabic) into ONE small free web app.

FIRST decide feasibility. Answer feasible=false (and do not build) when the plan's core cannot run as a client-side page:
it needs a server, accounts, payments, a blockchain/token, real investment or returns, medical or legal advice, or personal data about others.
Never promise prices, returns or profits in the app.

If feasible, build the single most useful core feature of the plan as ONE original app:
- all visible text in {lang}; vanilla JavaScript; no network calls, no external libraries, no storage of personal data;
- body_html holds the markup with ids (label/input/select/textarea/button/canvas); wrap results in <div class="out" id="out">;
- NO <script>, <style>, <link>, on* attributes or external URLs in body_html; script_js wires the ids;
- JavaScript: write arrow functions only; the words function, eval, Function, Reflect, Proxy, this[, location, history, open(, fetch, localStorage, window.open, setTimeout with a string, and any http/https text are FORBIDDEN in script_js;
- optional "css" string (no @import, no url()); intro paragraph of at least 80 words that starts with a quick answer;
- the whole JSON under 45000 characters.

Return ONLY JSON:
{"feasible": true|false, "reason": "short reason if not feasible",
 "slug": "ascii-kebab", "title": "{lang} SEO title <=70 chars", "h1": "{lang} heading", "description": "{lang} meta description 110-160 chars",
 "body_html": "", "script_js": "", "css": "", "faq": [{"q": "", "a": ""}, 3 to 5 items]}

PLAN TITLE: {title}
PLAN TEXT:
{text}
"""


def ask(title, text, feedback=""):
    if os.environ.get("PLAN_MOCK"): return json.load(open(os.environ["PLAN_MOCK"], encoding="utf-8"))
    msg = PROMPT.replace("{lang}", ARABIC).replace("{title}", title).replace("{text}", text)
    if feedback: msg += "\nYour previous answer was rejected because: " + feedback + ". Fix exactly that and return the full JSON again."
    return LLM.chat_json(msg, max_tokens=9000, temperature=0.4)


def build_one(num, title):
    """(status, detail): status is built | skipped | failed."""
    text = plan_text(num)
    if len(text) < 200: return "failed", "plan page not readable"
    feedback, last = "", "no answer"
    for _ in range(ATTEMPTS):
        r = ask(title, text, feedback)
        if not r: last = "no model answer"; continue
        if r.get("feasible") is False: return "skipped", str(r.get("reason", "not a client-side app"))[:200]
        fb = gate(r)
        if not fb: return "built", json.dumps(r, ensure_ascii=False)
        feedback = last = fb
    return "failed", last[:200]


def dispatch(app):
    """True when add-app.yml was handed the spec. A failure is logged and the plan is not marked built."""
    if os.environ.get("PLAN_DRY"): print("dry run, would dispatch", app["slug"]); return True
    try:
        subprocess.run(["gh", "workflow", "run", "add-app.yml", "-f", "app_json=" + json.dumps(app, ensure_ascii=False)], check=True, timeout=120)
        return True
    except (subprocess.SubprocessError, OSError) as e:
        print("::warning::dispatch failed:", type(e).__name__); return False


def save(state):
    if os.environ.get("PLAN_DRY"): return
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(state, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def main():
    state = load_state()
    todo = [(n, t) for n, t in plans() if n not in state["done"]]
    print("plans total %d, done %d, left %d, today %d" % (len(plans()), len(state["done"]), len(todo), PER_DAY))
    today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    used = set()
    for num, title in todo[:PER_DAY]:
        status, detail = build_one(num, title)
        state["done"][num] = {"status": status, "detail": detail[:200] if status != "built" else "", "date": today, "title": title}
        print("::notice::plan %s -> %s" % (num, status))
        if status == "built":
            app = json.loads(detail)
            if not dispatch(app):
                state["done"].pop(num, None)   # not sent: stays in the queue for the next run
                continue
            if app["slug"] in used or app["slug"] in app_slugs():   # two plans, one slug: keep both
                app["slug"] = app["slug"] + "-" + num
                if not gate(app) is None: app["slug"] = "plan-" + num
            used.add(app["slug"])
            state["done"][num]["slug"] = app["slug"]
        else:
            print("::warning::plan %s %s: %s" % (num, status, detail[:200]))
        save(state)   # after every plan, so a crash later never sends the same plan twice


if __name__ == "__main__":
    main()
