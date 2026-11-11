#!/usr/bin/env python3
"""Diagnostic (manual workflow). Prints what OpenCode Zen publishes (id, price, free or not), sends one tiny message to each free model,
shows the full server answer when it refuses, then runs the same llm.chat_json path the pipelines use. Prints no secrets.
`--first-free` just prints the first free model id (used by the CLI step of the workflow)."""
import json, os, sys, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import llm as L

k = os.environ.get("OPENCODE_API_KEY", "").strip()

if "--first-free" in sys.argv:
    try: print(next(m["id"] for m in L.catalogue() if L.is_free(m)))
    except Exception: pass
    sys.exit(0)

print("OPENCODE_API_KEY present:", bool(k), "| length:", len(k))
try:
    items = L.catalogue()
    print("zen /models: %d items" % len(items))
    for m in items:
        print("  %-30s free=%-5s cost=%s" % (m.get("id"), L.is_free(m), json.dumps(m.get("cost"))))
except urllib.error.HTTPError as e: print("catalogue failed: HTTP", e.code, e.read()[:300])
except Exception as e: print("catalogue failed:", type(e).__name__, str(e)[:200])

free = L.free_models()
print("free models now (%d): %s" % (len(free), free))

if free:   # one raw call with the complete answer, so a refusal can be read in full (status, body and rate-limit style headers)
    body = {"model": free[0], "max_tokens": 20, "messages": [{"role": "user", "content": "ping"}]}
    req = urllib.request.Request(L.ZEN + "/chat/completions", json.dumps(body).encode(),
                                 {"Authorization": "Bearer " + k, "Content-Type": "application/json", "User-Agent": "mdm1-pipeline/1.0 (+https://mdm1.org)"})
    try:
        r = urllib.request.urlopen(req, timeout=120); print("raw call to %s -> HTTP %s: %s" % (free[0], r.status, r.read()[:300]))
    except urllib.error.HTTPError as e:
        print("raw call to %s -> HTTP %s" % (free[0], e.code))
        print("  body:", e.read()[:1500])
        print("  headers:", {a: b for a, b in e.headers.items() if a.lower() not in ("set-cookie", "authorization")})
    except Exception as e: print("raw call failed:", type(e).__name__, str(e)[:200])

ok, refused = 0, False
for m in free:
    if L._cache["zen_off"]:
        refused = True
        print("  skipped (Zen already answered a free-usage-limit 429): " + m)
        continue
    txt = L._call(L.ZEN + "/chat/completions", {"Authorization": "Bearer " + k, "Content-Type": "application/json"},
                  m, 'Reply with exactly this JSON: {"ok": true}', 50, 0, False)
    print("  %-34s -> %s" % (m, "OK " + repr(txt[:60]) if txt else "FAILED (see warning above)")); ok += bool(txt)
print("working free models: %d of %d" % (ok, len(free)))

print("--- end to end through llm.chat_json (what the pipelines really do: Zen first, GitHub Models after)")
L._cache["zen_off"] = False; L._cache["dead"].clear()
r = L.chat_json('Return only this JSON: {"ok": true}', max_tokens=50, temperature=0)
print("result:", r, "| answered by:", L.LAST["backend"])

if refused: print("Zen refused with a free-usage-limit 429; this diagnostic is informational and does not fail the workflow.")
sys.exit(0 if ok or refused or r else 1)
