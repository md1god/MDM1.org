#!/usr/bin/env python3
"""One-shot diagnostic for the GitHub Models API as seen from GitHub Actions. Sends a trivial prompt, prints status/headers/body head.
Prints no secrets (the Authorization header is never echoed). Touches no repo file."""
import json, os, sys, urllib.error, urllib.request

BASE = "https://models.github.ai"
TOKEN = os.environ.get("GITHUB_TOKEN", "")

def show(title, status, headers, raw):
    keep = {k: v for k, v in headers.items() if k.lower() in ("content-type", "content-length", "retry-after", "x-request-id") or k.lower().startswith("x-ratelimit")}
    print("== %s\n   status=%s headers=%s\n   body[:300]=%r" % (title, status, keep, raw[:300]))

def call(method, path, body=None, accept=True):
    h = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
    if accept: h.update({"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
    req = urllib.request.Request(BASE + path, json.dumps(body).encode() if body else None, h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=60); return r.status, dict(r.headers), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read().decode("utf-8", "replace")
    except Exception as e: return "EXC", {}, repr(e)

print("token present:", bool(TOKEN))
st, hd, raw = call("GET", "/catalog/models")
show("catalog", st, hd, raw)
try:
    ids = [m.get("id") for m in json.loads(raw)]; print("   catalog ids (%d): %s" % (len(ids), ids[:60]))
except Exception: pass
for model in ("openai/gpt-4.1-mini", "openai/gpt-4o-mini", "openai/gpt-4.1"):
    for accept in (True, False):
        body = {"model": model, "max_tokens": 50, "messages": [{"role": "user", "content": 'Reply with exactly this JSON: {"ok": true}'}]}
        st, hd, raw = call("POST", "/inference/chat/completions", body, accept)
        show("%s accept_headers=%s" % (model, accept), st, hd, raw)
