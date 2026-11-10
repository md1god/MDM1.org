#!/usr/bin/env python3
"""Diagnostic: proves the OIDC key works, prints the free OpenCode Zen models right now, and sends one tiny message to each. Prints no secrets."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import llm as L

print("OPENCODE_API_KEY present:", bool(os.environ.get("OPENCODE_API_KEY")))
free = L.free_models()
print("free models now (%d): %s" % (len(free), free))
ok = 0
for m in free:
    txt = L._call(L.ZEN + "/chat/completions", {"Authorization": "Bearer " + os.environ["OPENCODE_API_KEY"], "Content-Type": "application/json"},
                  m, 'Reply with exactly this JSON: {"ok": true}', 50, 0, False)
    print("  %-34s -> %s" % (m, "OK " + repr(txt[:60]) if txt else "FAILED (see warning above)")); ok += bool(txt)
print("working free models: %d of %d" % (ok, len(free)))
sys.exit(0 if ok else 1)
