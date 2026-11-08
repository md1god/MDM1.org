#!/usr/bin/env python3
"""REA scout (additive). pick -> target.json ; build -> tool.json validated with the repo's own gates.
Clean-room: stage 1 writes a BEHAVIOR SPEC only; stage 2 builds from the spec alone. Never edits site files."""
import json, os, re, sys, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import trend_pages as T

def llm(msg):
    if os.environ.get("REA_MOCK"):   # offline test hook
        return json.load(open(os.environ["REA_MOCK"], encoding="utf-8")).get({"PICK": "pick", "SPEC": "spec"}.get(msg[:4], "tool"))
    for m in T.MODELS:
        try:
            body = json.dumps({"model": m, "temperature": 0.4, "max_tokens": 6500, "response_format": {"type": "json_object"},
                               "messages": [{"role": "user", "content": msg}]}).encode()
            r = urllib.request.Request("https://models.github.ai/inference/chat/completions", body,
                {"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"], "Content-Type": "application/json"})
            return json.loads(json.load(urllib.request.urlopen(r, timeout=180))["choices"][0]["message"]["content"])
        except Exception as e: print("::warning::", m, e)
    return None

def pick():
    have = [t["slug"] for t in T.load()["tools"]]
    r = llm("PICK. Name ONE well-known paid or freemium WEB tool whose core function is simple enough to rebuild as a client-side calculator/converter/generator "
            "(no server, no account). Its public page must work without login. Avoid anything similar to these existing slugs: " + ", ".join(have) +
            '. Return ONLY JSON {"name":"..","url":"https://.."} or {"name":null}.')
    if not r or not r.get("name") or not str(r.get("url", "")).startswith("https://"): print("no target"); return
    json.dump(r, open("/tmp/target.json", "w")); print("target:", r["name"], r["url"])

def build():
    if not os.path.exists("/tmp/target.json"): return print("no target today")
    tg = json.load(open("/tmp/target.json"))
    ev = open("/tmp/rea-evidence.txt", encoding="utf-8").read()[:12000] if os.path.exists("/tmp/rea-evidence.txt") else ""
    spec = llm("SPEC. Write a BEHAVIOR SPEC ONLY for the public web tool '%s' from its observable behavior (evidence below may be empty; then use general knowledge of what such tools do). "
               'Return ONLY JSON {"purpose":"","inputs":[],"outputs":[],"rules":[],"edge_cases":[],"formats":[]}. '
               "No source code, no copied text, no brand names, no assets.\nEVIDENCE:\n%s" % (tg["name"], ev))
    if not spec: return print("no spec")
    d, fb = T.load(), ""
    for _ in range(3):
        r = llm("TOOL. Using ONLY this spec (never look at or mention the original product), build ONE original free Arabic client-side tool, new name, new code.\nSPEC:\n" + json.dumps(spec, ensure_ascii=False) +
                "\nRules: vanilla JS, no network, no <script> in body_html, wrap result in <div class=\"out\" id=\"out\">, intro paragraph >=80 words starting with a quick answer. "
                'Return ONLY JSON {"slug":"ascii-kebab","title":"<=70 chars","h1":"","description":"110-160 chars","body_html":"","script_js":"","faq":[{"q":"","a":"" } x3-5]}.' +
                (("\nPrevious answer rejected because: " + fb) if fb else ""))
        if not r: break
        r["pick"] = "evergreen:" + str(r.get("slug", ""))
        pool = [{"id": r["pick"], "name": str(r.get("slug", "")), "desc": "", "url": None}]
        c = T.validate(r, pool, d)
        brand = re.sub(r"[^a-z0-9]", "", tg["name"].lower())
        if c and brand and brand in re.sub(r"[^a-z0-9]", "", (r["slug"] + r["title"] + r["h1"]).lower()): c, T.LAST_REASON = None, "contains source brand"
        if c:
            r.pop("pick"); json.dump(r, open("/tmp/tool.json", "w"), ensure_ascii=False); return print("tool ready:", r["slug"])
        fb = T.LAST_REASON
    print("no valid tool today:", fb)

if __name__ == "__main__": {"pick": pick, "build": build}[sys.argv[1]]()
