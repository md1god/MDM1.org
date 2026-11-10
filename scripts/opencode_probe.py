#!/usr/bin/env python3
"""Diagnostic: proves the OIDC key works, prints the free OpenCode Zen models right now, and sends one tiny message to each. Prints no secrets."""
import json, os, sys, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import llm as L

print("OPENCODE_API_KEY present:", bool(os.environ.get("OPENCODE_API_KEY")))
_k = os.environ.get("OPENCODE_API_KEY", "")
print("key length: %d, has whitespace at the edges: %s, has whitespace inside: %s" % (len(_k.strip()), _k != _k.strip(), any(c.isspace() for c in _k.strip())))
try:   # raw view of what Zen returns, so a changed naming scheme for free models is visible
    raw = json.loads(L._http(L.ZEN + "/models", headers={"Authorization": "Bearer " + _k.strip()}, timeout=60))
    items = raw.get("data", raw) if isinstance(raw, dict) else raw
    print("zen /models: %d items, first item keys: %s" % (len(items), sorted(items[0].keys()) if items and isinstance(items[0], dict) else items[:1]))
    print("all ids:", [m.get("id") if isinstance(m, dict) else m for m in items])
except urllib.error.HTTPError as e: print("raw /models failed: HTTP", e.code, e.read()[:300])
except Exception as e: print("raw /models failed:", type(e).__name__, str(e)[:200])
free = L.free_models()
print("free models now (%d): %s" % (len(free), free))
ok = 0
for m in free:
    txt = L._call(L.ZEN + "/chat/completions", {"Authorization": "Bearer " + os.environ["OPENCODE_API_KEY"], "Content-Type": "application/json"},
                  m, 'Reply with exactly this JSON: {"ok": true}', 50, 0, False)
    print("  %-34s -> %s" % (m, "OK " + repr(txt[:60]) if txt else "FAILED (see warning above)")); ok += bool(txt)
print("working free models: %d of %d" % (ok, len(free)))
sys.exit(0 if ok else 1)
